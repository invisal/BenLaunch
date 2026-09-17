/**
 * Layout reconstruction: the geometry that turns an OCR engine's raw output
 * into something with rows and columns, so a receipt or a screenshotted table
 * becomes rows × columns rather than one tall column of fragments.
 *
 * Two separate problems, in order:
 *
 * **Rows** (`toVisualLines`). An engine's "line" is not reliably a visual row.
 * Windows OCR, given a table whose columns are a few hundred pixels apart,
 * reports each *column* as its own line — so the raw reading order of a
 * three-column receipt is "Item, Coffee, Tea, Total, Qty, 2, 3, Price, …",
 * which is wrong as plain text before it is ever wrong as a table. Lines whose
 * boxes sit at the same height are therefore merged back into one visual row,
 * left to right, which is what every consumer downstream then sees.
 *
 * **Columns** (`toGrid`). No engine reports columns at all — they report words
 * with boxes — so the column structure is inferred from those:
 *
 *  1. Measure a typical character width, so every threshold below can be
 *     expressed relative to the text's own size instead of in raw pixels
 *     (which would only ever be tuned for one screenshot resolution).
 *  2. Inside each row, find the *gutters* — horizontal gaps between adjacent
 *     words that are much wider than a space.
 *  3. Keep only the gutters that recur at the same x across many rows. A wide
 *     gap on a single row is a ragged sentence; a wide gap at the same x on
 *     most rows is a column boundary. This is what stops a paragraph from
 *     being shredded into columns.
 *  4. Drop each word into the column its centre falls in.
 *
 * Pure and Electron-free, so `node --test` drives it directly (`./table.test.ts`)
 * and the renderer can preview the same grid the exporters will write.
 */
import type { Box, OcrLine, OcrWord } from "./types";

export interface GridOptions {
  /**
   * How wide a gap has to be, as a multiple of the median character width,
   * before it counts as a candidate gutter rather than a word space.
   */
  gapFactor?: number;
  /**
   * How far apart, in median character widths, two lines' gutters can sit and
   * still be treated as the same column boundary.
   */
  clusterFactor?: number;
  /**
   * The share of multi-word lines that must agree on a gutter before it
   * becomes a column boundary. Guards against a single ragged line inventing
   * a column for the whole document.
   */
  minAgreement?: number;
}

const DEFAULTS: Required<GridOptions> = {
  gapFactor: 1.6,
  clusterFactor: 1.5,
  minAgreement: 0.4,
};

