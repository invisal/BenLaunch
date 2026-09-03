import { app, BrowserWindow, globalShortcut, ipcMain, systemPreferences } from 'electron'
import { IPC_CHANNELS } from '../shared/types'
import { executeAction, getWindowShortcuts, initActionSources, query, refreshActionSources, settings } from './actions'
import { captureFocusedWindow } from './window/control'
import { DEFAULT_WINDOW_SHORTCUTS } from './window/shortcuts'
import { centerOnActiveDisplay, createLauncherWindow } from './window'

// Alt+Space is free on Windows, but on macOS Option+Space is commonly remapped
// (e.g. to Mission Control/Spotlight variants) and Cmd+Space/Cmd+Option+Space/
// Cmd+Ctrl+Space are all reserved by the OS, so macOS gets its own default.
const TOGGLE_SHORTCUT = process.platform === 'darwin' ? 'Command+Shift+Space' : 'Alt+Space'

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
  captureFocusedWindow(launcherHandle(launcherWindow))
  centerOnActiveDisplay(launcherWindow)
  launcherWindow.show()
  launcherWindow.focus()
  // Pick up changes since the last run (e.g. apps installed/removed); sources throttle.
  refreshActionSources()
}

/**
 * Registers a direct global shortcut per Window Management command, so e.g.
 * "Left Half" fires from anywhere without opening the launcher first — distinct
 * from `toggleLauncher()`'s capture, which happens right before the palette
 * shows. Here capture happens at press-time instead, since the launcher never
 * appears on this path and whatever's focused when the key is pressed is the
 * intended target.
 */
function registerWindowShortcuts(): void {
  for (const [actionId, platformDefault] of Object.entries(DEFAULT_WINDOW_SHORTCUTS)) {
    const accelerator = settings.getWindowShortcut(actionId, platformDefault)
    if (!accelerator) continue // user explicitly disabled this shortcut
    const ok = globalShortcut.register(accelerator, () => {
      captureFocusedWindow(launcherWindow ? launcherHandle(launcherWindow) : undefined)
      void executeAction(actionId, '')
    })
    if (!ok) {
      console.error(`[main] Failed to register window shortcut ${accelerator} for ${actionId}`)
    }
  }
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

  ipcMain.handle(IPC_CHANNELS.windowShortcuts, () => {
    return getWindowShortcuts()
  })

  ipcMain.handle(IPC_CHANNELS.accessibilityStatus, () => {
    if (process.platform !== 'darwin') return true
    return systemPreferences.isTrustedAccessibilityClient(false)
  })

  ipcMain.handle(IPC_CHANNELS.requestAccessibility, () => {
    if (process.platform !== 'darwin') return true
    return systemPreferences.isTrustedAccessibilityClient(true)
  })

  if (!globalShortcut.register(TOGGLE_SHORTCUT, toggleLauncher)) {
    console.error(`Failed to register global shortcut: ${TOGGLE_SHORTCUT}`)
  }

  registerWindowShortcuts()

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
