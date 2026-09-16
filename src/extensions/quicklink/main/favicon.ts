/**
 * Resolves a site's favicon to a `data:` URI, in the main process.
 *
 * It has to happen here, not in the renderer: the launcher's CSP is
 * `img-src 'self' data:`, so a remote icon URL would never render. Inlining the
 * bytes also means the icon is fetched exactly once — when the user is
 * deliberately creating a link to that site — instead of on every list render,
 * which is the privacy line `monogramIcon` was written to hold.
 */

/** Give up on a slow site rather than stalling the Create form. */
const TIMEOUT_MS = 5_000;
/** A favicon is kilobytes; anything past this is not one. */
const MAX_BYTES = 256 * 1024;
/** Only read enough of the page to reach `<head>`'s icon links. */
const MAX_HTML_BYTES = 512 * 1024;

/** `https://example.com/x?q={query}` → `https://example.com`, or null. */
function originOf(link: string): string | null {
  try {
    const url = new URL(link.replace(/\{[^}]*\}/g, "x"));
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

async function get(url: string): Promise<Response | null> {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return response.ok ? response : null;
  } catch {
    return null;
  }
}

/** Read a capped body, so a misbehaving host can't stream us megabytes. */
async function readCapped(
  response: Response,
  max: number,
): Promise<Uint8Array | null> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > max) return null;
  const bytes = new Uint8Array(await response.arrayBuffer());
  return bytes.byteLength && bytes.byteLength <= max ? bytes : null;
}

/** Fetch `url` and return it as a `data:` URI, or null if it isn't an image. */
async function asDataUri(url: string): Promise<string | null> {
  const response = await get(url);
  if (!response) return null;

  const mime = (response.headers.get("content-type") ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  // Sites commonly answer a missing /favicon.ico with an HTML error page.
  if (!mime.startsWith("image/")) return null;

  const bytes = await readCapped(response, MAX_BYTES);
  if (!bytes) return null;

  return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
}

/**
 * Icon URLs declared in the page's `<link rel="...icon...">` tags, best first.
 * Needed because plenty of modern sites serve no `/favicon.ico` at all.
 */
function iconLinksFrom(html: string, baseUrl: string): string[] {
  const candidates: Array<{ href: string; score: number }> = [];

  for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
    const rel = /\brel\s*=\s*["']?([^"'>]+)/i.exec(tag)?.[1]?.toLowerCase();
    if (!rel || !/\bicon\b/.test(rel)) continue;
    const href = /\bhref\s*=\s*["']([^"']+)/i.exec(tag)?.[1];
    if (!href) continue;

    // Prefer a big, purpose-made icon over a 16px legacy one.
    const size = Number(
      /\bsizes\s*=\s*["']?(\d+)/i.exec(tag)?.[1] ??
        (rel.includes("apple") ? 180 : 0),
    );
    candidates.push({ href, score: size });
  }

  return candidates
    .sort((a, b) => b.score - a.score)
    .map(({ href }) => {
      try {
        return new URL(href, baseUrl).toString();
      } catch {
        return null;
      }
    })
    .filter((url): url is string => !!url);
}

/**
 * The site's favicon for `link`, as a `data:` URI — `/favicon.ico` when the
 * site has one, otherwise whatever its HTML declares. Null when nothing
 * usable turns up; the caller falls back to a monogram.
 */
export async function fetchFavicon(link: string): Promise<string | null> {
  const origin = originOf(link);
  if (!origin) return null;

  const fromWellKnown = await asDataUri(`${origin}/favicon.ico`);
  if (fromWellKnown) return fromWellKnown;

  const page = await get(origin);
  if (!page) return null;
  const html = await readCapped(page, MAX_HTML_BYTES);
  if (!html) return null;

  for (const url of iconLinksFrom(
    new TextDecoder().decode(html),
    page.url || origin,
  ).slice(0, 3)) {
    const icon = await asDataUri(url);
    if (icon) return icon;
  }
  return null;
}
