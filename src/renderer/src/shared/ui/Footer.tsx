import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
  type RefObject,
} from "react";
import { Autocomplete } from "@base-ui/react/autocomplete";
import { cn } from "cnfast";
import { formatShortcut } from "@renderer/lib/shortcut";
import { useShortcut } from "@renderer/lib/use-shortcut";

const isImageIcon = (icon: string): boolean =>
  /^(https?:|data:|file:)/.test(icon);

/** A key-combo pill (e.g. ⌘⏎ / Ctrl+Enter). Decorative — hidden from a11y. */
function Kbd({
  accelerator,
  className,
}: {
  accelerator: string;
  className?: string;
}) {
  return (
    <kbd
      aria-hidden
      className={cn(
        "shrink-0 rounded border border-border/60 px-1.5 py-0.5 font-sans text-xs text-foreground-subtle",
        className,
      )}
    >
      {formatShortcut(accelerator)}
    </kbd>
  );
}

/**
 * The bar pinned to the bottom of a window — as `Layout.Footer` below a
 * scrolling `Content`, or on its own as the last flex child (the launcher).
 *
 *   <Layout.Footer>
 *     <Layout.Footer.Left>
 *       <Layout.Footer.Button onClick={cancel}>Cancel</Layout.Footer.Button>
 *     </Layout.Footer.Left>
 *     <Layout.Footer.Right>
 *       <Layout.Footer.Label>Unsaved changes</Layout.Footer.Label>
 *       <Layout.Footer.Button
 *         variant="primary"
 *         shortcut="CommandOrControl+Enter"
 *         onClick={save}
 *       >
 *         Save
 *       </Layout.Footer.Button>
 *     </Layout.Footer.Right>
 *   </Layout.Footer>
 *
 * `Left` / `Right` are optional flex groups that stick to their side (either one
 * works alone). Raw children are still fine — the footer is a plain flex row.
 * `Button` is the slim ghost action; `Label` is passive text (a status readout,
 * hint, or count) sharing the footer's type scale. `Menu` is a searchable
 * actions dropdown; see its own doc below.
 *
 * The bar itself is a window drag region (all our windows are frameless), so the
 * empty space and any `Label` text drag the window. `Button` and the `Menu`
 * trigger opt back out — a raw `<button>` you drop in yourself needs its own
 * `[-webkit-app-region:no-drag]`.
 *
 * `Button`'s `shortcut` is only a visual hint — bind the actual key with
 * `useShortcut` in the screen. `Menu` owns its own open/close (and the ⌘K
 * toggle) unless you pass `open` / `onOpenChange` to drive it.
 */
function FooterRoot({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-2 border-t border-border px-2 py-1 [-webkit-app-region:drag]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Left-aligned group. `mr-auto` pushes anything after it to the right. */
function Left({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("mr-auto flex min-w-0 items-center gap-3", className)}>
      {children}
    </div>
  );
}

/** Right-aligned group. */
function Right({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("ml-auto flex min-w-0 items-center gap-3", className)}>
      {children}
    </div>
  );
}

/* ----------------------------- action button ---------------------------- */

/** Every footer button is the same ghost shape — a slim, borderless target
 *  that grows a faint background on hover. `primary` only differs by carrying
 *  full-strength text; `default` sits back in the subtle colour. */
type Variant = "primary" | "default";

const VARIANT: Record<Variant, string> = {
  primary: "text-foreground",
  default: "text-foreground-subtle",
};

const ACTION_BASE =
  "flex items-center gap-2 rounded px-2 py-1 text-xs font-medium transition-colors " +
  "[-webkit-app-region:no-drag] " +
  "hover:bg-item-hover hover:text-foreground " +
  "disabled:opacity-40 disabled:hover:bg-transparent";

export interface ButtonProps extends Omit<
  ComponentPropsWithoutRef<"button">,
  "children"
