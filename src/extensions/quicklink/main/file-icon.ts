/**
 * The system icon for a file or folder a quicklink points at, as a `data:` URI.
 *
 * The same shape as `fetchFavicon`, and for the same reason: the launcher's CSP
 * is `img-src 'self' data:`, so the bytes have to be inlined here rather than
 * referenced. Using the OS's own icon means a `.pdf` looks like a PDF and a
 * folder looks like a folder, per-platform, with no icon set to maintain.
 */
import { app } from "electron";
import { stat } from "node:fs/promises";
import { normalizeLink } from "./store";

/**
 * `link` as the OS draws it — `~` expanded, `file://` stripped. Null when the
 * link isn't a path that exists, so the caller can fall back to a monogram
 * rather than showing the generic "unknown document" icon for a typo.
 */
export async function fileIcon(link: string): Promise<string | null> {
  const path = normalizeLink(link).replace(/^file:\/\//i, "");
  if (!path) return null;

  try {
    // getFileIcon answers for a missing path too, with a generic placeholder —
    // check first so a half-typed path stays on the monogram instead.
    await stat(path);
    const image = await app.getFileIcon(path, { size: "normal" });
    return image.isEmpty() ? null : image.toDataURL();
  } catch {
    return null;
  }
}
