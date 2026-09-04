import { cn } from "cnfast";
import { useEffect, useState, type ComponentPropsWithRef } from "react";
import type { LauncherAction } from "../../../../../shared/types";
import { formatShortcut } from "../../../lib/shortcut";

const TYPE_LABEL: Record<LauncherAction["type"], string> = {
  application: "Application",
  command: "Command",
  quickvalue: "QuickValue",
};

function isImageIcon(icon: string): boolean {
  return /^(https?:|data:|file:)/.test(icon);
}

function ItemIcon({ icon }: { icon?: string }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-lg">
      {icon ? (
        isImageIcon(icon) ? (
          <img src={icon} alt="" className="h-5 w-5 object-contain" />
        ) : (
          <span>{icon}</span>
        )
      ) : (
        <span className="text-foreground-subtle">?</span>
      )}
    </span>
  );
}

interface SearchItemProps extends ComponentPropsWithRef<"div"> {
  action: LauncherAction;
  highlighted: boolean;
}

/** Locked to the virtualized list's row height for this item (see App.tsx). */
export const SEARCH_ITEM_HEIGHT = 40;

function Spinner() {
  return (
    <span
      className="inline-block h-3 w-3 shrink-0 animate-spin rounded-full border border-foreground-subtle border-t-transparent"
      aria-label="Loading"
    />
  );
}

function SearchItem({ action, highlighted, className, ...rest }: SearchItemProps) {
  const { id, icon, title, subtitle, type, shortcut, isLoading, isDeferredSubtitle } = action;

  // Own loading state for the in-flight request itself, on top of whatever
  // `isLoading` the action source reports (e.g. QuickValue also pushes updates
  // out-of-band, for its own row + row menu "Refresh"). `requestSubtitle`
  // resolving is the only signal a source is guaranteed to give back, so this
  // is what guarantees a spinner for *any* deferred-subtitle row, not just ones
  // with a push channel of their own.
  const [pending, setPending] = useState(false);

  // Virtualization mounts this component only for rows currently on screen (plus
  // overscan), so this naturally fires just for rows the user can actually see —
  // never for the rest of an exposed-QuickValue list scrolled out of view. The
  // main process caches/dedupes (TTL + single-flight), so re-requesting on every
  // mount is cheap.
  useEffect(() => {
    if (!isDeferredSubtitle) return;
    let cancelled = false;
    setPending(true);
    window.api.requestSubtitle(id).finally(() => {
      if (!cancelled) setPending(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id, isDeferredSubtitle]);

  const loading = isLoading || pending;

  return (
    <div
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
        ) : loading ? (
          <Spinner />
        ) : (
          <span className="min-w-0 truncate text-foreground-subtle font-medium">
            {subtitle}
          </span>
        )}
      </div>

      <span className="shrink-0 rounded px-1.5 py-0.5 text-foreground-subtle">
        {TYPE_LABEL[type]}
      </span>
    </div>
  );
}

export default SearchItem;
