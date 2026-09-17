import assert from "node:assert/strict";
import { test } from "node:test";

import { parseLanguages, parseTsv } from "./ocr-linux.ts";

const HEADER =
  "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext";

/** One TSV row, in Tesseract's column order. */
function row(
  level: number,
  block: number,
  par: number,
  line: number,
  word: number,
  left: number,
  top: number,
  width: number,
  height: number,
  conf: number,
  text: string,
): string {
  return [
    level,
    1,
    block,
    par,
    line,
    word,
    left,
    top,
    width,
    height,
    conf,
    text,
  ].join("\t");
}

test("word rows are grouped into lines by block/paragraph/line", () => {
  const tsv = [
    HEADER,
    row(1, 0, 0, 0, 0, 0, 0, 800, 600, -1, ""),
    row(5, 1, 1, 1, 1, 10, 20, 60, 16, 96, "Item"),
    row(5, 1, 1, 1, 2, 400, 20, 30, 16, 92, "Qty"),
    row(5, 1, 1, 2, 1, 10, 40, 70, 16, 88, "Coffee"),
  ].join("\n");

  const lines = parseTsv(tsv);
  assert.equal(lines.length, 2);
  assert.equal(lines[0].text, "Item Qty");
  assert.equal(lines[1].text, "Coffee");
  assert.deepEqual(lines[0].words[1], {
    text: "Qty",
    x: 400,
    y: 20,
    width: 30,
    height: 16,
    confidence: 0.92,
  });
});

test("the same line number in different paragraphs stays separate", () => {
  const tsv = [
    HEADER,
    row(5, 1, 1, 1, 1, 0, 0, 40, 16, 90, "a"),
    row(5, 1, 2, 1, 1, 0, 40, 40, 16, 90, "b"),
  ].join("\n");
  assert.deepEqual(
    parseTsv(tsv).map((line) => line.text),
    ["a", "b"],
  );
});

test("layout placeholder rows and empty text are dropped", () => {
  const tsv = [
    HEADER,
    row(4, 1, 1, 1, 0, 0, 0, 100, 16, -1, ""),
    row(5, 1, 1, 1, 1, 0, 0, 40, 16, -1, "ghost"),
    row(5, 1, 1, 1, 2, 50, 0, 10, 16, 95, "   "),
    row(5, 1, 1, 1, 3, 70, 0, 40, 16, 95, "real"),
  ].join("\n");
  assert.deepEqual(
    parseTsv(tsv).map((line) => line.text),
    ["real"],
  );
});

test("text containing a tab is kept whole", () => {
  const tsv = [HEADER, row(5, 1, 1, 1, 1, 0, 0, 40, 16, 90, "a\tb")].join("\n");
  assert.equal(parseTsv(tsv)[0].words[0].text, "a\tb");
});

test("empty output yields no lines", () => {
  assert.deepEqual(parseTsv(""), []);
  assert.deepEqual(parseTsv(HEADER), []);
});

test("parseLanguages skips the header sentence and osd", () => {
  assert.deepEqual(
    parseLanguages("List of available languages (3):\neng\nkhm\nosd\n"),
    ["eng", "khm"],
  );
});
