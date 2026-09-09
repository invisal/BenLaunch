/**
 * Persisted list of user-authored Widget definitions (name + code + whether
 * it's exposed as a launcher command). The values those functions produce are
 * *not* here — that's the runner's cache (see `runner.ts`).
 *
 * Mirrors `usage/store.ts`: deliberately Electron-free (the `node --test` suite
 * imports it directly, `dir` is injected by `actions.ts`), a single JSON file
 * written via temp-file + atomic rename, and every filesystem failure swallowed
 * with a `[widget]` prefix so a bad disk never takes the launcher down.
 */
import { readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { WidgetDef, WidgetDraft } from '../shared/types'

/** Bumped when the persisted shape changes, to invalidate old files. */
const CACHE_VERSION = 1

interface StoreFile {
  version: number
  savedAt: number
  items: WidgetDef[]
}

function isWidgetDef(value: unknown): value is WidgetDef {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<WidgetDef>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    (candidate.description === undefined || typeof candidate.description === 'string') &&
    typeof candidate.code === 'string' &&
    typeof candidate.exposed === 'boolean'
  )
}

function isStoreFile(value: unknown): value is StoreFile {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<StoreFile>
  if (candidate.version !== CACHE_VERSION) return false
  return Array.isArray(candidate.items) && candidate.items.every(isWidgetDef)
}

/** `name` → url-safe slug. Empty / all-punctuation names fall back to `widget`. */
function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'widget'
}

export class WidgetStore {
  private readonly dir: string
  private readonly now: () => number

  private items: WidgetDef[] = []
  private loaded = false

  constructor(opts: { dir: string; now?: () => number }) {
    this.dir = opts.dir
    this.now = opts.now ?? Date.now
  }

  /** Load `widgets.json` into memory. Corrupt / missing / old version → empty list. */
  init(): void {
    if (this.loaded) return
    this.loaded = true
    console.log('[widget] store file:', this.path())
    try {
      const parsed: unknown = JSON.parse(readFileSync(this.path(), 'utf8'))
      if (isStoreFile(parsed)) this.items = parsed.items
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('[widget] Failed to read store:', error)
      }
    }
  }

  list(): WidgetDef[] {
    this.init()
    return this.items.map((item) => ({ ...item }))
  }

  get(id: string): WidgetDef | undefined {
    this.init()
    const found = this.items.find((item) => item.id === id)
    return found ? { ...found } : undefined
  }

  /**
   * Create (no `id`) or update (`id` present) a Widget and persist. Returns
   * the saved definition, including the generated id on create.
   */
  save(draft: WidgetDraft): WidgetDef {
    this.init()

    const description = draft.description?.trim() || undefined

    if (draft.id) {
      const existing = this.items.find((item) => item.id === draft.id)
      if (existing) {
        existing.name = draft.name
        existing.description = description
        // An update that omits `code` leaves the stored code alone (the metadata
        // screen and the code window save independently — see WidgetDraft).
        if (draft.code !== undefined) existing.code = draft.code
        existing.exposed = draft.exposed
        this.persist()
        return { ...existing }
      }
    }

    const def: WidgetDef = {
      id: this.uniqueId(slugify(draft.name)),
      name: draft.name,
      description,
      code: draft.code ?? '',
      exposed: draft.exposed
    }
    this.items.push(def)
    this.persist()
    return { ...def }
  }

  remove(id: string): void {
    this.init()
    const next = this.items.filter((item) => item.id !== id)
    if (next.length === this.items.length) return
    this.items = next
    this.persist()
  }

  setExposed(id: string, exposed: boolean): void {
    this.init()
    const item = this.items.find((entry) => entry.id === id)
    if (!item || item.exposed === exposed) return
    item.exposed = exposed
    this.persist()
  }

  /** `base`, or `base-2`, `base-3`, … if taken. */
  private uniqueId(base: string): string {
    if (!this.items.some((item) => item.id === base)) return base
    for (let n = 2; ; n++) {
      const candidate = `${base}-${n}`
      if (!this.items.some((item) => item.id === candidate)) return candidate
    }
  }

  private path(): string {
    return join(this.dir, 'widgets.json')
  }

  private persist(): void {
    const file = this.path()
    const tmp = `${file}.tmp`
    const payload: StoreFile = {
      version: CACHE_VERSION,
      savedAt: this.now(),
      items: this.items
    }
    try {
      writeFileSync(tmp, JSON.stringify(payload, null, 2))
      renameSync(tmp, file)
    } catch (error) {
      console.error('[widget] Failed to write store:', error)
      try {
        unlinkSync(tmp)
      } catch {
        /* nothing to clean up */
      }
    }
  }
}
