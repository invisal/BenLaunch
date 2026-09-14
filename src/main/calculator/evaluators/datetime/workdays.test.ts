import assert from "node:assert/strict";
import { test } from "node:test";

import { parsePeriod, resolveWorkdays } from "./workdays.ts";

const NOW = new Date(2026, 8, 5, 10, 0, 0); // Sat 5 Sep 2026

const cases: ReadonlyArray<{
  input: string;
  value: string;
  details?: string[];
}> = [
  // pere-doc #24
  {
    input: "workhours in 2026",
    value: "2,088 hours",
    details: ["Workdays 261"],
  },
  {
    input: "workdays in March",
    value: "22 workdays",
    details: ["Work hours 176"],
  },
  {
    input: "55h in workdays",
    value: "6.875 workdays",
    details: [" 6 workdays 7 hours"],
  },
  { input: "10 workdays from today", value: "Fri, Sep 18" },
  {
    input: "workdays between 1 Mar 2026 and 30 Jun 2026",
    value: "87 workdays",
    details: ["Work hours 696"],
  },
  // no year: the nearest 1 Mar (2027, from September) and the 30 Jun after it
  {
    input: "workdays between 1 Mar and 30 Jun",
    value: "88 workdays",
    details: ["Work hours 704"],
  },
  { input: "workdays from today to 25 Dec", value: "80 workdays" },
  // periods
  {
    input: "workdays in Q4",
    value: "66 workdays",
    details: ["Work hours 528"],
  },
  {
    input: "work days in this month",
    value: "22 workdays",
    details: ["Work hours 176"],
  },
  {
    input: "working hours in next month",
    value: "176 hours",
    details: ["Workdays 22"],
  },
  {
    input: "business days in february 2027",
    value: "20 workdays",
    details: ["Work hours 160"],
  },
  {
    input: "workdays in the week",
    value: "5 workdays",
    details: ["Work hours 40"],
  },
  // conversions
  {
    input: "40 hours in workdays",
    value: "5 workdays",
    details: [" 5 workdays"],
  },
  { input: "2 workdays in hours", value: "16 hours" },
  // stepping
  { input: "5 workdays ago", value: "Mon, Aug 31" },
  { input: "in 3 workdays", value: "Wed, Sep 9" },
  { input: "3 business days after 2026-12-24", value: "Tue, Dec 29" },
  { input: "2 workdays before 2026-09-07", value: "Thu, Sep 3" },
  // countdowns
  {
    input: "workdays until 25 Dec",
    value: "80 workdays",
    details: ["Work hours 640"],
  },
  {
    input: "workdays left in the quarter",
    value: "18 workdays",
    details: ["Work hours 144"],
  },
  {
    input: "workhours left in the year",
    value: "672 hours",
    details: ["Workdays 84"],
  },
];

for (const { input, value, details } of cases) {
  test(`resolveWorkdays(${JSON.stringify(input)}) -> ${value}`, () => {
    const calc = resolveWorkdays(input, NOW);
    assert.ok(calc, `expected ${JSON.stringify(input)} to resolve`);
    assert.equal(calc.value, value);
    if (details)
      assert.deepEqual(
        calc.details?.map((d) => `${d.label} ${d.value}`),
        details,
      );
  });
}

for (const input of [
  "workdays",
  "workdays in narnia",
  "workdays until 1 Jan 2020",
  "10 workdays from blah",
  "55 in workdays",
]) {
  test(`resolveWorkdays(${JSON.stringify(input)}) -> null`, () => {
    assert.equal(resolveWorkdays(input, NOW), null);
  });
}

test("parsePeriod", () => {
  const range = (text: string) =>
    parsePeriod(text, NOW)?.map((d) => d.toDateString());
  assert.deepEqual(range("2026"), [
    new Date(2026, 0, 1).toDateString(),
    new Date(2026, 11, 31).toDateString(),
  ]);
  assert.deepEqual(range("Q1 2027"), [
    new Date(2027, 0, 1).toDateString(),
    new Date(2027, 2, 31).toDateString(),
  ]);
  assert.deepEqual(range("mar"), [
    new Date(2026, 2, 1).toDateString(),
    new Date(2026, 2, 31).toDateString(),
  ]);
  assert.deepEqual(range("last month"), [
    new Date(2026, 7, 1).toDateString(),
    new Date(2026, 7, 31).toDateString(),
  ]);
  assert.equal(parsePeriod("someday", NOW), null);
});
