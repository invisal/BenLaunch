import { dialog } from 'electron'
import { execFile, execFileSync } from 'node:child_process'
import { promisify } from 'node:util'
import { allDisplays, currentDisplay, toRect, workAreaFor } from './electron-screen'
import {
  computeCustomRect,
  computeEdgeMove,
  computeTargetRect,
  mapRectToDisplay,
  pickAdjacentDisplay,
  type Rect
} from './layout'
import { popRestore, saveForRestore } from './restore-stack'
import type { CustomLayoutGeometry, EdgeDirection, SnapRegion } from './layout'

export type { CustomLayoutGeometry, EdgeDirection, SnapRegion } from './layout'

const execFileAsync = promisify(execFile)

/**
 * Linux-side window control: no native addon (same "shell out, don't compile"
 * approach as `control-mac.ts`/`apps-mac.ts`) — window geometry is read and set
 * via `xdotool`, and maximize-state/fullscreen toggling via `wmctrl`'s EWMH
 * `_NET_WM_STATE` support. Both are ordinary packages on every mainstream distro
 * (`apt install xdotool wmctrl` / `dnf install xdotool wmctrl`), not bundled with
 * the app, so a missing binary is reported the same way a denied permission is
 * on mac — a dialog, not a silent no-op.
 *
 * Hard platform limit, not a gap in this implementation: both tools operate on
 * X11 (which includes XWayland-backed windows under a Wayland session — most
 * apps, today), but a **Wayland-native** window cannot be moved by any external
 * process on Linux. Wayland's security model has no cross-app window-control
 * protocol; this is true of every window manager tool on Linux, not just this
 * one, and there is no workaround from here.
 */

/** Last-captured X11 window id (decimal, as `xdotool` prints it); `null` when none/unknown. */
let capturedWindowId: string | null = null

/**
 * Records the currently active window's id. `exclude` is the launcher's own X11
 * window id (see `launcherHandle()` in `index.ts`) so a stray capture of the
 * launcher itself is discarded rather than moved later.
 */
export function capture(exclude?: number): void {
  try {
    const out = execFileSync('xdotool', ['getactivewindow'], { encoding: 'utf8', timeout: 500 }).trim()
    const id = Number(out)
    capturedWindowId = out && id !== exclude ? out : null
  } catch (error) {
    console.error('[window/linux] capture failed (is xdotool installed?):', error)
    capturedWindowId = null
  }
}

function restoreKey(id: string): string {
  return `linux:${id}`
}

async function readFrame(id: string): Promise<Rect | null> {
  try {
    const { stdout } = await execFileAsync('xdotool', ['getwindowgeometry', '--shell', id], {
      timeout: 1000
    })
    const vars = Object.fromEntries(
      stdout
        .trim()
        .split('\n')
        .map((line) => line.split('=') as [string, string])
    )
    const x = Number(vars.X)
    const y = Number(vars.Y)
    const width = Number(vars.WIDTH)
    const height = Number(vars.HEIGHT)
    if ([x, y, width, height].some((value) => !Number.isFinite(value))) return null
    return { x, y, width, height }
  } catch (error) {
    console.error('[window/linux] readFrame failed:', error)
    notifyToolIssue()
    return null
  }
}

async function writeFrame(id: string, rect: Rect): Promise<boolean> {
  const x = Math.round(rect.x)
  const y = Math.round(rect.y)
  const width = Math.round(rect.width)
  const height = Math.round(rect.height)
  try {
    // Unmaximize first — most window managers ignore windowmove/windowsize on an
    // already-maximized window, the same reason the Windows/mac paths restore
    // the window before repositioning it. Best-effort: if wmctrl isn't
    // installed, fall straight through to the resize/move attempt.
    await execFileAsync('wmctrl', ['-i', '-r', id, '-b', 'remove,maximized_vert,maximized_horz']).catch(
      () => {}
    )
    await execFileAsync('xdotool', ['windowsize', id, String(width), String(height)], { timeout: 1000 })
    await execFileAsync('xdotool', ['windowmove', id, String(x), String(y)], { timeout: 1000 })
    return true
  } catch (error) {
    console.error('[window/linux] writeFrame failed:', error)
    notifyToolIssue()
    return false
  }
}

