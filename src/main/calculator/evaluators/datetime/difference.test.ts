import assert from 'node:assert/strict'
import { test } from 'node:test'

import { resolveDifference } from './difference.ts'

const NOW = new Date(2026, 8, 5, 10, 0, 0) // Sat 5 Sep 2026

test('between A and B, explicit unit', () => {
  const calc = resolveDifference('days between 1 Jan and 1 Apr', NOW)
  assert.ok(calc)
  assert.equal(calc.value, '90 days')
  assert.equal(calc.rawValue, '90')
})

test('between A and B, no unit auto-picks weeks over 56 days', () => {
  const calc = resolveDifference('between 1 Jan and 1 Apr', NOW)
  assert.ok(calc)
  assert.equal(calc.value, '13 weeks')
})

test('month-day refs on either side of "now" are chained to the same season', () => {
  // Naively, "1 Jan" resolves to next year while "15 Mar" stays this year,
  // putting them 292 days apart backwards. Chaining fixes it to 73 days.
  const calc = resolveDifference('days between 1 Jan and 15 Mar', NOW)
  assert.ok(calc)
  assert.equal(calc.value, '73 days')
})

test('explicit ISO dates', () => {
  const calc = resolveDifference('days between 2024-01-15 and 2024-06-30', NOW)
  assert.ok(calc)
  assert.equal(calc.value, '167 days')
})

test('bare "A to B" form', () => {
  const calc = resolveDifference('1990-05-01 to today', NOW)
  assert.ok(calc)
  assert.equal(calc.value, '436 months')
})

for (const input of [
  '5 to 10', // neither side is a date
  '9 to 5', // ditto
  'flight to paris',
  'message to bob',
  '',
]) {
  test(`resolveDifference(${JSON.stringify(input)}) -> null`, () => {
    assert.equal(resolveDifference(input, NOW), null)
  })
}