function union(boxes: Box[]): Box {
  const left = Math.min(...boxes.map((box) => box.x));
  const top = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width));
  const bottom = Math.max(...boxes.map((box) => box.y + box.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * Merges the engine's output into visual rows: every word sitting at the same
 * height becomes one line, ordered left to right.
 *
 * Grouping happens at the *word* level, not the line level, because an
 * engine's line box is no help here — Windows OCR's column-shaped "line"
 * spans the full height of the table, so any comparison of line boxes finds
 * every column overlapping every other and merges the page into one row.
 * Word boxes are unambiguous: a word belongs to the row whose baseline it
 * sits on.
 *
 * Applied to every recognition (see `../main/ocr.ts`), not just to table
 * exports, because the raw order is wrong as *text* too — see the note at the
 * top of this file.
 *
 * The trade-off, stated plainly: a genuinely multi-column document (a
 * two-column article, say) has rows that span both columns, so its columns
 * get interleaved. That is the same ambiguity every OCR layout analyzer
 * faces, and for the images this extension is actually pointed at —
 * screenshots, receipts, forms, dialogs — merging is right far more often
 * than not. The result screen shows exactly what came out, so a bad call is
 * visible rather than silent.
 */
export function toVisualLines(lines: OcrLine[]): OcrLine[] {
  const rows = lines.filter((line) => line.text.trim().length > 0);
  if (rows.length < 2) return rows;
  // A line-only engine gives nothing to reason about; leave its order alone.
  if (rows.every((line) => line.words.length === 0)) return rows;

  const words = rows.flatMap((line) =>
    line.words.length
      ? line.words
      : // Keep a geometry-less line in the flow as a single unit rather than
        // dropping its text on the floor.
        [{ text: line.text, box: line.box, confidence: line.confidence }],
  );
  const heights = words
    .map((word) => word.box.height)
    .filter((height) => height > 0);
  if (heights.length === 0) return rows;
  const tolerance = median(heights) * 0.6;

  const centre = (word: OcrWord): number => word.box.y + word.box.height / 2;
  const sorted = [...words].sort((a, b) => centre(a) - centre(b));

  const groups: OcrWord[][] = [];
  let band = Number.NaN;
  for (const word of sorted) {
    if (groups.length && Math.abs(centre(word) - band) <= tolerance) {
      const group = groups[groups.length - 1];
      group.push(word);
      // Track the row's running mean, so a row of mixed type sizes drifts with
      // its own baseline instead of anchoring to whichever word came first.
      band = group.reduce((sum, item) => sum + centre(item), 0) / group.length;
    } else {
      groups.push([word]);
      band = centre(word);
    }
  }

  return groups.map((group) => {
    const ordered = [...group].sort((a, b) => a.box.x - b.box.x);
    const scores = ordered
      .map((word) => word.confidence)
      .filter((value): value is number => value != null);
    return {
      text: ordered.map((word) => word.text).join(" "),
      box: union(ordered.map((word) => word.box)),
      confidence: scores.length
        ? scores.reduce((sum, value) => sum + value, 0) / scores.length
        : null,
      words: ordered,
    };
  });
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Width of one character, averaged over the whole page. */
function medianCharWidth(lines: OcrLine[]): number {
  const widths: number[] = [];
  for (const line of lines) {
    for (const word of line.words) {
      const length = [...word.text].length;
      if (length > 0 && word.box.width > 0)
        widths.push(word.box.width / length);
    }
  }
  return median(widths);
}

/** A gutter candidate: where it sits, and which line proposed it. */
interface Gutter {
  x: number;
  line: number;
}

/** Gaps inside one line that are wide enough to be a column boundary. */
function guttersOf(
  words: OcrWord[],
  minGap: number,
  lineIndex: number,
): Gutter[] {
  const found: Gutter[] = [];
  // Reading order isn't guaranteed to be left-to-right across the whole line
  // on every engine, so sort by x before measuring the gaps between neighbours.
  const sorted = [...words].sort((a, b) => a.box.x - b.box.x);
  for (let i = 1; i < sorted.length; i++) {
    const left = sorted[i - 1].box;
    const right = sorted[i].box;
    const gap = right.x - (left.x + left.width);
    if (gap >= minGap) {
      found.push({ x: (left.x + left.width + right.x) / 2, line: lineIndex });
    }
  }
  return found;
}

/**
 * Groups gutters that sit at nearly the same x into column boundaries, keeping
 * only those enough *distinct* lines agreed on. Counting distinct lines (not
 * raw gutters) matters: one line with several wide gaps in a row must not be
 * able to carry a boundary on its own.
 */
function boundaries(
  gutters: Gutter[],
  tolerance: number,
  minLines: number,
): number[] {
  const sorted = [...gutters].sort((a, b) => a.x - b.x);
  const kept: number[] = [];

  let cluster: Gutter[] = [];
  const flush = (): void => {
    if (cluster.length === 0) return;
    const lines = new Set(cluster.map((g) => g.line));
    if (lines.size >= minLines) {
      kept.push(cluster.reduce((sum, g) => sum + g.x, 0) / cluster.length);
    }
    cluster = [];
  };

  for (const gutter of sorted) {
    if (
      cluster.length &&
      gutter.x - cluster[cluster.length - 1].x > tolerance
    ) {
      flush();
    }
    cluster.push(gutter);
  }
  flush();
  return kept;
}

/**
 * Reconstructs `lines` as a rectangular grid of cell text. Every row has the
 * same number of columns; cells with no words are empty strings.
 *
 * Falls back to a single column — one line per row — when the page has no
 * usable geometry (an engine that reports line text only) or when no gutter
 * recurs often enough to be a column, which is exactly what should happen for
 * ordinary prose.
 */
export function toGrid(
  lines: OcrLine[],
  options: GridOptions = {},
): string[][] {
  const { gapFactor, clusterFactor, minAgreement } = {
    ...DEFAULTS,
    ...options,
  };
  const rows = lines.filter((line) => line.text.trim().length > 0);
  if (rows.length === 0) return [];

  const charWidth = medianCharWidth(rows);
  if (charWidth <= 0) return rows.map((line) => [line.text]);

  const multiWord = rows.filter((line) => line.words.length > 1);
  const gutters = multiWord.flatMap((line, index) =>
    guttersOf(line.words, charWidth * gapFactor, index),
  );
  const columns = boundaries(
    gutters,
    charWidth * clusterFactor,
    Math.max(2, Math.ceil(multiWord.length * minAgreement)),
  );
  if (columns.length === 0) return rows.map((line) => [line.text]);

  return rows.map((line) => {
    const cells: string[][] = Array.from(
      { length: columns.length + 1 },
      () => [],
    );
    if (line.words.length === 0) {
      cells[0].push(line.text);
    } else {
      for (const word of [...line.words].sort((a, b) => a.box.x - b.box.x)) {
        const centre = word.box.x + word.box.width / 2;
        // The index of the first boundary the word sits left of — i.e. how
        // many boundaries it has already crossed.
        const column = columns.findIndex((edge) => centre < edge);
        cells[column === -1 ? columns.length : column].push(word.text);
      }
    }
    return cells.map((cell) => cell.join(" "));
  });
}

/**
 * Whether `lines` actually look tabular — used to default the export form's
 * "Reconstruct table" switch to something sensible instead of guessing. True
 * when the grid came back with more than one column and most rows fill at
 * least two of them.
 */
export function looksTabular(lines: OcrLine[], options?: GridOptions): boolean {
  const grid = toGrid(lines, options);
  if (grid.length < 2 || grid[0].length < 2) return false;
  const filled = grid.filter(
    (row) => row.filter((cell) => cell.trim().length > 0).length >= 2,
  );
  return filled.length >= grid.length * 0.6;
}
