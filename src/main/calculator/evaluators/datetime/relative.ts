import * as chrono from 'chrono-node'
import type { Calculation } from '../../../../shared/types'
import { formatDate, formatDateTime } from './format.ts'
import { firstDayOfPeriod, lastDayOfPeriod, shiftPeriod, type Period } from './period.ts'

/** `in N business days` — `chrono` has no concept of business days. */
const BUSINESS_DAYS = /^in\s+(\d+)\s+business\s+days?$/i

/** `first|last day of (the|this|next|last)? month|year|quarter|week`. */
const DAY_OF_PERIOD =
  /^(first|last)\s+day\s+of\s+(?:(this|next|last)\s+|the\s+)?(month|year|quarter|week)$/i

/** `first|last day of <year>` (`2029`) or `<month name>` (`March`, `Mar 2029`). */
const DAY_OF_DATE = /^(first|last)\s+day\s+of\s+(.+)$/i

const PERIOD_SHIFT: Record<string, number> = { next: 1, last: -1, this: 0 }

function addBusinessDays(now: Date, count: number): Date {
  const d = new Date(now)
  for (let remaining = count; remaining > 0; ) {
    d.setDate(d.getDate() + 1)
    const day = d.getDay()
    if (day !== 0 && day !== 6) remaining--
  }
  return d
}

/**
 * Resolves a natural date phrase into an actual calendar date — the fallback
 * every other `datetime` resolver falls through to. Two hand-rolled cases
 * `chrono` doesn't cover (business days, ordinal period boundaries), then
 * `chrono.parse` for everything else (`tomorrow`, `35 days ago`,
 * `monday in 3 weeks`, `2 weeks from now`).
 *
 * Only claims the query when `chrono`'s match spans the *entire* (trimmed)
 * input — a partial match (`"today"` inside `"today's news"`, `"monday"`
 * inside `"monday.com"`) means the query is something else that merely
 * contains a date-ish word, not a date phrase itself.
 */
export function resolveRelative(input: string, now: Date): Calculation | null {
  const businessMatch = input.match(BUSINESS_DAYS)
  if (businessMatch) {
    const date = addBusinessDays(now, Number(businessMatch[1]))
    const { value, rawValue } = formatDate(date, now)
    return { expression: input, value, rawValue }
  }

  const periodMatch = input.match(DAY_OF_PERIOD)
  if (periodMatch) {
    const [, which, when, periodWord] = periodMatch
    const period = periodWord as Period
    const ref = shiftPeriod(period, now, PERIOD_SHIFT[when ?? 'this'])
    const date = which === 'first' ? firstDayOfPeriod(period, ref) : lastDayOfPeriod(period, ref)
    const { value, rawValue } = formatDate(date, now)
    return { expression: input, value, rawValue }
  }

  const dateMatch = input.match(DAY_OF_DATE)
  if (dateMatch) {
    const [, which, rest] = dateMatch
    const year = rest.trim().match(/^\d{4}$/)
    // A bare year ⇒ the year's boundary; otherwise let `chrono` resolve the
    // phrase (`March`, `Mar 2029`, `next month`) and take that month's boundary.
    const anchor = year
      ? new Date(Number(year[0]), which === 'first' ? 0 : 11, which === 'first' ? 1 : 31)
      : chrono.parseDate(rest, now, {})
    if (anchor) {
      const date = year
        ? anchor
        : which === 'first'
          ? new Date(anchor.getFullYear(), anchor.getMonth(), 1)
          : new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
      const { value, rawValue } = formatDate(date, now)
      return { expression: input, value, rawValue }
    }
  }

  const forwardDate = !/\blast\b/i.test(input)
  const results = chrono.parse(input, now, { forwardDate })
  if (results.length !== 1) return null

  const [result] = results
  const fullSpan = result.index === 0 && result.text.length === input.length
  if (!fullSpan) return null

  const date = result.start.date()
  // A phrase that carries a time-of-day ("now + 90 min", "in 3 hours",
  // "tomorrow at 5pm") resolves to an exact moment — show it to the minute
  // rather than collapsing to a bare calendar day.
  const { value, rawValue } = result.start.isCertain('hour')
    ? formatDateTime(date, now)
    : formatDate(date, now)
  return { expression: input, value, rawValue }
}
