/**
 * On-disk cache for the last fetched exchange rates. `ExchangeRateSource` writes
 * it after every successful fetch; `store.ts` reads it on the first query so the
 * currency evaluator has numbers before the network answers (or when offline).
 *
 * Electron-free (the test suite imports it directly): the directory is passed
 * in — `store.ts` supplies the real one. Advisory: every failure is swallowed
 * with an `[exchange-rate]` prefix.
 */
import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** Bumped when the persisted shape changes, to invalidate old files. */
const CACHE_VERSION = 1

/** A set of rates as produced by a fetch or the bundled seed. Base is USD. */
export interface RatesData {
  base: string
  /** The provider's "as of" date, `YYYY-MM-DD`. */
  asOf: string
  /** ISO code → units of that currency per 1 unit of `base`. */
  rates: Record<string, number>
}

/** `RatesData` plus when we fetched it (epoch ms; 0 = seed / never fetched). */
export interface RatesSnapshot extends RatesData {
  fetchedAt: number
}

interface CacheFile extends RatesSnapshot {
  version: number
}

function cachePath(dir: string): string {
  return join(dir, 'exchange-rates.json')
}

function isRatesData(value: unknown): value is RatesData {
  if (!value || typeof value !== 'object') return false
  const v = value as Partial<RatesData>
  return (
    typeof v.base === 'string' &&
    typeof v.asOf === 'string' &&
    !!v.rates &&
    typeof v.rates === 'object' &&
    Object.values(v.rates).every((n) => typeof n === 'number')
  )
}

/** The persisted snapshot, or `null` on any error / version mismatch. */
export function readRatesCache(dir: string): RatesSnapshot | null {
  try {
    const file = JSON.parse(readFileSync(cachePath(dir), 'utf8')) as Partial<CacheFile>
    const fetchedAt = typeof file.fetchedAt === 'number' ? file.fetchedAt : 0
    if (file.version !== CACHE_VERSION || !isRatesData(file)) return null
    return { base: file.base, asOf: file.asOf, rates: file.rates, fetchedAt }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('[exchange-rate] Failed to read cache:', error)
    }
    return null
  }
}

/** Persists `snapshot` via a temp file + atomic rename. */
export function writeRatesCache(dir: string, snapshot: RatesSnapshot): void {
  const file = cachePath(dir)
  const tmp = `${file}.tmp`
  const payload: CacheFile = { version: CACHE_VERSION, ...snapshot }
  try {
    mkdirSync(dir, { recursive: true })
    writeFileSync(tmp, JSON.stringify(payload))
    renameSync(tmp, file)
  } catch (error) {
    console.error('[exchange-rate] Failed to write cache:', error)
    try {
      unlinkSync(tmp)
    } catch {
      /* nothing to clean up */
    }
  }
}
