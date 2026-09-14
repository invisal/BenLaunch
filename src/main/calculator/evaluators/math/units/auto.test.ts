import assert from "node:assert/strict";
import { test } from "node:test";

import { autoConvert } from "./auto.ts";

/** Every Raycast auto-conversion example (pere-doc #9) plus each unit family. */
const cases: ReadonlyArray<{
  input: string;
  value: string;
  rawValue: string;
  details?: string[];
}> = [
  // pere-doc examples
  {
    input: "10 m",
    value: "32.81 ft",
    rawValue: "32.8083989501 ft",
    details: ["393.7 in"],
  },
  { input: "5 kg", value: "11.02 lb", rawValue: "11.0231131092 lbs" },
  { input: "20 C", value: "68 °F", rawValue: "68 degF" },
  { input: "1 mile", value: "1.609 km", rawValue: "1.609344 km" },
  { input: "100 km", value: "62.14 mi", rawValue: "62.1371192237 mi" },
  {
    input: "6 ft",
    value: "1.829 m",
    rawValue: "1.8288 m",
    details: ["182.88 cm"],
  },
  { input: "180 lb", value: "81.65 kg", rawValue: "81.6466266 kg" },
  { input: "32 F", value: "0 °C", rawValue: "0 degC" },
  // length
  { input: "30 cm", value: "11.81 in", rawValue: "11.811023622 inch" },
  { input: "25mm", value: "0.9843 in", rawValue: "0.984251968504 inch" },
  { input: "12 inches", value: "30.48 cm", rawValue: "30.48 cm" },
  { input: '29 "', value: "73.66 cm", rawValue: "73.66 cm" },
  { input: "100 yards", value: "91.44 m", rawValue: "91.44 m" },
  {
    input: "2 metres",
    value: "6.562 ft",
    rawValue: "6.56167979003 ft",
    details: ["78.74 in"],
  },
  // mass
  { input: "500 g", value: "17.64 oz", rawValue: "17.6369809748 oz" },
  { input: "8 ounces", value: "226.8 g", rawValue: "226.796185 g" },
  { input: "2 pounds", value: "0.9072 kg", rawValue: "0.90718474 kg" },
  // temperature
  { input: "20 °C", value: "68 °F", rawValue: "68 degF" },
  { input: "-40 C", value: "-40 °F", rawValue: "-40 degF" },
  { input: "98.6 fahrenheit", value: "37 °C", rawValue: "37 degC" },
  {
    input: "300 K",
    value: "26.85 °C",
    rawValue: "26.85 degC",
    details: ["80.33 °F"],
  },
  // volume
  { input: "10 l", value: "2.642 gal", rawValue: "2.64172052358 gal" },
  { input: "2 gallons", value: "7.571 l", rawValue: "7.570823568 l" },
  { input: "250 ml", value: "8.454 fl oz", rawValue: "8.45350567546 floz" },
  { input: "1 fl oz", value: "29.57 ml", rawValue: "29.5735295625 ml" },
  { input: "2 cups", value: "473.18 ml", rawValue: "473.176473 ml" },
  // speed
  { input: "100 kmh", value: "62.14 mph", rawValue: "62.1371192237 mi/h" },
  { input: "60 mph", value: "96.56 km/h", rawValue: "96.56064 km/h" },
  {
    input: "10 m/s",
    value: "36 km/h",
    rawValue: "36 km/h",
    details: ["22.37 mph"],
  },
  // edge
  { input: "0 m", value: "0 ft", rawValue: "0 ft", details: ["0 in"] },
];

for (const { input, value, rawValue, details } of cases) {
  test(`autoConvert(${JSON.stringify(input)}) -> ${value}`, () => {
    const result = autoConvert(input);
    assert.ok(result, `expected ${JSON.stringify(input)} to auto-convert`);
    assert.equal(result.value, value);
    assert.equal(result.rawValue, rawValue);
    assert.deepEqual(
      result.details.map((d) => d.value),
      details ?? [],
    );
  });
}

for (const input of [
  "10 apps",
  "20 c", // lowercase single letter — not Celsius
  "10 k", // "10k" is a thousand, not kelvin
  "5 MB", // data sizes have no everyday counterpart
  "90 min", // durations belong to the timespan evaluator
  "m",
  "10",
  "10 m to ft", // explicit target — normal conversion, not auto
  "10 m + 2 m",
]) {
  test(`autoConvert(${JSON.stringify(input)}) -> null`, () => {
    assert.equal(autoConvert(input), null);
  });
}
