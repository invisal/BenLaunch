import { app, BrowserWindow, globalShortcut, ipcMain } from 'electron'
import { IPC_CHANNELS } from '../shared/types'
import { executeAction, searchActions } from './actions'
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
}

app.whenReady().then(() => {
  launcherWindow = createLauncherWindow(() => pinned)

  ipcMain.handle(IPC_CHANNELS.search, (_event, query: string) => {
    return searchActions(query)
  })

  ipcMain.handle(IPC_CHANNELS.execute, (_event, id: string) => {
    // Hide synchronously before launching so the launcher disappears instantly,
    // instead of lingering until the launched app grabs focus and triggers `blur`.
    if (!pinned) launcherWindow?.hide()
    return executeAction(id)
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
