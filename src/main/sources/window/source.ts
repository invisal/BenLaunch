import type { ActionDefinition } from "../../types";
import { snapCapturedWindow, type SnapRegion } from "../../native";
import type { ActionSource } from "../base";

/**
 * Window-management commands (`win:` ids) — snap the window the user was in before
 * they opened the launcher to a half/quarter of its monitor (or maximize it). The
 * target window is captured in `toggleLauncher()` before the launcher steals focus;
 * these commands just tell the native layer which region to move it to.
 *
 * A static list like `BuiltinCommandSource`; add a region here (and the matching
 * arm in `snap_window` / `SnapRegion`) and it shows up in search with no other
 * wiring.
 */
export class WindowManagementSource implements ActionSource {
  readonly id = "win";

  private readonly definitions: ActionDefinition[] = [
    region("left-half", "Left Half", "left half"),
    region("right-half", "Right Half", "right half"),
    region("top-half", "Top Half", "top half"),
    region("bottom-half", "Bottom Half", "bottom half"),
    region("top-left", "Top Left Quarter", "top-left quarter"),
    region("top-right", "Top Right Quarter", "top-right quarter"),
    region("bottom-left", "Bottom Left Quarter", "bottom-left quarter"),
    region("bottom-right", "Bottom Right Quarter", "bottom-right quarter"),
    region("maximize", "Maximize", "full screen"),
  ];

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
    run: () => snap(id),
  };
}

/**
 * The filled sub-rectangle each region occupies inside the monitor frame, in the
 * icon's `0 0 24 24` viewBox. Halves/quarters leave a 1px gutter at the split so
 * the division reads clearly at 20px; `maximize` fills the whole inner area.
 */
const REGION_RECT: Record<
  SnapRegion,
  readonly [x: number, y: number, w: number, h: number]
> = {
  "left-half": [4, 5, 7.5, 14],
  "right-half": [12.5, 5, 7.5, 14],
  "top-half": [4, 5, 16, 6.5],
  "bottom-half": [4, 12.5, 16, 6.5],
  "top-left": [4, 5, 7.5, 6.5],
  "top-right": [12.5, 5, 7.5, 6.5],
  "bottom-left": [4, 12.5, 7.5, 6.5],
  "bottom-right": [12.5, 12.5, 7.5, 6.5],
  maximize: [4, 5, 16, 14],
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

function snap(region: SnapRegion): void {
  if (!snapCapturedWindow(region)) {
    console.error(`[main] Window snap (${region}) had no target window`);
  }
}
