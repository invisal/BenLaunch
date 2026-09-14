import { ipcMain } from "electron";
import { CALC_HISTORY_CHANNELS, type RecordInput } from "../shared/types";
import type { HistoryStore } from "../main/store";

/** Wires the launcher's record calls and the history screen's list/pin/delete calls to the store. */
export function registerCalculatorHistoryIpc(store: HistoryStore): void {
  ipcMain.handle(CALC_HISTORY_CHANNELS.list, () => store.list());
  ipcMain.handle(
    CALC_HISTORY_CHANNELS.record,
    (_event, input: RecordInput) => store.record(input) ?? null,
  );
  ipcMain.handle(CALC_HISTORY_CHANNELS.delete, (_event, id: string) => {
    store.remove(id);
  });
  ipcMain.handle(CALC_HISTORY_CHANNELS.clear, () => {
    store.clear();
  });
  ipcMain.handle(
    CALC_HISTORY_CHANNELS.setPinned,
    (_event, id: string, pinned: boolean) => store.setPinned(id, pinned),
  );
}
