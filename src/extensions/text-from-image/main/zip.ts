/**
 * A minimal ZIP writer, for the one thing this extension needs it for: an
 * `.xlsx` workbook is a ZIP of XML parts (see `./xlsx.ts`).
 *
 * Writing the ~90 lines below rather than taking a dependency is a deliberate
 * trade: every general-purpose spreadsheet library in npm is megabytes of code
 * for reading arbitrary workbooks, styling, formulas and charts, none of which
 * a "dump these rows into a sheet" export uses. What's here is the subset of
 * APPNOTE.TXT that Excel, LibreOffice and `zipfile` all accept — no ZIP64, no
 * encryption, no data descriptors, no directory entries — and it stays honest
 * about that in `store()` below.
 *
 * Electron-free, so `node --test` drives it directly (`./zip.test.ts`).
 */
import { deflateRawSync } from "node:zlib";

export interface ZipEntry {
  /** Path inside the archive, forward slashes, no leading slash. */
  name: string;
  data: Buffer | string;
}

/** Deflate is only worth it once there's something to squeeze. */
const MIN_DEFLATE_BYTES = 256;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let bit = 0; bit < 8; bit++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * MS-DOS date/time, the only timestamp a base ZIP record carries. Seconds have
 * one-bit-per-two-seconds resolution and the epoch is 1980 — both are the
 * format's, not ours.
 */
function dosDateTime(date: Date): { time: number; date: number } {
  return {
    time:
      (date.getHours() << 11) |
      (date.getMinutes() << 5) |
      (date.getSeconds() >> 1),
    date:
      ((Math.max(date.getFullYear(), 1980) - 1980) << 9) |
      ((date.getMonth() + 1) << 5) |
      date.getDate(),
  };
}

/** One entry's local header + payload, plus the central-directory record describing it. */
function record(
  entry: ZipEntry,
  offset: number,
  stamp: { time: number; date: number },
): { local: Buffer; central: Buffer } {
  const name = Buffer.from(entry.name, "utf8");
  const raw = Buffer.isBuffer(entry.data)
    ? entry.data
    : Buffer.from(entry.data, "utf8");

  const deflated =
    raw.length >= MIN_DEFLATE_BYTES ? deflateRawSync(raw) : undefined;
  // Storing is only a loss when the compressed form is actually smaller.
  const useDeflate = deflated !== undefined && deflated.length < raw.length;
  const payload = useDeflate ? deflated : raw;
  const method = useDeflate ? 8 : 0;
  const checksum = crc32(raw);

  const local = Buffer.alloc(30 + name.length);
  local.writeUInt32LE(0x04034b50, 0); // local file header signature
  local.writeUInt16LE(20, 4); // version needed: 2.0
  local.writeUInt16LE(0x0800, 6); // flags: UTF-8 names
  local.writeUInt16LE(method, 8);
  local.writeUInt16LE(stamp.time, 10);
  local.writeUInt16LE(stamp.date, 12);
  local.writeUInt32LE(checksum, 14);
  local.writeUInt32LE(payload.length, 18);
  local.writeUInt32LE(raw.length, 22);
  local.writeUInt16LE(name.length, 26);
  local.writeUInt16LE(0, 28); // extra field length
  name.copy(local, 30);

  const central = Buffer.alloc(46 + name.length);
  central.writeUInt32LE(0x02014b50, 0); // central directory header signature
  central.writeUInt16LE(20, 4); // version made by
  central.writeUInt16LE(20, 6); // version needed
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(method, 10);
  central.writeUInt16LE(stamp.time, 12);
  central.writeUInt16LE(stamp.date, 14);
  central.writeUInt32LE(checksum, 16);
  central.writeUInt32LE(payload.length, 20);
  central.writeUInt32LE(raw.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt16LE(0, 30); // extra field length
  central.writeUInt16LE(0, 32); // comment length
  central.writeUInt16LE(0, 34); // disk number start
  central.writeUInt16LE(0, 36); // internal attributes
  central.writeUInt32LE(0, 38); // external attributes
  central.writeUInt32LE(offset, 42);
  name.copy(central, 46);

  return { local: Buffer.concat([local, payload]), central };
}

/**
 * Packs `entries` into a ZIP archive. Entry order is preserved, which matters
 * for `.xlsx`: `[Content_Types].xml` is expected first.
 *
 * Within the format's limits — under 65 535 entries and under 4 GiB, both far
 * beyond a page of recognized text — so no ZIP64 records are written.
 */
export function zip(entries: ZipEntry[], now: Date = new Date()): Buffer {
  const stamp = dosDateTime(now);
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const { local, central } = record(entry, offset, stamp);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }

  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); // end of central directory signature
  end.writeUInt16LE(0, 4); // this disk
  end.writeUInt16LE(0, 6); // disk with the directory
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...locals, directory, end]);
}
