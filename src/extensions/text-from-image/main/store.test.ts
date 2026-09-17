import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";

import { ExtensionStorage } from "../../../core/storage.ts";
import {
  MAX_ENTRIES,
  MAX_PINNED,
  RecognitionStore,
  type RecordInput,
} from "./store.ts";
import type { OcrLine } from "../shared/types";

let dir: string;
let clock: number;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "text-from-image-"));
  clock = 1_000;
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const open = (): RecognitionStore =>
  new RecognitionStore(
    new ExtensionStorage(
      join(dir, "text-from-image.json"),
      "ext:text-from-image",
    ),
    () => ++clock,
  );

function line(text: string): OcrLine {
  return {
    text,
    box: { x: 0, y: 0, width: 100, height: 16 },
    confidence: 0.9,
    words: [
      { text, box: { x: 0, y: 0, width: 100, height: 16 }, confidence: 0.9 },
    ],
  };
}

const input = (text: string): RecordInput => ({
  source: { kind: "clipboard" },
  thumbnailDataUrl: "data:image/png;base64,AA==",
  imageSize: { width: 100, height: 50 },
  engine: "windows",
  language: "en-US",
  lines: [line(text)],
  confidence: 0.9,
  durationMs: 10,
});

test("record assigns an id, a timestamp and a preview", () => {
  const entry = open().record(input("Hello  world"));
  assert.match(entry.id, /^[0-9a-f-]{36}$/);
  assert.equal(entry.createdAt, 1_001);
  assert.equal(entry.preview, "Hello world");
  assert.equal(entry.pinned, false);
});

test("entries persist and read back newest first", () => {
  const store = open();
  store.record(input("first"));
  store.record(input("second"));

  assert.deepEqual(
    open()
      .list()
      .map((entry) => entry.preview),
    ["second", "first"],
  );
});

test("pinned entries sort ahead of newer unpinned ones", () => {
  const store = open();
  const old = store.record(input("old"));
  store.record(input("new"));
  store.setPinned(old.id, true);

  assert.deepEqual(
    store.list().map((entry) => entry.preview),
    ["old", "new"],
  );
});

test("get returns a copy, so a caller can't mutate the store", () => {
  const store = open();
  const entry = store.record(input("text"));
  store.get(entry.id)!.preview = "tampered";
  assert.equal(store.get(entry.id)?.preview, "text");
});

test("remove drops one entry, clear drops every unpinned one", () => {
  const store = open();
  const a = store.record(input("a"));
  const b = store.record(input("b"));
  store.record(input("c"));
  store.setPinned(b.id, true);

  store.remove(a.id);
  assert.equal(store.list().length, 2);
  store.clear();
  assert.deepEqual(
    store.list().map((entry) => entry.preview),
    ["b"],
  );
});

test("setPinned refuses past the pin cap and reports it", () => {
  const store = open();
  const ids = Array.from(
    { length: MAX_PINNED + 1 },
    (_, i) => store.record(input(`e${i}`)).id,
  );
  for (const id of ids.slice(0, MAX_PINNED)) {
    assert.equal(store.setPinned(id, true), true);
  }
  assert.equal(store.setPinned(ids[MAX_PINNED], false), true);
  assert.equal(store.setPinned(ids[MAX_PINNED], true), false);
  assert.equal(store.list().filter((entry) => entry.pinned).length, MAX_PINNED);
});

test("setPinned is false for an unknown id", () => {
  assert.equal(open().setPinned("nope", true), false);
});

test("the oldest unpinned entries are evicted past the cap, pins are kept", () => {
  const store = open();
  const first = store.record(input("oldest"));
  store.setPinned(first.id, true);
  for (let i = 0; i < MAX_ENTRIES + 5; i++) store.record(input(`e${i}`));

  const entries = store.list();
  assert.equal(entries.filter((entry) => !entry.pinned).length, MAX_ENTRIES);
  assert.equal(entries[0].preview, "oldest");
});

test("malformed persisted entries are dropped individually", () => {
  const storage = new ExtensionStorage(
    join(dir, "text-from-image.json"),
    "ext:text-from-image",
  );
  storage.set("recognitions", [
    {
      id: "ok",
      createdAt: 5,
      preview: "fine",
      pinned: false,
      lines: [],
      thumbnailDataUrl: "",
    },
    { id: "bad" },
    null,
    "nonsense",
  ]);

  assert.deepEqual(
    new RecognitionStore(storage).list().map((entry) => entry.id),
    ["ok"],
  );
});
