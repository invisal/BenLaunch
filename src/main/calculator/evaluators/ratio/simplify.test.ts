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

test("simplifyRatio keeps the typed precision of tiny decimals", () => {
  assert.deepEqual(simplifyRatio(0.0000001, 0.0000002), [1, 2]);
  assert.deepEqual(simplifyRatio(0.00000015, 0.0000003), [1, 2]);
  assert.deepEqual(simplifyRatio(1.25, 0.5), [5, 2]);
});

test("simplifyRatio refuses ratios it can't scale to exact integers", () => {
  assert.equal(simplifyRatio(1e-20, 1), null);
  assert.equal(simplifyRatio(12345678901.123456, 1), null); // > safe integer once scaled
});
