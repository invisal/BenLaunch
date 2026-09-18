import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";

import { ExtensionStorage } from "../../../core/storage.ts";
import { HotkeyBindingStore } from "./store.ts";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "hotkey-store-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const DEFAULT_SETTINGS_ACCELERATOR =
  process.platform === "darwin" ? "Command+," : "Ctrl+,";

const file = (): string => join(dir, "hotkey.json");
const makeStore = (): HotkeyBindingStore =>
  new HotkeyBindingStore(new ExtensionStorage(file(), "ext:hotkey"));

test("list() seeds the built-in default on first read", () => {
  assert.deepEqual(makeStore().list(), {
    "cmd:settings": {
      accelerator: DEFAULT_SETTINGS_ACCELERATOR,
      type: "command",
    },
  });
});

test("the seeded default persists across instances", () => {
  makeStore().list();
  assert.equal(
    makeStore().get("cmd:settings")?.accelerator,
    DEFAULT_SETTINGS_ACCELERATOR,
  );
});

test("removing the default sticks — it is not re-seeded on the next load", () => {
  const first = makeStore();
  first.list();
  first.remove("cmd:settings");

  assert.equal(makeStore().get("cmd:settings"), undefined);
});

test("set() adds a binding and persists it across instances", () => {
  makeStore().set("ql:abc123", {
    accelerator: "Command+Shift+G",
    type: "quicklink",
  });

  const second = makeStore();
  assert.deepEqual(second.get("ql:abc123"), {
    accelerator: "Command+Shift+G",
    type: "quicklink",
  });
  // The default binding is untouched.
  assert.equal(
    second.get("cmd:settings")?.accelerator,
    DEFAULT_SETTINGS_ACCELERATOR,
  );
});

test("set() overwrites an existing binding for the same action", () => {
  const store = makeStore();
  store.set("ql:abc123", { accelerator: "Command+Shift+G", type: "quicklink" });
  store.set("ql:abc123", { accelerator: "Command+Shift+H", type: "quicklink" });
  assert.equal(store.get("ql:abc123")?.accelerator, "Command+Shift+H");
});

test("remove() drops one binding and leaves the rest", () => {
  const store = makeStore();
  store.set("ql:abc123", { accelerator: "Command+Shift+G", type: "quicklink" });
  store.remove("ql:abc123");
  assert.equal(store.get("ql:abc123"), undefined);
  assert.notEqual(store.get("cmd:settings"), undefined);
});

test("remove() on an unbound action is a no-op", () => {
  const store = makeStore();
  store.remove("ql:never-bound");
  assert.equal(Object.keys(store.list()).length, 1);
});
