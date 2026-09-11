import type { NavigateRequest } from "../shared/types";

/**
 * Set by `navigate()` during an `execute()` call, read once by `executeAction`
 * right after it resolves. Main-process actions run one at a time off a single
 * `execute` IPC call, so a module-level slot (rather than threading a per-call
 * context object through every `ActionSource`) is enough.
 */
let pending: NavigateRequest | undefined;

/**
 * Ask the launcher to push a screen (by the `Route` name an extension's
 * `renderer/screen.ts` — or a core route — registered) instead of just
 * running. Call it as the last thing a handler does: the launcher only stays
 * open instead of hiding once `execute()` resolves, so anything slow *after*
 * this call still delays that decision.
 */
export function navigate(name: string, payload?: unknown): void {
  pending = { name, payload };
}

/** Read (and clear) whatever the just-finished `execute()` call navigated to. */
export function takePendingNavigate(): NavigateRequest | undefined {
  const request = pending;
  pending = undefined;
  return request;
}
