/**
 * The `changeEvent` `main/poller.ts` wants for a truly interval-free Linux watch —
 * `@magibar/linux`'s `startClipboardWatcher()`, a background thread that registers for XFixes
 * `SelectionNotify` events on the X11 `CLIPBOARD` selection (`XFixesSelectSelectionInput`, the
 * same mechanism the `clipnotify` CLI tool is built on). See that native function's own doc
 * comment (`native/linux/src/lib.rs`) for what it does and why.
 *
 * `@magibar/linux` is an optionalDependency that only installs on linux, so it can't be a static
 * import here — that would crash at module-load time on every other platform. Same
 * `createRequire` lazy-load this codebase already uses for it in
 * `@extensions/window/main/control/control-linux.ts`.
 */
import { createRequire } from "node:module";

type NativeLinux = typeof import("@magibar/linux");
const nodeRequire = createRequire(import.meta.url);
let native: NativeLinux | null | undefined;

function loadNative(): NativeLinux | null {
  if (native !== undefined) return native;
  if (process.platform !== "linux") return (native = null);
  try {
    native = nodeRequire("@magibar/linux") as NativeLinux;
  } catch (error) {
    console.error("[clipboard-history] Failed to load @magibar/linux:", error);
    native = null;
  }
  return native;
}

/**
 * A `ClipboardPoller` `changeEvent`, or `undefined` on any platform but Linux (or if the native
 * addon fails to load, or no X11/XWayland connection is reachable — e.g. a pure-Wayland session)
 * — the poller falls back to its `setInterval` loop whenever this is absent. Like Windows's
 * `pasteboardChangeEvent` and unlike macOS's still-polled `pasteboardChangeSignal`, this is a
 * real push notification: the returned subscribe function starts a native XFixes watcher that
 * calls `onChange` only when the clipboard selection actually changes owner, and the unsubscribe
 * function it returns stops that watcher.
 */
export function pasteboardChangeEvent():
  | ((onChange: () => void) => () => void)
  | undefined {
  const linux = loadNative();
  if (!linux) return undefined;
  return (onChange) => {
    const watcher = linux.startClipboardWatcher((error) => {
      if (error) {
        console.error("[clipboard-history] startClipboardWatcher callback error:", error);
        return;
      }
      onChange();
    });
    return () => watcher.stop();
  };
}
