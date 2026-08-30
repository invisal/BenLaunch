import { app } from "electron";
import type { QueryResult } from "../shared/types";
import { evaluate } from "./calculator";
import { fuzzyMatch } from "./search";
import type { ActionSource } from "./sources/base";
import { InstalledAppSource } from "./sources/apps/source";
import { BuiltinCommandSource } from "./sources/builtin/source";
import { WindowManagementSource } from "./sources/window/source";
import { Usage } from "./usage/store";

/**
 * Registry of action sources. Order matters: `query` keeps it, and the
 * stable sort below preserves it among equally-scored results (so built-in
 * commands rank ahead of applications on a tie).
 */
const sources: ActionSource[] = [
  new BuiltinCommandSource(),
  new WindowManagementSource(),
  new InstalledAppSource(),
];

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
  const lists = await Promise.all(sources.map((source) => source.provide(text)));
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
  usage.record(id, text);
}
