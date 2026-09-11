import { Activity } from "react";
import CustomLayoutFormScreen from "../../customlayout/CustomLayoutFormScreen";
import CustomLayoutListScreen from "../../customlayout/CustomLayoutListScreen";
import CreateQuicklink from "../../../components/CreateQuicklink";
import LauncherScreen from "../LauncherScreen";
import { useLauncherHost } from "../host";
import { useRouteStack } from "./context";
import { extensionScreens } from "./registry";
import type { ScreenComponent } from "./createScreen";

/**
 * Adapter that connects the prop-driven `CreateQuicklink` form to the navigation
 * stack and the launcher host. Keeping the router knowledge here means the form
 * itself stays a plain component that's trivial to render in isolation; the
 * three `quicklink-*` routes below just pick which of these props to fill in
 * from their payload.
 */
function QuicklinkFormScreen({
  seed,
  editId,
  duplicateId,
}: {
  seed?: string;
  editId?: string;
  duplicateId?: string;
}) {
  const { pop } = useRouteStack();
  const { setQuery, reload } = useLauncherHost();

  return (
    <CreateQuicklink
      seed={seed}
      editId={editId}
      duplicateId={duplicateId}
      onCancel={pop}
      onCreated={(name) => {
        pop();
        setQuery(name);
        reload();
      }}
    />
  );
}

/** The custom window-layout manager list, which lives in `screens/customlayout` and knows nothing about the router. */
function CustomLayoutList() {
  const { push, reset } = useRouteStack();

  return (
    <CustomLayoutListScreen
      onCreate={() => push({ name: "custom-layout-create" })}
      onEdit={(id) => push({ name: "custom-layout-edit", payload: { id } })}
      onDuplicate={(id) =>
        push({ name: "custom-layout-duplicate", payload: { id } })
      }
      onApply={(id) => {
        // Applying is the one action here that has to reach past the stack: the
        // layout runs against the window that was focused before the launcher
        // opened, so the launcher has to get out of the way afterwards.
        // `useRouteStack` has no `dismiss`, hence `reset()` + `hide()` by hand.
        void window.api.execute(`win:custom:${id}`, "");
        reset();
        window.api.hide();
      }}
    />
  );
}

/** The custom window-layout designer, shared by create/edit/duplicate. */
function CustomLayoutForm({
  editId,
  duplicateId,
}: {
  editId?: string;
  duplicateId?: string;
}) {
  const { pop } = useRouteStack();
  const { setQuery, reload } = useLauncherHost();

  return (
    <CustomLayoutFormScreen
      editId={editId}
      duplicateId={duplicateId}
      onCancel={pop}
      onSaved={(name) => {
        pop();
        setQuery(name);
        reload();
      }}
    />
  );
}

/**
 * Every screen the launcher's router knows about: the core routes here, plus
 * every extension's `renderer/screen.ts` (see `registry.ts`) — dropping one
 * in is the entire wiring an extension needs; nothing here has to change.
 */
const SCREENS: Record<string, ScreenComponent> = {
  launcher: () => <LauncherScreen />,
  "quicklink-create": (payload) => (
    <QuicklinkFormScreen
      seed={(payload as { seed?: string } | undefined)?.seed}
    />
  ),
  "quicklink-edit": (payload) => (
    <QuicklinkFormScreen editId={(payload as { id: string }).id} />
  ),
  "quicklink-duplicate": (payload) => (
    <QuicklinkFormScreen duplicateId={(payload as { id: string }).id} />
  ),
  "custom-layout-list": () => <CustomLayoutList />,
  "custom-layout-create": () => <CustomLayoutForm />,
  "custom-layout-edit": (payload) => (
    <CustomLayoutForm editId={(payload as { id: string }).id} />
  ),
  "custom-layout-duplicate": (payload) => (
    <CustomLayoutForm duplicateId={(payload as { id: string }).id} />
  ),
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
