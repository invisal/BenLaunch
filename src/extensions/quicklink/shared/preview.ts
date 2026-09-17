/**
 * What the manager's detail pane shows for a quicklink that points at a file
 * or folder, and the classification both sides agree on.
 *
 * Main reads the bytes (`../main/preview.ts`) and sends back a ready-to-render
 * payload; the renderer only draws it. The split matters for two reasons: the
 * renderer has no filesystem access at all, and the launcher's CSP is
 * `img-src 'self' data:` — a preview image has to arrive inlined as a `data:`
 * URI or it will never paint.
 *
 * Nothing here may import `node:*` — the renderer bundles this file too.
 */

/** The broad kind of file a quicklink points at; picks the preview strategy. */
export type FileCategory =
  | "image"
  | "video"
  | "audio"
  | "pdf"
  | "spreadsheet"
  | "document"
  | "presentation"
  | "archive"
  | "code"
  | "text"
  | "folder"
  | "binary";

/**
 * Extensions we recognise, lower-cased and without the dot. Anything missing
 * falls through to `"binary"` and is still previewed — as an OS thumbnail if
 * the platform can make one, or as a file card — so an unknown extension
 * degrades rather than breaking.
 */
const CATEGORIES: ReadonlyArray<readonly [FileCategory, readonly string[]]> = [
  [
    "image",
    [
      "png",
      "jpg",
      "jpeg",
      "jfif",
      "gif",
      "webp",
      "bmp",
      "ico",
      "svg",
      "avif",
      "apng",
      "tif",
      "tiff",
      "heic",
    ],
  ],
  [
    "video",
    ["mp4", "m4v", "mov", "mkv", "avi", "webm", "wmv", "flv", "mpg", "mpeg"],
  ],
  ["audio", ["mp3", "wav", "flac", "aac", "ogg", "oga", "m4a", "wma", "opus"]],
  ["pdf", ["pdf"]],
  ["spreadsheet", ["xlsx", "xlsm", "xls", "ods", "csv", "tsv", "numbers"]],
  ["document", ["docx", "doc", "odt", "rtf", "pages", "epub"]],
  ["presentation", ["pptx", "ppt", "odp", "key"]],
  ["archive", ["zip", "rar", "7z", "tar", "gz", "bz2", "xz", "dmg", "iso"]],
  [
    "code",
    [
      "ts",
      "tsx",
      "js",
      "jsx",
      "mjs",
      "cjs",
      "json",
      "jsonc",
      "html",
      "htm",
      "css",
      "scss",
      "less",
      "py",
      "rb",
      "go",
      "rs",
      "java",
      "kt",
      "swift",
      "c",
      "h",
      "cpp",
      "hpp",
      "cs",
      "php",
      "sh",
      "bash",
      "zsh",
      "ps1",
      "bat",
      "cmd",
      "sql",
      "yml",
      "yaml",
      "toml",
      "ini",
      "cfg",
      "conf",
      "env",
      "gitignore",
      "dockerfile",
      "vue",
      "svelte",
    ],
  ],
  ["text", ["txt", "md", "markdown", "log", "text", "nfo", "srt", "vtt"]],
];

/** Human labels, used when the extension itself isn't the clearer answer. */
const CATEGORY_LABELS: Record<FileCategory, string> = {
  image: "Image",
  video: "Video",
  audio: "Audio",
  pdf: "PDF Document",
  spreadsheet: "Spreadsheet",
  document: "Document",
  presentation: "Presentation",
  archive: "Archive",
  code: "Code",
  text: "Text",
  folder: "Folder",
  binary: "File",
};

/** `"report.PDF"` → `"pdf"`; `""` when there's no extension. */
export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  // A leading dot is a dotfile (".env"), not an extension — unless the whole
  // name is one, which is how ".gitignore" still classifies as code.
  if (dot <= 0) return name.startsWith(".") ? name.slice(1).toLowerCase() : "";
  return name.slice(dot + 1).toLowerCase();
}

/** Which preview strategy an extension gets. */
export function categoryOf(extension: string): FileCategory {
  const ext = extension.toLowerCase();
  for (const [category, list] of CATEGORIES) {
    if (list.includes(ext)) return category;
  }
  return "binary";
}

/**
 * The type line under a file's name: `"PDF Document"`, `"PNG Image"`,
 * `"XLSX Spreadsheet"`. The extension leads when it carries information the
 * category doesn't (every user knows what `.mp4` means), which is also what
 * keeps `.bin` and `.dat` from both reading as a bare "File".
 */
export function typeLabel(category: FileCategory, extension: string): string {
  if (category === "folder") return "Folder";
  if (!extension) return CATEGORY_LABELS[category];
  if (category === "pdf") return "PDF Document";
  return `${extension.toUpperCase()} ${CATEGORY_LABELS[category]}`;
}

/**
 * Split one delimited line, honouring `"quoted, fields"` and `""` escapes.
 * Enough for the CSVs people actually keep quicklinks to; a preview that gets
 * an exotic dialect slightly wrong is still a better answer than raw text.
 *
 * Here rather than next to the reader in main so it can be tested without
 * Electron — it's the one part of the preview pipeline with real edge cases.
 */
export function splitDelimitedRow(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      cells.push(cell);
      cell = "";
    } else cell += ch;
  }
  cells.push(cell);
  return cells;
}

/** Everything the pane says about the target itself, preview aside. */
export interface PreviewFile {
  /** Absolute path, `~` expanded and `file://` stripped. */
  path: string;
  /** Basename, with extension. */
  name: string;
  extension: string;
  category: FileCategory;
  /** Ready-made type line — see `typeLabel`. */
  label: string;
  bytes: number;
  modifiedAt: number;
  /** The icon the OS draws for it, inlined as a `data:` URI. */
  icon: string | null;
  /** How many entries a folder holds. Absent for a file. */
  childCount?: number;
}

/** One row of a folder listing. */
export interface FolderEntry {
  name: string;
  directory: boolean;
}

/** The renderable content, once main has decided what can be shown. */
export type PreviewBody =
  /** The image itself, inlined. Possibly downscaled — `bytes` on the file is the original. */
  | { type: "image"; dataUrl: string; width: number; height: number }
  /** An OS-generated thumbnail (a video frame, a PDF's first page, a deck's title slide). */
  | { type: "thumbnail"; dataUrl: string }
  /** The head of a text file. */
  | { type: "text"; text: string; truncated: boolean }
  /** A delimited file (CSV/TSV) parsed into a grid, first row treated as a header. */
  | {
      type: "table";
      rows: string[][];
      /** Rows and/or columns were dropped to fit the pane. */
      truncated: boolean;
    }
  /** A folder's first entries. */
  | { type: "folder"; entries: FolderEntry[]; truncated: boolean }
  /** Nothing showable — the pane falls back to the file card. */
  | { type: "none" };

/**
 * The reply to a preview request:
 *  - `unsupported` — not a file target at all (a web link, or a path still
 *    holding a `{query}` placeholder), so the pane shows its link card;
 *  - `missing` — a real path that isn't there any more (the classic "I moved
 *    that folder six months ago" quicklink), which is worth saying out loud;
 *  - `ready` — the file, plus whatever of it can be drawn.
 */
export type QuicklinkPreview =
  | { status: "unsupported" }
  | { status: "missing"; path: string }
  | { status: "ready"; file: PreviewFile; body: PreviewBody };
