import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { evaluate } from "./index.ts";
import { resetNumberLocale, setNumberLocale } from "./common/locale.ts";

/**
 * The whole pipeline under a comma-decimal locale (Settings → Calculator →
 * Number format → `1.234,5`, or a German OS). Input is read in that format and
 * every evaluator's numbers come out in it. Dates keep the house format.
 */
afterEach(resetNumberLocale);

for (const { query, value } of [
  { query: "3,5 + 1", value: "4,5" },
  { query: "1.234,5 * 2", value: "2.469" },
  { query: "1000000 * 2", value: "2.000.000" },
  { query: "0,1 + 0,2", value: "0,3" },
  { query: "max(2,5)", value: "5" },
  { query: "10 ft in m", value: "3,048 m" },
  { query: "10 m", value: "32,81 ft" },
  { query: "20% off 80,50", value: "64,40" },
  { query: "15% tip on 42", value: "6,30" },
  { query: "ratio of 1920 to 1080", value: "16 : 9" },
  { query: "2,5 days in hours", value: "60 hours" },
  { query: "90 minutes in seconds", value: "5.400 seconds" },
  { query: "12pt in px", value: "16 px" },
  { query: "workhours in 2026", value: "2.088 hours" },
  { query: "USD1K", value: "1.000,00\u00a0$" }, // Intl puts a no-break space before the symbol
]) {
  test(`de-DE: evaluate(${JSON.stringify(query)}) -> ${value}`, () => {
    setNumberLocale("de-DE");
    assert.equal(evaluate(query)?.value, value);
  });
}

test("fr-FR: a space-grouped number survives the whitespace pass", () => {
  setNumberLocale("fr-FR");
  assert.equal(evaluate("1 234,5 + 1")?.rawValue, "1235.5");
  assert.equal(evaluate("1\u202f234,5 * 2")?.rawValue, "2469");
});

test("en-US: grouped operands are read in every evaluator", () => {
  assert.equal(evaluate("1,234.5 + 1")?.value, "1,235.5");
  assert.equal(evaluate("1,920:1,080")?.value, "16 : 9");
  assert.equal(evaluate("max(1,234)")?.value, "234");
});

test("rawValue stays dot-decimal and ungrouped for pasting into code", () => {
  setNumberLocale("de-DE");
  const calc = evaluate("1.234,5 * 2");
  assert.equal(calc?.rawValue, "2469");
  assert.equal(evaluate("3,5 + 1")?.rawValue, "4.5");
});

test("dates keep the house (en-US) format under any locale", () => {
  setNumberLocale("de-DE");
  assert.match(evaluate("2026-12-25")?.value ?? "", /^Fri, Dec 25/);
});

test("back to en-US after reset", () => {
  assert.equal(evaluate("3.5 + 1")?.value, "4.5");
  assert.equal(evaluate("1000000 * 2")?.value, "2,000,000");
});
