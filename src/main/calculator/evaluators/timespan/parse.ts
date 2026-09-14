import {
  DAY_S,
  HOUR_S,
  MINUTE_S,
  WEEK_S,
  parseTimespanParts,
  timeUnitSeconds,
  type TimespanPart,
} from "../../common/timespan.ts";

/**
 * What a timespan query asks for:
 *
 *  - `span`    — show a duration broken down: `9000 seconds`, `145 mins to timespan`,
 *                `1h 30m + 45m`
 *  - `convert` — a duration as a total in one unit: `90 minutes in seconds`
 */
export type TimespanQuery =
  | { kind: "span"; seconds: number }
  | { kind: "convert"; seconds: number; unit: ConvertUnit };

export interface ConvertUnit {
  /** Plural display word, `"seconds"`. */
  name: string;
  seconds: number;
}

/** Units a span can be converted *into* — deliberately no months/years (not fixed lengths). */
const CONVERT_UNITS: ReadonlyArray<ConvertUnit> = [
  { name: "milliseconds", seconds: 0.001 },
  { name: "seconds", seconds: 1 },
  { name: "minutes", seconds: MINUTE_S },
  { name: "hours", seconds: HOUR_S },
  { name: "days", seconds: DAY_S },
  { name: "weeks", seconds: WEEK_S },
];

/** A months/years amount has no fixed length — that's a calendar question for `datetime`. */
const CALENDAR_UNIT = /^(?:mo|mos|months?|y|yrs?|years?)$/i;

/** `"1h 30m"` — but not a lone `"10 m"` (metres) and not calendar units. */
function spanSeconds(
  text: string,
  { allowBareM }: { allowBareM: boolean },
): number | null {
  const parts = parseTimespanParts(text);
  if (!parts) return null;
  if (parts.some((p) => CALENDAR_UNIT.test(p.unit))) return null;
  if (!allowBareM && isBareMetre(parts)) return null;
  return parts.reduce((sum, p) => sum + p.amount * p.unitSeconds, 0);
}

/** A single `<n> m` part — reads as metres (auto unit conversion), not minutes. */
function isBareMetre(parts: TimespanPart[]): boolean {
  return parts.length === 1 && /^m$/i.test(parts[0].unit);
}

const HUMAN_TARGET =
  /^(.+?)\s+(?:to|as|in|into)\s+(?:a\s+)?(?:timespan|time\s*span|human(?:\s+readable)?|duration)$/i;

const UNIT_TARGET = /^(.+?)\s+(?:to|in|into|as)\s+([a-z]+)$/i;

/** `<span> (+|-) <span> …`, optionally `* n` / `/ n` at the end. */
const ARITHMETIC_SPLIT = /\s*([+-])\s*/;
const SCALE = /^(.+?)\s*([*/x×])\s*(\d+(?:\.\d+)?)$/i;

export function parseTimespanQuery(input: string): TimespanQuery | null {
  const text = input.trim();

  const human = text.match(HUMAN_TARGET);
  if (human) {
    const seconds = spanExpression(human[1]);
    return seconds == null ? null : { kind: "span", seconds };
  }

  const target = text.match(UNIT_TARGET);
  if (target) {
    const unitSeconds = timeUnitSeconds(target[2]);
    const unit = CONVERT_UNITS.find((u) => u.seconds === unitSeconds);
    if (!unit) return null;
    const seconds = spanExpression(target[1]);
    return seconds == null ? null : { kind: "convert", seconds, unit };
  }

  const seconds = spanExpression(text, { bare: true });
  return seconds == null ? null : { kind: "span", seconds };
}

/**
 * `"1h 30m + 45m"`, `"3600s + 45m"`, `"2h - 15 min"`, `"1h 30m * 2"` → seconds.
 * A lone span (`"9000 seconds"`) is accepted too, except a bare `"10 m"`
 * when `bare` is set (the whole query, where metres is the likelier reading).
 */
function spanExpression(text: string, { bare = false } = {}): number | null {
  let body = text.trim();
  let factor = 1;

  const scale = body.match(SCALE);
  if (scale) {
    const n = Number(scale[3]);
    if (scale[2] === "/") {
      if (n === 0) return null;
      factor = 1 / n;
    } else {
      factor = n;
    }
    body = scale[1];
  }

  const pieces = body.split(ARITHMETIC_SPLIT);
  // `split` with a capture group alternates [term, op, term, op, term…].
  if (pieces[0] === "") return null;
  const single = pieces.length === 1;

  let total = 0;
  for (let i = 0; i < pieces.length; i += 2) {
    const seconds = spanSeconds(pieces[i], {
      allowBareM: !(bare && single && factor === 1),
    });
    if (seconds == null) return null;
    const sign = i === 0 ? 1 : pieces[i - 1] === "-" ? -1 : 1;
    total += sign * seconds;
  }
  return total * factor;
}
