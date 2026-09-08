import type { Calculation } from "../../../../shared/types";
import {
  resolveCountryZones,
  resolvePlace,
  type CountryZones,
} from "./places.ts";
import {
  calendarDate,
  formatClock,
  formatWeekday,
  offsetLabel,
} from "./format.ts";

/** `time in Tokyo`, `time at sf`, `what time is it in Berlin`. */
const TIME_IN =
  /^(?:what\s+time\s+(?:is\s+it\s+)?(?:in|at)|time\s+(?:in|at))\s+(.+)$/i;

/** `Tokyo time` — trailing "time". Exact/alias match only (no fuzzy — this
 *  shape is common enough in ordinary phrases, e.g. "lunch time", that a
 *  fuzzy place match would risk false positives). */
const TRAILING_TIME = /^(.+?)\s+time$/i;

/** A relative offset from now: `6 hours`, `90 min`, `2 days`, `an hour`,
 *  optionally `... ago` for the past. */
const OFFSET =
  /^(a|an|\d+(?:\.\d+)?)\s*(minutes?|mins?|hours?|hrs?|days?)(\s+ago)?$/i;

function parseOffsetMs(text: string): number | null {
  const match = text.trim().match(OFFSET);
  if (!match) return null;

  const [, amountText, unitText, ago] = match;
  const amount = /^an?$/i.test(amountText) ? 1 : Number(amountText);
  if (!Number.isFinite(amount)) return null;

  const u = unitText.toLowerCase();
  const unitMs = u.startsWith("d")
    ? 86_400_000
    : u.startsWith("h")
      ? 3_600_000
      : 60_000;
  const ms = amount * unitMs;
  return ago ? -ms : ms;
}

/**
 * A trailing arithmetic offset on the place: `"Tokyo + 6 hours"`,
 * `"Tokyo - 90 min"`, `"Tokyo + 6"` (bare number ⇒ hours, since a `time in
 * <place>` query is inherently about the clock). → `{ offsetMs, placeText }`.
 */
const ARITH_OFFSET = /^(.+?)\s*([+-])\s*(\d+(?:\.\d+)?)\s*([a-z]+)?$/i;

function splitArithmeticOffset(
  tail: string,
): { offsetMs: number; placeText: string } | null {
  const match = tail.match(ARITH_OFFSET);
  if (!match) return null;

  const [, placeText, sign, amountText, unitToken] = match;
  const amount = Number(amountText);
  if (!Number.isFinite(amount)) return null;

  const u = unitToken?.toLowerCase();
  let unitMs: number;
  if (!u) unitMs = 3_600_000;
  else if (/^(?:m|mins?|minutes?)$/.test(u)) unitMs = 60_000;
  else if (/^(?:h|hrs?|hours?)$/.test(u)) unitMs = 3_600_000;
  else if (/^(?:d|days?)$/.test(u)) unitMs = 86_400_000;
  else if (/^(?:w|wks?|weeks?)$/.test(u)) unitMs = 7 * 86_400_000;
  else return null;

  return {
    offsetMs: amount * unitMs * (sign === "-" ? -1 : 1),
    placeText: placeText.trim(),
  };
}

/**
 * Peels a relative offset off either end of a `time in …` tail:
 * `"6 hours in Tokyo"` (leading), `"Tokyo in 6 hours"` / `"Tokyo 6 hours ago"`
 * (trailing) → `{ offsetMs, placeText }`. `null` when no offset is present, so
 * the plain `time in <place>` path is unaffected.
 */
function splitOffset(
  tail: string,
): { offsetMs: number; placeText: string } | null {
  const lead = tail.match(/^(.+?)\s+in\s+(.+)$/i);
  if (lead) {
    const offsetMs = parseOffsetMs(lead[1]);
    if (offsetMs !== null) return { offsetMs, placeText: lead[2] };
  }

  const trail = tail.match(/^(.+)\s+in\s+(.+?)$/i);
  if (trail) {
    const offsetMs = parseOffsetMs(trail[2]);
    if (offsetMs !== null) return { offsetMs, placeText: trail[1] };
  }

  const ago = tail.match(
    /^(.+?)\s+(\d+(?:\.\d+)?\s*(?:minutes?|mins?|hours?|hrs?|days?)\s+ago)$/i,
  );
  if (ago) {
    const offsetMs = parseOffsetMs(ago[2]);
    if (offsetMs !== null) return { offsetMs, placeText: ago[1] };
  }

  return null;
}

