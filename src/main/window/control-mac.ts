import { dialog, shell, systemPreferences } from 'electron'
import { execFile, execFileSync } from 'node:child_process'
import { promisify } from 'node:util'
import { allDisplays, currentDisplay, toRect, workAreaFor } from './electron-screen'
import { computeEdgeMove, computeTargetRect, mapRectToDisplay, pickAdjacentDisplay, type Rect } from './layout'
import { popRestore, saveForRestore } from './restore-stack'
import type { EdgeDirection, SnapRegion } from './layout'

export type { EdgeDirection, SnapRegion } from './layout'

const execFileAsync = promisify(execFile)

/**
 * macOS-side window control: no native addon (consistent with how `apps-mac.ts`
 * avoids compiled addons on this platform) — window frames are read and set by
 * shelling out to `osascript`/System Events, which requires the user to grant
 * Accessibility (and, separately, an Automation/"control System Events") consent.
 *
 * Unlike Windows, there's no HWND to remember: the target is the frontmost
 * application's pid at capture time, and "window 1" of that process is whatever
 * was frontmost when captured — it doesn't change while our launcher holds focus.
 */

/** Last-captured application pid; 0 when none/unknown. */
let capturedPid = 0

/**
 * Records the frontmost application's pid. Must run synchronously right before
 * the launcher steals focus (palette flow) or at shortcut press-time (direct
 * flow) — an async round trip here would let focus drift before the read lands.
 */
export function capture(): void {
  try {
    const out = execFileSync(
      'osascript',
      [
        '-e',
        'tell application "System Events" to get unix id of first application process whose frontmost is true'
      ],
      { encoding: 'utf8', timeout: 500 }
    ).trim()
    const pid = Number(out)
    // Our own process is reported like any other; excluding it is the mac
    // analogue of Windows' `exclude` handle, needing no extra plumbing since
    // Electron's main process pid *is* what System Events reports for us.
    capturedPid = pid && pid !== process.pid ? pid : 0
  } catch (error) {
    console.error('[window/mac] capture failed:', error)
    capturedPid = 0
  }
}

function restoreKey(pid: number): string {
  return `mac:${pid}`
}

async function readFrame(pid: number): Promise<Rect | null> {
  const script = `tell application "System Events"
  tell (first process whose unix id is ${pid})
    set win to window 1
    set {px, py} to position of win
    set {sw, sh} to size of win
    return (px as text) & "," & (py as text) & "," & (sw as text) & "," & (sh as text)
  end tell
end tell`
  try {
    const { stdout } = await execFileAsync('osascript', ['-e', script], { timeout: 1000 })
    const [x, y, width, height] = stdout.trim().split(',').map(Number)
    if ([x, y, width, height].some((value) => !Number.isFinite(value))) return null
    return { x, y, width, height }
  } catch (error) {
    console.error('[window/mac] readFrame failed:', error)
    notifyPermissionIssue()
    return null
  }
}

/**
 * Sets size, then position, then size again: some apps clamp or reflow their
 * frame when it lands near a screen edge, and re-asserting the size after the
 * move is what makes the final result stick.
 */
async function writeFrame(pid: number, rect: Rect): Promise<boolean> {
  const { x, y, width, height } = { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) }
  const script = `tell application "System Events"
  tell (first process whose unix id is ${pid})
    set size of window 1 to {${width}, ${height}}
    set position of window 1 to {${x}, ${y}}
    set size of window 1 to {${width}, ${height}}
  end tell
end tell`
  try {
    await execFileAsync('osascript', ['-e', script], { timeout: 1000 })
    return true
  } catch (error) {
    console.error('[window/mac] writeFrame failed:', error)
    notifyPermissionIssue()
    return false
  }
}

/**
 * Toggles the window's native macOS fullscreen (Spaces) state via its
 * `AXFullScreen` accessibility attribute — the same effect as clicking-and-
 * holding the green traffic-light button and choosing "Enter/Exit Full Screen".
 * Not every window supports this (some apps don't offer a fullscreen button),
 * in which case osascript errors and this just reports failure like any other
 * permission/capability issue.
 */
