import { createScreen } from "@renderer/screens/launcher/router/createScreen";
import { useRouteStack } from "@renderer/screens/launcher/router/context";
import QuitProcessListScreen from "./renderer/QuitProcessListScreen";
import { QUIT_PROCESS_ROUTE } from "./shared/types";

/** The process list, which lives in `./renderer` and knows nothing about the router. */
function QuitProcess() {
  const { reset } = useRouteStack();

  return <QuitProcessListScreen onWindowHidden={reset} />;
}

export default [
  createScreen({
    name: QUIT_PROCESS_ROUTE,
    component: () => <QuitProcess />,
  }),
];
