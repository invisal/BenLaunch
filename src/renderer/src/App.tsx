import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { cn } from "cnfast";
import type { OpenWithApp } from "../../shared/quicklink";
import type { Calculation, LauncherAction } from "../../shared/types";
import SearchItem from "./components/SearchItem";
import ActionsMenu, { type MenuActionItem } from "./components/ActionsMenu";
import CreateQuicklink from "./components/CreateQuicklink";

/** The launcher form that's open on top of the search view, if any. */
type Editor =
  | { mode: "create" }
  | { mode: "edit"; id: string }
  | { mode: "duplicate"; id: string };

function App() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LauncherAction[]>([]);
  const [calculation, setCalculation] = useState<Calculation | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
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
  }, [query, reloadNonce]);

  // The calculation, when present, sits at index 0 above the actions.
  const calcOffset = calculation ? 1 : 0;
  const itemCount = results.length + calcOffset;

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

  function runSelected(index: number): void {
    if (calculation && index === 0) {
      copyCalculation();
      return;
    }
    const action = results[index - calcOffset];
    if (!action) return;
    // Some actions open a renderer view (e.g. the Create Quicklink form) instead
    // of executing in the main process — switch to it and keep the launcher open.
    if (action.view === "create-quicklink") {
      setMenuOpen(false);
      setEditor({ mode: "create" });
      return;
    }
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

    const run: MenuActionItem = {
      id: "run",
      label: selectedAction.type === "quicklink" ? "Open Quicklink" : "Run",
      shortcut: "Enter",
      onSelect: () => runSelected(selectedIndex),
    };

    const copyName: MenuActionItem = {
      id: "copy-name",
      label: "Copy Name",
      shortcut: "CommandOrControl+C",
      onSelect: () => void navigator.clipboard.writeText(selectedAction.title),
    };

    const createQuicklink: MenuActionItem = {
      id: "create-quicklink",
      label: "Create Quicklink",
      onSelect: () => {
        setMenuOpen(false);
        setEditor({ mode: "create" });
      },
    };

    if (selectedAction.type !== "quicklink" || !selectedAction.id.startsWith("ql:")) {
      return [
        run,
        copyName,
        {
          id: "pin",
          label: pinned ? "Unpin" : "Pin",
          shortcut: "CommandOrControl+P",
          onSelect: () => void togglePin(),
        },
        { ...createQuicklink, section: "Quicklink" },
      ];
    }

    // Store methods (pin/hide/delete/get/edit) key on the bare slug; `execute`
    // (used by Open With) keys on the full `ql:` action id.
    const actionId = selectedAction.id;
    const id = actionId.slice(3);
    const isPinned = !!selectedAction.pinned;
    const isHidden = !!selectedAction.hidden;

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
      { ...createQuicklink, section: "Quicklink" },
      {
        id: "delete",
        section: "Danger Zone",
        label: "Delete Quicklink",
        danger: true,
        submenu: [
          {
            id: "delete-confirm",
            label: `Delete “${selectedAction.title}”`,
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
  }, [selectedAction, calculation, pinned, selectedIndex, apps, query]);

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
          setSelectedIndex(0);
          reload();
        }}
      />
    );
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
