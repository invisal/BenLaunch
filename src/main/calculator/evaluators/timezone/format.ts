import { formatInTimeZone, getTimezoneOffset } from 'date-fns-tz'

/** `9` → `"GMT+9"`, `-4` → `"GMT-4"`, `5.5` → `"GMT+5:30"`. */
export function offsetLabel(zone: string, at: Date): string {
  const hours = getTimezoneOffset(zone, at) / 3_600_000
  const sign = hours >= 0 ? '+' : '-'
  const abs = Math.abs(hours)
  const wholeHours = Math.floor(abs)
  const minutes = Math.round((abs - wholeHours) * 60)
  return minutes === 0 ? `GMT${sign}${wholeHours}` : `GMT${sign}${wholeHours}:${String(minutes).padStart(2, '0')}`
}

/** `"17:27"` — 24h clock, matches Raycast's own clock format. */
export function formatClock(instant: Date, zone: string): string {
  return formatInTimeZone(instant, zone, 'HH:mm')
}

/** `"Tue"` — the weekday in `zone`, for when it differs from the viewer's own day. */
export function formatWeekday(instant: Date, zone: string): string {
  return formatInTimeZone(instant, zone, 'EEE')
}

/** The calendar date (`yyyy-MM-dd`) in `zone`, for same-day / rollover comparisons. */
export function calendarDate(instant: Date, zone: string): string {
  return formatInTimeZone(instant, zone, 'yyyy-MM-dd')
}
