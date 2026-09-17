/**
 * Reads the first sheet of an `.xlsx` workbook into a small grid, for the
 * quicklink detail pane's preview.
 *
 * Why this exists rather than "just use the OS thumbnail": Windows only has a
 * thumbnail for a workbook whose author happened to save one (Excel writes it
 * only when "Save Thumbnail" is ticked), and macOS/Linux mostly don't either.
 * A spreadsheet quicklink would then be the one named file type that never
 * previews — so the first few rows are read here instead. Twenty lines of ZIP
 * offsets and a tolerant XML scan, versus a dependency that can parse
 * everything: a preview only needs the top-left corner of one sheet.
 *
 * Deliberately Electron-free (`node --test` imports it directly) and strictly
 * fail-soft: every malformed-file path returns `null`, and the caller falls
 * back to the thumbnail or the file card.
 *
 * Not handled, on purpose: encrypted workbooks, ZIP64 (a >4GB workbook), and
 * number formats — a date cell previews as the serial number Excel stores,
 * because resolving it means walking `styles.xml` for a format code the
 * preview can't act on anyway.
 */
import { readFile } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";

/** Don't read a workbook bigger than this into memory for a preview. */
const MAX_FILE_BYTES = 32 * 1024 * 1024;
/** …nor inflate a single entry bigger than this (a zip bomb's whole trick). */
const MAX_ENTRY_BYTES = 64 * 1024 * 1024;

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
/** An EOCD record is 22 bytes plus a comment of at most 65535. */
const MAX_EOCD_SCAN = 22 + 0xffff;

/** One entry's location inside the archive. */
interface ZipEntry {
  name: string;
  /** 0 = stored, 8 = deflate; anything else we decline. */
  method: number;
  compressedSize: number;
  localHeaderOffset: number;
}

