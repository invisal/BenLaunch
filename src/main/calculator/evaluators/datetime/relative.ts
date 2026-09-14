import * as chrono from "chrono-node";
import type { Calculation } from "../../../../shared/types";
import { addBusinessDays } from "./business.ts";
import { formatDate, formatDateTime } from "./format.ts";
import {
  firstDayOfPeriod,
  lastDayOfPeriod,
  nthWeekday,
  shiftPeriod,
  weekdayIndex,
  type Period,
} from "./period.ts";

/** `in N business days` — `chrono` has no concept of business days. */
const BUSINESS_DAYS = /^in\s+(\d+)\s+business\s+days?$/i;

/**
 * `first|last day of (the|this|next|last)? month|year|quarter|week`, and the
 * `start|beginning|end of …` synonyms.
 */
const DAY_OF_PERIOD =
  /^(first\s+day|last\s+day|start|beginning|end)\s+of\s+(?:(this|next|last)\s+|the\s+)?(month|year|quarter|week)$/i;

/** `monday in 3 weeks` — the Monday nearest to three weeks from now. */
const WEEKDAY_IN_WEEKS =
  /^([a-z]+)\s+in\s+(\d+|a|one|two|three|four)\s+weeks?$/i;

/** `first friday of next month`, `last monday of March 2027`, `2nd tuesday in october`. */
const NTH_WEEKDAY =
  /^(first|second|third|fourth|fifth|last|1st|2nd|3rd|4th|5th)\s+([a-z]+)\s+(?:of|in)\s+(.+)$/i;

const ORDINALS: Record<string, number> = {
  first: 1,
  "1st": 1,
  second: 2,
  "2nd": 2,
  third: 3,
  "3rd": 3,
  fourth: 4,
  "4th": 4,
  fifth: 5,
  "5th": 5,
  last: -1,
};

const COUNT_WORDS: Record<string, number> = {
  a: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
};

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

/**
 * `this|next|last month`, a month name (`march`, `Mar`) with an optional
 * year → `{ year, month }`. A bare month name that's already behind us this
 * year means next year's.
 */
function parseMonth(
  text: string,
  now: Date,
): { year: number; month: number } | null {
  const trimmed = text
    .trim()
    .toLowerCase()
    .replace(/^the\s+/, "");
  const shift = trimmed.match(/^(this|next|last)\s+month$/);
  if (shift) {
    const d = new Date(
      now.getFullYear(),
      now.getMonth() + PERIOD_SHIFT[shift[1]],
      1,
    );
    return { year: d.getFullYear(), month: d.getMonth() };
  }
  const named = trimmed.match(/^([a-z]{3,})\.?(?:\s+(\d{4}))?$/);
  if (!named) return null;
  const month = MONTHS.findIndex((m) => m.startsWith(named[1]));
  if (month === -1) return null;
  if (named[2]) return { year: Number(named[2]), month };
  return {
    year: month < now.getMonth() ? now.getFullYear() + 1 : now.getFullYear(),
    month,
  };
}

/** `first|last day of <year>` (`2029`) or `<month name>` (`March`, `Mar 2029`). */
const DAY_OF_DATE = /^(first|last)\s+day\s+of\s+(.+)$/i;

const PERIOD_SHIFT: Record<string, number> = { next: 1, last: -1, this: 0 };

/**
 * Resolves a natural date phrase into an actual calendar date — the fallback
 * every other `datetime` resolver falls through to. Two hand-rolled cases
 * `chrono` doesn't cover (business days, ordinal period boundaries), then
 * `chrono.parse` for everything else (`tomorrow`, `35 days ago`,
 * `monday in 3 weeks`, `2 weeks from now`).
 *
 * Only claims the query when `chrono`'s match spans the *entire* (trimmed)
 * input — a partial match (`"today"` inside `"today's news"`, `"monday"`
 * inside `"monday.com"`) means the query is something else that merely
 * contains a date-ish word, not a date phrase itself.
 */
export function resolveRelative(input: string, now: Date): Calculation | null {
  const businessMatch = input.match(BUSINESS_DAYS);
  if (businessMatch) {
    const date = addBusinessDays(now, Number(businessMatch[1]));
    const { value, rawValue } = formatDate(date, now);
    return { expression: input, value, rawValue };
  }

  const periodMatch = input.match(DAY_OF_PERIOD);
  if (periodMatch) {
    const [, which, when, periodWord] = periodMatch;
    const period = periodWord.toLowerCase() as Period;
    const ref = shiftPeriod(
      period,
      now,
      PERIOD_SHIFT[(when ?? "this").toLowerCase()],
    );
    const date = /^(?:first|start|beginning)/i.test(which)
      ? firstDayOfPeriod(period, ref)
      : lastDayOfPeriod(period, ref);
    const { value, rawValue } = formatDate(date, now);
    return { expression: input, value, rawValue };
  }

  const inWeeks = input.match(WEEKDAY_IN_WEEKS);
  if (inWeeks) {
    const weekday = weekdayIndex(inWeeks[1]);
    if (weekday !== null) {
      const weeks = COUNT_WORDS[inWeeks[2].toLowerCase()] ?? Number(inWeeks[2]);
      const target = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + weeks * 7,
      );
      // Nearest `weekday` to the target day; a tie (3 days either way) goes later.
      let delta = (weekday - target.getDay() + 7) % 7;
      if (delta > 3) delta -= 7;
      target.setDate(target.getDate() + delta);
      const { value, rawValue } = formatDate(target, now);
      return { expression: input, value, rawValue };
    }
  }

  const nth = input.match(NTH_WEEKDAY);
  if (nth) {
    const n = ORDINALS[nth[1].toLowerCase()];
    const weekday = weekdayIndex(nth[2]);
    const month = parseMonth(nth[3], now);
    if (weekday !== null && month) {
      const date = nthWeekday(month.year, month.month, weekday, n);
      if (!date) return null;
      const { value, rawValue } = formatDate(date, now);
      return { expression: input, value, rawValue };
    }
  }

  const dateMatch = input.match(DAY_OF_DATE);
  if (dateMatch) {
    const [, which, rest] = dateMatch;
    const year = rest.trim().match(/^\d{4}$/);
    // A bare year ⇒ the year's boundary; otherwise let `chrono` resolve the
    // phrase (`March`, `Mar 2029`, `next month`) and take that month's boundary.
    const anchor = year
      ? new Date(
          Number(year[0]),
          which === "first" ? 0 : 11,
          which === "first" ? 1 : 31,
        )
      : chrono.parseDate(rest, now, {});
    if (anchor) {
      const date = year
        ? anchor
        : which === "first"
          ? new Date(anchor.getFullYear(), anchor.getMonth(), 1)
          : new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
      const { value, rawValue } = formatDate(date, now);
      return { expression: input, value, rawValue };
    }
  }

  const forwardDate = !/\blast\b/i.test(input);
  const results = chrono.parse(input, now, { forwardDate });
  if (results.length !== 1) return null;

  const [result] = results;
  const fullSpan = result.index === 0 && result.text.length === input.length;
  if (!fullSpan) return null;

  const date = result.start.date();
  // A phrase that carries a time-of-day ("now + 90 min", "in 3 hours",
  // "tomorrow at 5pm") resolves to an exact moment — show it to the minute
  // rather than collapsing to a bare calendar day.
  const { value, rawValue } = result.start.isCertain("hour")
    ? formatDateTime(date, now)
    : formatDate(date, now);
  return { expression: input, value, rawValue };
}
