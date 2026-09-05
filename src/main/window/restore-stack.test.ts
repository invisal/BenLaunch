import assert from "node:assert/strict";
import { test } from "node:test";

import { popRestore, saveForRestore } from "./restore-stack.ts";

test("popRestore returns undefined when nothing was saved for the key", () => {
  assert.equal(popRestore("never-saved"), undefined);
});

test("saveForRestore then popRestore round-trips the rect", () => {
  const rect = { x: 1, y: 2, width: 3, height: 4 };
  saveForRestore("win-1", rect);
  assert.deepEqual(popRestore("win-1"), rect);
});

test("popRestore clears the entry, so a second pop returns undefined", () => {
  saveForRestore("win-2", { x: 0, y: 0, width: 100, height: 100 });
  popRestore("win-2");
  assert.equal(popRestore("win-2"), undefined);
});

test("saving again for the same key overwrites the previous rect", () => {
  saveForRestore("win-3", { x: 0, y: 0, width: 100, height: 100 });
  saveForRestore("win-3", { x: 10, y: 10, width: 50, height: 50 });
  assert.deepEqual(popRestore("win-3"), { x: 10, y: 10, width: 50, height: 50 });
});

test("keys are independent of one another", () => {
  saveForRestore("a", { x: 1, y: 1, width: 1, height: 1 });
  saveForRestore("b", { x: 2, y: 2, width: 2, height: 2 });
  assert.deepEqual(popRestore("a"), { x: 1, y: 1, width: 1, height: 1 });
  assert.deepEqual(popRestore("b"), { x: 2, y: 2, width: 2, height: 2 });
});
