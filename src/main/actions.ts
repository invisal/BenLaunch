import { app } from "electron";
import type { QueryResult, QuickValueUpdate } from "../shared/types";
import type {
  Quicklink,
  QuicklinkCreateResult,
  QuicklinkDraft,
} from "../shared/quicklink";
import { evaluate } from "./calculator";
import { matchAction } from "./search";
import type { ActionSource } from "./sources/base";
import { InstalledAppSource } from "./sources/apps/source";
import { BuiltinCommandSource } from "./sources/builtin/source";
import { QuicklinkSource } from "./sources/quicklinks/source";
import { WindowManagementSource } from "./sources/window/source";
import { ExchangeRateSource } from "./sources/calculator/exchange-rate/source.ts";
import { QuickValueRunner } from "./sources/quickvalue/runner";
import { QuickValueSource } from "./sources/quickvalue/source";
import { QuickValueStore } from "./sources/quickvalue/store";
import { Usage } from "./usage/store";

/** Set by `subscribeQuickValueUpdates` once the launcher window exists. */
let quickValueUpdateListener: ((update: QuickValueUpdate) => void) | null =
  null;

/** Persisted QuickValue definitions + the cache of their last computed values. */
export const quickValueStore = new QuickValueStore({
  dir: app.getPath("userData"),
});
export const quickValueRunner = new QuickValueRunner({
  dir: app.getPath("userData"),
  onUpdate: (update) => quickValueUpdateListener?.(update),
});

/** Forward exposed-QuickValue value changes to the launcher window. */
export function subscribeQuickValueUpdates(
  listener: (update: QuickValueUpdate) => void,
): void {
  quickValueUpdateListener = listener;
}

/**
 * Registry of action sources. Order matters: `query` keeps it, and the
 * stable sort below preserves it among equally-scored results (so built-in
 * commands rank ahead of applications on a tie).
 */
const quicklinkSource = new QuicklinkSource();

const sources: ActionSource[] = [
  new BuiltinCommandSource(),
  new WindowManagementSource(),
  new QuickValueSource(quickValueStore, quickValueRunner),
  quicklinkSource,
  new InstalledAppSource(),
  new ExchangeRateSource(),
];

/** Persist a quicklink from the renderer's Create form. */
export function createQuicklink(draft: QuicklinkDraft): QuicklinkCreateResult {
  return quicklinkSource.create(draft);
}

/** Apply the renderer's Edit form to an existing quicklink. */
export function updateQuicklink(
  id: string,
  draft: QuicklinkDraft,
): QuicklinkCreateResult {
  return quicklinkSource.update(id, draft);
}

/** The quicklink `id`, for the renderer's Edit / Duplicate form. */
export function getQuicklink(id: string): Quicklink | undefined {
  return quicklinkSource.get(id);
}

/** Delete the quicklink `id`. */
export function deleteQuicklink(id: string): void {
  quicklinkSource.remove(id);
}

/** Pin or unpin the quicklink `id`. */
export function setQuicklinkPinned(id: string, pinned: boolean): void {
  quicklinkSource.setPinned(id, pinned);
}

/** Hide the quicklink `id` from the root list, or reveal it. */
export function setQuicklinkHidden(id: string, hidden: boolean): void {
  quicklinkSource.setHidden(id, hidden);
}

/** Open the quicklink `id` now with a specific app ("" = the system default). */
export async function openQuicklinkWith(
  id: string,
  text: string,
  appPath: string,
): Promise<void> {
  await quicklinkSource.execute(id, text, appPath);
  usage.record(id, text);
}

/** Personalized ranking signal — records what the user picks, boosts it next time. */
const usage = new Usage({ dir: app.getPath("userData") });

/** Warm every source at startup (called from app `whenReady`). */
export function initActionSources(): void {
  usage.init();
  for (const source of sources) source.init?.();
}

/** Refresh every source (called when the launcher window is shown; sources throttle). */
export function refreshActionSources(): void {
  for (const source of sources) source.refresh?.();
}

export async function query(text: string): Promise<QueryResult> {
  const lists = await Promise.all(
    sources.map((source) => source.provide(text)),
  );
  const definitions = lists.flat();

  const trimmed = text.trim();
  if (!trimmed) {
    // The root list: pinned actions first, then by how recently/often each has
    // been used; the stable sort keeps registry order among the (many) ties.
    // Actions flagged "Hide in Root Search" are dropped here but still returned
    // for an explicit query below.
    const scores = usage.scores();
    const result = definitions
      .map((definition) => definition.action)
      .filter((action) => !action.hidden)
      .sort((a, b) => {
        const pinDelta = (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
        if (pinDelta) return pinDelta;
        return (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0);
      });
    return { result };
  }

  const result = definitions
    .map((definition) => {
      const { action } = definition;
      const match = matchAction(trimmed, action);
      const score = match.score + usage.boost(action.id, trimmed);
      return { action, matched: match.match, score };
    })
    .filter((entry) => entry.matched)
    // Best score first; `sort` is stable, so equal scores keep registry order.
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.action);

  const calculation = evaluate(trimmed);
  return calculation ? { result, calculation } : { result };
}

export async function executeAction(id: string, text: string): Promise<void> {
  await sources.find((source) => source.owns(id))?.execute(id, text);
  // `qv:edit:*` is a UI shortcut (open the editor), not a real action to rank.
  if (!id.startsWith("qv:edit:")) usage.record(id, text);
}
