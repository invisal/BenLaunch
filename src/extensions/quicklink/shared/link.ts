/**
 * What kind of target a quicklink's text points at. Shared because main (the
 * favicon/file-icon lookups, the importer) and the renderer (the Create form)
 * all have to agree: if they classify a link differently, the form previews one
 * icon and the store ends up with another.
 *
 * Nothing here may import `node:*` — the renderer bundles this file too, so
 * anything needing the filesystem (`normalizeLink`'s `~` expansion) stays in
 * `main/store.ts`.
 */

/**
 * `{query}` and friends are not valid URL syntax, so they have to be neutralized
 * before parsing or a perfectly good link fails to classify.
 */
const PLACEHOLDER = /\{[^}]*\}/g;

function parse(link: string): URL | null {
  try {
    return new URL(link.trim().replace(PLACEHOLDER, "x"));
  } catch {
    return null;
  }
}

/** `https://www.example.com/x?q={query}` → `www.example.com`; null if unparseable. */
export function hostOf(link: string): string | null {
  return parse(link)?.hostname || null;
}

/** `https://example.com/x?q={query}` → `https://example.com`; null unless http(s). */
export function originOf(link: string): string | null {
  const url = parse(link);
  if (!url) return null;
  return url.protocol === "http:" || url.protocol === "https:"
    ? url.origin
    : null;
}

/** A link into the filesystem — `~/x`, `/x`, `C:\x`, `file://x`. */
export function isLocalPath(link: string): boolean {
  const trimmed = link.trim();
  return (
    /^file:\/\//i.test(trimmed) ||
    /^[~/]/.test(trimmed) ||
    /^[a-z]:[\\/]/i.test(trimmed)
  );
}

/** Is this icon a URI to render in an `<img>`, rather than an emoji glyph? */
export function isImageUri(icon: string): boolean {
  return /^(https?:|data:|file:)/i.test(icon.trim());
}
