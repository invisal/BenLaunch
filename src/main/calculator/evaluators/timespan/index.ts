import type { Calculation } from "../../../../shared/types";
import type { Evaluator } from "../../types.ts";
import { formatNumber } from "../../common/locale.ts";
import { roundDisplay } from "../../common/precision.ts";
import { HOUR_S, MINUTE_S, formatTimespan } from "../../common/timespan.ts";
import { parseTimespanQuery } from "./parse.ts";

/**
 * The timespan evaluator — durations as people say them (pere-doc #16).
 *
 *   - break a duration down — "9000 seconds" → "2 hours 30 minutes",
 *     "145 mins to timespan" → "2 hours 25 minutes"
 *   - duration arithmetic — "1h 30m + 45m" → "2 hours 15 minutes"
 *   - a duration as a total — "90 minutes in seconds" → "5,400 seconds"
 *
 * First in the pipeline: `math` would read `1h 30m + 45m` as nothing and
 * `datetime` would read a bare `90 min` as "in 90 minutes". Cheap to reject —
 * anything without a digit immediately followed (or space-separated) by a
 * time-unit word never reaches the parser.
 */
const LOOKS_LIKE_SPAN =
  /\d\s*(?:ms|msecs?|milliseconds?|s|secs?|seconds?|m|mins?|minutes?|h|hrs?|hours?|d|days?|w|wks?|weeks?)\b/i;

/** `2:30:00` — the clock form of a span, for media/timecode use. */
function clock(seconds: number): string {
  const total = Math.round(Math.abs(seconds));
  const h = Math.floor(total / HOUR_S);
  const m = Math.floor((total % HOUR_S) / MINUTE_S);
  const s = total % MINUTE_S;
  const sign = seconds < 0 ? "-" : "";
  return `${sign}${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** The span as a single total in the biggest unit it fills — `2.5 hours`, `90 minutes`. */
function total(seconds: number): { label: string; value: string } | null {
  const abs = Math.abs(seconds);
  if (abs >= HOUR_S)
    return {
      label: "Total",
      value: `${formatNumber(roundDisplay(seconds / HOUR_S))} hours`,
    };
  if (abs >= MINUTE_S)
    return {
      label: "Total",
      value: `${formatNumber(roundDisplay(seconds / MINUTE_S))} minutes`,
    };
  return null;
}

function run(input: string): Calculation | null {
  if (!LOOKS_LIKE_SPAN.test(input)) return null;
  const query = parseTimespanQuery(input);
  if (!query) return null;

  if (query.kind === "convert") {
    const n = roundDisplay(query.seconds / query.unit.seconds);
    return {
      expression: input,
      value: `${formatNumber(n)} ${n === 1 ? query.unit.name.slice(0, -1) : query.unit.name}`,
      rawValue: String(n),
    };
  }

  const details = [
    total(query.seconds),
    { label: "Clock", value: clock(query.seconds) },
  ].filter((d): d is { label: string; value: string } => d !== null);
  return {
    expression: input,
    value: formatTimespan(query.seconds),
    rawValue: String(roundDisplay(query.seconds)),
    details,
  };
}

export const timespan: Evaluator = { id: "timespan", evaluate: run };
