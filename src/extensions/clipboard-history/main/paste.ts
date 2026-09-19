/**
 * Sends the platform's paste keystroke to whichever app is frontmost — called
 * right after the launcher hides, so focus has already returned to the app the
 * user was in. Best-effort: on failure the entry is still on the clipboard, so
 * the user can paste by hand.
 *
 * macOS needs the Accessibility permission (System Events keystroke); Windows
 * uses `SendKeys`; Linux needs `xdotool` (X11 only).
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Lets the window manager hand focus back to the previous app after `hide()`. */
const FOCUS_SETTLE_MS = 200;

export async function sendPasteKeystroke(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, FOCUS_SETTLE_MS));
  try {
    if (process.platform === "darwin") {
      await execFileAsync("osascript", [
        "-e",
        'tell application "System Events" to keystroke "v" using command down',
      ]);
    } else if (process.platform === "win32") {
      await execFileAsync("powershell", [
        "-NoProfile",
        "-Command",
        "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')",
      ]);
    } else {
      await execFileAsync("xdotool", ["key", "ctrl+v"]);
    }
  } catch (error) {
    console.error("[clipboard-history] sendPasteKeystroke() failed:", error);
  }
}
