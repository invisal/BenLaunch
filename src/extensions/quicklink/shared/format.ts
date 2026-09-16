/**
 * Display helpers for the quicklink manager's detail pane. Pure and web-safe
 * (no `node:*`), so the renderer bundles it and the test suite imports it
 * directly — same rules as `./types`.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * How long ago something happened: `"just now"`, `"5m ago"`, `"3h ago"`,
 * `"yesterday"`, `"4d ago"`, then a short date (`"Sep 2"`, or `"Sep 2, 2025"`
 * in another year). Clock-independent — `now` is passed in.
 */
export function relativeAge(at: number, now: number): string {
  const delta = Math.max(0, now - at);
  if (delta < MINUTE) return "just now";
  if (delta < HOUR) return `${Math.floor(delta / MINUTE)}m ago`;
  if (delta < DAY) return `${Math.floor(delta / HOUR)}h ago`;
  if (delta < 2 * DAY) return "yesterday";
  if (delta < 7 * DAY) return `${Math.floor(delta / DAY)}d ago`;

  const date = new Date(at);
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(date);
}
