import { createScreen } from "@renderer/screens/launcher/router/createScreen";
import { useRouteStack } from "@renderer/screens/launcher/router/context";
import ClipboardHistoryListScreen from "./renderer/ClipboardHistoryListScreen";
import { CLIPBOARD_HISTORY_ROUTE } from "./shared/types";

/** The history list, which lives in `./renderer` and knows nothing about the router. */
function ClipboardHistory() {
  const { reset } = useRouteStack();

  return (
    <ClipboardHistoryListScreen
      onDismiss={() => {
        reset();
        window.api.hide();
      }}
    />
  );
}

export default [
  createScreen({
    name: CLIPBOARD_HISTORY_ROUTE,
    component: () => <ClipboardHistory />,
  }),
];
