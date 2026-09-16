/**
 * Caps a `nativeImage`'s dimensions before it's stored or pasted back — keeps
 * `clipboard-history.json` bounded and thumbnail rendering cheap. Pasting
 * back is therefore the downsized version, not the original-resolution
 * bytes: a deliberate quality trade-off for v1.
 */
import type { NativeImage } from "electron";

const MAX_DIMENSION = 1024;

export function downsize(
  image: NativeImage,
  maxDim = MAX_DIMENSION,
): NativeImage {
  const { width, height } = image.getSize();
  if (width <= maxDim && height <= maxDim) return image;

  const scale = maxDim / Math.max(width, height);
  return image.resize({
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  });
}
