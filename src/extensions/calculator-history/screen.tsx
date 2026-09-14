import { createScreen } from "@renderer/screens/launcher/router/createScreen";
import { useRouteStack } from "@renderer/screens/launcher/router/context";
import { useLauncherHost } from "@renderer/screens/launcher/host";
import HistoryListScreen from "./renderer/HistoryListScreen";
import { HISTORY_ROUTE } from "./shared/types";

/** The history list, which lives in `./renderer` and knows nothing about the router. */
function CalculatorHistory() {
  const { reset } = useRouteStack();
  const { setQuery } = useLauncherHost();

  return (
    <HistoryListScreen
      onRerun={(query) => {
        reset();
        setQuery(query);
      }}
      onDismiss={() => {
        reset();
        setQuery("");
        window.api.hide();
      }}
    />
  );
}

export default [
  createScreen({
    name: HISTORY_ROUTE,
    component: () => <CalculatorHistory />,
  }),
];
