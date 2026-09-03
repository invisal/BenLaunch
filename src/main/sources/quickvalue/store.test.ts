import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, test } from 'node:test'

import { QuickValueStore } from './store.ts'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'quickvalue-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

test('save() creates a slug id from the name and returns the stored def', () => {
  const store = new QuickValueStore({ dir })
  const saved = store.save({ name: 'Node Stars!', code: 'x', exposed: true })

  assert.equal(saved.id, 'node-stars')
  assert.equal(saved.name, 'Node Stars!')
  assert.equal(saved.exposed, true)
  assert.deepEqual(store.list(), [saved])
})

test('a second QuickValue with a colliding name gets a numbered id', () => {
  const store = new QuickValueStore({ dir })
  const a = store.save({ name: 'Price', code: '', exposed: false })
  const b = store.save({ name: 'Price', code: '', exposed: false })

  assert.equal(a.id, 'price')
  assert.equal(b.id, 'price-2')
})

test('save() with an existing id updates in place', () => {
  const store = new QuickValueStore({ dir })
  const created = store.save({ name: 'Weather', code: 'old', exposed: false })
  const updated = store.save({ id: created.id, name: 'Weather Now', code: 'new', exposed: true })

  assert.equal(updated.id, created.id)
  assert.equal(store.list().length, 1)
  assert.equal(store.get(created.id)?.code, 'new')
  assert.equal(store.get(created.id)?.exposed, true)
})

test('setExposed and remove persist', () => {
  const store = new QuickValueStore({ dir })
  const qv = store.save({ name: 'Q', code: '', exposed: false })

  store.setExposed(qv.id, true)
  assert.equal(new QuickValueStore({ dir }).get(qv.id)?.exposed, true)

  store.remove(qv.id)
  assert.deepEqual(new QuickValueStore({ dir }).list(), [])
})

test('a second instance on the same dir sees the first instance writes', () => {
  const first = new QuickValueStore({ dir })
  first.save({ name: 'Shared', code: 's', exposed: true })

  const second = new QuickValueStore({ dir })
  assert.equal(second.list()[0]?.name, 'Shared')
})

test('missing, corrupt, and wrong-version files all yield an empty list', () => {
  assert.deepEqual(new QuickValueStore({ dir }).list(), [])

  writeFileSync(join(dir, 'quickvalues.json'), '{ not json')
  assert.deepEqual(new QuickValueStore({ dir }).list(), [])

  writeFileSync(
    join(dir, 'quickvalues.json'),
    JSON.stringify({ version: 999, savedAt: 0, items: [] })
  )
  assert.deepEqual(new QuickValueStore({ dir }).list(), [])
})
