import { cn } from "cnfast";
import type { AnchorPosition } from "@shared/types";

/** The nine anchors, in reading order — the layout of the form's 3×3 picker. */
export const POSITIONS: AnchorPosition[] = [
  "top-left",
  "top-center",
  "top-right",
  "middle-left",
  "middle-center",
  "middle-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

/** Filled-rect geometry for each anchor's `PositionGlyph`, as percentages of the icon box. */
const POSITION_GLYPH_RECT: Record<
  AnchorPosition,
  { left: number; top: number; width: number; height: number }
> = {
  "top-left": { left: 8, top: 8, width: 50, height: 50 },
  "top-center": { left: 8, top: 8, width: 84, height: 34 },
  "top-right": { left: 42, top: 8, width: 50, height: 50 },
  "middle-left": { left: 8, top: 8, width: 34, height: 84 },
  "middle-center": { left: 25, top: 25, width: 50, height: 50 },
  "middle-right": { left: 58, top: 8, width: 34, height: 84 },
  "bottom-left": { left: 8, top: 42, width: 50, height: 50 },
  "bottom-center": { left: 8, top: 58, width: 84, height: 34 },
  "bottom-right": { left: 42, top: 42, width: 50, height: 50 },
};

/**
 * Mini "screen with a highlighted window region" icon — one per anchor,
 * sized/placed to read at a glance. Fills whatever box it's given, so the form's
 * 3×3 picker and the manager list's row icon can size it differently.
 *
 * The launcher's own `win:custom:*` rows get a richer icon from the main process
 * (`customLayoutIcon`, which reflects the real width/height too); this is the
 * renderer-side equivalent, and deliberately shows only the anchor.
 */
export function PositionGlyph({
  position,
  selected,
}: {
  position: AnchorPosition;
  selected?: boolean;
}) {
  const { left, top, width, height } = POSITION_GLYPH_RECT[position];

  return (
    <span
      className={cn(
        "relative block h-full w-full rounded-[5px] border",
        selected ? "border-foreground/70" : "border-foreground-subtle/40",
      )}
    >
      <span
        className={cn(
          "absolute rounded-[3px]",
          selected ? "bg-foreground" : "bg-foreground-subtle",
        )}
        style={{
          left: `${left}%`,
          top: `${top}%`,
          width: `${width}%`,
          height: `${height}%`,
        }}
      />
    </span>
  );
}
