/**
 * Reads what a file-or-folder quicklink actually contains, for the manager's
 * detail pane.
 *
 * The renderer can't touch the filesystem and the launcher's CSP is
 * `img-src 'self' data:`, so everything showable has to be read here and come
 * back inlined — same constraint `./file-icon.ts` works under, one level up:
 * that answers "what icon does this get?", this answers "what's in it?".
 *
 * Three ways a file gets a picture, in order of how much it tells you:
 *  1. it *is* a picture — inlined as-is when it's small (so a GIF still
 *     animates and an SVG stays sharp), downscaled through `nativeImage`
 *     when it isn't;
 *  2. the OS can draw one — `nativeImage.createThumbnailFromPath` hands back
 *     the shell's own thumbnail, which is how a video gets a real frame, a PDF
 *     its first page and a spreadsheet its grid. Windows and macOS only;
 *     Linux throws and falls through.
 *  3. it's text — the first few KB, verbatim (CSV/TSV parsed into a grid);
 *  4. it's a workbook — `./xlsx.ts` reads the first sheet's top-left corner,
 *     because Excel only leaves a thumbnail behind when asked to.
 * Anything left over is a file card drawn from the metadata, never an error.
 *
 * Everything is bounded: a preview is worth a few hundred KB of data URI and a
 * few milliseconds, never a 4 GB read of the video the user pointed at.
 */
import { app, nativeImage } from "electron";
import { open, readdir, stat } from "node:fs/promises";
import { basename, normalize } from "node:path";
import {
  categoryOf,
  extensionOf,
  splitDelimitedRow,
  typeLabel,
  type FolderEntry,
  type PreviewBody,
  type PreviewFile,
  type QuicklinkPreview,
} from "../shared/preview";
import { normalizeLink } from "./store";
import { readXlsxGrid } from "./xlsx.ts";

/** Read at most this much of a text file — the pane shows a few dozen lines. */
const TEXT_BYTES = 96 * 1024;
/** …and render at most this many lines of it. */
const TEXT_LINES = 300;
/** Inline an image verbatim up to this size (keeps GIF animation, SVG vectors). */
const INLINE_IMAGE_BYTES = 1.5 * 1024 * 1024;
/** Anything bigger is decoded and downscaled to this width before inlining. */
const DOWNSCALE_WIDTH = 720;
/** Give up on decoding an image entirely past this — the OS thumbnail is enough. */
const MAX_DECODE_BYTES = 64 * 1024 * 1024;
/** Longest edge of an OS-generated thumbnail. */
const THUMBNAIL_SIZE = 512;
/** Folder entries listed in the pane. */
const FOLDER_ENTRIES = 60;
/** Rows / columns of a CSV kept — the pane is ~240px of usable width. */
const TABLE_ROWS = 40;
const TABLE_COLUMNS = 8;

/** Mime types for the images we inline verbatim. */
const IMAGE_MIME: Record<string, string> = {
  png: "image/png",
  apng: "image/apng",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  jfif: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  ico: "image/x-icon",
  svg: "image/svg+xml",
  avif: "image/avif",
};

/**
 * Previews, keyed by path *and* the file's size/mtime, so editing the file the
 * quicklink points at re-reads it while arrowing up and down the list doesn't.
 * Bounded hard rather than by age: the values are inlined images.
 */
const cache = new Map<string, QuicklinkPreview>();
const MAX_ENTRIES = 40;

function remember(key: string, preview: QuicklinkPreview): QuicklinkPreview {
  if (cache.size >= MAX_ENTRIES) cache.clear();
  cache.set(key, preview);
  return preview;
}

/** A path still holding `{query}` isn't a path yet — there's nothing to read. */
const PLACEHOLDER = /\{[^}]*\}/;

/**
 * The target `link` points at, as a real path, or null when it isn't one — a
 * web URL, a custom scheme (`spotify:`), or a template.
 *
 * The result goes through `path.normalize`, which on Windows also turns
 * forward slashes into backslashes. That isn't cosmetic: `fs` happily takes
 * `C:/x/y.pdf`, but `createThumbnailFromPath` passes the path to the shell,
 * which rejects it ("Failed to create IShellItem from the given path") — so a
 * quicklink typed or imported with forward slashes would silently never get a
 * thumbnail.
 */
function pathOf(link: string): string | null {
  const trimmed = link.trim();
  if (!trimmed || PLACEHOLDER.test(trimmed)) return null;

  const expanded = normalizeLink(trimmed);
  if (/^file:\/\//i.test(expanded)) {
    try {
      // Decodes %20 and friends; a malformed file: URL is simply not a path.
      const decoded = decodeURIComponent(
        expanded.replace(/^file:\/\/(localhost)?/i, ""),
      )
        .replace(/^\/([a-z]:)/i, "$1")
        .trim();
      return decoded ? normalize(decoded) : null;
    } catch {
      return null;
    }
  }
  // Anything else with a scheme is a URL, not a path. Windows drive letters
  // (`C:\…`) look like a scheme, hence the check order.
  if (/^[a-z]:[\\/]/i.test(expanded)) return normalize(expanded);
  if (/^[a-z][a-z0-9+.-]*:/i.test(expanded)) return null;
  return /^[\\/~]/.test(expanded) ? normalize(expanded) : null;
}

