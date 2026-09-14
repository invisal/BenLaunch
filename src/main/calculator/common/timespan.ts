/**
 * Durations as people say them — shared by every evaluator that produces or
 * reads a span of time (`timespan`, `datetime` countdowns/differences, `math`
 * results whose unit is pure time, e.g. `3 GB / 25 Mbps`).
 *
 *   formatTimespan(9000)          → "2 hours 30 minutes"
 *   parseTimespan("1h 30m")       → 5400
 *
 * House rule ("more precise"): a span is shown exactly, down to the second,
 * with zero units dropped — never rounded to its two biggest units.
 */

export const MINUTE_S = 60;
export const HOUR_S = 60 * MINUTE_S;
export const DAY_S = 24 * HOUR_S;
export const WEEK_S = 7 * DAY_S;
/** Average Gregorian month / year, for "months"/"years" given as a plain amount. */
export const MONTH_S = 30.436875 * DAY_S;
export const YEAR_S = 365.2425 * DAY_S;

/** Every time-unit spelling `parseTimespan` accepts → its length in seconds. */
const UNIT_SECONDS: ReadonlyArray<readonly [RegExp, number]> = [
  [/^(?:ms|msecs?|milliseconds?)$/i, 0.001],
  [/^(?:s|secs?|seconds?)$/i, 1],
  [/^(?:m|mins?|minutes?)$/i, MINUTE_S],
  [/^(?:h|hrs?|hours?)$/i, HOUR_S],
  [/^(?:d|days?)$/i, DAY_S],
  [/^(?:w|wks?|weeks?)$/i, WEEK_S],
  [/^(?:mo|mos|months?)$/i, MONTH_S],
  [/^(?:y|yrs?|years?)$/i, YEAR_S],
];

/** `"mins"` → `60`; `null` for anything that isn't a time unit. */
export function timeUnitSeconds(word: string): number | null {
  for (const [pattern, seconds] of UNIT_SECONDS) {
    if (pattern.test(word)) return seconds;
  }
  return null;
}

/** One `<number><unit>` run, with or without a space: `1h`, `30 min`, `2.5 days`. */
const PART = /(\d+(?:\.\d+)?|\.\d+)\s*([a-z]+)/gi;

export interface TimespanPart {
  amount: number;
  /** The unit as typed — `"min"`, `"h"`, `"days"`. */
  unit: string;
  /** Length of one `unit`, in seconds. */
  unitSeconds: number;
}

/**
 * `"1h 30m"` → `[{ amount: 1, unit: "h", … }, { amount: 30, unit: "m", … }]`.
 * The whole string must be `<number><unit>` runs (optionally joined by `and`
 * / `,`), so `"2 apples"` or `"1h and change"` → `null`.
 */
export function parseTimespanParts(text: string): TimespanPart[] | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const parts: TimespanPart[] = [];
  for (const match of trimmed.matchAll(PART)) {
    const unitSeconds = timeUnitSeconds(match[2]);
    if (unitSeconds == null) return null;
    parts.push({ amount: Number(match[1]), unit: match[2], unitSeconds });
  }

  const leftover = trimmed
    .replace(PART, "")
    .replace(/\band\b|,/gi, "")
    .trim();
  if (parts.length === 0 || leftover) return null;
  return parts;
}

/** `"1h 30m"`, `"1 hour 30 minutes"`, `"90 min"`, `"2.5 days"` → total seconds (see `parseTimespanParts`). */
export function parseTimespan(text: string): number | null {
  const parts = parseTimespanParts(text);
  if (!parts) return null;
  return parts.reduce((sum, p) => sum + p.amount * p.unitSeconds, 0);
}

const plural = (n: number, unit: string): string =>
  `${n} ${n === 1 ? unit : `${unit}s`}`;

const FORMAT_UNITS: ReadonlyArray<readonly [string, number]> = [
  ["day", DAY_S],
  ["hour", HOUR_S],
  ["minute", MINUTE_S],
  ["second", 1],
];

export interface TimespanOptions {
  /** Smallest unit shown — e.g. `"minute"` rounds to the nearest minute first. Default `"second"`. */
  smallest?: "day" | "hour" | "minute" | "second";
}

/**
 * Total seconds → `"1 day 3 hours 46 minutes 40 seconds"`. Exact: every
 * non-zero unit is kept. Sub-second spans read `"0.5 seconds"`; negative
 * spans get a leading `-`.
 */
export function formatTimespan(
  totalSeconds: number,
  opts: TimespanOptions = {},
): string {
  if (totalSeconds < 0) return `-${formatTimespan(-totalSeconds, opts)}`;

  const smallest = opts.smallest ?? "second";
  const step = FORMAT_UNITS.find(([name]) => name === smallest)![1];

  if (smallest === "second" && totalSeconds > 0 && totalSeconds < 1) {
    return `${Number(totalSeconds.toPrecision(3))} seconds`;
  }

  let remaining = Math.round(totalSeconds / step) * step;
  if (remaining === 0) return plural(0, smallest);

  const parts: string[] = [];
  for (const [name, seconds] of FORMAT_UNITS) {
    if (seconds < step) break;
    const n = Math.floor(remaining / seconds);
    if (n > 0) parts.push(plural(n, name));
    remaining -= n * seconds;
  }
  return parts.join(" ");
}
