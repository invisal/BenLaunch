/**
 * Calendar-period boundaries (quarter/year/month/week), shared by
 * `countdown.ts` ("days left in the quarter") and `relative.ts` ("first day
 * of next month"). All local time, no library needed.
 */
export type Period = 'quarter' | 'year' | 'month' | 'week'

/** The first day of `period`, relative to `ref` (e.g. the first of `ref`'s month). */
export function firstDayOfPeriod(period: Period, ref: Date): Date {
  const y = ref.getFullYear()
  switch (period) {
    case 'year':
      return new Date(y, 0, 1)
    case 'quarter':
      return new Date(y, Math.floor(ref.getMonth() / 3) * 3, 1)
    case 'month':
      return new Date(y, ref.getMonth(), 1)
    case 'week': {
      // Monday start.
      const d = new Date(ref)
      const shift = d.getDay() === 0 ? -6 : 1 - d.getDay()
      d.setDate(d.getDate() + shift)
      d.setHours(0, 0, 0, 0)
      return d
    }
  }
}

/** The last day of `period`, relative to `ref`, at 23:59:59.999. */
export function lastDayOfPeriod(period: Period, ref: Date): Date {
  const y = ref.getFullYear()
  switch (period) {
    case 'year':
      return new Date(y, 11, 31, 23, 59, 59, 999)
    case 'quarter':
      return new Date(y, Math.floor(ref.getMonth() / 3) * 3 + 3, 0, 23, 59, 59, 999)
    case 'month':
      return new Date(y, ref.getMonth() + 1, 0, 23, 59, 59, 999)
    case 'week': {
      const start = firstDayOfPeriod('week', ref)
      const d = new Date(start)
      d.setDate(d.getDate() + 6)
      d.setHours(23, 59, 59, 999)
      return d
    }
  }
}

/** Shift `ref` by one `period` — for "next month" / "last quarter" etc. */
export function shiftPeriod(period: Period, ref: Date, delta: number): Date {
  const d = new Date(ref)
  switch (period) {
    case 'year':
      d.setFullYear(d.getFullYear() + delta)
      break
    case 'quarter':
      d.setMonth(d.getMonth() + delta * 3)
      break
    case 'month':
      d.setMonth(d.getMonth() + delta)
      break
    case 'week':
      d.setDate(d.getDate() + delta * 7)
      break
  }
  return d
}
