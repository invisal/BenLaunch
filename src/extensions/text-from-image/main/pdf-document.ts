/**
 * The PDF export's *document* — the HTML that `./pdf.ts` prints.
 *
 * Kept apart from the printing itself so it imports nothing from Electron and
 * `node --test` can check its escaping and structure directly
 * (`./pdf-document.test.ts`) without spawning a window.
 */
import {
  absoluteTime,
  formatConfidence,
  toBlocks,
  toTableRows,
} from "../shared/format.ts";
import type { ExportOptions, Recognition } from "../shared/types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** The document's title line: the source file's name, or a neutral fallback. */
function titleOf(recognition: Recognition): string {
  const { source } = recognition;
  if (source.kind === "file")
    return source.path.split(/[\\/]/).pop() ?? "Recognized text";
  if (source.kind === "drop") return source.name;
  return "Recognized text";
}

/**
 * The printable document. Deliberately plain — a title, a metadata line, the
 * source image, then the text — because the point of the export is the text,
 * and a PDF that tries to imitate the screenshot's own layout would only ever
 * be an inferior copy of the screenshot.
 */
export function buildHtml(
  recognition: Recognition,
  options: Pick<ExportOptions, "table" | "includeConfidence">,
): string {
  const meta = [
    absoluteTime(recognition.createdAt),
    recognition.language,
    `${recognition.imageSize.width}×${recognition.imageSize.height}`,
    ...(options.includeConfidence && recognition.confidence != null
      ? [`${formatConfidence(recognition.confidence)} confidence`]
      : []),
  ];

  const body = options.table
    ? `<table>${toTableRows(recognition.lines, {
        includeConfidence: options.includeConfidence,
      })
        .map(
          (row) =>
            `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`,
        )
        .join("")}</table>`
    : toBlocks(recognition.lines)
        .map(
          (block) =>
            `<p>${block.map((line) => escapeHtml(line.text)).join("<br>")}</p>`,
        )
        .join("");

  return `<!doctype html>
<html lang="${escapeHtml(recognition.language)}">
<head>
<meta charset="utf-8">
<title>${escapeHtml(titleOf(recognition))}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font: 11pt/1.55 -apple-system, "Segoe UI", system-ui, sans-serif;
    color: #16181d;
  }
  header { border-bottom: 1px solid #d8dae0; padding-bottom: 10px; margin-bottom: 18px; }
  h1 { font-size: 15pt; font-weight: 600; margin: 0 0 4px; }
  .meta { font-size: 8.5pt; color: #6b7280; }
  .meta span + span::before { content: " · "; }
  figure { margin: 0 0 18px; text-align: center; page-break-inside: avoid; }
  figure img { max-width: 100%; max-height: 3.2in; border: 1px solid #e3e5ea; border-radius: 4px; }
  p { margin: 0 0 10pt; orphans: 2; widows: 2; }
  table { border-collapse: collapse; width: 100%; font-size: 10pt; }
  td { border: 1px solid #d8dae0; padding: 4pt 6pt; vertical-align: top; }
  tr:first-child td { background: #f4f5f7; font-weight: 600; }
  tr { page-break-inside: avoid; }
</style>
</head>
<body>
<header>
  <h1>${escapeHtml(titleOf(recognition))}</h1>
  <div class="meta">${meta.map((part) => `<span>${escapeHtml(part)}</span>`).join("")}</div>
</header>
<figure><img src="${recognition.thumbnailDataUrl}" alt=""></figure>
${body}
</body>
</html>`;
}
