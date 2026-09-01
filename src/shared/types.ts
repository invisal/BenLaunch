import type { LauncherView } from './quicklink'

export type LauncherActionType = 'application' | 'command' | 'quicklink'

export interface LauncherAction {
  id: string
  title: string
  subtitle?: string
  /** Emoji, single/few characters, or an image URL (http(s):/data:/file:) */
  icon?: string
  type: LauncherActionType
  /** Electron accelerator string, e.g. "CommandOrControl+1" */
  shortcut?: string
  /**
   * Short alias that invokes this action when typed as the query's first word
   * (e.g. "g" for a Google quicklink). Everything after it becomes the argument.
   */
  keyword?: string
  /**
   * When set, running this action opens a renderer view (e.g. the Create
   * Quicklink form) instead of executing a handler in the main process.
   */
  view?: LauncherView
  /** Extra terms this action should also match on (e.g. a quicklink's tags). */
  tags?: string[]
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
  quicklinkCreate: 'quicklink:create',
  quicklinkPickPath: 'quicklink:pick-path',
  quicklinkOpenWithApps: 'quicklink:open-with-apps'
} as const
