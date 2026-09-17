import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { inflateRawSync } from "node:zlib";

import { asNumber, buildXlsx, columnName, sanitizeSheetName } from "./xlsx.ts";
import { crc32, zip } from "./zip.ts";

/**
 * Reads an archive back the way a consumer would — walking the central
 * directory rather than the local headers, so a wrong offset or a wrong
 * directory size fails here instead of only inside Excel.
 */
function unzip(archive: Buffer): Map<string, Buffer> {
  const end = archive.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.notEqual(end, -1, "no end-of-central-directory record");
  const count = archive.readUInt16LE(end + 10);
  let cursor = archive.readUInt32LE(end + 16);

  const files = new Map<string, Buffer>();
  for (let i = 0; i < count; i++) {
    assert.equal(archive.readUInt32LE(cursor), 0x02014b50);
    const method = archive.readUInt16LE(cursor + 10);
    const checksum = archive.readUInt32LE(cursor + 16);
    const compressedSize = archive.readUInt32LE(cursor + 20);
    const nameLength = archive.readUInt16LE(cursor + 28);
    const extraLength = archive.readUInt16LE(cursor + 30);
    const commentLength = archive.readUInt16LE(cursor + 32);
    const offset = archive.readUInt32LE(cursor + 42);
    const name = archive
      .subarray(cursor + 46, cursor + 46 + nameLength)
      .toString("utf8");

    assert.equal(archive.readUInt32LE(offset), 0x04034b50);
    const localNameLength = archive.readUInt16LE(offset + 26);
    const localExtraLength = archive.readUInt16LE(offset + 28);
    const start = offset + 30 + localNameLength + localExtraLength;
    const payload = archive.subarray(start, start + compressedSize);
    const data = method === 8 ? inflateRawSync(payload) : payload;

    assert.equal(crc32(data), checksum, `bad CRC for ${name}`);
    files.set(name, data);
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

test("zip round-trips a stored entry", () => {
  const files = unzip(zip([{ name: "a.txt", data: "hello" }]));
  assert.deepEqual([...files.keys()], ["a.txt"]);
  assert.equal(files.get("a.txt")?.toString("utf8"), "hello");
});

test("zip deflates a large entry and it still round-trips", () => {
  const big = "the quick brown fox ".repeat(200);
  const archive = zip([{ name: "big.txt", data: big }]);
  assert.ok(archive.length < Buffer.byteLength(big), "should have compressed");
  assert.equal(unzip(archive).get("big.txt")?.toString("utf8"), big);
});

test("zip preserves entry order and handles UTF-8 names", () => {
  const files = unzip(
    zip([
      { name: "[Content_Types].xml", data: "<x/>" },
      { name: "xl/ราคา.xml", data: "<y/>" },
    ]),
  );
  assert.deepEqual([...files.keys()], ["[Content_Types].xml", "xl/ราคา.xml"]);
});

test("columnName walks past Z", () => {
  assert.equal(columnName(0), "A");
  assert.equal(columnName(25), "Z");
  assert.equal(columnName(26), "AA");
  assert.equal(columnName(701), "ZZ");
  assert.equal(columnName(702), "AAA");
});

test("sanitizeSheetName applies Excel's own limits", () => {
  assert.equal(sanitizeSheetName("Recognized: table/1"), "Recognized  table 1");
  assert.equal(sanitizeSheetName("x".repeat(40)).length, 31);
  assert.equal(sanitizeSheetName("  "), "Sheet");
});

test("asNumber only accepts values that round-trip", () => {
  assert.equal(asNumber("10.50"), 10.5);
  assert.equal(asNumber("-3"), -3);
  assert.equal(asNumber("1,234"), 1234);
  assert.equal(asNumber("0.5"), 0.5);
  // Text on purpose — see `asNumber`'s doc comment.
  assert.equal(asNumber("93%"), null);
  assert.equal(asNumber("007"), null);
  assert.equal(asNumber("3.5.1"), null);
  assert.equal(asNumber("Total"), null);
  assert.equal(asNumber(""), null);
});

test("the workbook carries every part Excel expects", () => {
  const files = unzip(
    buildXlsx([
      {
        name: "Table",
        rows: [
          ["Item", "Price"],
          ["Coffee", "7.00"],
        ],
        headerRow: true,
      },
      { name: "Details", rows: [["Engine", "windows"]] },
    ]),
  );
  for (const part of [
    "[Content_Types].xml",
    "_rels/.rels",
    "xl/workbook.xml",
    "xl/_rels/workbook.xml.rels",
    "xl/styles.xml",
    "xl/worksheets/sheet1.xml",
    "xl/worksheets/sheet2.xml",
  ]) {
    assert.ok(files.has(part), `missing ${part}`);
  }
  assert.equal([...files.keys()][0], "[Content_Types].xml");
});

test("numbers are written as numbers and text as inline strings", () => {
  const sheet = unzip(
    buildXlsx([{ name: "Table", rows: [["Coffee", "7.00", ""]] }]),
  )
    .get("xl/worksheets/sheet1.xml")!
    .toString("utf8");
  assert.match(
    sheet,
    /<c r="A1" t="inlineStr"><is><t xml:space="preserve">Coffee<\/t><\/is><\/c>/,
  );
  assert.match(sheet, /<c r="B1"><v>7<\/v><\/c>/);
  assert.match(sheet, /<c r="C1"\/>/);
});

test("a header row is bold and frozen", () => {
  const sheet = unzip(
    buildXlsx([{ name: "T", rows: [["Item"], ["Coffee"]], headerRow: true }]),
  )
    .get("xl/worksheets/sheet1.xml")!
    .toString("utf8");
  assert.match(sheet, /<c r="A1" s="1"/);
  assert.match(sheet, /<pane ySplit="1"/);
});

test("XML-hostile text is escaped, control characters dropped", () => {
  const sheet = unzip(buildXlsx([{ name: "T", rows: [['a & b <c> "d"']] }]))
    .get("xl/worksheets/sheet1.xml")!
    .toString("utf8");
  assert.match(sheet, /a &amp; b &lt;c&gt; &quot;d&quot;/);
  assert.doesNotMatch(sheet, //);
});

/**
 * The parts above are what *we* think Excel wants; this asks a real ZIP/OOXML
 * reader whether the package actually opens. Skipped where Python isn't on
 * PATH rather than failing the suite for an environment reason.
 */
test("the workbook opens in a real OOXML reader", (t) => {
  let python: string;
  try {
    python = execFileSync("python", ["-c", "print(1)"], {
      encoding: "utf8",
    }).trim()
      ? "python"
      : "python";
  } catch {
    return t.skip("python not available");
  }

  const dir = mkdtempSync(join(tmpdir(), "xlsx-"));
  try {
    const file = join(dir, "book.xlsx");
    writeFileSync(
      file,
      buildXlsx([
        {
          name: "Table",
          rows: [
            ["Item", "Price"],
            ["Coffee", "7.00"],
          ],
          headerRow: true,
        },
      ]),
    );
    const script =
      "import sys,zipfile,xml.etree.ElementTree as ET\n" +
      "z=zipfile.ZipFile(sys.argv[1])\n" +
      "assert z.testzip() is None\n" +
      "for n in z.namelist():\n" +
      "    ET.fromstring(z.read(n))\n" +
      "print('ok')\n";
    const out = execFileSync(python, ["-c", script, file], {
      encoding: "utf8",
    });
    assert.equal(out.trim(), "ok");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
