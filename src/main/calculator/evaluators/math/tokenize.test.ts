import assert from 'node:assert/strict'
import { test } from 'node:test'

import { tokenize } from './tokenize.ts'
import type { CalcToken } from '../../../../shared/types.ts'

/** Compact view: "5|+|3" with kinds, for readable assertions. */
function shape(tokens: CalcToken[]): string {
  return tokens
    .filter((t) => t.kind !== 'whitespace')
    .map((t) => `${t.text}:${t.kind}`)
    .join(' ')
}

test('round-trips the exact source text', () => {
  for (const expr of ['5 + 3', '2*3+4', '(3 + 4) * 2', '128 GB to MB', 'sqrt(144)']) {
    assert.equal(tokenize(expr).map((t) => t.text).join(''), expr)
  }
})

test('classifies arithmetic', () => {
  assert.equal(shape(tokenize('5 + 3')), '5:number +:operator 3:number')
  assert.equal(
    shape(tokenize('(3 + 4) * 2')),
    '(:paren 3:number +:operator 4:number ):paren *:operator 2:number',
  )
})

test('classifies functions vs units vs constants', () => {
  assert.equal(shape(tokenize('sqrt(144)')), 'sqrt:function (:paren 144:number ):paren')
  assert.equal(shape(tokenize('2 * pi')), '2:number *:operator pi:constant')
  assert.equal(shape(tokenize('128 GB to MB')), '128:number GB:unit to:operator MB:unit')
  assert.equal(shape(tokenize('10 cm in mm')), '10:number cm:unit in:operator mm:unit')
})

test('keeps whitespace tokens so spacing can be reproduced', () => {
  const tokens = tokenize('5 + 3')
  assert.deepEqual(
    tokens.map((t) => t.kind),
    ['number', 'whitespace', 'operator', 'whitespace', 'number'],
  )
})

test('returns [] for anything it cannot fully lex', () => {
  assert.deepEqual(tokenize('5 & 3'), [])
  assert.deepEqual(tokenize('√16'), [])
  assert.deepEqual(tokenize(''), [])
})

test('decimals and exponents are single number tokens', () => {
  assert.equal(shape(tokenize('3.14 + 1')), '3.14:number +:operator 1:number')
  assert.equal(shape(tokenize('1.5e3 * 2')), '1.5e3:number *:operator 2:number')
})
