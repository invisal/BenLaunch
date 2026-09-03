import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, test } from 'node:test'

import { readRatesCache, writeRatesCache, type RatesSnapshot } from './cache.ts'

const SNAP: RatesSnapshot = {
  base: 'USD',
  asOf: '2026-06-01',
  rates: { USD: 1, EUR: 0.8, GBP: 0.75 },
  fetchedAt: 5000,
}

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'exrate-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

test('write then read round-trips', () => {
  writeRatesCache(dir, SNAP)
  assert.deepEqual(readRatesCache(dir), SNAP)
})

test('missing file returns null (no error)', () => {
  assert.equal(readRatesCache(dir), null)
})

test('write creates the directory if needed', () => {
  const nested = join(dir, 'a', 'b')
  writeRatesCache(nested, SNAP)
  assert.deepEqual(readRatesCache(nested), SNAP)
})

test('corrupt or wrong-version file returns null', () => {
  writeFileSync(join(dir, 'exchange-rates.json'), '{ not json')
  assert.equal(readRatesCache(dir), null)

  writeFileSync(
    join(dir, 'exchange-rates.json'),
    JSON.stringify({ version: 99, base: 'USD', asOf: 'x', rates: { USD: 1 }, fetchedAt: 1 }),
  )
  assert.equal(readRatesCache(dir), null)
})

test('a missing fetchedAt defaults to 0', () => {
  writeFileSync(
    join(dir, 'exchange-rates.json'),
    JSON.stringify({ version: 1, base: 'USD', asOf: '2026-06-01', rates: { USD: 1 } }),
  )
  assert.equal(readRatesCache(dir)?.fetchedAt, 0)
})
