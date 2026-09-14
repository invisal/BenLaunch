import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isValidCalendarDate,
  isValidClockTime,
  isValidIsoDate,
} from "./calendar.ts";

test("isValidCalendarDate rejects days that don't exist", () => {
  assert.equal(isValidCalendarDate(2024, 2, 29), true); // leap year
  assert.equal(isValidCalendarDate(2023, 2, 29), false);
  assert.equal(isValidCalendarDate(2024, 2, 31), false);
  assert.equal(isValidCalendarDate(2026, 4, 31), false);
  assert.equal(isValidCalendarDate(2026, 12, 31), true);
  assert.equal(isValidCalendarDate(2026, 13, 1), false);
  assert.equal(isValidCalendarDate(2026, 0, 1), false);
  assert.equal(isValidCalendarDate(2026, 1, 0), false);
});

test("isValidClockTime", () => {
  assert.equal(isValidClockTime(0, 0), true);
  assert.equal(isValidClockTime(23, 59, 59.999), true);
  assert.equal(isValidClockTime(24, 0), false);
  assert.equal(isValidClockTime(14, 60), false);
  assert.equal(isValidClockTime(14, 30, 60), false);
});

test("isValidIsoDate", () => {
  assert.equal(isValidIsoDate("2026-03-15"), true);
  assert.equal(isValidIsoDate("2026-02-31"), false);
  assert.equal(isValidIsoDate("2026-3-15"), false);
  assert.equal(isValidIsoDate("tomorrow"), false);
});
