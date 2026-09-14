import assert from "node:assert/strict";
import { test } from "node:test";

import { ratio } from "./index.ts";

/** Every pere-doc #22 example plus scaling / proportions / aspect names. */
const cases: ReadonlyArray<{
  input: string;
  value: string;
  rawValue?: string;
  details: string[];
}> = [
  {
    input: "ratio of 3 to 5",
    value: "3 : 5",
    rawValue: "3:5",
    details: ["Decimal 0.6", "Percent 60%"],
  },
  {
    input: "ratio of 1920 to 1080",
    value: "16 : 9",
    rawValue: "16:9",
    details: ["Decimal 1.778", "Percent 177.78%", "Aspect 16:9 Widescreen"],
  },
  {
    input: "ratio of 2 to 8",
    value: "1 : 4",
    details: ["Decimal 0.25", "Percent 25%"],
  },
  {
    input: "ratio of 4 to 6",
    value: "2 : 3",
    details: ["Decimal 0.6667", "Percent 66.67%"],
  },
  {
    input: "ratio of 1 to 25",
    value: "1 : 25",
    details: ["Decimal 0.04", "Percent 4%"],
  },
  {
    input: "ratio between 10 and 20",
    value: "1 : 2",
    details: ["Decimal 0.5", "Percent 50%"],
  },
  {
    input: "ratio 3/5",
    value: "3 : 5",
    details: ["Decimal 0.6", "Percent 60%"],
  },
  {
    input: "3 to 5 ratio",
    value: "3 : 5",
    details: ["Decimal 0.6", "Percent 60%"],
  },
  {
    input: "1920:1080",
    value: "16 : 9",
    details: ["Decimal 1.778", "Percent 177.78%", "Aspect 16:9 Widescreen"],
  },
  {
    input: "16:9",
    value: "16 : 9",
    details: ["Decimal 1.778", "Percent 177.78%", "Aspect 16:9 Widescreen"],
  },
  {
    input: "4:3",
    value: "4 : 3",
    details: ["Decimal 1.333", "Percent 133.33%", "Aspect 4:3 Standard"],
  },
  {
    input: "16 : 10",
    value: "8 : 5",
    details: ["Decimal 1.6", "Percent 160%", "Aspect 16:10 Widescreen"],
  },
  {
    input: "1366:768",
    value: "683 : 384",
    details: ["Decimal 1.779", "Percent 177.86%", "Aspect ≈ 16:9 Widescreen"],
  },
  {
    input: "1080:1920",
    value: "9 : 16",
    details: ["Decimal 0.5625", "Percent 56.25%", "Aspect 9:16 Vertical"],
  },
  {
    input: "ratio 10:30",
    value: "1 : 3",
    details: ["Decimal 0.3333", "Percent 33.33%"],
  },
  {
    input: "ratio of 1.5 to 1",
    value: "3 : 2",
    details: ["Decimal 1.5", "Percent 150%", "Aspect 3:2 Classic 35mm"],
  },
  {
    input: "ratio of 0 to 5",
    value: "0 : 1",
    details: ["Decimal 0", "Percent 0%"],
  },
  // scaling
  {
    input: "16:9 to 1280",
    value: "1280 : 720",
    rawValue: "1280:720",
    details: ["Ratio 16 : 9"],
  },
  {
    input: "16:9 with height 1080",
    value: "1920 : 1080",
    details: ["Ratio 16 : 9"],
  },
  {
    input: "1920:1080 scaled to 1280",
    value: "1280 : 720",
    details: ["Ratio 16 : 9"],
  },
  {
    input: "16:9 to 1366",
    value: "1366 : 768.38",
    rawValue: "1366:768.375",
    details: ["Ratio 16 : 9"],
  },
  {
    input: "ratio of 0.0000001 to 0.0000002",
    value: "1 : 2",
    details: ["Decimal 0.5", "Percent 50%"],
  },
  // proportions
  {
    input: "3:5 = 9:x",
    value: "15",
    rawValue: "15",
    details: ["Proportion 3 : 5 = 9 : 15"],
  },
  { input: "3:5 = x:15", value: "9", details: ["Proportion 3 : 5 = 9 : 15"] },
];

for (const { input, value, rawValue, details } of cases) {
  test(`ratio.evaluate(${JSON.stringify(input)}) -> ${value}`, () => {
    const calc = ratio.evaluate(input);
    assert.ok(calc, `expected ${JSON.stringify(input)} to resolve`);
    assert.equal(calc.expression, input);
    assert.equal(calc.value, value);
    if (rawValue !== undefined) assert.equal(calc.rawValue, rawValue);
    assert.deepEqual(
      calc.details?.map((d) => `${d.label} ${d.value}`),
      details,
    );
  });
}

for (const input of [
  "",
  "ratio",
  "ratio of apples to oranges",
  "10:30", // clock time → datetime
  "9:45",
  "23:59",
  "0:0",
  "3/5", // plain division → math
  "0:9 to 1280", // zero side can't scale
  "3:5 = 9:y",
  "3:5 = 9:?", // only `x` marks the unknown — a trailing `?` is stripped as framing anyway
  "ratio of 0.000000000000000001 to 1", // beyond exact precision — no answer rather than a wrong one
]) {
  test(`ratio.evaluate(${JSON.stringify(input)}) -> null`, () => {
    assert.equal(ratio.evaluate(input), null);
  });
}
