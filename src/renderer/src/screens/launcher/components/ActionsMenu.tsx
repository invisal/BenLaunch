import { Autocomplete } from "@base-ui/react/autocomplete";
import { cn } from "cnfast";
import { useEffect, useState, type RefObject } from "react";
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

function ActionsMenu({
  open,
  onOpenChange,
  actions,
  finalFocus,
}: ActionsMenuProps) {
  const [search, setSearch] = useState("");

  // Reset the search whenever the popup is closed, regardless of the close path
  // (selection, Escape, outside click, or the parent's Ctrl+K toggle).
  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  return (
    <Autocomplete.Root
      items={actions}
      open={open}
      onOpenChange={(next) => onOpenChange(next)}
      value={search}
      onValueChange={setSearch}
      itemToStringValue={(action) => action.label}
      autoHighlight="always"
    >
      <Autocomplete.Trigger
        className={cn(
          "rounded px-1.5 py-0.5 [-webkit-app-region:no-drag]",
          open
            ? "bg-item-selected text-foreground"
            : "text-foreground-subtle hover:bg-item-hover",
        )}
      >
        Actions {formatShortcut("CommandOrControl+K")}
      </Autocomplete.Trigger>
      <Autocomplete.Portal>
        <Autocomplete.Positioner side="top" align="end" sideOffset={8}>
          <Autocomplete.Popup
            finalFocus={finalFocus}
            className="w-64 rounded-md border border-border bg-background text-foreground shadow-lg outline-none"
          >
            <div className="border-b border-border p-1">
              <Autocomplete.Input
                placeholder="Search actions..."
                className="w-full bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-foreground-subtle"
              />
            </div>
            <Autocomplete.List className="p-1">
              {(action: MenuActionItem) => (
                <Autocomplete.Item
                  key={action.id}
                  value={action}
                  onClick={() => {
                    action.onSelect();
                    onOpenChange(false);
                  }}
                  className={cn(
                    "flex w-full cursor-default items-center justify-between gap-2 rounded px-2 py-1.5 text-sm outline-none",
                    "data-[highlighted]:bg-item-selected data-[highlighted]:text-foreground",
                  )}
                >
                  <span className="truncate">{action.label}</span>
                  {action.shortcut && (
                    <kbd className="shrink-0 rounded border border-border px-1.5 py-0.5 font-sans text-xs text-foreground-subtle">
                      {formatShortcut(action.shortcut)}
                    </kbd>
                  )}
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

export default ActionsMenu;
