import * as chrono from "chrono-node";
import type { Calculation } from "../../../../shared/types";
import {
  formatCalendarSpan,
  formatDate,
  formatDuration,
  normalizeDurationUnit,
} from "./format.ts";
import { resolveHoliday } from "./holidays.ts";
import { lastDayOfPeriod, quarterStart, type Period } from "./period.ts";

/**
 * `days|weeks|months|hours until|till|to <target>` — "days until 25 Dec" —
 * and `time|how long until <target>` for the full breakdown.
 */
const COUNTDOWN_TO =
  /^(days?|weeks?|months?|hours?|time|how\s+long)\s+(?:is\s+(?:it\s+|left\s+)?)?(?:until|till|to)\s+(.+)$/i;

/** `days|weeks|months|time left in (the) quarter|year|month|week`. */
const LEFT_IN_PERIOD =
  /^(days?|weeks?|months?|time)\s+left\s+in\s+(?:the\s+|this\s+)?(quarter|year|month|week)$/i;

/**
 * A countdown target: `Q4` (start of the next Q4), a bare year (`2027` →
 * 1 Jan), a holiday (`christmas`), or anything `chrono` reads.
 */
export function parseTarget(text: string, now: Date): Date | null {
  const trimmed = text.trim();

  const quarter = trimmed.match(/^q([1-4])(?:\s+(\d{4}))?$/i);
  if (quarter) {
    const q = Number(quarter[1]);
    if (quarter[2]) return quarterStart(q, Number(quarter[2]));
    const thisYear = quarterStart(q, now.getFullYear());
    return thisYear > now ? thisYear : quarterStart(q, now.getFullYear() + 1);
  }

  if (/^\d{4}$/.test(trimmed)) return new Date(Number(trimmed), 0, 1);

  return (
    resolveHoliday(trimmed, now) ??
    chrono.parseDate(trimmed, now, { forwardDate: true })
  );
}

/** `time until X` — the exact calendar span, down to the minute; the chip names the day. */
function fullBreakdown(
  input: string,
  now: Date,
  target: Date,
  chip: { label: string; date: Date } = { label: "On", date: target },
): Calculation {
  return {
    expression: input,
    value: formatCalendarSpan(now, target),
    rawValue: String(Math.round((target.getTime() - now.getTime()) / 60_000)),
    details: [{ label: chip.label, value: formatDate(chip.date, now).value }],
  };
}

const isFullBreakdown = (unitWord: string) =>
  /^(?:time|how\s+long)$/i.test(unitWord);

/**
 * Countdowns: `days until 25 Dec` → a duration, not a date; `time until 2027`
 * → the exact span. Claims only the
 * `until/till/to <target>` and `left in the <period>` shapes — anything else
 * falls through to `difference` / `relative`.
 */
export function resolveCountdown(input: string, now: Date): Calculation | null {
  const toMatch = input.match(COUNTDOWN_TO);
  if (toMatch) {
    const [, unitWord, targetText] = toMatch;
    const target = parseTarget(targetText, now);
    if (!target) return null;

    const ms = target.getTime() - now.getTime();
    if (ms <= 0) return null;
    if (isFullBreakdown(unitWord)) return fullBreakdown(input, now, target);

    const { value, rawValue } = formatDuration(
      ms,
      normalizeDurationUnit(unitWord),
    );
    return { expression: input, value, rawValue };
  }

  const leftMatch = input.match(LEFT_IN_PERIOD);
  if (leftMatch) {
    const [, unitWord, period] = leftMatch;
    const end = lastDayOfPeriod(period as Period, now);
    const ms = end.getTime() - now.getTime();
    if (ms <= 0) return null;
    // Count to the midnight that closes the period, not 23:59:59.999.
    if (isFullBreakdown(unitWord)) {
      return fullBreakdown(input, now, new Date(end.getTime() + 1), {
        label: "Ends",
        date: end,
      });
    }

    const { value, rawValue } = formatDuration(
      ms,
      normalizeDurationUnit(unitWord),
    );
    return { expression: input, value, rawValue };
  }

  return null;
}
