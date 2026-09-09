import assert from 'node:assert/strict'
import { test } from 'node:test'

import { normalizeMath } from './normalize.ts'

const cases: ReadonlyArray<{ raw: string; expected: string }> = [
  // Passthrough.
  { raw: '1 + 2', expected: '1 + 2' },
  { raw: '2*3+4', expected: '2*3+4' },

  // Spoken operators.
  { raw: '5 plus 3', expected: '5 + 3' },
  { raw: '10 minus 4', expected: '10 - 4' },
  { raw: '6 times 7', expected: '6 * 7' },
  { raw: '8 multiplied by 9', expected: '8 * 9' },
  { raw: '100 divided by 4', expected: '100 / 4' },
  { raw: '17 mod 5', expected: '17 % 5' },
  { raw: '17 modulo 5', expected: '17 % 5' },
  { raw: '2 to the power of 8', expected: '2 ^ 8' },
  { raw: '2 power 8', expected: '2 ^ 8' },
  { raw: '5 PLUS 3', expected: '5 + 3' },
  { raw: '1 plus 2 plus 3', expected: '1 + 2 + 3' },

  // "x" as multiply, only between numbers.
  { raw: '3 x 4', expected: '3 * 4' },
  { raw: '3x4', expected: '3 * 4' },
  { raw: 'max(2, 3)', expected: 'max(2, 3)' },

  // Unicode symbols.
  { raw: '12 × 3', expected: '12 * 3' },
  { raw: '100 ÷ 4', expected: '100 / 4' },
  { raw: '8 − 5', expected: '8 - 5' }, // U+2212
  { raw: '2π', expected: '2 pi' },

  // Spoken function forms → mathjs syntax.
  { raw: 'square root of 625', expected: 'sqrt(625)' },
  { raw: 'sqrt of 16', expected: 'sqrt(16)' },
  { raw: 'the square root of 2', expected: 'sqrt(2)' },
  { raw: 'square root of 1,000', expected: 'sqrt(1000)' },
  { raw: '√625', expected: 'sqrt(625)' },
  { raw: '√(16 + 9)', expected: 'sqrt(16 + 9)' },
  { raw: 'cube root of 27', expected: 'cbrt(27)' },
  { raw: 'factorial of 5', expected: 'factorial(5)' },
  { raw: 'square root of 16 plus 9', expected: 'sqrt(16) + 9' },
  { raw: 'sqrt(625)', expected: 'sqrt(625)' }, // already valid — untouched

  // Postfix "squared" / "cubed".
  { raw: '5 squared', expected: '(5)^2' },
  { raw: '2 cubed', expected: '(2)^3' },
  { raw: '5 square', expected: '(5)^2' }, // trailing "d" optional
  { raw: '2 cube', expected: '(2)^3' },
  { raw: '5 square feet', expected: '5 square feet' }, // unit phrase — left alone
  { raw: '(2 + 3) squared', expected: '(2 + 3)^2' },
  { raw: 'pi squared', expected: '(pi)^2' },
  { raw: '5 squared plus 1', expected: '(5)^2 + 1' },

  // Non-math text passes through (the gate rejects it later).
  { raw: 'sunny plus warm', expected: 'sunny + warm' },
  { raw: 'notepad++', expected: 'notepad++' },
  { raw: '3!', expected: '3!' },
]

for (const { raw, expected } of cases) {
  test(`normalizeMath(${JSON.stringify(raw)}) -> ${JSON.stringify(expected)}`, () => {
    assert.equal(normalizeMath(raw), expected)
  })
}
