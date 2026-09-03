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

/** An evaluated expression the query itself resolved to (e.g. `"1 + 2"` → `"3"`). */
export interface Calculation {
  /** The expression as the user typed it (trimmed). */
  expression: string
  /** The formatted result, ready to display or copy. */
  value: string
}

/** What a query resolves to: the ranked actions, plus an optional inline answer. */
export interface QueryResult {
  result: LauncherAction[]
  calculation?: Calculation
}

export const IPC_CHANNELS = {
  query: 'launcher:query',
  execute: 'launcher:execute',
  hide: 'launcher:hide',
  togglePin: 'launcher:toggle-pin',
  windowShortcuts: 'window:shortcuts',
  accessibilityStatus: 'window:accessibility-status',
  requestAccessibility: 'window:request-accessibility'
} as const

/** A single Window Management command's display metadata, for the Settings screen. */
export interface WindowShortcutInfo {
  id: string
  title: string
  shortcut?: string
}
