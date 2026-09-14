import assert from "node:assert/strict";
import { test } from "node:test";

import {
  formatAmount,
  formatPercentage,
  parseMoney,
  parsePercent,
} from "./money.ts";

const monies: ReadonlyArray<
  readonly [string, { amount: number; currency: string | null } | null]
> = [
  ["42", { amount: 42, currency: null }],
  ["73.50", { amount: 73.5, currency: null }],
  ["1,299.99", { amount: 1299.99, currency: null }],
  ["1.2k", { amount: 1200, currency: null }],
  ["£60", { amount: 60, currency: "GBP" }],
  ["$ 42", { amount: 42, currency: "USD" }],
  ["80 eur", { amount: 80, currency: "EUR" }],
  ["80 euros", { amount: 80, currency: "EUR" }],
  ["USD 50", { amount: 50, currency: "USD" }],
  ["2m usd", { amount: 2_000_000, currency: "USD" }],
  ["eighty", null],
  ["80 apples", null],
  ["", null],
];

for (const [text, expected] of monies) {
  test(`parseMoney(${JSON.stringify(text)})`, () => {
    assert.deepEqual(parseMoney(text), expected);
  });
}

test("parsePercent", () => {
  assert.equal(parsePercent("20%"), 0.2);
  assert.equal(parsePercent("8.25 %"), 0.0825);
  assert.equal(parsePercent("20"), null);
});

test("formatAmount shows 2 decimals only for fractions, money via Intl", () => {
  assert.deepEqual(formatAmount(64, null), { value: "64", rawValue: "64" });
  assert.deepEqual(formatAmount(6.3, null), {
    value: "6.30",
    rawValue: "6.30",
  });
  assert.deepEqual(formatAmount(2007.3385, null), {
    value: "2,007.34",
    rawValue: "2007.34",
  });
  assert.deepEqual(formatAmount(72, "GBP"), {
    value: "£72.00",
    rawValue: "72.00",
  });
});

test("formatPercentage", () => {
  assert.equal(formatPercentage(0.28), "28%");
  assert.equal(formatPercentage(2 / 7), "28.57%");
});
