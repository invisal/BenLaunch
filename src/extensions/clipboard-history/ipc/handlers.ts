import type { IpcMain } from "electron";
import { writeEntryToClipboard } from "../main/row";
import type { ClipboardPoller } from "../main/poller";
import type { ClipboardStore } from "../main/store";
import { CLIPBOARD_HISTORY_CHANNELS } from "../shared/types";

/** Wires the history screen's list/pin/delete/copy-again calls to the store. */
export function registerClipboardHistoryIpc(
  ipc: IpcMain,
  store: ClipboardStore,
  poller: ClipboardPoller,
): void {
  ipc.handle(CLIPBOARD_HISTORY_CHANNELS.list, () => store.list());
  ipc.handle(CLIPBOARD_HISTORY_CHANNELS.delete, (_event, id: string) => {
    store.remove(id);
  });
  ipc.handle(CLIPBOARD_HISTORY_CHANNELS.clear, () => {
    store.clear();
  });
  ipc.handle(
    CLIPBOARD_HISTORY_CHANNELS.setPinned,
    (_event, id: string, pinned: boolean) => store.setPinned(id, pinned),
  );
  ipc.handle(
    CLIPBOARD_HISTORY_CHANNELS.copyAgain,
    async (_event, id: string) => {
      const entry = store.get(id);
      if (!entry) return false;
      await writeEntryToClipboard(entry, poller);
      return true;
    },
  );
}
