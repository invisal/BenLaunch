import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Route } from "./types";

interface RouteStack {
  /** Bottom-to-top; `stack[0]` is always the launcher root and it is never empty. */
  stack: Route[];
  /** The screen currently on top / visible. */
  current: Route;
  /** Push a new screen on top of the current one. */
  push(route: Route): void;
  /** Drop the top screen and go back. No-op at the launcher root. */
  pop(): void;
  /** Swap the top screen for another without changing the stack depth. */
  replace(route: Route): void;
  /** Collapse straight back to the launcher root (e.g. when the window dismisses). */
  reset(): void;
}

const ROOT: Route = { name: "launcher" };

const RouteStackContext = createContext<RouteStack | null>(null);

/**
 * Owns the launcher's navigation stack. A renderer-local router: no URLs, no
 * history — just an array of {@link Route} descriptors with the launcher search
 * screen pinned at the bottom. `router/Outlet.tsx` turns the array into screens.
 */
export function RouteStackProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<Route[]>([ROOT]);

  const push = useCallback((route: Route) => {
    setStack((s) => [...s, route]);
  }, []);
  const pop = useCallback(() => {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  }, []);
  const replace = useCallback((route: Route) => {
    setStack((s) => [...s.slice(0, -1), route]);
  }, []);
  const reset = useCallback(() => {
    setStack((s) => (s.length === 1 ? s : [ROOT]));
  }, []);

  const value = useMemo<RouteStack>(
    () => ({
      stack,
      current: stack[stack.length - 1],
      push,
      pop,
      replace,
      reset,
    }),
    [stack, push, pop, replace, reset],
  );

  return (
    <RouteStackContext.Provider value={value}>
      {children}
    </RouteStackContext.Provider>
  );
}

export function useRouteStack(): RouteStack {
  const ctx = useContext(RouteStackContext);
  if (!ctx) {
    throw new Error("useRouteStack must be used within a RouteStackProvider");
  }
  return ctx;
}
