import { readFile as readFileFs } from "node:fs/promises";
import { fileURLToPath } from "node:url";

/**
 * Watches the system clipboard for changes and reports new text/image
 * content. Electron has no native clipboard-change event, so this polls on
 * an interval — kept small and injectable (a `ClipboardReader`, and a
 * `readFile` for the file-reference case below, rather than importing
 * Electron's `clipboard` or Node's `fs` directly) so it's fully unit-testable
 * without a real clipboard. This Electron version's `clipboard` module is
 * the async, Web-standard `ClipboardItem`-based API (no more synchronous
 * `readImage()`/`availableFormats()`), so every read here is a `Promise`.
 *
 * Copying a *file* (e.g. ⌘C on a screenshot's icon in Finder) doesn't put
 * pixel data on the clipboard at all — just a `text/uri-list` file
 * reference, generally alongside a plain-text fallback of the path/name
 * (which is what `readText()` would otherwise record as an uninteresting
 * text entry: the filename). When the reference resolves to a single local
 * file that looks like an image by extension, this reads its bytes from
 * disk instead and reports it the same as an embedded image copy, alongside
 * the resolved `path` (`onImage`'s second argument) so the caller can record
 * where it actually came from. This relies on Chromium's cross-platform
 * `text/uri-list` clipboard format for a file copy — plausible on all three
 * desktop platforms, but not verified against a real Finder/Explorer/
 * file-manager copy in this environment.
 *
 * Text takes priority over an *embedded* image representation: a copy that
 * carries both a text and an image MIME type is recorded as text only, to
 * avoid ambiguity. A resolved file-image is checked first, ahead of that
 * rule, since the plain-text side of a file copy is just the path/name, not
 * meaningful pasted text.
 *
 * Image changes are detected via a transition in the MIME types `read()`
 * reports (from "no image" to "has an image", or vice versa then back)
 * rather than re-fetching and hashing the image blob on every tick —
 * decoding a large screenshot to check whether it changed, forever, every
 * tick while it sits untouched on the clipboard, would be wasted CPU/
 * battery. The trade-off: two different images copied back-to-back with the
 * same type list (rare) may be seen as unchanged. Acceptable for v1.
 *
 * Writing an entry back to the clipboard (`writeExclusive`) and polling
 * share a lock so a tick can never observe a write half-finished: the poller
 * would otherwise sometimes read the clipboard mid-write (Electron's clipboard
 * calls are all async now) and misfire on stale content.
 *
 * `changeSignal` (optional) is a cheap "has anything changed at all" check —
 * on macOS, `pasteboardChangeCount()` from `@magibar/mac`, a thin binding
 * over `NSPasteboard.generalPasteboard.changeCount`, a counter AppKit bumps
 * on every pasteboard write and otherwise costs nothing to read (no IPC, no
 * format negotiation). Without it, every tick pays for a full
 * `readText()`/`read()` regardless of whether anything changed — this is
 * the piece a native app (Raycast, say) gets for free that Electron's
 * `clipboard` module has no equivalent for. When given, a tick short-circuits
 * before any of the real reads below unless the signal has moved since the
 * last tick (or the last `writeExclusive`).
 *
 * `changeEvent` (optional, mutually preferred over the `setInterval` loop
 * entirely) goes one step further: a real OS push notification for "the
 * clipboard just changed", rather than something merely cheap to poll. On
 * Windows, `pasteboardChangeEvent()` (`main/pasteboard-change-win.ts`) backs
 * this with `AddClipboardFormatListener`/`WM_CLIPBOARDUPDATE` via
 * `@magibar/win`'s `startClipboardWatcher`. When given, `start()` subscribes
 * to it instead of starting `setInterval` at all — every tick is then a
 * direct response to an actual clipboard write, not a periodic guess.
 */
export interface ClipboardItemLike {
  types: string[];
  getType(type: string): Promise<unknown>;
}

export interface ClipboardReader {
  readText(): Promise<string>;
  read(): Promise<ClipboardItemLike[]>;
}

const IMAGE_FORMAT = /^image\//;
const FILE_URI_LIST_FORMAT = "text/uri-list";
const IMAGE_FILE_EXTENSION =
  /\.(png|jpe?g|gif|webp|bmp|tiff?|heic|heif|avif)$/i;

function formatsOf(items: ClipboardItemLike[]): string {
  return items
    .flatMap((item) => item.types)
    .sort()
    .join(",");
}

async function textOf(value: unknown): Promise<string | null> {
  if (value instanceof Blob) return value.text();
  return typeof value === "string" ? value : null;
}

/** The single local file path a `text/uri-list` payload names, or `null` for anything else (none, several, a non-`file:` URI). */
function singleLocalFilePath(uriList: string): string | null {
  const uris = uriList
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  if (uris.length !== 1) return null;
  try {
    const url = new URL(uris[0]);
    if (url.protocol !== "file:") return null;
    return fileURLToPath(url);
  } catch {
    return null;
  }
}

/** Where an image came from — set only for a resolved file-copy, so the caller can record the original's location. */
export interface ImageSource {
  path: string;
}

export class ClipboardPoller {
  private readonly reader: ClipboardReader;
  private readonly onText: (text: string) => void;
  private readonly onImage: (png: Buffer, source?: ImageSource) => void;
  private readonly intervalMs: number;
  private readonly readFile: (path: string) => Promise<Buffer>;
  private readonly changeSignal?: () => number;
  private readonly changeEvent?: (onChange: () => void) => () => void;

