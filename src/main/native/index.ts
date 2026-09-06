/**
 * Native / OS-level capabilities for the main process: talking to the platform
 * rather than to the launcher's own model. Today that's enumerating installed
 * applications and caching their icons, and applying visual effects to our own
 * window; window management (snapping/moving *other* apps' windows) lives under
 * `../window` instead, since it needs its own platform-dispatch layer.
 */
export { listApplications } from './apps'
export type { AppsWorkerResult, ShortcutAppResult, PackagedAppResult } from './apps-worker'
export { applyLiquidGlass } from './glass'
