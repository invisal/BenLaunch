import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import {
  formatNumber,
  numberLocale,
  numberLocaleTag,
  resetNumberLocale,
  resolveNumberLocale,
  setNumberLocale,
} from "./locale.ts";

afterEach(resetNumberLocale);

test("defaults to en-US separators", () => {
  assert.deepEqual(numberLocale(), { tag: "en-US", decimal: ".", group: "," });
  assert.equal(formatNumber(1024.5), "1,024.5");
});

test("setNumberLocale switches output separators", () => {
  setNumberLocale("de-DE");
  assert.equal(numberLocale().decimal, ",");
  assert.equal(numberLocale().group, ".");
  assert.equal(formatNumber(1024.5), "1.024,5");
});

test("resolveNumberLocale falls back to en-US for an invalid tag", () => {
  assert.equal(resolveNumberLocale("not a locale!!").decimal, ".");
});

test("formatNumber honours explicit options", () => {
  assert.equal(
    formatNumber(7.225, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    "7.23",
  );
});

test("numberLocaleTag maps a preference to a locale", () => {
  assert.equal(numberLocaleTag("system", "fr-FR"), "fr-FR");
  assert.equal(numberLocaleTag("system", ""), "en-US");
  assert.equal(numberLocaleTag("dot", "de-DE"), "en-US");
  assert.equal(numberLocaleTag("comma", "en-US"), "de-DE");
});
