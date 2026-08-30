import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { cn } from "cnfast";
import type { Calculation, LauncherAction } from "../../shared/types";
import SearchItem from "./components/SearchItem";
import ActionsMenu, { type MenuActionItem } from "./components/ActionsMenu";

function App() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LauncherAction[]>([]);
  const [calculation, setCalculation] = useState<Calculation | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
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
        setSelectedIndex(0);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [query]);

  // The calculation, when present, sits at index 0 above the actions.
  const calcOffset = calculation ? 1 : 0;
  const itemCount = results.length + calcOffset;

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

  function runSelected(index: number): void {
    if (calculation && index === 0) {
      copyCalculation();
      return;
    }
    const action = results[index - calcOffset];
    if (!action) return;
    void window.api.execute(action.id, query);
    dismiss();
  }

  const selectedAction =
    calculation && selectedIndex === 0
      ? null
      : (results[selectedIndex - calcOffset] ?? null);

  const menuActions = useMemo<MenuActionItem[]>(() => {
    if (calculation && selectedIndex === 0) {
      return [
        {
          id: "copy-result",
          label: "Copy Result",
          shortcut: "Enter",
          onSelect: copyCalculation,
        },
      ];
    }
    if (!selectedAction) return [];
    return [
      {
        id: "run",
        label: "Run",
        shortcut: "Enter",
        onSelect: () => runSelected(selectedIndex),
      },
      {
        id: "copy-name",
        label: "Copy Name",
        shortcut: "CommandOrControl+C",
        onSelect: () =>
          void navigator.clipboard.writeText(selectedAction.title),
      },
      {
        id: "pin",
        label: pinned ? "Unpin" : "Pin",
        shortcut: "CommandOrControl+P",
        onSelect: () => void togglePin(),
      },
    ];
  }, [selectedAction, calculation, pinned, selectedIndex]);

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

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, itemCount - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      runSelected(selectedIndex);
    } else if (e.key === "Escape") {
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
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      <div className="flex items-center border-b border-border px-2 p-1 [-webkit-app-region:drag]">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search actions..."
          autoFocus
          className="w-full bg-transparent px-2 py-2 text-lg outline-none placeholder:text-foreground-subtle [-webkit-app-region:no-drag]"
        />
      </div>

      {calculation && (
        <div className="p-2 px-4">
          <div className="text-foreground-subtle font-medium text-xs">
            Calculator
          </div>
          <div className="text-2xl flex font-medium">{calculation.value}</div>
        </div>
      )}

      <ul className="result-scroll flex-1 overflow-y-auto p-2 gap-[1px] flex flex-col">
        {itemCount === 0 && (
          <li className="px-3 py-2 text-sm text-foreground-subtle">
            No results
          </li>
        )}

        {results.map((action, index) => (
          <SearchItem
            key={action.id}
            action={action}
            selected={index + calcOffset === selectedIndex}
            onClick={() => runSelected(index + calcOffset)}
          />
        ))}
      </ul>
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
  );
}

export default App;
