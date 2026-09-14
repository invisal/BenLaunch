/**
 * Mon–Fri working days — shared by `relative.ts` ("in 10 business days") and
 * `workdays.ts` ("workdays in March"). No public holidays, same as Raycast.
 */

export function isBusinessDay(d: Date): boolean {
  const day = d.getDay();
  return day !== 0 && day !== 6;
}

/** Step `count` business days from `from` (negative steps back). The start day itself never counts. */
export function addBusinessDays(from: Date, count: number): Date {
  const d = new Date(from);
  const step = count < 0 ? -1 : 1;
  for (let remaining = Math.abs(count); remaining > 0;) {
    d.setDate(d.getDate() + step);
    if (isBusinessDay(d)) remaining--;
  }
  return d;
}

/** Business days in the calendar-day range `[a, b]`, both ends included (order-independent). */
export function businessDaysBetween(a: Date, b: Date): number {
  const start = new Date(Math.min(a.getTime(), b.getTime()));
  const end = new Date(Math.max(a.getTime(), b.getTime()));
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  let count = 0;
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (isBusinessDay(d)) count++;
  }
  return count;
}
