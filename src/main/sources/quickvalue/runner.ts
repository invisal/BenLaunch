/**
 * Runs exposed QuickValues and caches their last value on disk, so the launcher
 * can show a value the instant it opens and refresh it in the background —
 * mirroring the app-list stale-then-refresh behaviour.
 *
 * The value cache (`quickvalue-values.json`) uses the same atomic temp-write +
 * rename as `usage/store.ts`. The actual code execution happens in `./worker.ts`
 * (bundled as `quickvalue-worker.js`), spawned per run; `runCode` is injectable
 * so the `node --test` suite can drive the runner without a build.
 */
import { spawn } from 'node:child_process'
import { readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { QuickValueTestResult, QuickValueUpdate } from '../../../shared/types'
import type { UserCodeResult } from './run-user-code'

/** Bumped when the persisted shape changes, to invalidate old files. */
const CACHE_VERSION = 1

/** How long a cached value is considered fresh enough to skip a background re-run. */
export const DEFAULT_TTL_MS = 60_000

/** In-worker timeout for a single run (kept in sync with run-user-code's default). */
const RUN_TIMEOUT_MS = 10_000

/** Hard wall-clock kill for the worker process, a bit above the in-worker timeout. */
const HARD_KILL_MS = RUN_TIMEOUT_MS + 3_000

type ValueState = 'ready' | 'error'

interface CachedValue {
  value: string | number | null
  state: ValueState
  error?: string
  fetchedAt: number
}

interface CacheFile {
  version: number
  savedAt: number
  values: Record<string, CachedValue>
}

type RunCode = (code: string, timeoutMs: number) => Promise<UserCodeResult>

function isCachedValue(value: unknown): value is CachedValue {
  if (!value || typeof value !== 'object') return false
  const c = value as Partial<CachedValue>
  const v = c.value
  const validValue = v === null || typeof v === 'string' || typeof v === 'number'
  return validValue && (c.state === 'ready' || c.state === 'error') && typeof c.fetchedAt === 'number'
}

function isCacheFile(value: unknown): value is CacheFile {
  if (!value || typeof value !== 'object') return false
  const c = value as Partial<CacheFile>
  if (c.version !== CACHE_VERSION || !c.values || typeof c.values !== 'object') return false
  return Object.values(c.values).every(isCachedValue)
}

export class QuickValueRunner {
  private readonly dir: string
  private readonly onUpdate: (u: QuickValueUpdate) => void
  private readonly runCode: RunCode
  private readonly now: () => number

  private values: Record<string, CachedValue> = {}
  private loaded = false
  private readonly inFlight = new Map<string, Promise<void>>()

  constructor(opts: {
    dir: string
    onUpdate: (u: QuickValueUpdate) => void
    runCode?: RunCode
    now?: () => number
  }) {
    this.dir = opts.dir
    this.onUpdate = opts.onUpdate
    this.runCode = opts.runCode ?? spawnWorker
    this.now = opts.now ?? Date.now
  }

  init(): void {
    if (this.loaded) return
    this.loaded = true
    console.log('[quickvalue] value cache:', this.path())
    try {
      const parsed: unknown = JSON.parse(readFileSync(this.path(), 'utf8'))
      if (isCacheFile(parsed)) this.values = parsed.values
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('[quickvalue] Failed to read value cache:', error)
      }
    }
  }

  /** Launcher-row subtitle for `id`. `''` when it has never produced a value. */
  getSubtitle(id: string): string {
    this.init()
    const cached = this.values[id]
    if (!cached) return ''
    if (cached.state === 'error' && cached.value === null) {
      return `⚠ ${cached.error ?? 'error'}`
    }
    return formatValue(cached.value)
  }

  isLoading(id: string): boolean {
    return this.inFlight.has(id)
  }

  /**
   * Re-run `id` unless a run is already in flight or its value is still fresh.
   * Resolves once settled either way, so a caller can await "is this up to date
   * now" — a no-op call resolves immediately.
   */
  refreshIfStale(id: string, code: string, ttlMs: number = DEFAULT_TTL_MS): Promise<void> {
    this.init()
    const existing = this.inFlight.get(id)
    if (existing) {
      console.log(`[quickvalue] ${id}: skip run — already in flight`)
      return existing
    }
    const cached = this.values[id]
    if (cached) {
      const age = this.now() - cached.fetchedAt
      if (age < ttlMs) {
        console.log(`[quickvalue] ${id}: skip run — cache fresh (age ${age}ms, ttl ${ttlMs}ms)`)
        return Promise.resolve()
      }
      console.log(`[quickvalue] ${id}: cache stale (age ${age}ms, ttl ${ttlMs}ms) — running`)
    } else {
      console.log(`[quickvalue] ${id}: no cache — running`)
    }
    return this.run(id, code)
  }

  /** Force a run now. Single-flight per `id`: concurrent callers share one run. */
  run(id: string, code: string): Promise<void> {
    this.init()
    const existing = this.inFlight.get(id)
    if (existing) return existing

    this.onUpdate({ id, subtitle: this.getSubtitle(id), isLoading: true })

    console.log(`[quickvalue] ${id}: executing code`)
    const startedAt = this.now()
    const task = this.runCode(code, RUN_TIMEOUT_MS)
      .then((result) => this.store(id, result))
      .catch((error) => this.store(id, { ok: false, error: toMessage(error) }))
      .finally(() => {
        this.inFlight.delete(id)
        console.log(`[quickvalue] ${id}: execution finished in ${this.now() - startedAt}ms`)
        this.onUpdate({ id, subtitle: this.getSubtitle(id), isLoading: false })
      })

    this.inFlight.set(id, task)
    return task
  }

  /** One-shot run with no caching, for the editor's "Test" button. */
  async runOnce(code: string): Promise<QuickValueTestResult> {
    try {
      const result = await this.runCode(code, RUN_TIMEOUT_MS)
      return result.ok ? { ok: true, value: result.value } : { ok: false, error: result.error }
    } catch (error) {
      return { ok: false, error: toMessage(error) }
    }
  }

  /** Drop cached values whose QuickValue no longer exists / is no longer exposed. */
  prune(keepIds: Iterable<string>): void {
    this.init()
    const keep = new Set(keepIds)
    let changed = false
    for (const id of Object.keys(this.values)) {
      if (!keep.has(id)) {
        delete this.values[id]
        changed = true
      }
    }
    if (changed) this.persist()
  }

  private store(id: string, result: UserCodeResult): void {
    if (result.ok) {
      this.values[id] = { value: result.value, state: 'ready', fetchedAt: this.now() }
    } else {
      // Keep the last known value on failure — a stale number beats a blank row.
      this.values[id] = {
        value: this.values[id]?.value ?? null,
        state: 'error',
        error: result.error,
        fetchedAt: this.now()
      }
    }
    this.persist()
  }

  private path(): string {
    return join(this.dir, 'quickvalue-values.json')
  }

  private persist(): void {
    const file = this.path()
    const tmp = `${file}.tmp`
    const payload: CacheFile = { version: CACHE_VERSION, savedAt: this.now(), values: this.values }
    try {
      writeFileSync(tmp, JSON.stringify(payload))
      renameSync(tmp, file)
    } catch (error) {
      console.error('[quickvalue] Failed to write value cache:', error)
      try {
        unlinkSync(tmp)
      } catch {
        /* nothing to clean up */
      }
    }
  }
}

