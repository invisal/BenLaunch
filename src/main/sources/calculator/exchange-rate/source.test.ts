import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, test } from 'node:test'

import { ExchangeRateSource } from './source.ts'
import { currentRates, resetRatesForTests, setRatesDirForTests } from './store.ts'

const LIVE = { base: 'USD', asOf: '2026-06-01', rates: { USD: 1, EUR: 0.81, GBP: 0.76 } }

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'exrate-'))
  setRatesDirForTests(dir)
})
afterEach(() => {
  resetRatesForTests()
  rmSync(dir, { recursive: true, force: true })
})

test('contributes no actions', async () => {
  const src = new ExchangeRateSource(async () => LIVE)
  assert.deepEqual(await src.provide(), [])
  assert.equal(src.owns(), false)
})

test('a fetch pushes the fresh rates into the shared store', async () => {
  const src = new ExchangeRateSource(async () => LIVE)
  src.init() // the base kicks off fetch()

  for (let i = 0; i < 100 && currentRates().fetchedAt === 0; i++) {
    await new Promise((r) => setTimeout(r, 2))
  }
  assert.deepEqual(currentRates().rates, LIVE.rates)
})

test('a failing fetch is swallowed and leaves the seed in place', async () => {
  const src = new ExchangeRateSource(async () => {
    throw new Error('offline')
  })
  src.init()
  await new Promise((r) => setTimeout(r, 30))
  assert.equal(currentRates().fetchedAt, 0) // still the seed
})
