import { app, type IpcMain } from "electron";
import { hideLauncher } from "@main/window";
import { sendPasteKeystroke } from "../main/paste";
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
  ipc.handle(CLIPBOARD_HISTORY_CHANNELS.paste, async (_event, id: string) => {
    const entry = store.get(id);
    if (!entry) return false;
    await writeEntryToClipboard(entry, poller);
    hideLauncher();
    // `win.hide()` alone can leave this app frontmost on macOS, so the
    // keystroke would land here; `app.hide()` hands focus back to the app
    // the user was in (the next `showLauncher()` re-activates us).
    if (process.platform === "darwin") app.hide();
    await sendPasteKeystroke();
    return true;
  });
}
