/**
 * The process-wide "current" exchange rates — live fetch > disk cache > bundled
 * seed. `ExchangeRateSource` updates it after every fetch; the calculator's
 * `currency` evaluator reads it on every keystroke (synchronously).
 *
 * It resolves the `userData` directory itself, lazily via `createRequire`, so
 * the currency evaluator (which is unit-tested, outside Electron) can import it.
 */
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readRatesCache, writeRatesCache, type RatesData, type RatesSnapshot } from './cache.ts'
import { RATES_SEED } from './seed.ts'

let dirOverride: string | null = null

function userDataDir(): string {
  if (dirOverride) return dirOverride
  try {
    const electron = createRequire(import.meta.url)('electron') as typeof import('electron')
    return electron.app.getPath('userData')
  } catch {
    return join(tmpdir(), 'benlaunch-no-electron')
  }
}

let current: RatesSnapshot | null = null

/** The rates to use right now. Never empty — falls back to the bundled seed. */
export function currentRates(): RatesSnapshot {
  if (!current) current = readRatesCache(userDataDir()) ?? { ...RATES_SEED, fetchedAt: 0 }
  return current
}

/** Replace the current rates with a fresh fetch and persist them. */
export function setCurrentRates(data: RatesData): void {
  current = { ...data, fetchedAt: Date.now() }
  writeRatesCache(userDataDir(), current)
}

/** Milliseconds since the provider's "as of" date — how stale the numbers are. */
export function ratesAgeMs(now = Date.now()): number {
  const t = Date.parse(`${currentRates().asOf}T00:00:00Z`)
  return Number.isNaN(t) ? Infinity : Math.max(0, now - t)
}

/**
 * Milliseconds since we last *successfully fetched* the rates — for the "Updated
 * N minutes ago" footnote. Falls back to the "as of" date when we've never
 * fetched (only the bundled seed).
 */
export function ratesUpdatedAgeMs(now = Date.now()): number {
  const { fetchedAt } = currentRates()
  return fetchedAt > 0 ? Math.max(0, now - fetchedAt) : ratesAgeMs(now)
}

/** Test hooks. */
export function setRatesDirForTests(dir: string): void {
  dirOverride = dir
  current = null
}
export function resetRatesForTests(): void {
  dirOverride = null
  current = null
}
