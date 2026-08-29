/**
 * Persisted frecency store that personalizes launcher ranking. Two signals are
 * tracked per action:
 *
 *  - `global` (actionId → {count, lastUsedAt}) — orders the empty-query
 *    suggestion list and acts as a weak tie-break on search.
 *  - `byQuery` (normalized query → actionId → …) — a strong boost that pins the
 *    action a user habitually picks for a given query.
 *
 * Both signals decay with a 10-day half-life so stale habits fade.
 *
 * The store is deliberately Electron-free (the `node --test` suite imports it
 * directly): the `userData` directory is injected by `actions.ts`. Like the app
 * and icon caches it is advisory — every filesystem failure is swallowed with a
 * `[usage]` prefix and leaves the in-memory state intact.
 */
import { readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** Bumped when the persisted shape changes, to invalidate old files. */
const CACHE_VERSION = 1

const HALF_LIFE_MS = 10 * 24 * 60 * 60 * 1000
/** Weight on the per-query signal — strong enough to pin a habitual pick. */
const QUERY_BOOST = 100
/** Weight on the global signal — a gentle nudge / tie-break on search. */
const GLOBAL_BOOST = 4

interface Stat {
  count: number
  /** Epoch milliseconds of the most recent use. */
  lastUsedAt: number
}

interface UsageFile {
  version: number
  savedAt: number
  global: Record<string, Stat>
  byQuery: Record<string, Record<string, Stat>>
}

function emptyState(): Pick<UsageFile, 'global' | 'byQuery'> {
  return { global: {}, byQuery: {} }
}

function isStat(value: unknown): value is Stat {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<Stat>
  return typeof candidate.count === 'number' && typeof candidate.lastUsedAt === 'number'
}

function isStatMap(value: unknown): value is Record<string, Stat> {
  return (
    !!value && typeof value === 'object' && Object.values(value).every((entry) => isStat(entry))
  )
}

function isUsageFile(value: unknown): value is UsageFile {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<UsageFile>
  if (candidate.version !== CACHE_VERSION) return false
  if (!candidate.global || !isStatMap(candidate.global)) return false
  if (!candidate.byQuery || typeof candidate.byQuery !== 'object') return false
  return Object.values(candidate.byQuery).every((entry) => isStatMap(entry))
}

/** `query` reduced to the key both `record` and `boost` agree on. */
function normalizeQuery(query: string): string {
  return query.trim().toLowerCase()
}

export class Usage {
  private readonly dir: string
  private readonly now: () => number

  private state = emptyState()
  private loaded = false

  constructor(opts: { dir: string; now?: () => number }) {
    this.dir = opts.dir
    this.now = opts.now ?? Date.now
  }

  /** Load `usage.json` into memory. Corrupt / missing / old-version → empty state. */
  init(): void {
    if (this.loaded) return
    this.loaded = true
    try {
      const parsed: unknown = JSON.parse(readFileSync(this.path(), 'utf8'))
      if (isUsageFile(parsed)) {
        this.state = { global: parsed.global, byQuery: parsed.byQuery }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('[usage] Failed to read store:', error)
      }
    }
  }

  /** Record that `actionId` was executed from `query`; bumps both signals and persists. */
  record(actionId: string, query: string): void {
    this.init()
    const at = this.now()
    bump(this.state.global, actionId, at)

    const key = normalizeQuery(query)
    if (key) {
      const perQuery = (this.state.byQuery[key] ??= {})
      bump(perQuery, actionId, at)
    }

    this.persist()
  }

  /** Additive ranking boost for a search hit on `actionId` typed as `query`. 0 when unseen. */
  boost(actionId: string, query: string): number {
    this.init()
    const now = this.now()
    const perQuery = this.state.byQuery[normalizeQuery(query)]?.[actionId]
    const global = this.state.global[actionId]
    return QUERY_BOOST * frecency(perQuery, now) + GLOBAL_BOOST * frecency(global, now)
  }

  /** actionId → decayed global frecency, for ordering the empty-query suggestion list. */
  scores(): Map<string, number> {
    this.init()
    const now = this.now()
    const out = new Map<string, number>()
    for (const [id, stat] of Object.entries(this.state.global)) {
      out.set(id, frecency(stat, now))
    }
    return out
  }

  private path(): string {
    return join(this.dir, 'usage.json')
  }

  /** Atomic temp-write + rename, mirroring `sources/apps/cache.ts`. */
  private persist(): void {
    const file = this.path()
    const tmp = `${file}.tmp`
    const payload: UsageFile = {
      version: CACHE_VERSION,
      savedAt: this.now(),
      global: this.state.global,
      byQuery: this.state.byQuery
    }
    try {
      writeFileSync(tmp, JSON.stringify(payload))
      renameSync(tmp, file)
    } catch (error) {
      console.error('[usage] Failed to write store:', error)
      try {
        unlinkSync(tmp)
      } catch {
        /* nothing to clean up */
      }
    }
  }
}

function bump(map: Record<string, Stat>, id: string, at: number): void {
  const stat = (map[id] ??= { count: 0, lastUsedAt: at })
  stat.count += 1
  stat.lastUsedAt = at
}

/** `count`, discounted by how many half-lives have passed since `lastUsedAt`. */
function frecency(stat: Stat | undefined, now: number): number {
  if (!stat) return 0
  return stat.count * 2 ** (-(now - stat.lastUsedAt) / HALF_LIFE_MS)
}
