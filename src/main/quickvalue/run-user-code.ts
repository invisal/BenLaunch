/**
 * Runs a QuickValue's user-authored code and normalizes what it returns.
 *
 * Kept as a standalone, Electron-free module so both the out-of-process worker
 * (`native/quickvalue-worker.ts`) and the `node --test` suite can use it. It is
 * NOT a security sandbox — the code runs with full Node access, on purpose (see
 * the plan's "Known tradeoff"). The process boundary and the timeout are what
 * keep a slow or runaway QuickValue from hurting the launcher.
 */
import { createRequire } from 'node:module'

export interface UserCodeOk {
  ok: true
  value: string | number | null
}
export interface UserCodeErr {
  ok: false
  error: string
}
export type UserCodeResult = UserCodeOk | UserCodeErr

export const DEFAULT_TIMEOUT_MS = 10_000

const CONTRACT_HINT =
  'QuickValue code must export a function, e.g. `module.exports = async () => ({ value })`'

export async function runUserCode(
  code: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<UserCodeResult> {
  try {
    const require = createRequire(import.meta.url)
    const mod: { exports: unknown } = { exports: {} }
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const wrapper = new Function('module', 'exports', 'require', code) as (
      m: typeof mod,
      e: unknown,
      r: NodeRequire
    ) => void
    wrapper(mod, mod.exports, require)

    const fn = resolveExport(mod.exports)
    if (!fn) return { ok: false, error: CONTRACT_HINT }

    const returned = await withTimeout(Promise.resolve(fn()), timeoutMs)
    return normalize(returned)
  } catch (error) {
    return { ok: false, error: toMessage(error) }
  }
}

function resolveExport(exported: unknown): (() => unknown) | null {
  if (typeof exported === 'function') return exported as () => unknown
  if (exported && typeof exported === 'object') {
    const asDefault = (exported as { default?: unknown }).default
    if (typeof asDefault === 'function') return asDefault as () => unknown
  }
  return null
}

function normalize(returned: unknown): UserCodeResult {
  if (!returned || typeof returned !== 'object' || !('value' in returned)) {
    return { ok: false, error: 'QuickValue function must return an object like { value: string | number | null }' }
  }
  const value = (returned as { value: unknown }).value
  if (value === null || typeof value === 'string' || typeof value === 'number') {
    return { ok: true, value }
  }
  return {
    ok: false,
    error: `QuickValue "value" must be a string, number, or null (got ${value === undefined ? 'undefined' : typeof value})`
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`QuickValue timed out after ${ms}ms`)), ms)
    promise.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e instanceof Error ? e : new Error(String(e)))
      }
    )
  })
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
