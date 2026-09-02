import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, test } from 'node:test'

import { normalizeTags, slugify, validateDraft } from '../../../shared/quicklink.ts'
import {
  DEFAULT_QUICKLINKS,
  QuicklinkStore,
  expandDynamic,
  hasPlaceholder,
  isWebTarget,
  monogramIcon,
  normalizeLink,
  parseArgument,
  prettyLink,
  resolveLink,
  sanitize
} from './quicklinks.ts'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'quicklinks-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

test('hasPlaceholder recognizes {query}, {argument}, {arg}, {} and {argument name="…"}', () => {
  assert.equal(hasPlaceholder('https://x.com/s?q={query}'), true)
  assert.equal(hasPlaceholder('https://x.com/s?q={ argument }'), true)
  assert.equal(hasPlaceholder('https://x.com/s?q={arg}'), true)
  assert.equal(hasPlaceholder('https://x.com/s?q={}'), true)
  assert.equal(hasPlaceholder('https://x.com/s?q={argument name="query"}'), true)
  assert.equal(hasPlaceholder('https://x.com'), false)
  assert.equal(hasPlaceholder('https://x.com/s?c={clipboard}'), false)
})

test('expandDynamic fills clipboard, uuid, date and time', () => {
  const now = new Date('2026-09-02T14:07:00.000Z')
  assert.equal(
    expandDynamic('https://x.com/s?c={clipboard}', { clipboard: 'a b' }),
    'https://x.com/s?c=a%20b'
  )
  assert.equal(
    expandDynamic('https://x.com/{uuid}', { uuid: () => 'fixed-id' }),
    'https://x.com/fixed-id'
  )
  assert.equal(expandDynamic('https://x.com/{date}', { now }), 'https://x.com/2026-09-02')
  assert.equal(expandDynamic('https://x.com/{time}', { now }), 'https://x.com/14:07')
  assert.equal(expandDynamic('https://x.com/plain', {}), 'https://x.com/plain')
})

test('parseArgument returns the text after the keyword', () => {
  const ql = { keyword: 'g' }
  assert.equal(parseArgument('g hello world', ql), 'hello world')
  assert.equal(parseArgument('  G   Hello  ', ql), 'Hello')
  assert.equal(parseArgument('g', ql), '')
  assert.equal(parseArgument('google', ql), '')
  assert.equal(parseArgument('gh repo', ql), '', 'a different keyword is not a match')
  assert.equal(parseArgument('anything', {}), '')
})

test('resolveLink url-encodes the argument into the placeholder', () => {
  assert.equal(
    resolveLink('https://www.google.com/search?q={query}', 'a & b'),
    'https://www.google.com/search?q=a%20%26%20b'
  )
})

test('resolveLink with an empty argument opens the origin', () => {
  assert.equal(resolveLink('https://www.google.com/search?q={query}', ''), 'https://www.google.com')
  assert.equal(resolveLink('https://www.google.com/search?q={query}', '   '), 'https://www.google.com')
})

test('resolveLink leaves a placeholder-free link untouched', () => {
  assert.equal(resolveLink('https://mail.google.com', 'ignored'), 'https://mail.google.com')
})

test('normalizeLink adds https to a bare domain, leaves schemes and paths alone', () => {
  assert.equal(normalizeLink('example.com'), 'https://example.com')
  assert.equal(normalizeLink('  example.com/a?b=c '), 'https://example.com/a?b=c')
  assert.equal(normalizeLink('https://example.com'), 'https://example.com')
  assert.equal(normalizeLink('spotify://playlist/123'), 'spotify://playlist/123')
  assert.equal(normalizeLink('mailto:a@b.com'), 'mailto:a@b.com')
  assert.equal(normalizeLink('/usr/local/bin'), '/usr/local/bin')
  assert.equal(normalizeLink('C:\\Users\\me'), 'C:\\Users\\me')
  assert.equal(normalizeLink('~/Projects/app'), join(homedir(), 'Projects/app'))
  assert.equal(normalizeLink('localhost'), 'localhost')
})

test('isWebTarget routes URLs to the browser and paths to the shell', () => {
  assert.equal(isWebTarget('https://example.com'), true)
  assert.equal(isWebTarget('spotify://x'), true)
  assert.equal(isWebTarget('mailto:a@b.com'), true)
  assert.equal(isWebTarget('file:///c:/x'), false)
  assert.equal(isWebTarget('C:\\Users\\me'), false)
  assert.equal(isWebTarget('/usr/local'), false)
})

test('prettyLink strips the protocol and trailing slash', () => {
  assert.equal(prettyLink('https://www.example.com/'), 'www.example.com')
  assert.equal(prettyLink('https://example.com/a?b=c'), 'example.com/a?b=c')
})

