import { Activity } from "react";
import LauncherScreen from "../LauncherScreen";
import { useRouteStack } from "./context";
import { extensionScreens } from "./registry";
import type { ScreenComponent } from "./createScreen";

/**
 * Every screen the launcher's router knows about: the core `launcher` route
 * here, plus every extension's `screen.tsx` (see `registry.ts`, e.g.
 * `extensions/quicklink/screen.tsx` for the Create/Edit/Duplicate Quicklink
 * routes) — dropping one in is the entire wiring an extension needs; nothing
 * here has to change.
 */
const SCREENS: Record<string, ScreenComponent> = {
  launcher: () => <LauncherScreen />,
  ...extensionScreens,
};

/**
 * Renders one stack entry. A real component (rather than calling
 * `component(payload)` inline in `RouteStackOutlet`'s `.map`) gives every
 * entry its own Fiber, so hooks the screen calls (`useRouteStack`,
 * `useState`, …) stay tied to that entry across re-renders instead of being
 * attributed to the outlet's own hook order — which would break as routes are
 * pushed/popped and the number of `.map` iterations changes.
 */
function ScreenSlot({
  component,
  payload,
}: {
  component: ScreenComponent;
  payload: unknown;
}) {
  return <>{component(payload)}</>;
}

/**
 * Renders every screen in the stack at once, each in its own `<Activity>`; only
 * the top one is `visible`.
 *
 * A `hidden` Activity keeps its subtree's state and DOM but unmounts its
 * Effects — so a backgrounded screen's global key handlers and focus traps go
 * quiet without any `if (onTop) return` guards, and React re-mounts those
 * Effects when the screen comes back to the top. That's what lets
 * `LauncherScreen` re-register its shortcuts and re-focus its input on the way
 * back for free, and what keeps a half-filled Create Quicklink form intact while
 * something is pushed over it.
 */
export function RouteStackOutlet() {
  const { stack } = useRouteStack();
  const topIndex = stack.length - 1;

  return (
    <>
      {stack.map((route, index) => (
        <Activity
          key={`${index}:${route.name}`}
          mode={index === topIndex ? "visible" : "hidden"}
        >
          <ScreenSlot component={SCREENS[route.name]} payload={route.payload} />
        </Activity>
      ))}
    </>
  );
}
