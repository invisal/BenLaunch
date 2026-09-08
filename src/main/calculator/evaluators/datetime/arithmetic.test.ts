import assert from 'node:assert/strict'
import { test } from 'node:test'

import { resolveArithmetic } from './arithmetic.ts'

const NOW = new Date(2026, 8, 5, 10, 0, 0) // Sat 5 Sep 2026, 10:00

// --- unit inferred from the left side ----------------------------------

test('bare number after a date ⇒ days', () => {
  assert.equal(resolveArithmetic('August 5 + 5', NOW)?.value, 'Mon, Aug 10')
  assert.equal(resolveArithmetic('August 5 + 5', NOW)?.rawValue, '2026-08-10')
})

test('bare number after a clock time ⇒ hours, and stays a clock time', () => {
  assert.deepEqual({ ...resolveArithmetic('3:45pm + 5', NOW) }, {
    expression: '3:45pm + 5',
    value: '8:45 PM',
    rawValue: '20:45',
  })
})

test('subtraction', () => {
  assert.equal(resolveArithmetic('August 5 - 3', NOW)?.value, 'Sun, Aug 2')
  assert.equal(resolveArithmetic('3:45pm - 2', NOW)?.value, '1:45 PM')
})

test('"plus" / "minus" words', () => {
  assert.equal(resolveArithmetic('August 5 plus 5', NOW)?.value, 'Mon, Aug 10')
  assert.equal(resolveArithmetic('August 5 minus 3', NOW)?.value, 'Sun, Aug 2')
})

// --- explicit units ---------------------------------------------------

test('explicit unit tokens, long and abbreviated', () => {
  assert.equal(resolveArithmetic('2026-01-15 + 3 weeks', NOW)?.value, 'Thu, Feb 5')
  assert.equal(resolveArithmetic('2026-01-15 + 2w', NOW)?.value, 'Thu, Jan 29')
  assert.equal(resolveArithmetic('9:00 + 90 min', NOW)?.value, '10:30 AM')
  assert.equal(resolveArithmetic('9:00 + 8h', NOW)?.value, '5:00 PM')
  assert.equal(resolveArithmetic('today - 10 days', NOW)?.value, 'Wed, Aug 26')
})

test('month/year math is calendar-correct (date-fns)', () => {
  // 31 Jan + 1 month clamps to the last day of February, not "day 31".
  assert.equal(resolveArithmetic('2026-01-31 + 1 month', NOW)?.value, 'Sat, Feb 28')
  assert.equal(resolveArithmetic('2026-01-15 + 1 year', NOW)?.value, 'Fri, Jan 15, 2027')
})

// --- clock-time rollover --------------------------------------------

test('a clock-time result that crosses midnight is flagged', () => {
  assert.equal(resolveArithmetic('11pm + 3h', NOW)?.value, '2:00 AM (next day)')
  assert.equal(resolveArithmetic('1am - 2h', NOW)?.value, '11:00 PM (prev day)')
})

// --- "now" keeps its date --------------------------------------------

test('"now + N" keeps the calendar date (now is a fixed instant, not a bare clock)', () => {
  assert.equal(resolveArithmetic('now + 90 min', NOW)?.value, 'Sat, Sep 5, 11:30 AM')
})

// --- rejects --------------------------------------------------------

for (const input of [
  '5 + 3', // left doesn't parse as a date/time
  '2 + 2',
  'chrome + 1',
  'flight to paris',
  '',
  'August 5', // no operator
  '3:45pm', // ditto
]) {
  test(`resolveArithmetic(${JSON.stringify(input)}) -> null`, () => {
    assert.equal(resolveArithmetic(input, NOW), null)
  })
}