test('monogramIcon is a deterministic, self-contained data URI with the first letter', () => {
  const icon = monogramIcon('GitHub Search')
  assert.ok(icon.startsWith('data:image/svg+xml,'))
  assert.equal(monogramIcon('GitHub Search'), icon, 'deterministic')
  assert.notEqual(monogramIcon('YouTube'), icon, 'colour/letter vary by label')
  assert.match(decodeURIComponent(icon), />G<\/text>/)
  // XML-unsafe first characters are escaped, not injected raw.
  assert.match(decodeURIComponent(monogramIcon('<script>')), /&lt;<\/text>/)
})

test('sanitize drops malformed entries and duplicate ids', () => {
  const clean = sanitize([
    { id: 'a', name: 'A', link: 'https://a.com' },
    { id: 'a', name: 'A dup', link: 'https://a2.com' },
    { id: 'b', name: 'B' },
    { id: '', name: 'empty id', link: 'https://c.com' },
    'nonsense',
    { id: 'd', name: 'D', link: 'https://d.com', keyword: 'd', icon: '🔗' }
  ])
  assert.deepEqual(clean, [
    { id: 'a', name: 'A', link: 'https://a.com' },
    { id: 'd', name: 'D', link: 'https://d.com', keyword: 'd', icon: '🔗' }
  ])
})

test('a missing file is seeded with the defaults and persisted', () => {
  const store = new QuicklinkStore({ dir })
  assert.deepEqual(store.list(), DEFAULT_QUICKLINKS)

  const onDisk = JSON.parse(readFileSync(join(dir, 'quicklinks.json'), 'utf8'))
  assert.deepEqual(onDisk, DEFAULT_QUICKLINKS)
})

test('list() is cached until reload()', () => {
  writeFileSync(
    join(dir, 'quicklinks.json'),
    JSON.stringify([{ id: 'a', name: 'A', link: 'https://a.com' }])
  )
  const store = new QuicklinkStore({ dir })
  assert.equal(store.list().length, 1)

  writeFileSync(
    join(dir, 'quicklinks.json'),
    JSON.stringify([
      { id: 'a', name: 'A', link: 'https://a.com' },
      { id: 'b', name: 'B', link: 'https://b.com' }
    ])
  )
  assert.equal(store.list().length, 1, 'still cached')
  store.reload()
  assert.equal(store.list().length, 2, 're-read after reload')
})

test('a corrupt file yields an empty list without throwing', () => {
  writeFileSync(join(dir, 'quicklinks.json'), '{ not json')
  assert.deepEqual(new QuicklinkStore({ dir }).list(), [])
})

test('slugify produces a safe, non-empty id', () => {
  assert.equal(slugify('My Cool Link'), 'my-cool-link')
  assert.equal(slugify('  GitHub!!  '), 'github')
  assert.equal(slugify('日本語'), 'quicklink')
})

test('validateDraft catches the form-checkable problems', () => {
  assert.equal(validateDraft({ name: 'X', link: 'https://x.com' }), null)
  assert.match(validateDraft({ name: 'X', link: '  ' }) ?? '', /link/i)
  assert.match(validateDraft({ name: '', link: 'https://x.com' }) ?? '', /name/i)
  assert.match(
    validateDraft({ name: 'X', link: 'https://x.com', keyword: 'a b' }) ?? '',
    /space/i
  )
})

test('add() appends a normalized entry with a unique generated id', () => {
  const store = new QuicklinkStore({ dir })
  store.reload()
  writeFileSync(join(dir, 'quicklinks.json'), JSON.stringify([]))
  store.reload()

  const first = store.add({ name: 'Hacker News', link: 'news.ycombinator.com' })
  assert.deepEqual(first, {
    id: 'hacker-news',
    name: 'Hacker News',
    link: 'https://news.ycombinator.com'
  })

  const second = store.add({ name: 'Hacker News', link: 'https://hn.example', keyword: 'hn' })
  assert.equal(second.id, 'hacker-news-2', 'id collision gets a numeric suffix')

  // Persisted and visible on a fresh instance.
  const reread = new QuicklinkStore({ dir }).list()
  assert.deepEqual(
    reread.map((q) => q.id),
    ['hacker-news', 'hacker-news-2']
  )
})

test('add() rejects an invalid draft with a user-facing message', () => {
  const store = new QuicklinkStore({ dir })
  writeFileSync(join(dir, 'quicklinks.json'), JSON.stringify([]))
  store.reload()
  assert.throws(() => store.add({ name: '', link: 'https://x.com' }), /name/i)
})

test('normalizeTags trims, lowercases, drops blanks, de-duplicates', () => {
  assert.deepEqual(normalizeTags([' Work ', 'work', 'DEV', '', '  ']), ['work', 'dev'])
  assert.deepEqual(normalizeTags(undefined), [])
})

