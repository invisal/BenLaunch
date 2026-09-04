export type LauncherActionType = 'application' | 'command' | 'quickvalue'
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
   * The action is resolving a value in the background (e.g. a QuickValue running
   * its async function). The list shows a spinner instead of the subtitle.
   */
  isLoading?: boolean
}

/** A user-authored QuickValue definition. Crosses IPC to the manage window. */
export interface QuickValueDef {
  /** Stable slug, derived from `name` on creation; used in the action id `qv:<id>`. */
  id: string
  name: string
  code: string
  exposed: boolean
}

/** A QuickValue draft on its way in from the editor (no id yet when creating). */
export interface QuickValueDraft {
  id?: string
  name: string
  code: string
  exposed: boolean
}

/** One-shot run result, for the editor's "Test" button. */
export type QuickValueTestResult =
  | { ok: true; value: string | number | null }
  | { ok: false; error: string }

/** Pushed to the launcher when an exposed QuickValue's value changes. */
export interface QuickValueUpdate {
  /** Bare slug; the launcher matches the row `qv:<id>`. */
  id: string
  subtitle: string
  isLoading: boolean
}

/** One run of an expression, classified for syntax highlighting. */
export type CalcTokenKind =
  | 'number'
  | 'operator'
  | 'paren'
  | 'function'
  | 'constant'
  | 'unit'
  | 'punct'
  | 'whitespace'

export interface CalcToken {
  text: string
  kind: CalcTokenKind
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
  /** Quicklink is pinned — sorts above unpinned actions in the root list. */
  pinned?: boolean
  /** Quicklink is hidden from the root list (still returned for an explicit search). */
  hidden?: boolean
}

/** An evaluated expression the query itself resolved to (e.g. `"1 + 2"` → `"3"`). */
export interface Calculation {
  /** The normalized expression — spoken forms rewritten to symbols, trimmed. */
  expression: string
  /** The formatted result, ready to display or copy. */
  value: string
  /** The result without grouping separators, for pasting into code / feeding back in. */
  rawValue: string
  /** `expression` split for syntax highlighting; absent when it could not be tokenized. */
  tokens?: CalcToken[]
  /** Small print shown bottom-right of the result — e.g. currency's "Updated 2 days ago". */
  footnote?: string
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
  quickValueList: 'quickvalue:list',
  quickValueGet: 'quickvalue:get',
  quickValueSave: 'quickvalue:save',
  quickValueDelete: 'quickvalue:delete',
  quickValueSetExposed: 'quickvalue:set-exposed',
  quickValueTest: 'quickvalue:test',
  /** main → launcher window: an exposed QuickValue's value changed. */
  quickValueUpdate: 'quickvalue:update'
  togglePin: 'launcher:toggle-pin',
  quicklinkCreate: 'quicklink:create',
  quicklinkUpdate: 'quicklink:update',
  quicklinkDelete: 'quicklink:delete',
  quicklinkGet: 'quicklink:get',
  quicklinkSetPinned: 'quicklink:set-pinned',
  quicklinkSetHidden: 'quicklink:set-hidden',
  quicklinkOpenWith: 'quicklink:open-with',
  quicklinkPickPath: 'quicklink:pick-path',
  quicklinkOpenWithApps: 'quicklink:open-with-apps'
} as const
