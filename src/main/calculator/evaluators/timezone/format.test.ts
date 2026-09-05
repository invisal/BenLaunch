import assert from 'node:assert/strict'
import { test } from 'node:test'

import { calendarDate, formatClock, formatWeekday, offsetLabel } from './format.ts'

const NOW = new Date('2026-06-15T12:00:00Z')

test('offsetLabel: whole-hour zones', () => {
  assert.equal(offsetLabel('Asia/Tokyo', NOW), 'GMT+9')
  assert.equal(offsetLabel('America/New_York', NOW), 'GMT-4') // DST in June
  assert.equal(offsetLabel('UTC', NOW), 'GMT+0')
})

test('offsetLabel: half-hour zones', () => {
  assert.equal(offsetLabel('Asia/Kolkata', NOW), 'GMT+5:30')
})

test('formatClock', () => {
  assert.equal(formatClock(NOW, 'Asia/Tokyo'), '21:00')
  assert.equal(formatClock(NOW, 'UTC'), '12:00')
})

test('formatWeekday', () => {
  assert.equal(formatWeekday(NOW, 'Asia/Tokyo'), 'Mon')
})

test('calendarDate', () => {
  assert.equal(calendarDate(NOW, 'Asia/Tokyo'), '2026-06-15')
  assert.equal(calendarDate(NOW, 'America/Los_Angeles'), '2026-06-15')
})
