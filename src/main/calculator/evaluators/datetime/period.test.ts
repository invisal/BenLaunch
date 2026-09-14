import assert from "node:assert/strict";
import { test } from "node:test";

import {
  firstDayOfPeriod,
  lastDayOfPeriod,
  nthWeekday,
  quarterStart,
  shiftPeriod,
  weekdayIndex,
} from "./period.ts";

const REF = new Date(2026, 8, 5); // Sat 5 Sep 2026 — Q3, week of Aug 31 - Sep 6

test("month boundaries", () => {
  assert.equal(firstDayOfPeriod("month", REF).getDate(), 1);
  assert.equal(firstDayOfPeriod("month", REF).getMonth(), 8);
  const last = lastDayOfPeriod("month", REF);
  assert.equal(last.getMonth(), 8);
  assert.equal(last.getDate(), 30);
});

test("year boundaries", () => {
  const first = firstDayOfPeriod("year", REF);
  assert.equal(first.getMonth(), 0);
  assert.equal(first.getDate(), 1);
  const last = lastDayOfPeriod("year", REF);
  assert.equal(last.getMonth(), 11);
  assert.equal(last.getDate(), 31);
});

test("quarter boundaries (Q3 = Jul-Sep)", () => {
  const first = firstDayOfPeriod("quarter", REF);
  assert.equal(first.getMonth(), 6); // July
  assert.equal(first.getDate(), 1);
  const last = lastDayOfPeriod("quarter", REF);
  assert.equal(last.getMonth(), 8); // September
  assert.equal(last.getDate(), 30);
});

test("week boundaries (Monday start)", () => {
  const first = firstDayOfPeriod("week", REF);
  assert.equal(first.getDay(), 1); // Monday
  assert.equal(first.getMonth(), 7); // August
  assert.equal(first.getDate(), 31);
  const last = lastDayOfPeriod("week", REF);
  assert.equal(last.getDay(), 0); // Sunday
  assert.equal(last.getMonth(), 8);
  assert.equal(last.getDate(), 6);
});

test("shiftPeriod moves by whole periods", () => {
  assert.equal(shiftPeriod("month", REF, 1).getMonth(), 9); // October
  assert.equal(shiftPeriod("month", REF, -1).getMonth(), 7); // August
  assert.equal(shiftPeriod("year", REF, 1).getFullYear(), 2027);
  assert.equal(shiftPeriod("quarter", REF, 1).getMonth(), 11); // December (Q4)
});

test("weekdayIndex accepts full, short and plural names", () => {
  assert.equal(weekdayIndex("Monday"), 1);
  assert.equal(weekdayIndex("mon"), 1);
  assert.equal(weekdayIndex("tues"), 2);
  assert.equal(weekdayIndex("thurs"), 4);
  assert.equal(weekdayIndex("fridays"), 5);
  assert.equal(weekdayIndex("su"), null);
  assert.equal(weekdayIndex("month"), null);
});

test("nthWeekday: first, third, last, and a missing fifth", () => {
  assert.equal(nthWeekday(2026, 9, 5, 1)?.getDate(), 2); // first Fri of Oct 2026
  assert.equal(nthWeekday(2026, 10, 4, 4)?.getDate(), 26); // 4th Thu of Nov 2026 (Thanksgiving)
  assert.equal(nthWeekday(2026, 8, 1, -1)?.getDate(), 28); // last Mon of Sep 2026
  assert.equal(nthWeekday(2026, 1, 1, 5), null); // Feb 2026 has four Mondays
});

test("quarterStart", () => {
  assert.equal(
    quarterStart(4, 2026).toDateString(),
    new Date(2026, 9, 1).toDateString(),
  );
  assert.equal(
    quarterStart(1, 2027).toDateString(),
    new Date(2027, 0, 1).toDateString(),
  );
});

test("shiftPeriod never overflows a short target month", () => {
  const march31 = new Date(2026, 2, 31, 10);
  const month = (d: Date) => [d.getFullYear(), d.getMonth()];
  assert.deepEqual(month(shiftPeriod("month", march31, 1)), [2026, 3]); // April, not May
  assert.deepEqual(month(shiftPeriod("month", march31, -1)), [2026, 1]); // February, not March
  assert.deepEqual(month(shiftPeriod("quarter", march31, 1)), [2026, 5]); // Q2 (June), not Q3
  assert.deepEqual(
    month(shiftPeriod("year", new Date(2024, 1, 29), 1)),
    [2025, 1],
  ); // Feb 2025, not Mar
  const endOfNextMonth = lastDayOfPeriod(
    "month",
    shiftPeriod("month", march31, 1),
  );
  assert.equal(
    endOfNextMonth.toDateString(),
    new Date(2026, 3, 30).toDateString(),
  );
});
