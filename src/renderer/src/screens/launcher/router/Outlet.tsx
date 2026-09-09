import { Activity, type FC } from "react";
import WidgetListScreen from "@extensions/widget/renderer/ListScreen";
import WidgetMetaScreen from "@extensions/widget/renderer/MetaScreen";
import CustomLayoutFormScreen from "../../customlayout/CustomLayoutFormScreen";
import CustomLayoutListScreen from "../../customlayout/CustomLayoutListScreen";
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

/**
 * Adapter for the Widget manager screens (list + metadata form), which live
 * in the extension and know nothing about the router. The list is the root of
 * the Widget sub-stack; the metadata form pops back to it, and coming back
 * re-mounts the list's Effects so it re-fetches.
 */
function WidgetScreen({ route }: { route: Route }) {
  const { push, pop } = useRouteStack();

  if (route.name === "widget-list") {
    return (
      <WidgetListScreen
        onEdit={(id) => push({ name: "widget-edit", id })}
        onCreate={() => push({ name: "widget-create" })}
        onExit={pop}
      />
    );
  }

  return (
    <WidgetMetaScreen
      id={route.name === "widget-edit" ? route.id : null}
      onDone={pop}
    />
  );
}

/**
 * Adapter for the custom window-layout screens (manager list + the designer),
 * which live in `screens/customlayout` and know nothing about the router.
 *
 * Applying is the one action here that has to reach past the stack: the layout
 * runs against the window that was focused before the launcher opened, so the
 * launcher has to get out of the way afterwards. `useRouteStack` has no
 * `dismiss`, hence `reset()` + `hide()` by hand.
 */
function CustomLayoutScreen({ route }: { route: Route }) {
  const { push, pop, reset } = useRouteStack();
  const { setQuery, reload } = useLauncherHost();

  if (route.name === "custom-layout-list") {
    return (
      <CustomLayoutListScreen
        onCreate={() => push({ name: "custom-layout-create" })}
        onEdit={(id) => push({ name: "custom-layout-edit", id })}
        onDuplicate={(id) => push({ name: "custom-layout-duplicate", id })}
        onApply={(id) => {
          void window.api.execute(`win:custom:${id}`, "");
          reset();
          window.api.hide();
        }}
        onExit={pop}
      />
    );
  }

  return (
    <CustomLayoutFormScreen
      editId={route.name === "custom-layout-edit" ? route.id : undefined}
      duplicateId={
        route.name === "custom-layout-duplicate" ? route.id : undefined
      }
      onCancel={pop}
      onSaved={(name) => {
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
  "widget-list": WidgetScreen,
  "widget-create": WidgetScreen,
  "widget-edit": WidgetScreen,
  "custom-layout-list": CustomLayoutScreen,
  "custom-layout-create": CustomLayoutScreen,
  "custom-layout-edit": CustomLayoutScreen,
  "custom-layout-duplicate": CustomLayoutScreen,
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
