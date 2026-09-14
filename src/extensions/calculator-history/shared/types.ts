/**
 * Calculator History's wire contract — the DTOs and IPC channel names shared by
 * the extension's main handlers (`../ipc/handlers.ts`), its preload fragment
 * (`../ipc/preload.ts`) and its renderer screens (`../renderer/`).
 */

/** One recorded calculation. Crosses IPC to the history screen. */
export interface HistoryEntry {
  id: string;
  /** What the user typed — re-run through the calculator for Re-run and for live pins. */
  query: string;
  /** The normalized expression the calculator showed. */
  expression: string;
  /** The formatted result at record time (or the last live refresh, for a pin). */
  value: string;
  /** The result without grouping/currency symbol, for "Copy Unformatted". */
  rawValue: string;
  /** Epoch ms of the most recent record of this `query`. */
  createdAt: number;
  pinned: boolean;
}

/** The part of a `Calculation` history stores — what the renderer sends to `record`. */
export interface RecordInput {
  query: string;
  expression: string;
  value: string;
  rawValue: string;
}

/** Action id prefix of a pinned entry's launcher row: `calculator-history:pin:<entryId>`. */
export const PIN_ACTION_PREFIX = "calculator-history:pin:";

/** Route name of the history list screen (`../screen.tsx`). */
export const HISTORY_ROUTE = "calculator-history";

export const CALC_HISTORY_CHANNELS = {
  list: "calculator-history:list",
  record: "calculator-history:record",
  delete: "calculator-history:delete",
  clear: "calculator-history:clear",
  setPinned: "calculator-history:set-pinned",
} as const;
