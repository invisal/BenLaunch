import { fromZonedTime } from "date-fns-tz";
import { isValidIsoDate } from "../../common/calendar.ts";
import type { Calculation } from "../../../../shared/types";
import { parseTimeOfDay } from "./time.ts";
import { resolvePlace } from "./places.ts";
import {
  calendarDate,
  formatClock,
  formatShortDate,
  formatWeekday,
} from "./format.ts";
import { systemZone } from "./clock.ts";

/** `<left> in|to <dest place>` — the outer split; `left` still needs a leading time token. */
const CONVERT = /^(.+?)\s+(?:in|to)\s+(.+)$/i;

/** A leading time token, with an optional trailing place: `5pm ldn`, `noon`, `9:30am NYC`. */
const LEADING_TIME =
  /^(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|noon|midnight)(?:\s+(.+))?$/i;

/** A date before the time: `2026-03-15 14:00 …`, `tomorrow 5pm …`. */
const LEADING_DATE = /^(\d{4}-\d{2}-\d{2}|today|tomorrow|yesterday)\s+(.+)$/i;

/** A day word right after the time, before or after the source place: `5pm tomorrow ldn`, `5pm ldn tomorrow`. */
const DAY_WORD_FIRST = /^(today|tomorrow|yesterday)(?:\s+(.+))?$/i;
const DAY_WORD_LAST = /^(.+?)\s+(today|tomorrow|yesterday)$/i;

const DAY_OFFSET: Record<string, number> = {
  today: 0,
  tomorrow: 1,
  yesterday: -1,
};

/** `yyyy-MM-dd` shifted by whole days (calendar arithmetic, no zone involved). */
function shiftIsoDate(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return shifted.toISOString().slice(0, 10);
}

/**
 * Converts a specific time from one place/zone to another: `5pm ldn in sf`,
 * `9:30am NYC to Berlin`, `noon Tokyo in London`, `2026-03-15 14:00 UTC in
 * Tokyo`, `5pm tomorrow in tokyo`. The source is today's date in the source
 * zone unless the query gives one (an ISO date or today/tomorrow/yesterday); a bare time with no source
 * place defaults to `localZone` (the system's own, by default — injectable so
 * tests don't depend on the host machine's configured timezone).
 */
export function resolveConvert(
  input: string,
  now: Date,
  localZone: string = systemZone(),
): Calculation | null {
  const outer = input.match(CONVERT);
  if (!outer) return null;
  const [, left, destText] = outer;

  // An optional date: before the time (`2026-03-15 14:00`, `tomorrow 5pm`) or
  // a day word after it (`5pm tomorrow ldn`, `5pm ldn tomorrow`).
  let rest = left.trim();
  let dateText: string | undefined;
  const leadingDate = rest.match(LEADING_DATE);
  if (leadingDate) [, dateText, rest] = leadingDate;

  const leading = rest.match(LEADING_TIME);
  if (!leading) return null;
  const timeText = leading[1];
  let srcText = leading[2];
  if (!dateText && srcText) {
    const first = srcText.match(DAY_WORD_FIRST);
    const last = first ? null : srcText.match(DAY_WORD_LAST);
    if (first) [, dateText, srcText] = first;
    else if (last) [, srcText, dateText] = last;
  }

  const time = parseTimeOfDay(timeText);
  if (!time) return null;

  // fuzzy: false — this whole shape ("<time> [text] in|to <text>") is already
  // speculative (it runs on any query that merely looks like it, before
  // either side is known to be a place), unlike clock.ts's `time in <place>`,
  // which only fuzzy-matches after the user has explicitly said "time in".
  // With ~450 zone/country names now searchable (see places.ts), a fuzzy
  // fallback here would happily "resolve" a 3-letter currency or unit code —
  // "usd" is a subsequence of "South Sudan", "mph" of "Thimphu" — and hijack
  // an ordinary currency/unit query.
  const srcZone = srcText
    ? resolvePlace(srcText, { fuzzy: false })?.timezone
    : localZone;
  if (!srcZone) return null;

  const dest = resolvePlace(destText, { fuzzy: false });
  if (!dest) return null;

  // `new Date` would roll a typo like `2026-02-31` over into March.
  if (dateText && /^\d/.test(dateText) && !isValidIsoDate(dateText))
    return null;

  const todaySrc = calendarDate(now, srcZone);
  const baseDate = !dateText
    ? todaySrc
    : /^\d/.test(dateText)
      ? dateText
      : shiftIsoDate(todaySrc, DAY_OFFSET[dateText.toLowerCase()]);
  const [y, m, d] = baseDate.split("-").map(Number);
  const wallTime = new Date(y, m - 1, d, time.hour, time.minute);
  const instant = fromZonedTime(wallTime, srcZone);

  const destDate = calendarDate(instant, dest.timezone);
  const rollover =
    destDate > baseDate
      ? " (next day)"
      : destDate < baseDate
        ? " (prev day)"
        : "";

  // A query that named a day gets the destination's date spelled out too.
  const day = dateText
    ? `${formatWeekday(instant, dest.timezone)}, ${formatShortDate(instant, dest.timezone)}`
    : formatWeekday(instant, dest.timezone);
  const value = `${formatClock(instant, dest.timezone)} ${day}${rollover}`;
  return {
    expression: input,
    value,
    rawValue: formatClock(instant, dest.timezone),
  };
}
