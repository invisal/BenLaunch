import { app, BrowserWindow, dialog, globalShortcut, ipcMain } from 'electron'
import type { QuicklinkDraft } from '../shared/quicklink'
import { IPC_CHANNELS } from '../shared/types'
import {
  createQuicklink,
  executeAction,
  initActionSources,
  query,
  refreshActionSources
} from './actions'
import { captureForegroundWindow } from './native'
import { listOpenWithApps } from './sources/apps/open-with'
import { centerOnActiveDisplay, createLauncherWindow } from './window'

// Alt+Space is free on Windows, but on macOS Option+Space is commonly remapped
// (e.g. to Mission Control/Spotlight variants) and Cmd+Space/Cmd+Option+Space/
// Cmd+Ctrl+Space are all reserved by the OS, so macOS gets its own default.
const TOGGLE_SHORTCUT = process.platform === 'darwin' ? 'Command+Shift+Space' : 'Alt+Space'

let launcherWindow: BrowserWindow | null = null
let pinned = false
/**
 * Set while a modal picker (the file/folder dialog) is open, so the launcher's
 * blur-to-hide doesn't fire when the dialog steals focus — otherwise the window
 * vanishes and the user has to re-open it after choosing a path.
 */
let suppressAutoHide = false

/** Whether the launcher should stay visible on focus loss right now. */
function keepLauncherOpen(): boolean {
  return pinned || suppressAutoHide
}

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
  launcherWindow = createLauncherWindow(keepLauncherOpen)

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

  ipcMain.handle(IPC_CHANNELS.quicklinkCreate, (_event, draft: QuicklinkDraft) => {
    return createQuicklink(draft)
  })

  ipcMain.handle(
    IPC_CHANNELS.quicklinkPickPath,
    async (_event, type: 'file' | 'directory'): Promise<string | null> => {
      const options = {
        properties: [type === 'directory' ? 'openDirectory' : 'openFile'] as Array<
          'openDirectory' | 'openFile'
        >
      }
      suppressAutoHide = true
      try {
        const result = launcherWindow
          ? await dialog.showOpenDialog(launcherWindow, options)
          : await dialog.showOpenDialog(options)
        return result.canceled ? null : (result.filePaths[0] ?? null)
      } finally {
        suppressAutoHide = false
        // The dialog took focus; hand it back so the form stays interactive and
        // a later real focus loss hides the launcher as usual.
        launcherWindow?.focus()
      }
    }
  )

  ipcMain.handle(IPC_CHANNELS.quicklinkOpenWithApps, () => listOpenWithApps())

  ipcMain.handle(IPC_CHANNELS.togglePin, () => {
    pinned = !pinned
    return pinned
  })

  if (!globalShortcut.register(TOGGLE_SHORTCUT, toggleLauncher)) {
    console.error(`Failed to register global shortcut: ${TOGGLE_SHORTCUT}`)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      launcherWindow = createLauncherWindow(keepLauncherOpen)
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
