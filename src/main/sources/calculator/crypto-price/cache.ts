/**
 * On-disk cache for the last fetched crypto prices, same mechanics as
 * `exchange-rate/cache.ts`: Electron-free (the directory is passed in),
 * versioned, atomic temp-write + rename, failures swallowed with a
 * `[crypto-price]` prefix.
 */
import {
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const CACHE_VERSION = 1;

/** Ticker → price in USD, and when we fetched it (epoch ms). */
export interface CryptoPrices {
  fetchedAt: number;
  usd: Record<string, number>;
}

interface CacheFile extends CryptoPrices {
  version: number;
}

function cachePath(dir: string): string {
  return join(dir, "crypto-prices.json");
}

function isCryptoPrices(value: unknown): value is CryptoPrices {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<CryptoPrices>;
  return (
    typeof v.fetchedAt === "number" &&
    !!v.usd &&
    typeof v.usd === "object" &&
    Object.values(v.usd).every((n) => typeof n === "number" && n > 0)
  );
}

export function readCryptoCache(dir: string): CryptoPrices | null {
  try {
    const file = JSON.parse(
      readFileSync(cachePath(dir), "utf8"),
    ) as Partial<CacheFile>;
    if (file.version !== CACHE_VERSION || !isCryptoPrices(file)) return null;
    return { fetchedAt: file.fetchedAt, usd: file.usd };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("[crypto-price] Failed to read cache:", error);
    }
    return null;
  }
}

export function writeCryptoCache(dir: string, prices: CryptoPrices): void {
  const file = cachePath(dir);
  const tmp = `${file}.tmp`;
  const payload: CacheFile = { version: CACHE_VERSION, ...prices };
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(tmp, JSON.stringify(payload));
    renameSync(tmp, file);
  } catch (error) {
    console.error("[crypto-price] Failed to write cache:", error);
    try {
      unlinkSync(tmp);
    } catch {
      /* nothing to clean up */
    }
  }
}
