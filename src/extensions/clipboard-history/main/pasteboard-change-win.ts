/**
 * The `changeEvent` `main/poller.ts` wants for a truly interval-free Windows watch —
 * `@magibar/win`'s `startClipboardWatcher()`, a hidden message-only window registered for
 * `WM_CLIPBOARDUPDATE` via `AddClipboardFormatListener`. See that native function's own doc
 * comment (`native/win/src/lib.rs`) for what it does and why.
 *
 * `@magibar/win` is an optionalDependency that only installs on win32, so it can't be a static
 * import here — that would crash at module-load time on every other platform. Same
 * `createRequire` lazy-load this codebase already uses for it in
 * `@extensions/window/main/control/control-win.ts`.
 */
import { createRequire } from "node:module";

type NativeWin = typeof import("@magibar/win");
const nodeRequire = createRequire(import.meta.url);
let native: NativeWin | null | undefined;

function loadNative(): NativeWin | null {
  if (native !== undefined) return native;
  if (process.platform !== "win32") return (native = null);
  try {
    native = nodeRequire("@magibar/win") as NativeWin;
  } catch (error) {
    console.error("[clipboard-history] Failed to load @magibar/win:", error);
    native = null;
  }
  return native;
}

/**
 * A `ClipboardPoller` `changeEvent`, or `undefined` on any platform but Windows (or if the
 * native addon fails to load) — the poller falls back to its `setInterval` loop whenever this
 * is absent. Unlike macOS's `pasteboardChangeSignal` (still polled, just cheaply), this is a
 * real push notification: the returned subscribe function starts a native watcher that calls
 * `onChange` only when the clipboard actually changes, and the unsubscribe function it returns
 * stops that watcher.
 */
export function pasteboardChangeEvent():
  | ((onChange: () => void) => () => void)
  | undefined {
  const win = loadNative();
  if (!win) return undefined;
  return (onChange) => {
    const watcher = win.startClipboardWatcher((error) => {
      if (error) {
        console.error("[clipboard-history] startClipboardWatcher callback error:", error);
        return;
      }
      onChange();
    });
    return () => watcher.stop();
  };
}
