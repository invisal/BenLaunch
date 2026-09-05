import type { SettingsStore } from "../../settings/store";
import type { ActionDefinition } from "../../types";
import type { CustomLayoutDef } from "../../../shared/types";
import {
  applyCustomLayout,
  applyRegion,
  GRID_REGION_IDS,
  moveToDisplay,
  moveToEdge,
  regionSpan,
  restore,
  toggleFullscreen,
  type CustomLayoutGeometry,
  type EdgeDirection,
  type FractionSpan,
  type GridRegion,
  type SnapRegion,
} from "../../window/control";
import type { ActionSource } from "../base";
import type { CustomLayoutStore } from "./custom-store";

/**
 * `window/control` has a backend for all three desktop platforms — see
 * `control-win.ts`/`control-mac.ts`/`control-linux.ts`.
 */
const SUPPORTED_PLATFORM =
  process.platform === "win32" || process.platform === "darwin" || process.platform === "linux";

/**
 * Window-management commands (`win:` ids) — halves, quarters, thirds/two-thirds,
 * sixths, fourths, three-fourths, and the top/bottom row equivalents of
 * third/two-thirds/three-fourths, using ordinal naming ("First/Last Third", not
 * "Left/Right Third" — Left/Right is reserved for the halves), plus a useful
 * extra, "Almost Maximize" (a 90%-size centered window).
 *
 * Every command acts on the window captured just before the launcher stole
 * focus — see `toggleLauncher()` in `index.ts`. These entries just tell the
 * platform control module which region, edge, display direction, or toggle to
 * apply. No command has a global keyboard shortcut of its own today (they only
 * run from the launcher); direct hotkeys are coming back once there's a
 * settings UI to let the user assign/rebind them per command.
 *
 * A static list like `BuiltinCommandSource`; add a region to `GRID_REGIONS` in
 * `layout.ts` and it shows up in search with no other wiring — `gridRegion()`
 * derives every grid command's title and icon from its id alone.
 */
/** Id prefix for a saved custom layout's searchable command, e.g. `win:custom:sidebar`. */
const CUSTOM_LAYOUT_PREFIX = "win:custom:";

export class WindowManagementSource implements ActionSource {
  readonly id = "win";

  private readonly definitions: ActionDefinition[] = buildDefinitions();

  constructor(
    private readonly settings: SettingsStore,
    private readonly customLayoutStore: CustomLayoutStore,
  ) {}

  provide(): ActionDefinition[] {
    return [...this.definitions, ...this.customLayoutDefinitions()];
  }

  owns(actionId: string): boolean {
    return actionId.startsWith(`${this.id}:`);
  }

  async execute(actionId: string): Promise<void> {
    if (actionId.startsWith(CUSTOM_LAYOUT_PREFIX)) {
      const def = this.customLayoutStore.get(actionId.slice(CUSTOM_LAYOUT_PREFIX.length));
      if (def) void applyCustomLayout(toGeometry(def), def.useGap, this.settings.getGapSize());
      return;
    }
    await this.definitions
      .find((definition) => definition.action.id === actionId)
      ?.run();
  }

  /** Each saved custom layout, as a searchable `win:custom:<id>` command. Read fresh every call — the manage window can add/edit/remove them at any time. */
  private customLayoutDefinitions(): ActionDefinition[] {
    return this.customLayoutStore.list().map((def) => ({
      action: {
        id: `${CUSTOM_LAYOUT_PREFIX}${def.id}`,
        title: def.name,
        subtitle: "Window Management · Custom",
        icon: customLayoutIcon(def),
        type: "command",
      },
      run: () => {
        void applyCustomLayout(toGeometry(def), def.useGap, this.settings.getGapSize());
      },
    }));
  }
}

/** `CustomLayoutDef`'s persisted percent/id shape → `computeCustomRect`'s fraction-based geometry. */
function toGeometry(def: CustomLayoutDef): CustomLayoutGeometry {
  return {
    position: def.position,
    widthFraction: def.widthPercent != null ? def.widthPercent / 100 : null,
    heightFraction: def.heightPercent != null ? def.heightPercent / 100 : null,
    offsetXFraction: def.offsetXPercent / 100,
    offsetYPoints: def.offsetYPoints,
  };
}

/**
 * Title overrides for the few grid regions whose id doesn't title-case into
 * the right name on its own — today just the original four quarters, which
 * add "Quarter" to disambiguate from the halves (`top-left` alone would read
 * as a position, not a size). Every other grid region's title is exactly its
 * id, kebab-cased (`"top-left-sixth"` → "Top Left Sixth").
 */
