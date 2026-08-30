/**
 * Native / OS-level capabilities for the main process: talking to the platform
 * rather than to the launcher's own model. Today that's enumerating installed
 * applications and caching their icons, and snapping the foreground window;
 * global hotkeys and the like belong here too as they land.
 */
export { listApplications } from './apps'
export type { AppsWorkerResult, ShortcutAppResult, PackagedAppResult } from './apps-worker'
export { captureForegroundWindow, snapCapturedWindow } from './foreground'
export type { SnapRegion } from './foreground'
