/**
 * One entry in the launcher window's navigation stack. `stack[0]` is always
 * `{ name: "launcher" }`; deeper entries are screens pushed on top of it.
 *
 * `name` is matched against a registered `ScreenDefinition` (see
 * `createScreen.ts`); `payload` is opaque to the router itself — it's just
 * handed to that screen's `component` function. Routes are plain data, not
 * React elements, so the Ctrl+K context-menu contributors can keep producing
 * them without importing components or wiring navigation callbacks —
 * `router/registry.ts` owns the `name → component` map (core routes plus every
 * extension's `screen.tsx`, discovered automatically) and `Outlet.tsx` owns
 * the back/return plumbing. A route also reaches the renderer as the
 * `navigate` an action's `execute()` resolves with (see `main/navigate.ts` and
 * `Extension`'s `this.ctx.navigate`) — `LauncherScreen.runRow` pushes that the
 * same way.
 */
export interface Route {
  name: string;
  payload?: unknown;
}
