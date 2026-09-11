import { createScreen } from "@renderer/screens/launcher/router/createScreen";
import { useRouteStack } from "@renderer/screens/launcher/router/context";
import WidgetListScreen from "./renderer/ListScreen";
import WidgetMetaScreen from "./renderer/MetaScreen";

/** The Widget manager list, the root of the Widget sub-stack. */
function WidgetList() {
  const { push } = useRouteStack();

  return (
    <WidgetListScreen
      onEdit={(id) => push({ name: "widget-edit", payload: { id } })}
      onCreate={() => push({ name: "widget-create" })}
    />
  );
}

/** The Widget metadata form, shared by create (`id: null`) and edit. */
function WidgetMeta({ id }: { id: string | null }) {
  const { pop } = useRouteStack();
  return <WidgetMetaScreen id={id} onDone={pop} />;
}

export default [
  createScreen({ name: "widget-list", component: () => <WidgetList /> }),
  createScreen({
    name: "widget-create",
    component: () => <WidgetMeta id={null} />,
  }),
  createScreen({
    name: "widget-edit",
    component: (payload) => (
      <WidgetMeta id={(payload as { id: string }).id} />
    ),
  }),
];
