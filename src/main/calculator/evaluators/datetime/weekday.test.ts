import assert from 'node:assert/strict'
import { test } from 'node:test'

import { resolveWeekday } from './weekday.ts'

const NOW = new Date(2026, 8, 5, 10, 0, 0) // Sat 5 Sep 2026

test('every phrasing resolves the same date to its weekday', () => {
  for (const input of [
    'day of 2026-12-25',
    'weekday of 2026-12-25',
    'what day is 2026-12-25',
    'what day of the week is 2026-12-25',
    'what day of week is 2026-12-25',
    '2026-12-25 what day',
    '2026-12-25 day of week',
  ]) {
    const calc = resolveWeekday(input, NOW)
    assert.ok(calc, input)
    assert.equal(calc.value, 'Friday, Dec 25', input)
    assert.equal(calc.rawValue, 'Friday', input)
  }
})

test('a different year is shown', () => {
  assert.equal(resolveWeekday('what day is 1 Jan 2029', NOW)?.value, 'Monday, Jan 1, 2029')
})

test('natural-language dates work too', () => {
  assert.equal(resolveWeekday('what day is tomorrow', NOW)?.value, 'Sunday, Sep 6')
  assert.equal(resolveWeekday('day of next friday', NOW)?.value, 'Friday, Sep 11')
})

test('rejects when the date part does not fully parse', () => {
  for (const input of ['what day is the meeting', 'day of chrome', 'weekday of stuff', '']) {
    assert.equal(resolveWeekday(input, NOW), null, input)
  }
})

test('rejects phrasings that are not a weekday question', () => {
  for (const input of ['tomorrow', 'days until 25 Dec', '5 + 3', 'day trip to paris']) {
    assert.equal(resolveWeekday(input, NOW), null, input)
  }
})
