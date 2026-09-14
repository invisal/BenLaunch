import assert from "node:assert/strict";
import { test } from "node:test";

import {
  cryptoRates,
  formatCrypto,
  isCrypto,
  pricesLabel,
  resolveAsset,
} from "./crypto.ts";

const KNOWN = new Set([
  "USD",
  "EUR",
  "GBP",
  "PEN",
  "BTC",
  "ETH",
  "SOL",
  "USDT",
]);

test("isCrypto", () => {
  assert.equal(isCrypto("BTC"), true);
  assert.equal(isCrypto("USDT"), true);
  assert.equal(isCrypto("USD"), false);
  assert.equal(isCrypto("btc"), false); // codes are uppercase
});

test("cryptoRates inverts USD prices and drops unknown / invalid tickers", () => {
  assert.deepEqual(
    cryptoRates({
      fetchedAt: 0,
      usd: { BTC: 64000, ETH: 3200, FOO: 5, SOL: 0 },
    }),
    {
      BTC: 1 / 64000,
      ETH: 1 / 3200,
    },
  );
  assert.deepEqual(cryptoRates(null), {});
});

for (const [token, expected] of [
  ["btc", "BTC"],
  ["Bitcoin", "BTC"],
  ["ether", "ETH"],
  ["usdt", "USDT"],
  ["sol", "SOL"], // Solana wins over the Peruvian sol's nickname
  ["pen", "PEN"],
  ["usd", "USD"],
  ["€", "EUR"],
  ["₿", "BTC"],
  ["dogecoin", null], // not in `known`
  ["apples", null],
] as const) {
  test(`resolveAsset(${JSON.stringify(token)}) -> ${expected}`, () => {
    assert.equal(resolveAsset(token, KNOWN), expected);
  });
}

test("formatCrypto: 4 decimals from 1 up, 6 significant digits below", () => {
  assert.deepEqual(formatCrypto(0.000015625, "BTC"), {
    value: "0.000015625 BTC",
    rawValue: "0.000015625",
  });
  assert.deepEqual(formatCrypto(1.23456789, "ETH"), {
    value: "1.2346 ETH",
    rawValue: "1.2346",
  });
  assert.deepEqual(formatCrypto(64012.5, "USDT"), {
    value: "64,012.5 USDT",
    rawValue: "64012.5",
  });
});

test("pricesLabel names the fetch time", () => {
  assert.equal(
    pricesLabel(new Date(2026, 8, 5, 14, 5).getTime()),
    "Prices as of 14:05",
  );
});
