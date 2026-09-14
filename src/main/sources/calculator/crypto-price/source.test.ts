import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";

import { CryptoPriceSource } from "./source.ts";
import {
  currentCryptoPrices,
  resetCryptoForTests,
  setCryptoDirForTests,
  setCryptoEnabled,
} from "./store.ts";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "crypto-src-"));
  setCryptoDirForTests(dir);
});
afterEach(() => {
  resetCryptoForTests();
  rmSync(dir, { recursive: true, force: true });
});

const settle = () => new Promise((r) => setTimeout(r, 30));

test("contributes no actions", async () => {
  const src = new CryptoPriceSource(async () => ({ BTC: 1 }));
  assert.deepEqual(await src.provide(), []);
  assert.equal(src.owns(), false);
});

test("a fetch pushes prices into the shared store", async () => {
  new CryptoPriceSource(async () => ({ BTC: 64000 })).init();
  await settle();
  assert.deepEqual(currentCryptoPrices()?.usd, { BTC: 64000 });
});

test("a failing fetch is swallowed", async () => {
  new CryptoPriceSource(async () => {
    throw new Error("offline");
  }).init();
  await settle();
  assert.equal(currentCryptoPrices(), null);
});

test("disabled → never calls the network", async () => {
  setCryptoEnabled(false);
  let calls = 0;
  new CryptoPriceSource(async () => {
    calls++;
    return { BTC: 1 };
  }).init();
  await settle();
  assert.equal(calls, 0);
});

test("refreshNow fetches immediately once re-enabled", async () => {
  setCryptoEnabled(false);
  const src = new CryptoPriceSource(async () => ({ ETH: 3000 }));
  src.init();
  await settle();
  assert.equal(currentCryptoPrices(), null);
  setCryptoEnabled(true);
  await src.refreshNow();
  assert.deepEqual(currentCryptoPrices()?.usd, { ETH: 3000 });
});
