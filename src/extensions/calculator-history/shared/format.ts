/**
 * Pure text helpers shared by the launcher's calculator row and the history
 * screen — kept here (web-safe, no Electron) so both renderers produce the
 * exact same clipboard text, and so it's unit-tested.
 */

/** What the copy actions can put on the clipboard. */
export type CopyKind = "value" | "raw" | "question-and-answer";

interface Copyable {
  expression: string;
  value: string;
  rawValue: string;
}

/** `"10 usd in gbp = £7.42"` — the `⇧⌘↵` "Copy Question & Answer" text. */
export function questionAndAnswer(
  calc: Pick<Copyable, "expression" | "value">,
): string {
  return `${calc.expression} = ${calc.value}`;
}

/** The clipboard text for one copy action. */
export function clipboardText(calc: Copyable, kind: CopyKind): string {
  if (kind === "raw") return calc.rawValue;
  if (kind === "question-and-answer") return questionAndAnswer(calc);
  return calc.value;
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
