import type { IpcMain } from "electron";
import { CALC_HISTORY_CHANNELS, type RecordInput } from "../shared/types";
import type { HistoryStore } from "../main/store";

/** Wires the launcher's record calls and the history screen's list/pin/delete calls to the store. */
export function registerCalculatorHistoryIpc(ipc: IpcMain, store: HistoryStore): void {
  ipc.handle(CALC_HISTORY_CHANNELS.list, () => store.list());
  ipc.handle(
    CALC_HISTORY_CHANNELS.record,
    (_event, input: RecordInput) => store.record(input) ?? null,
  );
  ipc.handle(CALC_HISTORY_CHANNELS.delete, (_event, id: string) => {
    store.remove(id);
  });
  ipc.handle(CALC_HISTORY_CHANNELS.clear, () => {
    store.clear();
  });
  ipc.handle(
    CALC_HISTORY_CHANNELS.setPinned,
    (_event, id: string, pinned: boolean) => store.setPinned(id, pinned),
  );
}
