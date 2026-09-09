import assert from 'node:assert/strict'
import { test } from 'node:test'

import { resolveRelative } from './relative.ts'

const NOW = new Date(2026, 8, 5, 10, 0, 0) // Sat 5 Sep 2026

for (const { input, rawValue } of [
  { input: 'tomorrow', rawValue: '2026-09-06' },
  { input: '35 days ago', rawValue: '2026-08-01' },
  { input: 'monday in 3 weeks', rawValue: '2026-09-26' },
  { input: '2 weeks from now', rawValue: '2026-09-19' },
  { input: 'next friday', rawValue: '2026-09-11' },
]) {
  test(`resolveRelative(${JSON.stringify(input)}) -> ${rawValue}`, () => {
    assert.equal(resolveRelative(input, NOW)?.rawValue, rawValue)
  })
}

test('phrases that carry a time-of-day resolve to an exact minute', () => {
  // NOW is 10:00 on Sat 5 Sep 2026.
  assert.deepEqual(
    { ...resolveRelative('now + 90 min', NOW) },
    { expression: 'now + 90 min', value: 'Sat, Sep 5, 11:30 AM', rawValue: '2026-09-05 11:30' },
  )
  assert.equal(resolveRelative('in 3 hours', NOW)?.rawValue, '2026-09-05 13:00')
  assert.equal(resolveRelative('90 minutes from now', NOW)?.rawValue, '2026-09-05 11:30')
})

test('"last <weekday>" resolves to the past despite the forwardDate default', () => {
  // Bare "friday" defaults forwardDate:true (next occurrence), but an
  // explicit "last" must never be pushed into the future.
  assert.equal(resolveRelative('last friday', NOW)?.rawValue, '2026-09-04')
})

test('business days — chrono has no native concept of these', () => {
  assert.equal(resolveRelative('in 10 business days', NOW)?.rawValue, '2026-09-18')
})

test('ordinal period boundaries — chrono mishandles these on its own', () => {
  assert.equal(resolveRelative('first day of next month', NOW)?.rawValue, '2026-10-01')
  assert.equal(resolveRelative('last day of this month', NOW)?.rawValue, '2026-09-30')
  assert.equal(resolveRelative('first day of the year', NOW)?.rawValue, '2026-01-01')
})

test('first/last day of an explicit year or month', () => {
  assert.equal(resolveRelative('first day of 2029', NOW)?.rawValue, '2029-01-01')
  assert.equal(resolveRelative('last day of 2029', NOW)?.rawValue, '2029-12-31')
  assert.equal(resolveRelative('last day of february 2028', NOW)?.rawValue, '2028-02-29') // leap year
})

test('rejects a query that merely contains a date-ish word', () => {
  // Partial chrono matches ("today" inside "today's news", "monday" inside
  // "monday.com") must not hijack an ordinary search query.
  assert.equal(resolveRelative("today's news", NOW), null)
  assert.equal(resolveRelative('monday.com', NOW), null)
})

for (const input of ['chrome', '5 + 3', '', 'photoshop']) {
  test(`resolveRelative(${JSON.stringify(input)}) -> null`, () => {
    assert.equal(resolveRelative(input, NOW), null)
  })
}
