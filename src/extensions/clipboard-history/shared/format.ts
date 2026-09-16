/**
 * Pure text helpers shared by the store (record-time preview) and the list
 * screen (row age) — kept here (web-safe, no Electron) so it's unit-tested.
 */

const PREVIEW_MAX_LENGTH = 120;

/** Whitespace-collapsed, single-line, truncated preview of a copied text entry. */
export function makePreview(text: string): string {
  const collapsed = text.trim().replace(/\s+/g, " ");
  if (collapsed.length <= PREVIEW_MAX_LENGTH) return collapsed;
  return `${collapsed.slice(0, PREVIEW_MAX_LENGTH)}…`;
}

/** The row label for an image entry, e.g. `"Image · 1024×768"`. */
export function imagePreview(width: number, height: number): string {
  return `Image · ${width}×${height}`;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * A history row's age: `"just now"`, `"5m ago"`, `"3h ago"`, `"yesterday"`,
 * `"4d ago"`, then a short date (`"Sep 2"`, or `"Sep 2, 2025"` in another year).
 */
export function relativeAge(createdAt: number, now: number): string {
  const delta = Math.max(0, now - createdAt);
  if (delta < MINUTE) return "just now";
  if (delta < HOUR) return `${Math.floor(delta / MINUTE)}m ago`;
  if (delta < DAY) return `${Math.floor(delta / HOUR)}h ago`;
  if (delta < 2 * DAY) return "yesterday";
  if (delta < 7 * DAY) return `${Math.floor(delta / DAY)}d ago`;

  const date = new Date(createdAt);
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(date);
}

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * The list's section heading for an entry: `"Today"`, `"Yesterday"`, or a
 * short date (`"Sep 2"`, `"Sep 2, 2025"` in another year) — grouped by
 * calendar day, not by a rolling 24h window like `relativeAge`.
 */
export function groupLabel(createdAt: number, now: number): string {
  const days = Math.round((startOfDay(now) - startOfDay(createdAt)) / DAY);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";

  const date = new Date(createdAt);
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(date);
}

/** A byte count as `"157 B"`, `"2.3 KB"`, `"1.2 MB"`. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

/** Approximate decoded byte size of a base64 data URL's payload. */
export function dataUrlByteSize(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  const base64 = comma === -1 ? dataUrl : dataUrl.slice(comma + 1);
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

/** UTF-8 byte size of a text entry. */
export function textByteSize(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** A full, human-readable timestamp for the detail pane, e.g. `"Sep 16, 2026 at 1:22:41 PM"`. */
export function absoluteTime(createdAt: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(createdAt));
}