/** The OS icon for a path, as a `data:` URI. Never throws. */
async function iconFor(path: string): Promise<string | null> {
  try {
    const image = await app.getFileIcon(path, { size: "large" });
    return image.isEmpty() ? null : image.toDataURL();
  } catch {
    return null;
  }
}

/**
 * The shell's own thumbnail for a path — a video frame, a PDF's first page, a
 * document's first sheet. Unsupported on Linux (and for plenty of files
 * elsewhere), where it rejects and the caller falls back to the file card.
 */
async function thumbnailFor(path: string): Promise<string | null> {
  try {
    const image = await nativeImage.createThumbnailFromPath(path, {
      width: THUMBNAIL_SIZE,
      height: THUMBNAIL_SIZE,
    });
    return image.isEmpty() ? null : image.toDataURL();
  } catch {
    return null;
  }
}

/** The first `limit` bytes of a file, without reading the whole thing in. */
async function head(path: string, limit: number): Promise<Buffer> {
  const handle = await open(path, "r");
  try {
    const buffer = Buffer.alloc(limit);
    const { bytesRead } = await handle.read(buffer, 0, limit, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

/**
 * Does this look like text rather than a binary we'd render as mojibake? A NUL
 * byte is the giveaway every text editor uses, and it's enough here: the
 * alternative (a real encoding sniff) buys nothing for a 20-line preview.
 */
function looksLikeText(buffer: Buffer): boolean {
  return !buffer.subarray(0, 4096).includes(0);
}

/** Decode a head-of-file buffer as UTF-8, dropping a BOM and a torn last line. */
function decodeText(buffer: Buffer, complete: boolean): string {
  let text = buffer.toString("utf8").replace(/^\uFEFF/, "");
  // The read stops at a byte boundary, so the last line is probably cut in
  // half — and possibly mid-character. Drop it rather than show the damage.
  if (!complete) text = text.slice(0, text.lastIndexOf("\n") + 1 || undefined);
  return text.replace(/\r\n/g, "\n");
}

/** Clamp to `TEXT_LINES`, reporting whether anything was left out. */
function clampLines(text: string, alreadyTruncated: boolean): PreviewBody {
  const lines = text.split("\n");
  const truncated = alreadyTruncated || lines.length > TEXT_LINES;
  return {
    type: "text",
    text: lines.slice(0, TEXT_LINES).join("\n").trimEnd(),
    truncated,
  };
}

/** A CSV/TSV head parsed into a bounded grid. */
function parseTable(text: string, extension: string): PreviewBody {
  const delimiter = extension === "tsv" ? "\t" : ",";
  const lines = text.split("\n").filter((line) => line.trim() !== "");
  const kept = lines.slice(0, TABLE_ROWS);
  let clipped = lines.length > TABLE_ROWS;

  const rows = kept.map((line) => {
    const cells = splitDelimitedRow(line, delimiter).map((cell) => cell.trim());
    if (cells.length > TABLE_COLUMNS) clipped = true;
    return cells.slice(0, TABLE_COLUMNS);
  });

  // A single column means the delimiter guess was wrong (or it's a one-column
  // file) — plain text reads better than a grid one cell wide.
  if (!rows.length || rows.every((row) => row.length < 2)) {
    return clampLines(text, clipped);
  }
  return { type: "table", rows, truncated: clipped };
}

/** The image itself, inlined — verbatim when small, downscaled when not. */
async function imageBody(
  path: string,
  extension: string,
  bytes: number,
): Promise<PreviewBody> {
  const mime = IMAGE_MIME[extension];

  if (mime && bytes <= INLINE_IMAGE_BYTES) {
    try {
      const buffer = await head(path, INLINE_IMAGE_BYTES);
      const dataUrl = `data:${mime};base64,${buffer.toString("base64")}`;
      // `nativeImage` is only consulted for the dimensions here — an SVG or an
      // exotic format it can't decode still previews, just without them.
      const decoded =
        extension === "svg" ? null : nativeImage.createFromBuffer(buffer);
      const size = decoded?.isEmpty() === false ? decoded.getSize() : null;
      return {
        type: "image",
        dataUrl,
        width: size?.width ?? 0,
        height: size?.height ?? 0,
      };
    } catch {
      // Fall through to the decode path below.
    }
  }

  if (bytes <= MAX_DECODE_BYTES) {
    const image = nativeImage.createFromPath(path);
    if (!image.isEmpty()) {
      const size = image.getSize();
      const scaled =
        size.width > DOWNSCALE_WIDTH
          ? image.resize({ width: DOWNSCALE_WIDTH, quality: "good" })
          : image;
      return {
        type: "image",
        dataUrl: scaled.toDataURL(),
        width: size.width,
        height: size.height,
      };
    }
  }

  const thumbnail = await thumbnailFor(path);
  return thumbnail
    ? { type: "thumbnail", dataUrl: thumbnail }
    : { type: "none" };
}

/** A folder's first entries, directories first. */
async function folderBody(path: string): Promise<{
  body: PreviewBody;
  childCount: number;
}> {
  const items = await readdir(path, { withFileTypes: true });
  const entries: FolderEntry[] = items
    // Dotfiles are noise in a preview of "what's in here?".
    .filter((item) => !item.name.startsWith("."))
    .map((item) => ({ name: item.name, directory: item.isDirectory() }))
    .sort((a, b) =>
      a.directory === b.directory
        ? a.name.localeCompare(b.name)
        : a.directory
          ? -1
          : 1,
    );

  return {
    childCount: entries.length,
    body: {
      type: "folder",
      entries: entries.slice(0, FOLDER_ENTRIES),
      truncated: entries.length > FOLDER_ENTRIES,
    },
  };
}

/** Whatever of `file` can be drawn, given its category. */
async function bodyFor(file: PreviewFile): Promise<PreviewBody> {
  const { path, category, extension, bytes } = file;

  if (category === "image") return imageBody(path, extension, bytes);

  if (
    category === "code" ||
    category === "text" ||
    extension === "csv" ||
    extension === "tsv"
  ) {
    const buffer = await head(path, TEXT_BYTES);
    if (looksLikeText(buffer)) {
      const text = decodeText(buffer, bytes <= TEXT_BYTES);
      return extension === "csv" || extension === "tsv"
        ? parseTable(text, extension)
        : clampLines(text, bytes > TEXT_BYTES);
    }
  }

  // A workbook is read directly rather than thumbnailed: Windows only has a
  // thumbnail for one whose author ticked "Save Thumbnail", so the grid is
  // both far more likely to exist and more legible in a 240px pane.
  if (extension === "xlsx" || extension === "xlsm") {
    const grid = await readXlsxGrid(path, TABLE_ROWS, TABLE_COLUMNS);
    if (grid) {
      return { type: "table", rows: grid.rows, truncated: grid.truncated };
    }
  }

  // Video, PDF, Office, and anything unrecognised: ask the OS for a picture,
  // and if it hasn't got one, try reading it as text before giving up — plenty
  // of useful files (`.env.local`, `Makefile`, a `.log` with no extension)
  // classify as `binary` purely because their name says nothing.
  const thumbnail = await thumbnailFor(path);
  if (thumbnail) return { type: "thumbnail", dataUrl: thumbnail };

  if (category === "binary" && bytes > 0) {
    try {
      const buffer = await head(path, TEXT_BYTES);
      if (looksLikeText(buffer)) {
        return clampLines(
          decodeText(buffer, bytes <= TEXT_BYTES),
          bytes > TEXT_BYTES,
        );
      }
    } catch {
      // Unreadable — the file card still has everything it needs.
    }
  }

  return { type: "none" };
}

/**
 * What the detail pane should show for `link`. Never throws: an unreadable
 * file still comes back as a card, because a pane that renders the name, size
 * and icon of something it couldn't open is far more use than an empty box.
 */
export async function previewLink(link: string): Promise<QuicklinkPreview> {
  const path = pathOf(link);
  if (!path) return { status: "unsupported" };

  let stats;
  try {
    stats = await stat(path);
  } catch {
    return { status: "missing", path };
  }

  const key = `${path}:${stats.size}:${stats.mtimeMs}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const name = basename(path) || path;
  const directory = stats.isDirectory();
  const extension = directory ? "" : extensionOf(name);
  const category = directory ? "folder" : categoryOf(extension);

  const file: PreviewFile = {
    path,
    name,
    extension,
    category,
    label: typeLabel(category, extension),
    bytes: directory ? 0 : stats.size,
    modifiedAt: stats.mtimeMs,
    icon: await iconFor(path),
  };

  try {
    if (directory) {
      const { body, childCount } = await folderBody(path);
      return remember(key, {
        status: "ready",
        file: { ...file, childCount },
        body,
      });
    }
    return remember(key, { status: "ready", file, body: await bodyFor(file) });
  } catch (error) {
    console.error(`[quicklinks] preview failed for ${path}`, error);
    return remember(key, { status: "ready", file, body: { type: "none" } });
  }
}
