import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createCurrencyEvaluator, type RateProvider } from './index.ts'

const RATES = { USD: 1, EUR: 0.8, GBP: 0.75, JPY: 150 }

/** A fixed rate provider — `ageMs` (since last fetch) drives the footnote. */
function provider(ageMs = 0): RateProvider {
  return {
    rates: () => RATES,
    updatedAgeMs: () => ageMs,
  }
}

const fresh = createCurrencyEvaluator(provider())

test('converts and formats', () => {
  const calc = fresh.evaluate('10 usd in gbp')
  assert.ok(calc)
  assert.equal(calc.value, '£7.50')
  assert.equal(calc.rawValue, '7.50')
  assert.equal(calc.expression, '10 USD → GBP')
})

test('a bare "usd in eur" shows the rate for 1', () => {
  assert.equal(fresh.evaluate('usd in eur')?.value, '€0.80')
})

test('symbol prefix and shorthand', () => {
  assert.equal(fresh.evaluate('$1.5k in eur')?.value, '€1,200.00')
})

test('non-currency queries return null', () => {
  for (const q of ['10 + 5', '128 GB to MB', 'chrome', '10 m to ft']) {
    assert.equal(fresh.evaluate(q), null, q)
  }
})

test('the result footnote says how long ago the rates were fetched', () => {
  const min = 60_000
  assert.equal(fresh.evaluate('10 usd in gbp')?.footnote, 'Updated just now')
  assert.equal(createCurrencyEvaluator(provider(4 * min)).evaluate('1 usd in gbp')?.footnote, 'Updated 4 minutes ago')
  assert.equal(createCurrencyEvaluator(provider(3 * 60 * min)).evaluate('1 usd in gbp')?.footnote, 'Updated 3 hours ago')
  assert.equal(createCurrencyEvaluator(provider(30 * 60 * min)).evaluate('1 usd in gbp')?.footnote, 'Updated yesterday')
  assert.equal(createCurrencyEvaluator(provider(5 * 24 * 60 * min)).evaluate('1 usd in gbp')?.footnote, 'Updated 5 days ago')
})
