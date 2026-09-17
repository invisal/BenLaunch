import {
  app,
  clipboard,
  dialog,
  shell,
  type BrowserWindow,
  type IpcMain,
} from "electron";
import { extname, join } from "node:path";
import { Extension } from "@core/base";
import type { ActionDefinition } from "@main/types";
import { registerTextFromImageIpc } from "./ipc/handlers.ts";
import { exportRecognition, serialize } from "./main/export.ts";
import { readClipboardImage } from "./main/clipboard.ts";
import {
  fromBuffer,
  fromPath,
  IMAGE_EXTENSIONS,
  type PreparedImage,
} from "./main/image.ts";
import { engineInfo, recognize } from "./main/ocr.ts";
import { RecognitionStore } from "./main/store.ts";
import { suggestFilename } from "./shared/format.ts";
import {
  EXPORT_FORMATS,
  TEXT_FROM_IMAGE_ROUTE,
  type EngineInfo,
  type ExportFormat,
  type ExportOptions,
  type ExportResult,
  type ImageSource,
  type RecognizeRequest,
  type RecognizeResult,
  type TextExportFormat,
} from "./shared/types";

/**
 * The bits of the launcher window's own state a modal file dialog needs,
 * owned by `main/index.ts`. Same arrangement as Quicklinks' — without
 * suppressing blur-to-hide, the launcher vanishes behind the picker and the
 * screen that opened it is gone by the time the picker closes.
 */
export interface TextFromImageDialogHost {
  getLauncherWindow: () => BrowserWindow | null;
  setSuppressAutoHide: (value: boolean) => void;
}

/**
 * Text from Image: reads the text out of a screenshot, a photo or a scan and
 * converts it to plain text, JSON, CSV, an Excel workbook or a PDF.
 *
 * As the extension's composition root it owns the `RecognitionStore`
 * (persisted through `this.storage`,
 * `<userData>/extensions/text-from-image.json`), routes every recognition
 * through the platform's own OCR service (`main/ocr.ts` — Windows OCR, Apple
 * Vision, or Tesseract on Linux), and wires its screens' IPC via
 * `registerIpc()`.
 *
 * Recognition itself deliberately does *not* happen inside `execute()`. OCR
 * takes anywhere from tens of milliseconds to several seconds, and the
 * launcher only decides whether to stay open once `execute()` resolves — so
 * the commands below navigate immediately with a `start` payload, and the
 * screen (`renderer/ReadTextScreen.tsx`) kicks the recognition off over IPC
 * where it can show progress and report a failure in place.
 *
 * Recognized text can be as sensitive as whatever was on screen when the
 * image was captured; see the privacy note in `main/store.ts`.
 */
export class TextFromImageExtension extends Extension {
  readonly store: RecognitionStore;
  private dialogs: TextFromImageDialogHost | null = null;

  constructor() {
    super("text-from-image");
    this.store = new RecognitionStore(this.storage);
  }

  /** Lets the file/save pickers open parented to the launcher window. */
  useDialogs(host: TextFromImageDialogHost): void {
    this.dialogs = host;
  }

  init(): void {
    this.store.init();
    // Probing the engine touches the native addon (and, on Linux, spawns
    // `tesseract --list-langs`) — do it now, in the background, so the first
    // open of the screen doesn't wait for it.
    void engineInfo().catch(() => undefined);
  }

  registerIpc(ipc: IpcMain): void {
    registerTextFromImageIpc(ipc, this);
  }

  engine(): Promise<EngineInfo> {
    return engineInfo();
  }

  /**
   * Run a modal dialog the way the launcher needs it: parented to the launcher
   * window, with blur-to-hide suppressed for the duration and focus handed back
   * afterwards.
   */
  private async withDialog<T>(
    run: (parent: BrowserWindow | null) => Promise<T>,
  ): Promise<T> {
    const parent = this.dialogs?.getLauncherWindow() ?? null;
    this.dialogs?.setSuppressAutoHide(true);
    try {
      return await run(parent);
    } finally {
      this.dialogs?.setSuppressAutoHide(false);
      parent?.focus();
    }
  }

  /** The image picker. `null` when the user dismissed it. */
  private pickImage(): Promise<string | null> {
    return this.withDialog(async (parent) => {
      const options = {
        title: "Read Text from Image",
        properties: ["openFile"] as Array<"openFile">,
        filters: [
          { name: "Images", extensions: IMAGE_EXTENSIONS },
          { name: "All Files", extensions: ["*"] },
        ],
      };
      const picked = parent
        ? await dialog.showOpenDialog(parent, options)
        : await dialog.showOpenDialog(options);
      return picked.canceled ? null : (picked.filePaths[0] ?? null);
    });
  }

