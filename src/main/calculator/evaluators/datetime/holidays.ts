import { nthWeekday } from "./period.ts";

/**
 * Named days people count down to — "days until christmas". Fixed-date
 * holidays plus US Thanksgiving (4th Thursday of November). Always the *next*
 * occurrence: once this year's has passed, next year's.
 */
const HOLIDAYS: ReadonlyArray<{
  pattern: RegExp;
  date: (year: number) => Date;
}> = [
  { pattern: /^christmas\s+eve$/i, date: (y) => new Date(y, 11, 24) },
  {
    pattern: /^(?:christmas|xmas)(?:\s+day)?$/i,
    date: (y) => new Date(y, 11, 25),
  },
  { pattern: /^new\s+year'?s?\s+eve$/i, date: (y) => new Date(y, 11, 31) },
  {
    pattern: /^(?:the\s+)?new\s+year'?s?(?:\s+day)?$/i,
    date: (y) => new Date(y, 0, 1),
  },
  { pattern: /^halloween$/i, date: (y) => new Date(y, 9, 31) },
  { pattern: /^valentine'?s?(?:\s+day)?$/i, date: (y) => new Date(y, 1, 14) },
  {
    pattern: /^thanksgiving(?:\s+day)?$/i,
    date: (y) => nthWeekday(y, 10, 4, 4)!,
  },
];

export function resolveHoliday(text: string, now: Date): Date | null {
  const name = text.trim();
  for (const { pattern, date } of HOLIDAYS) {
    if (!pattern.test(name)) continue;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisYear = date(now.getFullYear());
    return thisYear >= today ? thisYear : date(now.getFullYear() + 1);
  }
  return null;
}
