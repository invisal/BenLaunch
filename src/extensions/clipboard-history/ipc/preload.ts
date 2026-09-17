import { ipcRenderer } from "electron";
import { CLIPBOARD_HISTORY_CHANNELS } from "../shared/types";
import type { ClipboardEntry } from "../shared/types";

/** `window.api.clipboardHistory` — the history screen's bridge to main. */
export const clipboardHistoryApi = {
  list: (): Promise<ClipboardEntry[]> =>
    ipcRenderer.invoke(CLIPBOARD_HISTORY_CHANNELS.list),
  /** Fires whenever the background poller records a new entry, so an open
   *  history screen can refresh without waiting for a remount. Returns an
   *  unsubscribe function. */
  onUpdated: (callback: () => void): (() => void) => {
    const listener = () => callback();
    ipcRenderer.on(CLIPBOARD_HISTORY_CHANNELS.updated, listener);
    return () =>
      ipcRenderer.removeListener(CLIPBOARD_HISTORY_CHANNELS.updated, listener);
  },
  delete: (id: string): Promise<void> =>
    ipcRenderer.invoke(CLIPBOARD_HISTORY_CHANNELS.delete, id),
  /** Drop every unpinned entry. */
  clear: (): Promise<void> =>
    ipcRenderer.invoke(CLIPBOARD_HISTORY_CHANNELS.clear),
  /** Resolves `false` when the pin limit is reached. */
  setPinned: (id: string, pinned: boolean): Promise<boolean> =>
    ipcRenderer.invoke(CLIPBOARD_HISTORY_CHANNELS.setPinned, id, pinned),
  /** Write the entry back to the OS clipboard. Resolves `false` for an unknown id. */
  copyAgain: (id: string): Promise<boolean> =>
    ipcRenderer.invoke(CLIPBOARD_HISTORY_CHANNELS.copyAgain, id),
};
