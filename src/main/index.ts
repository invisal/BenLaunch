import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  systemPreferences,
} from "electron";
import { captureFocusedWindow } from "./window/control";
import { IPC_CHANNELS, type RequestSubtitleOptions } from "../shared/types";
import {
  customLayoutStore,
  executeAction,
  initActionSources,
  query,
  quickValueRunner,
  quickValueStore,
  refreshActionSources,
  requestSubtitle,
  settings,
} from "./actions";
import { registerQuickValueIpc } from "./sources/quickvalue/ipc";
import { registerCustomLayoutIpc } from "./sources/window/custom-ipc";
import { centerOnActiveDisplay, createLauncherWindow } from "./window";

// Alt+Space is free on Windows, but on macOS Option+Space is commonly remapped
// (e.g. to Mission Control/Spotlight variants) and Cmd+Space/Cmd+Option+Space/
// Cmd+Ctrl+Space are all reserved by the OS, so macOS gets its own default.
const TOGGLE_SHORTCUT =
  process.platform === "darwin" ? "Command+Shift+Space" : "Alt+Space";

let launcherWindow: BrowserWindow | null = null;
let pinned = false;

/**
 * The launcher's own window handle, so window-management commands never target
 * the launcher itself. Only meaningful on win32 (HWND) and linux (X11 window
 * id) — both are 32-bit values, so the low 32 bits of the native handle buffer
 * is the id either way. macOS excludes itself via pid instead (see
 * `control-mac.ts`), so this returns 0 there.
 */
function launcherHandle(win: BrowserWindow): number {
  if (process.platform !== "win32" && process.platform !== "linux") return 0;
  return win.getNativeWindowHandle().readUInt32LE(0);
}

function toggleLauncher(): void {
  if (!launcherWindow) return;
  if (launcherWindow.isVisible()) {
    launcherWindow.hide();
    return;
  }
  // Grab the window the user is in now, before show()/focus() makes it the launcher.
  captureFocusedWindow(launcherHandle(launcherWindow));
  centerOnActiveDisplay(launcherWindow);
  launcherWindow.show();
  launcherWindow.focus();
  // Pick up changes since the last run (e.g. apps installed/removed); sources throttle.
  refreshActionSources();
}

app.whenReady().then(() => {
  launcherWindow = createLauncherWindow(() => pinned);

  // Warm every action source now (apps: disk cache, then a background worker run)
  // instead of waiting for the renderer's first search.
  initActionSources();

  registerQuickValueIpc(quickValueStore, quickValueRunner);
  registerCustomLayoutIpc(customLayoutStore, settings);

  ipcMain.handle(IPC_CHANNELS.query, (_event, text: string) => {
    return query(text);
  });

  ipcMain.handle(IPC_CHANNELS.execute, (_event, id: string, text: string) => {
    // Hide synchronously before launching so the launcher disappears instantly,
    // instead of lingering until the launched app grabs focus and triggers `blur`.
    if (!pinned) launcherWindow?.hide();
    // `text` is threaded through so usage tracking can learn "typed X, picked Y".
    return executeAction(id, text);
  });

  ipcMain.on(IPC_CHANNELS.hide, () => {
    launcherWindow?.hide();
  });

  ipcMain.handle(
    IPC_CHANNELS.requestSubtitle,
    (_event, id: string, opts?: RequestSubtitleOptions) =>
      requestSubtitle(id, opts),
  );

  ipcMain.handle(IPC_CHANNELS.togglePin, () => {
    pinned = !pinned;
    return pinned;
  });

  ipcMain.handle(IPC_CHANNELS.accessibilityStatus, () => {
    if (process.platform !== "darwin") return true;
    return systemPreferences.isTrustedAccessibilityClient(false);
  });

  ipcMain.handle(IPC_CHANNELS.requestAccessibility, () => {
    if (process.platform !== "darwin") return true;
    return systemPreferences.isTrustedAccessibilityClient(true);
  });

  if (!globalShortcut.register(TOGGLE_SHORTCUT, toggleLauncher)) {
    console.error(`Failed to register global shortcut: ${TOGGLE_SHORTCUT}`);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      launcherWindow = createLauncherWindow(() => pinned);
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
