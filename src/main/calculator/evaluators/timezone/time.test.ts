import assert from 'node:assert/strict'
import { test } from 'node:test'

import { parseTimeOfDay } from './time.ts'

const cases: ReadonlyArray<{ input: string; expected: { hour: number; minute: number } | null }> = [
  { input: '5pm', expected: { hour: 17, minute: 0 } },
  { input: '5PM', expected: { hour: 17, minute: 0 } },
  { input: '5am', expected: { hour: 5, minute: 0 } },
  { input: '12pm', expected: { hour: 12, minute: 0 } },
  { input: '12am', expected: { hour: 0, minute: 0 } },
  { input: '9:30am', expected: { hour: 9, minute: 30 } },
  { input: '9:30pm', expected: { hour: 21, minute: 30 } },
  { input: '17:00', expected: { hour: 17, minute: 0 } },
  { input: '0:00', expected: { hour: 0, minute: 0 } },
  { input: 'noon', expected: { hour: 12, minute: 0 } },
  { input: 'midnight', expected: { hour: 0, minute: 0 } },
  { input: '  5pm  ', expected: { hour: 17, minute: 0 } },
  // Invalid.
  { input: '13pm', expected: null },
  { input: '0pm', expected: null },
  { input: '25:00', expected: null },
  { input: '5:70', expected: null },
  { input: 'chrome', expected: null },
  { input: '', expected: null },
]

for (const { input, expected } of cases) {
  test(`parseTimeOfDay(${JSON.stringify(input)}) -> ${JSON.stringify(expected)}`, () => {
    assert.deepEqual(parseTimeOfDay(input), expected)
  })
}
