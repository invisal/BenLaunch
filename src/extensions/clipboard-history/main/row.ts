/**
 * Clipboard entries as root-list rows, and writing an entry back to the OS
 * clipboard — the Electron-touching glue between `ClipboardStore` and the
 * extension's `provide()`/`execute()`/IPC handlers.
 */
import { clipboard, ClipboardItem, nativeImage } from "electron";
import type { LauncherAction } from "@shared/types";
import { downsize } from "./image";
import type { ClipboardPoller } from "./poller";
import { ENTRY_ACTION_PREFIX, type ClipboardEntry } from "../shared/types";

/** `clipboard-history:entry:<id>` → `<id>`; `null` for any other action id. */
export function entryId(actionId: string): string | null {
  return actionId.startsWith(ENTRY_ACTION_PREFIX)
    ? actionId.slice(ENTRY_ACTION_PREFIX.length)
    : null;
}

/**
 * An entry as a root-list row. Unpinned entries are `hidden` — excluded from
 * the empty-query root list, but still matched (by `preview`) for an
 * explicit search, the same flag quicklinks use for this exact purpose.
 * Pinned entries are never hidden, so they float to the top like a pinned
 * calculator entry.
 */
export function entryRow(entry: ClipboardEntry): LauncherAction {
  return {
    id: `${ENTRY_ACTION_PREFIX}${entry.id}`,
    title: entry.preview,
    icon: entry.contentType === "image" ? entry.imageDataUrl : "📋",
    type: "clipboard",
    pinned: entry.pinned,
    hidden: !entry.pinned,
  };
}

/**
 * Write an entry back to the OS clipboard, through the poller's
 * `writeExclusive` so its next tick doesn't record this write as a new
 * history entry.
 */
export async function writeEntryToClipboard(
  entry: ClipboardEntry,
  poller: ClipboardPoller,
): Promise<void> {
  if (entry.contentType === "text" && entry.text !== undefined) {
    const text = entry.text;
    await poller.writeExclusive(() => clipboard.writeText(text));
    return;
  }
  if (entry.contentType === "image" && entry.imageDataUrl) {
    const png = downsize(
      nativeImage.createFromDataURL(entry.imageDataUrl),
    ).toPNG();
    await poller.writeExclusive(() =>
      clipboard.write([
        new ClipboardItem({
          "image/png": new Blob([png], { type: "image/png" }),
        }),
      ]),
    );
  }
}
