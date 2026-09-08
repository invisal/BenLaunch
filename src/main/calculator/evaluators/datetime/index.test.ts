import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createDatetimeEvaluator } from './index.ts'

const NOW = new Date(2026, 8, 5, 10, 0, 0) // Sat 5 Sep 2026
const { evaluate } = createDatetimeEvaluator(() => NOW)

// --- resolves, one per resolver -----------------------------------------

for (const { input, value } of [
  { input: 'tomorrow', value: 'Sun, Sep 6' },
  { input: 'now + 90 min', value: 'Sat, Sep 5, 11:30 AM' },
  { input: '3:45pm + 5', value: '8:45 PM' },
  { input: 'August 5 + 5', value: 'Mon, Aug 10' },
  { input: 'August 5 minus 3', value: 'Sun, Aug 2' },
  { input: 'days until 25 Dec', value: '111 days' },
  { input: 'days between 1 Jan and 1 Apr', value: '90 days' },
]) {
  test(`datetime.evaluate(${JSON.stringify(input)}) -> ${value}`, () => {
    assert.equal(evaluate(input)?.value, value)
  })
}

// --- rejects (gate, or no resolver claims it) ---------------------------

for (const input of [
  '',
  'chrome',
  '5 + 3',
  '10 usd to eur',
  '5 in ft',
  "today's news",
  'monday.com',
]) {
  test(`datetime.evaluate(${JSON.stringify(input)}) -> null`, () => {
    assert.equal(evaluate(input), null)
  })
}
