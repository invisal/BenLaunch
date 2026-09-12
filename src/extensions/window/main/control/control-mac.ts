import { dialog, shell, systemPreferences } from "electron";
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
 * `@benpocket/mac` is an optionalDependency that only installs on darwin, so it
 * can't be a static import here — that would crash at module-load time on every
 * other platform, well before the `process.platform` checks below run.
 * `createRequire` gives us a synchronous, lazily-invoked load from this ESM
 * module without pulling in a top-level `require`.
 */
type NativeMac = typeof import("@benpocket/mac");
const nodeRequire = createRequire(import.meta.url);
let native: NativeMac | null | undefined;

function loadNative(): NativeMac | null {
  if (native !== undefined) return native;
  if (process.platform !== "darwin") return (native = null);
  try {
    native = nodeRequire("@benpocket/mac") as NativeMac;
  } catch (error) {
    console.error("[window/mac] Failed to load @benpocket/mac:", error);
    native = null;
  }
  return native;
}

/**
 * macOS-side window control, via the `@benpocket/mac` native addon (CoreGraphics'
 * window list to find the frontmost app, and the Accessibility API to read/move/
 * fullscreen its focused window) — replaces a previous `osascript`/System Events
 * shell-out, which forked a whole process and JIT-compiled an AppleScript on
 * every single call.
 *
 * Unlike Windows, there's no HWND to remember: the target is the frontmost
 * application's pid at capture time, and its focused window is whatever was
 * frontmost when captured — it doesn't change while our launcher holds focus.
 */

/** Last-captured application pid; 0 when none/unknown. */
let capturedPid = 0;

/**
 * Records the frontmost application's pid. Must run synchronously right before
 * the launcher steals focus (palette flow) or at shortcut press-time (direct
 * flow) — an async round trip here would let focus drift before the read lands.
 *
 * Needs no Accessibility permission — `frontmostPid` reads the on-screen window
 * list, a plain CoreGraphics query, not the Accessibility API.
 */
export function capture(): void {
  const mac = loadNative();
  capturedPid = mac ? mac.frontmostPid(process.pid) : 0;
}

function restoreKey(pid: number): string {
  return `mac:${pid}`;
}

function readFrame(pid: number): Rect | null {
  const mac = loadNative();
  const rect = mac?.getWindowRect(pid) ?? null;
  if (!rect) notifyPermissionIssue();
  return rect;
}

/**
 * Sets size, then position, then size again: some apps clamp or reflow their
 * frame when it lands near a screen edge, and re-asserting the size after the
 * move is what makes the final result stick. (Handled inside the native
 * `applyWindowRect` call itself — see `native/mac/src/lib.rs`.)
 */
function writeFrame(pid: number, rect: Rect): boolean {
  const mac = loadNative();
  const ok = mac?.applyWindowRect(pid, rect) ?? false;
  if (!ok) notifyPermissionIssue();
  return ok;
}

/**
 * Toggles the window's native macOS fullscreen (Spaces) state via its
 * `AXFullScreen` accessibility attribute — the same effect as clicking-and-
 * holding the green traffic-light button and choosing "Enter/Exit Full Screen".
 * Not every window supports this (some apps don't offer a fullscreen button),
 * in which case this just reports failure like any other permission/capability
 * issue.
 */
function toggleFullscreenFrame(pid: number): boolean {
  const mac = loadNative();
  const ok = mac?.toggleFullscreen(pid) ?? false;
  if (!ok) notifyPermissionIssue();
  return ok;
}

/**
 * Whether the window is currently in native macOS fullscreen (its own Space,
 * filling the whole display — what users see as the window taking over the
 * "wide screen"). Read via the same `AXFullScreen` attribute `toggleFullscreenFrame`
 * writes. `false` (rather than a permission dialog) for anything that can't be
 * determined — this check is just advisory.
 */