const GRID_TITLE_OVERRIDES: Partial<Record<GridRegion, string>> = {
  "top-left": "Top Left Quarter",
  "top-right": "Top Right Quarter",
  "bottom-left": "Bottom Left Quarter",
  "bottom-right": "Bottom Right Quarter",
};

/**
 * All commands — empty on a platform `window/control` has no backend for at
 * all, rather than listing commands that would silently do nothing when run.
 * (Today this only matters for an unrecognized `process.platform`; win32,
 * darwin, and linux are all covered.)
 */
function buildDefinitions(): ActionDefinition[] {
  if (!SUPPORTED_PLATFORM) return [];

  return [
    ...GRID_REGION_IDS.map((id) => gridRegion(id)),
    region("center", "Center"),
    region("center-half", "Center Half"),
    region("almost-maximize", "Almost Maximize"),
    region("maximize", "Maximize"),
    region("maximize-width", "Maximize Width"),
    region("maximize-height", "Maximize Height"),
    edge("move-left", "Move Left", "⇤", "left"),
    edge("move-right", "Move Right", "⇥", "right"),
    edge("move-up", "Move Up", "⤒", "up"),
    edge("move-down", "Move Down", "⤓", "down"),
    {
      action: {
        id: "win:toggle-fullscreen",
        title: "Toggle Fullscreen",
        subtitle: "Window Management",
        icon: "⛶",
        type: "command",
      },
      run: () => {
        void toggleFullscreen();
      },
    },
    display("next-display", "Move to Next Display", "→", "next"),
    display("previous-display", "Move to Previous Display", "←", "previous"),
    {
      action: {
        id: "win:restore",
        title: "Restore",
        subtitle: "Window Management",
        icon: "↺",
        type: "command",
      },
      run: () => {
        void restore();
      },
    },
  ];
}

/**
 * Build one snap command. The icon is a generated SVG diagram of the target
 * region (see `snapIcon`). Used directly for the handful of regions that
 * aren't a fixed grid fraction (`center`/`almost-maximize`/`maximize*`, which
 * need a hand-picked title); every `GridRegion` instead goes through
 * `gridRegion()`, which derives the title for you.
 */
function region(id: SnapRegion, title: string): ActionDefinition {
  return {
    action: {
      id: `win:${id}`,
      title,
      subtitle: "Window Management",
      icon: snapIcon(id),
      type: "command",
    },
    run: () => {
      void applyRegion(id);
    },
  };
}

/**
 * Build one grid region command — title from `GRID_TITLE_OVERRIDES`, falling
 * back to `id` title-cased. `id` comes straight from `GRID_REGION_IDS`, so
 * unlike a hand-typed id there's no id/title/geometry to keep in sync.
 */
function gridRegion(id: GridRegion): ActionDefinition {
  const title =
    GRID_TITLE_OVERRIDES[id] ??
    id
      .split("-")
      .map((word) => word[0].toUpperCase() + word.slice(1))
      .join(" ");
  return region(id, title);
}

/** Build a "move to the edge, unresized" command. Uses an arrow-to-bar glyph rather than the region-diagram icon. */
function edge(id: string, title: string, icon: string, dir: EdgeDirection): ActionDefinition {
  return {
    action: {
      id: `win:${id}`,
      title,
      subtitle: "Window Management",
      icon,
      type: "command",
    },
    run: () => {
      void moveToEdge(dir);
    },
  };
}

/** Build a "move to adjacent display" command. Doesn't fit the region-diagram icon metaphor, so uses an emoji. */
function display(
  id: string,
  title: string,
  icon: string,
  dir: "next" | "previous",
): ActionDefinition {
  return {
    action: {
      id: `win:${id}`,
      title,
      subtitle: "Window Management",
      icon,
      type: "command",
    },
    run: () => {
      void moveToDisplay(dir);
    },
  };
}

/**
 * The filled sub-rectangle each region occupies inside the monitor frame, in the
 * icon's `0 0 24 24` viewBox. Hand-tuned only for the original 19 regions (a ~1px
 * gutter at each split so the division reads clearly at 20px; `maximize` fills
 * the whole inner area; `center`/`center-half`/`almost-maximize` are centered
 * rects of their own size; `maximize-width`/`maximize-height` are full-span
 * bands). Every region added since falls back to `iconRectFromSpan`, which
 * derives the same shape from `regionSpan` — see `snapIcon`.
 */
