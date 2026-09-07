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

export type DurationUnit = 'hours' | 'days' | 'weeks' | 'months'

/** Auto-pick a unit for a duration: days under 8 weeks, then weeks, then months. */
function autoUnit(ms: number): DurationUnit {
  const days = ms / DAY_MS
  if (days < 56) return 'days'
  if (days < 180) return 'weeks'
  return 'months'
}

const UNIT_MS: Record<DurationUnit, number> = {
  hours: 60 * 60 * 1000,
  days: DAY_MS,
  weeks: 7 * DAY_MS,
  months: 30.4368 * DAY_MS, // average Gregorian month
}

/** `"243 days"`, `"6 weeks"` — `unit` defaults to `autoUnit(ms)`. */
export function formatDuration(
  ms: number,
  unit?: DurationUnit,
): { value: string; rawValue: string } {
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
