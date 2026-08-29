import assert from "node:assert/strict"
import { test } from "node:test"

import { fuzzyMatch } from "./search.ts"

test("empty query matches everything with a neutral score", () => {
  const result = fuzzyMatch("", "Visual Studio Code")
  assert.equal(result.match, true)
  assert.equal(result.score, 0)
})

test("equal-length non-subsequence does not match", () => {
  // Regression: the raw DP returns SCORE_MAX whenever needle.length === haystack.length,
  // so this pair must be rejected by the subsequence check first.
  const result = fuzzyMatch("cat", "car")
  assert.equal(result.match, false)
  assert.equal(result.score, -Infinity)
})

test("exact match (case-insensitive) scores the maximum", () => {
  const result = fuzzyMatch("Code", "code")
  assert.equal(result.match, true)
  assert.equal(result.score, Infinity)
})

test("needle longer than haystack does not match", () => {
  const result = fuzzyMatch("abcd", "abc")
  assert.equal(result.match, false)
  assert.equal(result.score, -Infinity)
})

test("characters not present in order do not match", () => {
  assert.equal(fuzzyMatch("xyz", "abc").match, false)
  assert.equal(fuzzyMatch("cba", "abc").match, false)
})

test("real fuzzy match returns a finite score", () => {
  const result = fuzzyMatch("code", "Visual Studio Code")
  assert.equal(result.match, true)
  assert.ok(Number.isFinite(result.score))
})

test("consecutive matches beat scattered matches", () => {
  const consecutive = fuzzyMatch("abc", "abcxyz").score
  const scattered = fuzzyMatch("abc", "axbxcx").score
  assert.ok(consecutive > scattered, `${consecutive} > ${scattered}`)
})

test("word-boundary matches beat mid-word matches", () => {
  const boundary = fuzzyMatch("st", "Sublime Text").score
  const midWord = fuzzyMatch("st", "Fastest").score
  assert.ok(boundary > midWord, `${boundary} > ${midWord}`)
})

test("camelCase humps count as word starts", () => {
  const camel = fuzzyMatch("hw", "HelloWorld").score
  const midWord = fuzzyMatch("hw", "Hardware").score
  assert.ok(camel > midWord, `${camel} > ${midWord}`)
})

test("earlier match beats a later one (leading-gap penalty)", () => {
  const early = fuzzyMatch("z", "zxxxxx").score
  const late = fuzzyMatch("z", "xxxxxz").score
  assert.ok(early > late, `${early} > ${late}`)
})

test("can be used to rank a list of titles", () => {
  const titles = ["Discord", "Docker Desktop", "Visual Studio Code", "Notion", "Node.js"]
  const ranked = titles
    .map((title) => ({ title, ...fuzzyMatch("code", title) }))
    .filter((r) => r.match)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.title)

  assert.deepEqual(ranked, ["Visual Studio Code"])
})

test("no match result objects are independent", () => {
  const a = fuzzyMatch("zzz", "abc")
  const b = fuzzyMatch("zzz", "abc")
  assert.notEqual(a, b)
})
