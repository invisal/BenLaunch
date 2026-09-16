import { app, BrowserWindow, globalShortcut, ipcMain } from "electron";
import { captureFocusedWindow } from "@extensions/window/main/control/control";
import {
  IPC_CHANNELS,
  type CalculatorSettings,
  type RequestSubtitleOptions,
} from "../shared/types";
import {
  clipboardHistory,
  actionUsage,
  executeAction,
  getCalculatorSettings,
  updateCalculatorSettings,
  initActionSources,
  openQuicklinkWith,
  query,
  quicklinkSource,
  refreshActionSources,
  registerActionSourcesIpc,
  requestSubtitle,
} from "./actions";
import { registerQuicklinkIpc } from "@extensions/quicklink/ipc/handlers";
import { registerWindowControlsIpc } from "./window-chrome";
import {
  createLauncherWindow,
  getLauncherWindow,
  hideLauncher,
  showLauncher,
} from "./window";
import { createTray } from "./tray";

// Alt+Space is free on Windows, but on macOS Option+Space is commonly remapped
// (e.g. to Mission Control/Spotlight variants) and Cmd+Space/Cmd+Option+Space/
// Cmd+Ctrl+Space are all reserved by the OS, so macOS gets its own default.
// Linux needs one too: Alt+Space is hard-bound at the window-manager level on
// GNOME (`activate-window-menu`, and almost every other Linux DE reserves it
// the same way for a "window menu" convention going back to Windows 3.x) — the
// compositor grabs it before any app can, so `globalShortcut.register` always
// fails for it, no matter what backend Electron runs on. Control+Alt+Space
// isn't bound by any default GNOME keybinding.
const TOGGLE_SHORTCUT =
  process.platform === "darwin" ? "Command+Shift+Space" : "Alt+Space";

// On top of the modifier conflict above, GNOME ≥ 49 stopped honoring global
// key grabs from XWayland clients at all, and Electron's Wayland-native
// replacement (the `org.freedesktop.portal.GlobalShortcuts` portal) is broken
// by an open upstream bug against xdg-desktop-portal ≥ 1.20 / GNOME 50
// (electron/electron#51875) — so `globalShortcut.register` below can fail on
// Linux independent of which accelerator is picked, with no code-level fix.
// The workaround: GNOME's own custom-keybindings feature (Settings →
// Keyboard → Custom Shortcuts) can always run an arbitrary command, so
// pointing one at this same binary with `--toggle` and relaying that to the
// already-running instance (via the single-instance lock below) reaches
// `toggleLauncher` without ever asking Electron to grab the key itself.
const CLI_TOGGLE_FLAG = "--toggle";

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

let pinned = false;
/**
 * Set while a modal picker (the file/folder dialog) is open, so the launcher's
 * blur-to-hide doesn't fire when the dialog steals focus — otherwise the window
 * vanishes and the user has to re-open it after choosing a path.
 */
let suppressAutoHide = false;

/** Whether the launcher should stay visible on focus loss right now. */
function keepLauncherOpen(): boolean {
  return pinned || suppressAutoHide;
}

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
  const win = getLauncherWindow();
  if (!win) return;
  if (win.isVisible()) {
    win.hide();
    return;
  }
  // Grab the window the user is in now, before show()/focus() makes it the launcher.
  captureFocusedWindow(launcherHandle(win));
  showLauncher();
  // Pick up changes since the last run (e.g. apps installed/removed); sources throttle.
  refreshActionSources();
}

/**
 * Toggles the launcher from argv — what a GNOME custom keyboard shortcut
 * invokes instead of a hotkey Electron can't grab directly on this desktop
 * (see `TOGGLE_SHORTCUT` above). A relaunch while Magibar is already
 * running relays its argv here via `second-instance`; the very first launch
 * checks its own `process.argv` the same way, in case that launch itself was
 * the GNOME shortcut firing before anything was running yet.
 */
function handleCliAction(argv: string[]): void {
  if (argv.includes(CLI_TOGGLE_FLAG)) toggleLauncher();
}

app.on("second-instance", (_event, argv) => {
  handleCliAction(argv);
});

app.whenReady().then(() => {
  createLauncherWindow(keepLauncherOpen);
  createTray(toggleLauncher);
  handleCliAction(process.argv);

  // Warm every action source now (apps: disk cache, then a background worker run)
  // instead of waiting for the renderer's first search.
  initActionSources();

  // Each extension wires its own `ipcMain` handlers via `registerIpc()`.
  registerActionSourcesIpc(ipcMain);
  registerWindowControlsIpc();
  // Quicklink's IPC needs the launcher window's own state (pinned,
  // blur-suppression, the window itself), which only `index.ts` owns, so it
  // stays wired here rather than through `registerIpc()`.
  registerQuicklinkIpc(quicklinkSource, openQuicklinkWith, {
    getLauncherWindow,
    setSuppressAutoHide: (value) => {
      suppressAutoHide = value;
    },
    hideAfterOpen: () => {
      if (!pinned) hideLauncher();
    },
    usageOf: actionUsage,
  });

  ipcMain.handle(IPC_CHANNELS.query, (_event, text: string) => {
    return query(text);
  });

  ipcMain.handle(
    IPC_CHANNELS.execute,
    async (_event, id: string, text: string, argument?: string) => {
      // `text` is threaded through so usage tracking can learn "typed X, picked Y".
      const result = await executeAction(id, text, argument);
      // Hide as soon as execute() resolves, rather than waiting for the launched
      // app to grab focus and trigger `blur` — unless the action asked the
      // launcher to navigate instead (`ctx.navigate`), in which case it stays
      // open showing the pushed screen.
      if (!result.navigate && !pinned) hideLauncher();
      return result;
    },
  );

  ipcMain.on(IPC_CHANNELS.hide, () => {
    hideLauncher();
  });

  ipcMain.handle(
    IPC_CHANNELS.requestSubtitle,
    (_event, id: string, opts?: RequestSubtitleOptions) =>
      requestSubtitle(id, opts),
  );

  ipcMain.handle(IPC_CHANNELS.calculatorSettingsGet, () =>
    getCalculatorSettings(),
  );
  ipcMain.handle(
    IPC_CHANNELS.calculatorSettingsSet,
    (_event, patch: Partial<CalculatorSettings>) =>
      updateCalculatorSettings(patch),
  );

  ipcMain.handle(IPC_CHANNELS.togglePin, () => {
    pinned = !pinned;
    return pinned;
  });

  if (!globalShortcut.register(TOGGLE_SHORTCUT, toggleLauncher)) {
    console.error(`Failed to register global shortcut: ${TOGGLE_SHORTCUT}`);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createLauncherWindow(keepLauncherOpen);
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
  clipboardHistory.stopPolling();
});
