import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";

import { ExtensionStorage } from "../../../core/storage.ts";
import { pinEntryId, pinRow, refreshPin, type Evaluate } from "./pins.ts";
import { HistoryStore } from "./store.ts";

let dir: string;
let store: HistoryStore;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "calc-pins-"));
  store = new HistoryStore(
    new ExtensionStorage(join(dir, "h.json"), "ext:test"),
    () => 1000,
  );
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function pinned(query: string, value: string) {
  const entry = store.record({
    query,
    expression: query,
    value,
    rawValue: value,
  })!;
  store.setPinned(entry.id, true);
  return store.get(entry.id)!;
}

test("pinEntryId parses only pin action ids", () => {
  assert.equal(pinEntryId("calculator-history:pin:abc"), "abc");
  assert.equal(pinEntryId("calculator-history:open"), null);
  assert.equal(pinEntryId("widget:abc"), null);
});

test("pinRow is a pinned, deferred-subtitle calculation row", () => {
  const entry = pinned("1 usd in eur", "€0.86");
  assert.deepEqual(pinRow(entry), {
    id: `calculator-history:pin:${entry.id}`,
    title: "1 usd in eur",
    subtitle: "€0.86",
    icon: "🧮",
    type: "calculation",
    pinned: true,
    isDeferredSubtitle: true,
  });
});

test("refreshPin re-evaluates the query and persists the new value", () => {
  const entry = pinned("1 usd in eur", "€0.86");
  const seen: string[] = [];
  const evaluate: Evaluate = (q) => {
    seen.push(q);
    return { expression: q, value: "€0.87", rawValue: "0.87" };
  };

  assert.equal(refreshPin(store, evaluate, pinRow(entry).id), "€0.87");
  assert.deepEqual(seen, ["1 usd in eur"]);
  assert.equal(store.get(entry.id)?.value, "€0.87");
  assert.equal(store.get(entry.id)?.rawValue, "0.87");
});

test("refreshPin falls back to the stored value when the query no longer resolves", () => {
  const entry = pinned("days until 25 dec", "103 days");
  assert.equal(
    refreshPin(store, () => null, pinRow(entry).id),
    "103 days",
  );
});

test("refreshPin falls back when evaluate throws", () => {
  const entry = pinned("boom", "1");
  const evaluate: Evaluate = () => {
    throw new Error("bad");
  };
  assert.equal(refreshPin(store, evaluate, pinRow(entry).id), "1");
});

test("refreshPin ignores unknown and unpinned entries", () => {
  const loose = store.record({
    query: "2 + 2",
    expression: "2 + 2",
    value: "4",
    rawValue: "4",
  })!;
  const evaluate: Evaluate = () => ({
    expression: "",
    value: "x",
    rawValue: "x",
  });
  assert.equal(
    refreshPin(store, evaluate, `calculator-history:pin:${loose.id}`),
    undefined,
  );
  assert.equal(
    refreshPin(store, evaluate, "calculator-history:pin:missing"),
    undefined,
  );
  assert.equal(refreshPin(store, evaluate, "widget:x"), undefined);
});
