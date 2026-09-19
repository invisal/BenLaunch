import { ipcRenderer } from 'electron'
import { ACTIONS_PANEL_CHANNELS, type ActionsPanelItem } from './types'

/** `window.api.actionsPanel` — the experimental native (NSPanel) Actions menu. */
export const actionsPanelApi = {
  /** Whether this build/platform has the native panel. */
  supported: (): Promise<boolean> => ipcRenderer.invoke(ACTIONS_PANEL_CHANNELS.supported),
  /** Resolves with the picked item's `id`, or `null` if dismissed. */
  show: (title: string, items: ActionsPanelItem[]): Promise<string | null> =>
    ipcRenderer.invoke(ACTIONS_PANEL_CHANNELS.show, title, items),
  close: (): Promise<void> => ipcRenderer.invoke(ACTIONS_PANEL_CHANNELS.close)
}
