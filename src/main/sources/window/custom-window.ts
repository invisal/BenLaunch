import { BrowserWindow } from "electron";
import { join } from "node:path";

/**
 * "Create Command" lives in its own framed BrowserWindow with its own renderer
 * entry (`custom-layout.html`) — same singleton pattern as the QuickValue
 * manager (`quickvalue/window.ts`), minus the multi-screen routing: this
 * window has exactly one job (fill in the form, Create or Cancel), so
 * reopening it while already open just re-shows/focuses it as-is.
 */

// Fixed (non-resizable) so the layout never has to reflow — tall enough that
// the sidebar (name, size, offset, gap toggle, the 3x3 position grid, and the
// action row) always fits without scrolling; `overflow-y-auto` there is just
// a safety net, not something a user should ever actually hit.
const WINDOW_WIDTH = 720;
const WINDOW_HEIGHT = 480;

let customLayoutWindow: BrowserWindow | null = null;

export function openCustomLayoutWindow(): void {
  if (customLayoutWindow) {
    if (customLayoutWindow.isMinimized()) customLayoutWindow.restore();
    customLayoutWindow.show();
    customLayoutWindow.focus();
    return;
  }

  customLayoutWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    title: "Create Command",
    show: false,
    backgroundColor: "#0a0908",
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  customLayoutWindow.once("ready-to-show", () => customLayoutWindow?.show());
  customLayoutWindow.on("closed", () => {
    customLayoutWindow = null;
  });

  if (process.env["ELECTRON_RENDERER_URL"]) {
    void customLayoutWindow.loadURL(
      `${process.env["ELECTRON_RENDERER_URL"]}/custom-layout.html`,
    );
  } else {
    void customLayoutWindow.loadFile(
      join(__dirname, "../renderer/custom-layout.html"),
    );
  }
}