test('add() persists openWith and tags', () => {
  const store = new QuicklinkStore({ dir })
  writeFileSync(join(dir, 'quicklinks.json'), JSON.stringify([]))
  store.reload()
  const entry = store.add({
    name: 'Docs',
    link: 'https://docs.example.com',
    openWith: 'C:\\Program Files\\Firefox\\firefox.exe',
    tags: ['Work', 'work', 'reference']
  })
  assert.equal(entry.openWith, 'C:\\Program Files\\Firefox\\firefox.exe')
  assert.deepEqual(entry.tags, ['work', 'reference'])

  const reread = new QuicklinkStore({ dir }).list()[0]
  assert.deepEqual(reread.tags, ['work', 'reference'])
})

test('update() replaces fields but keeps the id and the pinned/hidden flags', () => {
  const store = new QuicklinkStore({ dir })
  writeFileSync(
    join(dir, 'quicklinks.json'),
    JSON.stringify([
      { id: 'docs', name: 'Docs', link: 'https://docs.example.com', pinned: true, hidden: true }
    ])
  )
  store.reload()

  const updated = store.update('docs', {
    name: 'Docs v2',
    link: 'docs.example.org',
    keyword: 'd'
  })
  assert.deepEqual(updated, {
    id: 'docs',
    name: 'Docs v2',
    link: 'https://docs.example.org',
    keyword: 'd',
    pinned: true,
    hidden: true
  })

  const reread = new QuicklinkStore({ dir }).get('docs')
  assert.equal(reread?.name, 'Docs v2')
  assert.equal(reread?.pinned, true)
})

test('update() rejects an unknown id and an invalid draft', () => {
  const store = new QuicklinkStore({ dir })
  writeFileSync(join(dir, 'quicklinks.json'), JSON.stringify([]))
  store.reload()
  assert.throws(() => store.update('nope', { name: 'X', link: 'https://x.com' }), /no longer exists/i)

  store.add({ name: 'X', link: 'https://x.com' })
  assert.throws(() => store.update('x', { name: '', link: 'https://x.com' }), /name/i)
})

test('remove() drops the entry and persists', () => {
  const store = new QuicklinkStore({ dir })
  writeFileSync(
    join(dir, 'quicklinks.json'),
    JSON.stringify([
      { id: 'a', name: 'A', link: 'https://a.com' },
      { id: 'b', name: 'B', link: 'https://b.com' }
    ])
  )
  store.reload()

  store.remove('a')
  assert.deepEqual(
    store.list().map((q) => q.id),
    ['b']
  )
  assert.deepEqual(
    new QuicklinkStore({ dir }).list().map((q) => q.id),
    ['b']
  )
  store.remove('missing') // no-op, no throw
})

test('setPinned() / setHidden() toggle the flag and drop it when false', () => {
  const store = new QuicklinkStore({ dir })
  writeFileSync(
    join(dir, 'quicklinks.json'),
    JSON.stringify([{ id: 'a', name: 'A', link: 'https://a.com' }])
  )
  store.reload()

  store.setPinned('a', true)
  store.setHidden('a', true)
  assert.deepEqual(new QuicklinkStore({ dir }).get('a'), {
    id: 'a',
    name: 'A',
    link: 'https://a.com',
    pinned: true,
    hidden: true
  })

  store.setPinned('a', false)
  store.setHidden('a', false)
  assert.deepEqual(new QuicklinkStore({ dir }).get('a'), {
    id: 'a',
    name: 'A',
    link: 'https://a.com'
  })
})

test('sanitize keeps pinned/hidden booleans and ignores non-booleans', () => {
  const [good] = sanitize([
    { id: 'a', name: 'A', link: 'https://a.com', pinned: true, hidden: false }
  ])
  assert.deepEqual(good, { id: 'a', name: 'A', link: 'https://a.com', pinned: true })

  assert.deepEqual(
    sanitize([{ id: 'b', name: 'B', link: 'https://b.com', pinned: 'yes' }]),
    [],
    'a non-boolean pinned rejects the whole entry'
  )
})

test('sanitize keeps well-formed openWith/tags and rejects malformed ones', () => {
  const [good] = sanitize([
    { id: 'a', name: 'A', link: 'https://a.com', openWith: 'x.exe', tags: ['One', 'one'] }
  ])
  assert.equal(good.openWith, 'x.exe')
  assert.deepEqual(good.tags, ['one'])

  assert.deepEqual(
    sanitize([{ id: 'b', name: 'B', link: 'https://b.com', tags: [1, 2] }]),
    [],
    'non-string tags reject the whole entry'
  )
})
