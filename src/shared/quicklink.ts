/**
 * Quicklink types and pure helpers shared by the main process (the store that
 * persists them) and the renderer (the "Create Quicklink" form). Nothing here
 * may import `node:*` — the renderer bundles this file too.
 */

/**
 * A stored quicklink. Persisted in `quicklinks.json` by the main-process store;
 * the shape is shared so the renderer (the Create/Edit form, the action panel)
 * can read one back without importing the Electron-bound store.
 */
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
  /** Pinned quicklinks sort to the top of the root (empty-query) list. */
  pinned?: boolean
  /** Hidden from the root list, but still returned for an explicit search. */
  hidden?: boolean
}

/** A new quicklink as entered in the Create form, before it is assigned an id. */
export interface QuicklinkDraft {
  name: string
  link: string
  /** Short alias typed as the query's first word. Optional. */
  keyword?: string
  /** Emoji or image URL. Blank → a generated monogram is used. */
  icon?: string
  /** Executable path to open the link with (a specific browser/app). Blank → system default. */
  openWith?: string
  /** Free-form labels for grouping and search. */
  tags?: string[]
}

/** Result of a create request, sent back to the renderer. */
export type QuicklinkCreateResult = { ok: true; name: string } | { ok: false; error: string }

/** Renderer views the launcher can switch to when an action is run. */
export type LauncherView = 'create-quicklink'

/** An app the Create form offers under "Open With". */
export interface OpenWithApp {
  name: string
  /** Absolute path to the executable, passed the link as its argument. */
  path: string
  /** Data-URL icon for the executable, when one could be resolved. */
  icon?: string
}

/** Placeholders offered by the Create form's "add placeholder" menu. */
export const DYNAMIC_PLACEHOLDERS: ReadonlyArray<{ token: string; label: string; hint: string }> = [
  { token: '{query}', label: 'Query', hint: 'What you type after the alias' },
  { token: '{clipboard}', label: 'Clipboard Text', hint: 'Current clipboard contents' },
  { token: '{uuid}', label: 'UUID', hint: 'A fresh random identifier' },
  { token: '{date}', label: 'Date', hint: "Today, as 2026-09-02" },
  { token: '{time}', label: 'Time', hint: 'Now, as 14:07' },
  { token: '{datetime}', label: 'Date & Time', hint: 'Now, as an ISO timestamp' }
]

/** Normalize free-form tag input to a clean, de-duplicated, lower-cased list. */
export function normalizeTags(tags: readonly string[] | undefined): string[] {
  if (!tags) return []
  const seen = new Set<string>()
  for (const raw of tags) {
    const tag = raw.trim().toLowerCase()
    if (tag) seen.add(tag)
  }
  return [...seen]
}

/** `"My Cool Link"` → `"my-cool-link"`; always yields a non-empty string. */
export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'quicklink'
}

/**
 * Validate a draft for the shape the form can check without touching the
 * filesystem. Returns an error message for display, or `null` when it's usable.
 */
export function validateDraft(draft: QuicklinkDraft): string | null {
  if (!draft.link.trim()) return 'Enter a link.'
  if (!draft.name.trim()) return 'Give the quicklink a name.'
  if (draft.keyword && /\s/.test(draft.keyword.trim())) return "The alias can't contain spaces."
  return null
}

const XML_ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}

/**
 * A generated monogram icon — a rounded tile in a colour derived from `label`,
 * with its first character — returned as a self-contained `data:` SVG URI. Used
 * as the default quicklink icon: no network, nothing leaked to a favicon
 * service, and it reads as deliberate next to the app icons.
 */
export function monogramIcon(label: string): string {
  const trimmed = label.trim()
  const char = [...trimmed][0] ?? '?'
  const letter = (/[a-z0-9]/i.test(char) ? char.toUpperCase() : char).replace(
    /[&<>"']/g,
    (c) => XML_ESCAPE[c]
  )

  let hash = 0
  for (const cp of trimmed) hash = (hash * 31 + (cp.codePointAt(0) ?? 0)) % 360
  const hue = (hash + 360) % 360

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<rect width="24" height="24" rx="6" fill="hsl(${hue} 42% 42%)"/>` +
    `<text x="12" y="12" text-anchor="middle" dominant-baseline="central" ` +
    `font-family="system-ui,-apple-system,'Segoe UI',sans-serif" font-size="13" ` +
    `font-weight="600" fill="#f5f5f4">${letter}</text>` +
    `</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
