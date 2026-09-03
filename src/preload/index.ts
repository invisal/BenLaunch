import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import {
  IPC_CHANNELS,
  type QueryResult,
  type QuickValueDef,
  type QuickValueDraft,
  type QuickValueTestResult,
  type QuickValueUpdate
} from '../shared/types'

const api = {
  platform: process.platform,
  query: (text: string): Promise<QueryResult> => ipcRenderer.invoke(IPC_CHANNELS.query, text),
  execute: (id: string, text: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.execute, id, text),
  hide: (): void => ipcRenderer.send(IPC_CHANNELS.hide),
  togglePin: (): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.togglePin),

  /** QuickValue manager window ↔ main. */
  quickValue: {
    list: (): Promise<QuickValueDef[]> => ipcRenderer.invoke(IPC_CHANNELS.quickValueList),
    get: (id: string): Promise<QuickValueDef | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.quickValueGet, id),
    save: (draft: QuickValueDraft): Promise<QuickValueDef> =>
      ipcRenderer.invoke(IPC_CHANNELS.quickValueSave, draft),
    delete: (id: string): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.quickValueDelete, id),
    setExposed: (id: string, exposed: boolean): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.quickValueSetExposed, id, exposed),
    test: (code: string): Promise<QuickValueTestResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.quickValueTest, code)
  },

  /** Launcher: subscribe to exposed-QuickValue value changes. Returns an unsubscribe fn. */
  onQuickValueUpdate: (callback: (update: QuickValueUpdate) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, update: QuickValueUpdate): void => callback(update)
    ipcRenderer.on(IPC_CHANNELS.quickValueUpdate, listener)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.quickValueUpdate, listener)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)

export type LauncherApi = typeof api
