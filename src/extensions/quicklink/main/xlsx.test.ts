import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";

import {
  columnIndex,
  parseSharedStrings,
  parseSheetXml,
  readXlsxGrid,
} from "./xlsx.ts";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "quicklink-xlsx-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/**
 * A ZIP holding `entries`, every one of them *stored* rather than deflated.
 * A real `.xlsx` deflates its parts, but the two paths differ only in the one
 * `inflateRawSync` call — what's worth pinning down here is the header
 * arithmetic that finds an entry at all, which is identical either way.
 */
function zip(
  entries: ReadonlyArray<{ name: string; content: string }>,
): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const data = Buffer.from(entry.content, "utf8");

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 8); // method: stored
    local.writeUInt32LE(0, 14); // crc — unused by the reader
    local.writeUInt32LE(data.length, 18); // compressed size
    local.writeUInt32LE(data.length, 22); // uncompressed size
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 10); // method: stored
    central.writeUInt32LE(0, 16); // crc
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);

    offset += 30 + name.length + data.length;
  }

  const directory = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(directory.length, 12);
  eocd.writeUInt32LE(offset, 16);

  return Buffer.concat([Buffer.concat(locals), directory, eocd]);
}

/** Write `entries` as a workbook in the temp dir and return its path. */
function workbook(
  entries: ReadonlyArray<{ name: string; content: string }>,
): string {
  const path = join(dir, "book.xlsx");
  writeFileSync(path, zip(entries));
  return path;
}

const SHEET = `<worksheet><sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>
<row r="2"><c r="A2" t="s"><v>2</v></c><c r="C2"><v>42</v></c></row>
</sheetData></worksheet>`;

const STRINGS = `<sst><si><t>Name</t></si><si><t>Qty</t></si><si><r><t>Tea</t></r><r><t> &amp; Coffee</t></r></si></sst>`;

test("columnIndex decodes a cell reference's column", () => {
  assert.equal(columnIndex("A1"), 0);
  assert.equal(columnIndex("B3"), 1);
  assert.equal(columnIndex("Z9"), 25);
  assert.equal(columnIndex("AA1"), 26);
  assert.equal(columnIndex("BC12"), 54);
});

test("parseSharedStrings joins a string's runs and unescapes entities", () => {
  assert.deepEqual(parseSharedStrings(STRINGS), [
    "Name",
    "Qty",
    "Tea & Coffee",
  ]);
});

test("parseSharedStrings keeps an empty entry, so later indexes still line up", () => {
  assert.deepEqual(parseSharedStrings("<sst><si/><si><t>b</t></si></sst>"), [
    "",
    "b",
  ]);
});

test("parseSheetXml resolves shared strings and inline values", () => {
  const { rows, truncated } = parseSheetXml(
    SHEET,
    parseSharedStrings(STRINGS),
    10,
    10,
  );
  assert.equal(truncated, false);
  assert.deepEqual(rows, [
    ["Name", "Qty", ""],
    // B2 is absent from the XML; C2's `r` attribute still puts 42 in column 3.
    ["Tea & Coffee", "", "42"],
  ]);
});

test("parseSheetXml reads inline strings and booleans", () => {
  const xml =
    '<sheetData><row><c r="A1" t="inlineStr"><is><t>Hi</t></is></c>' +
    '<c r="B1" t="b"><v>1</v></c><c r="C1" t="b"><v>0</v></c></row></sheetData>';
  assert.deepEqual(parseSheetXml(xml, [], 10, 10).rows, [
    ["Hi", "TRUE", "FALSE"],
  ]);
});

test("parseSheetXml stops at the row and column limits, and says so", () => {
  const rows = Array.from(
    { length: 5 },
    (_, r) =>
      `<row>${Array.from(
        { length: 4 },
        (_, c) =>
          `<c r="${String.fromCharCode(65 + c)}${r + 1}"><v>${c}</v></c>`,
      ).join("")}</row>`,
  ).join("");

  const grid = parseSheetXml(`<sheetData>${rows}</sheetData>`, [], 2, 3);
  assert.equal(grid.rows.length, 2);
  assert.deepEqual(grid.rows[0], ["0", "1", "2"]);
  assert.equal(grid.truncated, true);
});

test("readXlsxGrid reads the first sheet of a workbook", async () => {
  const path = workbook([
    {
      name: "xl/workbook.xml",
      content:
        '<workbook><sheets><sheet name="One" r:id="rId1"/></sheets></workbook>',
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content:
        '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    },
    { name: "xl/sharedStrings.xml", content: STRINGS },
    { name: "xl/worksheets/sheet1.xml", content: SHEET },
  ]);

  const grid = await readXlsxGrid(path, 10, 10);
  assert.deepEqual(grid?.rows[0], ["Name", "Qty", ""]);
});

test("readXlsxGrid falls back to the conventional sheet path", async () => {
  // No workbook.xml/rels at all — still previewable.
  const path = workbook([
    { name: "xl/sharedStrings.xml", content: STRINGS },
    { name: "xl/worksheets/sheet1.xml", content: SHEET },
  ]);
  const grid = await readXlsxGrid(path, 10, 10);
  assert.deepEqual(grid?.rows[1], ["Tea & Coffee", "", "42"]);
});

test("readXlsxGrid returns null rather than throwing on a non-workbook", async () => {
  const notAZip = join(dir, "book.xlsx");
  writeFileSync(notAZip, "this is not a zip archive");
  assert.equal(await readXlsxGrid(notAZip, 10, 10), null);

  assert.equal(await readXlsxGrid(join(dir, "absent.xlsx"), 10, 10), null);

  // A valid ZIP that simply holds no worksheet.
  const empty = workbook([{ name: "docProps/app.xml", content: "<x/>" }]);
  assert.equal(await readXlsxGrid(empty, 10, 10), null);
});
