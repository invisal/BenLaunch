import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DAY_S,
  HOUR_S,
  formatTimespan,
  parseTimespan,
  parseTimespanParts,
  timeUnitSeconds,
} from "./timespan.ts";

const formats: ReadonlyArray<readonly [number, string]> = [
  [9000, "2 hours 30 minutes"],
  [8700, "2 hours 25 minutes"],
  [60, "1 minute"],
  [61, "1 minute 1 second"],
  [3600, "1 hour"],
  [DAY_S, "1 day"],
  [100000, "1 day 3 hours 46 minutes 40 seconds"],
  [0, "0 seconds"],
  [0.5, "0.5 seconds"],
  [-5400, "-1 hour 30 minutes"],
  [59.6, "1 minute"],
];

for (const [seconds, expected] of formats) {
  test(`formatTimespan(${seconds}) -> ${expected}`, () => {
    assert.equal(formatTimespan(seconds), expected);
  });
}

test("formatTimespan rounds to the requested smallest unit", () => {
  assert.equal(
    formatTimespan(35_130, { smallest: "minute" }),
    "9 hours 46 minutes",
  );
  assert.equal(formatTimespan(20, { smallest: "minute" }), "0 minutes");
  assert.equal(
    formatTimespan(DAY_S + HOUR_S * 13, { smallest: "day" }),
    "2 days",
  );
});

const parses: ReadonlyArray<readonly [string, number | null]> = [
  ["1h 30m", 5400],
  ["1h30m", 5400],
  ["1 hour 30 minutes", 5400],
  ["1 hour and 30 minutes", 5400],
  ["90 min", 5400],
  ["45m", 2700],
  ["3600s", 3600],
  ["2.5 days", 2.5 * DAY_S],
  ["2 weeks", 14 * DAY_S],
  ["500 ms", 0.5],
  ["2 apples", null],
  ["1h and change", null],
  ["", null],
  ["hours", null],
  ["12", null],
];

for (const [text, expected] of parses) {
  test(`parseTimespan(${JSON.stringify(text)}) -> ${expected}`, () => {
    assert.equal(parseTimespan(text), expected);
  });
}

test("timeUnitSeconds recognises every spelling and rejects others", () => {
  assert.equal(timeUnitSeconds("mins"), 60);
  assert.equal(timeUnitSeconds("HRS"), HOUR_S);
  assert.equal(timeUnitSeconds("sec"), 1);
  assert.equal(timeUnitSeconds("ft"), null);
});

test("parseTimespanParts keeps each part and its unit as typed", () => {
  assert.deepEqual(parseTimespanParts("1h 30min"), [
    { amount: 1, unit: "h", unitSeconds: HOUR_S },
    { amount: 30, unit: "min", unitSeconds: 60 },
  ]);
  assert.equal(parseTimespanParts("1h 30 apples"), null);
});
