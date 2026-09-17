/**
 * The OCR engine layer: one interface, one backend per platform, and the
 * normalization that turns whatever a backend reports into the `OcrLine[]`
 * the rest of the extension works with.
 *
 * Recognition itself is delegated to whatever the OS already ships, rather
 * than bundling a WASM engine:
 *
 *  - **Windows** — `Windows.Media.Ocr`, via `@magibar/win` (`./ocr-win.ts`).
 *  - **macOS** — Vision's `VNRecognizeTextRequest`, via `@magibar/mac`
 *    (`./ocr-mac.ts`).
 *  - **Linux** — the `tesseract` binary, if the user has it (`./ocr-linux.ts`).
 *
 * Every backend is optional and every one of them can be absent at runtime, so
 * `engineInfo()` reports what's actually available and the UI says so plainly
 * instead of failing at the moment the user hits Enter.
 *
 * Every backend reports *word* geometry, which is what the layout
 * reconstruction in `../shared/table.ts` needs. Normalizing that is this
 * module's other job: a line's own box is the union of its words' boxes, and
 * the engine's lines are re-flowed into visual rows (`toVisualLines`) before
 * anything downstream sees them — without which a wide table comes back
 * column-by-column rather than row-by-row. See that function for why, and for
 * what it costs.
 */
import { toVisualLines } from "../shared/table.ts";
import type { Box, EngineInfo, OcrLine, OcrWord } from "../shared/types";
import { linuxEngine } from "./ocr-linux.ts";
import { macEngine } from "./ocr-mac.ts";
import { windowsEngine } from "./ocr-win.ts";

/** One word as a backend reports it, in source-image pixels. */
export interface NativeWord {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** 0–1. Absent where the engine reports none — Windows OCR doesn't. */
  confidence?: number | null;
}

export interface NativeLine {
  text: string;
  confidence?: number | null;
  words: NativeWord[];
}

export interface NativePage {
  /** The tag the engine actually recognized with, which may differ from the request. */
  language: string;
  lines: NativeLine[];
}

export interface OcrEngine {
  /** Reported to the UI; also stored on each recognition. */
  readonly info: () => Promise<EngineInfo>;
  /** Recognize `png`. `language` is a tag from `info().languages`, or undefined for the default. */
  readonly recognize: (png: Buffer, language?: string) => Promise<NativePage>;
}

/** The backend for this platform, or `null` where none exists at all. */
function backend(): OcrEngine | null {
  switch (process.platform) {
    case "win32":
      return windowsEngine;
    case "darwin":
      return macEngine;
    case "linux":
      return linuxEngine;
    default:
      return null;
  }
}

/** What the recognize screen shows, including *why* OCR is unavailable when it is. */
export async function engineInfo(): Promise<EngineInfo> {
  const engine = backend();
  if (!engine) {
    return {
      id: "tesseract",
      name: "OCR",
      available: false,
      reason: `Text recognition isn't supported on ${process.platform}.`,
      languages: [],
    };
  }
  return engine.info();
}

function union(boxes: Box[]): Box {
  if (boxes.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  const left = Math.min(...boxes.map((b) => b.x));
  const top = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.width));
  const bottom = Math.max(...boxes.map((b) => b.y + b.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function mean(values: number[]): number | null {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
}

/** A backend's page, in the shape the store and the exporters consume. */
export function normalize(page: NativePage): {
  lines: OcrLine[];
  language: string;
  confidence: number | null;
} {
  const raw: OcrLine[] = page.lines.map((line) => {
    const words: OcrWord[] = line.words.map((word) => ({
      text: word.text,
      box: {
        x: word.x,
        y: word.y,
        width: word.width,
        height: word.height,
      },
      confidence: word.confidence ?? null,
    }));
    const scores = words
      .map((word) => word.confidence)
      .filter((value): value is number => value != null);
    return {
      text: line.text,
      box: union(words.map((word) => word.box)),
      // Prefer the engine's own line score; fall back to averaging its words'.
      confidence: line.confidence ?? mean(scores),
      words,
    };
  });

  const lines = toVisualLines(raw);
  const scores = lines
    .map((line) => line.confidence)
    .filter((value): value is number => value != null);

  return { lines, language: page.language, confidence: mean(scores) };
}

/**
 * Recognize `png`, or throw with a message worth showing the user. The caller
 * (`../index.ts`) turns that into a `RecognizeResult` rather than letting it
 * escape to the renderer as an IPC rejection.
 */
export async function recognize(
  png: Buffer,
  language?: string,
): Promise<{ lines: OcrLine[]; language: string; confidence: number | null }> {
  const engine = backend();
  if (!engine) {
    throw new Error(`Text recognition isn't supported on ${process.platform}.`);
  }
  const info = await engine.info();
  if (!info.available) {
    throw new Error(info.reason ?? `${info.name} is unavailable.`);
  }
  return normalize(await engine.recognize(png, language));
}
