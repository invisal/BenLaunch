/**
 * Runs a Widget's user-authored code and normalizes what it returns.
 *
 * Kept as a standalone, Electron-free module so both the out-of-process worker
 * (`./worker.ts`) and the `node --test` suite can use it. It is
 * NOT a security sandbox — the code runs with full Node access, on purpose (see
 * the plan's "Known tradeoff"). The process boundary and the timeout are what
 * keep a slow or runaway Widget from hurting the launcher.
 *
 * Snippets are authored in TypeScript. We strip the types with Node's built-in
 * `stripTypeScriptTypes` before eval — `mode: 'strip'` only removes annotations
 * (keeping byte offsets, so error line numbers still match the editor), so
 * `enum` / `namespace` / parameter properties are not supported.
 */
import { createRequire, stripTypeScriptTypes } from "node:module";
import { format } from "node:util";

/** Lines the snippet wrote via `console.*`, in order, prefixed with the level when not `log`. */
export interface UserCodeLogs {
  logs?: string[];
}
export interface UserCodeOk extends UserCodeLogs {
  ok: true;
  value: string | number | null;
}
export interface UserCodeErr extends UserCodeLogs {
  ok: false;
  error: string;
}
export type UserCodeResult = UserCodeOk | UserCodeErr;

const MAX_LOG_LINES = 500;

/**
 * A `console` stand-in that records instead of printing (the worker's stdout
 * carries the JSON result, so real console output would corrupt it). `format`
 * gives Node's `console.log` semantics: `%s`-style specifiers, and objects are
 * `inspect`ed rather than printed as `[object Object]`.
 */
function createCapturingConsole(logs: string[]): Record<string, unknown> {
  const write =
    (level: string) =>
    (...args: unknown[]): void => {
      if (logs.length >= MAX_LOG_LINES) return;
      const line = format(...args);
      logs.push(level === "log" ? line : `[${level}] ${line}`);
    };
  return {
    log: write("log"),
    info: write("info"),
    debug: write("debug"),
    warn: write("warn"),
    error: write("error"),
    trace: write("trace"),
  };
}

export const DEFAULT_TIMEOUT_MS = 10_000;

const CONTRACT_HINT =
  "Widget code must export a function, e.g. `module.exports = async (): Promise<{ value: string }> => ({ value })`";

export async function runUserCode(
  code: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<UserCodeResult> {
  const logs: string[] = [];
  const withLogs = (result: UserCodeResult): UserCodeResult =>
    logs.length ? { ...result, logs } : result;

  try {
    const require = createRequire(import.meta.url);
    const mod: { exports: unknown } = { exports: {} };
    const js = stripTypeScriptTypes(code, { mode: "strip" });
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const wrapper = new Function(
      "module",
      "exports",
      "require",
      "console",
      js,
    ) as (
      m: typeof mod,
      e: unknown,
      r: NodeRequire,
      c: Record<string, unknown>,
    ) => void;
    wrapper(mod, mod.exports, require, createCapturingConsole(logs));

    const fn = resolveExport(mod.exports);
    if (!fn) return withLogs({ ok: false, error: CONTRACT_HINT });

    const returned = await withTimeout(Promise.resolve(fn()), timeoutMs);
    return withLogs(normalize(returned));
  } catch (error) {
    return withLogs({ ok: false, error: toMessage(error) });
  }
}

function resolveExport(exported: unknown): (() => unknown) | null {
  if (typeof exported === "function") return exported as () => unknown;
  if (exported && typeof exported === "object") {
    const asDefault = (exported as { default?: unknown }).default;
    if (typeof asDefault === "function") return asDefault as () => unknown;
  }
  return null;
}

function normalize(returned: unknown): UserCodeResult {
  if (!returned || typeof returned !== "object" || !("value" in returned)) {
    return {
      ok: false,
      error:
        "Widget function must return an object like { value: string | number | null }",
    };
  }
  const value = (returned as { value: unknown }).value;
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number"
  ) {
    return { ok: true, value };
  }
  return {
    ok: false,
    error: `Widget "value" must be a string, number, or null (got ${value === undefined ? "undefined" : typeof value})`,
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Widget timed out after ${ms}ms`)),
      ms,
    );
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
