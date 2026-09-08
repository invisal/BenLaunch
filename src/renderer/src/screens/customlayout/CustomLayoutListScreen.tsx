import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Autocomplete } from "@base-ui/react/autocomplete";
import { Footer, List } from "@renderer/shared/ui";
import type { FooterMenuItem } from "@renderer/shared/ui";
import type { CustomLayoutDef } from "@shared/types";
import { PositionGlyph } from "./PositionGlyph";

/**
 * The custom-layout manager, as a screen pushed onto the launcher's navigation
 * stack — the counterpart to the QuickValue `ListScreen`, and built the same way: it
 * borrows the launcher's *look* (`List.*`) and its keyboard-nav approach (Base
 * UI Autocomplete in `mode="none"`), not its behaviour. The list is small, so
 * it isn't virtualized.
 *
 * Enter / click *applies* the layout — that's the verb these rows carry in the
 * launcher too. Editing and deleting live in the ⌘K menu.
 */

/** "top-left · 50×Auto" — enough to tell two saved layouts apart at a glance. */
function describe(def: CustomLayoutDef): string {
  const size = `${def.widthPercent ?? "Auto"}×${def.heightPercent ?? "Auto"}`;
  return `${def.position} · ${size}`;
}

function CustomLayoutListScreen({
  onEdit,
  onDuplicate,
  onCreate,
  onApply,
  onExit,
}: {
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onCreate: () => void;
  /** Run the layout against the captured window and dismiss the launcher. */
  onApply: (id: string) => void;
  /** Leave the manager — back to the launcher search. */
  onExit: () => void;
}) {
  const [items, setItems] = useState<CustomLayoutDef[] | null>(null);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState<CustomLayoutDef | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [armedDeleteId, setArmedDeleteId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(() => {
    void window.api.customLayout.list().then(setItems);
  }, []);

  // Re-fetches on mount and whenever this screen returns to the top of the stack
  // (a pushed screen unmounts our Effects; React re-mounts them on the way back).
  useEffect(() => {
    reload();
    inputRef.current?.focus();
  }, [reload]);

  useEffect(() => {
    if (!armedDeleteId) return;
    const timer = setTimeout(() => setArmedDeleteId(null), 4000);
    return () => clearTimeout(timer);
  }, [armedDeleteId]);

  const filtered = useMemo(() => {
    const list = items ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (def) =>
        def.name.toLowerCase().includes(q) ||
        def.position.toLowerCase().includes(q),
    );
  }, [items, query]);

  async function remove(def: CustomLayoutDef): Promise<void> {
    await window.api.customLayout.delete(def.id);
    reload();
  }

  const menuItems = useMemo<FooterMenuItem[]>(() => {
    const newItem: FooterMenuItem = {
      id: "new",
      label: "New Command",
      onSelect: onCreate,
    };
    const def = highlighted ?? filtered[0] ?? null;
    if (!def) return [newItem];
    const armed = armedDeleteId === def.id;
    return [
      {
        id: "apply",
        label: "Apply Layout",
        shortcut: "Enter",
        onSelect: () => onApply(def.id),
      },
      { id: "edit", label: "Edit Command", onSelect: () => onEdit(def.id) },
      {
        id: "duplicate",
        label: "Duplicate Command",
        onSelect: () => onDuplicate(def.id),
      },
      {
        id: "delete",
        label: armed ? `Delete "${def.name}"? Select again` : "Delete Command",
        onSelect: () => {
          if (armed) {
            setArmedDeleteId(null);
            void remove(def);
          } else {
            setArmedDeleteId(def.id);
          }
        },
      },
      newItem,
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlighted, filtered, armedDeleteId, onEdit, onDuplicate, onCreate, onApply]);

  function onInputKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "Escape") {
      e.preventDefault();
      if (query) setQuery("");
      else onExit();
    }
  }

  return (
    <Autocomplete.Root
      items={filtered}
      value={query}
      onValueChange={(value) => setQuery(value)}
      mode="none"
      inline
      open
      loopFocus={false}
      autoHighlight="always"
      onItemHighlighted={(def) => setHighlighted(def ?? null)}
    >
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
        <List.Header>
          <Autocomplete.Input
            ref={inputRef}
            onKeyDown={onInputKeyDown}
            placeholder="Search commands..."
            autoFocus
            render={<List.Input />}
          />
        </List.Header>

        <List>
          <Autocomplete.List className="relative w-full">
            {(def: CustomLayoutDef) => (
              <Autocomplete.Item
                key={def.id}
                value={def}
                onClick={() => onApply(def.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setHighlighted(def);
                  setMenuOpen(true);
                }}
                render={(props, state) => (
                  <List.Item
                    {...props}
                    highlighted={state.highlighted}
                    icon={
                      <span className="block h-4 w-5">
                        <PositionGlyph position={def.position} selected />
                      </span>
                    }
                    title={def.name}
                    subtitle={describe(def)}
                  />
                )}
              />
            )}
          </Autocomplete.List>

          {filtered.length === 0 && (
            <List.Empty>
              {items === null
                ? "Loading…"
                : items.length === 0
                  ? "No commands yet. Create one to get started."
                  : "No matches."}
            </List.Empty>
          )}
        </List>

        <Footer>
          <Footer.Left>
            <Footer.Label>
              {filtered.length} Command{filtered.length === 1 ? "" : "s"}
            </Footer.Label>
          </Footer.Left>
          <Footer.Right>
            <Footer.Menu
              open={menuOpen}
              onOpenChange={setMenuOpen}
              items={menuItems}
              finalFocus={inputRef}
            />
          </Footer.Right>
        </Footer>
      </div>
    </Autocomplete.Root>
  );
}

export default CustomLayoutListScreen;
