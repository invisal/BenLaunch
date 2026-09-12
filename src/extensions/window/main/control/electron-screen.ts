import { screen } from "electron";
import type { DisplayInfo, Rect } from "./layout";

/** Small Electron `screen`-module helpers shared by `control-win.ts`, `control-mac.ts`, and `control-linux.ts`. */

export function toRect(bounds: Electron.Rectangle): Rect {
  return {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
  };
}

export function centerOf(rect: Rect): { x: number; y: number } {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

/**
 * Electron's `screen` module reports display `bounds`/`workArea` in DIPs (points
 * scaled down by each display's `scaleFactor`), but win32's native addon
 * (`getWindowRect`/`applyWindowRect`, backed by DWM's extended frame bounds and
 * `SetWindowPos`) works in real physical pixels — Win32 has no concept of DIPs.
 * The two spaces are numerically identical at 100% display scaling, which is why
 * a mismatch here only surfaces on scaled ("wide"/high-DPI) monitors: every
 * computed region lands proportionally off by the scale factor (e.g. "Left Half"
 * landing short of, or past, the real left half). `screenToDipPoint`/
 * `dipToScreenRect` are win32-only in Electron; mac (AppleScript "points") and
 * linux (`xdotool`'s X11 pixels) don't have this physical/DIP split, so these are
 * a no-op there — same behavior as before this fix.
 */
function toDipPoint(point: { x: number; y: number }): { x: number; y: number } {
  return process.platform === "win32" ? screen.screenToDipPoint(point) : point;
}

function toPhysicalRect(rect: Rect): Rect {
  return process.platform === "win32"
    ? toRect(screen.dipToScreenRect(null, rect))
    : rect;
}

/** The display `rect` sits on. */
export function currentDisplay(rect: Rect): Electron.Display {
  return screen.getDisplayNearestPoint(toDipPoint(centerOf(rect)));
}

/** The work area (screen minus taskbar/menu bar/dock) of the display `rect` sits on. */
export function workAreaFor(rect: Rect): Rect {
  return toPhysicalRect(toRect(currentDisplay(rect).workArea));
}

export function allDisplays(): DisplayInfo[] {
  return screen.getAllDisplays().map((display) => ({
    id: display.id,
    workArea: toPhysicalRect(toRect(display.workArea)),
  }));
}
