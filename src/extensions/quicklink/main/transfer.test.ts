import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";

import type { OpenWithApp, QuicklinkDraft } from "../shared/types.ts";
import { QuicklinkStore } from "./store.ts";
import {
  fillMissingIcons,
  isDuplicate,
  parseRaycastJson,
  toDraft,
  toRaycast,
} from "./transfer.ts";

/** Records which origins were asked for, so tests can assert the de-duping. */
function fakeFetcher(result: (origin: string) => string | null = () => "icon") {
  const asked: string[] = [];
  return {
    asked,
    fetch: async (origin: string) => {
      asked.push(origin);
      return result(origin);
    },
  };
}

/** The example from Raycast's "Import Quicklinks" documentation. */
const RAYCAST_SAMPLE = JSON.stringify([
  { link: "https://duckduckgo.com/?q={argument}", name: "Search DuckDuckGo" },
  {
    openWith: "Finder",
    iconName: "folder-16",
    link: "~/Downloads",
    name: "Downloads",
  },
  {
    openWith: "Music",
    link: "https://music.apple.com/gb/station/apple-music-hits/ra.1498155548",
    name: "Apple Music Hits Radio",
  },
  { link: "shortcuts://run-shortcut?Name={Test}", name: "Run Apple Shortcut" },
]);

const APPS: OpenWithApp[] = [
  { name: "Finder", path: "/System/Library/CoreServices/Finder.app" },
  { name: "Music", path: "/Applications/Music.app" },
];

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "quicklinks-transfer-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

test("parseRaycastJson reads the documented sample", () => {
  const parsed = parseRaycastJson(RAYCAST_SAMPLE);
  assert.ok(parsed);
  assert.equal(parsed.entries.length, 4);
  assert.equal(parsed.invalid, 0);
  assert.equal(parsed.entries[0].name, "Search DuckDuckGo");
  assert.equal(parsed.entries[1].openWith, "Finder");
  assert.equal(parsed.entries[1].iconName, "folder-16");
});

test("parseRaycastJson rejects non-arrays and bad JSON", () => {
  assert.equal(parseRaycastJson("not json"), null);
  assert.equal(parseRaycastJson('{"name":"x","link":"y"}'), null);
  assert.deepEqual(parseRaycastJson("[]"), { entries: [], invalid: 0 });
});

test("parseRaycastJson counts entries missing name or link as invalid", () => {
  const parsed = parseRaycastJson(
    JSON.stringify([
      { name: "ok", link: "https://x.com" },
      { name: "no link" },
      { link: "https://y.com" },
      { name: "  ", link: "https://z.com" },
      "nonsense",
      null,
    ]),
  );
  assert.ok(parsed);
  assert.equal(parsed.entries.length, 1);
  assert.equal(parsed.invalid, 5);
});

test("toDraft resolves openWith from an app name to its path", () => {
  const parsed = parseRaycastJson(RAYCAST_SAMPLE);
  assert.ok(parsed);
  const drafts = parsed.entries.map((entry) => toDraft(entry, APPS));

  assert.equal(drafts[1].openWith, "/System/Library/CoreServices/Finder.app");
  assert.equal(drafts[2].openWith, "/Applications/Music.app");
  // Nothing named it, so it opens with the system default.
  assert.equal(drafts[0].openWith, undefined);
});

test("toDraft drops an openWith naming an app that isn't installed", () => {
  const draft = toDraft(
    { name: "x", link: "https://x.com", openWith: "Nonexistent App" },
    APPS,
  );
  assert.equal(draft.openWith, undefined);
});

test("toDraft keeps an emoji icon but drops Raycast's named icons", () => {
  assert.equal(
    toDraft({ name: "x", link: "https://x.com", iconName: "folder-16" }, APPS)
      .icon,
    undefined,
  );
  assert.equal(
    toDraft({ name: "x", link: "https://x.com", iconName: "🚀" }, APPS).icon,
    "🚀",
  );
  assert.equal(
    toDraft(
      { name: "x", link: "https://x.com", iconName: "https://x.com/i.png" },
      APPS,
    ).icon,
    "https://x.com/i.png",
  );
});

test("toRaycast maps an openWith path back to the app's name", () => {
  const entry = toRaycast(
    {
      id: "downloads",
      name: "Downloads",
      link: "/Users/me/Downloads",
      openWith: "/Applications/Music.app",
    },
    APPS,
  );
  assert.equal(entry.openWith, "Music");
  assert.equal(entry.name, "Downloads");
});

test("toRaycast falls back to the app's filename when it isn't installed", () => {
  const entry = toRaycast(
    {
      id: "x",
      name: "x",
      link: "https://x.com",
      openWith: "/Applications/Gone.app",
    },
    APPS,
  );
  assert.equal(entry.openWith, "Gone");
});

test("toRaycast exports an emoji icon but never an inlined favicon", () => {
  assert.equal(
    toRaycast({ id: "x", name: "x", link: "https://x.com", icon: "🚀" }, APPS)
      .iconName,
    "🚀",
  );
  assert.equal(
    toRaycast(
      {
        id: "x",
        name: "x",
        link: "https://x.com",
        icon: "data:image/png;base64,AAAA",
      },
      APPS,
    ).iconName,
    undefined,
  );
});

