import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, test } from 'node:test'

import { CustomLayoutStore } from './custom-store.ts'

let dir: string

const DRAFT = {
  name: 'Left Two Fifths',
  position: 'top-left' as const,
  widthPercent: 40,
  heightPercent: 100,
  offsetXPercent: 0,
  offsetYPoints: 0,
  useGap: true
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'custom-layout-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

test('save() creates a slug id from the name and returns the stored def', () => {
  const store = new CustomLayoutStore({ dir })
  const saved = store.save(DRAFT)

  assert.equal(saved.id, 'left-two-fifths')
  assert.equal(saved.name, DRAFT.name)
  assert.equal(saved.widthPercent, 40)
  assert.deepEqual(store.list(), [saved])
})

test('a second layout with a colliding name gets a numbered id', () => {
  const store = new CustomLayoutStore({ dir })
  const a = store.save({ ...DRAFT, name: 'Sidebar' })
  const b = store.save({ ...DRAFT, name: 'Sidebar' })

  assert.equal(a.id, 'sidebar')
  assert.equal(b.id, 'sidebar-2')
})

test('save() with an existing id updates in place', () => {
  const store = new CustomLayoutStore({ dir })
  const created = store.save(DRAFT)
  const updated = store.save({ ...DRAFT, id: created.id, name: 'Renamed', widthPercent: 60 })

  assert.equal(updated.id, created.id)
  assert.equal(store.list().length, 1)
  assert.equal(store.get(created.id)?.name, 'Renamed')
  assert.equal(store.get(created.id)?.widthPercent, 60)
})

test('save() preserves a null (Auto) width/height', () => {
  const store = new CustomLayoutStore({ dir })
  const saved = store.save({ ...DRAFT, widthPercent: null, heightPercent: null })
  assert.equal(saved.widthPercent, null)
  assert.equal(saved.heightPercent, null)
  assert.equal(store.get(saved.id)?.widthPercent, null)
})

test('remove() persists', () => {
  const store = new CustomLayoutStore({ dir })
  const saved = store.save(DRAFT)

  store.remove(saved.id)
  assert.deepEqual(new CustomLayoutStore({ dir }).list(), [])
})

test('a second instance on the same dir sees the first instance writes', () => {
  const first = new CustomLayoutStore({ dir })
  first.save({ ...DRAFT, name: 'Shared' })

  const second = new CustomLayoutStore({ dir })
  assert.equal(second.list()[0]?.name, 'Shared')
})

test('missing, corrupt, and wrong-version files all yield an empty list', () => {
  assert.deepEqual(new CustomLayoutStore({ dir }).list(), [])

  writeFileSync(join(dir, 'custom-layouts.json'), '{ not json')
  assert.deepEqual(new CustomLayoutStore({ dir }).list(), [])

  writeFileSync(
    join(dir, 'custom-layouts.json'),
    JSON.stringify({ version: 999, savedAt: 0, items: [] })
  )
  assert.deepEqual(new CustomLayoutStore({ dir }).list(), [])
})