  private timer: ReturnType<typeof setInterval> | null = null;
  private unsubscribeChangeEvent: (() => void) | null = null;
  private lastText = "";
  private lastFormats = "";
  private lastChangeSignal: number | null = null;
  /** Serializes ticks and `writeExclusive` calls against each other. */
  private lock: Promise<void> = Promise.resolve();

  constructor(
    reader: ClipboardReader,
    onText: (text: string) => void,
    onImage: (png: Buffer, source?: ImageSource) => void,
    intervalMs = 750,
    readFile: (path: string) => Promise<Buffer> = (path) => readFileFs(path),
    changeSignal?: () => number,
    changeEvent?: (onChange: () => void) => () => void,
  ) {
    this.reader = reader;
    this.onText = onText;
    this.onImage = onImage;
    this.intervalMs = intervalMs;
    this.readFile = readFile;
    this.changeSignal = changeSignal;
    this.changeEvent = changeEvent;
  }

  async start(): Promise<void> {
    if (this.timer || this.unsubscribeChangeEvent) return;
    // Seed from the clipboard's current contents so startup doesn't record
    // whatever was already copied before the app launched.
    await this.resync();
    if (this.changeEvent) {
      this.unsubscribeChangeEvent = this.changeEvent(() => void this.tick());
      return;
    }
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.unsubscribeChangeEvent) {
      this.unsubscribeChangeEvent();
      this.unsubscribeChangeEvent = null;
    }
  }

  /** One poll cycle. Exposed so tests can drive it without real timers. */
  async tick(): Promise<void> {
    await this.withLock(() => this.doTick());
  }

  /**
   * Run `write` (an async `clipboard.writeText`/`clipboard.write` call)
   * exclusively of any in-flight poll tick, then resync directly from the
   * clipboard so the next tick doesn't mistake our own write for a new copy.
   */
  async writeExclusive(write: () => Promise<void>): Promise<void> {
    await this.withLock(async () => {
      await write();
      await this.resync();
    });
  }

  private withLock<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.lock.then(fn, fn);
    this.lock = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async resync(): Promise<void> {
    try {
      this.lastText = await this.reader.readText();
      this.lastFormats = formatsOf(await this.reader.read());
      if (this.changeSignal) this.lastChangeSignal = this.readChangeSignal();
    } catch {
      /* transient clipboard access failure — next tick/write resyncs */
    }
  }

  /** `changeSignal()`, swallowing a throw — treated the same as "unavailable this tick" by callers. */
  private readChangeSignal(): number | null {
    try {
      return this.changeSignal!();
    } catch {
      return null;
    }
  }

  private async doTick(): Promise<void> {
    if (this.changeSignal) {
      const signal = this.readChangeSignal();
      // `null` means the signal itself failed — fall through to the real
      // check below rather than getting stuck never polling again.
      if (signal !== null) {
        if (signal === this.lastChangeSignal) return;
        this.lastChangeSignal = signal;
      }
    }

    let text: string;
    let items: ClipboardItemLike[];
    try {
      text = await this.reader.readText();
      items = await this.reader.read();
    } catch {
      return; // clipboard access can transiently throw on some platforms
    }

    const signature = formatsOf(items);
    const changed = signature !== this.lastFormats;

    // Checked ahead of the text branch below: a file copy's `readText()` is
    // just the path/name, not meaningful pasted text — if it resolves to a
    // single local image file, that's what the copy actually *is*.
    if (changed) {
      const fileImage = await this.tryReadFileImage(items);
      if (fileImage) {
        this.lastText = text;
        this.lastFormats = signature;
        this.onImage(fileImage.buffer, { path: fileImage.path });
        return;
      }
    }

    if (text && text !== this.lastText) {
      this.lastText = text;
      this.lastFormats = signature;
      this.onText(text);
      return;
    }
    this.lastText = text;

    if (!changed) return;
    this.lastFormats = signature;

    const imageItem = items.find((item) =>
      item.types.some((t) => IMAGE_FORMAT.test(t)),
    );
    if (!imageItem) return;
    const imageType = imageItem.types.find((t) => IMAGE_FORMAT.test(t))!;

    try {
      const blob = await imageItem.getType(imageType);
      if (!(blob instanceof Blob) || blob.size === 0) return;
      this.onImage(Buffer.from(await blob.arrayBuffer()));
    } catch {
      /* transient clipboard access failure — next transition tries again */
    }
  }

  /**
   * Resolves a `text/uri-list` clipboard item to the bytes (and path) of the
   * single local image file it names, or `null` for anything else (no file
   * reference, several files, a non-`file:` URI, a non-image extension, or
   * a file that fails to read).
   */
  private async tryReadFileImage(
    items: ClipboardItemLike[],
  ): Promise<{ buffer: Buffer; path: string } | null> {
    const fileItem = items.find((item) =>
      item.types.includes(FILE_URI_LIST_FORMAT),
    );
    if (!fileItem) return null;
    try {
      const list = await textOf(await fileItem.getType(FILE_URI_LIST_FORMAT));
      const path = list ? singleLocalFilePath(list) : null;
      if (!path || !IMAGE_FILE_EXTENSION.test(path)) return null;
      return { buffer: await this.readFile(path), path };
    } catch {
      return null;
    }
  }
}
