import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, test } from 'node:test'

import { writeRatesCache } from './cache.ts'
import { RATES_SEED } from './seed.ts'
import {
  currentRates,
  ratesAgeMs,
  ratesUpdatedAgeMs,
  resetRatesForTests,
  setCurrentRates,
  setRatesDirForTests,
} from './store.ts'

const day = 24 * 60 * 60 * 1000
const asOf = (d: string) => Date.parse(`${d}T00:00:00Z`)
const LIVE = { base: 'USD', asOf: '2026-06-01', rates: { USD: 1, EUR: 0.8, GBP: 0.75 } }

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'exrate-'))
  setRatesDirForTests(dir)
})
afterEach(() => {
  resetRatesForTests()
  rmSync(dir, { recursive: true, force: true })
})

test('with no cache file, currentRates() serves the bundled seed', () => {
  assert.deepEqual(currentRates().rates, RATES_SEED.rates)
  assert.equal(currentRates().fetchedAt, 0)
})

test('currentRates() prefers a persisted cache file', () => {
  writeRatesCache(dir, { ...LIVE, fetchedAt: 1234 })
  assert.deepEqual(currentRates().rates, LIVE.rates)
})

test('setCurrentRates() swaps memory and persists', () => {
  setCurrentRates(LIVE)
  assert.deepEqual(currentRates().rates, LIVE.rates)

  // A fresh read (dir unchanged) picks the persisted rates back up.
  resetRatesForTests()
  setRatesDirForTests(dir)
  assert.deepEqual(currentRates().rates, LIVE.rates)
})

test('ratesAgeMs() measures distance from the "as of" date, floored at 0', () => {
  setCurrentRates(LIVE)
  assert.equal(ratesAgeMs(asOf('2026-06-05')), 4 * day)
  assert.equal(ratesAgeMs(asOf('2026-05-30')), 0) // clock behind the provider date
})

test('ratesUpdatedAgeMs() counts from the last fetch, or the "as of" date for the seed', () => {
  // Seed only — never fetched — falls back to the "as of" distance.
  assert.equal(ratesUpdatedAgeMs(asOf('2026-06-05')), ratesAgeMs(asOf('2026-06-05')))

  // After a fetch it's measured from `fetchedAt` (set to the real clock by setCurrentRates).
  setCurrentRates(LIVE)
  const fetchedAt = currentRates().fetchedAt
  assert.equal(ratesUpdatedAgeMs(fetchedAt + 5 * 60 * 1000), 5 * 60 * 1000)
})
