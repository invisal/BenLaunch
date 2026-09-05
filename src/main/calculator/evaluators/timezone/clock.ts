import type { Calculation } from '../../../../shared/types'
import { resolvePlace } from './places.ts'
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
  if (explicit) {
    const place = resolvePlace(explicit[1])
    return place ? build(place.name, place.timezone, now, localZone) : null
  }

  const trailing = input.match(TRAILING_TIME)
  if (trailing) {
    const place = resolvePlace(trailing[1], { fuzzy: false })
    return place ? build(place.name, place.timezone, now, localZone) : null
  }

  return null
}
