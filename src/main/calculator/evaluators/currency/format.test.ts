import assert from 'node:assert/strict'
import { test } from 'node:test'

import { formatMoney, updatedLabel } from './format.ts'

const sec = 1000
const min = 60 * sec
const hour = 60 * min
const day = 24 * hour

test('updatedLabel — relative time, coarsening as it ages', () => {
  assert.equal(updatedLabel(0), 'Updated just now')
  assert.equal(updatedLabel(30 * sec), 'Updated just now')
  assert.equal(updatedLabel(1 * min), 'Updated 1 minute ago')
  assert.equal(updatedLabel(4 * min), 'Updated 4 minutes ago')
  assert.equal(updatedLabel(50 * min), 'Updated 1 hour ago')
  assert.equal(updatedLabel(3 * hour), 'Updated 3 hours ago')
  assert.equal(updatedLabel(25 * hour), 'Updated yesterday')
  assert.equal(updatedLabel(3 * day), 'Updated 3 days ago')
  assert.equal(updatedLabel(40 * day), 'Updated 1 month ago')
  assert.equal(updatedLabel(Infinity), 'Rates unavailable')
  assert.equal(updatedLabel(-5), 'Rates unavailable')
})

test('two-decimal currencies', () => {
  const f = formatMoney(7.4213, 'GBP')
  assert.equal(f.value, '£7.42')
  assert.equal(f.rawValue, '7.42')
})

test('zero-decimal currencies (Intl decides)', () => {
  const f = formatMoney(1596.7, 'JPY')
  assert.equal(f.value, '¥1,597')
  assert.equal(f.rawValue, '1597')
})

test('grouping', () => {
  assert.equal(formatMoney(1234567.5, 'USD').value, '$1,234,567.50')
})

test('a malformed code hits the "<n> CODE" fallback', () => {
  const f = formatMoney(12.5, 'US')
  assert.equal(f.value, '12.50 US')
  assert.equal(f.rawValue, '12.50')
})
