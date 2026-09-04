import assert from 'node:assert/strict'
import { test } from 'node:test'

import { runUserCode } from './run-user-code.ts'

test('returns the value from a module.exports async function', async () => {
  const result = await runUserCode('module.exports = async () => ({ value: 42 })')
  assert.deepEqual(result, { ok: true, value: 42 })
})

test('strips TypeScript type annotations before running', async () => {
  const result = await runUserCode(
    'module.exports = async (): Promise<{ value: number }> => {\n' +
      '  const n: number = 21\n' +
      '  return { value: n * 2 } satisfies { value: number }\n' +
      '}'
  )
  assert.deepEqual(result, { ok: true, value: 42 })
})

test('reports a TypeScript syntax error', async () => {
  const result = await runUserCode('module.exports = () => ({ value: :: })')
  assert.equal(result.ok, false)
})

test('supports a default export and string values', async () => {
  const result = await runUserCode('exports.default = () => ({ value: "hi" })')
  assert.deepEqual(result, { ok: true, value: 'hi' })
})

test('null is a valid value', async () => {
  const result = await runUserCode('module.exports = () => ({ value: null })')
  assert.deepEqual(result, { ok: true, value: null })
})

test('rejects a non-function export', async () => {
  const result = await runUserCode('module.exports = 5')
  assert.equal(result.ok, false)
})

test('rejects a return that is not { value }', async () => {
  const result = await runUserCode('module.exports = () => 5')
  assert.equal(result.ok, false)
})

test('rejects a value of the wrong type', async () => {
  const result = await runUserCode('module.exports = () => ({ value: { nested: true } })')
  assert.equal(result.ok, false)
})

test('surfaces a thrown error message', async () => {
  const result = await runUserCode('module.exports = () => { throw new Error("boom") }')
  assert.deepEqual(result, { ok: false, error: 'boom' })
})

test('times out a slow function', async () => {
  const result = await runUserCode(
    'module.exports = () => new Promise((r) => setTimeout(() => r({ value: 1 }), 200))',
    30
  )
  assert.equal(result.ok, false)
  assert.match((result as { error: string }).error, /timed out/)
})
