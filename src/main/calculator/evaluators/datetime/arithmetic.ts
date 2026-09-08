import * as chrono from "chrono-node";
import { add } from "date-fns";
import type { Calculation } from "../../../../shared/types";
import {
  dayDelta,
  dayRolloverHint,
  formatDate,
  formatDateTime,
  formatTimeOfDay,
} from "./format.ts";

/**
 * `<date-or-time> <+|-|plus|minus> <number> [unit]` — arithmetic *on* a date
 * or a clock time:
 *
 *   - `August 5 + 5`        → 5 days later  (bare number after a date ⇒ days)
 *   - `3:45pm + 5`          → 5 hours later (bare number after a time ⇒ hours)
 *   - `2026-01-15 + 3 weeks`, `today - 10 days`, `9:00 + 90 min`, `5pm - 2h`
 *
 * The unit is taken from an explicit token when present (`d`/`day`, `w`/`wk`/
 * `week`, `mo`/`month`, `y`/`year`, `h`/`hr`/`hour`, `m`/`min`/`minute`), else
 * inferred from whether the left side carried a time-of-day. Calendar-correct
 * month/year math is delegated to `date-fns`' `add`.
 */
const EXPR =
  /^(.+?)\s*(?:([+-])|\b(plus|minus)\b)\s*(\d+(?:\.\d+)?)\s*([a-z]+)?$/i;

type Unit =
  "years" | "months" | "weeks" | "days" | "hours" | "minutes" | "seconds";

const UNIT_ALIASES: Record<string, Unit> = {
  s: "seconds",
  sec: "seconds",
  secs: "seconds",
  second: "seconds",
  seconds: "seconds",
  m: "minutes",
  min: "minutes",
  mins: "minutes",
  minute: "minutes",
  minutes: "minutes",
  h: "hours",
  hr: "hours",
  hrs: "hours",
  hour: "hours",
  hours: "hours",
  d: "days",
  day: "days",
  days: "days",
  w: "weeks",
  wk: "weeks",
  wks: "weeks",
  week: "weeks",
  weeks: "weeks",
  mo: "months",
  mos: "months",
  mon: "months",
  mth: "months",
  mths: "months",
  month: "months",
  months: "months",
  y: "years",
  yr: "years",
  yrs: "years",
  year: "years",
  years: "years",
};

const CLOCK_UNITS = new Set<Unit>(["hours", "minutes", "seconds"]);

export function resolveArithmetic(
  input: string,
  now: Date,
): Calculation | null {
  const match = input.match(EXPR);
  if (!match) return null;
  const [, leftText, sign, word, amountText, unitToken] = match;

  const amount = Number(amountText);
  if (!Number.isFinite(amount)) return null;
  const signed = sign === "-" || /^minus$/i.test(word ?? "") ? -amount : amount;

  // The left side must parse *in full* as a date or clock time — this is what
  // keeps `5 + 3` (chrono parses nothing) out, on top of `math` claiming it
  // first anyway. Chrono's default (nearest interpretation, no `forwardDate`)
  // is what makes `August 5 + 5` count from *this* August, not next year's.
  const results = chrono.parse(leftText.trim(), now, {});
  if (results.length !== 1) return null;
  const [left] = results;
  if (left.index !== 0 || left.text.length !== leftText.trim().length)
    return null;

  let unit: Unit;
  if (unitToken) {
    const resolved = UNIT_ALIASES[unitToken.toLowerCase()];
    if (!resolved) return null;
    unit = resolved;
  } else {
    // Raycast's rule: a bare number is hours after a clock time, days after a date.
    unit = left.start.isCertain("hour") ? "hours" : "days";
  }

  const base = left.start.date();
  const result = add(base, { [unit]: signed });

  const isClockTime =
    left.start.isCertain("hour") &&
    !left.start.isCertain("day") &&
    !left.start.isCertain("month") &&
    !left.start.isCertain("weekday");

  // A pure time-of-day in ⇒ a pure time-of-day out ("3:45pm + 5" → "8:45 PM"),
  // with a hint when the arithmetic crossed midnight.
  if (isClockTime) {
    const { value, rawValue } = formatTimeOfDay(result);
    return {
      expression: input,
      value: value + dayRolloverHint(dayDelta(result, base)),
      rawValue,
    };
  }

  const withTime = left.start.isCertain("hour") || CLOCK_UNITS.has(unit);
  const { value, rawValue } = withTime
    ? formatDateTime(result, now)
    : formatDate(result, now);
  return { expression: input, value, rawValue };
}
