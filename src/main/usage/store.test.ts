import assert from "node:assert/strict"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, test } from "node:test"

import { Usage } from "./store.ts"

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "usage-"))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

test("first pick scores 0.20; unseen id or query scores 0", () => {
  const usage = new Usage({ dir, now: () => 1000 })
  usage.record("app:code", "vs")

  assert.equal(usage.boost("app:code", "vs"), 0.2)
  assert.equal(usage.boost("app:other", "vs"), 0)
  // A typed query rides on fuzzy relevance only — no global spillover.
  assert.equal(usage.boost("app:code", "zzz"), 0)
})

test("repeat picks for the same query add up, capped at 1.0", () => {
  const usage = new Usage({ dir, now: () => 1000 })
  for (let i = 0; i < 3; i++) usage.record("app:code", "vs")
  assert.ok(Math.abs(usage.boost("app:code", "vs") - 0.6) < 1e-9)

  for (let i = 0; i < 10; i++) usage.record("app:code", "vs")
  assert.equal(usage.boost("app:code", "vs"), 1)
})

test("an action picked for a query outranks one never picked for it", () => {
  const usage = new Usage({ dir, now: () => 1000 })
  usage.record("app:code", "x")
  for (let i = 0; i < 5; i++) usage.record("app:editor", "y")

  assert.ok(usage.boost("app:code", "x") > usage.boost("app:editor", "x"))
  assert.equal(usage.boost("app:editor", "x"), 0)
})

test("a rival decays by 0.9 per pick and is pruned once it falls below 0.1", () => {
  const usage = new Usage({ dir, now: () => 1000 })
  usage.record("app:a", "q") // a -> 0.2

  usage.record("app:b", "q") // a *= 0.9 -> 0.18
  assert.ok(Math.abs(usage.boost("app:a", "q") - 0.18) < 1e-9)

  // 0.2 * 0.9^6 ≈ 0.106 (kept); 0.2 * 0.9^7 ≈ 0.096 (pruned).
  for (let i = 0; i < 5; i++) usage.record("app:b", "q")
  assert.ok(usage.boost("app:a", "q") > 0)
  usage.record("app:b", "q")
  assert.equal(usage.boost("app:a", "q"), 0)
})

test("picking an action does not decay its own score", () => {
  const usage = new Usage({ dir, now: () => 1000 })
  usage.record("app:a", "q")
  usage.record("app:a", "q")
  // Two clean +0.2 additions, no self-decay in between.
  assert.ok(Math.abs(usage.boost("app:a", "q") - 0.4) < 1e-9)
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
  assert.equal(second.boost("app:code", "vs"), 0.2)
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
