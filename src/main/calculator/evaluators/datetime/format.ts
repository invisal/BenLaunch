/** Shared formatting for the `datetime` evaluator's three resolvers. */

export const DAY_MS = 24 * 60 * 60 * 1000

/**
 * `"yyyy-mm-dd"`, for `rawValue` — pasteable and unambiguous. Built from local
 * date components (not `toISOString`, which is UTC-based and can land on the
 * wrong calendar day) since `chrono` resolves relative dates in local time.
 */
function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * `"17 May"`, or `"17 May 2028"` when `d` falls in a different year than
 * `now` — matches Raycast's "only show the year when it's not implied". Uses
 * the system's local timezone, same as `chrono`'s own default.
 */
export function formatDate(d: Date, now: Date): { value: string; rawValue: string } {
  const sameYear = d.getFullYear() === now.getFullYear()
  const value = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(d)
  return { value, rawValue: isoDate(d) }
}

/**
 * `"Tue, Sep 8, 4:00 PM"` — same as `formatDate` but with a to-the-minute
 * time, for phrases that carry a time-of-day (`"now + 90 min"`, `"in 3
 * hours"`, `"tomorrow at 5pm"`). `rawValue` is `"yyyy-mm-dd hh:mm"` (local,
 * 24-hour) so it stays pasteable and unambiguous.
 */
export function formatDateTime(d: Date, now: Date): { value: string; rawValue: string } {
  const sameYear = d.getFullYear() === now.getFullYear()
  const value = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(d)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return { value, rawValue: `${isoDate(d)} ${hh}:${mm}` }
}

/**
 * `"8:45 PM"` — a bare clock time with no date, for `datetime` arithmetic on a
 * pure time-of-day (`3:45pm + 5`, `14:30 + 90 min`). `rawValue` is 24-hour
 * `"hh:mm"`.
 */
export function formatTimeOfDay(d: Date): { value: string; rawValue: string } {
  const value = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(d)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return { value, rawValue: `${hh}:${mm}` }
}

/**
 * Whole-calendar-day delta (local time) from `base` to `d` — for the
 * `" (next day)"` / `" (in 2 days)"` hint on clock-time arithmetic that
 * rolls past midnight.
 */
export function dayDelta(d: Date, base: Date): number {
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const b = new Date(base.getFullYear(), base.getMonth(), base.getDate())
  return Math.round((a.getTime() - b.getTime()) / DAY_MS)
}

/** `" (next day)"`, `" (in 3 days)"`, `" (prev day)"`, `""` — suffix for `dayDelta`. */
export function dayRolloverHint(delta: number): string {
  if (delta === 0) return ''
  if (delta === 1) return ' (next day)'
  if (delta === -1) return ' (prev day)'
  return delta > 0 ? ` (in ${delta} days)` : ` (${-delta} days ago)`
}

export type DurationUnit = 'hours' | 'days' | 'weeks' | 'months'

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS

/** Auto-pick a unit for a duration: days under 8 weeks, then weeks, then months. */
function autoUnit(ms: number): DurationUnit {
  const days = ms / DAY_MS
  if (days < 56) return 'days'
  if (days < 180) return 'weeks'
  return 'months'
}

const UNIT_MS: Record<DurationUnit, number> = {
  hours: HOUR_MS,
  days: DAY_MS,
  weeks: 7 * DAY_MS,
  months: 30.4368 * DAY_MS, // average Gregorian month
}

const plural = (n: number, unit: string): string => `${n} ${n === 1 ? unit : `${unit}s`}`

/**
 * A sub-day span, to the minute: `"45 minutes"`, `"9 hours 45 minutes"`,
 * `"3 hours"`. Used for the auto path (no explicit unit) so `now until 9AM`
 * doesn't round to `"1 day"`. `rawValue` is the total minute count.
 */
function formatShortDuration(ms: number): { value: string; rawValue: string } {
  const totalMinutes = Math.round(ms / MINUTE_MS)
  if (totalMinutes < 60) {
    return { value: plural(totalMinutes, 'minute'), rawValue: String(totalMinutes) }
  }
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  const value = m === 0 ? plural(h, 'hour') : `${plural(h, 'hour')} ${plural(m, 'minute')}`
  return { value, rawValue: String(totalMinutes) }
}

/** `"243 days"`, `"6 weeks"` — `unit` defaults to `autoUnit(ms)`. */
export function formatDuration(
  ms: number,
  unit?: DurationUnit,
): { value: string; rawValue: string } {
  if (!unit && ms < DAY_MS) return formatShortDuration(ms)
  const chosen = unit ?? autoUnit(ms)
  const n = Math.round(ms / UNIT_MS[chosen])
  const label = n === 1 ? chosen.slice(0, -1) : chosen
  return { value: `${n} ${label}`, rawValue: String(n) }
}

/** Singular/plural unit word ("day"/"days") → the plural `DurationUnit` key. */
export function normalizeDurationUnit(word: string): DurationUnit {
  const w = word.toLowerCase()
  if (w.startsWith('hour')) return 'hours'
  if (w.startsWith('week')) return 'weeks'
  if (w.startsWith('month')) return 'months'
  return 'days'
}
