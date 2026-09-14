import assert from "node:assert/strict";
import { test } from "node:test";

import { timespan } from "./index.ts";

/** Every pere-doc #16 example, plus the adjacent shapes each grammar allows. */
const cases: ReadonlyArray<{
  input: string;
  value: string;
  rawValue?: string;
  details?: string[];
}> = [
  // --- break a duration down -----------------------------------------------
  {
    input: "145 mins to timespan",
    value: "2 hours 25 minutes",
    details: ["2.417 hours", "2:25:00"],
  },
  {
    input: "9000 seconds",
    value: "2 hours 30 minutes",
    rawValue: "9000",
    details: ["2.5 hours", "2:30:00"],
  },
  { input: "9000 seconds as timespan", value: "2 hours 30 minutes" },
  {
    input: "100000 s in human readable",
    value: "1 day 3 hours 46 minutes 40 seconds",
  },
  { input: "5400 sec to duration", value: "1 hour 30 minutes" },
  { input: "2 weeks", value: "14 days", details: ["336 hours", "336:00:00"] },
  {
    input: "90 min",
    value: "1 hour 30 minutes",
    details: ["1.5 hours", "1:30:00"],
  },
  { input: "45 seconds", value: "45 seconds", details: ["0:00:45"] },
  { input: "2.5 days", value: "2 days 12 hours" },
  { input: "1h 30m", value: "1 hour 30 minutes" },
  { input: "1 hour and 30 minutes", value: "1 hour 30 minutes" },
  // --- arithmetic -----------------------------------------------------------
  {
    input: "1h 30m + 45m",
    value: "2 hours 15 minutes",
    details: ["2.25 hours", "2:15:00"],
  },
  { input: "3600s + 45m", value: "1 hour 45 minutes" },
  { input: "2h - 15 min", value: "1 hour 45 minutes" },
  { input: "1h - 3h", value: "-2 hours", details: ["-2 hours", "-2:00:00"] },
  { input: "1h 30m * 2", value: "3 hours" },
  { input: "3h / 4", value: "45 minutes" },
  { input: "10 min + 20 min + 30 min", value: "1 hour" },
  // --- total in one unit ----------------------------------------------------
  { input: "90 minutes in seconds", value: "5,400 seconds", rawValue: "5400" },
  { input: "2.5 days in hours", value: "60 hours", rawValue: "60" },
  { input: "145 min to hours", value: "2.417 hours" },
  { input: "60 s in minutes", value: "1 minute" },
  { input: "1h 30m in minutes", value: "90 minutes" },
  { input: "3 weeks in days", value: "21 days" },
  { input: "1500 ms to seconds", value: "1.5 seconds" },
];

for (const { input, value, rawValue, details } of cases) {
  test(`timespan.evaluate(${JSON.stringify(input)}) -> ${value}`, () => {
    const calc = timespan.evaluate(input);
    assert.ok(calc, `expected ${JSON.stringify(input)} to resolve`);
    assert.equal(calc.expression, input);
    assert.equal(calc.value, value);
    if (rawValue !== undefined) assert.equal(calc.rawValue, rawValue);
    if (details !== undefined)
      assert.deepEqual(calc.details?.map((d) => d.value) ?? [], details);
  });
}

for (const input of [
  "",
  "timespan",
  "10 m", // metres → math auto-conversion
  "45m",
  "2 months", // calendar length → datetime
  "3 years",
  "in 3 days", // relative date → datetime
  "35 days ago",
  "2 weeks from now",
  "3:45pm + 90 min",
  "2026-01-15 + 3 weeks",
  "now + 90 min",
  "10 hours in tokyo",
  "time in 4 hours",
  "10 m/s",
  "2 apples",
  "5 in ft",
  "3h / 0",
  "55h in workdays",
  "1h to months",
]) {
  test(`timespan.evaluate(${JSON.stringify(input)}) -> null`, () => {
    assert.equal(timespan.evaluate(input), null);
  });
}