function isFullscreenFrame(pid: number): boolean {
  return loadNative()?.isFullscreen(pid) ?? false;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * A window in native fullscreen fills the entire display and macOS refuses to
 * reposition/resize it — `writeFrame` silently fails (reported as a permission
 * issue) every time it's tried against one, which from the user's side looks
 * like window management having stopped working the moment a window went "wide
 * screen". Snap/move/restore commands need the window out of fullscreen first,
 * so this exits it and waits out the exit animation (macOS has no synchronous
 * "fullscreen toggle finished" signal) before the caller reads/writes the frame.
 */
async function exitFullscreenIfNeeded(pid: number): Promise<void> {
  if (!isFullscreenFrame(pid)) return;
  toggleFullscreenFrame(pid);
  for (let attempt = 0; attempt < 20; attempt++) {
    await delay(100);
    if (!isFullscreenFrame(pid)) return;
  }
}

/**
 * Prompts for Accessibility access the first time a window command actually
 * runs on mac and it's not yet granted — not proactively at app launch, so the
 * user isn't hit with a system dialog before they've asked for this feature.
 */
let accessibilityPrompted = false;
function ensureAccessibilityPrompted(): void {
  if (accessibilityPrompted) return;
  accessibilityPrompted = true;
  if (!systemPreferences.isTrustedAccessibilityClient(false)) {
    systemPreferences.isTrustedAccessibilityClient(true);
  }
}

/**
 * A failed read/write is treated as "assume the permission gate isn't cleared
 * yet" and surfaced the same way, once per session so repeated failures don't
 * spam the user with dialogs.
 */
let permissionDialogShown = false;
function notifyPermissionIssue(): void {
  if (permissionDialogShown) return;
  permissionDialogShown = true;
  void dialog
    .showMessageBox({
      type: "warning",
      message: "BenLaunch needs Accessibility access",
      detail:
        "Window Management moves and resizes other apps’ windows, which macOS only allows once BenLaunch is granted Accessibility access.",
      buttons: ["Open Privacy Settings", "Cancel"],
      defaultId: 0,
      cancelId: 1,
    })
    .then(({ response }) => {
      if (response === 0) {
        void shell.openExternal(
          "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility",
        );
      }
    });
}

/** Shared by `applyRegion`/`applyCustomLayout`: capture check, read the current frame, compute, save-for-restore, write. */
async function applyComputedRect(
  computeRect: (workArea: Rect, currentRect: Rect) => Rect,
): Promise<boolean> {
  if (capturedPid === 0) return false;
  ensureAccessibilityPrompted();
  await exitFullscreenIfNeeded(capturedPid);

  const current = readFrame(capturedPid);
  if (!current) return false;

  const target = computeRect(workAreaFor(current), current);
  saveForRestore(restoreKey(capturedPid), current);
  return writeFrame(capturedPid, target);
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
  if (capturedPid === 0) return false;
  ensureAccessibilityPrompted();
  await exitFullscreenIfNeeded(capturedPid);

  const current = readFrame(capturedPid);
  if (!current) return false;

  const display = currentDisplay(current);
  const target = pickAdjacentDisplay(allDisplays(), display.id, direction);
  if (!target) return false;

  const rect = mapRectToDisplay(
    current,
    toRect(display.workArea),
    target.workArea,
  );
  saveForRestore(restoreKey(capturedPid), current);
  return writeFrame(capturedPid, rect);
}

export async function moveToEdge(direction: EdgeDirection): Promise<boolean> {
  if (capturedPid === 0) return false;
  ensureAccessibilityPrompted();
  await exitFullscreenIfNeeded(capturedPid);

  const current = readFrame(capturedPid);
  if (!current) return false;

  const target = computeEdgeMove(direction, workAreaFor(current), current);
  saveForRestore(restoreKey(capturedPid), current);
  return writeFrame(capturedPid, target);
}

export async function restore(): Promise<boolean> {
  if (capturedPid === 0) return false;
  ensureAccessibilityPrompted();

  const previous = popRestore(restoreKey(capturedPid));
  if (!previous) return false;
  await exitFullscreenIfNeeded(capturedPid);
  return writeFrame(capturedPid, previous);
}

export async function toggleFullscreen(): Promise<boolean> {
  if (capturedPid === 0) return false;
  ensureAccessibilityPrompted();
  return toggleFullscreenFrame(capturedPid);
}
