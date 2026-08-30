import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, type QueryResult } from '../shared/types'

const api = {
  query: (text: string): Promise<QueryResult> => ipcRenderer.invoke(IPC_CHANNELS.query, text),
  execute: (id: string, text: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.execute, id, text),
  hide: (): void => ipcRenderer.send(IPC_CHANNELS.hide),
  togglePin: (): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.togglePin)
}

contextBridge.exposeInMainWorld('api', api)

export type LauncherApi = typeof api
