import { ipcMain, screen } from 'electron'
import { IPC_CHANNELS, type CustomLayoutDraft, type DisplayPreviewInfo } from '../../../shared/types'
import { toRect } from '../../window/electron-screen'
import type { SettingsStore } from '../../settings/store'
import type { CustomLayoutStore } from './custom-store'

/** Wires the custom-layout manager window's CRUD calls, plus the shared gap-size and display-preview reads. */
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
  ipcMain.handle(IPC_CHANNELS.displayInfo, (): DisplayPreviewInfo => {
    const display = screen.getPrimaryDisplay()
    const workArea = toRect(display.workArea)
    return { width: workArea.width, height: workArea.height, label: 'Built-in Display' }
  })
}
