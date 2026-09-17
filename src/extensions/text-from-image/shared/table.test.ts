import assert from "node:assert/strict";
import { test } from "node:test";

import { looksTabular, toGrid, toVisualLines } from "./table.ts";
import type { Box, OcrLine, OcrWord } from "./types.ts";

/** A word box sized like 10px-per-character text, so the defaults' thresholds apply. */
const CHAR = 10;

function word(text: string, x: number, y: number): OcrWord {
  return {
    text,
    box: { x, y, width: [...text].length * CHAR, height: 16 },
    confidence: 0.9,
  };
}

function line(words: OcrWord[]): OcrLine {
  const boxes = words.map((w) => w.box);
  const left = Math.min(...boxes.map((b: Box) => b.x));
  const top = Math.min(...boxes.map((b: Box) => b.y));
  const right = Math.max(...boxes.map((b: Box) => b.x + b.width));
  const bottom = Math.max(...boxes.map((b: Box) => b.y + b.height));
  return {
    text: words.map((w) => w.text).join(" "),
    box: { x: left, y: top, width: right - left, height: bottom - top },
    confidence: 0.9,
    words,
  };
}

/** A three-column receipt: item at x=0, qty at x=400, price at x=600. */
function receipt(): OcrLine[] {
  return [
    line([word("Item", 0, 0), word("Qty", 400, 0), word("Price", 600, 0)]),
    line([word("Coffee", 0, 20), word("2", 400, 20), word("7.00", 600, 20)]),
    line([word("Tea", 0, 40), word("1", 400, 40), word("3.50", 600, 40)]),
    line([word("Total", 0, 60), word("3", 400, 60), word("10.50", 600, 60)]),
  ];
}

test("columns recur across lines and become a grid", () => {
  assert.deepEqual(toGrid(receipt()), [
    ["Item", "Qty", "Price"],
    ["Coffee", "2", "7.00"],
    ["Tea", "1", "3.50"],
    ["Total", "3", "10.50"],
  ]);
});

test("a multi-word cell keeps its words together", () => {
  const lines = [
    line([
      word("Flat", 0, 0),
      word("White", 50, 0),
      word("2", 400, 0),
      word("9.00", 600, 0),
    ]),
    line([word("Tea", 0, 20), word("1", 400, 20), word("3.50", 600, 20)]),
    line([word("Total", 0, 40), word("3", 400, 40), word("12.50", 600, 40)]),
  ];
  assert.deepEqual(toGrid(lines)[0], ["Flat White", "2", "9.00"]);
});

test("prose stays one column — its wide gaps don't line up", () => {
  const lines = [
    line([word("The", 0, 0), word("quick", 40, 0), word("brown", 100, 0)]),
    // A ragged right edge leaves one wide gap, at a different x each line.
    line([word("fox", 0, 20), word("jumped", 200, 20)]),
    line([word("over", 0, 40), word("the", 60, 40), word("lazy", 500, 40)]),
  ];
  assert.deepEqual(toGrid(lines), [
    ["The quick brown"],
    ["fox jumped"],
    ["over the lazy"],
  ]);
});

test("blank lines are dropped rather than emitted as empty rows", () => {
  const lines = [...receipt()];
  lines.splice(2, 0, line([word("   ", 0, 30)]));
  assert.equal(toGrid(lines).length, 4);
});

test("lines without word geometry fall back to one column", () => {
  const lines: OcrLine[] = [
    {
      text: "Item  Qty  Price",
      box: { x: 0, y: 0, width: 0, height: 0 },
      confidence: null,
      words: [],
    },
    {
      text: "Tea   1    3.50",
      box: { x: 0, y: 20, width: 0, height: 0 },
      confidence: null,
      words: [],
    },
  ];
  assert.deepEqual(toGrid(lines), [["Item  Qty  Price"], ["Tea   1    3.50"]]);
});

test("every row is padded to the same width", () => {
  const lines = [
    line([word("Item", 0, 0), word("Qty", 400, 0), word("Price", 600, 0)]),
    line([word("Coffee", 0, 20), word("7.00", 600, 20)]),
    line([word("Tea", 0, 40), word("1", 400, 40), word("3.50", 600, 40)]),
    line([word("Total", 0, 60), word("3", 400, 60), word("10.50", 600, 60)]),
  ];
  const grid = toGrid(lines);
  assert.deepEqual(new Set(grid.map((row) => row.length)), new Set([3]));
  assert.deepEqual(grid[1], ["Coffee", "", "7.00"]);
});

