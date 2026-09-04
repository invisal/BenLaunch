import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Autocomplete } from "@base-ui/react/autocomplete";
import { cn } from "cnfast";
import type { OpenWithApp } from "../../../../shared/quicklink";
import type {
  Calculation,
  LauncherAction,
  QuickValueUpdate,
} from "../../../../shared/types";
import SearchItem from "./components/SearchItem";
import ActionsMenu, { type MenuActionItem } from "./components/ActionsMenu";
import CalculatorPanel from "./components/CalculatorPanel";
import CreateQuicklink from "../../components/CreateQuicklink";

type Row =
  | { key: string; kind: "calc"; calculation: Calculation }
  | { key: string; kind: "action"; action: LauncherAction };

/** The launcher form that's open on top of the search view, if any. */
type Editor =
  | { mode: "create" }
  | { mode: "edit"; id: string }
  | { mode: "duplicate"; id: string };

function App() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LauncherAction[]>([]);
  const [calculation, setCalculation] = useState<Calculation | null>(null);
  // Live overrides for exposed QuickValue rows, pushed from the main process as
  // their async functions resolve. Keyed by the full action id (`qv:<slug>`).
  const [qvLive, setQvLive] = useState<
    Map<string, { subtitle: string; isLoading: boolean }>
  >(new Map());
  const [highlightedRow, setHighlightedRow] = useState<Row | null>(null);
  const [pinned, setPinned] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  // Bumped to re-run the current query after a quicklink is changed underneath us.
  const [reloadNonce, setReloadNonce] = useState(0);
  const [apps, setApps] = useState<OpenWithApp[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  async function togglePin(): Promise<void> {
    setPinned(await window.api.togglePin());
  }

  /** Re-run the current query (e.g. after pin/hide/delete changes the list). */
  function reload(): void {
    setReloadNonce((n) => n + 1);
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
      if (editor) return;
      inputRef.current?.focus();
      inputRef.current?.select();
    }
    focusAndSelect();
    window.addEventListener("focus", focusAndSelect);
    return () => window.removeEventListener("focus", focusAndSelect);
  }, [editor]);

  useEffect(() => {
    return window.api.onQuickValueUpdate((update: QuickValueUpdate) => {
      setQvLive((prev) => {
        const next = new Map(prev);
        next.set(`qv:${update.id}`, {
          subtitle: update.subtitle,
          isLoading: update.isLoading,
        });
        return next;
      });
    });
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
  const rows = useMemo<Row[]>(() => {
    const list: Row[] = [];
    if (calculation) list.push({ key: "__calc__", kind: "calc", calculation });
    for (const action of results) {
      const override =
        action.type === "quickvalue" ? qvLive.get(action.id) : undefined;
      list.push({
        key: action.id,
        kind: "action",
        action: override ? { ...action, ...override } : action,
      });
    }
    return list;
  }, [calculation, results, qvLive]);

  function dismiss(): void {
    setQuery("");
    setMenuOpen(false);
    setEditor(null);
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
    // Some actions open a renderer view (e.g. the Create Quicklink form) instead
    // of executing in the main process — switch to it and keep the launcher open.
    if (action.view === "create-quicklink") {
      setMenuOpen(false);
      setEditor({ mode: "create" });
      return;
    }
    if (action.type === "quickvalue") {
      // The row is a value, not an action — Enter copies it, like the calc row.
      if (action.subtitle) {
        void navigator.clipboard.writeText(action.subtitle);
      }
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

    const { action } = active;

    const copyName: MenuActionItem = {
      id: "copy-name",
      label: "Copy Name",
      shortcut: "CommandOrControl+C",
      onSelect: () => void navigator.clipboard.writeText(action.title),
    };

    const createQuicklinkItem: MenuActionItem = {
      id: "create-quicklink",
      label: "Create Quicklink",
      onSelect: () => {
        setMenuOpen(false);
        setEditor({ mode: "create" });
      },
    };

    if (action.type === "quickvalue") {
      const slug = action.id.slice("qv:".length);
      return [
        {
          id: "copy-value",
          label: "Copy Value",
          shortcut: "Enter",
          onSelect: () => runRow(active),
        },
        {
          id: "refresh",
          label: "Refresh",
          onSelect: () => void window.api.execute(action.id, query),
        },
        {
          id: "edit",
          label: "Edit QuickValue",
          onSelect: () => void window.api.execute(`qv:edit:${slug}`, query),
        },
        {
          id: "manage",
          label: "Manage QuickValues",
          onSelect: () => void window.api.execute("cmd:quickvalue-manage", query),
        },
      ];
    }

    const run: MenuActionItem = {
      id: "run",
      label: action.type === "quicklink" ? "Open Quicklink" : "Run",
      shortcut: "Enter",
      onSelect: () => runRow(active),
    };

    if (action.type !== "quicklink" || !action.id.startsWith("ql:")) {
      return [
        run,
        copyName,
        {
          id: "pin",
          label: pinned ? "Unpin" : "Pin",
          shortcut: "CommandOrControl+P",
          onSelect: () => void togglePin(),
        },
        { ...createQuicklinkItem, section: "Quicklink" },
      ];
    }

    // Store methods (pin/hide/delete/get/edit) key on the bare slug; `execute`
    // (used by Open With) keys on the full `ql:` action id.
    const actionId = action.id;
    const id = actionId.slice(3);
    const isPinned = !!action.pinned;
    const isHidden = !!action.hidden;

    const openWith: MenuActionItem = {
      id: "open-with",
      label: "Open With…",
      submenu: [
        {
          id: "ow:__default",
          label: "Default App",
          onSelect: () => {
            void window.api.openQuicklinkWith(actionId, query, "");
            dismiss();
          },
        },
        ...apps.map((app) => ({
          id: `ow:${app.path}`,
          label: app.name,
          icon: app.icon,
          onSelect: () => {
            void window.api.openQuicklinkWith(actionId, query, app.path);
            dismiss();
          },
        })),
      ],
    };

    return [
      run,
      openWith,
      {
        id: "pin",
        section: "Manage Quicklink",
        label: isPinned ? "Unpin Quicklink" : "Pin Quicklink",
        onSelect: async () => {
          await window.api.setQuicklinkPinned(id, !isPinned);
          reload();
        },
      },
      {
        id: "edit",
        section: "Manage Quicklink",
        label: "Edit Quicklink",
        onSelect: () => {
          setMenuOpen(false);
          setEditor({ mode: "edit", id });
        },
      },
      {
        id: "duplicate",
        section: "Manage Quicklink",
        label: "Duplicate Quicklink",
        onSelect: () => {
          setMenuOpen(false);
          setEditor({ mode: "duplicate", id });
        },
      },
      {
        id: "hide",
        section: "Manage Quicklink",
        label: isHidden ? "Show in Root Search" : "Hide in Root Search",
        onSelect: async () => {
          await window.api.setQuicklinkHidden(id, !isHidden);
          reload();
        },
      },
      { ...copyName, section: "Copy" },
      {
        id: "copy-link",
        section: "Copy",
        label: "Copy Link",
        onSelect: async () => {
          const ql = await window.api.getQuicklink(id);
          if (ql) await navigator.clipboard.writeText(ql.link);
        },
      },
      { ...createQuicklinkItem, section: "Quicklink" },
      {
        id: "delete",
        section: "Danger Zone",
        label: "Delete Quicklink",
        danger: true,
        submenu: [
          {
            id: "delete-confirm",
            label: `Delete "${action.title}"`,
            danger: true,
            onSelect: async () => {
              await window.api.deleteQuicklink(id);
              reload();
            },
          },
        ],
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightedRow, rows, pinned, apps, query]);

  useEffect(() => {
    function onGlobalKeyDown(e: globalThis.KeyboardEvent): void {
      if (editor) return;
      if (e.key.toLowerCase() === "k" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setMenuOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onGlobalKeyDown);
    return () => window.removeEventListener("keydown", onGlobalKeyDown);
  }, [editor]);

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

  if (editor) {
    return (
      <CreateQuicklink
        seed={editor.mode === "create" ? query : undefined}
        editId={editor.mode === "edit" ? editor.id : undefined}
        duplicateId={editor.mode === "duplicate" ? editor.id : undefined}
        onCancel={() => setEditor(null)}
        onCreated={(name) => {
          setEditor(null);
          setQuery(name);
          reload();
        }}
      />
    );
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
