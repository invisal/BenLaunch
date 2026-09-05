import assert from 'node:assert/strict'
import { test } from 'node:test'

import { CURRENCIES, resolveCurrency, SYMBOL_CHARS } from './currencies.ts'

const ALL = new Set(Object.keys(CURRENCIES))

test('every ISO code in CURRENCIES resolves to itself', () => {
  for (const code of ALL) {
    assert.equal(resolveCurrency(code.toLowerCase(), ALL), code, code)
  }
})

test('full currency names resolve', () => {
  assert.equal(resolveCurrency('Swedish Krona', ALL), 'SEK')
  assert.equal(resolveCurrency('vietnamese dong', ALL), 'VND')
  assert.equal(resolveCurrency('West African CFA Franc', ALL), 'XOF')
  assert.equal(resolveCurrency('british pound', ALL), 'GBP')
})

test('nicknames and ambiguous names take the curated default', () => {
  assert.equal(resolveCurrency('bucks', ALL), 'USD')
  assert.equal(resolveCurrency('quid', ALL), 'GBP')
  assert.equal(resolveCurrency('peso', ALL), 'MXN') // not ARS/CLP/COP/…
  assert.equal(resolveCurrency('franc', ALL), 'CHF') // not the CFA francs
  assert.equal(resolveCurrency('krona', ALL), 'SEK')
})

test('symbols resolve, ambiguous ones to their commonest currency', () => {
  assert.equal(resolveCurrency('$', ALL), 'USD')
  assert.equal(resolveCurrency('€', ALL), 'EUR')
  assert.equal(resolveCurrency('₦', ALL), 'NGN')
  assert.equal(resolveCurrency('฿', ALL), 'THB')
})

test('only currencies in `known` resolve', () => {
  const known = new Set(['USD', 'EUR'])
  assert.equal(resolveCurrency('gbp', known), null)
  assert.equal(resolveCurrency('yen', known), null)
  assert.equal(resolveCurrency('usd', known), 'USD')
})

test('non-currency tokens return null', () => {
  for (const t of ['', 'GB', 'MB', 'ft', 'chrome', 'doge', '10']) {
    assert.equal(resolveCurrency(t, ALL), null, t)
  }
})

test('SYMBOL_CHARS are all single characters', () => {
  assert.ok(SYMBOL_CHARS.length > 0)
  for (const s of SYMBOL_CHARS) assert.equal([...s].length, 1, s)
})
