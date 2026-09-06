import { BrowserWindow, ipcMain, type BrowserWindowConstructorOptions } from 'electron'
import { IPC_CHANNELS } from '../shared/types'

/**
 * Constructor options shared by the framed windows (Settings, QuickValue), which
 * hide the OS title bar and draw their own via `renderer/src/shared/ui/WindowFrame`.
 *
 * They also get a translucent backing so the desktop shows through, the same
 * idea as the launcher (see `window.ts`): acrylic on Windows, vibrancy on macOS.
 * The renderer paints a semi-transparent panel on top — see `window-frame.css`.
 *
 * - macOS keeps its traffic lights (`titleBarStyle: 'hidden'`) sitting over the
 *   left of our title bar, and gets `under-window` vibrancy. No liquid glass
 *   here — that needs its own native view and fights `vibrancy` (see glass.ts).
 * - Windows/Linux drop the frame entirely; the renderer draws the min/max/close
 *   buttons and calls back through `window.api.windowControls`. Windows gets the
 *   `acrylic` background material; Linux just goes transparent.
 */
export const framelessChrome: BrowserWindowConstructorOptions = {
  // A translucent (fully transparent) backing colour so acrylic/vibrancy isn't
  // painted over. The renderer's `.window-frame` panel provides the tint.
  backgroundColor: '#00000000',
  ...(process.platform === 'darwin'
    ? {
        titleBarStyle: 'hidden' as const,
        trafficLightPosition: { x: 16, y: 16 },
        vibrancy: 'under-window' as const
      }
    : process.platform === 'win32'
      ? { frame: false, backgroundMaterial: 'acrylic' as const }
      : { frame: false, transparent: true })
}

/**
 * Wires the `window:*` channels once. Each acts on whichever `BrowserWindow` the
 * message came from, so a single registration covers every framed window.
 */
export function registerWindowControlsIpc(): void {
  ipcMain.on(IPC_CHANNELS.windowMinimize, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })

  ipcMain.on(IPC_CHANNELS.windowToggleMaximize, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })

  ipcMain.on(IPC_CHANNELS.windowClose, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })
}
