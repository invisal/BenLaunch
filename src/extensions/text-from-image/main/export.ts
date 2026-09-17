/**
 * Turning a recognition into a file: the one place that maps an
 * `ExportFormat` onto a writer, so every format goes through the same options,
 * the same path handling, and the same error reporting.
 *
 * Text, JSON and CSV are serialized by `../shared/format.ts` — the same code
 * the result screen previews with, so what you see on screen is what lands in
 * the file. Excel goes through `./xlsx.ts`, PDF through `./pdf.ts`.
 */
import { writeFile } from "node:fs/promises";
import {
  absoluteTime,
  formatConfidence,
  toCsv,
  toJsonDocument,
  toPlainText,
  toTableRows,
} from "../shared/format.ts";
import type { ExportOptions, Recognition } from "../shared/types";
import { writePdf } from "./pdf.ts";
import { buildXlsx } from "./xlsx.ts";

/** The second sheet of an Excel export: what was recognized, and how. */
function detailRows(recognition: Recognition): string[][] {
  const { source } = recognition;
  return [
    ["Field", "Value"],
    [
      "Source",
      source.kind === "file"
        ? source.path
        : source.kind === "drop"
          ? source.name
          : "Clipboard",
    ],
    ["Recognized", absoluteTime(recognition.createdAt)],
    ["Engine", recognition.engine],
    ["Language", recognition.language],
    [
      "Image size",
      `${recognition.imageSize.width} × ${recognition.imageSize.height}`,
    ],
    ["Lines", String(recognition.lines.length)],
    [
      "Words",
      String(
        recognition.lines.reduce((sum, line) => sum + line.words.length, 0),
      ),
    ],
    ["Confidence", formatConfidence(recognition.confidence)],
    ["Duration", `${recognition.durationMs} ms`],
  ];
}

/**
 * The text a `txt`/`json`/`csv` export writes — also what the ⌘K "Copy as…"
 * actions put on the clipboard, which is why it's separate from writing the
 * file.
 */
export function serialize(
  recognition: Recognition,
  options: Pick<ExportOptions, "format" | "table" | "includeConfidence">,
): string {
  switch (options.format) {
    case "txt":
      return toPlainText(recognition.lines);
    case "json":
      return `${JSON.stringify(
        toJsonDocument(recognition, {
          table: options.table,
          includeConfidence: options.includeConfidence,
        }),
        null,
        2,
      )}\n`;
    case "csv":
      return toCsv(
        toTableRows(recognition.lines, {
          includeConfidence: options.includeConfidence,
        }),
      );
    default:
      throw new Error(`${options.format} is not a text format.`);
  }
}

/**
 * Writes `recognition` to `options.path`. Throws on a filesystem or rendering
 * failure; the caller (`../ipc/handlers.ts`) turns that into an
 * `ExportResult` the screen can show rather than an IPC rejection.
 */
export async function exportRecognition(
  recognition: Recognition,
  options: ExportOptions,
): Promise<void> {
  switch (options.format) {
    case "txt":
    case "json":
    case "csv":
      // A BOM would make the file's first line unusable for every consumer but
      // Excel, and Excel gets a real workbook here — so, none.
      await writeFile(options.path, serialize(recognition, options), "utf8");
      return;
    case "xlsx":
      await writeFile(
        options.path,
        buildXlsx([
          {
            name: "Recognized Text",
            rows: toTableRows(recognition.lines, {
              includeConfidence: options.includeConfidence,
            }),
          },
          { name: "Details", rows: detailRows(recognition), headerRow: true },
        ]),
      );
      return;
    case "pdf":
      await writePdf(recognition, options, options.path);
      return;
  }
}