test("a store round-trips through export and re-import as duplicates", () => {
  const store = new QuicklinkStore({ dir });
  store.addMany(
    [
      {
        name: "Search DuckDuckGo",
        link: "https://duckduckgo.com/?q={argument}",
      },
      { name: "Downloads", link: "~/Downloads" },
    ],
    isDuplicate,
  );

  const exported = store.list().map((link) => toRaycast(link, APPS));
  const reparsed = parseRaycastJson(JSON.stringify(exported));
  assert.ok(reparsed);
  assert.equal(reparsed.entries.length, exported.length);

  // Re-importing a full export is a no-op: every entry is already there.
  // (The count includes the defaults a fresh store is seeded with.)
  const summary = store.addMany(
    reparsed.entries.map((entry) => toDraft(entry, APPS)),
    isDuplicate,
  );
  assert.deepEqual(summary, {
    added: 0,
    duplicates: exported.length,
    invalid: 0,
  });
});

test("isDuplicate compares the normalized link, so a bare domain matches", () => {
  const existing = [{ id: "x", name: "Example", link: "https://example.com" }];
  assert.equal(
    isDuplicate({ name: "Example", link: "example.com" }, existing),
    true,
  );
  assert.equal(
    isDuplicate({ name: "example", link: "example.com" }, existing),
    true,
  );
  // Same name, different target — not a duplicate.
  assert.equal(
    isDuplicate({ name: "Example", link: "https://other.com" }, existing),
    false,
  );
});

test("addMany skips duplicates within the imported file itself", () => {
  const store = new QuicklinkStore({ dir });
  const summary = store.addMany(
    [
      { name: "Dupe", link: "https://x.com" },
      { name: "Dupe", link: "https://x.com" },
      { name: "Other", link: "https://y.com" },
    ],
    isDuplicate,
  );
  assert.deepEqual(summary, { added: 2, duplicates: 1, invalid: 0 });
});

test("addMany counts unusable drafts without aborting the import", () => {
  const store = new QuicklinkStore({ dir });
  const before = store.list().length;
  const summary = store.addMany(
    [
      { name: "Good", link: "https://x.com" },
      { name: "", link: "https://y.com" },
      { name: "No link", link: "   " },
    ],
    isDuplicate,
  );
  assert.equal(summary.added, 1);
  assert.equal(summary.invalid, 2);
  assert.equal(store.list().length, before + 1);
});

test("fillMissingIcons gives an iconless web link its site's favicon", async () => {
  const drafts: QuicklinkDraft[] = [
    { name: "x", link: "https://example.com/a?b=1" },
  ];
  const fetcher = fakeFetcher();

  await fillMissingIcons(drafts, fetcher.fetch);

  assert.deepEqual(fetcher.asked, ["https://example.com"]);
  assert.equal(drafts[0].icon, "icon");
});

test("fillMissingIcons fetches once per origin, not once per link", async () => {
  const drafts: QuicklinkDraft[] = [
    { name: "a", link: "https://github.com/one" },
    { name: "b", link: "https://github.com/two" },
    { name: "c", link: "https://github.com/three" },
    { name: "d", link: "https://other.com/x" },
  ];
  const fetcher = fakeFetcher((origin) => `icon:${origin}`);

  await fillMissingIcons(drafts, fetcher.fetch);

  assert.equal(fetcher.asked.length, 2);
  assert.deepEqual(
    new Set(fetcher.asked),
    new Set(["https://github.com", "https://other.com"]),
  );
  // Every link on that origin gets the one fetched icon.
  for (const draft of drafts.slice(0, 3))
    assert.equal(draft.icon, "icon:https://github.com");
  assert.equal(drafts[3].icon, "icon:https://other.com");
});

test("fillMissingIcons leaves an entry that brought its own icon alone", async () => {
  const drafts: QuicklinkDraft[] = [
    { name: "x", link: "https://example.com", icon: "🚀" },
  ];
  const fetcher = fakeFetcher();

  await fillMissingIcons(drafts, fetcher.fetch);

  assert.deepEqual(fetcher.asked, []);
  assert.equal(drafts[0].icon, "🚀");
});

test("fillMissingIcons skips links with no website to ask", async () => {
  const drafts: QuicklinkDraft[] = [
    { name: "downloads", link: "~/Downloads" },
    { name: "shortcut", link: "shortcuts://run-shortcut?Name={Test}" },
    { name: "abs", link: "/usr/local/bin" },
  ];
  const fetcher = fakeFetcher();

  await fillMissingIcons(drafts, fetcher.fetch);

  assert.deepEqual(fetcher.asked, []);
  for (const draft of drafts) assert.equal(draft.icon, undefined);
});

test("fillMissingIcons normalizes a bare domain before asking", async () => {
  const drafts: QuicklinkDraft[] = [{ name: "x", link: "example.com/path" }];
  const fetcher = fakeFetcher();

  await fillMissingIcons(drafts, fetcher.fetch);

  assert.deepEqual(fetcher.asked, ["https://example.com"]);
});

test("fillMissingIcons leaves a link iconless when the lookup finds nothing", async () => {
  const drafts: QuicklinkDraft[] = [{ name: "x", link: "https://example.com" }];
  const fetcher = fakeFetcher(() => null);

  await fillMissingIcons(drafts, fetcher.fetch);

  assert.equal(drafts[0].icon, undefined);
});

test("importing ~/Downloads stores an absolute path", () => {
  const store = new QuicklinkStore({ dir });
  store.addMany(
    [toDraft({ name: "Downloads", link: "~/Downloads" }, APPS)],
    isDuplicate,
  );
  const entry = store.list().find((link) => link.name === "Downloads");
  assert.equal(entry?.link, join(homedir(), "Downloads"));
});
