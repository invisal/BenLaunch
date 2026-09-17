/**
 * The Windows OCR backend — `Windows.Media.Ocr`, reached through
 * `@magibar/win`'s `recognizePng()` / `ocrLanguages()` (see
 * `native/win/src/lib.rs` for what those do and why they run off the JS
 * thread).
 *
 * `Windows.Media.Ocr` is the same engine Windows' own Snipping Tool text
 * actions use: on-device, free, no network, and already localized for whatever
 * language packs the user has installed. It reports word text and a bounding
 * rect but no confidence at all, hence the `null`s below — `formatConfidence`
 * renders those as an em dash rather than inventing a number.
 *
 * `@magibar/win` is an optionalDependency that only installs on win32, so it
 * can't be a static import — same `createRequire` lazy-load the rest of this
 * codebase uses for it (e.g. `@extensions/clipboard-history/main/pasteboard-change-win.ts`).
 */
import { createRequire } from "node:module";
import type { EngineInfo } from "../shared/types";
import type { NativePage, OcrEngine } from "./ocr.ts";

type NativeWin = typeof import("@magibar/win");
const nodeRequire = createRequire(import.meta.url);
let native: NativeWin | null | undefined;
let loadError = "";

function loadNative(): NativeWin | null {
  if (native !== undefined) return native;
  if (process.platform !== "win32") return (native = null);
  try {
    native = nodeRequire("@magibar/win") as NativeWin;
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error);
    console.error("[text-from-image] Failed to load @magibar/win:", error);
    native = null;
  }
  return native;
}

let cached: EngineInfo | null = null;

async function info(): Promise<EngineInfo> {
  if (cached) return cached;
  const win = loadNative();
  const base = { id: "windows" as const, name: "Windows OCR" };

  if (!win || typeof win.ocrLanguages !== "function") {
    // Either the addon didn't install/build, or it predates OCR support —
    // both mean "rebuild native/win", so say that rather than a bare failure.
    return {
      ...base,
      available: false,
      reason: loadError
        ? `The native Windows module failed to load (${loadError}). Rebuild it with \`npm run build:native:win\`.`
        : "This build of the native Windows module has no OCR support. Rebuild it with `npm run build:native:win`.",
      languages: [],
    };
  }

  try {
    const languages = win.ocrLanguages();
    if (languages.length === 0) {
      return {
        ...base,
        available: false,
        // Windows only exposes recognizers for installed language packs.
        reason:
          "No OCR language is installed. Add one under Settings → Time & language → Language & region → Add a language, including its “Optical character recognition” feature.",
        languages: [],
      };
    }
    cached = {
      ...base,
      available: true,
      languages: languages.map((language) => ({
        tag: language.tag,
        name: language.name,
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
  const win = loadNative();
  if (!win) throw new Error("The native Windows module is unavailable.");
  const page = await win.recognizePng(png, language);
  return {
    language: page.language,
    lines: page.lines.map((line) => ({
      text: line.text,
      // Windows OCR reports no confidence, for a line or a word.
      confidence: null,
      words: line.words.map((word) => ({
        text: word.text,
        x: word.x,
        y: word.y,
        width: word.width,
        height: word.height,
        confidence: null,
      })),
    })),
  };
}

export const windowsEngine: OcrEngine = {
  info,
  recognize: recognizePage,
};
