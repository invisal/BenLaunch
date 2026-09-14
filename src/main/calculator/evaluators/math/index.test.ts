import assert from "node:assert/strict";
import { test } from "node:test";

import { math } from "./index.ts";

/**
 * The math evaluator in isolation. Input here is already framed by the shared
 * `calculator/normalize.ts` (no "what is …", no trailing "="); those cases live
 * in `calculator/index.test.ts`.
 */
const { evaluate } = math;

// --- resolves ------------------------------------------------------------

const valueCases: ReadonlyArray<{
  input: string;
  value: string;
  expression?: string;
}> = [
  { input: "1 + 2", value: "3" },
  { input: "2*3+4", value: "10" },
  { input: "(3 + 4) * 2", value: "14" },
  { input: "10 / 4", value: "2.5" },
  { input: "2 ^ 10", value: "1,024" },
  { input: "2 ^ 3 ^ 2", value: "512" },
  { input: "-5 + 8", value: "3" },
  { input: "10 % 3", value: "1" },
  { input: "0.1 + 0.2", value: "0.3" },
  { input: "1000000 * 2", value: "2,000,000" },
  { input: "3!", value: "6" },
  { input: "sqrt(144)", value: "12" },
  { input: "sin(30 deg)", value: "0.5" },
  { input: "log(1000, 10)", value: "3" },
  { input: "log(1000)", value: "3" }, // base 10, like Raycast / a calculator keypad
  { input: "log(8, 2)", value: "3" },
  { input: "ln(e)", value: "1" },
  { input: "ln(2)", value: "0.69314718056" },
  { input: "cot(1)", value: "0.642092615934" },
  { input: "sinh(1)", value: "1.17520119364" },
  { input: "acosh(2)", value: "1.31695789692" },
  { input: "2 power 10", value: "1,024", expression: "2 ^ 10" },
  { input: "5!", value: "120" },
  { input: "2 * pi", value: "6.28318530718" },

  // spoken / symbol forms (math normalize handles these)
  { input: "5 plus 3", value: "8", expression: "5 + 3" },
  { input: "100 divided by 4", value: "25", expression: "100 / 4" },
  { input: "2 to the power of 8", value: "256", expression: "2 ^ 8" },
  { input: "17 mod 5", value: "2", expression: "17 % 5" },
  { input: "3 x 4", value: "12", expression: "3 * 4" },
  { input: "square root of 625", value: "25", expression: "sqrt(625)" },
  { input: "√625", value: "25", expression: "sqrt(625)" },
  { input: "cube root of 27", value: "3", expression: "cbrt(27)" },
  { input: "factorial of 5", value: "120", expression: "factorial(5)" },
  { input: "5 squared", value: "25", expression: "(5)^2" },
  { input: "2 cubed", value: "8", expression: "(2)^3" },
  { input: "12 × 3", value: "36", expression: "12 * 3" },
  { input: "100 ÷ 4", value: "25", expression: "100 / 4" },
];

for (const { input, value, expression } of valueCases) {
  test(`math.evaluate(${JSON.stringify(input)}) -> ${value}`, () => {
    const calc = evaluate(input);
    assert.ok(calc, `expected ${JSON.stringify(input)} to resolve`);
    assert.equal(calc.value, value);
    assert.equal(calc.expression, expression ?? input);
  });
}

// --- unit-aware --------------------------------------------------------

for (const { input, value } of [
  // Raycast's explicit-conversion examples (pere-doc #4).
  { input: "10 ft in m", value: "3.048 m" },
  { input: "29 inches to cm", value: "73.66 cm" },
  { input: "23C to F", value: "73.4 °F" },
  { input: "3 teaspoon in ml", value: "14.79 ml" }, // US teaspoon
  { input: "4 feet to cm", value: "121.92 cm" },
  { input: "100 kmh in mph", value: "62.14 mph" },

  { input: "128 GB to MB", value: "128,000 MB" },
  { input: "500 MB in GB", value: "0.5 GB" },
  { input: "20 degC to degF", value: "68 °F" },
  { input: "10 cm in mm", value: "100 mm" },
  { input: "1 kg + 2 g", value: "1.002 kg" },
  { input: "2 kg + 300 g", value: "2.3 kg" },
  { input: "1 KiB in B", value: "1,024 B" },
  { input: "1000000 km to m", value: "1,000,000,000 m" },
  { input: "1e-10 m", value: "100 pm" },
  // Bare temperature letters.
  { input: "0F to C", value: "-17.78 °C" },
  { input: "-40 C to F", value: "-40 °F" },
  { input: "100 fahrenheit to celsius", value: "37.78 °C" },
  // Word/abbreviation/symbol aliases.
  { input: "180 pounds to kg", value: "81.65 kg" },
  { input: "2 tbsp in ml", value: "29.57 ml" },
  { input: "3 tsp in ml", value: "14.79 ml" },
  { input: "1 fl oz in ml", value: "29.57 ml" },
  { input: "29in to cm", value: "73.66 cm" },
  { input: '29 " to cm', value: "73.66 cm" },
  { input: '29" to cm', value: "73.66 cm" },
  { input: "100 km/h in mph", value: "62.14 mph" },
  // "5 in ft": no source unit, so the `in` can only be inches.
  { input: "5 in ft", value: "0.4167 ft" },
  { input: "5 m in ft", value: "16.4 ft" },
  // Dimensioned arithmetic (pere-doc #20).
  { input: "120 mi / 2 h", value: "60 mph" },
  { input: "3 GB / 25 Mbps", value: "16 minutes" },
  { input: "500 GB / 50 Mbps", value: "22 hours 13 minutes 20 seconds" },
  { input: "19m + 47%", value: "27.93 m" },
  // Calendar units are not fixed lengths — never broken down into days/hours.
  { input: "2 months", value: "2 months" },
  { input: "3 years", value: "3 years" },
  // An explicit time target keeps the unit asked for.
  { input: "90 minutes to seconds", value: "5,400 seconds" },
]) {
  test(`math.evaluate(${JSON.stringify(input)}) -> ${value}`, () => {
    assert.equal(evaluate(input)?.value, value);
  });
}

