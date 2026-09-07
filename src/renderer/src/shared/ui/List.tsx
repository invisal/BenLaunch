import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { cn } from "cnfast";
import { formatShortcut } from "@renderer/lib/shortcut";

/**
 * Purely visual building blocks for a launcher-style list screen: the frameless
 * search header, the scrolling list body, and the individual rows. No state, no
 * IPC, no keyboard / filtering logic — each screen wires its own `Autocomplete`
 * (or manual key handling) around these.
 *
 * The launcher's own `LauncherScreen` / `SearchItem` predate this and still
 * carry their own copies of this markup; newer screens (the QuickValue manager)
 * build on `List` instead. Migrating the launcher onto it is a later cleanup.
 */

/** Fixed row height — a screen can hand this straight to a virtualizer. */
export const LIST_ITEM_HEIGHT = 40;

const INPUT_CLASS =
  "w-full bg-transparent px-2 py-2 text-lg outline-none " +
  "placeholder:text-foreground-subtle [-webkit-app-region:no-drag]";

/** The frameless drag-region bar that holds the search input. */
function Header({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center border-b border-border px-2 p-1 [-webkit-app-region:drag]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * The search `<input>`, styled like the launcher's. Use it standalone, or as a
 * Base UI render target: `<Autocomplete.Input render={<List.Input />} />`.
 */
const Input = forwardRef<HTMLInputElement, ComponentPropsWithoutRef<"input">>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} {...rest} className={cn(INPUT_CLASS, className)} />;
  },
);

/** The scrolling list body. */
function Root({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex-1 overflow-y-auto p-2", className)}>{children}</div>
  );
}

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
 * (`LIST_ITEM_HEIGHT`). `...rest` is spread onto the root so a wrapping
 * `Autocomplete.Item`'s render-prop props / handlers flow through.
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
        highlighted ? "bg-item-selected text-foreground" : "hover:bg-item-hover",
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

/** The muted "nothing here" line. */
function Empty({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("px-3 py-2 text-sm text-foreground-subtle", className)}>
      {children}
    </div>
  );
}

export const List = Object.assign(Root, { Header, Input, Item, Empty });
