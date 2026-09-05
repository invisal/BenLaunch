import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";

import { SettingsStore } from "./store.ts";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "settings-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

test("getGapSize defaults to 8px unset", () => {
  const settings = new SettingsStore({ dir });
  assert.equal(settings.getGapSize(), 8);
});

test("setGapSize overrides the default, and persists across instances", () => {
  const first = new SettingsStore({ dir });
  first.setGapSize(16);

  const second = new SettingsStore({ dir });
  assert.equal(second.getGapSize(), 16);
});

test("setGapSize clamps a negative value to zero", () => {
  const settings = new SettingsStore({ dir });
  settings.setGapSize(-5);
  assert.equal(settings.getGapSize(), 0);
});

test("missing, corrupt, and wrong-version files all yield the default without throwing", () => {
  // Missing: fresh dir.
  assert.equal(new SettingsStore({ dir }).getGapSize(), 8);

  // Corrupt JSON.
  writeFileSync(join(dir, "settings.json"), "{ not json");
  assert.equal(new SettingsStore({ dir }).getGapSize(), 8);

  // Wrong version.
  writeFileSync(join(dir, "settings.json"), JSON.stringify({ version: 999, savedAt: 0, gapPx: 20 }));
  assert.equal(new SettingsStore({ dir }).getGapSize(), 8);
});
