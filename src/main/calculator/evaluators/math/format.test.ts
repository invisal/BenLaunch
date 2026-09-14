import assert from "node:assert/strict";
import { test } from "node:test";

import { formatResult } from "./format.ts";
import { tryEvaluate } from "./evaluate.ts";

/** Helper: evaluate then format, asserting the expression resolved. */
function fmt(expression: string) {
  const result = tryEvaluate(expression);
  assert.ok(result, `expected ${JSON.stringify(expression)} to evaluate`);
  return formatResult(result);
}

const numberCases: ReadonlyArray<{
  expr: string;
  value: string;
  rawValue: string;
}> = [
  { expr: "1 + 2", value: "3", rawValue: "3" },
  { expr: "10 / 4", value: "2.5", rawValue: "2.5" },
  { expr: "0.1 + 0.2", value: "0.3", rawValue: "0.3" }, // float noise trimmed
  { expr: "2 ^ 10", value: "1,024", rawValue: "1024" }, // grouped display, plain raw
  { expr: "1000000 * 2", value: "2,000,000", rawValue: "2000000" },
  { expr: "7 - 9", value: "-2", rawValue: "-2" },
  { expr: "2 * pi", value: "6.28318530718", rawValue: "6.28318530718" },
];

for (const { expr, value, rawValue } of numberCases) {
  test(`formatResult(${JSON.stringify(expr)}) -> ${value} / ${rawValue}`, () => {
    const f = fmt(expr);
    assert.equal(f.value, value);
    assert.equal(f.rawValue, rawValue);
  });
}

const unitCases: ReadonlyArray<{
  expr: string;
  value: string;
  rawValue: string;
}> = [
  { expr: "128 GB to MB", value: "128,000 MB", rawValue: "128000 MB" },
  { expr: "20 degC to degF", value: "68 °F", rawValue: "68 degF" },
  { expr: "10 cm to mm", value: "100 mm", rawValue: "100 mm" },
  {
    expr: "100 km/h to mi/h",
    value: "62.14 mph",
    rawValue: "62.137119223733 mi / h",
  },
  { expr: "10 m / 2 s", value: "5 m/s", rawValue: "5 m / s" },
  { expr: "1e-10 m to m", value: "1e-10 m", rawValue: "1e-10 m" },
  // Durations nobody converted explicitly read as timespans…
  { expr: "9000 s + 0 s", value: "2 hours 30 minutes", rawValue: "9000 s" },
  { expr: "3 GB / 25 Mbps", value: "16 minutes", rawValue: "960 s" },
  // …but an explicit target is honoured.
  {
    expr: "2.5 hours to minutes",
    value: "150 minutes",
    rawValue: "150 minutes",
  },
];

for (const { expr, value, rawValue } of unitCases) {
  test(`formatResult(${JSON.stringify(expr)}) -> ${value} / ${rawValue}`, () => {
    const f = fmt(expr);
    assert.equal(f.value, value);
    assert.equal(f.rawValue, rawValue); // raw stays mathjs syntax, re-parseable
  });
}
