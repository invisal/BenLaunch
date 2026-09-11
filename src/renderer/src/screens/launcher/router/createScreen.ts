import type { ReactNode } from "react";

/**
 * Renders one route. Takes that route's `payload` directly (not a wrapping
 * props object) — the router doesn't know or care what shape it is, only the
 * screen that registered under this name does.
 */
export type ScreenComponent = (payload: unknown) => ReactNode;

/**
 * One entry an extension's `screen.tsx` contributes to the launcher's
 * navigation stack: a route name (matched against pushed `Route`s — see
 * `push()` and, on the main side, `Extension`'s `this.ctx.navigate()`) and the
 * component that renders it.
 *
 * `router/registry.ts` collects every extension's default export via a Vite
 * glob import — dropping a `screen.ts`/`screen.tsx` in
 * `src/extensions/<name>/` is the entire wiring, nothing else in the launcher
 * needs to change.
 */
export interface ScreenDefinition {
  name: string;
  component: ScreenComponent;
}

export function createScreen(def: ScreenDefinition): ScreenDefinition {
  return def;
}
