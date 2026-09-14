import assert from "node:assert/strict";
import { test } from "node:test";

import { aspectName } from "./aspect.ts";
import { gcd, simplifyRatio } from "./simplify.ts";

test("gcd", () => {
  assert.equal(gcd(1920, 1080), 120);
  assert.equal(gcd(7, 5), 1);
  assert.equal(gcd(0, 5), 5);
});

const simplifies: ReadonlyArray<readonly [number, number, [number, number]]> = [
  [1920, 1080, [16, 9]],
  [3, 5, [3, 5]],
  [2, 8, [1, 4]],
  [1.5, 1, [3, 2]],
  [0.25, 0.75, [1, 3]],
  [0, 5, [0, 1]],
];

for (const [a, b, expected] of simplifies) {
  test(`simplifyRatio(${a}, ${b}) -> ${expected.join(":")}`, () => {
    assert.deepEqual(simplifyRatio(a, b), expected);
  });
}

test("aspectName: exact, equivalent, approximate, unknown", () => {
  assert.equal(aspectName(16, 9), "16:9 Widescreen");
  assert.equal(aspectName(8, 5), "16:10 Widescreen");
  assert.equal(aspectName(683, 384), "≈ 16:9 Widescreen");
  assert.equal(aspectName(64, 27), null);
  assert.equal(aspectName(0, 1), null);
});
