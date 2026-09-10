import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, test } from 'node:test'

import { ExtensionStorage } from './storage.ts'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'ext-storage-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

const open = (): ExtensionStorage =>
  new ExtensionStorage(join(dir, 'group.json'), 'ext:group')

test('get() returns the fallback for an unset key', () => {
  assert.deepEqual(open().get('groups', []), [])
  assert.equal(open().get('missing'), undefined)
})

test('set() persists and a fresh instance reads it back', () => {
  open().set('groups', [{ id: 'a', name: 'Work' }])

  const reopened = open()
  assert.deepEqual(reopened.get('groups'), [{ id: 'a', name: 'Work' }])
  assert.deepEqual(reopened.keys(), ['groups'])
})

test('delete() removes a key', () => {
  const store = open()
  store.set('groups', [1])
  store.delete('groups')

  assert.equal(store.get('groups'), undefined)
  assert.deepEqual(open().keys(), [])
})

test('a corrupt file is treated as empty', () => {
  const store = open()
  store.set('groups', [1])
  writeFileSync(join(dir, 'group.json'), '{ not json')

  assert.deepEqual(open().get('groups', 'fallback'), 'fallback')
})

test('the persisted file carries a version wrapper', () => {
  open().set('k', 1)
  const parsed = JSON.parse(readFileSync(join(dir, 'group.json'), 'utf8'))
  assert.equal(parsed.version, 1)
  assert.deepEqual(parsed.data, { k: 1 })
})
