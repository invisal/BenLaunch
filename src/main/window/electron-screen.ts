import { screen } from 'electron'
import type { DisplayInfo, Rect } from './layout'

/** Small Electron `screen`-module helpers shared by `control-win.ts` and `control-mac.ts`. */

export function toRect(bounds: Electron.Rectangle): Rect {
  return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
}

export function centerOf(rect: Rect): { x: number; y: number } {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
}

/** The work area (screen minus taskbar/menu bar/dock) of the display `rect` sits on. */
export function workAreaFor(rect: Rect): Rect {
  return toRect(screen.getDisplayNearestPoint(centerOf(rect)).workArea)
}

/** The display `rect` sits on. */
export function currentDisplay(rect: Rect): Electron.Display {
  return screen.getDisplayNearestPoint(centerOf(rect))
}

export function allDisplays(): DisplayInfo[] {
  return screen.getAllDisplays().map((display) => ({ id: display.id, workArea: toRect(display.workArea) }))
}