> {
  children: ReactNode;
  /** `primary` for the confirming action (full-strength text), `default` for
   *  the rest (subtle text). Both are the same slim ghost shape. */
  variant?: Variant;
  /** Electron accelerator (e.g. "CommandOrControl+Enter") shown as a trailing
   *  kbd hint. This is display only — bind the key with `useShortcut`. */
  shortcut?: string;
  /** Disables the button and swaps in `loadingLabel`. */
  loading?: boolean;
  loadingLabel?: ReactNode;
  /** Renders a persistent "on" state (filled background) for a toggle, e.g. a
   *  pin. Also reflected as `aria-pressed`. */
  active?: boolean;
}

/** A slim ghost button with a hover background, a built-in loading state, an
 *  optional (display-only) shortcut hint, and an optional `active` toggle
 *  state. */
function Button({
  children,
  variant = "default",
  shortcut,
  loading = false,
  loadingLabel,
  active = false,
  disabled,
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={Boolean(disabled) || loading}
      aria-keyshortcuts={shortcut}
      aria-pressed={active || undefined}
      className={cn(
        ACTION_BASE,
        VARIANT[variant],
        active && "bg-item-selected text-foreground hover:bg-item-selected",
        className,
      )}
      {...rest}
    >
      <span className="min-w-0 truncate">
        {loading && loadingLabel ? loadingLabel : children}
      </span>
      {shortcut ? <Kbd accelerator={shortcut} /> : null}
    </button>
  );
}

/* -------------------------------- label -------------------------------- */

/** Passive footer text — a status readout, hint, or count sitting next to the
 *  buttons. Shares the footer's type scale (slim, subtle) and truncates rather
 *  than pushing the row wide; pass `className` to recolour (e.g. a warning). */
