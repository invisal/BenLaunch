import assert from 'node:assert/strict'
import { test } from 'node:test'

import { formatResult } from './format.ts'
import { tryEvaluate } from './evaluate.ts'

/** Helper: evaluate then format, asserting the expression resolved. */
function fmt(expression: string) {
  const result = tryEvaluate(expression)
  assert.ok(result, `expected ${JSON.stringify(expression)} to evaluate`)
  return formatResult(result)
}

const numberCases: ReadonlyArray<{ expr: string; value: string; rawValue: string }> = [
  { expr: '1 + 2', value: '3', rawValue: '3' },
  { expr: '10 / 4', value: '2.5', rawValue: '2.5' },
  { expr: '0.1 + 0.2', value: '0.3', rawValue: '0.3' }, // float noise trimmed
  { expr: '2 ^ 10', value: '1,024', rawValue: '1024' }, // grouped display, plain raw
  { expr: '1000000 * 2', value: '2,000,000', rawValue: '2000000' },
  { expr: '7 - 9', value: '-2', rawValue: '-2' },
  { expr: '2 * pi', value: '6.28318530718', rawValue: '6.28318530718' },
]

for (const { expr, value, rawValue } of numberCases) {
  test(`formatResult(${JSON.stringify(expr)}) -> ${value} / ${rawValue}`, () => {
    const f = fmt(expr)
    assert.equal(f.value, value)
    assert.equal(f.rawValue, rawValue)
  })
}

const unitCases: ReadonlyArray<{ expr: string; value: string }> = [
  { expr: '128 GB to MB', value: '128000 MB' },
  { expr: '20 degC to degF', value: '68 degF' },
  { expr: '10 cm in mm', value: '100 mm' },
]

for (const { expr, value } of unitCases) {
  test(`formatResult(${JSON.stringify(expr)}) -> ${value}`, () => {
    const f = fmt(expr)
    assert.equal(f.value, value)
    assert.equal(f.rawValue, value) // units keep the same string for raw + display
  })
}
