import { cn } from "cnfast";
import type { LauncherAction } from "../../../shared/types";
import { formatShortcut } from "../lib/shortcut";

const TYPE_LABEL: Record<LauncherAction["type"], string> = {
  application: "Application",
  command: "Command",
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

interface SearchItemProps {
  action: LauncherAction;
  selected: boolean;
  onClick: () => void;
}

function SearchItem({ action, selected, onClick }: SearchItemProps) {
  const { icon, title, subtitle, type, shortcut } = action;

  return (
    <li
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded px-1 py-1",
        selected ? "bg-item-selected text-foreground" : "hover:bg-item-hover",
      )}
    >
      <ItemIcon icon={icon} />
      {
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className="shrink-0 truncate">{title}</span>
          {shortcut && selected ? (
            <kbd className="shrink-0 rounded border border-border px-1.5 py-0.5 font-sans text-xs text-foreground-subtle">
              {formatShortcut(shortcut)}
            </kbd>
          ) : (
            <span className="min-w-0 truncate text-foreground-subtle">
              {subtitle}
            </span>
          )}
        </div>
      }

      <span className="shrink-0 rounded px-1.5 py-0.5 text-foreground-subtle">
        {TYPE_LABEL[type]}
      </span>
    </li>
  );
}

export default SearchItem;
