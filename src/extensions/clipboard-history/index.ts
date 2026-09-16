import { clipboard, nativeImage, type IpcMain } from "electron";
import { Extension } from "@core/base";
import type { ActionDefinition } from "@main/types";
import { resolveIcon } from "@main/native/apps-mac";
import { registerClipboardHistoryIpc } from "./ipc/handlers";
import { downsize } from "./main/image";
import { ClipboardPoller, type ImageSource } from "./main/poller";
import { pasteboardChangeEvent as pasteboardChangeEventLinux } from "./main/pasteboard-change-linux";
import { pasteboardChangeSignal } from "./main/pasteboard-change-mac";
import { pasteboardChangeEvent as pasteboardChangeEventWin } from "./main/pasteboard-change-win";
import { entryId, entryRow, writeEntryToClipboard } from "./main/row";
import { frontmostApp } from "./main/source-app-mac";
import { ClipboardStore } from "./main/store";
import { CLIPBOARD_HISTORY_ROUTE, type SourceApp } from "./shared/types";

/** The frontmost app at copy time, with its icon — `undefined` wherever `frontmostApp()` can't resolve one (non-macOS, permission not granted, etc). */
async function resolveSourceApp(): Promise<SourceApp | undefined> {
  const app = await frontmostApp();
  if (!app) return undefined;
  return { name: app.name, icon: await resolveIcon(app.path) };
}

/**
 * Clipboard History (Raycast's "Clipboard History"): watches the system
 * clipboard, keeps a searchable, persisted history of copied text and
 * images, and lets the user re-copy, paste, pin or delete past entries —
 * both from its own list screen (`../screen.tsx`, route
 * `clipboard-history`) and, for pinned/matching entries, directly from the
 * root launcher search (see `main/row.ts::entryRow`).
 *
 * As the extension's composition root it owns the `ClipboardStore`
 * (persisted through `this.storage`,
 * `<userData>/extensions/clipboard-history.json`) and the `ClipboardPoller`
 * that watches Electron's `clipboard` module. Electron itself has no native
 * clipboard-change event, so absent a platform-specific `changeEvent` this
 * falls back to a background `setInterval` — on Windows and Linux,
 * `pasteboardChangeEvent()` supplies a real push notification instead
 * (`AddClipboardFormatListener` via `@magibar/win`, or an XFixes `CLIPBOARD`
 * selection watch via `@magibar/linux`), so no interval runs there at all.
 * Either way the poller is started at `init()` and stopped at `stopPolling()`
 * (called from `main/index.ts`'s `will-quit` handler).
 *
 * Captured content may include sensitive data (passwords, tokens); see the
 * privacy note in `main/store.ts`.
 */
export class ClipboardHistoryExtension extends Extension {
  readonly store: ClipboardStore;
  private readonly poller: ClipboardPoller;

  constructor() {
    super("clipboard-history");
    this.store = new ClipboardStore(this.storage);
    this.poller = new ClipboardPoller(
      clipboard,
      (text) => void this.recordText(text),
      (png, source) => void this.recordImage(png, source),
      undefined, // default intervalMs
      undefined, // default readFile
      pasteboardChangeSignal(),
      pasteboardChangeEventWin() ?? pasteboardChangeEventLinux(),
    );
  }

  private async recordText(text: string): Promise<void> {
    this.store.record({
      contentType: "text",
      text,
      sourceApp: await resolveSourceApp(),
    });
  }

  private async recordImage(png: Buffer, source?: ImageSource): Promise<void> {
    // Capture the *original* dimensions before downsizing — what the detail
    // pane shows should describe the real thing that was copied, not the
    // (possibly smaller) stored preview.
    const original = nativeImage.createFromBuffer(png);
    const originalSize = original.getSize();
    const image = downsize(original);
    this.store.record({
      contentType: "image",
      dataUrl: image.toDataURL(),
      width: originalSize.width,
      height: originalSize.height,
      originalBytes: png.length,
      sourcePath: source?.path,
      sourceApp: await resolveSourceApp(),
    });
  }

  init(): void {
    this.store.init();
    void this.poller.start();
  }

  /** Called from `main/index.ts`'s `will-quit` handler, alongside `globalShortcut.unregisterAll()`. */
  stopPolling(): void {
    this.poller.stop();
  }

  registerIpc(ipc: IpcMain): void {
    registerClipboardHistoryIpc(ipc, this.store, this.poller);
  }

  provide(): ActionDefinition[] {
    const open: ActionDefinition = {
      action: {
        id: "clipboard-history:open",
        title: "Clipboard History",
        subtitle: "Search, copy, paste and pin recent clipboard items",
        icon: "📋",
        type: "command",
      },
      run: () => {},
    };
    const entries = this.store.list().map((entry) => ({
      action: entryRow(entry),
      run: () => {},
    }));
    return [open, ...entries];
  }

  async execute(actionId: string): Promise<void> {
    if (actionId === "clipboard-history:open") {
      this.ctx.navigate(CLIPBOARD_HISTORY_ROUTE);
      return;
    }
    const id = entryId(actionId);
    const entry = id ? this.store.get(id) : undefined;
    if (entry) await writeEntryToClipboard(entry, this.poller);
  }
}
