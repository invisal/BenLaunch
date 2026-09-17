import assert from "node:assert/strict";
import { test } from "node:test";

import {
  categoryOf,
  extensionOf,
  splitDelimitedRow,
  typeLabel,
} from "./preview.ts";

test("extensionOf lower-cases and ignores the path", () => {
  assert.equal(extensionOf("Report.PDF"), "pdf");
  assert.equal(extensionOf("archive.tar.gz"), "gz");
  assert.equal(extensionOf("Makefile"), "");
});

test("extensionOf treats a dotfile's name as its extension", () => {
  // ".env" has no extension in the usual sense, but the name is exactly what
  // says how to preview it — so it classifies as code rather than a blob.
  assert.equal(extensionOf(".env"), "env");
  assert.equal(extensionOf(".gitignore"), "gitignore");
  assert.equal(categoryOf(extensionOf(".env")), "code");
});

test("categoryOf picks the preview strategy, unknown extensions included", () => {
  assert.equal(categoryOf("png"), "image");
  assert.equal(categoryOf("MP4"), "video");
  assert.equal(categoryOf("xlsx"), "spreadsheet");
  assert.equal(categoryOf("csv"), "spreadsheet");
  assert.equal(categoryOf("md"), "text");
  assert.equal(categoryOf("tsx"), "code");
  assert.equal(categoryOf("qqq"), "binary");
  assert.equal(categoryOf(""), "binary");
});

test("typeLabel leads with the extension when it says more than the category", () => {
  assert.equal(typeLabel("image", "png"), "PNG Image");
  assert.equal(typeLabel("spreadsheet", "xlsx"), "XLSX Spreadsheet");
  assert.equal(typeLabel("pdf", "pdf"), "PDF Document");
  assert.equal(typeLabel("folder", ""), "Folder");
  assert.equal(typeLabel("binary", ""), "File");
});

test("splitDelimitedRow splits on the delimiter", () => {
  assert.deepEqual(splitDelimitedRow("a,b,c", ","), ["a", "b", "c"]);
  assert.deepEqual(splitDelimitedRow("a\tb", "\t"), ["a", "b"]);
  assert.deepEqual(splitDelimitedRow("only", ","), ["only"]);
});

test("splitDelimitedRow keeps a quoted delimiter inside its cell", () => {
  assert.deepEqual(splitDelimitedRow('a,"b,c",d', ","), ["a", "b,c", "d"]);
});

test("splitDelimitedRow unescapes a doubled quote", () => {
  assert.deepEqual(splitDelimitedRow('"say ""hi""",next', ","), [
    'say "hi"',
    "next",
  ]);
});

test("splitDelimitedRow keeps empty cells, including a trailing one", () => {
  assert.deepEqual(splitDelimitedRow("a,,c,", ","), ["a", "", "c", ""]);
});
