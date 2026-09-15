import type { IpcMain } from 'electron'
import { WIDGET_CHANNELS, type WidgetDraft } from '../shared/types'
import type { WidgetRunner } from '../main/runner'
import type { WidgetStore } from '../main/store'

/** Wires the Widget manager window's CRUD + test calls to the store/runner. */
export function registerWidgetIpc(ipc: IpcMain, store: WidgetStore, runner: WidgetRunner): void {
  ipc.handle(WIDGET_CHANNELS.list, () => store.list())
  ipc.handle(WIDGET_CHANNELS.get, (_event, id: string) => store.get(id) ?? null)
  ipc.handle(WIDGET_CHANNELS.save, (_event, draft: WidgetDraft) => store.save(draft))
  ipc.handle(WIDGET_CHANNELS.delete, (_event, id: string) => {
    store.remove(id)
  })
  ipc.handle(WIDGET_CHANNELS.setExposed, (_event, id: string, exposed: boolean) => {
    store.setExposed(id, exposed)
  })
  ipc.handle(WIDGET_CHANNELS.test, (_event, code: string) => runner.runOnce(code))
}
