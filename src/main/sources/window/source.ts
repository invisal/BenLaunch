import type { SettingsStore } from "../../settings/store";
import type { ActionDefinition } from "../../types";
import {
  applyRegion,
  moveToDisplay,
  moveToEdge,
  restore,
  toggleFullscreen,
  type EdgeDirection,
  type SnapRegion,
} from "../../window/control";
import { DEFAULT_WINDOW_SHORTCUTS } from "../../window/shortcuts";
import type { ActionSource } from "../base";

/**
 * `window/control` has a backend for all three desktop platforms — see
 * `control-win.ts`/`control-mac.ts`/`control-linux.ts`.
 */
const SUPPORTED_PLATFORM =
  process.platform === "win32" || process.platform === "darwin" || process.platform === "linux";

/**
 * Window-management commands (`win:` ids) — mirrors the command set at
 * https://www.raycast.com/core-features/window-management (naming included:
 * "First/Last Third", not "Left/Right Third" — Raycast keeps Left/Right for the
 * halves), plus one extra Raycast also ships but doesn't document there,
 * "Almost Maximize".
 *
 * Every command acts on the window captured before the launcher (or a direct
 * global shortcut) stole focus — see `toggleLauncher()`/the shortcut handlers in
 * `index.ts`. These entries just tell the platform control module which region,
 * edge, display direction, or toggle to apply.
 *
 * A static list like `BuiltinCommandSource`; add a region here (and the matching
 * arm in `computeTargetRect`) and it shows up in search with no other wiring.
 */
export class WindowManagementSource implements ActionSource {
  readonly id = "win";

  private readonly definitions: ActionDefinition[] = buildDefinitions();

  constructor(settings: SettingsStore) {
    // Populate each command's display shortcut from the settings store (falling
    // back to its platform default) — the actual `globalShortcut` registration
    // happens separately in `index.ts`, which reads the same store directly.
    for (const definition of this.definitions) {
      const platformDefault = DEFAULT_WINDOW_SHORTCUTS[definition.action.id];
      if (platformDefault) {
        definition.action.shortcut =
          settings.getWindowShortcut(definition.action.id, platformDefault) ?? undefined;
      }
    }
  }

  provide(): ActionDefinition[] {
    return this.definitions;
  }

  owns(actionId: string): boolean {
    return actionId.startsWith(`${this.id}:`);
  }

  async execute(actionId: string): Promise<void> {
    await this.definitions
      .find((definition) => definition.action.id === actionId)
      ?.run();
  }
}

/**
 * All 27 commands — empty on a platform `window/control` has no backend for at
 * all, rather than listing commands that would silently do nothing when run.
 * (Today this only matters for an unrecognized `process.platform`; win32,
 * darwin, and linux are all covered.)
 */
function buildDefinitions(): ActionDefinition[] {
  if (!SUPPORTED_PLATFORM) return [];

  return [
    region("left-half", "Left Half", "left half"),
    region("right-half", "Right Half", "right half"),
    region("top-half", "Top Half", "top half"),
    region("bottom-half", "Bottom Half", "bottom half"),
    region("center-half", "Center Half", "center, at half size"),
    edge("move-left", "Move Left", "⇤", "left"),
    edge("move-right", "Move Right", "⇥", "right"),
    edge("move-up", "Move Up", "⤒", "up"),
    edge("move-down", "Move Down", "⤓", "down"),
    region("top-left", "Top Left Quarter", "top-left quarter"),
    region("top-right", "Top Right Quarter", "top-right quarter"),
    region("bottom-left", "Bottom Left Quarter", "bottom-left quarter"),
    region("bottom-right", "Bottom Right Quarter", "bottom-right quarter"),
    region("first-third", "First Third", "first third"),
    region("center-third", "Center Third", "center third"),
    region("last-third", "Last Third", "last third"),
    region("first-two-thirds", "First Two Thirds", "first two-thirds"),
    region("last-two-thirds", "Last Two Thirds", "last two-thirds"),
    region("center", "Center", "center"),
    region("almost-maximize", "Almost Maximize", "almost-maximize"),
    region("maximize", "Maximize", "full screen"),
    region("maximize-width", "Maximize Width", "full width"),
    region("maximize-height", "Maximize Height", "full height"),
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
    display("next-display", "Move to Next Display", "➡️", "next"),
    display("previous-display", "Move to Previous Display", "⬅️", "previous"),
    {
      action: {
        id: "win:restore",
        title: "Restore",
        subtitle: "Window Management",
        icon: "↩️",
        type: "command",
      },
      run: () => {
        void restore();
      },
    },
  ];
}

/**
 * Build one snap command. `where` is folded into the subtitle ("Snap the active
 * window to the <where> of the screen") so each entry stays a single line; the
 * icon is a generated SVG diagram of the target region (see `snapIcon`).
 */
function region(id: SnapRegion, title: string, _: string): ActionDefinition {
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
 * icon's `0 0 24 24` viewBox. Halves/quarters/thirds leave a ~1px gutter at each
 * split so the division reads clearly at 20px; `maximize` fills the whole inner
 * area, `center`/`center-half`/`almost-maximize` are centered rects of their own
 * size, and `maximize-width`/`maximize-height` are full-span bands.
 */
const REGION_RECT: Record<SnapRegion, readonly [x: number, y: number, w: number, h: number]> = {
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

/**
 * A `data:` SVG showing a monitor outline with the target region filled — rendered
 * as an `<img>` by `SearchItem`, so colours are baked for the launcher's dark UI
 * (`--color-foreground-subtle` frame, `--color-foreground` fill).
 */
function snapIcon(id: SnapRegion): string {
  const [x, y, w, h] = REGION_RECT[id];
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="#8a8582" stroke-width="1.5"/>` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1" fill="#f5f5f4"/>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
