import { ipcMain, type BrowserWindow } from 'electron'
import { loadNativeMac } from './native-mac'
import { ACTIONS_PANEL_CHANNELS, type ActionsPanelItem } from './types'

/** The launcher-window state the panel needs, owned by `main/index.ts`. */
export interface ActionsPanelIpcHost {
  getLauncherWindow: () => BrowserWindow | null
  /** The panel takes key focus, which would otherwise blur-hide the launcher. */
  setSuppressAutoHide: (value: boolean) => void
}

/**
 * `show` resolves with the picked row's id, or `null` if the panel was
 * dismissed (Esc, focus loss, `close`). The native panel reports exactly once.
 */
export function registerActionsPanelIpc(host: ActionsPanelIpcHost): void {
  ipcMain.handle(ACTIONS_PANEL_CHANNELS.supported, () => {
    return typeof loadNativeMac()?.showActionsPanel === 'function'
  })

  ipcMain.handle(
    ACTIONS_PANEL_CHANNELS.show,
    (_event, title: string, items: ActionsPanelItem[]) => {
      const native = loadNativeMac()
      const win = host.getLauncherWindow()
      if (!native || !win) return Promise.resolve(null)

      return new Promise<string | null>((resolve) => {
        host.setSuppressAutoHide(true)
        try {
          native.showActionsPanel(win.getNativeWindowHandle(), title, items, (event) => {
            host.setSuppressAutoHide(false)
            if (!win.isDestroyed()) win.focus()
            resolve(event.kind === 'select' ? (event.id ?? null) : null)
          })
        } catch (error) {
          host.setSuppressAutoHide(false)
          console.error('[actions-panel] show failed:', error)
          resolve(null)
        }
      })
    }
  )

  ipcMain.handle(ACTIONS_PANEL_CHANNELS.close, () => {
    loadNativeMac()?.closeActionsPanel()
  })
}
