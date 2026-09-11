import {
  cloneElement,
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { Autocomplete } from "@base-ui/react/autocomplete";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "cnfast";
import { formatShortcut } from "@renderer/lib/shortcut";
import { useRouteStack } from "@renderer/screens/launcher/router/context";
import { Footer, type FooterMenuItem } from "./Footer";

/**
 * A full-screen, launcher-style list: a frameless search header, a scrolling
 * body of rows, and a footer with an optional ⌘K / right-click actions menu.
 *
 * Unlike the old purely-visual `List.*` parts, `ListScreen` owns the behaviour
 * every list screen used to re-wire by hand — the Base UI `Autocomplete`
 * incantation, the query state, highlight tracking, the render-prop bridge, the
 * Escape ladder, and the `Footer.Menu` plumbing. A screen only says what its
 * data is and how to draw a row:
 *
 *   <ListScreen
 *     data={items}
 *     getId={(x) => x.id}
 *     renderItem={(x, { highlighted }) => (
 *       <ListScreen.Item highlighted={highlighted} title={x.name} />
 *     )}
 *     menu={(x) => [{ label: "Edit", onSelect: () => edit(x!.id) }]}
 *   />
 *
 * `highlighted` is the keyboard cursor only — the row Enter, the ⌘K menu and
 * `onInputKeyDown` act on. The mouse never moves it; a hovered row gets a
 * plain CSS `:hover` background instead (give `ListScreen.Item` one — it
 * already has `hover:bg-item-hover`).
 *
 * Unvirtualized by default — fine for bounded lists (the Widget manager).
 * Pass `virtualized` + `itemHeight` to switch to `@tanstack/react-virtual`
 * for long/unbounded lists (see `measureItem` for rows that can grow past
 * their estimate). Pass `serverFiltered` when `data` is already filtered and
 * ranked upstream (e.g. a main-process query), so `ListScreen` renders it
 * as-is instead of re-filtering it against the query text.
 */

/* --------------------------------- item -------------------------------- */

/** Fixed row height, in px. */
export const LIST_SCREEN_ITEM_HEIGHT = 40;

function isImageIcon(icon: string): boolean {
  return /^(https?:|data:|file:)/.test(icon);
}

/** Back-navigation chevron for the header's back button. */
function BackIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M9.5 3.5L4.5 8l5 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ItemIcon({ icon }: { icon?: ReactNode }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-lg">
      {typeof icon === "string" && isImageIcon(icon) ? (
        <img
          src={icon}
          alt=""
          loading="lazy"
          className="h-5 w-5 object-contain"
        />
      ) : (
        (icon ?? <span className="text-foreground-subtle">?</span>)
      )}
    </span>
  );
}

interface ItemProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Electron accelerator shown as a kbd pill while the row is highlighted. */
  shortcut?: string;
  /** Trailing tag — a type label, an "Exposed" marker, etc. */
  badge?: ReactNode;
  highlighted?: boolean;
}

/**
 * One row: icon, title, subtitle, an optional trailing badge. Fixed height
 * (`LIST_SCREEN_ITEM_HEIGHT`). `ListScreen` clones the base-ui `Autocomplete.Item`
 * props onto this element, so a screen never spreads them itself.
 */
const Item = forwardRef<HTMLDivElement, ItemProps>(function Item(
  { icon, title, subtitle, shortcut, badge, highlighted, className, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      {...rest}
      className={cn(
        "flex h-10 cursor-default items-center gap-2 rounded px-1 py-1",
        highlighted
          ? "bg-item-selected text-foreground"
          : "hover:bg-item-hover",
        className,
      )}
    >
      <ItemIcon icon={icon} />
      <div className="flex min-w-0 flex-1 items-baseline gap-2">
        <span className="shrink-0 truncate">{title}</span>
        {shortcut && highlighted ? (
          <kbd className="shrink-0 rounded border border-border px-1.5 py-0.5 font-sans text-xs text-foreground-subtle">
            {formatShortcut(shortcut)}
          </kbd>
        ) : subtitle ? (
          <span className="min-w-0 truncate font-medium text-foreground-subtle">
            {subtitle}
          </span>
        ) : null}
      </div>
      {badge != null && (
        <span className="shrink-0 rounded px-1.5 py-0.5 text-foreground-subtle">
          {badge}
        </span>
      )}
    </div>
  );
});