function formatValue(value: string | number | null): string {
  if (value === null) return '—'
  return typeof value === 'number' ? value.toLocaleString('en-US') : value
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Default `runCode`: spawn the worker, pipe the code in, parse its JSON out. */
function spawnWorker(code: string, timeoutMs: number): Promise<UserCodeResult> {
  return new Promise((resolve) => {
    const workerPath = join(__dirname, 'quickvalue-worker.js')
    const child = spawn(process.execPath, [workerPath], {
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        // `stripTypeScriptTypes` (used in run-user-code) is still experimental and
        // prints a warning to stderr on first use; keep the worker's stderr clean.
        NODE_OPTIONS: [process.env.NODE_OPTIONS, '--disable-warning=ExperimentalWarning']
          .filter(Boolean)
          .join(' ')
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    })

    let stdout = ''
    let stderr = ''
    let settled = false
    const finish = (result: UserCodeResult): void => {
      if (settled) return
      settled = true
      clearTimeout(killTimer)
      resolve(result)
    }

    const killTimer = setTimeout(() => {
      child.kill('SIGKILL')
      finish({ ok: false, error: `QuickValue worker killed after ${HARD_KILL_MS}ms` })
    }, HARD_KILL_MS)

    child.stdout.on('data', (chunk) => (stdout += chunk))
    child.stderr.on('data', (chunk) => (stderr += chunk))
    child.on('error', (error) => finish({ ok: false, error: error.message }))
    child.on('close', () => {
      try {
        finish(JSON.parse(stdout) as UserCodeResult)
      } catch {
        finish({ ok: false, error: stderr.trim() || 'QuickValue worker produced no output' })
      }
    })

    child.stdin.write(JSON.stringify({ code, timeoutMs }))
    child.stdin.end()
  })
}
