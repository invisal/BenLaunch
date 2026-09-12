import {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  ipcMain,
} from "electron";
import type { QuicklinkDraft } from "../shared/quicklink";
import { captureFocusedWindow } from "@extensions/window/main/control/control";
import { IPC_CHANNELS, type RequestSubtitleOptions } from "../shared/types";
import {
  createQuicklink,
  deleteQuicklink,
  executeAction,
  getQuicklink,
  initActionSources,
  openQuicklinkWith,
  query,
  widgetRunner,
  widgetStore,
  windowLayoutStore,
  refreshActionSources,
  requestSubtitle,
  setQuicklinkHidden,
  setQuicklinkPinned,
  settings,
  updateQuicklink,
} from "./actions";
import { registerWidgetIpc } from "@extensions/widget/ipc/handlers";
import { registerWindowIpc } from "@extensions/window/ipc/handlers";
import { registerWindowControlsIpc } from "./window-chrome";
import { listOpenWithApps } from "./sources/apps/open-with";
import {
  createLauncherWindow,
  getLauncherWindow,
  hideLauncher,
  showLauncher,
} from "./window";

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
  process.platform === "darwin"
    ? "Command+Shift+Space"
    : "Alt+Space";

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
 * (see `TOGGLE_SHORTCUT` above). A relaunch while BenLaunch is already
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
  handleCliAction(process.argv);

  // Warm every action source now (apps: disk cache, then a background worker run)
  // instead of waiting for the renderer's first search.
  initActionSources();

  registerWidgetIpc(widgetStore, widgetRunner);
  registerWindowIpc(windowLayoutStore, settings);
  registerWindowControlsIpc();

  ipcMain.handle(IPC_CHANNELS.query, (_event, text: string) => {
    return query(text);
  });

  ipcMain.handle(IPC_CHANNELS.execute, async (_event, id: string, text: string) => {
    // `text` is threaded through so usage tracking can learn "typed X, picked Y".
    const result = await executeAction(id, text);
    // Hide as soon as execute() resolves, rather than waiting for the launched
    // app to grab focus and trigger `blur` — unless the action asked the
    // launcher to navigate instead (`ctx.navigate`), in which case it stays
    // open showing the pushed screen.
    if (!result.navigate && !pinned) hideLauncher();
    return result;
  });

  ipcMain.on(IPC_CHANNELS.hide, () => {
    hideLauncher();
  });

  ipcMain.handle(
    IPC_CHANNELS.requestSubtitle,
    (_event, id: string, opts?: RequestSubtitleOptions) =>
      requestSubtitle(id, opts),
  );

  ipcMain.handle(IPC_CHANNELS.quicklinkCreate, (_event, draft: QuicklinkDraft) => {
    return createQuicklink(draft)
  })

  ipcMain.handle(IPC_CHANNELS.quicklinkUpdate, (_event, id: string, draft: QuicklinkDraft) => {
    return updateQuicklink(id, draft)
  })

  ipcMain.handle(IPC_CHANNELS.quicklinkGet, (_event, id: string) => getQuicklink(id) ?? null)

  ipcMain.handle(IPC_CHANNELS.quicklinkDelete, (_event, id: string) => {
    deleteQuicklink(id)
  })

  ipcMain.handle(IPC_CHANNELS.quicklinkSetPinned, (_event, id: string, pinned: boolean) => {
    setQuicklinkPinned(id, pinned)
  })

  ipcMain.handle(IPC_CHANNELS.quicklinkSetHidden, (_event, id: string, hidden: boolean) => {
    setQuicklinkHidden(id, hidden)
  })

  ipcMain.handle(
    IPC_CHANNELS.quicklinkOpenWith,
    (_event, id: string, text: string, appPath: string) => {
      // Mirror the main execute handler: hide first so the launcher vanishes at once.
      if (!pinned) hideLauncher()
      return openQuicklinkWith(id, text, appPath)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.quicklinkPickPath,
    async (_event, type: 'file' | 'directory'): Promise<string | null> => {
      const options = {
        properties: [type === 'directory' ? 'openDirectory' : 'openFile'] as Array<
          'openDirectory' | 'openFile'
        >
      }
      const launcherWindow = getLauncherWindow()
      suppressAutoHide = true
      try {
        const result = launcherWindow
          ? await dialog.showOpenDialog(launcherWindow, options)
          : await dialog.showOpenDialog(options)
        return result.canceled ? null : (result.filePaths[0] ?? null)
      } finally {
        suppressAutoHide = false
        // The dialog took focus; hand it back so the form stays interactive and
        // a later real focus loss hides the launcher as usual.
        launcherWindow?.focus()
      }
    }
  )

  ipcMain.handle(IPC_CHANNELS.quicklinkOpenWithApps, () => listOpenWithApps())

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
});
