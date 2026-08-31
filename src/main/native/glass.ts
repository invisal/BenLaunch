import { createRequire } from 'node:module'
import type { BrowserWindow } from 'electron'

/**
 * `electron-liquid-glass` is a macOS-only optionalDependency with a native
 * addon, so — like `@benpocket/win` — it can't be a static import: that would
 * throw at module-load time on Windows/Linux where npm skips it. `createRequire`
 * gives us a lazy, synchronous load from this ESM module.
 */
type LiquidGlass = (typeof import('electron-liquid-glass'))['default']
const nodeRequire = createRequire(import.meta.url)
let glass: LiquidGlass | null | undefined

function loadGlass(): LiquidGlass | null {
  if (glass !== undefined) return glass
  if (process.platform !== 'darwin') return (glass = null)
  try {
    // The CJS build exports the singleton directly (`module.exports = liquidGlass`);
    // the ESM build puts it on `.default`. Accept either.
    const mod = nodeRequire('electron-liquid-glass') as
      | LiquidGlass
      | { default: LiquidGlass }
    glass = 'default' in mod ? mod.default : mod
  } catch (error) {
    console.error('[native] Failed to load electron-liquid-glass:', error)
    glass = null
  }
  return glass
}

/**
 * Wrap the launcher window in a macOS "liquid glass" (NSGlassEffectView) surface.
 *
 * On macOS 26+ this gives the real Tahoe glass material; on older macOS the addon
 * falls back to a legacy `NSVisualEffectView` blur. No-op on other platforms.
 *
 * The window must be created `transparent: true` with `vibrancy` unset for this
 * to composite correctly — see `createLauncherWindow`.
 */
export function applyLiquidGlass(win: BrowserWindow): void {
  const lg = loadGlass()
  if (!lg) return
  try {
    lg.addView(win.getNativeWindowHandle(), { cornerRadius: 12, opaque: false })
  } catch (error) {
    console.error('[native] liquidGlass.addView failed:', error)
  }
}
