import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Launcher state that outlives any single screen in the navigation stack: the
 * search query and a reload signal.
 *
 * It lives here — above the stack, in `App` — rather than inside `LauncherScreen`
 * so that a pushed screen can hand control back to the search view with a new
 * query when it finishes (Create Quicklink's `onCreated` → `setQuery(name)` +
 * `reload()`). `LauncherScreen` is a *sibling* of those screens in the stack,
 * not an ancestor, so it can't pass callbacks down to them directly.
 */
interface LauncherHost {
  query: string;
  setQuery(value: string): void;
  /** Bumped to make `LauncherScreen` re-run the current query. */
  reloadNonce: number;
  reload(): void;
}

const LauncherHostContext = createContext<LauncherHost | null>(null);

export function LauncherHostProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

  const reload = useCallback(() => setReloadNonce((n) => n + 1), []);

  const value = useMemo<LauncherHost>(
    () => ({ query, setQuery, reloadNonce, reload }),
    [query, reloadNonce, reload],
  );

  return (
    <LauncherHostContext.Provider value={value}>
      {children}
    </LauncherHostContext.Provider>
  );
}

export function useLauncherHost(): LauncherHost {
  const ctx = useContext(LauncherHostContext);
  if (!ctx) {
    throw new Error("useLauncherHost must be used within a LauncherHostProvider");
  }
  return ctx;
}
