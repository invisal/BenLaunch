import assert from "node:assert/strict";
import { test } from "node:test";

import { evaluate } from "./calculator.ts";

/**
 * `evaluate` has two jobs: decide whether a query *is* a math expression, and if
 * so compute it. The cases below pin both — `value` for expressions that resolve,
 * `null` for the strings that must be left to the normal action search.
 */

const valueCases: ReadonlyArray<{ query: string; value: string }> = [
  { query: "1 + 2", value: "3" },
  { query: "2*3+4", value: "10" },
  { query: "2+3*4", value: "14" },
  { query: "(3 + 4) * 2", value: "14" },
  { query: "10 / 4", value: "2.5" },
  { query: "2 ^ 10", value: "1,024" },
  { query: "2 ^ 3 ^ 2", value: "512" }, // right-associative
  { query: "-5 + 8", value: "3" },
  { query: "10 % 3", value: "1" },
  { query: "0.1 + 0.2", value: "0.3" }, // float noise trimmed
  { query: "1920 / 2", value: "960" },
  { query: "1000000 * 2", value: "2,000,000" },
  { query: "  7 - 9  ", value: "-2" },
  { query: "3!", value: "6" }, // factorial
  { query: "sqrt(144)", value: "12" },
  { query: "sin(30 deg)", value: "0.5" },
  { query: "log(1000, 10)", value: "3" },
  { query: "2 * pi", value: "6.28318530718" },
];

for (const { query, value } of valueCases) {
  test(`evaluate(${JSON.stringify(query)}) -> ${value}`, () => {
    const calc = evaluate(query);
    assert.ok(calc, `expected ${JSON.stringify(query)} to evaluate`);
    assert.equal(calc.value, value);
    assert.equal(calc.expression, query.trim());
  });
}

// Unit-aware conversions — the payoff of moving to mathjs.
const unitCases: ReadonlyArray<{ query: string; value: string }> = [
  { query: "128 GB to MB", value: "128000 MB" },
  { query: "20 degC to degF", value: "68 degF" },
  { query: "10 cm in mm", value: "100 mm" },
  { query: "1 kg + 2 g", value: "1.002 kg" },
];

for (const { query, value } of unitCases) {
  test(`evaluate(${JSON.stringify(query)}) -> ${value}`, () => {
    const calc = evaluate(query);
    assert.ok(calc, `expected ${JSON.stringify(query)} to evaluate`);
    assert.equal(calc.value, value);
  });
}

const nullCases: ReadonlyArray<string> = [
  "",
  "   ",
  "chrome", // no digit, no call — not even tried
  "sin", // a bare function reference
  "pi", // a bare constant
  "in", // a bare unit
  "true", // a boolean, not a number
  "7zip", // digit then letters — mathjs throws
  "1password",
  "42", // a bare number is not a "calculation"
  "1.5", // ditto
  "-5", // just a negative number, no binary operator
  "2 pi", // implicit multiplication, but no operator/call — treated as a bare value
  "2 pi extra", // does not parse
  "(1 + 2", // unbalanced
  "1 +", // dangling operator
  "1 / 0", // not finite
  "notepad++", // the "++" must not read as an expression
];

for (const query of nullCases) {
  test(`evaluate(${JSON.stringify(query)}) -> null`, () => {
    assert.equal(evaluate(query), null);
  });
}

test("meta-functions are not reachable from an expression", () => {
  assert.equal(evaluate('import("fs")'), null);
  assert.equal(evaluate("createUnit(\"foo\")"), null);
});
