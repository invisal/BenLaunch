import { useEffect, useState } from "react";
import { WindowFrame } from "@renderer/shared/ui";
import CodeScreen from "./CodeScreen";

/**
 * The QuickValue window is now just the CodeMirror editor for one QuickValue —
 * the list and the metadata form moved into the launcher's navigation stack.
 * The id is carried in the URL hash (`#<id>`); `openQuickValueWindow` sets it.
 */
function idFromHash(): string {
  return decodeURIComponent(window.location.hash.replace(/^#/, ""));
}

function QuickValue() {
  const [id, setId] = useState(idFromHash);

  useEffect(() => {
    const onHashChange = (): void => setId(idFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return (
    <WindowFrame title="QuickValue">
      {id ? (
        <CodeScreen key={id} id={id} />
      ) : (
        <p className="px-6 py-8 text-sm text-foreground-subtle">
          No QuickValue selected.
        </p>
      )}
    </WindowFrame>
  );
}

export default QuickValue;
