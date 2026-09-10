/**
 * Persisted list of user-authored Widget definitions (name + code + whether
 * it's exposed as a launcher command). The values those functions produce are
 * *not* here — that's the runner's cache (see `runner.ts`).
 *
 * Persistence goes through the Widget extension's `ExtensionStorage` (injected
 * by `WidgetSource`), under the `widgets` key of `<userData>/extensions/widget.json`.
 * This class keeps the domain logic — slugging, id collisions, partial updates —
 * and stays Electron-free so the `node --test` suite can drive it directly.
 */
import type { ExtensionStorage } from '@core/storage'
import type { WidgetDef, WidgetDraft } from '../shared/types'

/** Storage key holding the `WidgetDef[]`. */
const KEY = 'widgets'

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
  private readonly storage: ExtensionStorage

  private items: WidgetDef[] = []
  private loaded = false

  constructor(storage: ExtensionStorage) {
    this.storage = storage
  }

  /** Load the stored list into memory. Missing / malformed → empty list. */
  init(): void {
    if (this.loaded) return
    this.loaded = true
    const raw = this.storage.get<unknown>(KEY)
    if (Array.isArray(raw) && raw.every(isWidgetDef)) {
      this.items = raw as WidgetDef[]
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

  private persist(): void {
    this.storage.set(KEY, this.items)
  }
}