const REGION_RECT: Partial<Record<SnapRegion, readonly [x: number, y: number, w: number, h: number]>> = {
  "left-half": [4, 5, 7.5, 14],
  "right-half": [12.5, 5, 7.5, 14],
  "top-half": [4, 5, 16, 6.5],
  "bottom-half": [4, 12.5, 16, 6.5],
  "center-half": [8, 8.5, 8, 7],
  "top-left": [4, 5, 7.5, 6.5],
  "top-right": [12.5, 5, 7.5, 6.5],
  "bottom-left": [4, 12.5, 7.5, 6.5],
  "bottom-right": [12.5, 12.5, 7.5, 6.5],
  "first-third": [4, 5, 4.6667, 14],
  "center-third": [9.6667, 5, 4.6667, 14],
  "last-third": [15.3333, 5, 4.6667, 14],
  "first-two-thirds": [4, 5, 10.3333, 14],
  "last-two-thirds": [9.6667, 5, 10.3333, 14],
  center: [7, 8, 10, 8],
  "almost-maximize": [4.8, 5.7, 14.4, 12.6],
  maximize: [4, 5, 16, 14],
  "maximize-width": [4, 8, 16, 6],
  "maximize-height": [9, 5, 6, 14],
};

/** The monitor frame's inner area in the icon's `0 0 24 24` viewBox — see `REGION_RECT`. */
const ICON_INNER = { x: 4, y: 5, width: 16, height: 14 };

/** Same ~1px gutter `REGION_RECT`'s hand-tuned entries use at each split. */
const ICON_GUTTER = 1;

/**
 * Derives an icon rect from a region's real `{ col, row }` fraction span,
 * for any region `REGION_RECT` doesn't hand-list. Shrinks each edge that
 * doesn't already touch the frame's edge by half the gutter, so two adjacent
 * regions' fills still read as separated even though nothing here knows how
 * many slots they're tiled into (unlike `REGION_RECT`'s hand-picked numbers,
 * which divide the gutter across the exact tile count).
 */
function iconRectFromSpan(span: {
  col: FractionSpan;
  row: FractionSpan;
}): readonly [x: number, y: number, w: number, h: number] {
  function inset(fraction: FractionSpan, total: number): [start: number, size: number] {
    const startGutter = fraction.start > 0 ? ICON_GUTTER / 2 : 0;
    const endGutter = fraction.start + fraction.size < 1 ? ICON_GUTTER / 2 : 0;
    return [fraction.start * total + startGutter, fraction.size * total - startGutter - endGutter];
  }
  const [x, w] = inset(span.col, ICON_INNER.width);
  const [y, h] = inset(span.row, ICON_INNER.height);
  return [ICON_INNER.x + x, ICON_INNER.y + y, w, h];
}

/**
 * A `data:` SVG showing a monitor outline with `rect` filled — rendered as an
 * `<img>` by `SearchItem`, so colours are baked for the launcher's dark UI
 * (`--color-foreground-subtle` frame, `--color-foreground` fill).
 */
function iconSvg(rect: readonly [x: number, y: number, w: number, h: number]): string {
  const [x, y, w, h] = rect;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="#8a8582" stroke-width="1.5"/>` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1" fill="#f5f5f4"/>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** A named region's icon: `REGION_RECT`'s hand-tuned rect, or `iconRectFromSpan` derived from its real geometry. */
function snapIcon(id: SnapRegion): string {
  return iconSvg(REGION_RECT[id] ?? iconRectFromSpan(regionSpan(id)!));
}

/**
 * A saved custom layout's icon — same anchor math as `computeCustomRect`
 * (position anchor + width/height), applied directly to the icon's inner
 * frame instead of a real work area. Ignores offset/gap: those shift the rect
 * by a few px on a real screen, which would be imperceptible (or misleading)
 * at icon scale, so the icon shows just the size/anchor at a glance. "Auto"
 * (`null`) sizing has no real window to measure here, so it previews as 60%.
 */
function customLayoutIcon(def: CustomLayoutDef): string {
  const w = (def.widthPercent != null ? def.widthPercent / 100 : 0.6) * ICON_INNER.width;
  const h = (def.heightPercent != null ? def.heightPercent / 100 : 0.6) * ICON_INNER.height;
  const [vAnchor, hAnchor] = def.position.split("-") as [
    "top" | "middle" | "bottom",
    "left" | "center" | "right",
  ];
  const x =
    hAnchor === "left" ? 0 : hAnchor === "right" ? ICON_INNER.width - w : (ICON_INNER.width - w) / 2;
  const y =
    vAnchor === "top" ? 0 : vAnchor === "bottom" ? ICON_INNER.height - h : (ICON_INNER.height - h) / 2;
  return iconSvg([ICON_INNER.x + x, ICON_INNER.y + y, w, h]);
}