async function toggleFullscreenFrame(pid: number): Promise<boolean> {
  const script = `tell application "System Events"
  tell (first process whose unix id is ${pid})
    set win to window 1
    set value of attribute "AXFullScreen" of win to not (value of attribute "AXFullScreen" of win)
  end tell
end tell`
  try {
    await execFileAsync('osascript', ['-e', script], { timeout: 1000 })
    return true
  } catch (error) {
    console.error('[window/mac] toggleFullscreenFrame failed:', error)
    notifyPermissionIssue()
    return false
  }
}

/**
 * Prompts for Accessibility access the first time a window command actually
 * runs on mac and it's not yet granted — not proactively at app launch, so the
 * user isn't hit with a system dialog before they've asked for this feature.
 */
let accessibilityPrompted = false
function ensureAccessibilityPrompted(): void {
  if (accessibilityPrompted) return
  accessibilityPrompted = true
  if (!systemPreferences.isTrustedAccessibilityClient(false)) {
    systemPreferences.isTrustedAccessibilityClient(true)
  }
}

/**
 * There's a second, separate consent gate — Automation/AppleEvents access to
 * control System Events — that Electron has no API to pre-check. Any osascript
 * failure is treated as "assume a permission gate" and surfaced the same way,
 * once per session so repeated failures don't spam the user with dialogs.
 */
let permissionDialogShown = false
function notifyPermissionIssue(): void {
  if (permissionDialogShown) return
  permissionDialogShown = true
  void dialog
    .showMessageBox({
      type: 'warning',
      message: 'BenLaunch needs Accessibility access',
      detail:
        'Window Management moves and resizes other apps’ windows, which macOS only allows once BenLaunch is granted Accessibility access (and, the first time, permission to control "System Events").',
      buttons: ['Open Privacy Settings', 'Cancel'],
      defaultId: 0,
      cancelId: 1
    })
    .then(({ response }) => {
      if (response === 0) {
        void shell.openExternal(
          'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
        )
      }
    })
}

export async function applyRegion(region: SnapRegion): Promise<boolean> {
  if (capturedPid === 0) return false
  ensureAccessibilityPrompted()

  const current = await readFrame(capturedPid)
  if (!current) return false

  const target = computeTargetRect(region, { workArea: workAreaFor(current), currentRect: current })
  saveForRestore(restoreKey(capturedPid), current)
  return writeFrame(capturedPid, target)
}

export async function moveToDisplay(direction: 'next' | 'previous'): Promise<boolean> {
  if (capturedPid === 0) return false
  ensureAccessibilityPrompted()

  const current = await readFrame(capturedPid)
  if (!current) return false

  const display = currentDisplay(current)
  const target = pickAdjacentDisplay(allDisplays(), display.id, direction)
  if (!target) return false

  const rect = mapRectToDisplay(current, toRect(display.workArea), target.workArea)
  saveForRestore(restoreKey(capturedPid), current)
  return writeFrame(capturedPid, rect)
}

export async function moveToEdge(direction: EdgeDirection): Promise<boolean> {
  if (capturedPid === 0) return false
  ensureAccessibilityPrompted()

  const current = await readFrame(capturedPid)
  if (!current) return false

  const target = computeEdgeMove(direction, workAreaFor(current), current)
  saveForRestore(restoreKey(capturedPid), current)
  return writeFrame(capturedPid, target)
}

export async function restore(): Promise<boolean> {
  if (capturedPid === 0) return false
  ensureAccessibilityPrompted()

  const previous = popRestore(restoreKey(capturedPid))
  if (!previous) return false
  return writeFrame(capturedPid, previous)
}

export async function toggleFullscreen(): Promise<boolean> {
  if (capturedPid === 0) return false
  ensureAccessibilityPrompted()
  return toggleFullscreenFrame(capturedPid)
}
