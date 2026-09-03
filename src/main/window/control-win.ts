import { createRequire } from 'node:module'
import { allDisplays, centerOf, currentDisplay, toRect, workAreaFor } from './electron-screen'
import { computeEdgeMove, computeTargetRect, mapRectToDisplay, pickAdjacentDisplay } from './layout'
import { popRestore, saveForRestore } from './restore-stack'
import type { EdgeDirection, SnapRegion } from './layout'

export type { EdgeDirection, SnapRegion } from './layout'

/**
 * `@benpocket/win` is an optionalDependency that only installs on win32, so it
 * can't be a static import here — that would crash at module-load time on
 * every other platform, well before the `process.platform` checks below run.
 * `createRequire` gives us a synchronous, lazily-invoked load from this ESM
 * module without pulling in a top-level `require`.
 */
type NativeWin = typeof import('@benpocket/win')
const nodeRequire = createRequire(import.meta.url)
let native: NativeWin | null | undefined

function loadNative(): NativeWin | null {
  if (native !== undefined) return native
  if (process.platform !== 'win32') return (native = null)
  try {
    native = nodeRequire('@benpocket/win') as NativeWin
  } catch (error) {
    console.error('[window/win] Failed to load @benpocket/win:', error)
    native = null
  }
  return native
}

/**
 * Windows-side window control: snap/move/restore the window the user was working
 * in before the launcher (palette flow) or a global shortcut (direct flow) stole
 * focus.
 *
 * Showing the launcher steals foreground, so the target window has to be captured
 * *before* that happens — `capture()` runs in `toggleLauncher()` just ahead of
 * `window.show()` for the palette flow, and at press-time in each global-shortcut
 * handler for the direct flow. Everything below then acts on that stored handle
 * regardless of what holds focus when the command actually runs.
 */

/** Last-captured window; 0 when none/unknown. */
let capturedHandle = 0

/**
 * Records the current foreground window. `exclude` is the launcher's own handle so
 * a stray capture of the launcher itself is discarded rather than snapped later.
 */
export function capture(exclude?: number): void {
  const win = loadNative()
  if (!win) {
    capturedHandle = 0
    return
  }
  const handle = win.foregroundWindow()
  capturedHandle = handle !== 0 && handle !== exclude ? handle : 0
}

/** Snap the captured window to `region`. No-op (returns `false`) if nothing was captured. */
export async function applyRegion(region: SnapRegion): Promise<boolean> {
  const win = loadNative()
  if (!win || capturedHandle === 0) return false
  const current = win.getWindowRect(capturedHandle)
  if (!current) return false

  const target = computeTargetRect(region, { workArea: workAreaFor(current), currentRect: current })
  saveForRestore(String(capturedHandle), current)
  return win.applyWindowRect(capturedHandle, target)
}

/** Move the captured window to the next/previous display, keeping its relative size/position. */
export async function moveToDisplay(direction: 'next' | 'previous'): Promise<boolean> {
  const win = loadNative()
  if (!win || capturedHandle === 0) return false
  const current = win.getWindowRect(capturedHandle)
  if (!current) return false

  const display = currentDisplay(current)
  const target = pickAdjacentDisplay(allDisplays(), display.id, direction)
  if (!target) return false

  const rect = mapRectToDisplay(current, toRect(display.workArea), target.workArea)
  saveForRestore(String(capturedHandle), current)
  return win.applyWindowRect(capturedHandle, rect)
}

/** Slide the captured window to a screen edge without resizing it. */
export async function moveToEdge(direction: EdgeDirection): Promise<boolean> {
  const win = loadNative()
  if (!win || capturedHandle === 0) return false
  const current = win.getWindowRect(capturedHandle)
  if (!current) return false

  const target = computeEdgeMove(direction, workAreaFor(current), current)
  saveForRestore(String(capturedHandle), current)
  return win.applyWindowRect(capturedHandle, target)
}

/** Undo the captured window's last snap/move. No-op if nothing was recorded. */
export async function restore(): Promise<boolean> {
  const win = loadNative()
  if (!win || capturedHandle === 0) return false
  const previous = popRestore(String(capturedHandle))
  if (!previous) return false
  return win.applyWindowRect(capturedHandle, previous)
}

/**
 * Windows has no equivalent of macOS's Spaces-based fullscreen; this toggles
 * maximize/restore instead, the closest native analogue.
 */
export async function toggleFullscreen(): Promise<boolean> {
  const win = loadNative()
  if (!win || capturedHandle === 0) return false
  return win.toggleMaximize(capturedHandle)
}
