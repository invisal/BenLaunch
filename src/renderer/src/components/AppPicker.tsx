import { useMemo } from "react";
import { cn } from "cnfast";
import { Combobox } from "@base-ui/react/combobox";
import type { OpenWithApp } from "../../../shared/quicklink";

interface AppOption {
  value: string;
  label: string;
  icon?: string;
}

interface AppPickerProps {
  apps: OpenWithApp[];
  /** Selected executable path; "" means the system default. */
  value: string;
  onChange: (path: string) => void;
  /** Label for the "" option, e.g. "Default browser". */
  defaultLabel: string;
}

const isImageIcon = (icon: string): boolean => /^(https?:|data:|file:)/.test(icon);

function AppIcon({ icon, className }: { icon?: string; className?: string }) {
  const cls = cn("flex shrink-0 items-center justify-center", className);
  if (!icon) return <span className={cn(cls, "text-foreground-subtle")}>🌐</span>;
  return isImageIcon(icon) ? (
    <img src={icon} alt="" className={cn(cls, "object-contain")} />
  ) : (
    <span className={cls}>{icon}</span>
  );
}

/**
 * A searchable, theme-matched replacement for a native `<select>` — the OS
 * renders a native option list in its own (light) theme, unreadable over the
 * launcher's dark UI, and "Open With" can hold ~100 apps. A button shows the
 * current app (with its icon); opening reveals a search field over the filtered
 * list.
 */
function AppPicker({ apps, value, onChange, defaultLabel }: AppPickerProps) {
  const items = useMemo<AppOption[]>(
    () => [
      { value: "", label: defaultLabel },
      ...apps.map((app) => ({ value: app.path, label: app.name, icon: app.icon })),
    ],
    [apps, defaultLabel],
  );

  const selected = items.find((item) => item.value === value) ?? items[0];

  return (
    <Combobox.Root
      items={items}
      value={selected}
      onValueChange={(item: AppOption | null) => onChange(item?.value ?? "")}
    >
      <Combobox.Trigger
        className={cn(
          "flex w-full items-center gap-2 rounded-md border border-border bg-item-hover",
          "px-2.5 py-1.5 text-left text-sm outline-none focus:border-foreground-subtle",
        )}
      >
        <AppIcon icon={selected?.icon} className="h-4 w-4 text-sm" />
        <span className="min-w-0 flex-1 truncate">
          <Combobox.Value>
            {(item: AppOption | null) => item?.label ?? defaultLabel}
          </Combobox.Value>
        </span>
        <span className="shrink-0 text-xs text-foreground-subtle">▾</span>
      </Combobox.Trigger>

      <Combobox.Portal>
        <Combobox.Positioner sideOffset={6} collisionPadding={10} className="z-50">
          <Combobox.Popup
            className={cn(
              "flex max-h-[min(18rem,var(--available-height))] w-[var(--anchor-width)] flex-col overflow-hidden",
              "rounded-md border border-border bg-background text-sm text-foreground shadow-lg outline-none",
            )}
          >
            <div className="border-b border-border p-1">
              <Combobox.Input
                placeholder="Search apps…"
                className="w-full bg-transparent px-1.5 py-1 text-sm outline-none placeholder:text-foreground-subtle"
              />
            </div>
            <Combobox.Empty className="px-3 py-4 text-center text-xs text-foreground-subtle">
              No matching apps
            </Combobox.Empty>
            <Combobox.List className="overflow-y-auto p-1">
              {(item: AppOption) => (
                <Combobox.Item
                  key={item.value || "__default"}
                  value={item}
                  className={cn(
                    "flex cursor-default items-center gap-2 rounded px-2 py-1.5 outline-none",
                    "data-[highlighted]:bg-item-selected",
                  )}
                >
                  <AppIcon icon={item.icon} className="h-4 w-4 text-sm" />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  <Combobox.ItemIndicator className="shrink-0 text-foreground-subtle">
                    ✓
                  </Combobox.ItemIndicator>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

export default AppPicker;
