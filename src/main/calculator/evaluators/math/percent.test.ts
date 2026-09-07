import assert from 'node:assert/strict'
import { test } from 'node:test'

import { formatPercent, parsePercentQuestion, rewritePercentOf } from './percent.ts'

// --- rewritePercentOf ----------------------------------------------------

const rewriteCases: ReadonlyArray<{ raw: string; expected: string }> = [
  { raw: '32% of 5', expected: '32% * 5' },
  { raw: '20% of 1499', expected: '20% * 1499' },
  { raw: '52% of 900', expected: '52% * 900' },
  // Passthrough — no "of" right after a "%".
  { raw: '850 + 8.25%', expected: '850 + 8.25%' },
  { raw: '250 - 10%', expected: '250 - 10%' },
  { raw: 'cost of 5 apples', expected: 'cost of 5 apples' },
]

for (const { raw, expected } of rewriteCases) {
  test(`rewritePercentOf(${JSON.stringify(raw)}) -> ${JSON.stringify(expected)}`, () => {
    assert.equal(rewritePercentOf(raw), expected)
  })
}

// --- parsePercentQuestion -------------------------------------------------

test('parsePercentQuestion: "what percent is A of B"', () => {
  assert.equal(parsePercentQuestion('what percent is 32 of 200')?.percent, 16)
  assert.equal(parsePercentQuestion('what percentage is 1 of 4')?.percent, 25)
})

test('parsePercentQuestion: "what percent(age) of B is A"', () => {
  assert.equal(parsePercentQuestion('what percent of 200 is 32')?.percent, 16)
  assert.equal(parsePercentQuestion('what percentage of 4 is 1')?.percent, 25)
})

test('parsePercentQuestion rejects division by zero and non-matches', () => {
  assert.equal(parsePercentQuestion('what percent is 32 of 0'), null)
  assert.equal(parsePercentQuestion('32% of 5'), null)
  assert.equal(parsePercentQuestion('5 + 3'), null)
})

// --- formatPercent ----------------------------------------------------

test('formatPercent trims to a friendly percent', () => {
  assert.equal(formatPercent(16), '16')
  assert.equal(formatPercent(100 / 3), '33.33')
  assert.equal(formatPercent(25), '25')
})