/** Walk the central directory. Returns null if this isn't a readable ZIP. */
function readDirectory(buffer: Buffer): ZipEntry[] | null {
  // The EOCD is last, but a trailing comment means it isn't at a fixed offset
  // — scan backwards for its signature, which is what every unzip does.
  const from = Math.max(0, buffer.length - MAX_EOCD_SCAN);
  let eocd = -1;
  for (let i = buffer.length - 22; i >= from; i -= 1) {
    if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) return null;

  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  // 0xffffffff is the ZIP64 marker: the real offset lives in a ZIP64 record
  // this reader doesn't parse.
  if (offset === 0xffffffff || offset >= buffer.length) return null;

  const entries: ZipEntry[] = [];
  for (let i = 0; i < count; i += 1) {
    if (offset + 46 > buffer.length) return null;
    if (buffer.readUInt32LE(offset) !== CENTRAL_SIGNATURE) return null;

    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    entries.push({
      name: buffer.toString("utf8", offset + 46, offset + 46 + nameLength),
      method: buffer.readUInt16LE(offset + 10),
      compressedSize: buffer.readUInt32LE(offset + 20),
      localHeaderOffset: buffer.readUInt32LE(offset + 42),
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/** One entry's bytes, decompressed. Null if it can't be read as text. */
function readEntry(buffer: Buffer, entry: ZipEntry): string | null {
  const start = entry.localHeaderOffset;
  if (start + 30 > buffer.length) return null;
  if (buffer.readUInt32LE(start) !== LOCAL_SIGNATURE) return null;

  // The local header repeats the name and extra fields — and its extra field
  // length can differ from the central directory's, so the data offset has to
  // be computed from *this* header, not that one.
  const nameLength = buffer.readUInt16LE(start + 26);
  const extraLength = buffer.readUInt16LE(start + 28);
  const dataStart = start + 30 + nameLength + extraLength;
  const dataEnd = dataStart + entry.compressedSize;
  if (dataEnd > buffer.length || entry.compressedSize > MAX_ENTRY_BYTES) {
    return null;
  }

  const data = buffer.subarray(dataStart, dataEnd);
  try {
    if (entry.method === 0) return data.toString("utf8");
    if (entry.method === 8) {
      return inflateRawSync(data, {
        maxOutputLength: MAX_ENTRY_BYTES,
      }).toString("utf8");
    }
  } catch {
    return null;
  }
  return null;
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

/** XML text content → the characters it stands for. */
function unescapeXml(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, code: string) => {
    if (code.startsWith("#")) {
      const value = code.startsWith("#x")
        ? Number.parseInt(code.slice(2), 16)
        : Number.parseInt(code.slice(1), 10);
      return Number.isFinite(value) ? String.fromCodePoint(value) : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

/** Every `<t>` run inside one chunk of XML, concatenated. */
function textRuns(xml: string): string {
  let text = "";
  const pattern = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g;
  for (let m = pattern.exec(xml); m; m = pattern.exec(xml)) {
    text += unescapeXml(m[1]);
  }
  return text;
}

/**
 * `sharedStrings.xml` → the string table cells index into. Every piece of text
 * in a workbook lives here, not in the sheet, which is why a sheet on its own
 * reads as a list of numbers.
 */
export function parseSharedStrings(xml: string): string[] {
  const strings: string[] = [];
  const pattern = /<si(?:\s[^>]*)?>([\s\S]*?)<\/si>|<si(?:\s[^>]*)?\/>/g;
  for (let m = pattern.exec(xml); m; m = pattern.exec(xml)) {
    strings.push(m[1] === undefined ? "" : textRuns(m[1]));
  }
  return strings;
}

/** `"BC12"` → 54 (0-based column). Ignores the row part. */
export function columnIndex(reference: string): number {
  let index = 0;
  for (const ch of reference.toUpperCase()) {
    const value = ch.charCodeAt(0) - 64; // "A" → 1
    if (value < 1 || value > 26) break;
    index = index * 26 + value;
  }
  return Math.max(0, index - 1);
}

/** A sheet's top-left corner, as text. */
export interface Grid {
  rows: string[][];
  /** Rows or columns were left out to fit the pane. */
  truncated: boolean;
}

/** The value one `<c>` element contributes, already unescaped. */
function cellText(cell: string, type: string, strings: string[]): string {
  if (type === "s") {
    const index = Number.parseInt(
      /<v>([\s\S]*?)<\/v>/.exec(cell)?.[1] ?? "",
      10,
    );
    return strings[index] ?? "";
  }
  if (type === "inlineStr") return textRuns(cell);
  // "str" is a formula's cached string result; everything else is a number,
  // a boolean, or an error code — all of which read fine as their raw text.
  const value = /<v>([\s\S]*?)<\/v>/.exec(cell)?.[1];
  if (value === undefined) return "";
  if (type === "b") return value === "1" ? "TRUE" : "FALSE";
  return unescapeXml(value);
}

/**
 * Parse a worksheet's XML into at most `maxRows` × `maxCols` of text.
 *
 * Scans rather than builds a document: a sheet can be tens of megabytes and
 * the preview wants the first handful of rows, so both loops stop as soon as
 * they have enough. Cells are placed by their `r="B3"` reference, so a sparse
 * row's gaps stay where they are instead of shifting everything left.
 */
export function parseSheetXml(
  xml: string,
  strings: string[],
  maxRows: number,
  maxCols: number,
): Grid {
  const rows: string[][] = [];
  let truncated = false;

  const rowPattern = /<row(?:\s[^>]*)?>([\s\S]*?)<\/row>/g;
  for (let row = rowPattern.exec(xml); row; row = rowPattern.exec(xml)) {
    if (rows.length >= maxRows) {
      truncated = true;
      break;
    }

    const cells: string[] = [];
    const cellPattern = /<c\s([^>]*?)\/>|<c\s([^>]*?)>([\s\S]*?)<\/c>/g;
    for (let m = cellPattern.exec(row[1]); m; m = cellPattern.exec(row[1])) {
      const attributes = m[1] ?? m[2] ?? "";
      const reference = /r="([A-Z]+)\d+"/i.exec(attributes)?.[1];
      const column = reference ? columnIndex(reference) : cells.length;
      if (column >= maxCols) {
        truncated = true;
        continue;
      }
      // A sparse row skips empty cells entirely; pad so column N lands in
      // slot N.
      while (cells.length < column) cells.push("");
      const type = /t="([a-z]+)"/i.exec(attributes)?.[1] ?? "";
      cells[column] = m[3] === undefined ? "" : cellText(m[3], type, strings);
    }
    rows.push(cells);
  }

  // A trailing run of empty rows/columns is noise — Excel happily stores
  // formatting for cells that hold nothing.
  while (rows.length && rows[rows.length - 1].every((cell) => cell === "")) {
    rows.pop();
  }
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
  for (const row of rows) while (row.length < width) row.push("");

  return { rows, truncated };
}

/** The workbook's first sheet, as the workbook itself orders them. */
function firstSheetName(entries: ZipEntry[], buffer: Buffer): string | null {
  const workbook = entries.find((e) => e.name === "xl/workbook.xml");
  const rels = entries.find((e) => e.name === "xl/_rels/workbook.xml.rels");

  if (workbook && rels) {
    const xml = readEntry(buffer, workbook);
    const relsXml = readEntry(buffer, rels);
    const id = xml && /<sheet\s[^>]*r:id="([^"]+)"/.exec(xml)?.[1];
    if (id && relsXml) {
      const target = new RegExp(
        `<Relationship[^>]*Id="${id}"[^>]*Target="([^"]+)"`,
      ).exec(relsXml)?.[1];
      if (target) {
        const path = target.replace(/^\/?(xl\/)?/, "xl/");
        if (entries.some((e) => e.name === path)) return path;
      }
    }
  }

  // No usable workbook relationship (or a layout this reader doesn't know):
  // fall back to the conventional path, then to whatever sheet sorts first.
  if (entries.some((e) => e.name === "xl/worksheets/sheet1.xml")) {
    return "xl/worksheets/sheet1.xml";
  }
  const sheets = entries
    .filter((e) => /^xl\/worksheets\/[^/]+\.xml$/.test(e.name))
    .map((e) => e.name)
    .sort();
  return sheets[0] ?? null;
}

/**
 * The first sheet of the workbook at `path`, bounded to `maxRows` × `maxCols`.
 * Null when the file isn't a readable workbook — the caller previews it some
 * other way rather than reporting an error the user can't act on.
 */
export async function readXlsxGrid(
  path: string,
  maxRows: number,
  maxCols: number,
): Promise<Grid | null> {
  let buffer: Buffer;
  try {
    buffer = await readFile(path);
  } catch {
    return null;
  }
  if (buffer.length > MAX_FILE_BYTES) return null;

  const entries = readDirectory(buffer);
  if (!entries) return null;

  const sheetName = firstSheetName(entries, buffer);
  const sheet = sheetName && entries.find((e) => e.name === sheetName);
  if (!sheet) return null;

  const sheetXml = readEntry(buffer, sheet);
  if (!sheetXml) return null;

  const stringsEntry = entries.find((e) => e.name === "xl/sharedStrings.xml");
  const stringsXml = stringsEntry ? readEntry(buffer, stringsEntry) : null;
  const strings = stringsXml ? parseSharedStrings(stringsXml) : [];

  const grid = parseSheetXml(sheetXml, strings, maxRows, maxCols);
  return grid.rows.length ? grid : null;
}
