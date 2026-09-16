/**
 * Clipboard History's wire contract — the DTOs and IPC channel names shared by
 * the extension's main handlers (`../ipc/handlers.ts`), its preload fragment
 * (`../ipc/preload.ts`) and its renderer screen (`../renderer/`).
 */

/** The app that had focus when an entry was copied — see `../main/source-app-mac.ts`. macOS only; absent everywhere else, and on entries recorded before this field existed. */
export interface SourceApp {
  name: string;
  /** PNG data URL, when the app's icon could be resolved. */
  icon?: string;
}

/** One recorded clipboard item — text or a downsized image snapshot. */
export interface ClipboardEntry {
  id: string;
  contentType: "text" | "image";
  /** `contentType: "text"` — the full copied text. */
  text?: string;
  /** `contentType: "image"` — a downsized PNG data URL (see `../main/image.ts`). */
  imageDataUrl?: string;
  /** `contentType: "image"` — the *original* image's dimensions, before any
   *  downsizing applied to `imageDataUrl` — what's shown in the detail pane,
   *  not the stored preview's own (possibly smaller) size. */
  imageSize?: { width: number; height: number };
  /** Byte size of what was actually captured — the source file on disk, or
   *  the raw bytes read off the clipboard — before any downsizing/
   *  re-encoding applied to `imageDataUrl`/`text` for storage. Absent on
   *  entries recorded before this field existed. */
  originalBytes?: number;
  /** `contentType: "image"` — the source file's path, when this entry came
   *  from copying a *file* (e.g. ⌘C on an icon in Finder) rather than raw
   *  image bytes already on the clipboard. */
  sourcePath?: string;
  /** The frontmost app at copy time, when it could be resolved. */
  sourceApp?: SourceApp;
  /** Row label: a truncated/whitespace-collapsed text preview, or `"Image · WxH"`. */
  preview: string;
  /** Epoch ms this entry was recorded. Never updated — copying the same text
   *  again later creates a new entry rather than refreshing this one. */
  createdAt: number;
  pinned: boolean;
}

/** What the poller hands the store to record — the store assigns `id`/`createdAt`/`preview`. */
export type RecordInput =
  | { contentType: "text"; text: string; sourceApp?: SourceApp }
  | {
      contentType: "image";
      dataUrl: string;
      width: number;
      height: number;
      originalBytes: number;
      sourcePath?: string;
      sourceApp?: SourceApp;
    };

/** Route name of the history list screen (`../screen.tsx`). */
export const CLIPBOARD_HISTORY_ROUTE = "clipboard-history";

export const CLIPBOARD_HISTORY_CHANNELS = {
  list: "clipboard-history:list",
  delete: "clipboard-history:delete",
  clear: "clipboard-history:clear",
  setPinned: "clipboard-history:set-pinned",
  copyAgain: "clipboard-history:copy-again",
} as const;
