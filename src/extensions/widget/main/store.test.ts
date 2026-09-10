import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, test } from 'node:test'

import { ExtensionStorage } from '../../../core/storage.ts'
import { WidgetStore } from './store.ts'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'widget-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

const file = (): string => join(dir, 'widget.json')
const makeStore = (): WidgetStore => new WidgetStore(new ExtensionStorage(file(), 'ext:widget'))

test('save() creates a slug id from the name and returns the stored def', () => {
  const store = makeStore()
  const saved = store.save({ name: 'Node Stars!', code: 'x', exposed: true })

  assert.equal(saved.id, 'node-stars')
  assert.equal(saved.name, 'Node Stars!')
  assert.equal(saved.exposed, true)
  assert.deepEqual(store.list(), [saved])
})

test('a second Widget with a colliding name gets a numbered id', () => {
  const store = makeStore()
  const a = store.save({ name: 'Price', code: '', exposed: false })
  const b = store.save({ name: 'Price', code: '', exposed: false })

  assert.equal(a.id, 'price')
  assert.equal(b.id, 'price-2')
})

test('save() keeps a trimmed description and drops a blank one', () => {
  const store = makeStore()
  const withDesc = store.save({
    name: 'Stars',
    description: '  repo stars  ',
    code: '',
    exposed: false,
  })
  assert.equal(withDesc.description, 'repo stars')

  const cleared = store.save({ id: withDesc.id, name: 'Stars', description: '   ', code: '', exposed: false })
  assert.equal(cleared.description, undefined)
})

test('save() with an existing id updates in place', () => {
  const store = makeStore()
  const created = store.save({ name: 'Weather', code: 'old', exposed: false })
  const updated = store.save({ id: created.id, name: 'Weather Now', code: 'new', exposed: true })

  assert.equal(updated.id, created.id)
  assert.equal(store.list().length, 1)
  assert.equal(store.get(created.id)?.code, 'new')
  assert.equal(store.get(created.id)?.exposed, true)
})

test('setExposed and remove persist', () => {
  const store = makeStore()
  const widget = store.save({ name: 'Q', code: '', exposed: false })

  store.setExposed(widget.id, true)
  assert.equal(makeStore().get(widget.id)?.exposed, true)

  store.remove(widget.id)
  assert.deepEqual(makeStore().list(), [])
})

test('a second instance on the same file sees the first instance writes', () => {
  const first = makeStore()
  first.save({ name: 'Shared', code: 's', exposed: true })

  const second = makeStore()
  assert.equal(second.list()[0]?.name, 'Shared')
})

test('missing, corrupt, and malformed storage all yield an empty list', () => {
  assert.deepEqual(makeStore().list(), [])

  writeFileSync(file(), '{ not json')
  assert.deepEqual(makeStore().list(), [])

  // Right wrapper, wrong `widgets` shape → the store's own guard rejects it.
  writeFileSync(file(), JSON.stringify({ version: 1, savedAt: 0, data: { widgets: 'nope' } }))
  assert.deepEqual(makeStore().list(), [])

  // Stale wrapper version → ExtensionStorage discards the whole document.
  writeFileSync(file(), JSON.stringify({ version: 999, savedAt: 0, data: { widgets: [] } }))
  assert.deepEqual(makeStore().list(), [])
})
