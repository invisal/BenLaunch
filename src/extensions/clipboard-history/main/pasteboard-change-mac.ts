/**
 * The cheap "has the clipboard changed at all" signal `main/poller.ts`'s
 * `changeSignal` wants — `NSPasteboard.generalPasteboard.changeCount` via
 * `@magibar/mac`'s `pasteboardChangeCount()`. See that native function's own
 * doc comment (`native/mac/src/lib.rs`) for what it reads and why.
 *
 * `@magibar/mac` is an optionalDependency that only installs on darwin, so
 * it can't be a static import here — that would crash at module-load time
 * on every other platform. Same `createRequire` lazy-load this codebase
 * already uses for it in `@extensions/window/main/control/control-mac.ts`.
 */
import { createRequire } from "node:module";

type NativeMac = typeof import("@magibar/mac");
const nodeRequire = createRequire(import.meta.url);
let native: NativeMac | null | undefined;

function loadNative(): NativeMac | null {
  if (native !== undefined) return native;
  if (process.platform !== "darwin") return (native = null);
  try {
    native = nodeRequire("@magibar/mac") as NativeMac;
  } catch (error) {
    console.error("[clipboard-history] Failed to load @magibar/mac:", error);
    native = null;
  }
  return native;
}

/**
 * A `ClipboardPoller` `changeSignal`, or `undefined` on any platform but
 * macOS (or if the native addon fails to load) — the poller falls back to
 * its unconditional per-tick read whenever this is absent.
 */
export function pasteboardChangeSignal(): (() => number) | undefined {
  const mac = loadNative();
  return mac ? () => mac.pasteboardChangeCount() : undefined;
}
