import assert from 'node:assert/strict'
import { test } from 'node:test'

import { parse } from './parse.ts'

const KNOWN = new Set(['USD', 'EUR', 'GBP', 'JPY', 'INR', 'CAD', 'THB', 'CNY', 'KHR', 'MXN', 'BND'])

const ok: ReadonlyArray<{ input: string; amount: number; from: string; to: string }> = [
  { input: '10 usd in gbp', amount: 10, from: 'USD', to: 'GBP' },
  { input: '45 JPY to INR', amount: 45, from: 'JPY', to: 'INR' },
  { input: '$50 in eur', amount: 50, from: 'USD', to: 'EUR' },
  { input: '€100 to usd', amount: 100, from: 'EUR', to: 'USD' },
  { input: '10 dollars in euros', amount: 10, from: 'USD', to: 'EUR' },
  { input: '5 pounds to yen', amount: 5, from: 'GBP', to: 'JPY' },
  { input: '1,000 usd in eur', amount: 1000, from: 'USD', to: 'EUR' },
  { input: '1.2k dollars in yen', amount: 1200, from: 'USD', to: 'JPY' },
  { input: '2m cad to usd', amount: 2_000_000, from: 'CAD', to: 'USD' },
  { input: 'usd in eur', amount: 1, from: 'USD', to: 'EUR' }, // rate for 1
  { input: '500 gbp to thb', amount: 500, from: 'GBP', to: 'THB' },
  { input: '10 usd to eur.', amount: 10, from: 'USD', to: 'EUR' }, // trailing dot

  // Currency codes starting with k / m / b must not have their first letter
  // eaten as a magnitude suffix.
  { input: '5000 khr to usd', amount: 5000, from: 'KHR', to: 'USD' },
  { input: '2000 mxn to usd', amount: 2000, from: 'MXN', to: 'USD' },
  { input: '100 bnd in eur', amount: 100, from: 'BND', to: 'EUR' },
  { input: '2m khr in usd', amount: 2_000_000, from: 'KHR', to: 'USD' }, // real "m" suffix still works
]

for (const { input, amount, from, to } of ok) {
  test(`parse(${JSON.stringify(input)})`, () => {
    assert.deepEqual(parse(input, KNOWN), { amount, from, to })
  })
}

const nope: ReadonlyArray<string> = [
  '5 + 5',
  '128 GB to MB', // GB / MB aren't currencies
  '10 m to ft',
  '5 min to timespan',
  '10 in eur', // no source currency
  '10 usd', // no target
  'left half', // window command
  '10 xyz in usd', // unknown code
  'chrome',
  '',
]

for (const input of nope) {
  test(`parse(${JSON.stringify(input)}) -> null`, () => {
    assert.equal(parse(input, KNOWN), null)
  })
}
