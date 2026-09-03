import assert from 'node:assert/strict'
import { test } from 'node:test'

import { math } from './index.ts'

/**
 * The math evaluator in isolation. Input here is already framed by the shared
 * `calculator/normalize.ts` (no "what is …", no trailing "="); those cases live
 * in `calculator/index.test.ts`.
 */
const { evaluate } = math

// --- resolves ------------------------------------------------------------

const valueCases: ReadonlyArray<{ input: string; value: string; expression?: string }> = [
  { input: '1 + 2', value: '3' },
  { input: '2*3+4', value: '10' },
  { input: '(3 + 4) * 2', value: '14' },
  { input: '10 / 4', value: '2.5' },
  { input: '2 ^ 10', value: '1,024' },
  { input: '2 ^ 3 ^ 2', value: '512' },
  { input: '-5 + 8', value: '3' },
  { input: '10 % 3', value: '1' },
  { input: '0.1 + 0.2', value: '0.3' },
  { input: '1000000 * 2', value: '2,000,000' },
  { input: '3!', value: '6' },
  { input: 'sqrt(144)', value: '12' },
  { input: 'sin(30 deg)', value: '0.5' },
  { input: 'log(1000, 10)', value: '3' },
  { input: '2 * pi', value: '6.28318530718' },

  // spoken / symbol forms (math normalize handles these)
  { input: '5 plus 3', value: '8', expression: '5 + 3' },
  { input: '100 divided by 4', value: '25', expression: '100 / 4' },
  { input: '2 to the power of 8', value: '256', expression: '2 ^ 8' },
  { input: '17 mod 5', value: '2', expression: '17 % 5' },
  { input: '3 x 4', value: '12', expression: '3 * 4' },
  { input: '12 × 3', value: '36', expression: '12 * 3' },
  { input: '100 ÷ 4', value: '25', expression: '100 / 4' },
]

for (const { input, value, expression } of valueCases) {
  test(`math.evaluate(${JSON.stringify(input)}) -> ${value}`, () => {
    const calc = evaluate(input)
    assert.ok(calc, `expected ${JSON.stringify(input)} to resolve`)
    assert.equal(calc.value, value)
    assert.equal(calc.expression, expression ?? input)
  })
}

// --- unit-aware --------------------------------------------------------

for (const { input, value } of [
  { input: '128 GB to MB', value: '128000 MB' },
  { input: '20 degC to degF', value: '68 degF' },
  { input: '10 cm in mm', value: '100 mm' },
  { input: '1 kg + 2 g', value: '1.002 kg' },
]) {
  test(`math.evaluate(${JSON.stringify(input)}) -> ${value}`, () => {
    assert.equal(evaluate(input)?.value, value)
  })
}

// --- output shape ----------------------------------------------------

test('carries rawValue and highlight tokens', () => {
  const calc = evaluate('2 ^ 10')
  assert.equal(calc?.rawValue, '1024')
  assert.ok(calc?.tokens)
  assert.equal(calc.tokens.map((t) => t.text).join(''), '2 ^ 10')
})

// --- rejects (returns null, next evaluator / action search gets it) --

for (const input of [
  '',
  'chrome',
  'sin',
  'pi',
  'in',
  'true',
  '7zip',
  '42',
  '1.5',
  '-5',
  '2 pi',
  '2 pi extra',
  '(1 + 2',
  '1 +',
  '1 / 0',
  'notepad++',
  'sunny plus warm',
]) {
  test(`math.evaluate(${JSON.stringify(input)}) -> null`, () => {
    assert.equal(evaluate(input), null)
  })
}

test('meta-functions are not reachable', () => {
  assert.equal(evaluate('import("fs")'), null)
  assert.equal(evaluate('createUnit("foo")'), null)
})
