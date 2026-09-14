/**
 * Pinned calculations as launcher rows — the Electron-free core of
 * `CalculatorHistoryExtension`, so `node --test` can drive it.
 *
 * A pin stores the query, not a recompute recipe: a live row just runs the
 * query through the calculator again (`evaluate`), so a pinned `1 usd in eur`
 * picks up new rates, `days until 25 Dec` counts down and `time in Tokyo`
 * ticks — with no per-kind logic here. The last good result is kept on the
 * entry as a fallback (offline, or a query that stops resolving).
 */
import type { Calculation, LauncherAction } from "@shared/types";
import { PIN_ACTION_PREFIX, type HistoryEntry } from "../shared/types.ts";
import type { HistoryStore } from "./store";

export type Evaluate = (query: string) => Calculation | null;

/** `calculator-history:pin:<id>` → `<id>`; `null` for any other action id. */
export function pinEntryId(actionId: string): string | null {
  return actionId.startsWith(PIN_ACTION_PREFIX)
    ? actionId.slice(PIN_ACTION_PREFIX.length)
    : null;
}

/** A pinned entry as a root-list row: pinned (sorts to the top), value fetched lazily. */
export function pinRow(entry: HistoryEntry): LauncherAction {
  return {
    id: `${PIN_ACTION_PREFIX}${entry.id}`,
    title: entry.query,
    subtitle: entry.value,
    icon: "🧮",
    type: "calculation",
    pinned: true,
    isDeferredSubtitle: true,
  };
}

/**
 * The fresh value for a pinned row: re-evaluate its query, persist the new
 * result, and return it. Falls back to the last stored value when the query
 * no longer resolves. `undefined` for an unknown / unpinned id.
 */
export function refreshPin(
  store: HistoryStore,
  evaluate: Evaluate,
  actionId: string,
): string | undefined {
  const id = pinEntryId(actionId);
  const entry = id ? store.get(id) : undefined;
  if (!entry?.pinned) return undefined;

  let calc: Calculation | null = null;
  try {
    calc = evaluate(entry.query);
  } catch (error) {
    console.error(
      `[calculator-history] re-evaluating "${entry.query}" threw:`,
      error,
    );
  }
  if (!calc) return entry.value;

  store.updateResult(entry.id, calc.value, calc.rawValue);
  return calc.value;
}
