import type { AnchorPosition } from "./types";

/**
 * The anchor step shared by everything that places a custom layout's rect: the
 * real placement (`computeCustomRect`), the search row's icon
 * (`customLayoutIcon`), and the editor's live preview (`LayoutPreview`). Those
 * three are meant to agree with each other, and this is what makes them.
 *
 * Offsets, gap, and "Auto" sizing are the caller's business — this only answers
 * "where does a `size` rect sit inside a `box`, anchored at `position`".
 */
export function anchorOrigin(
  position: AnchorPosition,
  size: { width: number; height: number },
  box: { width: number; height: number },
): { x: number; y: number } {
  const [vAnchor, hAnchor] = position.split("-") as [
    "top" | "middle" | "bottom",
    "left" | "center" | "right",
  ];
  return {
    x:
      hAnchor === "left"
        ? 0
        : hAnchor === "right"
          ? box.width - size.width
          : (box.width - size.width) / 2,
    y:
      vAnchor === "top"
        ? 0
        : vAnchor === "bottom"
          ? box.height - size.height
          : (box.height - size.height) / 2,
  };
}

/**
 * What an "Auto" (`null`) axis is drawn at where there's no real window to
 * measure. Both the icon and the preview need *a* size to show; this is purely
 * a display choice, unrelated to `computeCustomRect`'s real Auto fallback
 * (which keeps the target window's own size).
 */
export const AUTO_PREVIEW_FRACTION = 0.6;
