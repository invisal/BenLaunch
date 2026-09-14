import assert from "node:assert/strict";
import { test } from "node:test";

import { normalize } from "./normalize.ts";

const cases: ReadonlyArray<{ raw: string; expected: string }> = [
  // Whitespace.
  { raw: "1 + 2", expected: "1 + 2" },
  { raw: "  7 - 9  ", expected: "7 - 9" },
  { raw: "a   b\t c", expected: "a b c" },

  // Question lead-ins.
  { raw: "what is 7 * 6", expected: "7 * 6" },
  { raw: "what's 7 * 6", expected: "7 * 6" },
  { raw: "whats 7 * 6", expected: "7 * 6" },
  { raw: "calculate 7 * 6", expected: "7 * 6" },
  { raw: "compute 7 * 6", expected: "7 * 6" },
  { raw: "convert 10 usd to eur", expected: "10 usd to eur" },
  { raw: "What Is the time in tokyo", expected: "the time in tokyo" },

  // Trailing punctuation.
  { raw: "5 + 3 =", expected: "5 + 3" },
  { raw: "5 + 3 equals", expected: "5 + 3" },
  { raw: "5 + 3?", expected: "5 + 3" },
  { raw: "5 + 3 = ?", expected: "5 + 3" },
  { raw: "time in tokyo?", expected: "time in tokyo" },

  // A mid-string "=" is left alone (only trailing is framing).
  { raw: "5 = 3", expected: "5 = 3" },

  // Untouched.
  { raw: "chrome", expected: "chrome" },
  { raw: "notepad++", expected: "notepad++" },
];

for (const { raw, expected } of cases) {
  test(`normalize(${JSON.stringify(raw)}) -> ${JSON.stringify(expected)}`, () => {
    assert.equal(normalize(raw), expected);
  });
}

// --- locale-aware numbers ---------------------------------------------------

import { normalizeNumbers } from "./normalize.ts";

const EN = { decimal: ".", group: "," };
const DE = { decimal: ",", group: "." };
const FR = { decimal: ",", group: "\u202f" };
const CH = { decimal: ".", group: "’" };

for (const [raw, locale, expected] of [
  ["1,234.5 * 2", EN, "1,234.5 * 2"], // en: untouched
  ["3,5 + 1", DE, "3.5 + 1"],
  ["1.234,5 * 2", DE, "1234.5 * 2"],
  ["1.234.567,89", DE, "1234567.89"],
  ["10,5 usd in eur", DE, "10.5 usd in eur"],
  ["20% off 80,50", DE, "20% off 80.50"],
  ["max(2,5)", DE, "max(2,5)"], // function arguments
  ["max(2,5) + 1,5", DE, "max(2,5) + 1.5"],
  ["(1,5 + 2,5) * 2", DE, "(1.5 + 2.5) * 2"], // plain parens are not a call
  ["2026-01-15 + 3", DE, "2026-01-15 + 3"],
  ["10:30", DE, "10:30"],
  ["1.5 + 1", DE, "1.5 + 1"], // not a 3-digit group — left alone
  ["1\u202f234,5", FR, "1234.5"],
  ["1’234.5", CH, "1’234.5"], // dot-decimal locales are left to the evaluators
] as const) {
  test(`normalizeNumbers(${JSON.stringify(raw)}, decimal ${locale.decimal}) -> ${JSON.stringify(expected)}`, () => {
    assert.equal(normalizeNumbers(raw, locale), expected);
  });
}
