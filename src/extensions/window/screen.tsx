import { createScreen } from "@renderer/screens/launcher/router/createScreen";
import { useRouteStack } from "@renderer/screens/launcher/router/context";
import { useLauncherHost } from "@renderer/screens/launcher/host";
import CustomLayoutListScreen from "./renderer/CustomLayoutListScreen";
import CustomLayoutFormScreen from "./renderer/CustomLayoutFormScreen";

/** The custom window-layout manager list, which lives in `./renderer` and knows nothing about the router. */
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

export default [
  createScreen({
    name: "custom-layout-list",
    component: () => <CustomLayoutList />,
  }),
  createScreen({
    name: "custom-layout-create",
    component: () => <CustomLayoutForm />,
  }),
  createScreen({
    name: "custom-layout-edit",
    component: (payload) => (
      <CustomLayoutForm editId={(payload as { id: string }).id} />
    ),
  }),
  createScreen({
    name: "custom-layout-duplicate",
    component: (payload) => (
      <CustomLayoutForm duplicateId={(payload as { id: string }).id} />
    ),
  }),
];
