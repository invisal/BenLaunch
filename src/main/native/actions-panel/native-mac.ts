import { createRequire } from 'node:module'

/**
 * `@magibar/mac` is an optionalDependency that only installs on darwin, so it
 * can't be a static import — see `window/main/control/control-mac.ts`.
 */
type NativeMac = typeof import('@magibar/mac')
const nodeRequire = createRequire(import.meta.url)
let native: NativeMac | null | undefined

export function loadNativeMac(): NativeMac | null {
  if (native !== undefined) return native
  if (process.platform !== 'darwin') return (native = null)
  try {
    native = nodeRequire('@magibar/mac') as NativeMac
  } catch (error) {
    console.error('[actions-panel] Failed to load @magibar/mac:', error)
    native = null
  }
  return native
}
