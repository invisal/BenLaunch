import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { Autocomplete } from "@base-ui/react/autocomplete";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { LauncherView, OpenWithApp } from "../../../../shared/quicklink";
import type { Calculation, LauncherAction } from "../../../../shared/types";
import { Footer } from "@renderer/shared/ui";
import { useShortcut } from "@renderer/lib/use-shortcut";
import SearchItem, { SEARCH_ITEM_HEIGHT } from "./components/SearchItem";
import ActionsMenu, { type MenuActionItem } from "./components/ActionsMenu";
import CalculatorPanel, {
  CALCULATOR_PANEL_HEIGHT,
} from "./components/CalculatorPanel";
import { buildContextMenu } from "./context-menu/registry";
import type { ContextMenuContext } from "./context-menu/types";
import { useLauncherHost } from "./host";
import { useRouteStack } from "./router/context";
import type { Route } from "./router/types";

type Row =
  | { key: string; kind: "calc"; calculation: Calculation }
  | { key: string; kind: "action"; action: LauncherAction };

/**
 * `SearchItem` rows are fixed-height, so they need no measurement — this is
 * only ever their exact, final height. A `"calc"` row's `CALCULATOR_PANEL_HEIGHT`
 * is just the virtualizer's starting estimate: `measureElement` (wired up
 * below, only for that one row kind) corrects it to the panel's real
 * rendered height once a `Calculation`'s `value` wraps onto more than one
 * line — a multi-zone timezone listing, for instance.
 */
function rowHeight(row: Row): number {
  return row.kind === "calc" ? CALCULATOR_PANEL_HEIGHT : SEARCH_ITEM_HEIGHT;
}

