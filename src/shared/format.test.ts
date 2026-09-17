import assert from "node:assert/strict";
import { test } from "node:test";

import {
  absoluteTime,
  dataUrlByteSize,
  formatBytes,
  groupLabel,
  relativeAge,
  textByteSize,
} from "./format.ts";

const NOW = new Date(2026, 8, 13, 12, 0, 0).getTime();

const ages: ReadonlyArray<readonly [number, string]> = [
  [NOW, "just now"],
  [NOW - 59_000, "just now"],
  [NOW - 5 * 60_000, "5m ago"],
  [NOW - 3 * 3_600_000, "3h ago"],
  [NOW - 30 * 3_600_000, "yesterday"],
  [NOW - 4 * 86_400_000, "4d ago"],
  [new Date(2026, 8, 2, 9).getTime(), "Sep 2"],
  [new Date(2025, 11, 25, 9).getTime(), "Dec 25, 2025"],
  // A clock skew that puts the timestamp slightly in the future reads as now,
  // not as a negative age.
  [NOW + 5_000, "just now"],
];

for (const [at, expected] of ages) {
  test(`relativeAge -> ${expected}`, () => {
    assert.equal(relativeAge(at, NOW), expected);
  });
}

test("groupLabel() buckets by calendar day, not a rolling 24h window", () => {
  const now = new Date(2026, 8, 16, 1, 0, 0).getTime();
  // 3 hours earlier, but on the previous calendar day.
  assert.equal(
    groupLabel(new Date(2026, 8, 15, 22, 0, 0).getTime(), now),
    "Yesterday",
  );
  assert.equal(groupLabel(now, now), "Today");
});

test("groupLabel() falls back to a short date, with a year once it differs", () => {
  const now = new Date(2026, 8, 16, 12, 0, 0).getTime();
  assert.equal(groupLabel(new Date(2026, 8, 2, 9).getTime(), now), "Sep 2");
  assert.equal(
    groupLabel(new Date(2025, 11, 25, 9).getTime(), now),
    "Dec 25, 2025",
  );
});

test("formatBytes() formats bytes/KB/MB", () => {
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes(157), "157 B");
  assert.equal(formatBytes(2048), "2.0 KB");
  assert.equal(formatBytes(20 * 1024), "20 KB");
  assert.equal(formatBytes(3 * 1024 * 1024), "3.0 MB");
});

test("dataUrlByteSize() decodes a base64 payload's byte length", () => {
  // "hello" → 5 bytes, base64 "aGVsbG8=".
  assert.equal(dataUrlByteSize("data:text/plain;base64,aGVsbG8="), 5);
});

test("textByteSize() counts UTF-8 bytes, not characters", () => {
  assert.equal(textByteSize("abc"), 3);
  assert.equal(textByteSize("é"), 2);
});

test("absoluteTime() includes the full date", () => {
  const formatted = absoluteTime(new Date(2026, 8, 16, 13, 22, 41).getTime());
  assert.match(formatted, /Sep 16, 2026/);
});
