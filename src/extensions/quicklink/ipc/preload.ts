import { ipcRenderer } from "electron";
import { QUICKLINK_CHANNELS } from "../shared/types";
import type {
  OpenWithApp,
  Quicklink,
  QuicklinkCreateResult,
  QuicklinkDraft,
  QuicklinkEntry,
} from "../shared/types";

/** `window.api.quicklink` — the Create/Edit form's, the manager screen's and the Ctrl+K menu's bridge to main. */
export const quicklinkApi = {
  createQuicklink: (draft: QuicklinkDraft): Promise<QuicklinkCreateResult> =>
    ipcRenderer.invoke(QUICKLINK_CHANNELS.create, draft),
  updateQuicklink: (
    id: string,
    draft: QuicklinkDraft,
  ): Promise<QuicklinkCreateResult> =>
    ipcRenderer.invoke(QUICKLINK_CHANNELS.update, id, draft),
  getQuicklink: (id: string): Promise<Quicklink | null> =>
    ipcRenderer.invoke(QUICKLINK_CHANNELS.get, id),
  listQuicklinks: (): Promise<QuicklinkEntry[]> =>
    ipcRenderer.invoke(QUICKLINK_CHANNELS.list),
  deleteQuicklink: (id: string): Promise<void> =>
    ipcRenderer.invoke(QUICKLINK_CHANNELS.delete, id),
  setQuicklinkPinned: (id: string, pinned: boolean): Promise<void> =>
    ipcRenderer.invoke(QUICKLINK_CHANNELS.setPinned, id, pinned),
  setQuicklinkHidden: (id: string, hidden: boolean): Promise<void> =>
    ipcRenderer.invoke(QUICKLINK_CHANNELS.setHidden, id, hidden),
  openQuicklinkWith: (
    id: string,
    text: string,
    appPath: string,
  ): Promise<void> =>
    ipcRenderer.invoke(QUICKLINK_CHANNELS.openWith, id, text, appPath),
  pickQuicklinkPath: (type: "file" | "directory"): Promise<string | null> =>
    ipcRenderer.invoke(QUICKLINK_CHANNELS.pickPath, type),
  openWithApps: (): Promise<OpenWithApp[]> =>
    ipcRenderer.invoke(QUICKLINK_CHANNELS.openWithApps),
};
