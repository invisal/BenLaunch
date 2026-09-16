/**
 * Writing a clipboard entry back to the OS clipboard — the Electron-touching
 * glue between `ClipboardStore` and the extension's IPC handlers.
 */
import { clipboard, ClipboardItem, nativeImage } from "electron";
import { downsize } from "./image";
import type { ClipboardPoller } from "./poller";
import type { ClipboardEntry } from "../shared/types";

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
