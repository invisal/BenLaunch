import { contextBridge, ipcRenderer } from 'electron'
import type { OpenWithApp, QuicklinkCreateResult, QuicklinkDraft } from '../shared/quicklink'
import { IPC_CHANNELS, type QueryResult } from '../shared/types'

const api = {
  platform: process.platform,
  query: (text: string): Promise<QueryResult> => ipcRenderer.invoke(IPC_CHANNELS.query, text),
  execute: (id: string, text: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.execute, id, text),
  hide: (): void => ipcRenderer.send(IPC_CHANNELS.hide),
  togglePin: (): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.togglePin),
  createQuicklink: (draft: QuicklinkDraft): Promise<QuicklinkCreateResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.quicklinkCreate, draft),
  pickQuicklinkPath: (type: 'file' | 'directory'): Promise<string | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.quicklinkPickPath, type),
  openWithApps: (): Promise<OpenWithApp[]> => ipcRenderer.invoke(IPC_CHANNELS.quicklinkOpenWithApps)
}

contextBridge.exposeInMainWorld('api', api)

export type LauncherApi = typeof api
