import { app, Menu, nativeImage, Tray } from "electron";
import trayIconPath from "../../resources/tray-icon.png?asset";
import { openSettingsWindow } from "./settings-window";

/**
 * Kept at module scope — Electron garbage-collects a `Tray` (silently
 * removing the icon) as soon as nothing references it, so this is the only
 * thing keeping it alive for the life of the app.
 */
let tray: Tray | null = null;

/** Creates the system tray icon. `toggleLauncher` is injected (see `index.ts`) to avoid an import cycle back through the app entry. */
export function createTray(toggleLauncher: () => void): Tray {
  tray = new Tray(nativeImage.createFromPath(trayIconPath));
  tray.setToolTip("Magibar");

  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Show Magibar", click: toggleLauncher },
      { type: "separator" },
      { label: "Settings", click: () => openSettingsWindow() },
      { type: "separator" },
      { label: "Quit Magibar", click: () => app.quit() },
    ]),
  );

  // Windows/Linux only fire 'click' for the left button — the menu above
  // already handles right-click there, and macOS shows it on either click.
  tray.on("click", toggleLauncher);

  return tray;
}
