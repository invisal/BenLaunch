import { contextBridge, ipcRenderer } from "electron";
import type {
  OpenWithApp,
  Quicklink,
  QuicklinkCreateResult,
  QuicklinkDraft,
} from "../shared/quicklink";
import {
  IPC_CHANNELS,
  type CustomLayoutDef,
  type CustomLayoutDraft,
  type DisplayPreviewInfo,
  type QueryResult,
  type RequestSubtitleOptions,
} from "../shared/types";
import { quickValueApi } from "@extensions/quickvalue/ipc/preload";

const api = {
  platform: process.platform,
  query: (text: string): Promise<QueryResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.query, text),
  execute: (id: string, text: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.execute, id, text),
  hide: (): void => ipcRenderer.send(IPC_CHANNELS.hide),
  togglePin: (): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.togglePin),
  createQuicklink: (draft: QuicklinkDraft): Promise<QuicklinkCreateResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.quicklinkCreate, draft),
  updateQuicklink: (id: string, draft: QuicklinkDraft): Promise<QuicklinkCreateResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.quicklinkUpdate, id, draft),
  getQuicklink: (id: string): Promise<Quicklink | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.quicklinkGet, id),
  deleteQuicklink: (id: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.quicklinkDelete, id),
  setQuicklinkPinned: (id: string, pinned: boolean): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.quicklinkSetPinned, id, pinned),
  setQuicklinkHidden: (id: string, hidden: boolean): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.quicklinkSetHidden, id, hidden),
  openQuicklinkWith: (id: string, text: string, appPath: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.quicklinkOpenWith, id, text, appPath),
  pickQuicklinkPath: (type: "file" | "directory"): Promise<string | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.quicklinkPickPath, type),
  openWithApps: (): Promise<OpenWithApp[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.quicklinkOpenWithApps),

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

  /** Window-chrome controls for the framed windows (Settings, QuickValue), which
   *  render their own title bar. Each acts on the calling window. */
  windowControls: {
    minimize: (): void => ipcRenderer.send(IPC_CHANNELS.windowMinimize),
    toggleMaximize: (): void => ipcRenderer.send(IPC_CHANNELS.windowToggleMaximize),
    close: (): void => ipcRenderer.send(IPC_CHANNELS.windowClose),
  },

  /** QuickValue manager window ↔ main. */
  quickValue: quickValueApi,

  /** Custom window layouts ↔ main. */
  customLayout: {
    list: (): Promise<CustomLayoutDef[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.customLayoutList),
    get: (id: string): Promise<CustomLayoutDef | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.customLayoutGet, id),
    save: (draft: CustomLayoutDraft): Promise<CustomLayoutDef> =>
      ipcRenderer.invoke(IPC_CHANNELS.customLayoutSave, draft),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.customLayoutDelete, id),
  },
  getGapSize: (): Promise<number> => ipcRenderer.invoke(IPC_CHANNELS.gapSize),
  setGapSize: (px: number): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.setGapSize, px),
  getDisplayInfo: (): Promise<DisplayPreviewInfo> =>
    ipcRenderer.invoke(IPC_CHANNELS.displayInfo),
};

contextBridge.exposeInMainWorld("api", api);

export type LauncherApi = typeof api;
