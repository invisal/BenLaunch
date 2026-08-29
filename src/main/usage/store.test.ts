import assert from "node:assert/strict"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, test } from "node:test"

import { Usage } from "./store.ts"

const DAY = 24 * 60 * 60 * 1000

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "usage-"))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

/** A clock that starts at `t0` and can be advanced between assertions. */
function clock(t0: number): { now: () => number; advance: (ms: number) => void } {
  let current = t0
  return { now: () => current, advance: (ms) => (current += ms) }
}

test("record then boost is positive; unseen id or query scores 0", () => {
  const usage = new Usage({ dir, now: () => 1000 })
  usage.record("app:code", "vs")

  assert.ok(usage.boost("app:code", "vs") > 0)
  assert.equal(usage.boost("app:other", "vs"), 0)
  // Unseen query still gets the global component, so it is non-zero but smaller.
  assert.ok(usage.boost("app:code", "zzz") > 0)
  assert.ok(usage.boost("app:code", "zzz") < usage.boost("app:code", "vs"))
})

test("the per-query signal outweighs a global-only match for the same id", () => {
  const usage = new Usage({ dir, now: () => 1000 })
  // "code" picked once for query "x", many times globally via other queries.
  usage.record("app:code", "x")
  for (let i = 0; i < 5; i++) usage.record("app:editor", "y")

  const codeForX = usage.boost("app:code", "x")
  const editorForX = usage.boost("app:editor", "x")
  assert.ok(codeForX > editorForX, `${codeForX} > ${editorForX}`)
})

test("an older use scores below a fresh one with the same count", () => {
  const c = clock(100 * DAY)
  const usage = new Usage({ dir, now: c.now })

  usage.record("app:old", "q")
  c.advance(20 * DAY) // two half-lives pass for "app:old"
  usage.record("app:new", "q") // same count (1), but just now

  const old = usage.boost("app:old", "q")
  const fresh = usage.boost("app:new", "q")
  assert.ok(fresh > old, `${fresh} > ${old}`)
  // ~2 half-lives => roughly a quarter of the fresh score.
  assert.ok(old < fresh / 2)
})

test("scores() reflects relative global counts", () => {
  const usage = new Usage({ dir, now: () => 5000 })
  usage.record("app:a", "")
  usage.record("app:b", "")
  usage.record("app:b", "")

  const scores = usage.scores()
  assert.ok((scores.get("app:b") ?? 0) > (scores.get("app:a") ?? 0))
  assert.equal(scores.get("app:missing"), undefined)
})

test("a second instance on the same dir sees the first's writes", () => {
  const first = new Usage({ dir, now: () => 1234 })
  first.record("app:code", "vs")

  const second = new Usage({ dir, now: () => 1234 })
  assert.ok(second.boost("app:code", "vs") > 0)
})

test("missing, corrupt, and wrong-version files all yield empty state without throwing", () => {
  // Missing: fresh dir.
  assert.equal(new Usage({ dir }).boost("app:x", "q"), 0)

  // Corrupt JSON.
  writeFileSync(join(dir, "usage.json"), "{ not json")
  assert.equal(new Usage({ dir }).boost("app:x", "q"), 0)

  // Wrong version.
  writeFileSync(
    join(dir, "usage.json"),
    JSON.stringify({ version: 999, savedAt: 0, global: {}, byQuery: {} })
  )
  assert.equal(new Usage({ dir }).boost("app:x", "q"), 0)
})
