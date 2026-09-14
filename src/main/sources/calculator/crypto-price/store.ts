/**
 * The process-wide crypto prices — live fetch > disk cache > nothing. Unlike
 * fiat rates there is **no bundled seed**: prices move too fast for a stale
 * baked-in number to be anything but misleading, so crypto conversion simply
 * isn't offered until the first successful fetch (then the cache covers
 * offline use). `CryptoPriceSource` writes it; the `currency` evaluator reads
 * it synchronously.
 *
 * `enabled` mirrors the user's "Crypto prices" setting (`actions.ts` pushes
 * it): when off, the evaluator sees no prices and the source never fetches.
 */
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  readCryptoCache,
  writeCryptoCache,
  type CryptoPrices,
} from "./cache.ts";

let dirOverride: string | null = null;

function userDataDir(): string {
  if (dirOverride) return dirOverride;
  try {
    const electron = createRequire(import.meta.url)(
      "electron",
    ) as typeof import("electron");
    return electron.app.getPath("userData");
  } catch {
    return join(tmpdir(), "benlaunch-no-electron");
  }
}

let current: CryptoPrices | null | undefined;
let enabled = true;

/** The prices to use right now, or `null` when disabled / never fetched. */
export function currentCryptoPrices(): CryptoPrices | null {
  if (!enabled) return null;
  if (current === undefined) current = readCryptoCache(userDataDir());
  return current;
}

/** Replace the current prices with a fresh fetch and persist them. */
export function setCryptoPrices(
  usd: Record<string, number>,
  now = Date.now(),
): void {
  current = { fetchedAt: now, usd };
  writeCryptoCache(userDataDir(), current);
}

export function cryptoEnabled(): boolean {
  return enabled;
}

export function setCryptoEnabled(value: boolean): void {
  enabled = value;
}

/** Test hooks. */
export function setCryptoDirForTests(dir: string): void {
  dirOverride = dir;
  current = undefined;
  enabled = true;
}
export function resetCryptoForTests(): void {
  dirOverride = null;
  current = undefined;
  enabled = true;
}
