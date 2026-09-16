import assert from "node:assert/strict";
import { test } from "node:test";

import { relativeAge } from "./format.ts";

const NOW = new Date(2026, 8, 13, 12, 0, 0).getTime();
const ages: ReadonlyArray<readonly [number, string]> = [
  [NOW, "just now"],
  [NOW - 59_000, "just now"],
  [NOW - 5 * 60_000, "5m ago"],
  [NOW - 3 * 3_600_000, "3h ago"],
  [NOW - 30 * 3_600_000, "yesterday"],
  [NOW - 4 * 86_400_000, "4d ago"],
  [new Date(2026, 8, 2, 9).getTime(), "Sep 2"],
  [new Date(2025, 11, 25, 9).getTime(), "Dec 25, 2025"],
  // A clock skew that puts the timestamp slightly in the future reads as now,
  // not as a negative age.
  [NOW + 5_000, "just now"],
];

for (const [at, expected] of ages) {
  test(`relativeAge -> ${expected}`, () => {
    assert.equal(relativeAge(at, NOW), expected);
  });
}
