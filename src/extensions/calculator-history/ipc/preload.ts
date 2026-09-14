import { ipcRenderer } from "electron";
import { CALC_HISTORY_CHANNELS } from "../shared/types";
import type { HistoryEntry, RecordInput } from "../shared/types";

/** `window.api.calculatorHistory` — the launcher's and the history screen's bridge to main. */
export const calculatorHistoryApi = {
  list: (): Promise<HistoryEntry[]> =>
    ipcRenderer.invoke(CALC_HISTORY_CHANNELS.list),
  /** Record a calculation the user acted on; resolves with the stored entry (`null` if ignored). */
  record: (input: RecordInput): Promise<HistoryEntry | null> =>
    ipcRenderer.invoke(CALC_HISTORY_CHANNELS.record, input),
  delete: (id: string): Promise<void> =>
    ipcRenderer.invoke(CALC_HISTORY_CHANNELS.delete, id),
  /** Drop every unpinned entry. */
  clear: (): Promise<void> => ipcRenderer.invoke(CALC_HISTORY_CHANNELS.clear),
  /** Resolves `false` when the pin limit is reached. */
  setPinned: (id: string, pinned: boolean): Promise<boolean> =>
    ipcRenderer.invoke(CALC_HISTORY_CHANNELS.setPinned, id, pinned),
};
