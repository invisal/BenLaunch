import assert from 'node:assert/strict'
import { test } from 'node:test'

import { normalize } from './normalize.ts'

const cases: ReadonlyArray<{ raw: string; expected: string }> = [
  // Whitespace.
  { raw: '1 + 2', expected: '1 + 2' },
  { raw: '  7 - 9  ', expected: '7 - 9' },
  { raw: 'a   b\t c', expected: 'a b c' },

  // Question lead-ins.
  { raw: 'what is 7 * 6', expected: '7 * 6' },
  { raw: "what's 7 * 6", expected: '7 * 6' },
  { raw: 'whats 7 * 6', expected: '7 * 6' },
  { raw: 'calculate 7 * 6', expected: '7 * 6' },
  { raw: 'compute 7 * 6', expected: '7 * 6' },
  { raw: 'convert 10 usd to eur', expected: '10 usd to eur' },
  { raw: 'What Is the time in tokyo', expected: 'the time in tokyo' },

  // Trailing punctuation.
  { raw: '5 + 3 =', expected: '5 + 3' },
  { raw: '5 + 3 equals', expected: '5 + 3' },
  { raw: '5 + 3?', expected: '5 + 3' },
  { raw: '5 + 3 = ?', expected: '5 + 3' },
  { raw: 'time in tokyo?', expected: 'time in tokyo' },

  // A mid-string "=" is left alone (only trailing is framing).
  { raw: '5 = 3', expected: '5 = 3' },

  // Untouched.
  { raw: 'chrome', expected: 'chrome' },
  { raw: 'notepad++', expected: 'notepad++' },
]

for (const { raw, expected } of cases) {
  test(`normalize(${JSON.stringify(raw)}) -> ${JSON.stringify(expected)}`, () => {
    assert.equal(normalize(raw), expected)
  })
}