/**
 * There's no single "open Settings to the right page" deep link across Linux
 * desktop environments the way mac/Windows have, so this just explains what's
 * needed and lets the user act on it — shown once per session so repeated
 * failures don't spam dialogs.
 */
let toolIssueDialogShown = false
function notifyToolIssue(): void {
  if (toolIssueDialogShown) return
  toolIssueDialogShown = true
  void dialog.showMessageBox({
    type: 'warning',
    message: "BenLaunch couldn't move this window",
    detail:
      'Window Management on Linux needs the "xdotool" and "wmctrl" command-line tools (e.g. `sudo apt install xdotool wmctrl`), and only works on X11 windows — this includes XWayland-backed apps under a Wayland session, but a Wayland-native window can\'t be moved by any external app; that\'s a Wayland platform limitation, not something this app can work around.',
    buttons: ['OK'],
    defaultId: 0
  })
}

/** Shared by `applyRegion`/`applyCustomLayout`: capture check, read the current frame, compute, save-for-restore, write. */
async function applyComputedRect(computeRect: (workArea: Rect, currentRect: Rect) => Rect): Promise<boolean> {
  if (!capturedWindowId) return false

  const current = await readFrame(capturedWindowId)
  if (!current) return false

  const target = computeRect(workAreaFor(current), current)
  saveForRestore(restoreKey(capturedWindowId), current)
  return writeFrame(capturedWindowId, target)
}

export function applyRegion(region: SnapRegion): Promise<boolean> {
  return applyComputedRect((workArea, currentRect) => computeTargetRect(region, { workArea, currentRect }))
}

export function applyCustomLayout(
  layout: CustomLayoutGeometry,
  useGap: boolean,
  gapPx: number
): Promise<boolean> {
  return applyComputedRect((workArea, currentRect) =>
    computeCustomRect(layout, { workArea, currentRect, useGap, gapPx })
  )
}

export async function moveToDisplay(direction: 'next' | 'previous'): Promise<boolean> {
  if (!capturedWindowId) return false

  const current = await readFrame(capturedWindowId)
  if (!current) return false

  const display = currentDisplay(current)
  const target = pickAdjacentDisplay(allDisplays(), display.id, direction)
  if (!target) return false

  const rect = mapRectToDisplay(current, toRect(display.workArea), target.workArea)
  saveForRestore(restoreKey(capturedWindowId), current)
  return writeFrame(capturedWindowId, rect)
}

export async function moveToEdge(direction: EdgeDirection): Promise<boolean> {
  if (!capturedWindowId) return false

  const current = await readFrame(capturedWindowId)
  if (!current) return false

  const target = computeEdgeMove(direction, workAreaFor(current), current)
  saveForRestore(restoreKey(capturedWindowId), current)
  return writeFrame(capturedWindowId, target)
}

export async function restore(): Promise<boolean> {
  if (!capturedWindowId) return false

  const previous = popRestore(restoreKey(capturedWindowId))
  if (!previous) return false
  return writeFrame(capturedWindowId, previous)
}

/** EWMH `_NET_WM_STATE_FULLSCREEN`, via `wmctrl` — broadly supported across X11 window managers. */
export async function toggleFullscreen(): Promise<boolean> {
  if (!capturedWindowId) return false
  try {
    await execFileAsync('wmctrl', ['-i', '-r', capturedWindowId, '-b', 'toggle,fullscreen'], {
      timeout: 1000
    })
    return true
  } catch (error) {
    console.error('[window/linux] toggleFullscreen failed:', error)
    notifyToolIssue()
    return false
  }
}
