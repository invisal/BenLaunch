import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createTimezoneEvaluator } from './index.ts'

const NOW = new Date('2026-06-15T12:00:00Z')
const { evaluate } = createTimezoneEvaluator(() => NOW, () => 'UTC')

// --- resolves, one per resolver -----------------------------------------

for (const { input, value } of [
  { input: 'time in Tokyo', value: '21:00 · GMT+9' },
  { input: '5pm ldn in sf', value: '09:00 Mon' },
]) {
  test(`timezone.evaluate(${JSON.stringify(input)}) -> ${value}`, () => {
    assert.equal(evaluate(input)?.value, value)
  })
}

test('resolveConvert is tried before resolveClock', () => {
  // Both could plausibly match text containing "time", but a leading time
  // token + "in <place>" is the more specific shape.
  assert.equal(evaluate('noon Tokyo in London')?.value, '04:00 Mon')
})

// --- rejects (gate, or no resolver claims it) ---------------------------

for (const input of [
  '',
  'chrome',
  '5 + 3',
  '10 usd to eur',
  '35 days ago',
  'lunch time',
  'time in nowhere-at-all',
]) {
  test(`timezone.evaluate(${JSON.stringify(input)}) -> null`, () => {
    assert.equal(evaluate(input), null)
  })
}