/* --------------------------------- root -------------------------------- */

const INPUT_CLASS =
  "w-full bg-transparent px-2 py-2 text-lg outline-none " +
  "placeholder:text-foreground-subtle [-webkit-app-region:no-drag]";

interface ListScreenBaseProps<T> {
  /** Full row data, in display order. `null` / `undefined` = loading. */
  data: T[] | null | undefined;
  /** Stable key per row. */
  getId: (item: T) => string;
  /** Draw one row — return a single element, normally `<ListScreen.Item>`. */
  renderItem: (item: T, state: { highlighted: boolean }) => ReactElement;

  /** ⌘K + right-click menu, rebuilt from the current highlighted row.
   *  Renders via the built-in `Footer.Menu` (a flat, searchable list —
   *  sections, icons, danger + confirm rows, but no nesting) in
   *  `Footer.Right`. */
  menu?: (highlighted: T | null) => FooterMenuItem[];
  /** Click / Enter on a row. */
  onActivate?: (item: T) => void;
  /** Escape with an empty query (a non-empty query is cleared first).
   *  Defaults to popping this screen off the launcher's route stack — every
   *  `ListScreen` is pushed there, so a caller only needs this to override
   *  the default (e.g. to do something else before leaving). */
  onExit?: () => void;

  /** Opt-in controlled query. Omit to let `ListScreen` hold it internally. */
  inputValue?: string;
  onInputChange?: (value: string) => void;
  placeholder?: string;
  /** Refocus + select-all in the search input whenever the window regains
   *  focus (e.g. the launcher reappearing with its last query still in the
   *  box). Default false — the input is still focused once, on mount. */
  autoRefocus?: boolean;
  /** Text automatic filtering matches against. Default: `getId(item)`. */
  getSearchText?: (item: T) => string;
  /** Full opt-in override of the built-in substring filter. Ignored when
   *  `serverFiltered` is set. */
  filter?: (item: T, query: string) => boolean;
  /** `data` is already filtered/ranked upstream (e.g. a main-process query)
   *  — skip the built-in substring filter and render `data` as-is. */
  serverFiltered?: boolean;
  /** Extra key handling on the search input, run before the built-in
   *  Escape ladder (clear query, else `onExit`). The second arg is the
   *  currently highlighted row (falling back to the first, like `menu`'s) —
   *  so a screen needing it for a shortcut doesn't have to mirror the
   *  highlight in its own state. Call `preventDefault` to suppress the
   *  built-in handling for a key you own instead. */
  onInputKeyDown?: (
    e: KeyboardEvent<HTMLInputElement>,
    highlighted: T | null,
  ) => void;

  footerLabel?: ReactNode | ((visibleCount: number) => ReactNode);
  /** Escape hatch replacing `Footer.Left` entirely (a count label plus a
   *  Pin toggle, say) — takes over from `footerLabel` when set. */
  customFooter?: ReactNode;
  loadingLabel?: ReactNode;
  emptyLabel?: ReactNode;
  noMatchLabel?: ReactNode;
}

type ListScreenVirtualProps<T> =
  | { virtualized?: false; itemHeight?: never; measureItem?: never }
  | {
      /** Switch row rendering to `@tanstack/react-virtual`, for long or
       *  unbounded lists. */
      virtualized: true;
      /** Row height in px, per item — the virtualizer's fixed/estimated
       *  size. Required: a mismatched real height silently produces
       *  overlapping/gapped rows rather than an error. */
      itemHeight: (item: T) => number;
      /** Rows that can grow past `itemHeight`'s estimate (e.g. wrap onto
       *  more than one line) opt into measurement via a ResizeObserver.
       *  Omit if every row is truly fixed-height — cheaper. */
      measureItem?: (item: T) => boolean;
    };

