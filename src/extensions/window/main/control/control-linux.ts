import { dialog } from "electron";
import { createRequire } from "node:module";
import {
  allDisplays,
  currentDisplay,
  toRect,
  workAreaFor,
} from "./electron-screen";
import {
  computeCustomRect,
  computeEdgeMove,
  computeTargetRect,
  mapRectToDisplay,
  pickAdjacentDisplay,
  type Rect,
} from "./layout";
import { popRestore, saveForRestore } from "./restore-stack";
import type { CustomLayoutGeometry, EdgeDirection, SnapRegion } from "./layout";

export type { CustomLayoutGeometry, EdgeDirection, SnapRegion } from "./layout";

/**
 * `@benpocket/linux` is an optionalDependency that only installs on linux, so
 * it can't be a static import here — that would crash at module-load time on
 * every other platform, well before the `process.platform` checks below run.
 * `createRequire` gives us a synchronous, lazily-invoked load from this ESM
 * module without pulling in a top-level `require`.
 */
type NativeLinux = typeof import("@benpocket/linux");
const nodeRequire = createRequire(import.meta.url);
let native: NativeLinux | null | undefined;

function loadNative(): NativeLinux | null {
  if (native !== undefined) return native;
  if (process.platform !== "linux") return (native = null);
  try {
    native = nodeRequire("@benpocket/linux") as NativeLinux;
  } catch (error) {
    console.error("[window/linux] Failed to load @benpocket/linux:", error);
    native = null;
  }
  return native;
}

/**
 * Linux-side window control, via the `@benpocket/linux` native addon — direct
 * EWMH-over-X11 calls (through `x11rb`'s pure-Rust connection) replacing a
 * previous `xdotool`/`wmctrl` shell-out, which forked a whole process per call
 * and required both tools to be separately installed on the user's system.
 *
 * Hard platform limit, not a gap in this implementation: this operates on X11
 * (which includes XWayland-backed windows under a Wayland session — most apps,
 * today), but a **Wayland-native** window cannot be moved by any external
 * process on Linux. Wayland's security model has no cross-app window-control
 * protocol; this is true of every window manager tool on Linux, not just this
 * one, and there is no workaround from here.
 */

/**
 * Whether any real application window is reachable via X11/XWayland at all,
 * checked once at startup and cached for the process's lifetime. On a Wayland
 * session where every running app happens to be a native Wayland client — no
 * XWayland windows exist for the X11 connection to act on at all, not even in
 * principle — `WindowExtension` uses this to hide the feature entirely instead
 * of offering commands that can silently no-op.
 */
let xwaylandWindowsChecked = false;
let xwaylandWindowsPresent = false;

export function hasXWaylandWindows(): boolean {
  if (xwaylandWindowsChecked) return xwaylandWindowsPresent;
  xwaylandWindowsChecked = true;
  xwaylandWindowsPresent = loadNative()?.hasXwaylandWindows() ?? false;
  return xwaylandWindowsPresent;
}

/** Last-captured X11 window id; `0` when none/unknown. */
let capturedWindowId = 0;

/**
 * Records the currently active window's id. `exclude` is the launcher's own
 * X11 window id (see `launcherHandle()` in `index.ts`) so a stray capture of
 * the launcher itself is discarded rather than moved later.
 */
export function capture(exclude?: number): void {
  const linux = loadNative();
  capturedWindowId = linux ? linux.activeWindow(exclude ?? 0) : 0;
}

function restoreKey(id: number): string {
  return `linux:${id}`;
}

function readFrame(id: number): Rect | null {
  const rect = loadNative()?.getWindowRect(id) ?? null;
  if (!rect) notifyToolIssue();
  return rect;
}

function writeFrame(id: number, rect: Rect): boolean {
  const ok = loadNative()?.applyWindowRect(id, rect) ?? false;
  if (!ok) notifyToolIssue();
  return ok;
}

/**
 * There's no single "open Settings to the right page" deep link across Linux
 * desktop environments the way mac/Windows have, so this just explains what's
 * needed and lets the user act on it — shown once per session so repeated
 * failures don't spam dialogs.
 */
let toolIssueDialogShown = false;
function notifyToolIssue(): void {
  if (toolIssueDialogShown) return;
  toolIssueDialogShown = true;
  void dialog.showMessageBox({
    type: "warning",
    message: "BenLaunch couldn't move this window",
    detail:
      "Window Management on Linux needs a reachable X server (this includes XWayland-backed apps under a Wayland session), but a Wayland-native window can't be moved by any external app — that's a Wayland platform limitation, not something this app can work around.",
    buttons: ["OK"],
    defaultId: 0,
  });
}

/** Shared by `applyRegion`/`applyCustomLayout`: capture check, read the current frame, compute, save-for-restore, write. */
async function applyComputedRect(
  computeRect: (workArea: Rect, currentRect: Rect) => Rect,
): Promise<boolean> {
  if (!capturedWindowId) return false;

  const current = readFrame(capturedWindowId);
  if (!current) return false;

  const target = computeRect(workAreaFor(current), current);
  saveForRestore(restoreKey(capturedWindowId), current);
  return writeFrame(capturedWindowId, target);
}

export function applyRegion(region: SnapRegion): Promise<boolean> {
  return applyComputedRect((workArea, currentRect) =>
    computeTargetRect(region, { workArea, currentRect }),
  );
}

export function applyCustomLayout(
  layout: CustomLayoutGeometry,
  useGap: boolean,
  gapPx: number,
): Promise<boolean> {
  return applyComputedRect((workArea, currentRect) =>
    computeCustomRect(layout, { workArea, currentRect, useGap, gapPx }),
  );
}

export async function moveToDisplay(
  direction: "next" | "previous",
): Promise<boolean> {
  if (!capturedWindowId) return false;

  const current = readFrame(capturedWindowId);
  if (!current) return false;

  const display = currentDisplay(current);
  const target = pickAdjacentDisplay(allDisplays(), display.id, direction);
  if (!target) return false;

  const rect = mapRectToDisplay(
    current,
    toRect(display.workArea),
    target.workArea,
  );
  saveForRestore(restoreKey(capturedWindowId), current);
  return writeFrame(capturedWindowId, rect);
}

export async function moveToEdge(direction: EdgeDirection): Promise<boolean> {
  if (!capturedWindowId) return false;

  const current = readFrame(capturedWindowId);
  if (!current) return false;

  const target = computeEdgeMove(direction, workAreaFor(current), current);
  saveForRestore(restoreKey(capturedWindowId), current);
  return writeFrame(capturedWindowId, target);
}

export async function restore(): Promise<boolean> {
  if (!capturedWindowId) return false;

  const previous = popRestore(restoreKey(capturedWindowId));
  if (!previous) return false;
  return writeFrame(capturedWindowId, previous);
}

/** EWMH `_NET_WM_STATE_FULLSCREEN` — broadly supported across X11 window managers. */
export async function toggleFullscreen(): Promise<boolean> {
  if (!capturedWindowId) return false;
  const ok = loadNative()?.toggleFullscreen(capturedWindowId) ?? false;
  if (!ok) notifyToolIssue();
  return ok;
}
