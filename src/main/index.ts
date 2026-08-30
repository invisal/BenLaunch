import { app, BrowserWindow, globalShortcut, ipcMain } from 'electron'
import { IPC_CHANNELS } from '../shared/types'
import { executeAction, initActionSources, query, refreshActionSources } from './actions'
import { captureForegroundWindow } from './native'
import { centerOnActiveDisplay, createLauncherWindow } from './window'

const TOGGLE_SHORTCUT = 'CommandOrControl+Space'

let launcherWindow: BrowserWindow | null = null
let pinned = false

/** The launcher's own HWND, so window-snap commands never target the launcher itself. */
function launcherHandle(win: BrowserWindow): number {
  if (process.platform !== 'win32') return 0
  // Win64 HWNDs are 32-bit values, so the low 32 bits of the pointer are the handle.
  return win.getNativeWindowHandle().readUInt32LE(0)
}

function toggleLauncher(): void {
  if (!launcherWindow) return
  if (launcherWindow.isVisible()) {
    launcherWindow.hide()
    return
  }
  // Grab the window the user is in now, before show()/focus() makes it the launcher.
  captureForegroundWindow(launcherHandle(launcherWindow))
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

  ipcMain.handle(IPC_CHANNELS.query, (_event, text: string) => {
    return query(text)
  })

  ipcMain.handle(IPC_CHANNELS.execute, (_event, id: string, text: string) => {
    // Hide synchronously before launching so the launcher disappears instantly,
    // instead of lingering until the launched app grabs focus and triggers `blur`.
    if (!pinned) launcherWindow?.hide()
    // `text` is threaded through so usage tracking can learn "typed X, picked Y".
    return executeAction(id, text)
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
