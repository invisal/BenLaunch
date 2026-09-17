/**
 * Text from Image's wire contract — the DTOs, route names and IPC channel
 * names shared by the extension's main handlers (`../ipc/handlers.ts`), its
 * preload fragment (`../ipc/preload.ts`) and its renderer screens
 * (`../renderer/`).
 *
 * Everything here is plain data that survives `structuredClone` across the
 * IPC boundary, and everything under `../shared/` is imported by the renderer
 * bundle too (see `tsconfig.web.json`), so this file — and its siblings —
 * must stay free of `node:` imports.
 */

/** A rectangle in *source image pixels*, origin top-left. */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One recognized word, with the box the engine reported for it. */
export interface OcrWord {
  text: string;
  box: Box;
  /** 0–1, or `null` where the engine reports none (Windows OCR doesn't). */
  confidence: number | null;
}

/** One recognized line of text, in reading order. */
export interface OcrLine {
  text: string;
  /** Union of the line's word boxes. */
  box: Box;
  confidence: number | null;
  /** Empty when the engine reports line text without word geometry — the
   *  table reconstruction in `./table.ts` falls back to whole-line cells. */
  words: OcrWord[];
}

/** Which OCR backend produced a recognition. */
export type EngineId = "windows" | "apple" | "tesseract";

/** What the recognize screen shows about the backend it would use. */
export interface EngineInfo {
  id: EngineId;
  /** Display name, e.g. "Windows OCR". */
  name: string;
  /** False when the native addon or `tesseract` binary isn't available. */
  available: boolean;
  /** Why it isn't available — shown verbatim in the UI. */
  reason?: string;
  /** BCP-47 tags the engine can recognize, best-first. */
  languages: OcrLanguage[];
}

export interface OcrLanguage {
  /** BCP-47 tag, e.g. `en-US`, or a Tesseract code, e.g. `eng`. */
  tag: string;
  /** Human-readable name, e.g. "English (United States)". */
  name: string;
}

/** Where an image came from. */
export type ImageSource =
  | { kind: "file"; path: string }
  | { kind: "clipboard" }
  | { kind: "drop"; name: string };

/** One completed recognition, persisted in the extension's document. */
export interface Recognition {
  id: string;
  /** Epoch ms the image was recognized. */
  createdAt: number;
  source: ImageSource;
  /** Downsized PNG data URL, for the row icon and the detail preview. */
  thumbnailDataUrl: string;
  /** The *source* image's dimensions, before downsizing for the thumbnail. */
  imageSize: { width: number; height: number };
  engine: EngineId;
  /** The BCP-47 tag actually used, as the engine reported it. */
  language: string;
  lines: OcrLine[];
  /** Mean of the word confidences the engine reported, or `null` when it
   *  reports none. */
  confidence: number | null;
  /** Row label: the first non-empty line, whitespace-collapsed and truncated. */
  preview: string;
  /** How long the engine took, in ms — shown in the detail pane. */
  durationMs: number;
  pinned: boolean;
}

/** What `recognize` is pointed at. `"file"` opens a picker in main. */
export type RecognizeRequest =
  | { kind: "clipboard" }
  | { kind: "file" }
  | { kind: "path"; path: string }
  /** A file the user dropped on the window — bytes, since the renderer's
   *  `File` object can't cross IPC and its `path` is not always readable. */
  | { kind: "bytes"; name: string; data: Uint8Array };

/** `recognize` either produces a `Recognition` or explains why it didn't. */
export type RecognizeResult =
  | { ok: true; recognition: Recognition }
  | { ok: false; cancelled?: false; error: string }
  /** The user dismissed the file picker — not an error, so the UI says nothing. */
  | { ok: false; cancelled: true; error?: undefined };

/* -------------------------------- export -------------------------------- */

/** The file formats a recognition can be converted to. */
export type ExportFormat = "txt" | "json" | "csv" | "xlsx" | "pdf";

/** The subset that is plain text, and so can go on the clipboard as well as to a file. */
export type TextExportFormat = Extract<ExportFormat, "txt" | "json" | "csv">;

export const EXPORT_FORMATS: {
  id: ExportFormat;
  label: string;
  extension: string;
  /** One line of "what you get", shown under the format picker. */
  description: string;
}[] = [
  {
    id: "txt",
    label: "Plain Text",
    extension: "txt",
    description: "One line per recognized line, in reading order.",
  },
  {
    id: "json",
    label: "JSON",
    extension: "json",
    description:
      "Lines, words, blocks and boxes, plus the recognition's metadata.",
  },
  {
    id: "csv",
    label: "CSV",
    extension: "csv",
    description: "Comma-separated rows — the table layout, as plain text.",
  },
  {
    id: "xlsx",
    label: "Excel",
    extension: "xlsx",
    description:
      "An .xlsx workbook: the table on one sheet, details on another.",
  },
  {
    id: "pdf",
    label: "PDF",
    extension: "pdf",
    description: "A typeset document with the source image and the text.",
  },
];

/**
 * Formats whose output has columns and nowhere else to put them, so the table
 * reconstruction is always on and the export form's switch is disabled.
 */
export const ALWAYS_TABULAR: ExportFormat[] = ["csv", "xlsx"];

/** Formats that write bytes rather than text, and so have no text preview. */
export const BINARY_FORMATS: ExportFormat[] = ["xlsx", "pdf"];

/** The knobs the export screen exposes. */
export interface ExportOptions {
  format: ExportFormat;
  /**
   * Reconstruct a column grid from the word boxes (see `./table.ts`) instead
   * of emitting one flat line per row. Always on for `csv`/`xlsx`, which have
   * nowhere else to put columns; optional for `json`/`pdf`; ignored for `txt`.
   */
  table: boolean;
  /** Carry per-line confidence into the output (JSON field / extra column). */
  includeConfidence: boolean;
  /** Absolute destination path. */
  path: string;
}

export type ExportResult =
  | { ok: true; path: string }
  | { ok: false; cancelled?: false; error: string }
  /** The user dismissed the Save panel — not an error, so the UI says nothing. */
  | { ok: false; cancelled: true; error?: undefined };

/* -------------------------------- routes -------------------------------- */

/** The library / recognize screen (`../screen.tsx`). */
export const TEXT_FROM_IMAGE_ROUTE = "text-from-image";
/** The per-recognition result screen; payload is the recognition's id. */
export const TEXT_FROM_IMAGE_RESULT_ROUTE = "text-from-image:result";
/** The export form; payload is the recognition's id. */
export const TEXT_FROM_IMAGE_EXPORT_ROUTE = "text-from-image:export";

export const TEXT_FROM_IMAGE_CHANNELS = {
  engine: "text-from-image:engine",
  list: "text-from-image:list",
  get: "text-from-image:get",
  recognize: "text-from-image:recognize",
  delete: "text-from-image:delete",
  clear: "text-from-image:clear",
  setPinned: "text-from-image:set-pinned",
  copyText: "text-from-image:copy-text",
  suggestPath: "text-from-image:suggest-path",
  chooseExportPath: "text-from-image:choose-export-path",
  exportAs: "text-from-image:export-as",
  revealExport: "text-from-image:reveal-export",
} as const;