test("unit results keep a re-parseable rawValue", () => {
  const calc = evaluate("100 kmh in mph");
  assert.equal(calc?.rawValue, "62.137119 mi / h");
});

// --- automatic conversion (pere-doc #9) --------------------------------

for (const { input, value, details } of [
  { input: "10 m", value: "32.81 ft", details: ["393.7 in"] },
  { input: "5 kg", value: "11.02 lb" },
  { input: "20 C", value: "68 °F" },
  { input: "20 °C", value: "68 °F" },
  { input: "1 mile", value: "1.609 km" },
  { input: "100 km", value: "62.14 mi" },
  { input: "6 ft", value: "1.829 m", details: ["182.88 cm"] },
  { input: "180 lb", value: "81.65 kg" },
  { input: "32 F", value: "0 °C" },
]) {
  test(`math.evaluate(${JSON.stringify(input)}) auto-converts -> ${value}`, () => {
    const calc = evaluate(input);
    assert.ok(calc);
    assert.equal(calc.expression, input);
    assert.equal(calc.value, value);
    assert.deepEqual(
      calc.details?.map((d) => d.value),
      details,
    );
  });
}

// --- percentages ---------------------------------------------------------

for (const { input, value } of [
  { input: "32% of 5", value: "1.6" },
  { input: "20% of 1499", value: "299.8" },
  { input: "850 + 8.25%", value: "920.125" },
  { input: "250 - 10%", value: "225" },
  { input: "47%", value: "0.47" },
]) {
  test(`math.evaluate(${JSON.stringify(input)}) -> ${value}`, () => {
    assert.equal(evaluate(input)?.value, value);
  });
}

for (const { input, value } of [
  { input: "what percent is 32 of 200", value: "16%" },
  { input: "what percentage of 4 is 1", value: "25%" },
  { input: "what % is 20 of 80", value: "25%" },
  { input: "20 is what percent of 80", value: "25%" },
  { input: "percentage change from 50 to 75", value: "+50%" },
  { input: "% change from 50 to 75", value: "+50%" },
  { input: "% decrease from 80 to 60", value: "-25%" },
  { input: "from 50 to 75 as percent", value: "+50%" },
  { input: "52% of 900", value: "468" },
]) {
  test(`math.evaluate(${JSON.stringify(input)}) -> ${value}`, () => {
    assert.equal(evaluate(input)?.value, value);
  });
}

// --- output shape ----------------------------------------------------

test("carries rawValue and highlight tokens", () => {
  const calc = evaluate("2 ^ 10");
  assert.equal(calc?.rawValue, "1024");
  assert.ok(calc?.tokens);
  assert.equal(calc.tokens.map((t) => t.text).join(""), "2 ^ 10");
});

// --- rejects (returns null, next evaluator / action search gets it) --

for (const input of [
  "",
  "chrome",
  "sin",
  "pi",
  "in",
  "true",
  "7zip",
  "42",
  "1.5",
  "-5",
  "2 pi",
  "2 pi extra",
  "(1 + 2",
  "1 +",
  "1 / 0",
  "notepad++",
  "sunny plus warm",
  "in 3 hours", // leading "in" + number ⇒ datetime, not `3 in hours`
  "in 45 minutes",
  "2026-12-25", // a bare ISO date is a date (→ datetime), not `2026 - 12 - 25`
  "10 apps", // not a known unit — no auto-conversion
  "20 c", // lowercase single letter is not Celsius
  "percentage change from 0 to 5", // undefined change from zero
]) {
  test(`math.evaluate(${JSON.stringify(input)}) -> null`, () => {
    assert.equal(evaluate(input), null);
  });
}

test("meta-functions are not reachable", () => {
  assert.equal(evaluate('import("fs")'), null);
  assert.equal(evaluate('createUnit("foo")'), null);
});
