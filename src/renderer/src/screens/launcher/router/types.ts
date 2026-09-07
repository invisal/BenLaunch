/**
 * One entry in the launcher window's navigation stack. `stack[0]` is always
 * `{ name: "launcher" }`; deeper entries are screens pushed on top of it.
 *
 * Routes are plain data, not React elements, so the Ctrl+K context-menu
 * contributors can keep producing them without importing components or wiring
 * navigation callbacks — `router/Outlet.tsx` owns the `name → component` map and
 * the back/return plumbing.
 */
export type Route =
  | { name: "launcher" }
  | { name: "quicklink-create"; seed?: string }
  | { name: "quicklink-edit"; id: string }
  | { name: "quicklink-duplicate"; id: string };

export type RouteName = Route["name"];
