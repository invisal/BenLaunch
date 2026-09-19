import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";

import { ExtensionStorage } from "../../../core/storage.ts";
import { AliasStore } from "./store.ts";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "alias-store-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const file = (): string => join(dir, "alias.json");
const makeStore = (): AliasStore =>
  new AliasStore(new ExtensionStorage(file(), "ext:alias"));

test("list() is empty with no bindings yet", () => {
  assert.deepEqual(makeStore().list(), {});
});

test("set() adds an alias and persists it across instances", () => {
  makeStore().set("app:/applications/notes.app", "n");

  const second = makeStore();
  assert.equal(second.get("app:/applications/notes.app"), "n");
});

test("set() overwrites an existing alias for the same action", () => {
  const store = makeStore();
  store.set("app:/applications/notes.app", "n");
  store.set("app:/applications/notes.app", "note");
  assert.equal(store.get("app:/applications/notes.app"), "note");
});

test("two actions can share the same alias — no uniqueness enforced", () => {
  const store = makeStore();
  store.set("app:/applications/notes.app", "n");
  store.set("cmd:notifications", "n");
  assert.equal(store.get("app:/applications/notes.app"), "n");
  assert.equal(store.get("cmd:notifications"), "n");
});

test("remove() drops one alias and leaves the rest", () => {
  const store = makeStore();
  store.set("app:/applications/notes.app", "n");
  store.set("cmd:lock", "lock");
  store.remove("app:/applications/notes.app");
  assert.equal(store.get("app:/applications/notes.app"), undefined);
  assert.equal(store.get("cmd:lock"), "lock");
});

test("remove() on an unbound action is a no-op", () => {
  const store = makeStore();
  store.remove("app:never-bound");
  assert.deepEqual(store.list(), {});
});
