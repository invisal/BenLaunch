import { BrowserWindow } from 'electron'
import { join } from 'node:path'
import { framelessChrome } from '@main/window-chrome'

/**
 * The QuickValue window is the CodeMirror editor for a single QuickValue — the
 * list and metadata form live in the launcher's navigation stack now. It's a
 * singleton framed window (same pattern as settings); opening it again just
 * points it at a different QuickValue (via the URL hash) and focuses it.
 */
export interface QuickValueView {
  view: 'code'
  id: string
}

const WINDOW_WIDTH = 860
const WINDOW_HEIGHT = 640

let quickValueWindow: BrowserWindow | null = null

function hashFor(target: QuickValueView): string {
  return encodeURIComponent(target.id)
}

export function openQuickValueWindow(target: QuickValueView): void {
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
    autoHideMenuBar: true,
    ...framelessChrome,
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
