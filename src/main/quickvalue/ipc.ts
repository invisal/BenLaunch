import { ipcMain } from 'electron'
import { IPC_CHANNELS, type QuickValueDraft } from '../../shared/types'
import type { QuickValueRunner } from './runner'
import type { QuickValueStore } from './store'

/** Wires the QuickValue manager window's CRUD + test calls to the store/runner. */
export function registerQuickValueIpc(store: QuickValueStore, runner: QuickValueRunner): void {
  ipcMain.handle(IPC_CHANNELS.quickValueList, () => store.list())
  ipcMain.handle(IPC_CHANNELS.quickValueGet, (_event, id: string) => store.get(id) ?? null)
  ipcMain.handle(IPC_CHANNELS.quickValueSave, (_event, draft: QuickValueDraft) => store.save(draft))
  ipcMain.handle(IPC_CHANNELS.quickValueDelete, (_event, id: string) => {
    store.remove(id)
  })
  ipcMain.handle(IPC_CHANNELS.quickValueSetExposed, (_event, id: string, exposed: boolean) => {
    store.setExposed(id, exposed)
  })
  ipcMain.handle(IPC_CHANNELS.quickValueTest, (_event, code: string) => runner.runOnce(code))
}
