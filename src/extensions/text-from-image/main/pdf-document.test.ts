import assert from "node:assert/strict";
import { test } from "node:test";

import { buildHtml } from "./pdf-document.ts";
import type { OcrLine, Recognition } from "../shared/types";

function line(text: string, y: number): OcrLine {
  return {
    text,
    box: { x: 0, y, width: 200, height: 16 },
    confidence: 0.9,
    words: text.split(" ").map((word, index) => ({
      text: word,
      box: { x: index * 300, y, width: [...word].length * 10, height: 16 },
      confidence: 0.9,
    })),
  };
}

const recognition = (over: Partial<Recognition> = {}): Recognition => ({
  id: "r1",
  createdAt: Date.UTC(2026, 8, 17, 10),
  source: { kind: "file", path: "C:\\shots\\Receipt.png" },
  thumbnailDataUrl: "data:image/png;base64,AA==",
  imageSize: { width: 800, height: 600 },
  engine: "windows",
  language: "en-US",
  lines: [line("Item Price", 0), line("Coffee 7.00", 20)],
  confidence: 0.9,
  preview: "Item Price",
  durationMs: 42,
  pinned: false,
  ...over,
});

test("the document is titled after the source file", () => {
  const html = buildHtml(recognition(), {
    table: false,
    includeConfidence: false,
  });
  assert.match(html, /<title>Receipt\.png<\/title>/);
  assert.match(html, /<h1>Receipt\.png<\/h1>/);
});

test("a clipboard recognition gets a neutral title", () => {
  const html = buildHtml(recognition({ source: { kind: "clipboard" } }), {
    table: false,
    includeConfidence: false,
  });
  assert.match(html, /<h1>Recognized text<\/h1>/);
});

test("text mode emits paragraphs, table mode emits a table", () => {
  const text = buildHtml(recognition(), {
    table: false,
    includeConfidence: false,
  });
  assert.match(text, /<p>Item Price<br>Coffee 7\.00<\/p>/);
  assert.doesNotMatch(text, /<table>/);

  const table = buildHtml(recognition(), {
    table: true,
    includeConfidence: false,
  });
  assert.match(table, /<table><tr><td>Item<\/td><td>Price<\/td><\/tr>/);
});

test("confidence only appears when asked for", () => {
  assert.doesNotMatch(
    buildHtml(recognition(), { table: false, includeConfidence: false }),
    /confidence/,
  );
  assert.match(
    buildHtml(recognition(), { table: false, includeConfidence: true }),
    /90% confidence/,
  );
});

test("recognized text is HTML-escaped", () => {
  const html = buildHtml(
    recognition({ lines: [line('<script>alert("x")</script>', 0)] }),
    { table: false, includeConfidence: false },
  );
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test("the source image is embedded", () => {
  assert.match(
    buildHtml(recognition(), { table: false, includeConfidence: false }),
    /<img src="data:image\/png;base64,AA=="/,
  );
});
