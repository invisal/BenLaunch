import { foregroundWindow, snapWindow } from '@benpocket/win'

/**
 * Native capability: snap the window the user was working in to one side of its
 * monitor (the "Left Half" / "Right Half" launcher commands).
 *
 * Showing the launcher steals foreground, so the target window has to be captured
 * *before* that happens — `captureForegroundWindow()` runs in `toggleLauncher()`
 * just ahead of `window.show()`. The snap itself then acts on that stored handle
 * regardless of what holds focus when the command runs.
 *
 * Unlike icon extraction these Win32 calls are effectively instant, so they run
 * in-process rather than in a worker.
 */

export type SnapRegion =
  | 'left-half'
  | 'right-half'
  | 'top-half'
  | 'bottom-half'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'maximize'

/** Last foreground window seen before the launcher took focus; 0 when none/unknown. */
let capturedHandle = 0

/**
 * Records the current foreground window. `exclude` is the launcher's own handle so
 * a stray capture of the launcher itself is discarded rather than snapped later.
 */
export function captureForegroundWindow(exclude?: number): void {
  if (process.platform !== 'win32') {
    capturedHandle = 0
    return
  }
  const handle = foregroundWindow()
  capturedHandle = handle !== 0 && handle !== exclude ? handle : 0
}

/** Snap the captured window. No-op if nothing was captured. */
export function snapCapturedWindow(region: SnapRegion): boolean {
  if (process.platform !== 'win32' || capturedHandle === 0) return false
  return snapWindow(capturedHandle, region)
}
