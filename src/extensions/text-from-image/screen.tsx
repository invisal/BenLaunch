import { createScreen } from "@renderer/screens/launcher/router/createScreen";
import { useRouteStack } from "@renderer/screens/launcher/router/context";
import ExportScreen from "./renderer/ExportScreen.tsx";
import ReadTextScreen from "./renderer/ReadTextScreen.tsx";
import ResultScreen from "./renderer/ResultScreen.tsx";
import {
  TEXT_FROM_IMAGE_EXPORT_ROUTE,
  TEXT_FROM_IMAGE_RESULT_ROUTE,
  TEXT_FROM_IMAGE_ROUTE,
} from "./shared/types";

/**
 * The extension's three routes. The screens themselves live in `./renderer`
 * and know nothing about the router — navigation is handed to them as props
 * here, which is what keeps them straightforwardly testable and reusable.
 */

/** What the launcher's `Read Text from …` commands pass through `navigate()`. */
interface LibraryPayload {
  start?: "clipboard" | "file";
}

function Library(payload: unknown) {
  const { push, reset } = useRouteStack();
  const { start } = (payload ?? {}) as LibraryPayload;

  return (
    <ReadTextScreen
      autoStart={start}
      onOpenResult={(id) =>
        push({ name: TEXT_FROM_IMAGE_RESULT_ROUTE, payload: id })
      }
      onExport={(id) =>
        push({ name: TEXT_FROM_IMAGE_EXPORT_ROUTE, payload: id })
      }
      onDismiss={() => {
        reset();
        window.api.hide();
      }}
    />
  );
}

function Result(payload: unknown) {
  const { push, reset } = useRouteStack();

  return (
    <ResultScreen
      id={String(payload ?? "")}
      onExport={(id) =>
        push({ name: TEXT_FROM_IMAGE_EXPORT_ROUTE, payload: id })
      }
      onDismiss={() => {
        reset();
        window.api.hide();
      }}
    />
  );
}

function Export(payload: unknown) {
  const { pop } = useRouteStack();
  return <ExportScreen id={String(payload ?? "")} onDone={pop} />;
}

export default [
  createScreen({ name: TEXT_FROM_IMAGE_ROUTE, component: Library }),
  createScreen({ name: TEXT_FROM_IMAGE_RESULT_ROUTE, component: Result }),
  createScreen({ name: TEXT_FROM_IMAGE_EXPORT_ROUTE, component: Export }),
];
