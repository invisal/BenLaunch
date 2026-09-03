import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, test } from 'node:test'

import { QuickValueRunner } from './runner.ts'
import type { UserCodeResult } from './run-user-code.ts'
import type { QuickValueUpdate } from '../../../shared/types.ts'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'quickvalue-runner-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function makeRunner(
  runCode: (code: string, timeoutMs: number) => Promise<UserCodeResult>,
  now: () => number = () => 1000
) {
  const updates: QuickValueUpdate[] = []
  const runner = new QuickValueRunner({
    dir,
    now,
    runCode,
    onUpdate: (u) => updates.push(u)
  })
  return { runner, updates }
}

test('run() caches the value and emits loading then ready updates', async () => {
  const { runner, updates } = makeRunner(async () => ({ ok: true, value: 7 }))

  await runner.run('q', 'code')

  assert.equal(runner.getSubtitle('q'), '7')
  assert.equal(runner.isLoading('q'), false)
  assert.deepEqual(
    updates.map((u) => u.isLoading),
    [true, false]
  )
})

test('a failed run keeps the last known value but reports not-loading', async () => {
  let result: UserCodeResult = { ok: true, value: 100 }
  const { runner } = makeRunner(async () => result)

  await runner.run('q', 'code')
  assert.equal(runner.getSubtitle('q'), '100')

  result = { ok: false, error: 'network down' }
  await runner.run('q', 'code')
  assert.equal(runner.getSubtitle('q'), '100') // stale value retained
})

test('refreshIfStale skips a fresh value and re-runs a stale one', async () => {
  let calls = 0
  let clock = 1000
  const { runner } = makeRunner(
    async () => {
      calls += 1
      return { ok: true, value: calls }
    },
    () => clock
  )

  await runner.run('q', 'code')
  assert.equal(calls, 1)

  runner.refreshIfStale('q', 'code', 60_000)
  assert.equal(calls, 1) // still fresh

  clock += 61_000
  runner.refreshIfStale('q', 'code', 60_000)
  await runner.run('q', 'code') // await the in-flight run
  assert.equal(calls, 2)
})

test('run() is single-flight per id', async () => {
  let calls = 0
  const { runner } = makeRunner(async () => {
    calls += 1
    await new Promise((r) => setTimeout(r, 20))
    return { ok: true, value: calls }
  })

  await Promise.all([runner.run('q', 'c'), runner.run('q', 'c'), runner.run('q', 'c')])
  assert.equal(calls, 1)
})

test('cached values survive across instances and prune() drops the rest', async () => {
  const { runner } = makeRunner(async () => ({ ok: true, value: 'x' }))
  await runner.run('keep', 'c')
  await runner.run('drop', 'c')

  const reloaded = new QuickValueRunner({ dir, onUpdate: () => {}, runCode: async () => ({ ok: true, value: 0 }) })
  assert.equal(reloaded.getSubtitle('keep'), 'x')
  assert.equal(reloaded.getSubtitle('drop'), 'x')

  reloaded.prune(['keep'])
  assert.equal(reloaded.getSubtitle('drop'), '')
  assert.equal(reloaded.getSubtitle('keep'), 'x')
})
