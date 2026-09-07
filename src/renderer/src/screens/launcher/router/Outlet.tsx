import { Activity, type FC } from "react";
import CreateQuicklink from "../../../components/CreateQuicklink";
import LauncherScreen from "../LauncherScreen";
import { useLauncherHost } from "../host";
import { useRouteStack } from "./context";
import type { Route, RouteName } from "./types";

/**
 * Adapter that connects the prop-driven `CreateQuicklink` form to the navigation
 * stack and the launcher host. Keeping the router knowledge here means the form
 * itself stays a plain component that's trivial to render in isolation.
 */
function QuicklinkForm({ route }: { route: Route }) {
  const { pop } = useRouteStack();
  const { setQuery, reload } = useLauncherHost();

  return (
    <CreateQuicklink
      seed={route.name === "quicklink-create" ? route.seed : undefined}
      editId={route.name === "quicklink-edit" ? route.id : undefined}
      duplicateId={route.name === "quicklink-duplicate" ? route.id : undefined}
      onCancel={pop}
      onCreated={(name) => {
        pop();
        setQuery(name);
        reload();
      }}
    />
  );
}

/** Maps each {@link Route} name to the component that renders it. */
const SCREENS: Record<RouteName, FC<{ route: Route }>> = {
  launcher: () => <LauncherScreen />,
  "quicklink-create": QuicklinkForm,
  "quicklink-edit": QuicklinkForm,
  "quicklink-duplicate": QuicklinkForm,
};

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
      {stack.map((route, index) => {
        const Screen = SCREENS[route.name];
        return (
          <Activity
            key={`${index}:${route.name}`}
            mode={index === topIndex ? "visible" : "hidden"}
          >
            <Screen route={route} />
          </Activity>
        );
      })}
    </>
  );
}
