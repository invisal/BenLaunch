import { fromZonedTime } from 'date-fns-tz'
import type { Calculation } from '../../../../shared/types'
import { parseTimeOfDay } from './time.ts'
import { resolvePlace } from './places.ts'
import { calendarDate, formatClock, formatWeekday } from './format.ts'
import { systemZone } from './clock.ts'

/** `<left> in|to <dest place>` — the outer split; `left` still needs a leading time token. */
const CONVERT = /^(.+?)\s+(?:in|to)\s+(.+)$/i

/** A leading time token, with an optional trailing place: `5pm ldn`, `noon`, `9:30am NYC`. */
const LEADING_TIME =
  /^(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|noon|midnight)(?:\s+(.+))?$/i

/**
 * Converts a specific time from one place/zone to another: `5pm ldn in sf`,
 * `9:30am NYC to Berlin`, `noon Tokyo in London`. The source is today's date
 * in the source zone unless the query gives one; a bare time with no source
 * place defaults to `localZone` (the system's own, by default — injectable so
 * tests don't depend on the host machine's configured timezone).
 */
export function resolveConvert(
  input: string,
  now: Date,
  localZone: string = systemZone(),
): Calculation | null {
  const outer = input.match(CONVERT)
  if (!outer) return null
  const [, left, destText] = outer

  const leading = left.trim().match(LEADING_TIME)
  if (!leading) return null
  const [, timeText, srcText] = leading

  const time = parseTimeOfDay(timeText)
  if (!time) return null

  // fuzzy: false — this whole shape ("<time> [text] in|to <text>") is already
  // speculative (it runs on any query that merely looks like it, before
  // either side is known to be a place), unlike clock.ts's `time in <place>`,
  // which only fuzzy-matches after the user has explicitly said "time in".
  // With ~450 zone/country names now searchable (see places.ts), a fuzzy
  // fallback here would happily "resolve" a 3-letter currency or unit code —
  // "usd" is a subsequence of "South Sudan", "mph" of "Thimphu" — and hijack
  // an ordinary currency/unit query.
  const srcZone = srcText ? resolvePlace(srcText, { fuzzy: false })?.timezone : localZone
  if (!srcZone) return null

  const dest = resolvePlace(destText, { fuzzy: false })
  if (!dest) return null

  const todaySrc = calendarDate(now, srcZone)
  const [y, m, d] = todaySrc.split('-').map(Number)
  const wallTime = new Date(y, m - 1, d, time.hour, time.minute)
  const instant = fromZonedTime(wallTime, srcZone)

  const destDate = calendarDate(instant, dest.timezone)
  const rollover = destDate > todaySrc ? ' (next day)' : destDate < todaySrc ? ' (prev day)' : ''

  const value = `${formatClock(instant, dest.timezone)} ${formatWeekday(instant, dest.timezone)}${rollover}`
  return { expression: input, value, rawValue: formatClock(instant, dest.timezone) }
}
