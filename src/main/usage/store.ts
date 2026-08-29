/**
 * Persisted frecency store that personalizes launcher ranking. Two signals are
 * tracked per action:
 *
 *  - `global` (actionId → {count, lastUsedAt}) — a time-decayed frecency that
 *    orders the empty-query suggestion list. Half-life: 10 days.
 *  - `byQuery` (normalized query → actionId → score) — a small, self-pruning
 *    reinforcement signal that boosts the action a user habitually picks for a
 *    given query. Each pick adds `FIRST_CLICK_SCORE` to the winner (capped at
 *    `MAX_SCORE`) and multiplies every rival for that query by `DECAY`; once a
 *    rival falls below `PRUNE_BELOW` it is dropped. There is no time component —
 *    the list only moves when the user picks something for that query.
 *
 * The `byQuery` score is the search boost verbatim; the `global` signal only
 * feeds the empty-query list, so a typed query ranks on fuzzy relevance plus
 * this learned nudge and nothing else.
 *
 * The store is deliberately Electron-free (the `node --test` suite imports it
 * directly): the `userData` directory is injected by `actions.ts`. Like the app
 * and icon caches it is advisory — every filesystem failure is swallowed with a
 * `[usage]` prefix and leaves the in-memory state intact.
 */
import { readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Bumped when the persisted shape changes, to invalidate old files. */
const CACHE_VERSION = 2;

const HALF_LIFE_MS = 10 * 24 * 60 * 60 * 1000;

/** Score added to the picked action's per-query entry on every click. */
const FIRST_CLICK_SCORE = 0.2;
/** Ceiling on a per-query score, so a habit can't grow without bound. */
const MAX_SCORE = 1;
/** Factor applied to every *unpicked* rival for a query on each click. */
const DECAY = 0.9;
/** A per-query score below this is dropped from the list. */
const PRUNE_BELOW = 0.1;

interface Stat {
  count: number;
  /** Epoch milliseconds of the most recent use. */
  lastUsedAt: number;
}

interface UsageFile {
  version: number;
  savedAt: number;
  global: Record<string, Stat>;
  byQuery: Record<string, Record<string, number>>;
}

function emptyState(): Pick<UsageFile, "global" | "byQuery"> {
  return { global: {}, byQuery: {} };
}

function isStat(value: unknown): value is Stat {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Stat>;
  return (
    typeof candidate.count === "number" &&
    typeof candidate.lastUsedAt === "number"
  );
}

function isStatMap(value: unknown): value is Record<string, Stat> {
  return (
    !!value &&
    typeof value === "object" &&
    Object.values(value).every((entry) => isStat(entry))
  );
}

function isScoreMap(value: unknown): value is Record<string, number> {
  return (
    !!value &&
    typeof value === "object" &&
    Object.values(value).every((entry) => typeof entry === "number")
  );
}

function isUsageFile(value: unknown): value is UsageFile {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<UsageFile>;
  if (candidate.version !== CACHE_VERSION) return false;
  if (!candidate.global || !isStatMap(candidate.global)) return false;
  if (!candidate.byQuery || typeof candidate.byQuery !== "object") return false;
  return Object.values(candidate.byQuery).every((entry) => isScoreMap(entry));
}

/** `query` reduced to the key both `record` and `boost` agree on. */
function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

export class Usage {
  private readonly dir: string;
  private readonly now: () => number;

  private state = emptyState();
  private loaded = false;

  constructor(opts: { dir: string; now?: () => number }) {
    this.dir = opts.dir;
    this.now = opts.now ?? Date.now;
  }

  /** Load `usage.json` into memory. Corrupt / missing / old-version → empty state. */
  init(): void {
    if (this.loaded) return;
    this.loaded = true;
    console.log("[usage] store file:", this.path());
    try {
      const parsed: unknown = JSON.parse(readFileSync(this.path(), "utf8"));
      if (isUsageFile(parsed)) {
        this.state = { global: parsed.global, byQuery: parsed.byQuery };
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error("[usage] Failed to read store:", error);
      }
    }
  }

  /** Record that `actionId` was executed from `query`; updates both signals and persists. */
  record(actionId: string, query: string): void {
    this.init();
    bump(this.state.global, actionId, this.now());

    const key = normalizeQuery(query);
    if (key) {
      this.reinforce(key, actionId);
    }

    this.persist();
  }

  /**
   * Reward `actionId` for `key`: it gains `FIRST_CLICK_SCORE` (capped at
   * `MAX_SCORE`) while every other action for `key` decays by `DECAY`, and any
   * that drops below `PRUNE_BELOW` is removed.
   */
  private reinforce(key: string, actionId: string): void {
    const list = (this.state.byQuery[key] ??= {});
    const previous = list[actionId] ?? 0;

    for (const id of Object.keys(list)) {
      if (id === actionId) continue;
      const decayed = list[id] * DECAY;
      if (decayed < PRUNE_BELOW) delete list[id];
      else list[id] = decayed;
    }

    list[actionId] = Math.min(MAX_SCORE, previous + FIRST_CLICK_SCORE);
  }

  /** Ranking boost for a search hit on `actionId` typed as `query`. 0 when unseen. */
  boost(actionId: string, query: string): number {
    this.init();

    // The empty query is ranked by the suggestion list, not fuzzy score, so it
    // borrows the global count; a typed query rides on fuzzy relevance plus the
    // learned per-query nudge only.
    if (query === "") {
      return this.state.global[actionId]?.count ?? 0;
    }

    return this.state.byQuery[normalizeQuery(query)]?.[actionId] ?? 0;
  }

  /** actionId → decayed global frecency, for ordering the empty-query suggestion list. */
  scores(): Map<string, number> {
    this.init();
    const now = this.now();
    const out = new Map<string, number>();
    for (const [id, stat] of Object.entries(this.state.global)) {
      out.set(id, frecency(stat, now));
    }
    return out;
  }

  private path(): string {
    return join(this.dir, "usage.json");
  }

  /** Atomic temp-write + rename, mirroring `sources/apps/cache.ts`. */
  private persist(): void {
    const file = this.path();
    const tmp = `${file}.tmp`;
    const payload: UsageFile = {
      version: CACHE_VERSION,
      savedAt: this.now(),
      global: this.state.global,
      byQuery: this.state.byQuery,
    };
    try {
      writeFileSync(tmp, JSON.stringify(payload));
      renameSync(tmp, file);
    } catch (error) {
      console.error("[usage] Failed to write store:", error);
      try {
        unlinkSync(tmp);
      } catch {
        /* nothing to clean up */
      }
    }
  }
}

function bump(map: Record<string, Stat>, id: string, at: number): void {
  const stat = (map[id] ??= { count: 0, lastUsedAt: at });
  stat.count += 1;
  stat.lastUsedAt = at;
}

/** `count`, discounted by how many half-lives have passed since `lastUsedAt`. */
function frecency(stat: Stat | undefined, now: number): number {
  if (!stat) return 0;
  return stat.count * 2 ** (-(now - stat.lastUsedAt) / HALF_LIFE_MS);
}