function Label({
  className,
  children,
  ...rest
}: ComponentPropsWithoutRef<"span">) {
  return (
    <span
      className={cn(
        "min-w-0 truncate text-xs font-medium text-foreground-subtle",
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}

/* -------------------------------- menu --------------------------------- */

interface FooterMenuItemBase {
  /** Stable key for the row; falls back to `label`. Also the submenu path
   *  segment for a row that carries `items`, so give those an explicit `id`. */
  id?: string;
  label: string;
  /** Display hint shown on the row. Bind the key itself with `useShortcut`. */
  shortcut?: string;
  disabled?: boolean;
  /** Emoji or image URL shown before the label. */
  icon?: string;
  /** Render the row in a warning colour (a Delete action). */
  danger?: boolean;
  /**
   * Group heading. Drawn once above the first item of each contiguous run of
   * items sharing a `section`; items with no `section` get no heading. Keep
   * items of one section next to each other in the array.
   */
  section?: string;
}

/** A row that runs something when picked. */
interface FooterMenuLeaf extends FooterMenuItemBase {
  /**
   * Guards a destructive action with a second activation: the first select
   * swaps the label to this text and arms the row (auto-disarms after a few
   * seconds, or when the query changes); a second select runs `onSelect`.
   */
  confirmLabel?: string;
  onSelect: () => void;
  items?: never;
}

/**
 * A row that opens a list of its own instead of running: picking it replaces
 * the menu's contents with `items` (and its search box filters those), and
 * Escape — or the back button in the popup's header — returns to the list it
 * came from. For a long, self-contained group like quicklinks' "Open With",
 * which contributes a row per installed app and would otherwise bury the rest
 * of the menu under it.
 */
interface FooterMenuSubmenu extends FooterMenuItemBase {
  items: FooterMenuItem[];
  confirmLabel?: never;
  onSelect?: never;
}

export type FooterMenuItem = FooterMenuLeaf | FooterMenuSubmenu;

export interface FooterMenuProps {
  /** Trigger label. Default "Actions". */
  label?: ReactNode;
  /** Toggles the menu, and the hint shown on the trigger. Default
   *  "CommandOrControl+K". */
  shortcut?: string;
  /** Search-box placeholder. Default "Search actions…". */
  placeholder?: string;
  items: FooterMenuItem[];
  /** Controlled open state. Omit both to let the menu own its visibility; pass
   *  them when the screen needs to coordinate it (e.g. the launcher rebuilds
   *  `items` from the highlighted row and shares the ⌘K toggle). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Where focus lands when the popup closes. Defaults to the trigger. */
  finalFocus?: RefObject<HTMLElement | null>;
}

/**
 * A searchable actions menu for the footer, opened by its trigger or the ⌘K
 * shortcut. Uncontrolled by default (owns its open/close and binds ⌘K); pass
 * `open` / `onOpenChange` to drive it. An item's `shortcut` is a display hint
 * on the row; bind the key itself with `useShortcut` in the screen. Items can
 * carry an `icon`, a `section` heading, `danger` styling, and a `confirmLabel`
 * (arm-then-confirm) — see `FooterMenuItem`.
 *
 * Mostly one flat list: related rows are a `section`, not a submenu. The one
 * exception is a row carrying `items` (a `FooterMenuSubmenu`), which opens
 * that list in place of the current one — for a group too long to sit inline,
 * like quicklinks' "Open With" and its row per installed app. Escape (or the
 * popup's back button) returns to the list it came from, and only closes the
 * menu from the top level.
 *
 *   const format = () => editor.current?.format();
 *   useShortcut({ "CommandOrControl+S": format });
 *
 *   <Layout.Footer.Menu
 *     items={[
 *       { label: "Run Test", onSelect: runTest },
 *       { label: "Format", shortcut: "CommandOrControl+S", onSelect: format },
 *     ]}
 *   />
 */
function Menu({
  label = "Actions",
  shortcut = "CommandOrControl+K",
  placeholder = "Search actions…",
  items,
  open: openProp,
  onOpenChange,
  finalFocus,
}: FooterMenuProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = openProp ?? uncontrolledOpen;
  const [search, setSearch] = useState("");
  // Key of the `confirmLabel` item awaiting its second activation, if any.
  const [armedId, setArmedId] = useState<string | null>(null);
  // Path into the open submenu, as row keys (`id ?? label`) rather than the
  // item objects themselves: a screen rebuilds `items` on every render (the
  // launcher rebuilds it from the highlighted row), so holding onto an item
  // would pin the submenu — and the closures in its `onSelect`s — to whatever
  // the menu looked like when it was opened.
  const [trail, setTrail] = useState<string[]>([]);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // The popup is portalled into this element rather than `document.body`, so it
  // stays inside the owning screen's subtree. When an `onSelect` navigates and
  // React parks that screen in a hidden `<Activity>`, the `display:none` covers
  // the popup too — otherwise Base UI defers its unmount to a closing
  // transition that never fires offscreen, and it lingers over the new screen.
  const portalRef = useRef<HTMLDivElement>(null);

  const setOpen = (next: boolean) => {
    if (openProp === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  // Clear the query and disarm any pending confirm on every close path
  // (select / Escape / outside click / ⌘K).
  useEffect(() => {
    if (!open) {
      setSearch("");
      setArmedId(null);
      setTrail([]);
    }
  }, [open]);

  // A pending confirm disarms when the user filters away from it, and a few
  // seconds after arming if it's never confirmed.
  useEffect(() => {
    setArmedId(null);
  }, [search]);
  useEffect(() => {
    if (!armedId) return;
    const timer = setTimeout(() => setArmedId(null), 4000);
    return () => clearTimeout(timer);
  }, [armedId]);

  // Walk `trail` down the *current* `items` to the list being shown, and the
  // row it hangs off (the popup's header). A segment that no longer resolves —
  // the highlighted row changed under an open submenu — stops the walk there,
  // so the menu falls back to the deepest list that still exists.
  const { activeItems, parent } = useMemo(() => {
    let list = items;
    let openedBy: FooterMenuItem | null = null;
    for (const key of trail) {
      const next = list.find((item) => (item.id ?? item.label) === key);
      if (!next?.items) break;
      list = next.items;
      openedBy = next;
    }
    return { activeItems: list, parent: openedBy };
  }, [items, trail]);

  // Heading rows: the key of the first item of each contiguous `section` run.
  const sectionFirstKeys = useMemo(() => {
    const keys = new Set<string>();
    let prev: string | undefined;
    for (const item of activeItems) {
      const key = item.id ?? item.label;
      if (item.section && item.section !== prev) keys.add(key);
      prev = item.section;
    }
    return keys;
  }, [activeItems]);

  /** Leave the open submenu for the list it came from. */
  const goBack = () => {
    setTrail((path) => path.slice(0, -1));
    setSearch("");
    setArmedId(null);
  };

  /** `"armed"` when the hit only armed a `confirmLabel` item, `"opened"` when
   *  it descended into a submenu — neither ran anything. */
  const choose = (
    item: FooterMenuItem,
  ): "armed" | "opened" | "ran" | "ignored" => {
    if (item.disabled) return "ignored";
    const key = item.id ?? item.label;
    // A submenu row swaps the list out and keeps the menu open; the search box
    // starts empty again so it filters the list now on screen.
    if (item.items) {
      setTrail((path) => [...path, key]);
      setSearch("");
      setArmedId(null);
      return "opened";
    }
    // First hit on a guarded item just arms it — keep the menu open so the
    // swapped-in `confirmLabel` is visible for the confirming second hit.
    if (item.confirmLabel && armedId !== key) {
      setArmedId(key);
      return "armed";
    }
    setArmedId(null);
    setOpen(false);
    item.onSelect();
    return "ran";
  };

  // The menu owns the ⌘K toggle whether controlled or not (setOpen routes to
  // the right place). Item shortcuts stay the screen's to bind via useShortcut.
  useShortcut({ [shortcut]: () => setOpen(!open) });

  return (
    <Autocomplete.Root
      items={activeItems}
      open={open}
      onOpenChange={setOpen}
      value={search}
      onValueChange={setSearch}
      itemToStringValue={(item) => item.label}
      autoHighlight="always"
    >
      <Autocomplete.Trigger
        ref={triggerRef}
        className={cn(
          ACTION_BASE,
          open ? "bg-item-hover text-foreground" : "text-foreground-subtle",
        )}
      >
        <span className="min-w-0 truncate">{label}</span>
        <Kbd accelerator={shortcut} />
      </Autocomplete.Trigger>
      {/* Zero-size, out-of-flow host for the portal (see `portalRef`). */}
      <div ref={portalRef} className="fixed" />
      <Autocomplete.Portal container={portalRef}>
        <Autocomplete.Positioner
          side="top"
          align="end"
          sideOffset={8}
          collisionPadding={8}
        >
          {/* The popup is capped at the space the window actually has
              (`--available-height`, from the positioner) and the list scrolls
              inside it. Without the cap a long list — quicklinks' "Open With"
              submenu, a row per installed app — lays itself out at its full
              height, and since the side axis flips rather than shifts, most of
              it ends up off the top of the 640×420 launcher: search box and
              first rows outside the window, unclickable. Same treatment as the
              "Open With" picker in `AppPicker`. */}
          <Autocomplete.Popup
            finalFocus={finalFocus ?? triggerRef}
            // Inside a submenu, Escape steps back out instead of dismissing.
            // Base UI's own Escape handling is a bubble-phase listener on the
            // document, so claiming the key here (capture, before the event
            // reaches the input at all) is what keeps the popup open.
            onKeyDownCapture={(event) => {
              if (event.key !== "Escape" || !parent) return;
              event.preventDefault();
              event.stopPropagation();
              goBack();
            }}
            className="flex max-h-[min(24rem,var(--available-height))] w-60 flex-col overflow-hidden rounded-md border border-border bg-popover text-foreground shadow-lg outline-none [-webkit-app-region:no-drag]"
          >
            {parent && (
              <button
                type="button"
                onClick={goBack}
                className="flex shrink-0 items-center gap-1.5 border-b border-border px-2 py-1.5 text-left text-xs font-medium text-foreground-subtle hover:text-foreground"
              >
                <span aria-hidden className="shrink-0">
                  ‹
                </span>
                <span className="min-w-0 flex-1 truncate">{parent.label}</span>
                <Kbd accelerator="Escape" />
              </button>
            )}
            <div className="shrink-0 border-b border-border p-1">
              <Autocomplete.Input
                placeholder={parent ? `Search ${parent.label}…` : placeholder}
                className="w-full bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-foreground-subtle"
              />
            </div>
            <Autocomplete.List className="min-h-0 overflow-y-auto overscroll-contain scroll-py-1 p-1">
              {(item: FooterMenuItem, index: number) => {
                const key = item.id ?? item.label;
                const armed = armedId === key;
                return (
                  <Fragment key={key}>
                    {sectionFirstKeys.has(key) && (
                      <div
                        aria-hidden
                        className={cn(
                          "px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-foreground-subtle",
                          index === 0 ? "pt-1" : "pt-3",
                        )}
                      >
                        {item.section}
                      </div>
                    )}
                    <Autocomplete.Item
                      value={item}
                      disabled={item.disabled}
                      onClick={(event) => {
                        // Only a hit that actually ran the action may go on to
                        // Base UI's own item press: it selects the item —
                        // closing the popup and writing the label into the
                        // search box — which would disarm a confirm before its
                        // second hit, or close the menu on a disabled row. (↵
                        // on a highlighted row arrives here as a click too.)
                        if (choose(item) !== "ran")
                          event.preventBaseUIHandler();
                      }}
                      className={cn(
                        "flex w-full cursor-default items-center justify-between gap-2 rounded px-2 py-1.5 text-sm outline-none",
                        armed
                          ? "bg-red-500/25 text-red-300 ring-1 ring-inset ring-red-500/40"
                          : item.danger
                            ? "text-red-400/90 data-[highlighted]:bg-red-500/15 data-[highlighted]:text-red-300"
                            : "data-[highlighted]:bg-item-selected data-[highlighted]:text-foreground",
                        item.disabled && "opacity-40",
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        {item.icon &&
                          (isImageIcon(item.icon) ? (
                            <img
                              src={item.icon}
                              alt=""
                              className="h-4 w-4 shrink-0 object-contain"
                            />
                          ) : (
                            <span className="w-4 shrink-0 text-center text-[13px]">
                              {item.icon}
                            </span>
                          ))}
                        <span className="truncate">
                          {armed && item.confirmLabel
                            ? item.confirmLabel
                            : item.label}
                        </span>
                      </span>
                      {item.items ? (
                        // Marks the row as a way in rather than an action.
                        <span
                          aria-hidden
                          className="shrink-0 text-foreground-subtle"
                        >
                          ›
                        </span>
                      ) : item.shortcut ? (
                        <Kbd
                          accelerator={item.shortcut}
                          className="border-border"
                        />
                      ) : null}
                    </Autocomplete.Item>
                  </Fragment>
                );
              }}
            </Autocomplete.List>
            <Autocomplete.Empty className="shrink-0 px-2 py-1.5 text-xs text-foreground-subtle">
              No actions found
            </Autocomplete.Empty>
          </Autocomplete.Popup>
        </Autocomplete.Positioner>
      </Autocomplete.Portal>
    </Autocomplete.Root>
  );
}

export const Footer = Object.assign(FooterRoot, {
  Left,
  Right,
  Button,
  Label,
  Menu,
});
