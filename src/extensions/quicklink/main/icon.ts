/**
 * The one place that answers "what icon does this link get?".
 *
 * A link is either a website (its favicon), a path (the icon the OS draws for
 * that file or folder), or neither (no icon — the caller falls back to a
 * monogram). Keeping the dispatch here rather than at the call sites means the
 * Create form, the importer and any future caller all resolve a link the same
 * way, and a new kind of target is added in one place.
 *
 * Every icon comes back inlined as a `data:` URI: the launcher's CSP is
 * `img-src 'self' data:`, so a referenced URL would never render.
 */
import { isLocalPath, originOf } from "../shared/link";
import { fetchFavicon } from "./favicon";
import { fileIcon } from "./file-icon";

/**
 * Resolved icons, keyed by `iconKeyFor`. Lookups are expensive and repeat a lot
 * — reopening the Create form for a site, or importing a file that overlaps one
 * already imported. Failures are cached too: a dead host costs a full fetch
 * timeout, and that's exactly what shouldn't be paid twice.
 */
const cache = new Map<string, string | null>();
/** Plenty for a session's worth of links; stops the base64 accumulating. */
const MAX_ENTRIES = 300;

/**
 * What two links have to share to share an icon: the site for a web link, the
 * path itself for a file. Null when the link has no icon to look up, so callers
 * can skip it without repeating the classification rules.
 */
export function iconKeyFor(link: string): string | null {
  const origin = originOf(link);
  if (origin) return origin;
  return isLocalPath(link) ? `path:${link.trim()}` : null;
}

/** The icon for a key from `iconKeyFor`, as a `data:` URI. Cached, failures included. */
export async function iconForKey(key: string): Promise<string | null> {
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const icon = key.startsWith("path:")
    ? await fileIcon(key.slice("path:".length))
    : await fetchFavicon(key);

  if (cache.size >= MAX_ENTRIES) cache.clear();
  cache.set(key, icon);
  return icon;
}

/** The icon for `link` as a `data:` URI, or null if it hasn't got one. */
export async function resolveIcon(link: string): Promise<string | null> {
  const key = iconKeyFor(link);
  return key ? iconForKey(key) : null;
}
