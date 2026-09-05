import assert from 'node:assert/strict'
import { test } from 'node:test'

import { resolveCountdown } from './countdown.ts'

const NOW = new Date(2026, 8, 5, 10, 0, 0) // Sat 5 Sep 2026

test('days until a date', () => {
  const calc = resolveCountdown('days until 25 Dec', NOW)
  assert.ok(calc)
  assert.equal(calc.value, '111 days')
  assert.equal(calc.rawValue, '111')
})

test('weeks until a date', () => {
  const calc = resolveCountdown('weeks until 2026-12-01', NOW)
  assert.ok(calc)
  assert.equal(calc.value.endsWith('weeks'), true)
})

test('days left in the month', () => {
  const calc = resolveCountdown('days left in the month', NOW)
  assert.ok(calc)
  assert.equal(calc.value, '26 days')
})

test('days left in the quarter (Q3 ends 30 Sep)', () => {
  const calc = resolveCountdown('days left in the quarter', NOW)
  assert.ok(calc)
  assert.equal(calc.value, '26 days')
})

test('days left in the year', () => {
  const calc = resolveCountdown('days left in the year', NOW)
  assert.ok(calc)
  assert.equal(calc.value, '118 days')
})

test('rejects a target already in the past', () => {
  assert.equal(resolveCountdown('days until 1 Jan 2020', NOW), null)
})

for (const input of ['5 + 3', 'chrome', '', 'days between 1 Jan and 1 Apr']) {
  test(`resolveCountdown(${JSON.stringify(input)}) -> null`, () => {
    assert.equal(resolveCountdown(input, NOW), null)
  })
}
