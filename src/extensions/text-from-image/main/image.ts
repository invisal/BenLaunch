/**
 * Getting an image *into* the extension: from the clipboard, a file picker, a
 * path, or bytes dropped on the window — and back out as the two things the
 * rest of the extension needs, a full-resolution PNG for the OCR engine and a
 * small data URL for the UI.
 *
 * Resolution matters in opposite directions for those two. The engine wants
 * every pixel it can get (downscaling a screenshot before recognizing it is
 * the single fastest way to turn good OCR into bad), while the stored
 * thumbnail wants to stay small enough that a few hundred recognitions don't
 * bloat `text-from-image.json`. So the original is passed to the engine
 * untouched and only the preview is downsized — unlike Clipboard History,
 * which stores one downsized copy for both jobs.
 */
import { nativeImage, type NativeImage } from "electron";

/** Longest edge of the stored preview, in px. */
const THUMBNAIL_MAX = 480;

/**
 * Shortest edge `Windows.Media.Ocr` accepts (it rejects anything under 40px
 * outright) and roughly where Vision and Tesseract start struggling too, so a
 * tiny crop is upscaled before recognition rather than failing or returning
 * nothing. Scaling up invents no detail, but it does let the engines' own
 * binarization work at the size they expect.
 */
const MIN_OCR_EDGE = 80;

/** Longest edge passed to an engine. Beyond this the extra pixels cost time without helping. */
const MAX_OCR_EDGE = 4096;

/** File types the picker offers and the drop handler accepts. */
export const IMAGE_EXTENSIONS = [
  "png",
  "jpg",
  "jpeg",
  "bmp",
  "gif",
  "tif",
  "tiff",
  "webp",
];

export interface PreparedImage {
  /** Full-resolution (or up/down-scaled to the engine's working range) PNG bytes. */
  png: Buffer;
  /** Small PNG data URL for the row icon and the detail pane. */
  thumbnailDataUrl: string;
  /** The *source* image's dimensions, before any scaling done here. */
  size: { width: number; height: number };
}

function scaleTo(image: NativeImage, longestEdge: number): NativeImage {
  const { width, height } = image.getSize();
  const scale = longestEdge / Math.max(width, height);
  return image.resize({
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    quality: "best",
  });
}

/**
 * Normalizes whatever `nativeImage` we were handed into the pair above.
 * Throws when the image is empty — a path that isn't an image, or a clipboard
 * whose image slot is blank — so the caller can report that instead of
 * recognizing nothing and calling it a result.
 */
function prepare(image: NativeImage): PreparedImage {
  if (image.isEmpty()) {
    throw new Error("That file isn't an image this app can read.");
  }
  const size = image.getSize();

  let forEngine = image;
  const longest = Math.max(size.width, size.height);
  const shortest = Math.min(size.width, size.height);
  if (shortest < MIN_OCR_EDGE) {
    forEngine = scaleTo(image, Math.round((longest * MIN_OCR_EDGE) / shortest));
  } else if (longest > MAX_OCR_EDGE) {
    forEngine = scaleTo(image, MAX_OCR_EDGE);
  }

  const thumbnail =
    longest > THUMBNAIL_MAX ? scaleTo(image, THUMBNAIL_MAX) : image;

  return {
    png: forEngine.toPNG(),
    // `resize` can come back empty for a degenerate size; fall back to the
    // original rather than storing a recognition with no preview at all.
    thumbnailDataUrl: thumbnail.isEmpty()
      ? image.toDataURL()
      : thumbnail.toDataURL(),
    size,
  };
}

export function fromPath(path: string): PreparedImage {
  return prepare(nativeImage.createFromPath(path));
}

export function fromBuffer(data: Buffer): PreparedImage {
  return prepare(nativeImage.createFromBuffer(data));
}
