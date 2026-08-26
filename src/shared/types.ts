export type LauncherActionType = 'application' | 'command'

export interface LauncherAction {
  id: string
  title: string
  subtitle?: string
  /** Emoji, single/few characters, or an image URL (http(s):/data:/file:) */
  icon?: string
  type: LauncherActionType
  /** Electron accelerator string, e.g. "CommandOrControl+1" */
  shortcut?: string
}

export const IPC_CHANNELS = {
  search: 'launcher:search',
  execute: 'launcher:execute',
  hide: 'launcher:hide',
  togglePin: 'launcher:toggle-pin'
} as const
