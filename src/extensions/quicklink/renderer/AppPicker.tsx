import { useMemo } from "react";
import { cn } from "cnfast";
import { Combobox } from "@base-ui/react/combobox";
import type { OpenWithApp } from "../shared/types";

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

/** Fallback for an app with no icon (the "Default browser" entry). */
function GlobeIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}

/** Selected-item indicator inside the list. */
function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/** Trigger's dropdown affordance — rotates when the popup is open. */
function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn("shrink-0 transition-transform", className)}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function AppIcon({ icon, className }: { icon?: string; className?: string }) {
  const cls = cn("flex shrink-0 items-center justify-center", className);
  if (!icon)
    return (
      <span className={cn(cls, "text-foreground-subtle")}>
        <GlobeIcon />
      </span>
    );
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
          "group flex w-full items-center gap-2 rounded border border-border bg-input",
          "px-2.5 py-1.5 text-left text-[13px] outline-none focus:border-foreground-subtle",
        )}
      >
        <AppIcon icon={selected?.icon} className="h-4 w-4 text-sm" />
        <span className="min-w-0 flex-1 truncate">
          <Combobox.Value>
            {(item: AppOption | null) => item?.label ?? defaultLabel}
          </Combobox.Value>
        </span>
        <ChevronDownIcon className="text-foreground-subtle group-data-[popup-open]:rotate-180" />
      </Combobox.Trigger>

      <Combobox.Portal>
        <Combobox.Positioner sideOffset={6} collisionPadding={10} className="z-50">
          <Combobox.Popup
            className={cn(
              "flex max-h-[min(18rem,var(--available-height))] w-[var(--anchor-width)] flex-col overflow-hidden",
              "rounded-md border border-border bg-popover text-sm text-foreground shadow-lg outline-none",
            )}
          >
            <div className="border-b border-border p-1">
              <Combobox.Input
                placeholder="Search apps…"
                className="w-full bg-transparent px-1.5 py-1 text-[13px] outline-none placeholder:text-foreground-subtle"
              />
            </div>
            {/* Base UI keeps this root element mounted at all times (for
                screen-reader announcements), so its padding must live on an
                inner wrapper — otherwise it's dead space above the list even
                when there's nothing to show. */}
            <Combobox.Empty>
              <div className="px-3 py-4 text-center text-xs text-foreground-subtle">
                No matching apps
              </div>
            </Combobox.Empty>
            <Combobox.List className="flex flex-col gap-0.5 overflow-y-auto p-1">
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
                    <CheckIcon />
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
