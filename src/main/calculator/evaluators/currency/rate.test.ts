import assert from "node:assert/strict";
import { test } from "node:test";

import { parseRate, rateUnit, rescale } from "./rate.ts";

test("parseRate splits money, units and target", () => {
  const q = parseRate("8 dollars/hour in gbp");
  assert.ok(q);
  assert.equal(q.moneyText, "8 dollars");
  assert.equal(q.targetText, "gbp");
  assert.equal(q.from.name, "hour");
  assert.equal(q.to.name, "hour"); // no target unit → same unit
});

test("parseRate: 'per', a target unit, and symbol targets", () => {
  assert.equal(parseRate("65 usd per hour in eur/day")?.to.name, "day");
  assert.equal(parseRate("£1.50/L in $/gal")?.targetText, "$");
  assert.equal(parseRate("£1.50/L in $/gal")?.to.name, "gal");
});

test("parseRate rejects mismatched dimensions and unknown units", () => {
  assert.equal(parseRate("10 usd/kg in eur/hour"), null);
  assert.equal(parseRate("10 usd/furlong in eur"), null);
  assert.equal(parseRate("10 usd in eur"), null);
});

test("rescale converts a price between units of one dimension", () => {
  const hour = rateUnit("hour")!;
  assert.equal(rescale(10, hour, rateUnit("day")!), 240);
  assert.equal(rescale(10, hour, rateUnit("workday")!), 80);
  assert.equal(
    rescale(2, rateUnit("L")!, rateUnit("gal")!).toFixed(4),
    "7.5708",
  );
  assert.equal(
    rescale(10, rateUnit("kg")!, rateUnit("lb")!).toFixed(4),
    "4.5359",
  );
});
