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

test('resolves a country name to its (single-zone) city', () => {
  const calc = resolveClock('time in germany', NOW, UTC)
  assert.ok(calc)
  assert.equal(calc.value, '14:00 · GMT+2')
  // Canonicalized to the resolved city, same as an alias like "ldn" → "London".
  assert.equal(calc.expression, 'time in Berlin')
})

test('a multi-zone country lists every zone it currently spans, not just the capital', () => {
  const calc = resolveClock('time in united states', NOW, UTC)
  assert.ok(calc)
  assert.equal(calc.expression, 'time in United States of America')
  assert.equal(
    calc.value,
    'Honolulu 02:00 · GMT-10  ·  Adak 03:00 · GMT-9  ·  Anchorage 04:00 · GMT-8  ·  Los Angeles 05:00 · GMT-7  ·  Denver 06:00 · GMT-6  ·  Chicago 07:00 · GMT-5  ·  New York 08:00 · GMT-4',
  )
  // rawValue stays pasteable — comma-separated between cities (vs. value's
  // double-space-bullet), though each city's own "HH:MM · GMT±N" is unchanged.
  assert.equal(
    calc.rawValue,
    'Honolulu 02:00 · GMT-10, Adak 03:00 · GMT-9, Anchorage 04:00 · GMT-8, Los Angeles 05:00 · GMT-7, Denver 06:00 · GMT-6, Chicago 07:00 · GMT-5, New York 08:00 · GMT-4',
  )
})

test('a multi-zone country also carries `items` — what the panel actually renders as chips', () => {
  // Each item's value is "HH:MM · GMT±N" — CalculatorPanel splits on " · " to
  // style the offset as secondary to the time; see ResultItems.
  const calc = resolveClock('time in united states', NOW, UTC)
  assert.deepEqual(calc?.items, [
    { label: 'Honolulu', value: '02:00 · GMT-10' },
    { label: 'Adak', value: '03:00 · GMT-9' },
    { label: 'Anchorage', value: '04:00 · GMT-8' },
    { label: 'Los Angeles', value: '05:00 · GMT-7' },
    { label: 'Denver', value: '06:00 · GMT-6' },
    { label: 'Chicago', value: '07:00 · GMT-5' },
    { label: 'New York', value: '08:00 · GMT-4' },
  ])
})

test('a single-zone lookup carries no `items` — the panel keeps the one-line form', () => {
  assert.equal(resolveClock('time in Tokyo', NOW, UTC)?.items, undefined)
  assert.equal(resolveClock('time in germany', NOW, UTC)?.items, undefined)
})

test('the trailing-"time" shape also lists a multi-zone country', () => {
  assert.equal(resolveClock('united states time', NOW, UTC)?.value, resolveClock('time in united states', NOW, UTC)?.value)
})

test('a country with zero zones of its own stays unresolved', () => {
  assert.equal(resolveClock('time in heard island and mcdonald islands', NOW, UTC), null)
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
