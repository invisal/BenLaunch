import { ipcMain } from 'electron'
import { QUICKVALUE_CHANNELS, type QuickValueDraft } from '../shared/types'
import type { QuickValueRunner } from '../main/runner'
import type { QuickValueStore } from '../main/store'

/** Wires the QuickValue manager window's CRUD + test calls to the store/runner. */
export function registerQuickValueIpc(store: QuickValueStore, runner: QuickValueRunner): void {
  ipcMain.handle(QUICKVALUE_CHANNELS.list, () => store.list())
  ipcMain.handle(QUICKVALUE_CHANNELS.get, (_event, id: string) => store.get(id) ?? null)
  ipcMain.handle(QUICKVALUE_CHANNELS.save, (_event, draft: QuickValueDraft) => store.save(draft))
  ipcMain.handle(QUICKVALUE_CHANNELS.delete, (_event, id: string) => {
    store.remove(id)
  })
  ipcMain.handle(QUICKVALUE_CHANNELS.setExposed, (_event, id: string, exposed: boolean) => {
    store.setExposed(id, exposed)
  })
  ipcMain.handle(QUICKVALUE_CHANNELS.test, (_event, code: string) => runner.runOnce(code))
}
