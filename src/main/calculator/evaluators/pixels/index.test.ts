import assert from "node:assert/strict";
import { test } from "node:test";

import { pixels } from "./index.ts";

/** Every pere-doc #21 example plus each unit and both directions. */
const cases: ReadonlyArray<{
  input: string;
  value: string;
  rawValue?: string;
  density: string;
}> = [
  {
    input: "2 inches in px at 72 ppi",
    value: "144 px",
    rawValue: "144",
    density: "72 ppi",
  },
  { input: "1 cm in px at 96 dpi", value: "37.8 px", density: "96 ppi" },
  {
    input: "300 px in mm at 300 dpi",
    value: "25.4 mm",
    rawValue: "25.4",
    density: "300 ppi",
  },
  { input: "12pt in px", value: "16 px", density: "96 ppi (default)" },
  { input: "3.5 in in px at 300 dpi", value: "1,050 px", density: "300 ppi" },
  { input: "10 mm in px at 72 ppi", value: "28.35 px", density: "72 ppi" },
  {
    input: "1024 px in inches at 220 ppi",
    value: "4.655 in",
    density: "220 ppi",
  },
  { input: "16 px to pt", value: "12 pt", density: "96 ppi (default)" },
  { input: "96 pixels to inches", value: "1 in", density: "96 ppi (default)" },
  { input: "1 pica in px", value: "16 px", density: "96 ppi (default)" },
  { input: "600 px in cm @ 300dpi", value: "5.08 cm", density: "300 ppi" },
  { input: '2" to px at 72 ppi', value: "144 px", density: "72 ppi" },
];

for (const { input, value, rawValue, density } of cases) {
  test(`pixels.evaluate(${JSON.stringify(input)}) -> ${value}`, () => {
    const calc = pixels.evaluate(input);
    assert.ok(calc, `expected ${JSON.stringify(input)} to resolve`);
    assert.equal(calc.expression, input);
    assert.equal(calc.value, value);
    if (rawValue !== undefined) assert.equal(calc.rawValue, rawValue);
    assert.deepEqual(calc.details, [{ label: "Density", value: density }]);
  });
}

for (const input of [
  "",
  "px",
  "10 cm in mm", // no px → math
  "5 px in px",
  "10 px to ft", // unsupported physical unit
  "2 inches in px at 0 ppi",
  "px to cm",
  "10 px",
]) {
  test(`pixels.evaluate(${JSON.stringify(input)}) -> null`, () => {
    assert.equal(pixels.evaluate(input), null);
  });
}
