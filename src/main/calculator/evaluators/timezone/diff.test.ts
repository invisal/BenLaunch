import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveDiff } from "./diff.ts";

const SUMMER = new Date("2026-06-15T12:00:00Z");
const WINTER = new Date("2026-01-15T12:00:00Z");
const BERLIN = "Europe/Berlin";

for (const { input, value, rawValue, details } of [
  {
    input: "time diff Paris",
    value: "Paris is on the same time as you",
    rawValue: "0",
    details: ["Paris GMT+2", "You GMT+2"],
  },
  {
    input: "diff Tokyo",
    value: "Tokyo is 7 hours ahead of you",
    rawValue: "+7",
    details: ["Tokyo GMT+9", "You GMT+2"],
  },
  {
    input: "time difference between London and New York",
    value: "London is 5 hours ahead of New York",
    rawValue: "+5",
    details: ["London GMT+1", "New York GMT-4"],
  },
  {
    input: "diff Honolulu",
    value: "Honolulu is 12 hours behind you",
    rawValue: "-12",
    details: ["Honolulu GMT-10", "You GMT+2"],
  },
  {
    input: "diff mumbai and kathmandu",
    value: "Mumbai is 15 minutes behind Kathmandu",
    rawValue: "-0.25",
    details: ["Mumbai GMT+5:30", "Kathmandu GMT+5:45"],
  },
  {
    input: "time diff toky",
    value: "Tokyo is 7 hours ahead of you",
    rawValue: "+7",
    details: ["Tokyo GMT+9", "You GMT+2"],
  },
  {
    input: "tokyo time difference",
    value: "Tokyo is 7 hours ahead of you",
    rawValue: "+7",
    details: ["Tokyo GMT+9", "You GMT+2"],
  },
  {
    input: "diff sf vs nyc",
    value: "San Francisco is 3 hours behind New York",
    rawValue: "-3",
    details: ["San Francisco GMT-7", "New York GMT-4"],
  },
]) {
  test(`resolveDiff(${JSON.stringify(input)}) -> ${value}`, () => {
    const calc = resolveDiff(input, SUMMER, BERLIN);
    assert.ok(calc);
    assert.equal(calc.value, value);
    assert.equal(calc.rawValue, rawValue);
    assert.deepEqual(
      calc.details?.map((d) => `${d.label} ${d.value}`),
      details,
    );
  });
}

test("DST-aware: London–New York is 5h in summer and winter, Berlin–Tokyo shifts", () => {
  assert.equal(
    resolveDiff("diff London and New York", WINTER, BERLIN)?.rawValue,
    "+5",
  );
  assert.equal(resolveDiff("diff tokyo", WINTER, BERLIN)?.rawValue, "+8");
});

test("equal zones between two places", () => {
  assert.equal(
    resolveDiff("diff paris and berlin", SUMMER, BERLIN)?.value,
    "Paris and Berlin are on the same time",
  );
});

for (const input of [
  "diff",
  "time diff narnia",
  "diff tokyo and narnia",
  "time in tokyo",
  "different",
]) {
  test(`resolveDiff(${JSON.stringify(input)}) -> null`, () => {
    assert.equal(resolveDiff(input, SUMMER, BERLIN), null);
  });
}

test("README reference (viewer in UTC)", () => {
  assert.equal(
    resolveDiff("time diff Paris", SUMMER, "UTC")?.value,
    "Paris is 2 hours ahead of you",
  );
  assert.equal(
    resolveDiff("diff Tokyo", SUMMER, "UTC")?.value,
    "Tokyo is 9 hours ahead of you",
  );
  assert.equal(
    resolveDiff("diff Honolulu", SUMMER, "UTC")?.value,
    "Honolulu is 10 hours behind you",
  );
  assert.deepEqual(resolveDiff("time diff Paris", SUMMER, "UTC")?.details, [
    { label: "Paris", value: "GMT+2" },
    { label: "You", value: "GMT+0" },
  ]);
});