  /**
   * Recognize whatever `request` points at and store the result.
   *
   * Never rejects: a missing clipboard image, an unreadable file and an
   * unavailable engine are all things the user did or the machine is, not
   * programming errors, so they come back as `{ ok: false, error }` for the
   * screen to render in place. A dismissed picker comes back as `cancelled`,
   * which the screen shows nothing for.
   */
  async recognizeFrom(request: RecognizeRequest): Promise<RecognizeResult> {
    try {
      let source: ImageSource;
      let image: PreparedImage;

      switch (request.kind) {
        case "clipboard": {
          const bytes = await readClipboardImage();
          if (!bytes) {
            return {
              ok: false,
              error:
                "There's no image on the clipboard. Copy or screenshot one first.",
            };
          }
          source = { kind: "clipboard" };
          image = fromBuffer(bytes);
          break;
        }
        case "file": {
          const path = await this.pickImage();
          if (!path) return { ok: false, cancelled: true };
          source = { kind: "file", path };
          image = fromPath(path);
          break;
        }
        case "path": {
          source = { kind: "file", path: request.path };
          image = fromPath(request.path);
          break;
        }
        case "bytes": {
          source = { kind: "drop", name: request.name };
          image = fromBuffer(Buffer.from(request.data));
          break;
        }
      }

      const info = await engineInfo();
      const startedAt = Date.now();
      const result = await recognize(image.png);
      const durationMs = Date.now() - startedAt;

      if (result.lines.length === 0) {
        return {
          ok: false,
          error: "No text was found in that image.",
        };
      }

      return {
        ok: true,
        recognition: this.store.record({
          source,
          thumbnailDataUrl: image.thumbnailDataUrl,
          imageSize: image.size,
          engine: info.id,
          language: result.language,
          lines: result.lines,
          confidence: result.confidence,
          durationMs,
        }),
      };
    } catch (error) {
      console.error("[text-from-image] recognition failed:", error);
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "That image couldn't be recognized.",
      };
    }
  }

  /**
   * Put a recognition on the clipboard in one of the text formats — the same
   * bytes the matching file export would contain, since both go through
   * `serialize`. Resolves `false` for an unknown id.
   */
  async copyAs(
    id: string,
    format: TextExportFormat,
    options: { table: boolean; includeConfidence: boolean },
  ): Promise<boolean> {
    const recognition = this.store.get(id);
    if (!recognition) return false;
    await clipboard.writeText(serialize(recognition, { format, ...options }));
    return true;
  }

  /**
   * The path the export form starts on: the user's Documents folder (or
   * Downloads, whichever exists) plus a name derived from the recognition.
   */
  suggestPath(id: string, format: ExportFormat): string {
    const recognition = this.store.get(id);
    const extension =
      EXPORT_FORMATS.find((entry) => entry.id === format)?.extension ?? format;
    const name = recognition
      ? suggestFilename(recognition, format, extension)
      : `scan.${extension}`;
    return join(app.getPath("documents"), name);
  }

  /** The Save-As picker, seeded from `suggestPath`. `null` when dismissed. */
  chooseExportPath(id: string, format: ExportFormat): Promise<string | null> {
    const entry = EXPORT_FORMATS.find((format_) => format_.id === format);
    return this.withDialog(async (parent) => {
      const options = {
        title: `Export as ${entry?.label ?? format}`,
        defaultPath: this.suggestPath(id, format),
        filters: [
          {
            name: entry?.label ?? format,
            extensions: [entry?.extension ?? format],
          },
        ],
      };
      const picked = parent
        ? await dialog.showSaveDialog(parent, options)
        : await dialog.showSaveDialog(options);
      return picked.canceled ? null : (picked.filePath ?? null);
    });
  }

  /**
   * Write a recognition to disk. Like `recognizeFrom`, reports failure as a
   * value rather than rejecting, so the export screen can show it in place.
   */
  async exportAs(id: string, options: ExportOptions): Promise<ExportResult> {
    const recognition = this.store.get(id);
    if (!recognition) return { ok: false, error: "That recognition is gone." };

    // Guard the one way a path can arrive without an extension: the user
    // cleared it in the picker. Excel in particular refuses to open a
    // correctly-formed workbook that isn't named `.xlsx`.
    const entry = EXPORT_FORMATS.find((format) => format.id === options.format);
    const path = extname(options.path)
      ? options.path
      : `${options.path}.${entry?.extension ?? options.format}`;

    try {
      await exportRecognition(recognition, { ...options, path });
      return { ok: true, path };
    } catch (error) {
      console.error("[text-from-image] export failed:", error);
      return {
        ok: false,
        error:
          error instanceof Error
            ? `That file couldn't be written (${error.message}).`
            : "That file couldn't be written.",
      };
    }
  }

  /** Show an exported file in Explorer/Finder. */
  reveal(path: string): void {
    shell.showItemInFolder(path);
  }

  provide(): ActionDefinition[] {
    return [
      {
        action: {
          id: "text-from-image:open",
          title: "Read Text from Image",
          subtitle: "Extract text and convert it to text, JSON, Excel or PDF",
          icon: "🔎",
          type: "command",
        },
        run: () => {},
      },
      {
        action: {
          id: "text-from-image:clipboard",
          title: "Read Text from Clipboard Image",
          subtitle: "Recognize the image currently on the clipboard",
          icon: "📋",
          type: "command",
        },
        run: () => {},
      },
      {
        action: {
          id: "text-from-image:file",
          title: "Read Text from Image File",
          subtitle: "Pick an image and recognize it",
          icon: "🖼️",
          type: "command",
        },
        run: () => {},
      },
    ];
  }

  async execute(actionId: string): Promise<void> {
    switch (actionId) {
      case "text-from-image:clipboard":
        this.ctx.navigate(TEXT_FROM_IMAGE_ROUTE, { start: "clipboard" });
        return;
      case "text-from-image:file":
        this.ctx.navigate(TEXT_FROM_IMAGE_ROUTE, { start: "file" });
        return;
      default:
        this.ctx.navigate(TEXT_FROM_IMAGE_ROUTE);
    }
  }
}
