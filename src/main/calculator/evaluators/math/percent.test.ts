import assert from "node:assert/strict";
import { test } from "node:test";

import {
  formatPercent,
  formatPercentAnswer,
  parsePercentQuestion,
  rewritePercentOf,
} from "./percent.ts";

// --- rewritePercentOf ----------------------------------------------------

const rewriteCases: ReadonlyArray<{ raw: string; expected: string }> = [
  { raw: "32% of 5", expected: "32% * 5" },
  { raw: "20% of 1499", expected: "20% * 1499" },
  { raw: "52% of 900", expected: "52% * 900" },
  // Passthrough — no "of" right after a "%".
  { raw: "850 + 8.25%", expected: "850 + 8.25%" },
  { raw: "250 - 10%", expected: "250 - 10%" },
  { raw: "cost of 5 apples", expected: "cost of 5 apples" },
];

for (const { raw, expected } of rewriteCases) {
  test(`rewritePercentOf(${JSON.stringify(raw)}) -> ${JSON.stringify(expected)}`, () => {
    assert.equal(rewritePercentOf(raw), expected);
  });
}

// --- parsePercentQuestion -------------------------------------------------

test('parsePercentQuestion: "what percent is A of B"', () => {
  assert.equal(parsePercentQuestion("what percent is 32 of 200")?.percent, 16);
  assert.equal(
    parsePercentQuestion("what percent is 32 of 200")?.kind,
    "share",
  );
  assert.equal(parsePercentQuestion("what percentage is 1 of 4")?.percent, 25);
});

test('parsePercentQuestion: "what percent(age) of B is A"', () => {
  assert.equal(parsePercentQuestion("what percent of 200 is 32")?.percent, 16);
  assert.equal(parsePercentQuestion("what percentage of 4 is 1")?.percent, 25);
});

test('parsePercentQuestion: "what % is A of B" and "A is what percent of B"', () => {
  assert.deepEqual(parsePercentQuestion("what % is 20 of 80"), {
    percent: 25,
    kind: "share",
  });
  assert.deepEqual(parsePercentQuestion("20 is what percent of 80"), {
    percent: 25,
    kind: "share",
  });
  assert.deepEqual(parsePercentQuestion("1.5 is what percentage of 6"), {
    percent: 25,
    kind: "share",
  });
});

const changeCases: ReadonlyArray<{
  raw: string;
  percent: number;
  text: string;
}> = [
  { raw: "percentage change from 50 to 75", percent: 50, text: "+50%" },
  { raw: "percent change 50 to 75", percent: 50, text: "+50%" },
  { raw: "% change from 50 to 75", percent: 50, text: "+50%" },
  { raw: "% increase from 40 to 50", percent: 25, text: "+25%" },
  { raw: "% decrease from 80 to 60", percent: -25, text: "-25%" },
  { raw: "percentage difference from 3 to 3", percent: 0, text: "0%" },
  { raw: "from 50 to 75 as percent", percent: 50, text: "+50%" },
  { raw: "50 to 75 in percentage", percent: 50, text: "+50%" },
  { raw: "from -50 to -25 as a percentage change", percent: 50, text: "+50%" },
  {
    raw: "percentage change from 3 to 4",
    percent: (1 / 3) * 100,
    text: "+33.33%",
  },
];

for (const { raw, percent, text } of changeCases) {
  test(`parsePercentQuestion(${JSON.stringify(raw)}) -> ${text}`, () => {
    const q = parsePercentQuestion(raw);
    assert.ok(q);
    assert.equal(q.kind, "change");
    assert.ok(Math.abs(q.percent - percent) < 1e-9);
    assert.equal(formatPercentAnswer(q), text);
  });
}

test("formatPercentAnswer never signs a share", () => {
  assert.equal(formatPercentAnswer({ percent: 25, kind: "share" }), "25%");
});

test("parsePercentQuestion rejects division by zero and non-matches", () => {
  assert.equal(parsePercentQuestion("what percent is 32 of 0"), null);
  assert.equal(parsePercentQuestion("percentage change from 0 to 5"), null);
  assert.equal(parsePercentQuestion("10 to 20"), null);
  assert.equal(parsePercentQuestion("32% of 5"), null);
  assert.equal(parsePercentQuestion("5 + 3"), null);
});

// --- formatPercent ----------------------------------------------------

test("formatPercent trims to a friendly percent", () => {
  assert.equal(formatPercent(16), "16");
  assert.equal(formatPercent(100 / 3), "33.33");
  assert.equal(formatPercent(25), "25");
});
