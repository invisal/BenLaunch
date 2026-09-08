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
import { cn } from "cnfast";
import { formatShortcut } from "@renderer/lib/shortcut";
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
 * Not virtualized — meant for bounded lists (the QuickValue manager). The
 * launcher keeps its own virtualized copy in `SearchItem` / `LauncherScreen`.
 */

/* --------------------------------- item -------------------------------- */

/** Fixed row height, in px. */
export const LIST_SCREEN_ITEM_HEIGHT = 40;

function isImageIcon(icon: string): boolean {
  return /^(https?:|data:|file:)/.test(icon);
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

interface ListScreenProps<T> {
  /** Full row data, in display order. `null` / `undefined` = loading. */
  data: T[] | null | undefined;
  /** Stable key per row. */
  getId: (item: T) => string;
  /** Draw one row — return a single element, normally `<ListScreen.Item>`. */
  renderItem: (item: T, state: { highlighted: boolean }) => ReactElement;

  /** ⌘K + right-click menu, rebuilt from the current highlighted row. */
  menu?: (highlighted: T | null) => FooterMenuItem[];
  /** Click / Enter on a row. */
  onActivate?: (item: T) => void;
  /** Escape with an empty query (a non-empty query is cleared first). */
  onExit?: () => void;
  /** Mirror of the highlighted row, for use outside `menu`. */
  onHighlightChange?: (item: T | null) => void;

  /** Opt-in controlled query. Omit to let `ListScreen` hold it internally. */
  inputValue?: string;
  onInputChange?: (value: string) => void;
  placeholder?: string;
  /** Text automatic filtering matches against. Default: `getId(item)`. */
  getSearchText?: (item: T) => string;
  /** Full opt-in override of the built-in substring filter. */
  filter?: (item: T, query: string) => boolean;

  footerLabel?: ReactNode | ((visibleCount: number) => ReactNode);
  loadingLabel?: ReactNode;
  emptyLabel?: ReactNode;
  noMatchLabel?: ReactNode;
}

function ListScreenRoot<T>({
  data,
  getId,
  renderItem,
  menu,
  onActivate,
  onExit,
  onHighlightChange,
  inputValue,
  onInputChange,
  placeholder = "Search…",
  getSearchText,
  filter,
  footerLabel,
  loadingLabel = "Loading…",
  emptyLabel,
  noMatchLabel = "No matches.",
}: ListScreenProps<T>) {
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

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const loading = data == null;

  const visible = useMemo(() => {
    const list = data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    if (filter) return list.filter((item) => filter(item, query));
    return list.filter((item) =>
      (getSearchText ? getSearchText(item) : getId(item))
        .toLowerCase()
        .includes(q),
    );
  }, [data, query, filter, getSearchText, getId]);

  const changeHighlight = (item: T | null) => {
    setHighlighted(item);
    onHighlightChange?.(item);
  };

  function onInputKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "Escape") {
      e.preventDefault();
      if (query) setQuery("");
      else onExit?.();
    }
  }

  const menuTarget = highlighted ?? visible[0] ?? null;

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
      onItemHighlighted={(item) =>
        changeHighlight((item as T | undefined) ?? null)
      }
    >
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
        <div className="flex items-center border-b border-border px-2 p-1 [-webkit-app-region:drag]">
          <Autocomplete.Input
            ref={inputRef}
            onKeyDown={onInputKeyDown}
            placeholder={placeholder}
            autoFocus
            className={INPUT_CLASS}
          />
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <Autocomplete.List className="relative w-full">
            {(item: T) => (
              <Autocomplete.Item
                key={getId(item)}
                value={item}
                onClick={() => onActivate?.(item)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  changeHighlight(item);
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

          {visible.length === 0 && (
            <div className="px-3 py-2 text-sm text-foreground-subtle">
              {emptyMessage}
            </div>
          )}
        </div>

        <Footer>
          {label != null && (
            <Footer.Left>
              <Footer.Label>{label}</Footer.Label>
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
