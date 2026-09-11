import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import type { OpenWithApp } from "../../../../shared/quicklink";
import type { Calculation, LauncherAction } from "../../../../shared/types";
import { Footer, ListScreen } from "@renderer/shared/ui";
import type { FooterMenuItem } from "@renderer/shared/ui";
import SearchItem, { SEARCH_ITEM_HEIGHT } from "./components/SearchItem";
import CalculatorPanel, {
  CALCULATOR_PANEL_HEIGHT,
} from "./components/CalculatorPanel";
import { buildContextMenu } from "./context-menu/registry";
import type { ContextMenuContext } from "./context-menu/types";
import { useLauncherHost } from "./host";
import { useRouteStack } from "./router/context";

type Row =
  | { key: string; kind: "calc"; calculation: Calculation }
  | { key: string; kind: "action"; action: LauncherAction };

/**
 * `SearchItem` rows are fixed-height, so they need no measurement — this is
 * only ever their exact, final height. A `"calc"` row's `CALCULATOR_PANEL_HEIGHT`
 * is just the virtualizer's starting estimate: `ListScreen`'s `measureItem`
 * (wired up below, only for that one row kind) corrects it to the panel's
 * real rendered height once a `Calculation`'s `value` wraps onto more than one
 * line — a multi-zone timezone listing, for instance.
 */
function rowHeight(row: Row): number {
  return row.kind === "calc" ? CALCULATOR_PANEL_HEIGHT : SEARCH_ITEM_HEIGHT;
}

/**
 * The launcher's search screen: the query input, the ranked result list, the
 * inline calculator panel and the Ctrl+K actions menu (the shared
 * `Footer.Menu`, built from `buildMenuActions`). It's the root entry of the
 * navigation stack (see `router/`), so its Effects — the focus trap, and the
 * ⌘K binding `Footer.Menu` owns — are torn down and re-mounted by `<Activity>`
 * whenever a screen is pushed over it or popped back off, with no manual
 * guarding here.
 */
