/**
 * Best-effort identification of the frontmost macOS app at the moment a
 * clipboard change is recorded — the "Source" shown in the detail pane.
 * macOS-only: unlike `main/poller.ts`'s file-copy detection, there is no
 * cross-platform clipboard-level signal for "which app copied this," and
 * this codebase has no existing frontmost-app-identity resolution to build
 * on for Windows/Linux (only opaque window handles for geometry, in
 * `@extensions/window/main/control`) — extending those native addons is a
 * separate, larger effort. On any other platform this always resolves to
 * `null`, so entries there simply have no Source.
 *
 * Shells out to `osascript` asking System Events for the frontmost
 * process's name and `.app` file, converted to a POSIX path — a long-
 * standing, commonly used AppleScript idiom for this exact lookup. Not
 * verified against a real `osascript` invocation in this environment (no
 * macOS GUI session available here); if the script's shape turns out wrong
 * once actually run, this fails closed (caught below) rather than breaking
 * clipboard recording.
 *
 * The *first* call may prompt the user for permission to let this app
 * "control System Events" — macOS's Automation privacy gate, separate from
 * Accessibility. Until granted (or if denied), this silently returns `null`
 * and recording proceeds with no Source, exactly as if this feature weren't
 * there.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const FRONTMOST_APP_SCRIPT = `
tell application "System Events"
  set frontApp to first application process whose frontmost is true
  set appName to name of frontApp
  set appPath to POSIX path of (file of frontApp as alias)
end tell
return appName & linefeed & appPath
`;

export interface FrontmostApp {
  name: string;
  /** POSIX path to the app's `.app` bundle. */
  path: string;
}

export async function frontmostApp(): Promise<FrontmostApp | null> {
  if (process.platform !== "darwin") return null;
  try {
    const { stdout } = await execFileAsync("osascript", [
      "-e",
      FRONTMOST_APP_SCRIPT,
    ]);
    const [name, path] = stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (!name || !path) return null;
    return { name, path };
  } catch (error) {
    console.error("[clipboard-history] frontmostApp() failed:", error);
    return null;
  }
}
