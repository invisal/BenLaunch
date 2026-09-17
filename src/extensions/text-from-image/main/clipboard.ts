/**
 * Reading an image off the system clipboard.
 *
 * This Electron version's `clipboard` module is the async, Web-standard
 * `ClipboardItem`-based API — there is no synchronous `readImage()` any more —
 * so getting the pixels means walking the items for an `image/*` type and
 * pulling its `Blob`. Same shape Clipboard History's poller uses
 * (`@extensions/clipboard-history/main/poller.ts`), kept separate here because
 * this one reads on demand rather than on a tick.
 */
import { clipboard } from "electron";

const IMAGE_FORMAT = /^image\//;

/**
 * The first image on the clipboard as raw bytes, or `null` when there is none.
 * The bytes are whatever format the clipboard held (usually PNG);
 * `nativeImage.createFromBuffer` decodes it in `./image.ts`.
 */
export async function readClipboardImage(): Promise<Buffer | null> {
  for (const item of await clipboard.read()) {
    const type = item.types.find((candidate) => IMAGE_FORMAT.test(candidate));
    if (!type) continue;
    const value = await item.getType(type);
    if (value instanceof Blob) return Buffer.from(await value.arrayBuffer());
  }
  return null;
}
