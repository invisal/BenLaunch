/**
 * Display helpers shared by every window and extension: relative/absolute
 * timestamps and byte sizes. Pure and web-safe (no `node:*`, no Electron), so
 * the main process, the renderer and the test runner can all import it.
 *
 * The home for anything a *user-visible* surface formats. Extensions still
 * carrying a private copy of one of these (clipboard history, calculator
 * history) should move onto this one as they're next touched: two panes that
 * are meant to read as one app can't have two spellings of "5m ago".
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** `"Sep 2"`, or `"Sep 2, 2025"` once the year differs from `now`'s. */
function shortDate(at: number, now: number): string {
  const date = new Date(at);
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(date);
}

/**
 * How long ago something happened: `"just now"`, `"5m ago"`, `"3h ago"`,
 * `"yesterday"`, `"4d ago"`, then a short date. Clock-independent — `now` is
 * passed in.
 */
export function relativeAge(at: number, now: number): string {
  const delta = Math.max(0, now - at);
  if (delta < MINUTE) return "just now";
  if (delta < HOUR) return `${Math.floor(delta / MINUTE)}m ago`;
  if (delta < DAY) return `${Math.floor(delta / HOUR)}h ago`;
  if (delta < 2 * DAY) return "yesterday";
  if (delta < 7 * DAY) return `${Math.floor(delta / DAY)}d ago`;
  return shortDate(at, now);
}

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * A section heading for a timestamp: `"Today"`, `"Yesterday"`, or a short date
 * — grouped by calendar day, not by a rolling 24h window like `relativeAge`.
 */
export function groupLabel(at: number, now: number): string {
  const days = Math.round((startOfDay(now) - startOfDay(at)) / DAY);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return shortDate(at, now);
}

/** A full, readable timestamp, e.g. `"Sep 16, 2026 at 1:22:41 PM"`. */
export function absoluteTime(at: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(at));
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

/** UTF-8 byte size of a string. */
export function textByteSize(text: string): number {
  return new TextEncoder().encode(text).length;
}
