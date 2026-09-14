/**
 * Strict calendar checks for typed dates and times. `new Date(...)` silently
 * rolls impossible values over (`2024-02-31` becomes 2 March), which would
 * turn a typo into a confident wrong answer — callers validate first and
 * return no result instead.
 */

/** `month` is 1–12. True only for a day that exists in that month (leap years included). */
export function isValidCalendarDate(
  year: number,
  month: number,
  day: number,
): boolean {
  if (![year, month, day].every(Number.isInteger)) return false;
  if (month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

/** 24-hour clock: hours 0–23, minutes and seconds 0–59. */
export function isValidClockTime(
  hours: number,
  minutes: number,
  seconds = 0,
): boolean {
  return (
    Number.isInteger(hours) &&
    Number.isInteger(minutes) &&
    hours >= 0 &&
    hours <= 23 &&
    minutes >= 0 &&
    minutes <= 59 &&
    seconds >= 0 &&
    seconds < 60
  );
}

/** A `yyyy-mm-dd` string that names a real calendar day. */
export function isValidIsoDate(text: string): boolean {
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return (
    !!match &&
    isValidCalendarDate(Number(match[1]), Number(match[2]), Number(match[3]))
  );
}
