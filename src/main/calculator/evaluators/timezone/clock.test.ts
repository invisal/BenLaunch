import assert from 'node:assert/strict'
import { test } from 'node:test'

import { resolveClock } from './clock.ts'

const NOW = new Date('2026-06-15T12:00:00Z')
const UTC = 'UTC' // fixed "viewer's day" baseline — deterministic regardless of the host's own timezone

test('time in <place>', () => {
  const calc = resolveClock('time in Tokyo', NOW, UTC)
  assert.ok(calc)
  assert.equal(calc.value, '21:00 · GMT+9')
  assert.equal(calc.expression, 'time in Tokyo')
})

test('time at <place>', () => {
  assert.equal(resolveClock('time at sf', NOW, UTC)?.value, '05:00 · GMT-7')
})

test('what time is it in <place>', () => {
  assert.equal(resolveClock('what time is it in Berlin', NOW, UTC)?.value, '14:00 · GMT+2')
})

test('what time in <place> (no "is it")', () => {
  assert.equal(resolveClock('what time in Berlin', NOW, UTC)?.value, '14:00 · GMT+2')
})

test('<place> time — exact/alias only', () => {
  assert.equal(resolveClock('Tokyo time', NOW, UTC)?.value, '21:00 · GMT+9')
  // A typo would need fuzzy matching, which this shape deliberately disables.
  assert.equal(resolveClock('Tokyoo time', NOW, UTC), null)
})

test('appends the weekday when the day differs from the local one', () => {
  // NOW is 15 Jun 12:00 UTC, so Tokyo (+9) is still the 15th, but
  // Auckland (+12, no DST in the southern winter) has rolled into the 16th.
  assert.equal(resolveClock('time in Tokyo', NOW, UTC)?.value, '21:00 · GMT+9')
  assert.match(resolveClock('time in Auckland', NOW, UTC)?.value ?? '', /^\d{2}:\d{2} \w{3} · GMT\+12$/)
})

for (const input of ['', 'chrome', 'lunch time', 'party time', 'time in nowhere-at-all']) {
  test(`resolveClock(${JSON.stringify(input)}) -> null`, () => {
    assert.equal(resolveClock(input, NOW, UTC), null)
  })
}
