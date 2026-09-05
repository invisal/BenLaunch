import assert from 'node:assert/strict'
import { test } from 'node:test'

import { resolvePlace } from './places.ts'

test('resolves by exact name (case-insensitive)', () => {
  assert.equal(resolvePlace('Tokyo')?.timezone, 'Asia/Tokyo')
  assert.equal(resolvePlace('tokyo')?.timezone, 'Asia/Tokyo')
  assert.equal(resolvePlace('TOKYO')?.timezone, 'Asia/Tokyo')
})

test('resolves by alias/abbreviation', () => {
  assert.equal(resolvePlace('sf')?.timezone, 'America/Los_Angeles')
  assert.equal(resolvePlace('nyc')?.timezone, 'America/New_York')
  assert.equal(resolvePlace('ldn')?.timezone, 'Europe/London')
  assert.equal(resolvePlace('jfk')?.timezone, 'America/New_York')
  assert.equal(resolvePlace('blr')?.timezone, 'Asia/Kolkata')
})

test('resolves multi-word city names', () => {
  assert.equal(resolvePlace('new york')?.timezone, 'America/New_York')
  assert.equal(resolvePlace('los angeles')?.timezone, 'America/Los_Angeles')
  assert.equal(resolvePlace('hong kong')?.timezone, 'Asia/Hong_Kong')
})

test('is accent-insensitive', () => {
  assert.equal(resolvePlace('São Paulo')?.timezone, 'America/Sao_Paulo')
  assert.equal(resolvePlace('sao paulo')?.timezone, 'America/Sao_Paulo')
  assert.equal(resolvePlace('SÃO PAULO')?.timezone, 'America/Sao_Paulo')
})

test('fuzzy fallback catches a partial/under-typed name', () => {
  // fuzzyMatch is subsequence-based (search-as-you-type tolerance, not full
  // spell-correction) — "tok" is a subsequence of both "tokyo" and
  // "stockholm", but Tokyo's consecutive-prefix match scores far higher.
  assert.equal(resolvePlace('tok')?.timezone, 'Asia/Tokyo')
})

test('fuzzy:false disables the fallback, requiring an exact/alias match', () => {
  assert.equal(resolvePlace('tok', { fuzzy: false }), null)
  assert.equal(resolvePlace('tokyo', { fuzzy: false })?.timezone, 'Asia/Tokyo')
})

for (const input of ['', 'x', 'chrome', 'photoshop', '12345']) {
  test(`resolvePlace(${JSON.stringify(input)}) -> null`, () => {
    assert.equal(resolvePlace(input), null)
  })
}
