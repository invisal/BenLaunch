/**
 * The macOS OCR backend — Vision's `VNRecognizeTextRequest`, reached through
 * `@magibar/mac`'s `recognizePng()` / `ocrLanguages()` (see
 * `native/mac/src/lib.rs`).
 *
 * Vision is on-device, needs no permission prompt, and is the same recognizer
 * behind Live Text. Unlike Windows OCR it does report a confidence per
 * recognized candidate, so those come through as real numbers.
 *
 * `@magibar/mac` is an optionalDependency that only installs on darwin, so it
 * is lazily `createRequire`d rather than statically imported — the same shape
 * as `./ocr-win.ts`.
 */
import { createRequire } from "node:module";
import type { EngineInfo } from "../shared/types";
import type { NativePage, OcrEngine } from "./ocr.ts";

type NativeMac = typeof import("@magibar/mac");
const nodeRequire = createRequire(import.meta.url);
let native: NativeMac | null | undefined;
let loadError = "";

function loadNative(): NativeMac | null {
  if (native !== undefined) return native;
  if (process.platform !== "darwin") return (native = null);
  try {
    native = nodeRequire("@magibar/mac") as NativeMac;
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error);
    console.error("[text-from-image] Failed to load @magibar/mac:", error);
    native = null;
  }
  return native;
}

let cached: EngineInfo | null = null;

async function info(): Promise<EngineInfo> {
  if (cached) return cached;
  const mac = loadNative();
  const base = { id: "apple" as const, name: "Apple Vision" };

  if (!mac || typeof mac.ocrLanguages !== "function") {
    return {
      ...base,
      available: false,
      reason: loadError
        ? `The native macOS module failed to load (${loadError}). Rebuild it with \`npm run build:native:mac\`.`
        : "This build of the native macOS module has no OCR support. Rebuild it with `npm run build:native:mac`.",
      languages: [],
    };
  }

  try {
    const languages = mac.ocrLanguages();
    cached = {
      ...base,
      available: languages.length > 0,
      reason: languages.length
        ? undefined
        : "Vision reported no text-recognition languages on this system.",
      // Vision reports bare tags ("en-US"); name them with the OS's own
      // display names rather than shipping a lookup table.
      languages: languages.map((tag) => ({
        tag,
        name: new Intl.DisplayNames([tag], { type: "language" }).of(tag) ?? tag,
      })),
    };
    return cached;
  } catch (error) {
    return {
      ...base,
      available: false,
      reason: error instanceof Error ? error.message : String(error),
      languages: [],
    };
  }
}

async function recognizePage(
  png: Buffer,
  language?: string,
): Promise<NativePage> {
  const mac = loadNative();
  if (!mac) throw new Error("The native macOS module is unavailable.");
  const page = await mac.recognizePng(png, language);
  return {
    language: page.language,
    lines: page.lines.map((line) => ({
      text: line.text,
      confidence: line.confidence ?? null,
      words: line.words.map((word) => ({
        text: word.text,
        x: word.x,
        y: word.y,
        width: word.width,
        height: word.height,
        // Vision scores a whole recognized candidate, not each word in it.
        confidence: line.confidence ?? null,
      })),
    })),
  };
}

export const macEngine: OcrEngine = {
  info,
  recognize: recognizePage,
};
