import assert from "node:assert/strict";
import { test } from "node:test";

import { clipboardText, questionAndAnswer, relativeAge } from "./format.ts";

const calc = { expression: "10 usd in gbp", value: "£7.42", rawValue: "7.42" };

test("questionAndAnswer joins expression and value", () => {
  assert.equal(questionAndAnswer(calc), "10 usd in gbp = £7.42");
});

test("clipboardText picks the text for each copy kind", () => {
  assert.equal(clipboardText(calc, "value"), "£7.42");
  assert.equal(clipboardText(calc, "raw"), "7.42");
  assert.equal(
    clipboardText(calc, "question-and-answer"),
    "10 usd in gbp = £7.42",
  );
});

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
  [NOW + 5_000, "just now"],
];

for (const [createdAt, expected] of ages) {
  test(`relativeAge -> ${expected}`, () => {
    assert.equal(relativeAge(createdAt, NOW), expected);
  });
}
