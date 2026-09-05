import { app } from "electron";
import type {
  QueryResult,
  RequestSubtitleOptions,
  WindowShortcutInfo,
} from "../shared/types";
import { evaluate } from "./calculator";
import { fuzzyMatch } from "./search";
import { SettingsStore } from "./settings/store";
import type { ActionSource } from "./sources/base";
import { InstalledAppSource } from "./sources/apps/source";
import { BuiltinCommandSource } from "./sources/builtin/source";
import { WindowManagementSource } from "./sources/window/source";
import { CustomLayoutStore } from "./sources/window/custom-store";
import { ExchangeRateSource } from "./sources/calculator/exchange-rate/source.ts";
import { QuickValueRunner } from "./sources/quickvalue/runner";
import { QuickValueSource } from "./sources/quickvalue/source";
import { QuickValueStore } from "./sources/quickvalue/store";
import { Usage } from "./usage/store";

/** Persisted user settings (today: Window Management shortcut overrides). Also read directly by `index.ts` to register global shortcuts. */
export const settings = new SettingsStore({ dir: app.getPath("userData") });

/** Persisted custom window layouts ("Create Command"). Also read directly by `index.ts` to wire the manager window's IPC. */
export const customLayoutStore = new CustomLayoutStore({ dir: app.getPath("userData") });
/** Held separately (not just in `sources`) so `getWindowShortcuts` can read its action list for the Settings screen. */
const windowSource = new WindowManagementSource(settings, customLayoutStore);
/** Persisted QuickValue definitions + the cache of their last computed values. */
export const quickValueStore = new QuickValueStore({
  dir: app.getPath("userData"),
});
export const quickValueRunner = new QuickValueRunner({
  dir: app.getPath("userData"),
});

/**
 * Registry of action sources. Order matters: `query` keeps it, and the
 * stable sort below preserves it among equally-scored results (so built-in
 * commands rank ahead of applications on a tie).
 */
const sources: ActionSource[] = [
  new BuiltinCommandSource(),
  windowSource,
  new QuickValueSource(quickValueStore, quickValueRunner),
  new InstalledAppSource(),
  new ExchangeRateSource(),
];

/** Personalized ranking signal — records what the user picks, boosts it next time. */
const usage = new Usage({ dir: app.getPath("userData") });

/** Warm every source at startup (called from app `whenReady`). */
export function initActionSources(): void {
  usage.init();
  settings.init();
  customLayoutStore.init();
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
    // Order the suggestion list by how recently/often each action has been used;
    // the stable sort keeps registry order among the (many) unused ones.
    const scores = usage.scores();
    const result = definitions
      .map((definition) => definition.action)
      .sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0));
    return { result };
  }

  const result = definitions
    .map((definition) => {
      const match = fuzzyMatch(trimmed, definition.action.title);
      const score = match.score + usage.boost(definition.action.id, trimmed);
      return { action: definition.action, matched: match.match, score };
    })
    .filter((entry) => entry.matched)
    // Best score first; `sort` is stable, so equal scores keep registry order.
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.action);

  const calculation = evaluate(trimmed);
  return calculation ? { result, calculation } : { result };
}

export async function executeAction(id: string, text: string): Promise<void> {
  await sources.find((source) => source.owns(id))?.execute(id);
  // `qv:edit:*` is a UI shortcut (open the editor), not a real action to rank.
  if (!id.startsWith("qv:edit:")) usage.record(id, text);
}

/** A deferred-subtitle row rendered in the launcher; ask whichever source owns it for a fresh subtitle. */
export async function requestSubtitle(
  id: string,
  opts?: RequestSubtitleOptions,
): Promise<string | undefined> {
  return await sources
    .find((source) => source.owns(id))
    ?.requestSubtitle?.(id, opts);
}

/** Window Management commands' id/title/shortcut, for the Settings screen. */
export function getWindowShortcuts(): WindowShortcutInfo[] {
  return windowSource.provide().map((definition) => ({
    id: definition.action.id,
    title: definition.action.title,
    shortcut: definition.action.shortcut,
  }));
}
