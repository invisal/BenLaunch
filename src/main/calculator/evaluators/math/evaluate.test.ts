import assert from 'node:assert/strict'
import { test } from 'node:test'

import { tryEvaluate } from './evaluate.ts'

test('tryEvaluate: numeric results', () => {
  const r = tryEvaluate('2 + 3 * 4')
  assert.deepEqual(r, { kind: 'number', value: 14 })
})

test('tryEvaluate: right-associative power', () => {
  assert.deepEqual(tryEvaluate('2 ^ 3 ^ 2'), { kind: 'number', value: 512 })
})

test('tryEvaluate: unit results', () => {
  const r = tryEvaluate('10 cm in mm')
  assert.equal(r?.kind, 'unit')
})

test('tryEvaluate: non-finite is rejected', () => {
  assert.equal(tryEvaluate('1 / 0'), null)
})

test('tryEvaluate: parse errors are swallowed', () => {
  for (const expr of ['(1 + 2', '1 +', 'chrome + 2', '']) {
    assert.equal(tryEvaluate(expr), null, expr)
  }
})

test('tryEvaluate: non-answer result types are rejected', () => {
  for (const expr of ['true', '2 > 1', '[1, 2, 3]']) {
    assert.equal(tryEvaluate(expr), null, expr)
  }
})

test('tryEvaluate: meta-functions are not reachable', () => {
  assert.equal(tryEvaluate('import("fs")'), null)
  assert.equal(tryEvaluate('createUnit("foo")'), null)
})
