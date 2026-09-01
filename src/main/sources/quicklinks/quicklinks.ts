/**
 * User-defined quicklinks — named shortcuts to a URL (or file path), Raycast-style.
 * A link may carry a `{query}` / `{argument}` / `{}` placeholder; when it does the
 * user's typed argument is URL-encoded and substituted before the link is opened.
 *
 * The store is deliberately Electron-free (the `node --test` suite imports it
 * directly): the `userData` directory is injected by the source. Like the app and
 * usage stores it is advisory — every filesystem failure is swallowed with a
 * `[quicklinks]` prefix and leaves the in-memory list intact — except that a
 * missing file is seeded with a small set of defaults so a fresh install has
 * something useful in the box.
 */
import { readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  monogramIcon,
  normalizeTags,
  slugify,
  validateDraft,
  type QuicklinkDraft
} from '../../../shared/quicklink.ts'

export { monogramIcon }
export type { QuicklinkDraft, QuicklinkCreateResult } from '../../../shared/quicklink.ts'

export interface Quicklink {
  /** Stable slug; the action id is `ql:<id>`. */
  id: string
  /** Display name, shown in the result list and fuzzy-matched. */
  name: string
  /** Target URL or path. May contain one `{query}` / `{argument}` / `{}` placeholder. */
  link: string
  /** Optional short alias: typing it as the query's first word invokes this link. */
  keyword?: string
  /** Emoji or image URL; defaults to a generated monogram. */
  icon?: string
  /** Executable to open the link with (a specific browser/app); default handler otherwise. */
  openWith?: string
  /** Lower-cased labels for grouping; also fuzzy-matched in search. */
  tags?: string[]
}

/** Seeded into `quicklinks.json` on first run so the feature is discoverable. */
export const DEFAULT_QUICKLINKS: Quicklink[] = [
  { id: 'google', name: 'Google Search', keyword: 'g', link: 'https://www.google.com/search?q={query}' },
  { id: 'youtube', name: 'YouTube', keyword: 'yt', link: 'https://www.youtube.com/results?search_query={query}' },
  {
    id: 'github',
    name: 'GitHub Search',
    keyword: 'gh',
    link: 'https://github.com/search?q={query}&type=repositories'
  },
  { id: 'npm', name: 'npm', keyword: 'npm', link: 'https://www.npmjs.com/search?q={query}' },
  {
    id: 'translate',
    name: 'Google Translate',
    keyword: 'tr',
    link: 'https://translate.google.com/?sl=auto&tl=en&text={query}'
  }
]

/**
 * The argument placeholder: `{query}`, `{argument}`, `{arg}`, a bare `{}`, or
 * Raycast's `{argument name="…"}` form (the name is ignored — a quicklink here
 * takes a single positional argument).
 */
const ARG_PLACEHOLDER = /\{\s*(?:query|arg(?:ument)?(?:\s+[^}]*)?)?\s*\}/i
const ARG_PLACEHOLDER_GLOBAL = new RegExp(ARG_PLACEHOLDER.source, 'gi')

/** Context-only placeholders — resolved from the environment, not from typed text. */
const DYNAMIC_PLACEHOLDER = /\{\s*(clipboard|uuid|date|time|datetime)\s*\}/gi

/** Does this link take a typed argument? */
export function hasPlaceholder(link: string): boolean {
  return ARG_PLACEHOLDER.test(link)
}

/** Environment values the dynamic placeholders draw on. */
export interface PlaceholderContext {
  /** Current clipboard text, for `{clipboard}`. */
  clipboard?: string
  /** Clock used for `{date}` / `{time}` / `{datetime}` (injectable for tests). */
  now?: Date
  /** UUID factory for `{uuid}` (injectable for tests). */
  uuid?: () => string
}

/**
 * Replace `{clipboard}`, `{uuid}`, `{date}`, `{time}` and `{datetime}` with values
 * from `ctx`, URL-encoded. Unknown context (e.g. no clipboard) collapses to empty.
 */
