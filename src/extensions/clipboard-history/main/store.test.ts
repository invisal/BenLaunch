import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";

import { ExtensionStorage } from "../../../core/storage.ts";
import {
  ClipboardStore,
  MAX_IMAGE_ENTRIES,
  MAX_PINNED,
  MAX_TEXT_ENTRIES,
} from "./store.ts";

let dir: string;
let clock: number;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "clipboard-history-"));
  clock = 1_000_000;
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const file = (): string => join(dir, "clipboard-history.json");
const makeStore = (): ClipboardStore =>
  new ClipboardStore(
    new ExtensionStorage(file(), "ext:clipboard-history"),
    () => clock,
  );

const text = (value: string) => ({ contentType: "text" as const, text: value });
const image = (width = 100, height = 50) => ({
  contentType: "image" as const,
  dataUrl: `data:image/png;base64,${width}x${height}`,
  width,
  height,
  originalBytes: 12_345,
});

test("record() stores a text entry and returns it", () => {
  const store = makeStore();
  const entry = store.record(text("hello world"));

  assert.ok(entry);
  assert.equal(entry.contentType, "text");
  assert.equal(entry.text, "hello world");
  assert.equal(entry.preview, "hello world");
  assert.equal(entry.createdAt, clock);
  assert.equal(entry.pinned, false);
  assert.deepEqual(store.list(), [entry]);
});

test("record() stores an image entry and returns it", () => {
  const store = makeStore();
  const entry = store.record(image(1024, 768));

  assert.ok(entry);
  assert.equal(entry.contentType, "image");
  assert.equal(entry.imageDataUrl, "data:image/png;base64,1024x768");
  assert.deepEqual(entry.imageSize, { width: 1024, height: 768 });
  assert.equal(entry.originalBytes, 12_345);
  assert.equal(entry.sourcePath, undefined);
  assert.equal(entry.preview, "Image · 1024×768");
});

test("record() carries sourcePath through for a file-copy image", () => {
  const store = makeStore();
  const entry = store.record({
    ...image(200, 100),
    sourcePath: "/Users/user/Desktop/Screenshot.png",
  });

  assert.equal(entry?.sourcePath, "/Users/user/Desktop/Screenshot.png");
});

test("record() carries sourceApp through for both text and image entries", () => {
  const store = makeStore();
  const sourceApp = { name: "Finder", icon: "data:image/png;base64,abc" };

  const textEntry = store.record({ ...text("hi"), sourceApp });
  const imageEntry = store.record({ ...image(), sourceApp });

  assert.deepEqual(textEntry?.sourceApp, sourceApp);
  assert.deepEqual(imageEntry?.sourceApp, sourceApp);
});

test("record() creates a new entry even for identical repeated text (no dedup)", () => {
  const store = makeStore();
  store.record(text("same"));
  clock += 10;
  store.record(text("same"));

  assert.equal(store.list().length, 2);
});

test("record() ignores blank/whitespace-only text", () => {
  const store = makeStore();
  assert.equal(store.record(text("   ")), undefined);
  assert.equal(store.record(text("")), undefined);
  assert.deepEqual(store.list(), []);
});

test("list() is newest first", () => {
  const store = makeStore();
  store.record(text("first"));
  clock += 10;
  store.record(text("second"));

  assert.deepEqual(
    store.list().map((e) => e.text),
    ["second", "first"],
  );
});

test("list() reflects createdAt order even when record() calls arrive out of order", () => {
  // Simulates an async source-app lookup finishing out of order: the entry
  // with the *later* createdAt is recorded (prepended) first.
  const store = makeStore();
  clock = 2_000;
  const later = store.record(text("later"))!;
  clock = 1_000;
  const earlier = store.record(text("earlier"))!;

  assert.deepEqual(
    store.list().map((e) => e.id),
    [later.id, earlier.id],
  );
});

test("list() puts pinned entries first", () => {
  const store = makeStore();
  const old = store.record(text("old"))!;
  clock += 10;
  store.record(text("new"));
  store.setPinned(old.id, true);

  assert.deepEqual(
    store.list().map((e) => e.text),
    ["old", "new"],
  );
});

test("setPinned() refuses beyond MAX_PINNED", () => {
  const store = makeStore();
  const ids = Array.from({ length: MAX_PINNED + 1 }, (_, i) => {
    clock += 1;
    return store.record(text(`q${i}`))!.id;
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

test("setPinned() unpin then re-pin works", () => {
  const store = makeStore();
  const entry = store.record(text("a"))!;
  assert.equal(store.setPinned(entry.id, true), true);
  assert.equal(store.setPinned(entry.id, false), true);
  assert.equal(store.setPinned(entry.id, true), true);
});

test("unpinned text entries are capped at MAX_TEXT_ENTRIES, dropping the oldest", () => {
  const store = makeStore();
  const pinned = store.record(text("pinned"))!;
  store.setPinned(pinned.id, true);
  for (let i = 0; i < MAX_TEXT_ENTRIES + 5; i++) {
    clock += 1;
    store.record(text(`item ${i}`));
  }

  const list = store.list();
  assert.equal(list.filter((e) => !e.pinned).length, MAX_TEXT_ENTRIES);
  assert.ok(
    list.some((e) => e.text === "pinned"),
    "a pin is never trimmed",
  );
  assert.ok(!list.some((e) => e.text === "item 0"), "oldest dropped");
  assert.ok(list.some((e) => e.text === `item ${MAX_TEXT_ENTRIES + 4}`));
});

test("unpinned image entries are capped at MAX_IMAGE_ENTRIES independently of text", () => {
  const store = makeStore();
  for (let i = 0; i < MAX_IMAGE_ENTRIES + 3; i++) {
    clock += 1;
    store.record(image(i, i));
  }
  store.record(text("keep me, different cap"));

  const list = store.list();
  assert.equal(
    list.filter((e) => e.contentType === "image").length,
    MAX_IMAGE_ENTRIES,
  );
  assert.equal(list.filter((e) => e.contentType === "text").length, 1);
});

test("remove() deletes one entry", () => {
  const store = makeStore();
  const a = store.record(text("a"))!;
  store.record(text("b"));
  store.remove(a.id);
  assert.deepEqual(
    store.list().map((e) => e.text),
    ["b"],
  );
});

test("clear() drops unpinned entries but keeps pins", () => {
  const store = makeStore();
  const keep = store.record(text("keep"))!;
  store.record(text("drop"));
  store.setPinned(keep.id, true);
  store.clear();
  assert.deepEqual(
    store.list().map((e) => e.text),
    ["keep"],
  );
});

test("entries persist across store instances", () => {
  const first = makeStore();
  const entry = first.record(text("persist me"))!;
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
            contentType: "text",
            text: "hi",
            preview: "hi",
            createdAt: 5,
            pinned: false,
          },
          { id: "bad", contentType: "text" },
          { id: "bad-image", contentType: "image" },
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
  store.record(text("a"));
  store.list()[0].preview = "tampered";
  assert.equal(store.list()[0].preview, "a");
});
