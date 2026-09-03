import * as mac from './control-mac'
import * as win from './control-win'

export type { EdgeDirection, SnapRegion } from './layout'
import type { EdgeDirection, SnapRegion } from './layout'

/**
 * Platform dispatcher for window control — mirrors the `apps.ts` →
 * `apps-mac.ts`/`apps-worker.ts` split. Callers (the `win:` action source, and
 * the global-shortcut handlers in `index.ts`) go through this module only, so
 * neither of them needs a `process.platform` branch of its own.
 */
function impl(): typeof win | typeof mac | null {
  if (process.platform === 'win32') return win
  if (process.platform === 'darwin') return mac
  return null
}

/**
 * Records the window/app the user was focused on before it loses focus.
 * `excludeWin32Handle` is the launcher's own HWND on Windows (so a stray capture
 * of the launcher itself isn't snapped later); macOS self-excludes via pid and
 * ignores this parameter.
 */
export function captureFocusedWindow(excludeWin32Handle?: number): void {
  const platform = impl()
  if (!platform) return
  if (platform === win) win.capture(excludeWin32Handle)
  else mac.capture()
}

export function applyRegion(region: SnapRegion): Promise<boolean> {
  return impl()?.applyRegion(region) ?? Promise.resolve(false)
}

export function moveToDisplay(direction: 'next' | 'previous'): Promise<boolean> {
  return impl()?.moveToDisplay(direction) ?? Promise.resolve(false)
}

export function moveToEdge(direction: EdgeDirection): Promise<boolean> {
  return impl()?.moveToEdge(direction) ?? Promise.resolve(false)
}

export function restore(): Promise<boolean> {
  return impl()?.restore() ?? Promise.resolve(false)
}

export function toggleFullscreen(): Promise<boolean> {
  return impl()?.toggleFullscreen() ?? Promise.resolve(false)
}
