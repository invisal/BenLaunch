import assert from 'node:assert/strict'
import { test } from 'node:test'

import { firstDayOfPeriod, lastDayOfPeriod, shiftPeriod } from './period.ts'

const REF = new Date(2026, 8, 5) // Sat 5 Sep 2026 — Q3, week of Aug 31 - Sep 6

test('month boundaries', () => {
  assert.equal(firstDayOfPeriod('month', REF).getDate(), 1)
  assert.equal(firstDayOfPeriod('month', REF).getMonth(), 8)
  const last = lastDayOfPeriod('month', REF)
  assert.equal(last.getMonth(), 8)
  assert.equal(last.getDate(), 30)
})

test('year boundaries', () => {
  const first = firstDayOfPeriod('year', REF)
  assert.equal(first.getMonth(), 0)
  assert.equal(first.getDate(), 1)
  const last = lastDayOfPeriod('year', REF)
  assert.equal(last.getMonth(), 11)
  assert.equal(last.getDate(), 31)
})

test('quarter boundaries (Q3 = Jul-Sep)', () => {
  const first = firstDayOfPeriod('quarter', REF)
  assert.equal(first.getMonth(), 6) // July
  assert.equal(first.getDate(), 1)
  const last = lastDayOfPeriod('quarter', REF)
  assert.equal(last.getMonth(), 8) // September
  assert.equal(last.getDate(), 30)
})

test('week boundaries (Monday start)', () => {
  const first = firstDayOfPeriod('week', REF)
  assert.equal(first.getDay(), 1) // Monday
  assert.equal(first.getMonth(), 7) // August
  assert.equal(first.getDate(), 31)
  const last = lastDayOfPeriod('week', REF)
  assert.equal(last.getDay(), 0) // Sunday
  assert.equal(last.getMonth(), 8)
  assert.equal(last.getDate(), 6)
})

test('shiftPeriod moves by whole periods', () => {
  assert.equal(shiftPeriod('month', REF, 1).getMonth(), 9) // October
  assert.equal(shiftPeriod('month', REF, -1).getMonth(), 7) // August
  assert.equal(shiftPeriod('year', REF, 1).getFullYear(), 2027)
  assert.equal(shiftPeriod('quarter', REF, 1).getMonth(), 11) // December (Q4)
})
