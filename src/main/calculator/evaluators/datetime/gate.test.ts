import assert from 'node:assert/strict'
import { test } from 'node:test'

import { looksLikeDate } from './gate.ts'

for (const input of [
  'tomorrow',
  '35 days ago',
  'monday in 3 weeks',
  'days until 25 Dec',
  'days between 1 Jan and 1 Apr',
  'weeks left in the quarter',
  'in 10 business days',
  'first day of next month',
  'last friday',
  'now + 90 min',
  'in 45 minutes',
  '3:45pm + 5',
  'August 5 + 5',
  'August 5 minus 3', // the "plus"/"minus" word, not just the symbol
  '9:00 + 8h',
  '2026-01-15 + 2w',
]) {
  test(`looksLikeDate(${JSON.stringify(input)}) -> true`, () => {
    assert.equal(looksLikeDate(input), true)
  })
}

for (const input of [
  'chrome',
  '5 + 3',
  '10 usd to eur',
  '',
  'sunny and warm',
  'photoshop',
  'call at 5pm', // a time, but no ± operator
  '1:1 meeting',
  'spam + 5', // "am" but no digit before it
  'august occasion', // a month word, but no operand + operator
]) {
  test(`looksLikeDate(${JSON.stringify(input)}) -> false`, () => {
    assert.equal(looksLikeDate(input), false)
  })
}
