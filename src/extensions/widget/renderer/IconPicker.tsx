import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { cn } from "cnfast";
import { Popover } from "@base-ui/react/popover";
import { iconSrc } from "@renderer/lib/icon";
import { DEFAULT_WIDGET_ICON, ICON_SIZE } from "../shared/types";
import {
  ICON_CATEGORIES,
  findIcon,
  type IconCategory,
  type IconEntry,
} from "./icons/catalog";

const COLUMNS = 8;

/** A category's icons that survived the search, and where they start in the
 *  flat (cross-section) index the keyboard cursor moves through. */
interface Section {
  category: IconCategory;
  icons: IconEntry[];
  start: number;
}

/** Decode `file` and redraw it centered in an ICON_SIZE square, as a PNG data URI. */
async function fileToIcon(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();

    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = ICON_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");

    // SVGs may report a 0 natural size; fall back to a square.
    const w = img.naturalWidth || ICON_SIZE;
    const h = img.naturalHeight || ICON_SIZE;
    const scale = Math.min(ICON_SIZE / w, ICON_SIZE / h);
    const dw = w * scale;
    const dh = h * scale;
    ctx.drawImage(img, (ICON_SIZE - dw) / 2, (ICON_SIZE - dh) / 2, dw, dh);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

function Glyph({ icon, className }: { icon: string; className?: string }) {
  const src = iconSrc(icon);
  return src ? (
    <img src={src} alt="" className={cn("object-contain", className)} />
  ) : (
    <span>{icon}</span>
  );
}

/**
 * Icon field for a Widget: a preview tile that opens a popover with a search
 * box, one scrolling list of icons (Emoji and Brands as labelled sections)
 * and an upload button. `value` is an emoji, a `brand:<id>` reference, a
 * `data:` image URI, or "" for the default glyph.
 *
 * Accessibility follows the combobox pattern: focus stays in the search input
 * while arrow keys move a virtual cursor (`aria-activedescendant`) across the
 * grid: Left/Right +-1, Up/Down +-a row (rolling over into the next or previous
 * section), Home/End. Enter picks it. Escape closes just the popover (it's
 * `preventDefault`-ed so the screen's own Escape shortcut doesn't also fire).
 */
export default function IconPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (icon: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  // Each category filtered by the query; empty ones drop out entirely.
  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const result: Section[] = [];
    let start = 0;
    for (const category of ICON_CATEGORIES) {
      const icons = q
        ? category.icons.filter((entry) =>
            `${entry.name} ${entry.keywords ?? ""}`.toLowerCase().includes(q),
          )
        : category.icons;
      if (!icons.length) continue;
      result.push({ category, icons, start });
      start += icons.length;
    }
    return result;
  }, [query]);

  const results = useMemo(
    () => sections.flatMap((section) => section.icons),
    [sections],
  );

  const optionId = (index: number): string => `${listId}-${index}`;

  // Keep the keyboard cursor visible when the grid scrolls.
  useEffect(() => {
    if (!open) return;
    document
      .getElementById(`${listId}-${active}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, active, results, listId]);

  function changeOpen(next: boolean): void {
    setOpen(next);
    if (next) {
      // Open with the cursor on the current icon, if it's in the catalog.
      setQuery("");
      setActive(
        Math.max(
          0,
          ICON_CATEGORIES.flatMap((c) => c.icons).findIndex(
            (entry) => entry.value === value,
          ),
        ),
      );
      setError("");
    }
  }

  /** Where the cursor goes for an arrow key, across section boundaries. */
  function move(index: number, key: string): number {
    const last = results.length - 1;
    if (key === "Home") return 0;
    if (key === "End") return last;
    if (key === "ArrowRight") return Math.min(last, index + 1);
    if (key === "ArrowLeft") return Math.max(0, index - 1);

    let at = sections.length - 1;
    while (at > 0 && sections[at].start > index) at--;
    const section = sections[at];
    const local = index - section.start;
    const col = local % COLUMNS;
    const lastRow = Math.floor((section.icons.length - 1) / COLUMNS);

    if (key === "ArrowDown") {
      if (Math.floor(local / COLUMNS) < lastRow) {
        return (
          section.start + Math.min(local + COLUMNS, section.icons.length - 1)
        );
      }
      const next = sections[at + 1];
      return next ? next.start + Math.min(col, next.icons.length - 1) : index;
    }
    // ArrowUp
    if (local >= COLUMNS) return index - COLUMNS;
    const prev = sections[at - 1];
    if (!prev) return index;
    const lastRowStart =
      Math.floor((prev.icons.length - 1) / COLUMNS) * COLUMNS;
    return prev.start + Math.min(lastRowStart + col, prev.icons.length - 1);
  }

  function pick(icon: string): void {
    onChange(icon);
    setOpen(false);
  }

  async function upload(file: File | undefined): Promise<void> {
    if (!file) return;
    setError("");
    try {
      pick(await fileToIcon(file));
    } catch {
      setError("Couldn't read that image.");
    }
  }

  function onSearchKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (
      [
        "ArrowRight",
        "ArrowLeft",
        "ArrowDown",
        "ArrowUp",
        "Home",
        "End",
      ].includes(e.key)
    ) {
      e.preventDefault();
      if (results.length) setActive(move(active, e.key));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const chosen = results[active];
      if (chosen) pick(chosen.value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }
  }

  const currentName = value
    ? (findIcon(value)?.name ?? "Custom image")
    : "Default";

  return (
    <div className="flex items-center gap-2">
      <Popover.Root open={open} onOpenChange={changeOpen}>
        <Popover.Trigger
          ref={triggerRef}
          aria-label={`Choose icon, current: ${currentName}`}
          title="Change icon"
          className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-input text-xl outline-none focus-visible:border-foreground-subtle"
        >
          <Glyph icon={value || DEFAULT_WIDGET_ICON} className="h-6 w-6" />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner
            side="right"
            align="start"
            sideOffset={8}
            collisionPadding={10}
          >
            <Popover.Popup
              initialFocus={searchRef}
              aria-label="Choose an icon"
              className="flex h-96 max-h-[var(--available-height)] w-64 flex-col overflow-hidden rounded-md border border-border bg-popover p-2 text-sm text-foreground shadow-lg outline-none"
            >
              <input
                ref={searchRef}
                role="combobox"
                aria-label="Search icons"
                aria-expanded
                aria-controls={listId}
                aria-activedescendant={
                  results.length ? optionId(active) : undefined
                }
                aria-autocomplete="list"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onSearchKeyDown}
                placeholder="Search icons…"
                spellCheck={false}
                className="mb-2 w-full shrink-0 rounded border border-border bg-input px-2 py-1 text-[13px] outline-none placeholder:text-foreground-subtle focus:border-foreground-subtle"
              />

              <div
                id={listId}
                role="listbox"
                aria-label="Icons"
                className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]"
              >
                {sections.map((section, sectionIndex) => (
                  <div
                    key={section.category.id}
                    role="group"
                    aria-labelledby={`${listId}-group-${section.category.id}`}
                    className={cn(
                      sectionIndex > 0 && "mt-2 border-t border-border pt-2",
                    )}
                  >
                    <div
                      id={`${listId}-group-${section.category.id}`}
                      className="px-0.5 pb-1 text-[11px] font-medium text-foreground-subtle"
                    >
                      {section.category.label}
                    </div>
                    <div role="none" className="grid grid-cols-8 gap-0.5">
                      {section.icons.map((entry, i) => {
                        const index = section.start + i;
                        return (
                          <div
                            key={entry.name}
                            id={optionId(index)}
                            role="option"
                            aria-label={entry.name}
                            aria-selected={entry.value === value}
                            title={entry.name}
                            // Keep focus in the search input when clicking.
                            onMouseDown={(e) => e.preventDefault()}
                            onMouseMove={() => setActive(index)}
                            onClick={() => pick(entry.value)}
                            className={cn(
                              "flex aspect-square min-w-0 cursor-default items-center justify-center rounded text-base",
                              index === active && "bg-item-hover",
                              entry.value === value && "bg-item-selected",
                            )}
                          >
                            <Glyph icon={entry.value} className="h-5 w-5" />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <p
                role="status"
                className={cn(
                  "text-[11px] text-foreground-subtle",
                  results.length ? "sr-only" : "py-2 text-center",
                )}
              >
                {results.length
                  ? `${results.length} icon${results.length === 1 ? "" : "s"}`
                  : "No matching icons"}
              </p>

              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="mt-2 w-full shrink-0 rounded border border-border px-2 py-1 text-xs hover:bg-item-hover focus-visible:border-foreground-subtle focus-visible:outline-none"
              >
                Upload image…
              </button>
              {error && (
                <p role="alert" className="mt-1 text-[11px] text-red-400">
                  {error}
                </p>
              )}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif"
        className="hidden"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          void upload(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Remove icon"
          className="text-xs text-foreground-subtle hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
        >
          Remove
        </button>
      )}
    </div>
  );
}
