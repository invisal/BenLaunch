import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
import { applyLiquidGlass } from './native'

const WINDOW_WIDTH = 640
const WINDOW_HEIGHT = 420

export function createLauncherWindow(isPinned: () => boolean): BrowserWindow {
  const win = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    frame: false,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    backgroundColor: '#00000000',
    ...(process.platform === 'win32' ? { backgroundMaterial: 'acrylic' as const } : {}),
    // macOS gets its blur from `electron-liquid-glass` (applied after the window
    // is created). That native view needs a transparent window with `vibrancy`
    // unset — combining the two makes the compositing wrong.
    ...(process.platform === 'darwin' ? { transparent: true } : {}),
    ...(process.platform === 'linux' ? { transparent: true } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (process.platform === 'darwin') {
    // Attach the glass view once the web contents have painted, so it composites
    // under a live renderer rather than a blank frame.
    win.webContents.once('did-finish-load', () => applyLiquidGlass(win))
    // Without this, showing the window switches macOS to whatever Space/full-screen
    // app it "belongs to" instead of overlaying the one the user is currently on.
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  }

  win.on('blur', () => {
    if (!isPinned()) {
      win.hide()
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

export function centerOnActiveDisplay(win: BrowserWindow): void {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const { x, y, width, height } = display.workArea
  const bounds = win.getBounds()
  win.setPosition(
    Math.round(x + (width - bounds.width) / 2),
    Math.round(y + (height - bounds.height) / 3)
  )
}
