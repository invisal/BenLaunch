/**
 * One namespaced JSON document per extension, at `<userData>/extensions/<id>.json`.
 *
 * Same mechanics as `usage/store.ts` and `widget/main/store.ts`: lazy
 * `readFileSync`, an in-memory map, a synchronous atomic temp-write + rename on
 * every mutation, and every filesystem failure swallowed with an `[ext:<id>]`
 * prefix so a bad disk never takes the launcher down. Deliberately Electron-free
 * — the directory is injected (see `configureExtensions` in `base.ts`).
 */
import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

/** Bumped when the persisted wrapper shape changes, to invalidate old files. */
const VERSION = 1

interface DocFile {
  version: number
  savedAt: number
  data: Record<string, unknown>
}

/**
 * A tiny key -> JSON-value store. Values are whatever the extension puts in;
 * it is the extension's job to know their shape on the way out.
 */
export class ExtensionStorage {
  private readonly file: string
  private readonly tag: string
  private data: Record<string, unknown> = {}
  private loaded = false

  constructor(file: string, tag: string) {
    this.file = file
    this.tag = tag
  }

  get<T>(key: string): T | undefined
  get<T>(key: string, fallback: T): T
  get<T>(key: string, fallback?: T): T | undefined {
    this.load()
    return key in this.data ? (this.data[key] as T) : fallback
  }

  set(key: string, value: unknown): void {
    this.load()
    this.data[key] = value
    this.persist()
  }

  delete(key: string): void {
    this.load()
    if (!(key in this.data)) return
    delete this.data[key]
    this.persist()
  }

  keys(): string[] {
    this.load()
    return Object.keys(this.data)
  }

  /** Load the document into memory. Corrupt / missing / old version -> empty. */
  private load(): void {
    if (this.loaded) return
    this.loaded = true
    try {
      const parsed = JSON.parse(readFileSync(this.file, 'utf8')) as Partial<DocFile>
      if (parsed?.version === VERSION && parsed.data && typeof parsed.data === 'object') {
        this.data = parsed.data as Record<string, unknown>
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error(`[${this.tag}] Failed to read storage:`, error)
      }
    }
  }

  private persist(): void {
    const tmp = `${this.file}.tmp`
    const payload: DocFile = { version: VERSION, savedAt: Date.now(), data: this.data }
    try {
      mkdirSync(dirname(this.file), { recursive: true })
      writeFileSync(tmp, JSON.stringify(payload, null, 2))
      renameSync(tmp, this.file)
    } catch (error) {
      console.error(`[${this.tag}] Failed to write storage:`, error)
      try {
        unlinkSync(tmp)
      } catch {
        /* nothing to clean up */
      }
    }
  }
}
