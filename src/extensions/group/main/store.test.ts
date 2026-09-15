import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";

import { ExtensionStorage } from "../../../core/storage.ts";
import { GroupStore } from "./store.ts";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "group-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const file = (): string => join(dir, "group.json");
const makeStore = (): GroupStore =>
  new GroupStore(new ExtensionStorage(file(), "ext:group"));

test("save() creates a slug id from the name and returns the stored def", () => {
  const store = makeStore();
  const saved = store.save({ name: "Work Stuff!", sourceIds: ["ql:a"] });

  assert.equal(saved.id, "work-stuff");
  assert.equal(saved.name, "Work Stuff!");
  assert.deepEqual(saved.sourceIds, ["ql:a"]);
  assert.deepEqual(store.list(), [saved]);
});

test("a second Group with a colliding name gets a numbered id", () => {
  const store = makeStore();
  const a = store.save({ name: "Dev", sourceIds: [] });
  const b = store.save({ name: "Dev", sourceIds: [] });

  assert.equal(a.id, "dev");
  assert.equal(b.id, "dev-2");
});

test("save() with an existing id updates in place", () => {
  const store = makeStore();
  const created = store.save({ name: "Dev", sourceIds: ["ql:a"] });
  const updated = store.save({
    id: created.id,
    name: "Dev Tools",
    sourceIds: ["ql:a", "widget:b"],
  });

  assert.equal(updated.id, created.id);
  assert.equal(store.list().length, 1);
  assert.equal(store.get(created.id)?.name, "Dev Tools");
  assert.deepEqual(store.get(created.id)?.sourceIds, ["ql:a", "widget:b"]);
});

test("remove() persists", () => {
  const store = makeStore();
  const group = store.save({ name: "Q", sourceIds: [] });

  store.remove(group.id);
  assert.deepEqual(makeStore().list(), []);
});

test("list() and get() return copies — mutating them doesn't touch the store", () => {
  const store = makeStore();
  const saved = store.save({ name: "Q", sourceIds: ["a"] });

  const listed = store.list()[0];
  listed.sourceIds.push("b");
  assert.deepEqual(store.get(saved.id)?.sourceIds, ["a"]);

  const got = store.get(saved.id);
  got?.sourceIds.push("c");
  assert.deepEqual(store.get(saved.id)?.sourceIds, ["a"]);
});

test("a second instance on the same file sees the first instance writes", () => {
  const first = makeStore();
  first.save({ name: "Shared", sourceIds: ["x"] });

  const second = makeStore();
  assert.equal(second.list()[0]?.name, "Shared");
});

test("missing, corrupt, and malformed storage all yield an empty list", () => {
  assert.deepEqual(makeStore().list(), []);

  writeFileSync(file(), "{ not json");
  assert.deepEqual(makeStore().list(), []);

  // Right wrapper, wrong `groups` shape → the store's own guard rejects it.
  writeFileSync(
    file(),
    JSON.stringify({ version: 1, savedAt: 0, data: { groups: "nope" } }),
  );
  assert.deepEqual(makeStore().list(), []);

  // Stale wrapper version → ExtensionStorage discards the whole document.
  writeFileSync(
    file(),
    JSON.stringify({ version: 999, savedAt: 0, data: { groups: [] } }),
  );
  assert.deepEqual(makeStore().list(), []);
});
