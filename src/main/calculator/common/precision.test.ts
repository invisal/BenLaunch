import assert from "node:assert/strict";
import { test } from "node:test";

import { roundDisplay } from "./precision.ts";

const cases: ReadonlyArray<readonly [number, number]> = [
  [62.137119, 62.14],
  [121.92, 121.92],
  [1.609344, 1.609],
  [3.048, 3.048],
  [0.41666667, 0.4167],
  [14.7867648, 14.79],
  [32.808399, 32.81],
  [32808.399, 32808.4],
  [73.4, 73.4],
  [0.0000123456, 0.00001235],
  [-17.7777778, -17.78],
  [0, 0],
  [1000, 1000],
];

for (const [input, expected] of cases) {
  test(`roundDisplay(${input}) -> ${expected}`, () => {
    assert.equal(roundDisplay(input), expected);
  });
}

test("roundDisplay passes non-finite values through", () => {
  assert.equal(roundDisplay(Infinity), Infinity);
  assert.ok(Number.isNaN(roundDisplay(NaN)));
});
