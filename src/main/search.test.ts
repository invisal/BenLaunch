import assert from "node:assert/strict";
import { test } from "node:test";

import { fuzzyMatch } from "./search.ts";

/**
 * The scoring model has too many interacting rules (word starts, camelCase
 * humps, consecutive runs, leading gap, trailing length) to give every case a
 * good name. Instead the interesting behaviour is written down as a table of
 * concrete examples:
 *
 *  - `matchCases`   – does `query` match `title` at all?
 *  - `scoreCases`   – exact score for the few inputs that have a defined one.
 *  - `rankingCases` – `titles` listed best-first; we score them all and assert
 *                     the sort comes out in that order.
 *
 * Add a row whenever real usage turns up an ordering that feels wrong.
 */

const matchCases: ReadonlyArray<{ query: string; title: string; match: boolean }> = [
  { query: "", title: "Visual Studio Code", match: true },
  { query: "code", title: "Visual Studio Code", match: true },
  { query: "vsc", title: "Visual Studio Code", match: true },
  { query: "cat", title: "car", match: false }, // same length, not a subsequence
  { query: "abcd", title: "abc", match: false }, // query longer than title
  { query: "xyz", title: "abc", match: false }, // no shared characters
  { query: "cba", title: "abc", match: false }, // right characters, wrong order
];

for (const { query, title, match } of matchCases) {
  test(`match(${JSON.stringify(query)}, ${JSON.stringify(title)}) === ${match}`, () => {
    const result = fuzzyMatch(query, title);
    assert.equal(result.match, match);
    if (!match) assert.equal(result.score, -Infinity);
  });
}

const scoreCases: ReadonlyArray<{ query: string; title: string; score: number }> = [
  { query: "", title: "Visual Studio Code", score: 0 }, // empty query is neutral
  { query: "Code", title: "code", score: Infinity }, // exact, case-insensitive
  { query: "abc", title: "abc", score: Infinity }, // exact
];

for (const { query, title, score } of scoreCases) {
  test(`score(${JSON.stringify(query)}, ${JSON.stringify(title)}) === ${score}`, () => {
    const result = fuzzyMatch(query, title);
    assert.equal(result.match, true);
    assert.equal(result.score, score);
  });
}

const rankingCases: ReadonlyArray<{ query: string; titles: string[] }> = [
  // A consecutive run beats the same characters scattered.
  { query: "abc", titles: ["abcxyz", "axbxcx"] },
  // A word-boundary match beats a mid-word one.
  { query: "st", titles: ["Sublime Text", "Fastest"] },
  // A camelCase hump counts as a word start.
  { query: "hw", titles: ["HelloWorld", "Hardware"] },
  // An earlier match beats a later one (leading-gap penalty).
  { query: "z", titles: ["zxxxxx", "xxxxxz"] },
  // Start-of-string bonus beats a start-of-later-word bonus.
  { query: "v", titles: ["Vim", "Event Viewer"] },
  // "vi": a literal prefix, then split across two words, then on a later word.
  { query: "vi", titles: ["Vim", "Visual Studio", "Voom Intel", "Event Viewer"] },
  // Among equally-good prefixes, the shorter title wins (length tiebreak).
  { query: "vi", titles: ["Visual Studio", "Visual Studio Code"] },
  { query: "chr", titles: ["Chrome", "Chromium", "Google Chrome"] },
  // A single letter at the start of the string beats the same letter mid-word.
  { query: "o", titles: ["Outlook", "Google Chrome"] },
  { query: "note", titles: ["Notepad", "Notepad++", "Keep Notes"] },
  // All match "Code" as a whole word; rank by how much unmatched tail follows.
  { query: "code", titles: ["VS Code", "QR Code Generator", "Visual Studio Code"] },
];

for (const { query, titles } of rankingCases) {
  test(`rank(${JSON.stringify(query)}): ${titles.join(" > ")}`, () => {
    const ranked = [...titles]
      .reverse() // start from the worst order so a no-op sort can't pass
      .map((title) => ({ title, ...fuzzyMatch(query, title) }))
      .sort((a, b) => b.score - a.score);

    for (const r of ranked) {
      assert.equal(r.match, true, `${JSON.stringify(query)} should match ${JSON.stringify(r.title)}`);
    }
    assert.deepEqual(
      ranked.map((r) => r.title),
      titles,
      `scores: ${ranked.map((r) => `${r.title}=${r.score.toFixed(4)}`).join(", ")}`,
    );
  });
}

test("no-match results are fresh objects, not a shared singleton", () => {
  assert.notEqual(fuzzyMatch("zzz", "abc"), fuzzyMatch("zzz", "abc"));
});