function LauncherScreen() {
  const { query, setQuery, reloadNonce, reload } = useLauncherHost();
  const { push, reset } = useRouteStack();

  const [results, setResults] = useState<LauncherAction[]>([]);
  const [calculation, setCalculation] = useState<Calculation | null>(null);
  // One-shot "please force-refresh this row" signal for a `SearchItem` — not a
  // value store. SearchItem owns its own subtitle/loading state and fetches it
  // itself via `requestSubtitle`; this only tells the one row matching `id` to
  // re-call that (with `force: true`) after an out-of-band change like the row
  // menu's "Refresh". A fresh `token` on every trigger so re-refreshing the same
  // id still re-fires the matching SearchItem's effect.
  const [forceRefresh, setForceRefresh] = useState<{
    id: string;
    token: number;
  } | null>(null);
  const [pinned, setPinned] = useState(false);
  const [apps, setApps] = useState<OpenWithApp[]>([]);

  async function togglePin(): Promise<void> {
    setPinned(await window.api.togglePin());
  }

  useEffect(() => {
    let live = true;
    void window.api.openWithApps().then((list) => {
      if (live) setApps(list);
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    window.api.query(query).then((res) => {
      if (!cancelled) {
        setResults(res.result);
        setCalculation(res.calculation ?? null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [query, reloadNonce]);

  // The list feeds Base UI's Autocomplete (inside ListScreen): the
  // calculation, when present, is the first row, then the ranked actions.
  // Filtering/ranking stays in the main process — `serverFiltered` below.
  //
  // Deliberately depends only on `calculation`/`results`: a row's live subtitle
  // is fetched and held by its own `SearchItem` instance, not lifted up here —
  // see SearchItem.tsx. `rows` used to be rebuilt on every Widget value
  // push, which changed every row's identity; Autocomplete tracks the
  // highlighted item by identity in this `rows`/`items` array, so that churn
  // (which, since deferred rows fetch on mount, happened continuously while
  // scrolling) made it lose track and fall back to re-highlighting the first
  // row — which then yanked the list back to the top.
  const rows = useMemo<Row[]>(() => {
    const list: Row[] = [];
    if (calculation) list.push({ key: "__calc__", kind: "calc", calculation });
    for (const action of results) {
      list.push({ key: action.id, kind: "action", action });
    }
    return list;
  }, [calculation, results]);

  function dismiss(): void {
    setQuery("");
    reset();
    if (!pinned) window.api.hide();
  }

  function copyCalculation(): void {
    if (!calculation) return;
    void navigator.clipboard.writeText(calculation.value);
    dismiss();
  }

  function runRow(row: Row): void {
    if (row.kind === "calc") {
      copyCalculation();
      return;
    }
    const { action } = row;
    if (action.type === "widget") {
      // The row is a value, not an action — Enter copies it, like the calc row.
      // Ask for the current value directly (cheap: a no-op refresh resolves
      // from cache instantly) rather than reading `row.action.subtitle`, which
      // is only a snapshot from the last query and may be behind what the row's
      // own SearchItem has since fetched.
      const id = row.action.id;
      void window.api.requestSubtitle(id).then((subtitle) => {
        if (subtitle) void navigator.clipboard.writeText(subtitle);
      });
      dismiss();
      return;
    }
    // Most actions just run in the main process and the launcher dismisses.
    // Some (e.g. the Widget/Group managers, "Create Quicklink") instead call
    // `ctx.navigate()` and resolve with a screen to push — the launcher stays
    // open showing it instead of dismissing.
    void window.api.execute(action.id, query).then((result) => {
      if (result.navigate) {
        push(result.navigate);
      } else {
        dismiss();
      }
    });
  }

  function buildMenuActions(target: Row | null): FooterMenuItem[] {
    if (!target) return [];
    if (target.kind === "calc") {
      const { calculation: calc } = target;
      return [
        {
          id: "copy-result",
          label: "Copy Result",
          shortcut: "Enter",
          onSelect: copyCalculation,
        },
        {
          id: "use-as-input",
          label: "Use as Input",
          shortcut: "CommandOrControl+Enter",
          onSelect: () => setQuery(calc.rawValue),
        },
      ];
    }

    // Everything a contributor might need beyond the `LauncherAction` itself —
    // renderer-only effects, plus the `window.api` calls are reached directly.
    const ctx: ContextMenuContext = {
      query,
      pinned,
      apps,
      setQuery,
      push,
      reload,
      dismiss,
      togglePin: () => void togglePin(),
      forceRefresh: (id) => setForceRefresh({ id, token: Date.now() }),
      runAction: (action) => runRow({ key: action.id, kind: "action", action }),
    };
    return buildContextMenu(target.action, ctx);
  }

  // Arrow keys / Enter are handled by Autocomplete inside ListScreen; Escape
  // (clear query, else hide) is its own built-in ladder — we only add the
  // launcher's extra shortcuts on top.
  function onInputKeyDown(
    e: KeyboardEvent<HTMLInputElement>,
    active: Row | null,
  ): void {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      // ⌘↵ on a calculation feeds the answer back into the search box to keep
      // calculating, instead of copying + dismissing.
      if (active?.kind === "calc") {
        e.preventDefault();
        setQuery(active.calculation.rawValue);
      }
      return;
    }
    if (e.key.toLowerCase() === "p" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void togglePin();
    }
  }

  return (
    <ListScreen<Row>
      data={rows}
      getId={(row) => row.key}
      renderItem={(row, { highlighted }) =>
        row.kind === "calc" ? (
          <CalculatorPanel calculation={row.calculation} highlighted={highlighted} />
        ) : (
          <SearchItem
            action={row.action}
            highlighted={highlighted}
            forceRefreshToken={
              forceRefresh?.id === row.action.id ? forceRefresh.token : undefined
            }
          />
        )
      }
      virtualized
      itemHeight={rowHeight}
      measureItem={(row) => row.kind === "calc"}
      serverFiltered
      inputValue={query}
      onInputChange={setQuery}
      onInputKeyDown={onInputKeyDown}
      placeholder="Search actions..."
      autoRefocus
      onActivate={runRow}
      onExit={() => window.api.hide()}
      menu={buildMenuActions}
      customFooter={
        <>
          <Footer.Label>
            {results.length} result{results.length === 1 ? "" : "s"}
          </Footer.Label>
          <Footer.Button
            active={pinned}
            onClick={() => void togglePin()}
            title={
              pinned
                ? "Unpin (stays open) — Ctrl+P"
                : "Pin (stay open on focus loss) — Ctrl+P"
            }
          >
            📌 {pinned ? "Pinned" : "Pin"}
          </Footer.Button>
        </>
      }
      emptyLabel="No results"
      noMatchLabel="No results"
    />
  );
}

export default LauncherScreen;
