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

test("an unset shortcut falls back to the platform default", () => {
  const settings = new SettingsStore({ dir });
  assert.equal(settings.getWindowShortcut("win:left-half", "Control+Alt+Left"), "Control+Alt+Left");
});

test("setWindowShortcut overrides the default, and persists across instances", () => {
  const first = new SettingsStore({ dir });
  first.setWindowShortcut("win:left-half", "Control+Alt+9");

  const second = new SettingsStore({ dir });
  assert.equal(second.getWindowShortcut("win:left-half", "Control+Alt+Left"), "Control+Alt+9");
});

test("setWindowShortcut(id, null) explicitly disables the shortcut, distinct from unset", () => {
  const settings = new SettingsStore({ dir });
  settings.setWindowShortcut("win:left-half", null);
  assert.equal(settings.getWindowShortcut("win:left-half", "Control+Alt+Left"), null);
});

test("getWindowShortcuts fills every default id, overrides included", () => {
  const settings = new SettingsStore({ dir });
  settings.setWindowShortcut("win:maximize", "Control+Alt+0");

  const result = settings.getWindowShortcuts({
    "win:left-half": "Control+Alt+Left",
    "win:maximize": "Control+Alt+M",
  });

  assert.deepEqual(result, {
    "win:left-half": "Control+Alt+Left",
    "win:maximize": "Control+Alt+0",
  });
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

test("a settings file saved before gapPx existed still validates, defaulting gapPx", () => {
  writeFileSync(
    join(dir, "settings.json"),
    JSON.stringify({ version: 1, savedAt: 0, windowShortcuts: { "win:x": "Q" } }),
  );
  const settings = new SettingsStore({ dir });
  assert.equal(settings.getGapSize(), 8);
  assert.equal(settings.getWindowShortcut("win:x", "D"), "Q");
});

test("missing, corrupt, and wrong-version files all yield defaults without throwing", () => {
  // Missing: fresh dir.
  assert.equal(new SettingsStore({ dir }).getWindowShortcut("win:x", "D"), "D");

  // Corrupt JSON.
  writeFileSync(join(dir, "settings.json"), "{ not json");
  assert.equal(new SettingsStore({ dir }).getWindowShortcut("win:x", "D"), "D");

  // Wrong version.
  writeFileSync(
    join(dir, "settings.json"),
    JSON.stringify({ version: 999, savedAt: 0, windowShortcuts: { "win:x": "Q" } }),
  );
  assert.equal(new SettingsStore({ dir }).getWindowShortcut("win:x", "D"), "D");
});
