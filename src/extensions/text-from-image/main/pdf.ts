/**
 * Prints a recognition to a PDF file.
 *
 * Electron already ships a full typesetting engine — Chromium — so the
 * document (`./pdf-document.ts`) is HTML, printed with
 * `webContents.printToPDF`, rather than PDF operators emitted by hand. That
 * matters for more than convenience: a hand-rolled PDF would be stuck with the
 * base-14 fonts and WinAnsi encoding, which cannot represent Khmer, Thai,
 * Chinese or any other script the OCR engines happily recognize. Chromium
 * shapes and embeds whatever the system has.
 */
import { BrowserWindow } from "electron";
import { writeFile } from "node:fs/promises";
import { buildHtml } from "./pdf-document.ts";
import type { ExportOptions, Recognition } from "../shared/types";

/**
 * Renders `recognition` to a PDF at `path`.
 *
 * The window never appears, and `sandbox: true` with no preload and scripting
 * disabled keeps the printed page from reaching anything — it is a document,
 * not part of the app. It is always destroyed, including when printing throws.
 */
export async function writePdf(
  recognition: Recognition,
  options: Pick<ExportOptions, "table" | "includeConfidence">,
  path: string,
): Promise<void> {
  const window = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, javascript: false },
  });
  try {
    await window.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(buildHtml(recognition, options))}`,
    );
    const pdf = await window.webContents.printToPDF({
      pageSize: "A4",
      printBackground: true,
      // Inches.
      margins: { top: 0.6, bottom: 0.6, left: 0.6, right: 0.6 },
    });
    await writeFile(path, pdf);
  } finally {
    window.destroy();
  }
}
