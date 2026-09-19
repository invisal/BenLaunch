export const ACTIONS_PANEL_CHANNELS = {
  supported: 'actions-panel:supported',
  show: 'actions-panel:show',
  close: 'actions-panel:close',
  formOpen: 'actions-panel:form-open',
  formNext: 'actions-panel:form-next',
  formFail: 'actions-panel:form-fail',
  formClose: 'actions-panel:form-close'
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
  /** Plain text at the trailing edge (e.g. the current alias), where keycaps would sit. */
  hint?: string
  danger?: boolean
}

/**
 * A native form screen: a header, one input and Cancel / Save buttons. `text` is
 * a text field; `keys` records the next key combo as an Electron accelerator
 * (`Command+Shift+K`).
 */
export interface ActionsFormSpec {
  kind: 'text' | 'keys'
  title: string
  /** A glyph (emoji) shown before the title. */
  iconText?: string
  /** A `data:image/...;base64,` icon shown before the title. */
  iconDataUrl?: string
  /** `text`: the field's starting content. */
  initialValue?: string
  /** `text`: the field's placeholder. */
  placeholder?: string
  /** `text`: drop whitespace as it's typed. */
  stripWhitespace?: boolean
  /** Left button. Default "Cancel". */
  cancelLabel?: string
  /** Right (primary) button. Default "Save". */
  submitLabel?: string
  /** The primary button's title while saving. Default "Saving…". */
  loadingLabel?: string
}

/**
 * What an open form reports. `submit`: the user saved (`value` is the text or
 * accelerator). `cancel`: it closed — `value` is `'back'` if the user chose to
 * leave (Esc, Cancel), `'dismissed'` if it was lost (focus moved elsewhere).
 */
export interface ActionsFormEvent {
  kind: 'submit' | 'cancel'
  value?: string
}
