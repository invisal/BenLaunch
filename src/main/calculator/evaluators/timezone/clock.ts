import type { Calculation } from '../../../../shared/types'
import { resolveCountryZones, resolvePlace, type CountryZones } from './places.ts'
import { calendarDate, formatClock, formatWeekday, offsetLabel } from './format.ts'

/** `time in Tokyo`, `time at sf`, `what time is it in Berlin`. */
const TIME_IN = /^(?:what\s+time\s+(?:is\s+it\s+)?(?:in|at)|time\s+(?:in|at))\s+(.+)$/i

/** `Tokyo time` — trailing "time". Exact/alias match only (no fuzzy — this
 *  shape is common enough in ordinary phrases, e.g. "lunch time", that a
 *  fuzzy place match would risk false positives). */
const TRAILING_TIME = /^(.+?)\s+time$/i

export function systemZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

function build(placeName: string, zone: string, now: Date, localZone: string): Calculation {
  const clock = formatClock(now, zone)
  const offset = offsetLabel(zone, now)
  const differentDay = calendarDate(now, zone) !== calendarDate(now, localZone)
  const value = differentDay ? `${clock} ${formatWeekday(now, zone)} · ${offset}` : `${clock} · ${offset}`

  return { expression: `time in ${placeName}`, value, rawValue: clock }
}

/**
 * A multi-zone country ("time in the united states") lists every zone it
 * currently spans rather than silently picking one — see
 * `resolveCountryZones`. `items` (one `{ city, "HH:MM · GMT±N" }` per zone,
 * west to east) is what the panel actually renders, as a horizontally-
 * scrolling row of chips; `value`/`rawValue` stay flat strings so copy/paste
 * and "use as input" still get plain text.
 */
function buildList(country: string, zones: CountryZones['zones'], now: Date): Calculation {
  const items = zones.map((zone) => ({
    label: zone.name,
    value: `${formatClock(now, zone.timezone)} · ${offsetLabel(zone.timezone, now)}`,
  }))
  const parts = items.map(({ label, value }) => `${label} ${value}`)
  return {
    expression: `time in ${country}`,
    value: parts.join('  ·  '),
    rawValue: parts.join(', '),
    items,
  }
}

function resolve(placeText: string, now: Date, localZone: string, fuzzy: boolean): Calculation | null {
  const country = resolveCountryZones(placeText, now)
  if (country) return buildList(country.country, country.zones, now)

  const place = resolvePlace(placeText, fuzzy ? {} : { fuzzy: false })
  return place ? build(place.name, place.timezone, now, localZone) : null
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
  const explicit = input.match(TIME_IN)
  if (explicit) return resolve(explicit[1], now, localZone, true)

  const trailing = input.match(TRAILING_TIME)
  if (trailing) return resolve(trailing[1], now, localZone, false)

  return null
}
