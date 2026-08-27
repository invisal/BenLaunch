import type { LauncherAction } from '../shared/types'

/**
 * Main-process-only pairing of an action's metadata with its handler.
 * `run` must never cross the IPC boundary — send `action` to the renderer, not this.
 */
export interface ActionDefinition {
  action: LauncherAction
  run: () => void | Promise<void>
}
