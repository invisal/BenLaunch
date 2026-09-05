/**
 * Persisted user settings — today just per-command Window Management shortcut
 * overrides, laid out so more settings can join `SettingsFile` later without a
 * migration (a missing key just falls back to its default).
 *
 * Deliberately Electron-free (mirrors `usage/store.ts`): the `userData` directory
 * is injected by the caller, so `node --test` can exercise it against a temp dir.
 * Advisory, like the usage store — every filesystem failure is swallowed with a
 * `[settings]` prefix and leaves the in-memory state intact.
 */
import { readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** Bumped when the persisted shape changes, to invalidate old files. */
const SETTINGS_VERSION = 1

/** Default "preferred gap" (px) a custom layout's `useGap` inserts around it, absent a saved override. */
const DEFAULT_GAP_PX = 8

interface SettingsFile {
  version: number
  savedAt: number
  /** actionId ("win:left-half") -> accelerator, or `null` when the user disabled it. */
  windowShortcuts: Record<string, string | null>
  /**
   * The user's preferred gap (px), for a custom layout's "Use preferred gap
   * settings" toggle. Optional so a `SETTINGS_VERSION` 1 file saved before this
   * existed still validates — a missing value just falls back to `DEFAULT_GAP_PX`.
   */
  gapPx?: number
}

/** In-memory state — unlike `SettingsFile`, `gapPx` is always populated (defaulted on load). */
interface State {
  windowShortcuts: Record<string, string | null>
  gapPx: number
}

function emptyState(): State {
  return { windowShortcuts: {}, gapPx: DEFAULT_GAP_PX }
}

function isShortcutMap(value: unknown): value is Record<string, string | null> {
  return (
    !!value &&
    typeof value === 'object' &&
    Object.values(value).every((entry) => entry === null || typeof entry === 'string')
  )
}

function isSettingsFile(value: unknown): value is SettingsFile {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<SettingsFile>
  if (candidate.version !== SETTINGS_VERSION) return false
  if (!candidate.windowShortcuts || !isShortcutMap(candidate.windowShortcuts)) return false
  return candidate.gapPx === undefined || typeof candidate.gapPx === 'number'
}

export class SettingsStore {
  private readonly dir: string
  private state = emptyState()
  private loaded = false

  constructor(opts: { dir: string }) {
    this.dir = opts.dir
  }

  /** Load `settings.json` into memory. Corrupt / missing / old-version -> empty state. */
  init(): void {
    if (this.loaded) return
    this.loaded = true
    try {
      const parsed: unknown = JSON.parse(readFileSync(this.path(), 'utf8'))
      if (isSettingsFile(parsed)) {
        this.state = { windowShortcuts: parsed.windowShortcuts, gapPx: parsed.gapPx ?? DEFAULT_GAP_PX }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('[settings] Failed to read store:', error)
      }
    }
  }

  /**
   * The accelerator to use for `actionId`: the user's override if one was ever
   * set (including an explicit `null` — "user disabled this shortcut"), else
   * `platformDefault`.
   */
  getWindowShortcut(actionId: string, platformDefault: string): string | null {
    this.init()
    return actionId in this.state.windowShortcuts
      ? this.state.windowShortcuts[actionId]
      : platformDefault
  }

  /** `getWindowShortcut` for every id in `defaults`, keyed the same way. */
  getWindowShortcuts(defaults: Record<string, string>): Record<string, string | null> {
    this.init()
    const out: Record<string, string | null> = {}
    for (const [id, platformDefault] of Object.entries(defaults)) {
      out[id] = this.getWindowShortcut(id, platformDefault)
    }
    return out
  }

  /** Overrides `actionId`'s accelerator; `null` disables it. Persists immediately. */
  setWindowShortcut(actionId: string, accelerator: string | null): void {
    this.init()
    this.state.windowShortcuts[actionId] = accelerator
    this.persist()
  }

  /** The user's preferred gap (px) for a custom layout's "Use preferred gap settings" toggle. */
  getGapSize(): number {
    this.init()
    return this.state.gapPx
  }

  /** Persists immediately. */
  setGapSize(px: number): void {
    this.init()
    this.state.gapPx = Math.max(0, px)
    this.persist()
  }

  private path(): string {
    return join(this.dir, 'settings.json')
  }

  /** Atomic temp-write + rename, mirroring `usage/store.ts`. */
  private persist(): void {
    const file = this.path()
    const tmp = `${file}.tmp`
    const payload: SettingsFile = {
      version: SETTINGS_VERSION,
      savedAt: Date.now(),
      windowShortcuts: this.state.windowShortcuts,
      gapPx: this.state.gapPx
    }
    try {
      writeFileSync(tmp, JSON.stringify(payload))
      renameSync(tmp, file)
    } catch (error) {
      console.error('[settings] Failed to write store:', error)
      try {
        unlinkSync(tmp)
      } catch {
        /* nothing to clean up */
      }
    }
  }
}
