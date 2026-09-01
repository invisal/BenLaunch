import { Menu } from "@base-ui/react/menu";
import { cn } from "cnfast";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { formatShortcut } from "../../../lib/shortcut";

export interface MenuActionItem {
  id: string;
  label: string;
  shortcut?: string;
  onSelect: () => void;
}

interface ActionsMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: MenuActionItem[];
  finalFocus?: RefObject<HTMLElement | null>;
}

function ActionsMenu({ open, onOpenChange, actions, finalFocus }: ActionsMenuProps) {
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const trimmed = search.trim().toLowerCase();
    if (!trimmed) return actions;
    return actions.filter((action) => action.label.toLowerCase().includes(trimmed));
  }, [actions, search]);

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setHighlightedIndex(0);
    const raf = requestAnimationFrame(() => searchRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open]);

  useEffect(() => {
    setHighlightedIndex((i) => Math.min(i, Math.max(filtered.length - 1, 0)));
  }, [filtered.length]);

  function runHighlighted(): void {
    filtered[highlightedIndex]?.onSelect();
    onOpenChange(false);
  }

  function onSearchKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      runHighlighted();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onOpenChange(false);
    }
  }

  return (
    <Menu.Root open={open} onOpenChange={onOpenChange}>
      <Menu.Trigger
        className={
          "rounded px-1.5 py-0.5 [-webkit-app-region:no-drag] " +
          (open
            ? "bg-item-selected text-foreground"
            : "text-foreground-subtle hover:bg-item-hover")
        }
      >
        Actions {formatShortcut("CommandOrControl+K")}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="top" align="end" sideOffset={8}>
          <Menu.Popup
            finalFocus={finalFocus}
            className="w-64 rounded-md border border-border bg-background text-foreground shadow-lg outline-none"
          >
            <div className="p-1">
              {filtered.length === 0 && (
                <div className="px-2 py-1.5 text-xs text-foreground-subtle">
                  No actions found
                </div>
              )}
              {filtered.map((action, index) => (
                <Menu.Item
                  key={action.id}
                  onClick={action.onSelect}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={cn(
                    "flex w-full cursor-default items-center justify-between gap-2 rounded px-2 py-1.5 text-sm outline-none",
                    index === highlightedIndex && "bg-item-selected text-foreground",
                  )}
                >
                  <span className="truncate">{action.label}</span>
                  {action.shortcut && (
                    <kbd className="shrink-0 rounded border border-border px-1.5 py-0.5 font-sans text-xs text-foreground-subtle">
                      {formatShortcut(action.shortcut)}
                    </kbd>
                  )}
                </Menu.Item>
              ))}
            </div>
            <div className="border-t border-border p-1">
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder="Search actions..."
                className="w-full bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-foreground-subtle"
              />
            </div>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

export default ActionsMenu;
