import assert from 'node:assert/strict'
import { test } from 'node:test'

import { evaluate } from './index.ts'

/**
 * The whole pipeline: raw query in, `Calculation` (or `null`) out. Exercises
 * shared `normalize` + the evaluator chain (`math`, `currency`) end-to-end.
 * Per-evaluator behaviour is covered in `evaluators/<name>/`.
 */

const resolves: ReadonlyArray<{ query: string; value: string; expression: string }> = [
  { query: '1 + 2', value: '3', expression: '1 + 2' },
  { query: '  7 - 9  ', value: '-2', expression: '7 - 9' },
  { query: 'what is 7 * 6', value: '42', expression: '7 * 6' },
  { query: "what's 7 * 6", value: '42', expression: '7 * 6' },
  { query: 'calculate 100 / 4', value: '25', expression: '100 / 4' },
  { query: '9 + 10 =', value: '19', expression: '9 + 10' },
  { query: '5 * 5 equals', value: '25', expression: '5 * 5' },
  { query: '2 + 2?', value: '4', expression: '2 + 2' },
  { query: '5 plus 3', value: '8', expression: '5 + 3' },
  { query: 'what is 6 times 7', value: '42', expression: '6 * 7' },
  { query: '128 GB to MB', value: '128000 MB', expression: '128 GB to MB' },
]

for (const { query, value, expression } of resolves) {
  test(`evaluate(${JSON.stringify(query)}) -> ${value}`, () => {
    const calc = evaluate(query)
    assert.ok(calc, `expected ${JSON.stringify(query)} to resolve`)
    assert.equal(calc.value, value)
    assert.equal(calc.expression, expression)
  })
}

const nullCases: ReadonlyArray<string> = [
  '',
  '   ',
  'chrome',
  'notepad',
  'pi',
  '42',
  '-5',
  '2 pi',
  '(1 + 2',
  '1 / 0',
  'notepad++',
  'sunny plus warm',
  'what is love',
]

for (const query of nullCases) {
  test(`evaluate(${JSON.stringify(query)}) -> null`, () => {
    assert.equal(evaluate(query), null)
  })
}

test('framing is stripped before an evaluator sees the query', () => {
  // "what is …" + trailing "=" gone → math evaluates "7 * 6".
  const calc = evaluate('what is 7 * 6 =')
  assert.equal(calc?.value, '42')
  assert.equal(calc?.expression, '7 * 6')
})

test('a currency query is claimed by currency, not math', () => {
  // Uses the bundled seed rates (no network); assert the shape, not the number.
  const calc = evaluate('10 usd in eur')
  assert.ok(calc)
  assert.match(calc.expression, /^10 USD → EUR/)
  assert.match(calc.value, /^€/)
})