export function expandDynamic(link: string, ctx: PlaceholderContext = {}): string {
  const now = ctx.now ?? new Date()
  return link.replace(DYNAMIC_PLACEHOLDER, (_, name: string) => {
    switch (name.toLowerCase()) {
      case 'clipboard':
        return encodeURIComponent(ctx.clipboard ?? '')
      case 'uuid':
        return (ctx.uuid ?? (() => globalThis.crypto.randomUUID()))()
      case 'date':
        return now.toISOString().slice(0, 10)
      case 'time':
        return now.toISOString().slice(11, 16)
      case 'datetime':
        return encodeURIComponent(now.toISOString())
      default:
        return ''
    }
  })
}

/**
 * The argument for `quicklink` implied by `query`: the text after its keyword
 * when the query is `"<keyword> <rest>"` (or just `"<keyword>"`), else `""`.
 * Matching on the keyword is case-insensitive.
 */
export function parseArgument(query: string, quicklink: Pick<Quicklink, 'keyword'>): string {
  const trimmed = query.trim()
  const keyword = quicklink.keyword?.trim()
  if (!keyword) return ''

  const lower = trimmed.toLowerCase()
  const kw = keyword.toLowerCase()
  if (lower === kw) return ''
  if (lower.startsWith(`${kw} `)) return trimmed.slice(keyword.length).trim()
  return ''
}

/**
 * Substitute `argument` into `link`. With no placeholder the link is returned
 * unchanged. With a placeholder but an empty argument the link's origin is
 * returned (so "g" alone just opens Google); otherwise the argument is
 * URL-encoded and dropped in.
 */
export function resolveLink(link: string, argument: string): string {
  if (!hasPlaceholder(link)) return link

  const arg = argument.trim()
  if (!arg) {
    try {
      return new URL(link.replace(ARG_PLACEHOLDER_GLOBAL, '')).origin
    } catch {
      return link.replace(ARG_PLACEHOLDER_GLOBAL, '')
    }
  }
  return link.replace(ARG_PLACEHOLDER_GLOBAL, encodeURIComponent(arg))
}

/** A Windows drive path like `C:\Users\me` or `D:/x` (not a URL scheme). */
const WINDOWS_PATH = /^[a-zA-Z]:[\\/]/
/** Anything with a `scheme:` prefix — `https:`, `spotify:`, `mailto:`, `file:`, … */
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i

/**
 * Tidy a user-entered link so it opens the way they meant:
 *  - `~/Projects` → an absolute path under the home directory
 *  - `example.com/x` → `https://example.com/x` (a bare domain gets a scheme)
 *  - absolute paths, and links that already have a scheme, are left alone
 */
export function normalizeLink(link: string): string {
  const trimmed = link.trim()
  if (!trimmed) return trimmed

  if (trimmed === '~' || trimmed.startsWith('~/') || trimmed.startsWith('~\\')) {
    return join(homedir(), trimmed.slice(1).replace(/^[\\/]/, ''))
  }
  if (/^[\\/]/.test(trimmed) || WINDOWS_PATH.test(trimmed)) return trimmed
  if (URL_SCHEME.test(trimmed)) return trimmed
  // A bare "host.tld" or "host.tld/path" — assume the user meant a website.
  if (/^[^\s/]+\.[^\s/]+/.test(trimmed)) return `https://${trimmed}`
  return trimmed
}

/** Should this (normalized) target open in the browser rather than as a file/path? */
export function isWebTarget(target: string): boolean {
  return !WINDOWS_PATH.test(target) && URL_SCHEME.test(target) && !/^file:/i.test(target)
}

