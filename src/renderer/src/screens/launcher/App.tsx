import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Autocomplete } from "@base-ui/react/autocomplete";
import { cn } from "cnfast";
import type { Calculation, LauncherAction } from "../../../../shared/types";
import SearchItem from "./components/SearchItem";
import ActionsMenu, { type MenuActionItem } from "./components/ActionsMenu";
import CalculatorPanel from "./components/CalculatorPanel";

type Row =
  | { key: string; kind: "calc"; calculation: Calculation }
  | { key: string; kind: "action"; action: LauncherAction };

function App() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LauncherAction[]>([]);
  const [calculation, setCalculation] = useState<Calculation | null>(null);
  const [highlightedRow, setHighlightedRow] = useState<Row | null>(null);
  const [pinned, setPinned] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function togglePin(): Promise<void> {
    setPinned(await window.api.togglePin());
  }

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
  }, [query]);

  // The list feeds Base UI's Autocomplete: the calculation, when present, is the
  // first row, then the ranked actions. Filtering/ranking stays in the main
  // process (`mode="none"`); Base UI only owns keyboard navigation and a11y.
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
    setMenuOpen(false);
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
    void window.api.execute(row.action.id, query);
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
    const { action } = active;
    return [
      {
        id: "run",
        label: "Run",
        shortcut: "Enter",
        onSelect: () => runRow(active),
      },
      {
        id: "copy-name",
        label: "Copy Name",
        shortcut: "CommandOrControl+C",
        onSelect: () => void navigator.clipboard.writeText(action.title),
      },
      {
        id: "pin",
        label: pinned ? "Unpin" : "Pin",
        shortcut: "CommandOrControl+P",
        onSelect: () => void togglePin(),
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightedRow, rows, pinned]);

  useEffect(() => {
    function onGlobalKeyDown(e: globalThis.KeyboardEvent): void {
      if (e.key.toLowerCase() === "k" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setMenuOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onGlobalKeyDown);
    return () => window.removeEventListener("keydown", onGlobalKeyDown);
  }, []);

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
      autoHighlight="always"
      onItemHighlighted={(row) => setHighlightedRow(row ?? null)}
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

        <div className="result-scroll flex-1 overflow-y-auto p-2">
          <Autocomplete.List className="flex flex-col gap-[1px]">
            {(row: Row, index: number) => (
              <Autocomplete.Item
                key={row.key}
                value={row}
                index={index}
                onClick={() => runRow(row)}
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
                    />
                  )
                }
              />
            )}
          </Autocomplete.List>

          {rows.length === 0 && (
            <div className="px-3 py-2 text-sm text-foreground-subtle">
              No results
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-border px-4 py-2 text-xs text-foreground-subtle [-webkit-app-region:drag]">
          <span>
            {results.length} result{results.length === 1 ? "" : "s"}
          </span>
          <span className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void togglePin()}
              title={
                pinned
                  ? "Unpin (stays open) — Ctrl+P"
                  : "Pin (stay open on focus loss) — Ctrl+P"
              }
              className={cn(
                "rounded px-1.5 py-0.5 [-webkit-app-region:no-drag]",
                pinned
                  ? "bg-item-selected text-foreground"
                  : "text-foreground-subtle hover:bg-item-hover",
              )}
            >
              📌 {pinned ? "Pinned" : "Pin"}
            </button>
            <ActionsMenu
              open={menuOpen}
              onOpenChange={setMenuOpen}
              actions={menuActions}
              finalFocus={inputRef}
            />
          </span>
        </div>
      </div>
    </Autocomplete.Root>
  );
}

export default App;
