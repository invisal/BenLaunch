/**
 * Import/export quicklinks in Raycast's interchange format, so a set of links
 * can move between the two (or between teammates) as a plain JSON file.
 *
 * Raycast's shape is `{ name, link, iconName?, openWith? }`. Two fields need
 * translating rather than copying:
 *  - `openWith` is an app *name* ("Finder"), while a stored quicklink holds the
 *    executable *path* — so it is resolved against the "Open With" app list.
 *  - `iconName` is usually one of Raycast's built-in icon names ("folder-16"),
 *    which we have no art for; only an emoji or an image URL survives the trip.
 *
 * Electron-free on purpose (the `node --test` suite imports it directly) — the
 * file picking and writing live in the extension's IPC handlers.
 */
import { basename } from "node:path";
import { isImageUri } from "../shared/link.ts";
import type { OpenWithApp, QuicklinkDraft } from "../shared/types.ts";
import { normalizeLink, type Quicklink } from "./store.ts";

/** One entry of a Raycast quicklinks export. */
export interface RaycastQuicklink {
  name: string;
  link: string;
  iconName?: string;
  openWith?: string;
}

/** What an import did, for the summary shown afterwards. */
export interface ImportSummary {
  added: number;
  /** Skipped because a quicklink with the same name and link already exists. */
  duplicates: number;
  /** Entries that weren't usable (missing `name`/`link`, wrong types). */
  invalid: number;
}

function isRenderableIcon(icon: string): boolean {
  const trimmed = icon.trim();
  if (!trimmed) return false;
  if (isImageUri(trimmed)) return true;
  // Raycast's built-in names ("folder-16", "globe") have no equivalent here;
  // an emoji has no ASCII word characters, which is what separates the two.
  return !/[A-Za-z0-9_-]/.test(trimmed);
}

/** `/Applications/Music.app` → `Music`; `C:\...\Code.exe` → `Code`. */
function appNameFromPath(path: string): string {
  return basename(path).replace(/\.(app|exe)$/i, "");
}

/**
 * Parse the contents of a Raycast quicklinks JSON file. Returns the usable
 * entries plus a count of the ones that were malformed; `null` when the file
 * isn't JSON, or isn't the array the format calls for.
 */
export function parseRaycastJson(
  text: string,
): { entries: RaycastQuicklink[]; invalid: number } | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;

  const entries: RaycastQuicklink[] = [];
  let invalid = 0;
  for (const value of parsed) {
    if (!value || typeof value !== "object") {
      invalid += 1;
      continue;
    }
    const candidate = value as Partial<RaycastQuicklink>;
    if (
      typeof candidate.name !== "string" ||
      !candidate.name.trim() ||
      typeof candidate.link !== "string" ||
      !candidate.link.trim()
    ) {
      invalid += 1;
      continue;
    }
    entries.push({
      name: candidate.name.trim(),
      link: candidate.link.trim(),
      ...(typeof candidate.iconName === "string"
        ? { iconName: candidate.iconName }
        : {}),
      ...(typeof candidate.openWith === "string"
        ? { openWith: candidate.openWith }
        : {}),
    });
  }
  return { entries, invalid };
}

/**
 * A Raycast entry as a draft this store can take. An `openWith` naming an app
 * we can't find is dropped rather than stored as a dead path — the link then
 * opens with the system default, which is what Raycast does for an app it
 * can't resolve either.
 */
export function toDraft(
  entry: RaycastQuicklink,
  apps: readonly OpenWithApp[],
): QuicklinkDraft {
  const wanted = entry.openWith?.trim().toLowerCase();
  const app = wanted
    ? apps.find(
        (candidate) =>
          candidate.name.toLowerCase() === wanted ||
          appNameFromPath(candidate.path).toLowerCase() === wanted,
      )
    : undefined;

  return {
    name: entry.name,
    link: entry.link,
    ...(entry.iconName && isRenderableIcon(entry.iconName)
      ? { icon: entry.iconName.trim() }
      : {}),
    ...(app ? { openWith: app.path } : {}),
  };
}

/**
 * Give every draft that arrived without an icon whatever icon its link resolves
 * to — a site's favicon, a file's OS icon — so an imported link doesn't look
 * worse than the same link typed into the Create form. Fills them in place.
 *
 * Drafts are grouped by `keyOf`, so a file with twenty github.com links costs
 * one lookup, and run a few at a time so a long list doesn't go one-at-a-time
 * through each request's timeout. A link `keyOf` can't key — `shortcuts://…` —
 * has no icon to find and is skipped; anything that fails is left iconless and
 * falls back to a monogram at render time.
 *
 * The resolver is injected rather than imported so this stays testable without
 * touching the network.
 */
export async function fillMissingIcons(
  drafts: readonly QuicklinkDraft[],
  resolve: {
    keyOf: (link: string) => string | null;
    icon: (key: string) => Promise<string | null>;
  },
  concurrency = 8,
): Promise<void> {
  const byKey = new Map<string, QuicklinkDraft[]>();
  for (const draft of drafts) {
    if (draft.icon) continue;
    const key = resolve.keyOf(normalizeLink(draft.link));
    if (!key) continue;
    const group = byKey.get(key);
    if (group) group.push(draft);
    else byKey.set(key, [draft]);
  }

  const pending = [...byKey];
  let cursor = 0;
  const worker = async (): Promise<void> => {
    while (cursor < pending.length) {
      const [key, group] = pending[cursor];
      cursor += 1;
      const icon = await resolve.icon(key);
      if (icon) for (const draft of group) draft.icon = icon;
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, pending.length) }, worker),
  );
}

/** A stored quicklink in Raycast's format. */
export function toRaycast(
  link: Quicklink,
  apps: readonly OpenWithApp[],
): RaycastQuicklink {
  const app = link.openWith
    ? apps.find((candidate) => candidate.path === link.openWith)
    : undefined;
  const openWith =
    app?.name ?? (link.openWith ? appNameFromPath(link.openWith) : undefined);

  return {
    name: link.name,
    link: link.link,
    // A data: URI favicon is kilobytes of base64 and means nothing to Raycast;
    // only a literal emoji is worth carrying across.
    ...(link.icon && !isImageUri(link.icon) ? { iconName: link.icon } : {}),
    ...(openWith ? { openWith } : {}),
  };
}

/**
 * Raycast's duplicate rule: same title and same content. Compared on the
 * normalized link, so `example.com` and `https://example.com` count as one.
 */
export function isDuplicate(
  draft: QuicklinkDraft,
  existing: readonly Quicklink[],
): boolean {
  const name = draft.name.trim().toLowerCase();
  const link = normalizeLink(draft.link);
  return existing.some(
    (entry) =>
      entry.name.trim().toLowerCase() === name &&
      normalizeLink(entry.link) === link,
  );
}
