/**
 * Presentation and serialization helpers shared by the main-process exporters
 * (`../main/export.ts`) and the renderer screens — so the text the result
 * screen shows you is produced by the same code that writes the file, and the
 * two can never drift.
 *
 * Pure and Electron-free: `node --test` drives it directly
 * (`./format.test.ts`), and the renderer imports it unchanged.
 */
import { toGrid, type GridOptions } from "./table.ts";
import type { ExportFormat, OcrLine, Recognition } from "./types";

/** Longest row label before it's cut short with an ellipsis. */
const PREVIEW_LENGTH = 90;

/** Collapses runs of whitespace (including newlines) to single spaces. */
export function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Row label for a recognition: its first real line, shortened. */
export function makePreview(lines: OcrLine[]): string {
  const first = lines.map((line) => collapse(line.text)).find(Boolean) ?? "";
  if (!first) return "No text found";
  return first.length > PREVIEW_LENGTH
    ? `${first.slice(0, PREVIEW_LENGTH - 1)}…`
    : first;
}

/**
 * Paragraph grouping: engines report lines, never paragraphs, so a blank line
 * between paragraphs has to be inferred from the vertical gaps. This is what
 * gives the JSON export its `blocks` array and the PDF its paragraph breaks.
 *
 * A gap is compared against the *page's own median gap* rather than against
 * the text's height. Height is the wrong yardstick because an OCR box measures
 * ink, not the line box: a capital-free line is visibly shorter than one with
 * ascenders, so ordinary single-spaced rows routinely sit more than a
 * "line-height" apart and every one of them would read as a paragraph break.
 * The median gap is the document's actual line spacing, whatever its font and
 * resolution, so a break is simply a gap well clear of it.
 */
export function toBlocks(lines: OcrLine[]): OcrLine[][] {
  const rows = lines.filter((line) => line.text.trim().length > 0);
  if (rows.length === 0) return [];
  // No geometry at all (a line-only engine) — one block, as good a guess as any.
  if (rows.every((line) => line.box.height <= 0)) return [rows];

  const gapBefore = (index: number): number =>
    rows[index].box.y - (rows[index - 1].box.y + rows[index - 1].box.height);
  const gaps = rows.slice(1).map((_, index) => gapBefore(index + 1));
  if (gaps.length === 0) return [rows];

  // A true median, averaging the middle pair on an even count — with only two
  // gaps to go on, taking the upper one would set the bar above the very gap
  // that is meant to clear it.
  const sorted = [...gaps].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  const typical =
    sorted.length % 2
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2;
  const threshold = typical * 1.6;

  const blocks: OcrLine[][] = [[rows[0]]];
  for (let i = 1; i < rows.length; i++) {
    if (gapBefore(i) > threshold) blocks.push([rows[i]]);
    else blocks[blocks.length - 1].push(rows[i]);
  }
  return blocks;
}

/** The recognized text as it reads on the page — blocks separated by a blank line. */
export function toPlainText(lines: OcrLine[]): string {
  return toBlocks(lines)
    .map((block) => block.map((line) => line.text).join("\n"))
    .join("\n\n");
}

/** One RFC 4180 field: quoted only when it has to be. */
function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** A grid as CSV, CRLF-terminated the way the spec (and Excel) expect. */
export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(csvField).join(",")).join("\r\n");
}

/**
 * The rows the tabular exporters (CSV, Excel, and the PDF in table mode)
 * write: the reconstructed grid, optionally with a trailing confidence
 * column. Line confidences are matched to grid rows by position — `toGrid`
 * drops blank lines in the same order, so the two stay aligned.
 */
export function toTableRows(
  lines: OcrLine[],
  {
    includeConfidence = false,
    grid,
  }: { includeConfidence?: boolean; grid?: GridOptions } = {},
): string[][] {
  const rows = toGrid(lines, grid);
  if (!includeConfidence) return rows;
  const scored = lines.filter((line) => line.text.trim().length > 0);
  return rows.map((row, index) => [
    ...row,
    formatConfidence(scored[index]?.confidence ?? null),
  ]);
}

/** `0.9312` → `"93%"`; `null` → `"—"` (engines that report no confidence). */
export function formatConfidence(value: number | null): string {
  return value == null ? "—" : `${Math.round(value * 100)}%`;
}

/** The JSON document the `json` export writes — also what "Copy as JSON" puts on the clipboard. */
export function toJsonDocument(
  recognition: Recognition,
  options: { table: boolean; includeConfidence: boolean; grid?: GridOptions },
): unknown {
  const { lines } = recognition;
  return {
    source:
      recognition.source.kind === "file"
        ? { kind: "file", path: recognition.source.path }
        : recognition.source.kind === "drop"
          ? { kind: "drop", name: recognition.source.name }
          : { kind: "clipboard" },
    recognizedAt: new Date(recognition.createdAt).toISOString(),
    engine: recognition.engine,
    language: recognition.language,
    imageSize: recognition.imageSize,
    durationMs: recognition.durationMs,
    ...(options.includeConfidence
      ? { confidence: recognition.confidence }
      : {}),
    text: toPlainText(lines),
    blocks: toBlocks(lines).map((block) => ({
      text: block.map((line) => line.text).join("\n"),
      lines: block.map((line) => line.text),
    })),
    lines: lines.map((line) => ({
      text: line.text,
      box: line.box,
      ...(options.includeConfidence ? { confidence: line.confidence } : {}),
      words: line.words.map((word) => ({
        text: word.text,
        box: word.box,
        ...(options.includeConfidence ? { confidence: word.confidence } : {}),
      })),
    })),
    ...(options.table
      ? {
          table: toTableRows(lines, {
            includeConfidence: options.includeConfidence,
            grid: options.grid,
          }),
        }
      : {}),
  };
}

/** `2 file names` → `2-file-names`; empty input falls back to `"scan"`. */
function slug(text: string): string {
  const cleaned = collapse(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  return cleaned || "scan";
}

/**
 * A default filename for an export: the source file's own basename where
 * there is one, otherwise a slug of the recognized text, plus the format's
 * extension. Keeps "Read a screenshot, export to Excel" from landing on
 * `untitled.xlsx`.
 */
export function suggestFilename(
  recognition: Recognition,
  format: ExportFormat,
  extension: string,
): string {
  const { source } = recognition;
  const base =
    source.kind === "file"
      ? (source.path.split(/[\\/]/).pop() ?? "").replace(/\.[^.]+$/, "")
      : source.kind === "drop"
        ? source.name.replace(/\.[^.]+$/, "")
        : "";
  return `${base ? slug(base) : slug(recognition.preview)}.${extension}`;
}

/** `1536` → `"1.5 KB"`. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

/** `Sep 17, 2026 at 18:25` — the detail pane's "Recognized" row. */
export function absoluteTime(epochMs: number): string {
  const date = new Date(epochMs);
  const day = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const time = date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${day} at ${time}`;
}

/** Section heading for the library list: `"Today"`, `"Yesterday"`, or a date. */
export function groupLabel(epochMs: number, now: number): string {
  const startOfDay = (ms: number): number => {
    const date = new Date(ms);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  };
  const days = Math.round((startOfDay(now) - startOfDay(epochMs)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "Previous 7 Days";
  if (days < 30) return "Previous 30 Days";
  return new Date(epochMs).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}
