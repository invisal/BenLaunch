import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, type LauncherAction } from '../shared/types'

const api = {
  search: (query: string): Promise<LauncherAction[]> => ipcRenderer.invoke(IPC_CHANNELS.search, query),
  execute: (id: string, query: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.execute, id, query),
  hide: (): void => ipcRenderer.send(IPC_CHANNELS.hide),
  togglePin: (): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.togglePin)
}

contextBridge.exposeInMainWorld('api', api)

export type LauncherApi = typeof api
