import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveHoliday } from "./holidays.ts";

const NOW = new Date(2026, 8, 5, 10); // Sat 5 Sep 2026

const cases: ReadonlyArray<readonly [string, Date]> = [
  ["christmas", new Date(2026, 11, 25)],
  ["Christmas Day", new Date(2026, 11, 25)],
  ["xmas", new Date(2026, 11, 25)],
  ["christmas eve", new Date(2026, 11, 24)],
  ["new year", new Date(2027, 0, 1)], // this year's already passed
  ["new year's day", new Date(2027, 0, 1)],
  ["new years eve", new Date(2026, 11, 31)],
  ["halloween", new Date(2026, 9, 31)],
  ["valentine's day", new Date(2027, 1, 14)],
  ["thanksgiving", new Date(2026, 10, 26)],
];

for (const [text, expected] of cases) {
  test(`resolveHoliday(${JSON.stringify(text)})`, () => {
    assert.equal(
      resolveHoliday(text, NOW)?.toDateString(),
      expected.toDateString(),
    );
  });
}

test("today's holiday counts as today, not next year", () => {
  assert.equal(
    resolveHoliday("halloween", new Date(2026, 9, 31, 18))?.toDateString(),
    new Date(2026, 9, 31).toDateString(),
  );
});

test("unknown names → null", () => {
  assert.equal(resolveHoliday("easter", NOW), null);
  assert.equal(resolveHoliday("friday", NOW), null);
});