/** `https://www.example.com/x?q=` → `www.example.com/x?q=` — for compact subtitles. */
export function prettyLink(link: string): string {
  return link.replace(/^[a-z]+:\/\//i, '').replace(/\/$/, '')
}

function isQuicklink(value: unknown): value is Quicklink {
  if (!value || typeof value !== 'object') return false
  const c = value as Partial<Quicklink>
  return (
    typeof c.id === 'string' &&
    c.id.length > 0 &&
    typeof c.name === 'string' &&
    c.name.length > 0 &&
    typeof c.link === 'string' &&
    c.link.length > 0 &&
    (c.keyword === undefined || typeof c.keyword === 'string') &&
    (c.icon === undefined || typeof c.icon === 'string') &&
    (c.openWith === undefined || typeof c.openWith === 'string') &&
    (c.tags === undefined ||
      (Array.isArray(c.tags) && c.tags.every((tag) => typeof tag === 'string')))
  )
}

/** Keeps only well-formed entries and drops duplicate ids (first one wins). */
export function sanitize(value: unknown): Quicklink[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const out: Quicklink[] = []
  for (const entry of value) {
    if (!isQuicklink(entry) || seen.has(entry.id)) continue
    seen.add(entry.id)
    const tags = normalizeTags(entry.tags)
    out.push({
      id: entry.id,
      name: entry.name,
      link: normalizeLink(entry.link),
      ...(entry.keyword?.trim() ? { keyword: entry.keyword.trim() } : {}),
      ...(entry.icon?.trim() ? { icon: entry.icon.trim() } : {}),
      ...(entry.openWith?.trim() ? { openWith: entry.openWith.trim() } : {}),
      ...(tags.length ? { tags } : {})
    })
  }
  return out
}

export class QuicklinkStore {
  private readonly dir: string
  private cache: Quicklink[] | null = null

  constructor(opts: { dir: string }) {
    this.dir = opts.dir
  }

  filePath(): string {
    return join(this.dir, 'quicklinks.json')
  }

  /** The current list, read from disk once and cached. Missing file → seeded defaults. */
  list(): Quicklink[] {
    if (this.cache) return this.cache
    this.cache = this.read()
    return this.cache
  }

  /** Drop the cache so the next `list()` re-reads the file (picks up manual edits). */
  reload(): void {
    this.cache = null
  }

  /**
   * Append a quicklink from a Create-form draft and persist it. Throws with a
   * user-facing message if the draft is unusable. Returns the stored entry (with
   * its generated id and normalized link).
   */
  add(draft: QuicklinkDraft): Quicklink {
    const problem = validateDraft(draft)
    if (problem) throw new Error(problem)

    const link = normalizeLink(draft.link)
    if (!link) throw new Error('That link could not be understood.')

    const existing = this.list()
    const taken = new Set(existing.map((entry) => entry.id))
    const base = slugify(draft.name)
    let id = base
    for (let n = 2; taken.has(id); n += 1) id = `${base}-${n}`

    const tags = normalizeTags(draft.tags)
    const entry: Quicklink = {
      id,
      name: draft.name.trim(),
      link,
      ...(draft.keyword?.trim() ? { keyword: draft.keyword.trim() } : {}),
      ...(draft.icon?.trim() ? { icon: draft.icon.trim() } : {}),
      ...(draft.openWith?.trim() ? { openWith: draft.openWith.trim() } : {}),
      ...(tags.length ? { tags } : {})
    }

    this.cache = [...existing, entry]
    this.write(this.cache)
    return entry
  }

  private read(): Quicklink[] {
    try {
      const parsed: unknown = JSON.parse(readFileSync(this.filePath(), 'utf8'))
      return sanitize(parsed)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.write(DEFAULT_QUICKLINKS)
        return DEFAULT_QUICKLINKS
      }
      console.error('[quicklinks] Failed to read store:', error)
      return []
    }
  }

  /** Atomic temp-write + rename, mirroring `sources/apps/cache.ts`. */
  private write(links: Quicklink[]): void {
    const file = this.filePath()
    const tmp = `${file}.tmp`
    try {
      writeFileSync(tmp, `${JSON.stringify(links, null, 2)}\n`)
      renameSync(tmp, file)
    } catch (error) {
      console.error('[quicklinks] Failed to write store:', error)
      try {
        unlinkSync(tmp)
      } catch {
        /* nothing to clean up */
      }
    }
  }
}
