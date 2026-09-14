import assert from "node:assert/strict";
import { test } from "node:test";

import { prettyUnit } from "./pretty.ts";

const cases: ReadonlyArray<readonly [string, string]> = [
  ["degF", "°F"],
  ["degC", "°C"],
  ["celsius", "°C"],
  ["fahrenheit", "°F"],
  ["mi / h", "mph"],
  ["mi/h", "mph"],
  ["km / h", "km/h"],
  ["m / s", "m/s"],
  ["teaspoon", "tsp"],
  ["tablespoons", "tbsp"],
  ["floz", "fl oz"],
  ["lbs", "lb"],
  ["K", "K"],
  ["MB", "MB"],
  ["kg m / s^2", "kg m / s^2"], // not a simple rate — untouched
];

for (const [input, expected] of cases) {
  test(`prettyUnit(${JSON.stringify(input)}) -> ${JSON.stringify(expected)}`, () => {
    assert.equal(prettyUnit(input), expected);
  });
}
