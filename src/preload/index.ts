import { contextBridge, ipcRenderer } from "electron";
import {
  IPC_CHANNELS,
  type QueryResult,
  type WindowShortcutInfo,
  type QuickValueDef,
  type QuickValueDraft,
  type QuickValueTestResult,
  type RequestSubtitleOptions,
} from "../shared/types";

const api = {
  platform: process.platform,
  query: (text: string): Promise<QueryResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.query, text),
  execute: (id: string, text: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.execute, id, text),
  hide: (): void => ipcRenderer.send(IPC_CHANNELS.hide),
  togglePin: (): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.togglePin),
  getWindowShortcuts: (): Promise<WindowShortcutInfo[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.windowShortcuts),
  getAccessibilityStatus: (): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.accessibilityStatus),
  requestAccessibility: (): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.requestAccessibility),

  /** Launcher: a deferred-subtitle row rendered (or force-refreshed) — resolves with the fresh subtitle. */
  requestSubtitle: (
    actionId: string,
    opts?: RequestSubtitleOptions,
  ): Promise<string | undefined> =>
    ipcRenderer.invoke(IPC_CHANNELS.requestSubtitle, actionId, opts),

  /** QuickValue manager window ↔ main. */
  quickValue: {
    list: (): Promise<QuickValueDef[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.quickValueList),
    get: (id: string): Promise<QuickValueDef | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.quickValueGet, id),
    save: (draft: QuickValueDraft): Promise<QuickValueDef> =>
      ipcRenderer.invoke(IPC_CHANNELS.quickValueSave, draft),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.quickValueDelete, id),
    setExposed: (id: string, exposed: boolean): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.quickValueSetExposed, id, exposed),
    test: (code: string): Promise<QuickValueTestResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.quickValueTest, code),
  },
};

contextBridge.exposeInMainWorld("api", api);

export type LauncherApi = typeof api;