test("a single line can't invent columns on its own", () => {
  const lines = [
    line([word("Alone", 0, 0), word("far", 400, 0), word("apart", 600, 0)]),
    line([word("Ordinary", 0, 20), word("prose", 90, 20)]),
  ];
  assert.deepEqual(toGrid(lines), [["Alone far apart"], ["Ordinary prose"]]);
});

test("empty input yields no rows", () => {
  assert.deepEqual(toGrid([]), []);
});

test("looksTabular tells a receipt apart from a paragraph", () => {
  assert.equal(looksTabular(receipt()), true);
  assert.equal(
    looksTabular([
      line([word("The", 0, 0), word("quick", 40, 0)]),
      line([word("brown", 0, 20), word("fox", 70, 20)]),
    ]),
    false,
  );
});

/* ----------------------------- visual rows ------------------------------ */

test("a column-shaped line is re-flowed into rows, left to right", () => {
  // What Windows OCR actually reports for a wide table: one "line" per column,
  // each spanning the full height of the table.
  const columns = [
    line([word("Item", 0, 0), word("Coffee", 0, 40), word("Total", 0, 80)]),
    line([word("Qty", 400, 0), word("2", 400, 40), word("3", 400, 80)]),
    line([
      word("Price", 600, 0),
      word("7.00", 600, 40),
      word("10.50", 600, 80),
    ]),
  ];

  assert.deepEqual(
    toVisualLines(columns).map((row) => row.text),
    ["Item Qty Price", "Coffee 2 7.00", "Total 3 10.50"],
  );
});

test("a column-major page re-flows into rows", () => {
  const columns = [
    line([word("Item", 0, 0)]),
    line([word("Coffee", 0, 40)]),
    line([word("Qty", 400, 0)]),
    line([word("2", 400, 40)]),
    line([word("Price", 600, 0)]),
    line([word("7.00", 600, 40)]),
  ];

  const rows = toVisualLines(columns);
  assert.deepEqual(
    rows.map((row) => row.text),
    ["Item Qty Price", "Coffee 2 7.00"],
  );
  // The merged row's words stay in reading order, and its box spans the page.
  assert.deepEqual(
    rows[0].words.map((w) => w.text),
    ["Item", "Qty", "Price"],
  );
  assert.equal(rows[0].box.x, 0);
  assert.equal(rows[0].box.width, 600 + 50);
});

test("re-flowed rows reconstruct as a grid", () => {
  const columns = [
    line([word("Item", 0, 0), word("Coffee", 0, 40), word("Total", 0, 80)]),
    line([word("Qty", 400, 0), word("2", 400, 40), word("3", 400, 80)]),
    line([
      word("Price", 600, 0),
      word("7.00", 600, 40),
      word("10.50", 600, 80),
    ]),
  ];

  assert.deepEqual(toGrid(toVisualLines(columns)), [
    ["Item", "Qty", "Price"],
    ["Coffee", "2", "7.00"],
    ["Total", "3", "10.50"],
  ]);
});

test("rows that don't overlap vertically stay separate", () => {
  const stacked = [line([word("first", 0, 0)]), line([word("second", 0, 40)])];
  assert.deepEqual(
    toVisualLines(stacked).map((row) => row.text),
    ["first", "second"],
  );
});

test("blank lines are dropped and a single line passes through", () => {
  assert.deepEqual(toVisualLines([]), []);
  const one = line([word("only", 0, 0)]);
  assert.deepEqual(toVisualLines([one, line([word("   ", 0, 0)])]), [one]);
});

test("a line with no words of its own still carries its text into a row", () => {
  const flat: OcrLine = {
    text: "Total",
    box: { x: 600, y: 0, width: 80, height: 16 },
    confidence: null,
    words: [],
  };
  assert.deepEqual(
    toVisualLines([line([word("Item", 0, 0)]), flat]).map((row) => row.text),
    ["Item Total"],
  );
});

test("lines with no geometry at all are left in the engine's order", () => {
  const flat: OcrLine[] = [
    {
      text: "b",
      box: { x: 0, y: 0, width: 0, height: 0 },
      confidence: null,
      words: [],
    },
    {
      text: "a",
      box: { x: 0, y: 0, width: 0, height: 0 },
      confidence: null,
      words: [],
    },
  ];
  assert.deepEqual(
    toVisualLines(flat).map((row) => row.text),
    ["b", "a"],
  );
});

test("a merged row averages its words' confidences", () => {
  const scored = (text: string, x: number, confidence: number): OcrLine =>
    line([{ ...word(text, x, 0), confidence }]);
  assert.equal(
    toVisualLines([scored("a", 0, 0.6), scored("b", 400, 0.8)])[0].confidence,
    0.7,
  );
});
