import { ipcRenderer } from 'electron'
import {
  ACTIONS_PANEL_CHANNELS,
  type ActionsFormEvent,
  type ActionsFormSpec,
  type ActionsPanelItem
} from './types'

/** `window.api.actionsPanel` — the experimental native (NSPanel) Actions menu. */
export const actionsPanelApi = {
  /** Whether this build/platform has the native panel. */
  supported: (): Promise<boolean> => ipcRenderer.invoke(ACTIONS_PANEL_CHANNELS.supported),
  /** Resolves with the picked item's `id`, or `null` if dismissed. */
  show: (title: string, items: ActionsPanelItem[]): Promise<string | null> =>
    ipcRenderer.invoke(ACTIONS_PANEL_CHANNELS.show, title, items),
  close: (): Promise<void> => ipcRenderer.invoke(ACTIONS_PANEL_CHANNELS.close),

  /** Opens a native form; resolves false if it couldn't. Drive it with `formNext` / `formFail` / `formClose`. */
  formOpen: (spec: ActionsFormSpec): Promise<boolean> =>
    ipcRenderer.invoke(ACTIONS_PANEL_CHANNELS.formOpen, spec),
  /** The next thing the open form reported: a save (`submit`, with the value) or a dismissal (`cancel`). */
  formNext: (): Promise<ActionsFormEvent> => ipcRenderer.invoke(ACTIONS_PANEL_CHANNELS.formNext),
  /** The save failed: the form shows `message` and stays up for another try. */
  formFail: (message: string): Promise<void> =>
    ipcRenderer.invoke(ACTIONS_PANEL_CHANNELS.formFail, message),
  /** The save worked (or the caller is done): closes the form without reporting back. */
  formClose: (): Promise<void> => ipcRenderer.invoke(ACTIONS_PANEL_CHANNELS.formClose)
}
