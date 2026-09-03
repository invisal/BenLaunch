import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, type QueryResult, type WindowShortcutInfo } from '../shared/types'

const api = {
  platform: process.platform,
  query: (text: string): Promise<QueryResult> => ipcRenderer.invoke(IPC_CHANNELS.query, text),
  execute: (id: string, text: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.execute, id, text),
  hide: (): void => ipcRenderer.send(IPC_CHANNELS.hide),
  togglePin: (): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.togglePin),
  getWindowShortcuts: (): Promise<WindowShortcutInfo[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.windowShortcuts),
  getAccessibilityStatus: (): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.accessibilityStatus),
  requestAccessibility: (): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.requestAccessibility)
}

contextBridge.exposeInMainWorld('api', api)

export type LauncherApi = typeof api
