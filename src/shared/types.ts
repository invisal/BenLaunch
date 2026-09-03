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
  togglePin: 'launcher:toggle-pin'
} as const
