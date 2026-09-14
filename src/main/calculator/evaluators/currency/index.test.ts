import assert from "node:assert/strict";
import { test } from "node:test";

import { createCurrencyEvaluator, type RateProvider } from "./index.ts";

const RATES = { USD: 1, EUR: 0.8, GBP: 0.75, JPY: 150 };

/** A fixed rate provider — `ageMs` (since last fetch) drives the footnote. */
function provider(ageMs = 0): RateProvider {
  return {
    rates: () => RATES,
    updatedAgeMs: () => ageMs,
  };
}

const PRICES = {
  fetchedAt: new Date(2026, 8, 5, 14, 5).getTime(),
  usd: { BTC: 64000, ETH: 3000, SOL: 150 },
};
const withCrypto = createCurrencyEvaluator({
  ...provider(),
  crypto: () => PRICES,
});

const fresh = createCurrencyEvaluator(provider());

test("converts and formats", () => {
  const calc = fresh.evaluate("10 usd in gbp");
  assert.ok(calc);
  assert.equal(calc.value, "£7.50");
  assert.equal(calc.rawValue, "7.50");
  assert.equal(calc.expression, "10 USD → GBP");
});

test('a bare "usd in eur" shows the rate for 1', () => {
  assert.equal(fresh.evaluate("usd in eur")?.value, "€0.80");
});

test("symbol prefix and shorthand", () => {
  assert.equal(fresh.evaluate("$1.5k in eur")?.value, "€1,200.00");
});

test("non-currency queries return null", () => {
  for (const q of ["10 + 5", "128 GB to MB", "chrome", "10 m to ft"]) {
    assert.equal(fresh.evaluate(q), null, q);
  }
});

test("the result footnote says how long ago the rates were fetched", () => {
  const min = 60_000;
  assert.equal(fresh.evaluate("10 usd in gbp")?.footnote, "Updated just now");
  assert.equal(
    createCurrencyEvaluator(provider(4 * min)).evaluate("1 usd in gbp")
      ?.footnote,
    "Updated 4 minutes ago",
  );
  assert.equal(
    createCurrencyEvaluator(provider(3 * 60 * min)).evaluate("1 usd in gbp")
      ?.footnote,
    "Updated 3 hours ago",
  );
  assert.equal(
    createCurrencyEvaluator(provider(30 * 60 * min)).evaluate("1 usd in gbp")
      ?.footnote,
    "Updated yesterday",
  );
  assert.equal(
    createCurrencyEvaluator(provider(5 * 24 * 60 * min)).evaluate(
      "1 usd in gbp",
    )?.footnote,
    "Updated 5 days ago",
  );
});

// --- crypto (pere-doc #19) ------------------------------------------------

for (const { input, value, expression } of [
  { input: "5 btc in gbp", value: "£240,000.00", expression: "5 BTC → GBP" },
  { input: "0.2 eth to usd", value: "$600.00", expression: "0.2 ETH → USD" },
  {
    input: "1 usd in btc",
    value: "0.000015625 BTC",
    expression: "1 USD → BTC",
  },
  { input: "10 sol in eur", value: "€1,200.00", expression: "10 SOL → EUR" },
  { input: "2 sol in eth", value: "0.1 ETH", expression: "2 SOL → ETH" },
  { input: "1500 usd in eth", value: "0.5 ETH", expression: "1,500 USD → ETH" },
  {
    input: "0.05 bitcoin in usd",
    value: "$3,200.00",
    expression: "0.05 BTC → USD",
  },
]) {
  test(`crypto: ${input} -> ${value}`, () => {
    const calc = withCrypto.evaluate(input);
    assert.ok(calc);
    assert.equal(calc.value, value);
    assert.equal(calc.expression, expression);
    assert.equal(calc.footnote, "Prices as of 14:05");
  });
}

test("crypto needs an explicit amount (sol / eth / dot are also words)", () => {
  assert.equal(withCrypto.evaluate("sol in usd"), null);
  assert.equal(withCrypto.evaluate("eth to eur"), null);
});

test("crypto is unavailable when disabled / never fetched", () => {
  assert.equal(fresh.evaluate("5 btc in gbp"), null);
  assert.equal(
    createCurrencyEvaluator({ ...provider(), crypto: () => null }).evaluate(
      "5 btc in gbp",
    ),
    null,
  );
});

test("fiat conversions keep the rates footnote even with crypto on", () => {
  assert.equal(
    withCrypto.evaluate("10 usd in gbp")?.footnote,
    "Updated just now",
  );
});

// --- rates per unit (pere-doc #20) -----------------------------------------

for (const { input, value, expression } of [
  {
    input: "8 dollars/hour in gbp",
    value: "£6.00/hour",
    expression: "8 USD/hour → GBP/hour",
  },
  {
    input: "65 usd/hour in eur/day",
    value: "€1,248.00/day",
    expression: "65 USD/hour → EUR/day",
  },
  {
    input: "65 usd per hour in eur/workday",
    value: "€416.00/workday",
    expression: "65 USD/hour → EUR/workday",
  },
  {
    input: "£1.50/L in $/gal",
    value: "$7.57/gal",
    expression: "1.5 GBP/L → USD/gal",
  },
  {
    input: "10 usd/kg in gbp/lb",
    value: "£3.40/lb",
    expression: "10 USD/kg → GBP/lb",
  },
  {
    input: "0.001 btc/day in usd/hour",
    value: "$2.67/hour",
    expression: "0.001 BTC/day → USD/hour",
  },
]) {
  test(`rate: ${input} -> ${value}`, () => {
    const calc = withCrypto.evaluate(input);
    assert.ok(calc);
    assert.equal(calc.value, value);
    assert.equal(calc.expression, expression);
  });
}

test("a rate whose units don't match dimensions is not claimed", () => {
  assert.equal(fresh.evaluate("10 usd/kg in eur/hour"), null);
  assert.equal(fresh.evaluate("5 hours/day in eur"), null);
});

// --- shorthand (pere-doc #3) ------------------------------------------------

for (const { input, value, expression } of [
  { input: "USD1K", value: "$1,000.00", expression: "1,000 USD" },
  { input: "EUR 2.5M", value: "€2,500,000.00", expression: "2,500,000 EUR" },
  { input: "10k usd", value: "$10,000.00", expression: "10,000 USD" },
  { input: "$1.5k", value: "$1,500.00", expression: "1,500 USD" },
  { input: "USD1K in eur", value: "€800.00", expression: "1,000 USD → EUR" },
]) {
  test(`shorthand: ${input} -> ${value}`, () => {
    const calc = fresh.evaluate(input);
    assert.ok(calc);
    assert.equal(calc.value, value);
    assert.equal(calc.expression, expression);
  });
}

test("a bare amount without a magnitude suffix stays out", () => {
  assert.equal(fresh.evaluate("10 usd"), null);
  assert.equal(fresh.evaluate("$5"), null);
});
