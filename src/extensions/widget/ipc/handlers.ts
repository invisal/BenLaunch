import { ipcMain } from 'electron'
import { WIDGET_CHANNELS, type WidgetDraft } from '../shared/types'
import type { WidgetRunner } from '../main/runner'
import type { WidgetStore } from '../main/store'

/** Wires the Widget manager window's CRUD + test calls to the store/runner. */
export function registerWidgetIpc(store: WidgetStore, runner: WidgetRunner): void {
  ipcMain.handle(WIDGET_CHANNELS.list, () => store.list())
  ipcMain.handle(WIDGET_CHANNELS.get, (_event, id: string) => store.get(id) ?? null)
  ipcMain.handle(WIDGET_CHANNELS.save, (_event, draft: WidgetDraft) => store.save(draft))
  ipcMain.handle(WIDGET_CHANNELS.delete, (_event, id: string) => {
    store.remove(id)
  })
  ipcMain.handle(WIDGET_CHANNELS.setExposed, (_event, id: string, exposed: boolean) => {
    store.setExposed(id, exposed)
  })
  ipcMain.handle(WIDGET_CHANNELS.test, (_event, code: string) => runner.runOnce(code))
}