type ListScreenProps<T> = ListScreenBaseProps<T> & ListScreenVirtualProps<T>;

function ListScreenRoot<T>({
  data,
  getId,
  renderItem,
  menu,
  onActivate,
  onExit,
  inputValue,
  onInputChange,
  placeholder = "Search…",
  getSearchText,
  filter,
  serverFiltered = false,
  onInputKeyDown: onExtraInputKeyDown,
  footerLabel,
  customFooter,
  loadingLabel = "Loading…",
  emptyLabel,
  noMatchLabel = "No matches.",
  autoRefocus = false,
  virtualized = false,
  itemHeight,
  measureItem,
}: ListScreenProps<T>) {
  const { stack, pop } = useRouteStack();
  const controlled = inputValue !== undefined;
  const [innerQuery, setInnerQuery] = useState("");
  const query = controlled ? inputValue : innerQuery;
  const setQuery = (value: string) => {
    if (!controlled) setInnerQuery(value);
    onInputChange?.(value);
  };

  const [highlighted, setHighlighted] = useState<T | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastHighlightedIndex = useRef<number | null>(null);

  useEffect(() => {
    function focusAndSelect(): void {
      inputRef.current?.focus();
      if (autoRefocus) inputRef.current?.select();
    }
    focusAndSelect();
    if (!autoRefocus) return;
    window.addEventListener("focus", focusAndSelect);
    return () => window.removeEventListener("focus", focusAndSelect);
  }, [autoRefocus]);

  const loading = data == null;

  const visible = useMemo(() => {
    const list = data ?? [];
    if (serverFiltered) return list;
    const q = query.trim().toLowerCase();
    if (!q) return list;
    if (filter) return list.filter((item) => filter(item, query));
    return list.filter((item) =>
      (getSearchText ? getSearchText(item) : getId(item))
        .toLowerCase()
        .includes(q),
    );
  }, [data, query, filter, getSearchText, getId, serverFiltered]);

  // `itemHeight` is only absent when `virtualized` is false, in which case
  // the virtualizer below is created but never rendered from — the type
  // union (see `ListScreenVirtualProps`) guarantees callers that opt into
  // `virtualized` supply it.
  const virtualizer = useVirtualizer({
    count: visible.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: (index) =>
      virtualized ? itemHeight!(visible[index]) : LIST_SCREEN_ITEM_HEIGHT,
    overscan: 8,
    gap: 1,
  });

  // The highlighted row, falling back to the first — the target both the
  // `menu` builder and `onInputKeyDown`'s second arg receive.
  const menuTarget = highlighted ?? visible[0] ?? null;

  // Whether this screen is pushed on top of something — i.e. whether "back"
  // is a real place to go, as opposed to the launcher root's `onExit`, which
  // hides the window rather than navigating anywhere. Drives the header's
  // back button; `onExit` (root's custom hide, or a pushed screen's override
  // of the default pop) is still whatever Escape runs either way.
  const canGoBack = stack.length > 1;
  function exit(): void {
    if (onExit) onExit();
    else if (stack.length > 1) pop();
  }

  function onInputKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    onExtraInputKeyDown?.(e, menuTarget);
    if (e.defaultPrevented) return;
    if (e.key === "Escape") {
      e.preventDefault();
      if (query) setQuery("");
      else exit();
    }
  }

  const emptyMessage = loading
    ? loadingLabel
    : (data ?? []).length === 0
      ? (emptyLabel ?? noMatchLabel)
      : noMatchLabel;

  const label =
    typeof footerLabel === "function"
      ? footerLabel(visible.length)
      : footerLabel;

  return (
    <Autocomplete.Root
      items={visible}
      value={query}
      onValueChange={setQuery}
      mode="none"
      inline
      open
      loopFocus={false}
      autoHighlight="always"
      // The highlighted row is the keyboard cursor only — Enter, ⌘K's menu
      // target and `onInputKeyDown`'s second arg all key off it, so hovering
      // the mouse must not move it. A hovered row instead gets its own plain
      // CSS `:hover` background (`hover:bg-item-hover` on the row), distinct
      // from the cursor's `bg-item-selected`.
      highlightItemOnHover={false}
      onItemHighlighted={(item, { index }) => {
        const value = (item as T | undefined) ?? null;
        setHighlighted(value);
        // Rows are rebuilt (new object identities) whenever `data` changes,
        // which re-fires this even though the highlighted *index* hasn't
        // moved — only scroll on an actual index change, so a data refresh
        // doesn't yank a virtualized list back to the highlighted row while
        // the user has scrolled elsewhere.
        if (virtualized && value && index !== lastHighlightedIndex.current) {
          lastHighlightedIndex.current = index;
          queueMicrotask(() =>
            virtualizer.scrollToIndex(index, { align: "auto" }),
          );
        }
      }}
    >
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
        <div className="flex items-center gap-1 border-b border-border px-2 p-1 [-webkit-app-region:drag]">
          {canGoBack && (
            <button
              type="button"
              aria-label="Back"
              onClick={exit}
              className="grid h-7 w-7 shrink-0 place-items-center rounded text-foreground-subtle transition-colors hover:bg-item-hover hover:text-foreground [-webkit-app-region:no-drag]"
            >
              <BackIcon />
            </button>
          )}
          <Autocomplete.Input
            ref={inputRef}
            onKeyDown={onInputKeyDown}
            placeholder={placeholder}
            autoFocus
            className={INPUT_CLASS}
          />
        </div>

        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-2">
          {virtualized ? (
            <Autocomplete.List
              className="relative w-full"
              style={{ height: virtualizer.getTotalSize() }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const item = visible[virtualRow.index];
                if (!item) return null;
                const measure = measureItem?.(item) ?? false;
                return (
                  <Autocomplete.Item
                    key={getId(item)}
                    value={item}
                    index={virtualRow.index}
                    onClick={() => onActivate?.(item)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setHighlighted(item);
                      setMenuOpen(true);
                    }}
                    {...(measure
                      ? {
                          ref: virtualizer.measureElement,
                          "data-index": virtualRow.index,
                        }
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
                      cloneElement(
                        renderItem(item, { highlighted: state.highlighted }),
                        props,
                      )
                    }
                  />
                );
              })}
            </Autocomplete.List>
          ) : (
            <Autocomplete.List className="relative w-full">
              {(item: T) => (
                <Autocomplete.Item
                  key={getId(item)}
                  value={item}
                  onClick={() => onActivate?.(item)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setHighlighted(item);
                    setMenuOpen(true);
                  }}
                  render={(props, state) =>
                    cloneElement(
                      renderItem(item, { highlighted: state.highlighted }),
                      props,
                    )
                  }
                />
              )}
            </Autocomplete.List>
          )}

          {visible.length === 0 && (
            <div className="px-3 py-2 text-sm text-foreground-subtle">
              {emptyMessage}
            </div>
          )}
        </div>

        <Footer>
          {(customFooter != null || label != null) && (
            <Footer.Left>
              {customFooter ?? <Footer.Label>{label}</Footer.Label>}
            </Footer.Left>
          )}
          {menu && (
            <Footer.Right>
              <Footer.Menu
                open={menuOpen}
                onOpenChange={setMenuOpen}
                items={menu(menuTarget)}
                finalFocus={inputRef}
              />
            </Footer.Right>
          )}
        </Footer>
      </div>
    </Autocomplete.Root>
  );
}

export const ListScreen = Object.assign(ListScreenRoot, { Item });
