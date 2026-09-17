/**
 * The Linux OCR backend — the `tesseract` binary, if the user has one.
 *
 * Linux has no system OCR service to call the way Windows and macOS do, and
 * bundling a WASM engine would add ~15 MB of model data to every platform's
 * installer for one platform's benefit. Tesseract is a one-line install on
 * every distro (`apt install tesseract-ocr`), so this backend shells out to it
 * and says exactly that when it isn't there.
 *
 * `--psm 4` ("a single column of text of variable sizes") keeps a receipt's
 * columns as separate words rather than letting Tesseract's own layout
 * analysis merge them, since column reconstruction is `../shared/table.ts`'s
 * job and it needs the word boxes intact.
 */
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { EngineInfo } from "../shared/types";
import type { NativeLine, NativePage, OcrEngine } from "./ocr.ts";

const run = promisify(execFile);

/** Long enough for a dense page on a slow machine, short enough to not hang the UI forever. */
const TIMEOUT_MS = 60_000;

/** Tesseract's TSV columns, in the order it writes them. */
const Column = {
  Level: 0,
  Block: 2,
  Paragraph: 3,
  Line: 4,
  Left: 6,
  Top: 7,
  Width: 8,
  Height: 9,
  Confidence: 10,
  Text: 11,
} as const;

/** The TSV `level` value marking a word row; the rest describe page/block/line boxes. */
const WORD_LEVEL = 5;

/**
 * Parses `tesseract … tsv` output into lines. Pure, so `./ocr-linux.test.ts`
 * can drive it without Tesseract installed.
 *
 * Words are grouped by their `(block, paragraph, line)` triple — Tesseract
 * emits them in reading order but numbers each line only within its
 * paragraph, so the triple (not `line` alone) is what identifies a line.
 * Rows with `conf` of -1, or with empty text, are Tesseract's own layout
 * placeholders and are dropped.
 */
export function parseTsv(tsv: string): NativeLine[] {
  const lines = new Map<string, NativeLine>();
  const order: string[] = [];

  for (const row of tsv.split(/\r?\n/)) {
    const columns = row.split("\t");
    if (columns.length <= Column.Text) continue;
    if (Number(columns[Column.Level]) !== WORD_LEVEL) continue;

    const text = columns.slice(Column.Text).join("\t").trim();
    const confidence = Number(columns[Column.Confidence]);
    if (!text || !Number.isFinite(confidence) || confidence < 0) continue;

    const key = `${columns[Column.Block]}:${columns[Column.Paragraph]}:${columns[Column.Line]}`;
    let line = lines.get(key);
    if (!line) {
      line = { text: "", confidence: null, words: [] };
      lines.set(key, line);
      order.push(key);
    }
    line.words.push({
      text,
      x: Number(columns[Column.Left]),
      y: Number(columns[Column.Top]),
      width: Number(columns[Column.Width]),
      height: Number(columns[Column.Height]),
      confidence: confidence / 100,
    });
  }

  return order.map((key) => {
    const line = lines.get(key)!;
    return { ...line, text: line.words.map((word) => word.text).join(" ") };
  });
}

/** `"List of available languages ...\neng\nkhm\n"` → `["eng", "khm"]`. */
export function parseLanguages(output: string): string[] {
  return (
    output
      .split(/\r?\n/)
      .map((line) => line.trim())
      // The first line is a header sentence; real codes are bare words.
      .filter((line) => /^[a-z_]{3,}$/i.test(line) && line !== "osd")
  );
}

let cached: EngineInfo | null = null;

async function info(): Promise<EngineInfo> {
  if (cached) return cached;
  const base = { id: "tesseract" as const, name: "Tesseract" };
  try {
    const { stdout } = await run("tesseract", ["--list-langs"], {
      timeout: 10_000,
    });
    const codes = parseLanguages(stdout);
    cached = {
      ...base,
      available: codes.length > 0,
      reason: codes.length
        ? undefined
        : "Tesseract is installed but has no language data. Install one, e.g. `apt install tesseract-ocr-eng`.",
      languages: codes.map((code) => ({ tag: code, name: code })),
    };
    return cached;
  } catch {
    return {
      ...base,
      available: false,
      reason:
        "Tesseract isn't installed. Install it to read text from images — e.g. `sudo apt install tesseract-ocr`.",
      languages: [],
    };
  }
}

async function recognizePage(
  png: Buffer,
  language?: string,
): Promise<NativePage> {
  const dir = await mkdtemp(join(tmpdir(), "magibar-ocr-"));
  try {
    const input = join(dir, "input.png");
    await writeFile(input, png);
    const args = [input, "stdout", "--psm", "4", "tsv"];
    if (language) args.push("-l", language);
    const { stdout } = await run("tesseract", args, {
      timeout: TIMEOUT_MS,
      maxBuffer: 32 * 1024 * 1024,
    });
    return { language: language ?? "eng", lines: parseTsv(stdout) };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export const linuxEngine: OcrEngine = {
  info,
  recognize: recognizePage,
};