/**
 * The launcher's search screen: the query input, the ranked result list, the
 * inline calculator panel and the Ctrl+K actions menu. It's the root entry of
 * the navigation stack (see `router/`), so its Effects — the focus trap and the
 * Ctrl+K shortcut — are torn down and re-mounted by `<Activity>` whenever a
 * screen is pushed over it or popped back off, with no manual guarding here.
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
  const [highlightedRow, setHighlightedRow] = useState<Row | null>(null);
  const [pinned, setPinned] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [apps, setApps] = useState<OpenWithApp[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastHighlightedIndex = useRef<number | null>(null);

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
    function focusAndSelect(): void {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
    focusAndSelect();
    window.addEventListener("focus", focusAndSelect);
    return () => window.removeEventListener("focus", focusAndSelect);
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

  // The list feeds Base UI's Autocomplete: the calculation, when present, is the
  // first row, then the ranked actions. Filtering/ranking stays in the main
  // process (`mode="none"`); Base UI only owns keyboard navigation and a11y.
  //
  // Deliberately depends only on `calculation`/`results`: a row's live subtitle
  // is fetched and held by its own `SearchItem` instance, not lifted up here —
  // see SearchItem.tsx. `rows` used to be rebuilt on every QuickValue value
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

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => rowHeight(rows[index]),
    overscan: 8,
    gap: 1,
  });

  function dismiss(): void {
    setQuery("");
    setMenuOpen(false);
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
    // Some actions open a renderer screen (the Create Quicklink form, the
    // QuickValue manager) instead of executing in the main process — push it
    // onto the stack and keep the launcher window open behind it.
    if (action.view) {
      setMenuOpen(false);
      const route: Record<LauncherView, Route> = {
        "create-quicklink": { name: "quicklink-create", seed: query },
        "quickvalue-list": { name: "quickvalue-list" },
        "quickvalue-create": { name: "quickvalue-create" },
        "custom-layout-list": { name: "custom-layout-list" },
        "custom-layout-create": { name: "custom-layout-create" },
      };
      push(route[action.view]);
      return;
    }
    if (action.type === "quickvalue") {
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
    void window.api.execute(action.id, query);
    dismiss();
  }

  const menuActions = useMemo<MenuActionItem[]>(() => {
    const active = highlightedRow ?? rows[0] ?? null;
    if (!active) return [];
    if (active.kind === "calc") {
      const { calculation: calc } = active;
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
    return buildContextMenu(active.action, ctx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightedRow, rows, pinned, apps, query]);

  // ActionsMenu doesn't bind its own toggle shortcut (unlike Footer.Menu), so
  // Ctrl+K is wired up here. `<Activity>` unmounts this while another screen is
  // on top, so the menu can't be opened from behind a pushed form.
  useShortcut({
    "CommandOrControl+K": () => setMenuOpen((open) => !open),
  });

  // Arrow keys / Enter are handled by Autocomplete; we only add the launcher's
  // own shortcuts on top.
  function onInputKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      // ⌘↵ on a calculation feeds the answer back into the search box to keep
      // calculating, instead of copying + dismissing.
      const active = highlightedRow ?? rows[0] ?? null;
      if (active?.kind === "calc") {
        e.preventDefault();
        setQuery(active.calculation.rawValue);
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      if (query) {
        setQuery("");
      } else {
        window.api.hide();
      }
    } else if (e.key.toLowerCase() === "p" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void togglePin();
    }
  }

  return (
    <Autocomplete.Root
      items={rows}
      value={query}
      onValueChange={(value) => setQuery(value)}
      mode="none"
      inline
      open
      loopFocus={false}
      autoHighlight="always"
      onItemHighlighted={(row, { index }) => {
        setHighlightedRow(row ?? null);
        // Rows are rebuilt (new object identities) whenever query results
        // change, which re-fires this callback even though the highlighted
        // *index* hasn't moved. Only scroll when the index actually changes,
        // so a results refresh doesn't yank the list back to the highlighted
        // row while the user has scrolled elsewhere. (QuickValue live updates
        // no longer rebuild `rows` at all — see the comment above `rows`.)
        if (row && index !== lastHighlightedIndex.current) {
          lastHighlightedIndex.current = index;
          queueMicrotask(() =>
            virtualizer.scrollToIndex(index, { align: "auto" }),
          );
        }
      }}
    >
      <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
        <div className="flex items-center border-b border-border px-2 p-1 [-webkit-app-region:drag]">
          <Autocomplete.Input
            ref={inputRef}
            onKeyDown={onInputKeyDown}
            placeholder="Search actions..."
            autoFocus
            className="w-full bg-transparent px-2 py-2 text-lg outline-none placeholder:text-foreground-subtle [-webkit-app-region:no-drag]"
          />
        </div>

        <div
          ref={scrollRef}
          className="result-scroll flex-1 overflow-y-auto p-2"
        >
          <Autocomplete.List
            className="relative w-full"
            style={{ height: virtualizer.getTotalSize() }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              if (!row) return null;
              return (
                <Autocomplete.Item
                  key={row.key}
                  value={row}
                  index={virtualRow.index}
                  onClick={() => runRow(row)}
                  onContextMenu={(e: MouseEvent) => {
                    e.preventDefault();
                    setHighlightedRow(row);
                    setMenuOpen(true);
                  }}
                  // Only the "calc" row can grow taller than its estimate
                  // (see rowHeight above) — measuring every row would cost a
                  // ResizeObserver per row for no benefit, since SearchItem
                  // never deviates from SEARCH_ITEM_HEIGHT.
                  {...(row.kind === "calc"
                    ? { ref: virtualizer.measureElement, "data-index": virtualRow.index }
                    : {})}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: virtualRow.size,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  render={(props, state) =>
                    row.kind === "calc" ? (
                      <CalculatorPanel
                        {...props}
                        calculation={row.calculation}
                        highlighted={state.highlighted}
                      />
                    ) : (
                      <SearchItem
                        {...props}
                        action={row.action}
                        highlighted={state.highlighted}
                        forceRefreshToken={
                          forceRefresh?.id === row.action.id
                            ? forceRefresh.token
                            : undefined
                        }
                      />
                    )
                  }
                />
              );
            })}
          </Autocomplete.List>

          {rows.length === 0 && (
            <div className="px-3 py-2 text-sm text-foreground-subtle">
              No results
            </div>
          )}
        </div>

        <Footer>
          <Footer.Left>
            <Footer.Label>
              {results.length} result{results.length === 1 ? "" : "s"}
            </Footer.Label>
          </Footer.Left>
          <Footer.Right>
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
            <ActionsMenu
              open={menuOpen}
              onOpenChange={setMenuOpen}
              actions={menuActions}
              finalFocus={inputRef}
            />
          </Footer.Right>
        </Footer>
      </div>
    </Autocomplete.Root>
  );
}

export default LauncherScreen;
