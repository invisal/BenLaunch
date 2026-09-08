import { BrowserWindow, ipcMain, screen, type IpcMainInvokeEvent } from 'electron'
import { IPC_CHANNELS, type CustomLayoutDraft, type DisplayPreviewInfo } from '../../../shared/types'
import { toRect } from '../../window/electron-screen'
import type { SettingsStore } from '../../settings/store'
import type { CustomLayoutStore } from './custom-store'

/** Wires the launcher's custom-layout screens' CRUD calls, plus the shared gap-size and display-preview reads. */
export function registerCustomLayoutIpc(store: CustomLayoutStore, settings: SettingsStore): void {
  ipcMain.handle(IPC_CHANNELS.customLayoutList, () => store.list())
  ipcMain.handle(IPC_CHANNELS.customLayoutGet, (_event, id: string) => store.get(id) ?? null)
  ipcMain.handle(IPC_CHANNELS.customLayoutSave, (_event, draft: CustomLayoutDraft) => store.save(draft))
  ipcMain.handle(IPC_CHANNELS.customLayoutDelete, (_event, id: string) => {
    store.remove(id)
  })
  ipcMain.handle(IPC_CHANNELS.gapSize, () => settings.getGapSize())
  ipcMain.handle(IPC_CHANNELS.setGapSize, (_event, px: number) => {
    settings.setGapSize(px)
  })
  ipcMain.handle(IPC_CHANNELS.displayInfo, (event): DisplayPreviewInfo => {
    const display = displayForSender(event)
    const workArea = toRect(display.workArea)
    return { width: workArea.width, height: workArea.height, label: displayLabel(display) }
  })
}

/**
 * The display the layout is being designed against.
 *
 * Not the *primary* display: on a multi-monitor setup the layout is applied to
 * whichever screen the target window is on (`applyCustomLayout` resolves its
 * work area with `workAreaFor(currentRect)`), so previewing the primary would
 * draw the wrong shape and name the wrong screen.
 *
 * We use the screen the launcher window itself is on. `toggleLauncher` centres
 * it on the cursor's display before showing, so that is the screen the user is
 * working on — and therefore the one the captured window is on, short of the
 * pointer having moved to another display since the window was focused.
 */
function displayForSender(event: IpcMainInvokeEvent): Electron.Display {
  const sender = BrowserWindow.fromWebContents(event.sender)
  if (sender) return screen.getDisplayMatching(sender.getBounds())
  return screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
}

/** `Display.label` is platform-supplied and can come back empty; fall back to something that still tells two screens apart. */
function displayLabel(display: Electron.Display): string {
  const label = display.label.trim()
  if (label) return label
  return display.internal ? 'Built-in Display' : 'External Display'
}
