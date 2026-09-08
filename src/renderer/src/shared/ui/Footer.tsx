import {
  useEffect,
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

export interface FooterMenuItem {
  /** Stable key for the row; falls back to `label`. */
  id?: string;
  label: string;
  /** Display hint shown on the row. Bind the key itself with `useShortcut`. */
  shortcut?: string;
  disabled?: boolean;
  onSelect: () => void;
}

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
 * `open` / `onOpenChange` to drive it. An item's `shortcut` is a display hint on
 * the row; bind the key itself with `useShortcut` in the screen.
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

  // Clear the query on every close path (select / Escape / outside click / ⌘K).
  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const choose = (item: FooterMenuItem) => {
    if (item.disabled) return;
    setOpen(false);
    item.onSelect();
  };

  // The menu owns the ⌘K toggle whether controlled or not (setOpen routes to
  // the right place). Item shortcuts stay the screen's to bind via useShortcut.
  useShortcut({ [shortcut]: () => setOpen(!open) });

  return (
    <Autocomplete.Root
      items={items}
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
        <Autocomplete.Positioner side="top" align="end" sideOffset={8}>
          <Autocomplete.Popup
            finalFocus={finalFocus ?? triggerRef}
            className="w-60 rounded-md border border-border bg-popover text-foreground shadow-lg outline-none"
          >
            <div className="border-b border-border p-1">
              <Autocomplete.Input
                placeholder={placeholder}
                className="w-full bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-foreground-subtle"
              />
            </div>
            <Autocomplete.List className="p-1">
              {(item: FooterMenuItem) => (
                <Autocomplete.Item
                  key={item.id ?? item.label}
                  value={item}
                  onClick={() => choose(item)}
                  className={cn(
                    "flex w-full cursor-default items-center justify-between gap-2 rounded px-2 py-1.5 text-sm outline-none",
                    "data-[highlighted]:bg-item-selected data-[highlighted]:text-foreground",
                    item.disabled && "opacity-40",
                  )}
                >
                  <span className="truncate">{item.label}</span>
                  {item.shortcut ? (
                    <Kbd
                      accelerator={item.shortcut}
                      className="border-border"
                    />
                  ) : null}
                </Autocomplete.Item>
              )}
            </Autocomplete.List>
            <Autocomplete.Empty className="px-2 py-1.5 text-xs text-foreground-subtle">
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
