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
]) {
  test(`looksLikeDate(${JSON.stringify(input)}) -> true`, () => {
    assert.equal(looksLikeDate(input), true)
  })
}

for (const input of ['chrome', '5 + 3', '10 usd to eur', '', 'sunny and warm', 'photoshop']) {
  test(`looksLikeDate(${JSON.stringify(input)}) -> false`, () => {
    assert.equal(looksLikeDate(input), false)
  })
}