export function systemZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function build(
  placeName: string,
  zone: string,
  now: Date,
  localZone: string,
): Calculation {
  const clock = formatClock(now, zone);
  const offset = offsetLabel(zone, now);
  const differentDay = calendarDate(now, zone) !== calendarDate(now, localZone);
  const value = differentDay
    ? `${clock} ${formatWeekday(now, zone)} · ${offset}`
    : `${clock} · ${offset}`;

  return { expression: `time in ${placeName}`, value, rawValue: clock };
}

/**
 * A multi-zone country ("time in the united states") lists every zone it
 * currently spans rather than silently picking one — see
 * `resolveCountryZones`. `items` (one `{ city, "HH:MM · GMT±N" }` per zone,
 * west to east) is what the panel actually renders, as a horizontally-
 * scrolling row of chips; `value`/`rawValue` stay flat strings so copy/paste
 * and "use as input" still get plain text.
 */
function buildList(
  country: string,
  zones: CountryZones["zones"],
  now: Date,
): Calculation {
  const items = zones.map((zone) => ({
    label: zone.name,
    value: `${formatClock(now, zone.timezone)} · ${offsetLabel(zone.timezone, now)}`,
  }));
  const parts = items.map(({ label, value }) => `${label} ${value}`);
  return {
    expression: `time in ${country}`,
    value: parts.join("  ·  "),
    rawValue: parts.join(", "),
    items,
  };
}

function resolve(
  placeText: string,
  now: Date,
  localZone: string,
  fuzzy: boolean,
): Calculation | null {
  const country = resolveCountryZones(placeText, now);
  if (country) return buildList(country.country, country.zones, now);

  const place = resolvePlace(placeText, fuzzy ? {} : { fuzzy: false });
  return place ? build(place.name, place.timezone, now, localZone) : null;
}

/**
 * Current time in a place: `time in Tokyo` → `"17:27 · GMT+9"`. `localZone`
 * (defaults to the system's own) is the "viewer's day" the weekday-append
 * rule compares against — injectable so tests don't depend on the host
 * machine's configured timezone.
 */
export function resolveClock(
  input: string,
  now: Date,
  localZone: string = systemZone(),
): Calculation | null {
  const explicit = input.match(TIME_IN);
  if (explicit) {
    // `time in 4 hours` — no place, just an offset: the viewer's own wall
    // clock then. A day rollover is flagged with the weekday; no GMT label,
    // since it's the local zone.
    const bareOffset = parseOffsetMs(explicit[1]);
    if (bareOffset !== null) {
      const at = new Date(now.getTime() + bareOffset);
      const clock = formatClock(at, localZone);
      const rolled =
        calendarDate(at, localZone) !== calendarDate(now, localZone);
      const value = rolled ? `${clock} ${formatWeekday(at, localZone)}` : clock;
      return { expression: input.trim(), value, rawValue: clock };
    }

    // `time in 6 hours in Tokyo` / `time in Tokyo in 6 hours` — the wall-clock
    // time in <place> at a moment offset from now, not the current time.
    const shifted =
      splitOffset(explicit[1]) ?? splitArithmeticOffset(explicit[1]);
    if (shifted) {
      const at = new Date(now.getTime() + shifted.offsetMs);
      const calc = resolve(shifted.placeText, at, localZone, true);
      return calc && { ...calc, expression: input.trim() };
    }
    return resolve(explicit[1], now, localZone, true);
  }

  const trailing = input.match(TRAILING_TIME);
  if (trailing) return resolve(trailing[1], now, localZone, false);

  return null;
}
