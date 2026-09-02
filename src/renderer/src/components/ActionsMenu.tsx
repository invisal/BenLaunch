import { Menu } from "@base-ui/react/menu";
import { cn } from "cnfast";
import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { formatShortcut } from "../lib/shortcut";

export interface MenuActionItem {
  id: string;
  label: string;
  shortcut?: string;
  /** Emoji or image URL shown before the label (used by the "Open With" apps). */
  icon?: string;
  /** Render in a warning colour (Delete Quicklink). */
  danger?: boolean;
  /**
   * Group heading. A heading is drawn above the first item of each run of items
   * that share a `section`; items with no `section` get no heading. Keep items
   * of one section contiguous in the array.
   */
  section?: string;
  /** Leaf action. Omitted when the item only opens a `submenu`. */
  onSelect?: () => void;
  /** When present, selecting the item drills into this nested list instead. */
  submenu?: MenuActionItem[];
}

interface ActionsMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: MenuActionItem[];
  finalFocus?: RefObject<HTMLElement | null>;
}

/** One level of the drill-down: a list plus the label of the item that opened it. */
interface Level {
  label: string | null;
  items: MenuActionItem[];
}

const isImageIcon = (icon: string): boolean => /^(https?:|data:|file:)/.test(icon);

function ActionsMenu({ open, onOpenChange, actions, finalFocus }: ActionsMenuProps) {
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  // The root list, plus one entry per open submenu.
  const [stack, setStack] = useState<Level[]>([{ label: null, items: actions }]);
  const searchRef = useRef<HTMLInputElement>(null);

  const level = stack[stack.length - 1] ?? { label: null, items: actions };
  const inSubmenu = stack.length > 1;

  // Re-seed from the root list each time the menu opens (the selected action, and
  // so `actions`, can't change while the menu holds focus).
  useEffect(() => {
    if (!open) return;
    setStack([{ label: null, items: actions }]);
    setSearch("");
    setHighlightedIndex(0);
    const raf = requestAnimationFrame(() => searchRef.current?.focus());
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const filtered = useMemo(() => {
    const trimmed = search.trim().toLowerCase();
    if (!trimmed) return level.items;
    return level.items.filter((a) => a.label.toLowerCase().includes(trimmed));
  }, [level, search]);

  useEffect(() => {
    setHighlightedIndex((i) => Math.min(i, Math.max(filtered.length - 1, 0)));
  }, [filtered.length]);

  function activate(item: MenuActionItem | undefined): void {
    if (!item) return;
    if (item.submenu) {
      setStack((s) => [...s, { label: item.label, items: item.submenu! }]);
      setSearch("");
      setHighlightedIndex(0);
      searchRef.current?.focus();
      return;
    }
    item.onSelect?.();
    onOpenChange(false);
  }

  function pop(): void {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
    setSearch("");
    setHighlightedIndex(0);
    searchRef.current?.focus();
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
      activate(filtered[highlightedIndex]);
    } else if (e.key === "ArrowRight" && filtered[highlightedIndex]?.submenu) {
      e.preventDefault();
      activate(filtered[highlightedIndex]);
    } else if ((e.key === "ArrowLeft" || e.key === "Backspace") && !search && inSubmenu) {
      e.preventDefault();
      pop();
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (inSubmenu) pop();
      else onOpenChange(false);
    }
  }

  return (
    <Menu.Root open={open} onOpenChange={onOpenChange}>
      <Menu.Trigger
        className={cn(
          "flex items-center gap-1.5 rounded px-1.5 py-0.5 [-webkit-app-region:no-drag]",
          open
            ? "bg-item-selected text-foreground"
            : "text-foreground-subtle hover:bg-item-hover",
        )}
      >
        Actions
        <span className="text-foreground-subtle">
          {formatShortcut("CommandOrControl+K")}
        </span>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="top" align="end" sideOffset={8} collisionPadding={12}>
          <Menu.Popup
            finalFocus={finalFocus}
            className={cn(
              "flex w-72 max-h-[min(26rem,var(--available-height))] flex-col overflow-hidden",
              "rounded-md border border-border bg-background text-foreground shadow-lg outline-none",
            )}
          >
            {inSubmenu && (
              <button
                type="button"
                onClick={pop}
                className="flex shrink-0 items-center gap-1.5 border-b border-border px-2 py-2 text-left text-xs font-medium text-foreground-subtle hover:text-foreground"
              >
                <span aria-hidden>‹</span>
                <span className="truncate">{level.label ?? "Back"}</span>
              </button>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto p-1">
              {filtered.length === 0 && (
                <div className="px-2 py-1.5 text-xs text-foreground-subtle">
                  No actions found
                </div>
              )}
              {filtered.map((action, index) => {
                const showHeading =
                  !!action.section && action.section !== filtered[index - 1]?.section;
                return (
                  <Fragment key={action.id}>
                    {showHeading && (
                      <div
                        className={cn(
                          "px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-foreground-subtle",
                          index === 0 ? "pt-1" : "pt-3",
                        )}
                      >
                        {action.section}
                      </div>
                    )}
                    <Menu.Item
                      closeOnClick={false}
                      onClick={() => activate(action)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={cn(
                        "flex w-full cursor-default items-center justify-between gap-3 rounded px-2 py-1.5 text-sm outline-none",
                        index === highlightedIndex
                          ? "bg-item-selected text-foreground"
                          : "text-foreground",
                        action.danger &&
                          (index === highlightedIndex ? "text-red-400" : "text-red-400/90"),
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        {action.icon &&
                          (isImageIcon(action.icon) ? (
                            <img
                              src={action.icon}
                              alt=""
                              className="h-4 w-4 shrink-0 object-contain"
                            />
                          ) : (
                            <span className="w-4 shrink-0 text-center text-[13px]">
                              {action.icon}
                            </span>
                          ))}
                        <span className="truncate">{action.label}</span>
                      </span>
                      {action.submenu ? (
                        <span
                          aria-hidden
                          className="shrink-0 text-xs text-foreground-subtle"
                        >
                          ›
                        </span>
                      ) : (
                        action.shortcut && (
                          <kbd className="shrink-0 rounded border border-border px-1.5 py-0.5 font-sans text-[11px] leading-none text-foreground-subtle">
                            {formatShortcut(action.shortcut)}
                          </kbd>
                        )
                      )}
                    </Menu.Item>
                  </Fragment>
                );
              })}
            </div>

            <div className="shrink-0 border-t border-border p-1">
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder="Search for actions..."
                className="w-full bg-transparent px-1.5 py-1.5 text-sm outline-none placeholder:text-foreground-subtle"
              />
            </div>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

export default ActionsMenu;
