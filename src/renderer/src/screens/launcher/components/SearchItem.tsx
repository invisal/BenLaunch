import { cn } from "cnfast";
import type { ComponentPropsWithRef } from "react";
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
  const { icon, title, subtitle, type, shortcut, isLoading } = action;

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
        ) : isLoading ? (
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
