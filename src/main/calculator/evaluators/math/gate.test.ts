import assert from 'node:assert/strict'
import { test } from 'node:test'

import { isCalculation, looksLikeMath } from './gate.ts'

test('looksLikeMath: a digit or a function call passes', () => {
  for (const expr of ['1 + 2', '42', 'sqrt(2)', 'sin(x)', '2^10']) {
    assert.equal(looksLikeMath(expr), true, expr)
  }
})

test('looksLikeMath: words with no digit or call are rejected', () => {
  for (const expr of ['chrome', 'pi', 'in', 'sin', 'sunny + warm', '']) {
    assert.equal(looksLikeMath(expr), false, expr)
  }
})

test('isCalculation: needs an operator or a call', () => {
  for (const expr of ['1 + 2', '10 % 3', '2 ^ 8', '5!', 'sqrt(144)', '-3 * 2']) {
    assert.equal(isCalculation(expr), true, expr)
  }
})

test('isCalculation: bare literals are not calculations', () => {
  for (const expr of ['42', '1.5', '-5', '2 pi', '1000000']) {
    assert.equal(isCalculation(expr), false, expr)
  }
})
