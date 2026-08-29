import { app, BrowserWindow, globalShortcut, ipcMain } from 'electron'
import { IPC_CHANNELS } from '../shared/types'
import { executeAction, initActionSources, refreshActionSources, searchActions } from './actions'
import { centerOnActiveDisplay, createLauncherWindow } from './window'

const TOGGLE_SHORTCUT = 'CommandOrControl+Space'

let launcherWindow: BrowserWindow | null = null
let pinned = false

function toggleLauncher(): void {
  if (!launcherWindow) return
  if (launcherWindow.isVisible()) {
    launcherWindow.hide()
    return
  }
  centerOnActiveDisplay(launcherWindow)
  launcherWindow.show()
  launcherWindow.focus()
  // Pick up changes since the last run (e.g. apps installed/removed); sources throttle.
  refreshActionSources()
}

app.whenReady().then(() => {
  launcherWindow = createLauncherWindow(() => pinned)

  // Warm every action source now (apps: disk cache, then a background worker run)
  // instead of waiting for the renderer's first search.
  initActionSources()

  ipcMain.handle(IPC_CHANNELS.search, (_event, query: string) => {
    return searchActions(query)
  })

  ipcMain.handle(IPC_CHANNELS.execute, (_event, id: string, query: string) => {
    // Hide synchronously before launching so the launcher disappears instantly,
    // instead of lingering until the launched app grabs focus and triggers `blur`.
    if (!pinned) launcherWindow?.hide()
    // `query` is threaded through so usage tracking can learn "typed X, picked Y".
    return executeAction(id, query)
  })

  ipcMain.on(IPC_CHANNELS.hide, () => {
    launcherWindow?.hide()
  })

  ipcMain.handle(IPC_CHANNELS.togglePin, () => {
    pinned = !pinned
    return pinned
  })

  globalShortcut.register(TOGGLE_SHORTCUT, toggleLauncher)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      launcherWindow = createLauncherWindow(() => pinned)
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
