import { dirname } from "node:path";

/**
 * The outermost macOS `.app` bundle `execPath` lives inside, or `null` if it
 * isn't inside one. Outermost, not innermost: a browser's helper processes
 * sit in nested bundles under `Contents/Frameworks` that carry no icon of
 * their own and would each group as a separate "app" — the bundle the user
 * actually launched is the one at the top.
 */
export function outermostAppBundle(execPath: string): string | null {
  let found: string | null = null;
  let dir = dirname(execPath);
  let parent = dirname(dir);
  while (parent !== dir) {
    if (dir.endsWith(".app")) found = dir;
    dir = parent;
    parent = dirname(dir);
  }
  return found;
}
