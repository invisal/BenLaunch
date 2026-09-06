import type { Rect } from './layout'

/**
 * Single-level undo for window snaps: whatever a window's rect was right before
 * the most recent `applyRegion`/`moveToDisplay` call, keyed by a platform-supplied
 * window identifier (a Windows HWND, a macOS pid — the control modules decide the
 * key shape, this just stores rects). In-memory only and deliberately not
 * persisted — "restore" is a same-session undo, not a durable window-position
 * history, so losing it on app restart is the intended behaviour, not a bug.
 */
const previousRects = new Map<string, Rect>()

/** Records `rect` as what `key`'s window should return to on the next `popRestore`. */
export function saveForRestore(key: string, rect: Rect): void {
  previousRects.set(key, rect)
}

/** Returns and clears the saved rect for `key`, or `undefined` if none is stored. */
export function popRestore(key: string): Rect | undefined {
  const rect = previousRects.get(key)
  previousRects.delete(key)
  return rect
}
