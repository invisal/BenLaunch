import assert from "node:assert/strict";
import { test } from "node:test";
import {
  absoluteTime,
  dataUrlByteSize,
  formatBytes,
  groupLabel,
  imagePreview,
  makePreview,
  relativeAge,
  textByteSize,
} from "./format.ts";

test("makePreview() collapses whitespace and trims", () => {
  assert.equal(
    makePreview("  hello   world  \n\n  again "),
    "hello world again",
  );
});

test("makePreview() truncates long text with an ellipsis", () => {
  const long = "a".repeat(200);
  const preview = makePreview(long);
  assert.equal(preview.length, 121);
  assert.ok(preview.endsWith("…"));
});

test("makePreview() leaves short text untouched", () => {
  assert.equal(makePreview("short"), "short");
});

test("imagePreview() formats dimensions", () => {
  assert.equal(imagePreview(1024, 768), "Image · 1024×768");
});

test("relativeAge() buckets", () => {
  const now = 1_000_000_000;
  assert.equal(relativeAge(now, now), "just now");
  assert.equal(relativeAge(now - 5 * 60_000, now), "5m ago");
  assert.equal(relativeAge(now - 3 * 60 * 60_000, now), "3h ago");
  assert.equal(relativeAge(now - 25 * 60 * 60_000, now), "yesterday");
  assert.equal(relativeAge(now - 4 * 24 * 60 * 60_000, now), "4d ago");
});

test("relativeAge() falls back to a short date beyond a week", () => {
  const now = new Date("2026-09-16T00:00:00Z").getTime();
  const createdAt = new Date("2026-09-01T00:00:00Z").getTime();
  assert.equal(relativeAge(createdAt, now), "Sep 1");
});

test("groupLabel() buckets by calendar day, not a rolling 24h window", () => {
  const now = new Date(2026, 8, 16, 0, 1).getTime(); // Sep 16, 00:01
  const lateYesterday = new Date(2026, 8, 15, 23, 59).getTime(); // 2 minutes earlier
  assert.equal(groupLabel(now, now), "Today");
  assert.equal(groupLabel(lateYesterday, now), "Yesterday");
});

test("groupLabel() falls back to a short date, with a year once it differs", () => {
  const now = new Date(2026, 8, 16, 12, 0).getTime();
  assert.equal(groupLabel(new Date(2026, 8, 1, 12, 0).getTime(), now), "Sep 1");
  assert.equal(
    groupLabel(new Date(2025, 8, 1, 12, 0).getTime(), now),
    "Sep 1, 2025",
  );
});

test("formatBytes() formats bytes/KB/MB", () => {
  assert.equal(formatBytes(500), "500 B");
  assert.equal(formatBytes(1536), "1.5 KB");
  assert.equal(formatBytes(10240), "10 KB");
  assert.equal(formatBytes(1_258_291), "1.2 MB");
});

test("dataUrlByteSize() decodes a base64 payload's byte length", () => {
  const base64 = Buffer.from("hello world").toString("base64");
  assert.equal(dataUrlByteSize(`data:text/plain;base64,${base64}`), 11);
});

test("textByteSize() counts UTF-8 bytes, not characters", () => {
  assert.equal(textByteSize("hello"), 5);
  assert.equal(textByteSize("héllo"), 6); // é is 2 bytes in UTF-8
});

test("absoluteTime() includes the full date", () => {
  const createdAt = new Date(2026, 8, 16, 13, 22, 41).getTime();
  assert.match(absoluteTime(createdAt), /Sep 16, 2026/);
});
