import type { ScreenComponent, ScreenDefinition } from "./createScreen";

/**
 * Every `src/extensions/<name>/screen.tsx`, loaded eagerly at build time.
 * Vite resolves the glob itself (it's a build-time construct, not a runtime
 * directory scan), so this stays a plain static import as far as
 * bundling/tree-shaking is concerned — it just doesn't name each extension by
 * hand. Always at the extension's root (not e.g. `renderer/screen.tsx`) so
 * this one pattern is the entire convention.
 */
const modules = import.meta.glob<{ default: ScreenDefinition[] }>(
  "../../../../../extensions/*/screen.{ts,tsx}",
  { eager: true },
);

/** `route.name → component`, flattened from every extension's screen list. */
export const extensionScreens: Record<string, ScreenComponent> = {};

for (const mod of Object.values(modules)) {
  for (const screen of mod.default) {
    extensionScreens[screen.name] = screen.component;
  }
}
