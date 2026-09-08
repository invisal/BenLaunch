import assert from 'node:assert/strict'
import { test } from 'node:test'

import { formatDate, formatDateTime, formatDuration, normalizeDurationUnit } from './format.ts'

const NOW = new Date(2026, 8, 5, 10, 0, 0) // Sat 5 Sep 2026

test('formatDate: same year omits the year', () => {
  const { value, rawValue } = formatDate(new Date(2026, 11, 25), NOW)
  assert.equal(value, 'Fri, Dec 25')
  assert.equal(rawValue, '2026-12-25')
})

test('formatDate: different year appends it', () => {
  const { value, rawValue } = formatDate(new Date(2027, 0, 1), NOW)
  assert.equal(value, 'Fri, Jan 1, 2027')
  assert.equal(rawValue, '2027-01-01')
})

test('formatDateTime: same year, to the minute', () => {
  const { value, rawValue } = formatDateTime(new Date(2026, 8, 5, 11, 30), NOW)
  assert.equal(value, 'Sat, Sep 5, 11:30 AM')
  assert.equal(rawValue, '2026-09-05 11:30')
})

test('formatDateTime: different year appends it', () => {
  const { value, rawValue } = formatDateTime(new Date(2027, 0, 1, 16, 0), NOW)
  assert.equal(value, 'Fri, Jan 1, 2027, 4:00 PM')
  assert.equal(rawValue, '2027-01-01 16:00')
})

test('formatDuration: explicit unit', () => {
  assert.equal(formatDuration(90 * 24 * 60 * 60 * 1000, 'days').value, '90 days')
  assert.equal(formatDuration(24 * 60 * 60 * 1000, 'days').value, '1 day')
  assert.equal(formatDuration(3 * 60 * 60 * 1000, 'hours').value, '3 hours')
})

test('formatDuration: auto-picks a unit', () => {
  assert.equal(formatDuration(10 * 24 * 60 * 60 * 1000).value, '10 days')
  assert.equal(formatDuration(100 * 24 * 60 * 60 * 1000).value.endsWith('weeks'), true)
  assert.equal(formatDuration(300 * 24 * 60 * 60 * 1000).value.endsWith('months'), true)
})

test('formatDuration: sub-day auto spans resolve to the minute', () => {
  assert.deepEqual(formatDuration(45 * 60 * 1000), { value: '45 minutes', rawValue: '45' })
  assert.deepEqual(formatDuration(60 * 60 * 1000), { value: '1 hour', rawValue: '60' })
  assert.deepEqual(formatDuration((9 * 60 + 45) * 60 * 1000), {
    value: '9 hours 45 minutes',
    rawValue: '585',
  })
  // an explicit unit still wins — no sub-day breakdown
  assert.equal(formatDuration(90 * 60 * 1000, 'hours').value, '2 hours')
})

test('normalizeDurationUnit', () => {
  assert.equal(normalizeDurationUnit('day'), 'days')
  assert.equal(normalizeDurationUnit('days'), 'days')
  assert.equal(normalizeDurationUnit('week'), 'weeks')
  assert.equal(normalizeDurationUnit('months'), 'months')
  assert.equal(normalizeDurationUnit('hour'), 'hours')
})
