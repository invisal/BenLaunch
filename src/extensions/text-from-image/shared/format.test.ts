import assert from "node:assert/strict";
import { test } from "node:test";

import {
  formatBytes,
  formatConfidence,
  groupLabel,
  makePreview,
  suggestFilename,
  toBlocks,
  toCsv,
  toJsonDocument,
  toPlainText,
  toTableRows,
} from "./format.ts";
import type { OcrLine, Recognition } from "./types.ts";

function line(text: string, y: number, height = 16): OcrLine {
  return {
    text,
    box: { x: 0, y, width: [...text].length * 10, height },
    confidence: 0.9,
    words: text
      .split(" ")
      .filter(Boolean)
      .map((part, index) => ({
        text: part,
        box: { x: index * 100, y, width: [...part].length * 10, height },
        confidence: 0.9,
      })),
  };
}

const recognition = (over: Partial<Recognition> = {}): Recognition => ({
  id: "r1",
  createdAt: Date.UTC(2026, 8, 17, 10, 0),
  source: { kind: "clipboard" },
  thumbnailDataUrl: "data:image/png;base64,AA==",
  imageSize: { width: 800, height: 600 },
  engine: "windows",
  language: "en-US",
  lines: [line("Hello world", 0), line("Second line", 20)],
  confidence: 0.9,
  preview: "Hello world",
  durationMs: 120,
  pinned: false,
  ...over,
});

test("makePreview takes the first non-empty line and collapses whitespace", () => {
  assert.equal(makePreview([line("   ", 0), line("a\n  b", 20)]), "a b");
});

test("makePreview truncates a long line", () => {
  const preview = makePreview([line("x".repeat(200), 0)]);
  assert.equal(preview.length, 90);
  assert.ok(preview.endsWith("…"));
});

test("makePreview reports an empty recognition", () => {
  assert.equal(makePreview([]), "No text found");
});

test("toBlocks splits on a vertical gap wider than a line", () => {
  const blocks = toBlocks([line("a", 0), line("b", 18), line("c", 100)]);
  assert.deepEqual(
    blocks.map((block) => block.map((l) => l.text)),
    [["a", "b"], ["c"]],
  );
});

test("toPlainText separates blocks with a blank line", () => {
  assert.equal(
    toPlainText([line("a", 0), line("b", 18), line("c", 100)]),
    "a\nb\n\nc",
  );
});

test("toCsv quotes only the fields that need it", () => {
  assert.equal(
    toCsv([
      ["plain", 'has "quotes"', "has,comma"],
      ["has\nnewline", "", "ok"],
    ]),
    'plain,"has ""quotes""","has,comma"\r\n"has\nnewline",,ok',
  );
});

test("toTableRows can append a confidence column aligned to the rows", () => {
  const rows = toTableRows([line("a", 0), line("   ", 20), line("b", 40)], {
    includeConfidence: true,
  });
  assert.deepEqual(rows, [
    ["a", "90%"],
    ["b", "90%"],
  ]);
});

test("formatConfidence renders a missing score as an em dash", () => {
  assert.equal(formatConfidence(0.9312), "93%");
  assert.equal(formatConfidence(null), "—");
});

test("toJsonDocument omits confidence unless asked for it", () => {
  const without = toJsonDocument(recognition(), {
    table: false,
    includeConfidence: false,
  }) as Record<string, unknown>;
  assert.equal("confidence" in without, false);
  assert.equal("table" in without, false);

  const with_ = toJsonDocument(recognition(), {
    table: true,
    includeConfidence: true,
  }) as Record<string, unknown>;
  assert.equal(with_.confidence, 0.9);
  assert.ok(Array.isArray(with_.table));
});

test("toJsonDocument carries the text, blocks and line geometry", () => {
  const doc = toJsonDocument(recognition(), {
    table: false,
    includeConfidence: false,
  }) as {
    text: string;
    blocks: { text: string }[];
    lines: { text: string; box: unknown; words: unknown[] }[];
  };
  assert.equal(doc.text, "Hello world\nSecond line");
  assert.equal(doc.blocks.length, 1);
  assert.equal(doc.lines.length, 2);
  assert.deepEqual(doc.lines[0].box, { x: 0, y: 0, width: 110, height: 16 });
  assert.equal(doc.lines[0].words.length, 2);
});

test("suggestFilename prefers the source file's own name", () => {
  assert.equal(
    suggestFilename(
      recognition({
        source: { kind: "file", path: "C:\\shots\\Q3 Report.png" },
      }),
      "xlsx",
      "xlsx",
    ),
    "q3-report.xlsx",
  );
});

test("suggestFilename falls back to the recognized text", () => {
  assert.equal(suggestFilename(recognition(), "txt", "txt"), "hello-world.txt");
});

test("suggestFilename never produces a bare extension", () => {
  assert.equal(
    suggestFilename(recognition({ preview: "!!!" }), "json", "json"),
    "scan.json",
  );
});

test("formatBytes switches units", () => {
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(1536), "1.5 KB");
  assert.equal(formatBytes(5 * 1024 * 1024), "5.0 MB");
});

test("groupLabel buckets by day", () => {
  const now = new Date(2026, 8, 17, 12).getTime();
  assert.equal(groupLabel(new Date(2026, 8, 17, 1).getTime(), now), "Today");
  assert.equal(
    groupLabel(new Date(2026, 8, 16, 23).getTime(), now),
    "Yesterday",
  );
  assert.equal(
    groupLabel(new Date(2026, 8, 14).getTime(), now),
    "Previous 7 Days",
  );
  assert.equal(
    groupLabel(new Date(2026, 8, 1).getTime(), now),
    "Previous 30 Days",
  );
  assert.equal(groupLabel(new Date(2026, 0, 5).getTime(), now), "January 2026");
});
