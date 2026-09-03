import { BrowserWindow } from 'electron'
import { join } from 'node:path'

/**
 * The QuickValue manager lives in its own framed BrowserWindow with its own
 * renderer entry (`quickvalue.html`) — same pattern as the settings window. It's
 * a singleton; opening it again just navigates the existing window (via the URL
 * hash) and focuses it.
 */
export type QuickValueView =
  | { view: 'list' }
  | { view: 'create' }
  | { view: 'edit'; id: string }

const WINDOW_WIDTH = 860
const WINDOW_HEIGHT = 640

let quickValueWindow: BrowserWindow | null = null

function hashFor(target: QuickValueView): string {
  return target.view === 'edit' ? `edit/${encodeURIComponent(target.id)}` : target.view
}

export function openQuickValueWindow(target: QuickValueView = { view: 'list' }): void {
  const hash = hashFor(target)

  if (quickValueWindow) {
    if (quickValueWindow.isMinimized()) quickValueWindow.restore()
    void quickValueWindow.webContents.executeJavaScript(
      `location.hash = ${JSON.stringify(`#${hash}`)}`
    )
    quickValueWindow.show()
    quickValueWindow.focus()
    return
  }

  quickValueWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    minWidth: 560,
    minHeight: 420,
    title: 'QuickValue',
    show: false,
    backgroundColor: '#0a0908',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  quickValueWindow.once('ready-to-show', () => quickValueWindow?.show())
  quickValueWindow.on('closed', () => {
    quickValueWindow = null
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    void quickValueWindow.loadURL(
      `${process.env['ELECTRON_RENDERER_URL']}/quickvalue.html#${hash}`
    )
  } else {
    void quickValueWindow.loadFile(join(__dirname, '../renderer/quickvalue.html'), { hash })
  }
}
