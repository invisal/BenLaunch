import assert from 'node:assert/strict'
import { test } from 'node:test'

import { convert } from './convert.ts'

// units of X per 1 USD
const RATES = { USD: 1, EUR: 0.8, GBP: 0.75, JPY: 150 }

test('USD → other', () => {
  assert.equal(convert(10, 'USD', 'EUR', RATES), 8)
  assert.equal(convert(2, 'USD', 'JPY', RATES), 300)
})

test('other → USD', () => {
  assert.equal(convert(8, 'EUR', 'USD', RATES), 10)
})

test('cross rate (neither is base)', () => {
  // 100 EUR → USD (125) → GBP (93.75)
  assert.equal(convert(100, 'EUR', 'GBP', RATES), 93.75)
})

test('identity', () => {
  assert.equal(convert(42, 'EUR', 'EUR', RATES), 42)
})

test('unknown currency → null', () => {
  assert.equal(convert(1, 'USD', 'XYZ', RATES), null)
  assert.equal(convert(1, 'XYZ', 'USD', RATES), null)
})

test('base missing from the table is treated as 1 (Frankfurter-style)', () => {
  assert.equal(convert(10, 'USD', 'EUR', { EUR: 0.8 }), 8)
})
