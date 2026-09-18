import { createRequire } from "node:module";
import type { RawProcessRow } from "./process-source";

/**
 * `@magibar/mac` is an optionalDependency that only installs on darwin, so it
 * can't be a static import here — that would crash at module-load time on
 * every other platform, well before the `process.platform` checks below run.
 * `createRequire` gives us a synchronous, lazily-invoked load from this ESM
 * module without pulling in a top-level `require`. Same pattern as
 * `window/main/control/control-mac.ts`.
 */
type NativeMac = typeof import("@magibar/mac");
const nodeRequire = createRequire(import.meta.url);
let native: NativeMac | null | undefined;

function loadNative(): NativeMac | null {
  if (native !== undefined) return native;
  if (process.platform !== "darwin") return (native = null);
  try {
    native = nodeRequire("@magibar/mac") as NativeMac;
  } catch (error) {
    console.error("[quit-process/mac] Failed to load @magibar/mac:", error);
    native = null;
  }
  return native;
}

/** A snapshot of every running process's pid, name, CPU%, memory and
 *  executable path (see `RawProcessRow`). */
export function listProcesses(): RawProcessRow[] {
  const mac = loadNative();
  if (!mac) return [];
  return mac.listProcesses().map((p) => ({
    pid: p.pid,
    name: p.name,
    cpuPercent: p.cpuUsage,
    memoryBytes: p.memoryBytes,
    path: p.path,
  }));
}

/** `force: false` sends SIGTERM, `true` sends SIGKILL. `false` when the pid
 *  no longer exists or the OS denies permission. */
export function killProcess(pid: number, force: boolean): boolean {
  return loadNative()?.killProcess(pid, force) ?? false;
}

/** Every listening TCP port with its owning pid. */
export function listPorts(): { pid: number; port: number }[] {
  return loadNative()?.listListeningPorts() ?? [];
}
