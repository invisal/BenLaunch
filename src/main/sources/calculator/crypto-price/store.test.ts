import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";

import { readCryptoCache, writeCryptoCache } from "./cache.ts";
import { toTickerPrices } from "./fetch.ts";
import {
  currentCryptoPrices,
  resetCryptoForTests,
  setCryptoDirForTests,
  setCryptoEnabled,
  setCryptoPrices,
} from "./store.ts";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "crypto-"));
  setCryptoDirForTests(dir);
});
afterEach(() => {
  resetCryptoForTests();
  rmSync(dir, { recursive: true, force: true });
});

test("no seed: nothing until the first fetch", () => {
  assert.equal(currentCryptoPrices(), null);
});

test("setCryptoPrices updates the store and persists to disk", () => {
  setCryptoPrices({ BTC: 64000, ETH: 3000 }, 1234);
  assert.deepEqual(currentCryptoPrices(), {
    fetchedAt: 1234,
    usd: { BTC: 64000, ETH: 3000 },
  });
  assert.deepEqual(readCryptoCache(dir), {
    fetchedAt: 1234,
    usd: { BTC: 64000, ETH: 3000 },
  });
});

test("a cold start reads the disk cache", () => {
  writeCryptoCache(dir, { fetchedAt: 99, usd: { SOL: 150 } });
  assert.deepEqual(currentCryptoPrices(), { fetchedAt: 99, usd: { SOL: 150 } });
});

test("disabled → no prices, even with a cache", () => {
  setCryptoPrices({ BTC: 64000 });
  setCryptoEnabled(false);
  assert.equal(currentCryptoPrices(), null);
  setCryptoEnabled(true);
  assert.deepEqual(currentCryptoPrices()?.usd, { BTC: 64000 });
});

test("a corrupt or invalid cache reads as null", async () => {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(join(dir, "crypto-prices.json"), "{ nope");
  assert.equal(readCryptoCache(dir), null);
  writeFileSync(
    join(dir, "crypto-prices.json"),
    JSON.stringify({ version: 1, fetchedAt: 1, usd: { BTC: -1 } }),
  );
  assert.equal(readCryptoCache(dir), null);
});

test("toTickerPrices maps CoinGecko ids to tickers and drops bad entries", () => {
  assert.deepEqual(
    toTickerPrices({
      bitcoin: { usd: 64000 },
      ethereum: { usd: 0 },
      solana: {},
      unknowncoin: { usd: 5 },
    }),
    { BTC: 64000 },
  );
});
