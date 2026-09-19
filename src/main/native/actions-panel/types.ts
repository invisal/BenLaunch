export const ACTIONS_PANEL_CHANNELS = {
  supported: 'actions-panel:supported',
  show: 'actions-panel:show',
  close: 'actions-panel:close'
} as const

/** One serializable row of the native Actions panel (closures stay in the renderer). */
export interface ActionsPanelItem {
  id: string
  title: string
  /** Rows sharing a section are grouped under a small header. */
  section?: string
  /** Keycaps, e.g. `["⇧", "⌘", "F"]`. */
  shortcut?: string[]
  /** SF Symbol name, e.g. `"star"`. */
  iconSfSymbol?: string
  /** SF Symbol at the trailing edge, after any keycaps — e.g. `"chevron.right"` for a submenu. */
  accessorySfSymbol?: string
  danger?: boolean
}
