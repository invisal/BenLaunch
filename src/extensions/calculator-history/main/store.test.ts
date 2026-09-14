import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";

import { ExtensionStorage } from "../../../core/storage.ts";
import { HistoryStore, MAX_ENTRIES, MAX_PINNED } from "./store.ts";

let dir: string;
let clock: number;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "calc-history-"));
  clock = 1_000_000;
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const file = (): string => join(dir, "calculator-history.json");
const makeStore = (): HistoryStore =>
  new HistoryStore(
    new ExtensionStorage(file(), "ext:calculator-history"),
    () => clock,
  );

const calc = (query: string, value = "42") => ({
  query,
  expression: query,
  value,
  rawValue: value,
});

test("record() stores an entry and returns it", () => {
  const store = makeStore();
  const entry = store.record(calc("6 * 7"));

  assert.ok(entry);
  assert.equal(entry.query, "6 * 7");
  assert.equal(entry.value, "42");
  assert.equal(entry.createdAt, clock);
  assert.equal(entry.pinned, false);
  assert.deepEqual(store.list(), [entry]);
});

test("list() is newest first", () => {
  const store = makeStore();
  store.record(calc("1 + 1", "2"));
  clock += 10;
  store.record(calc("2 + 2", "4"));

  assert.deepEqual(
    store.list().map((e) => e.query),
    ["2 + 2", "1 + 1"],
  );
});

test("recording the same query again refreshes it instead of duplicating", () => {
  const store = makeStore();
  const first = store.record(calc("10 usd in eur", "€8.63"))!;
  clock += 10;
  store.record(calc("2 + 2", "4"));
  clock += 10;
  const again = store.record(calc("  10 usd  in eur ", "€8.70"))!;

  assert.equal(again.id, first.id);
  assert.equal(store.list().length, 2);
  assert.equal(store.list()[0].value, "€8.70");
  assert.equal(store.list()[0].createdAt, clock);
});

test("queries differing only in case stay separate entries (units are case-sensitive)", () => {
  const store = makeStore();
  const bytes = store.record(calc("1 MB to B", "1,000,000 B"))!;
  clock += 10;
  const bits = store.record(calc("1 Mb to B", "125,000 B"))!;

  assert.notEqual(bits.id, bytes.id);
  assert.deepEqual(
    store.list().map((e) => e.value),
    ["125,000 B", "1,000,000 B"],
  );
});

test("re-recording keeps a pinned entry pinned", () => {
  const store = makeStore();
  const entry = store.record(calc("time in tokyo", "13:00"))!;
  store.setPinned(entry.id, true);
  const again = store.record(calc("time in tokyo", "13:05"))!;

  assert.equal(again.pinned, true);
});

test("record() ignores an empty query or value", () => {
  const store = makeStore();
  assert.equal(store.record(calc("   ")), undefined);
  assert.equal(store.record({ ...calc("1 + 1"), value: "" }), undefined);
  assert.deepEqual(store.list(), []);
});

test("list() puts pinned entries first", () => {
  const store = makeStore();
  const old = store.record(calc("old"))!;
  clock += 10;
  store.record(calc("new"));
  store.setPinned(old.id, true);

  assert.deepEqual(
    store.list().map((e) => e.query),
    ["old", "new"],
  );
  assert.deepEqual(
    store.pinned().map((e) => e.query),
    ["old"],
  );
});

test("unpinned entries are capped at MAX_ENTRIES, dropping the oldest", () => {
  const store = makeStore();
  const pinned = store.record(calc("pinned"))!;
  store.setPinned(pinned.id, true);
  for (let i = 0; i < MAX_ENTRIES + 5; i++) {
    clock += 1;
    store.record(calc(`${i} + 1`));
  }

  const list = store.list();
  assert.equal(list.filter((e) => !e.pinned).length, MAX_ENTRIES);
  assert.ok(
    list.some((e) => e.query === "pinned"),
    "a pin is never trimmed",
  );
  assert.ok(!list.some((e) => e.query === "0 + 1"), "oldest dropped");
  assert.ok(list.some((e) => e.query === `${MAX_ENTRIES + 4} + 1`));
});

test("setPinned() refuses beyond MAX_PINNED", () => {
  const store = makeStore();
  const ids = Array.from({ length: MAX_PINNED + 1 }, (_, i) => {
    clock += 1;
    return store.record(calc(`q${i}`))!.id;
  });

  for (const id of ids.slice(0, MAX_PINNED))
    assert.equal(store.setPinned(id, true), true);
  assert.equal(store.setPinned(ids[MAX_PINNED], true), false);
  assert.equal(store.get(ids[MAX_PINNED])?.pinned, false);

  // Unpinning frees a slot.
  store.setPinned(ids[0], false);
  assert.equal(store.setPinned(ids[MAX_PINNED], true), true);
});

test("setPinned() on an unknown id returns false", () => {
  assert.equal(makeStore().setPinned("nope", true), false);
});

test("updateResult() changes the value in place without moving the entry", () => {
  const store = makeStore();
  const a = store.record(calc("1 usd in eur", "€0.86"))!;
  clock += 10;
  store.record(calc("2 + 2", "4"));
  store.updateResult(a.id, "€0.87", "0.87");

  const list = store.list();
  assert.equal(list[1].id, a.id);
  assert.equal(list[1].value, "€0.87");
  assert.equal(list[1].createdAt, a.createdAt);
});

test("remove() deletes one entry", () => {
  const store = makeStore();
  const a = store.record(calc("a"))!;
  store.record(calc("b"));
  store.remove(a.id);
  assert.deepEqual(
    store.list().map((e) => e.query),
    ["b"],
  );
});

test("clear() drops unpinned entries but keeps pins", () => {
  const store = makeStore();
  const keep = store.record(calc("keep"))!;
  store.record(calc("drop"));
  store.setPinned(keep.id, true);
  store.clear();
  assert.deepEqual(
    store.list().map((e) => e.query),
    ["keep"],
  );
});

test("entries persist across store instances", () => {
  const first = makeStore();
  const entry = first.record(calc("persist me"))!;
  first.setPinned(entry.id, true);

  const second = makeStore();
  assert.deepEqual(second.list(), [{ ...entry, pinned: true }]);
});

test("malformed entries on disk are dropped individually", () => {
  writeFileSync(
    file(),
    JSON.stringify({
      version: 1,
      savedAt: 0,
      data: {
        entries: [
          {
            id: "ok",
            query: "1+1",
            expression: "1 + 1",
            value: "2",
            rawValue: "2",
            createdAt: 5,
            pinned: false,
          },
          { id: "bad", query: 42 },
          "garbage",
        ],
      },
    }),
  );
  assert.deepEqual(
    makeStore()
      .list()
      .map((e) => e.id),
    ["ok"],
  );
});

test("a corrupt file yields an empty history", () => {
  writeFileSync(file(), "{ not json");
  assert.deepEqual(makeStore().list(), []);
});

test("list() returns copies — mutating them doesn't touch the store", () => {
  const store = makeStore();
  store.record(calc("1 + 1", "2"));
  store.list()[0].value = "tampered";
  assert.equal(store.list()[0].value, "2");
});
