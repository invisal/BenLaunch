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
  { input: 'square root of 625', value: '25', expression: 'sqrt(625)' },
  { input: '√625', value: '25', expression: 'sqrt(625)' },
  { input: 'cube root of 27', value: '3', expression: 'cbrt(27)' },
  { input: 'factorial of 5', value: '120', expression: 'factorial(5)' },
  { input: '5 squared', value: '25', expression: '(5)^2' },
  { input: '2 cubed', value: '8', expression: '(2)^3' },
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
  // Bare temperature letters.
  { input: '23C to F', value: '73.4 degF' },
  { input: '0F to C', value: '-17.777778 degC' },
  // Word/abbreviation aliases.
  { input: '180 pounds to kg', value: '81.646627 kg' },
  { input: '2 tbsp in ml', value: '30 ml' },
  { input: '100 kmh in mph', value: '62.137119 mi / h' },
]) {
  test(`math.evaluate(${JSON.stringify(input)}) -> ${value}`, () => {
    assert.equal(evaluate(input)?.value, value)
  })
}

// "5 in ft" — `in` rewritten to the conversion connector, but a bare `5` has
// no source unit to convert *from*, so this correctly fails rather than
// silently reinterpreting it as "5 inches * ft" (an ft² area, which is what
// happened before this fix).
test('math.evaluate("5 in ft") -> null (no source unit to convert)', () => {
  assert.equal(evaluate('5 in ft'), null)
})

test('math.evaluate("5 m in ft") -> unaffected by the in-fix', () => {
  assert.equal(evaluate('5 m in ft')?.value, '16.404199 ft')
})

// --- percentages ---------------------------------------------------------

for (const { input, value } of [
  { input: '32% of 5', value: '1.6' },
  { input: '20% of 1499', value: '299.8' },
  { input: '850 + 8.25%', value: '920.125' },
  { input: '250 - 10%', value: '225' },
  { input: '47%', value: '0.47' },
]) {
  test(`math.evaluate(${JSON.stringify(input)}) -> ${value}`, () => {
    assert.equal(evaluate(input)?.value, value)
  })
}

for (const { input, value } of [
  { input: 'what percent is 32 of 200', value: '16%' },
  { input: 'what percentage of 4 is 1', value: '25%' },
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
  'in 3 hours', // leading "in" + number ⇒ datetime, not `3 in hours`
  'in 45 minutes',
  '2026-12-25', // a bare ISO date is a date (→ datetime), not `2026 - 12 - 25`
]) {
  test(`math.evaluate(${JSON.stringify(input)}) -> null`, () => {
    assert.equal(evaluate(input), null)
  })
}

test('meta-functions are not reachable', () => {
  assert.equal(evaluate('import("fs")'), null)
  assert.equal(evaluate('createUnit("foo")'), null)
})
