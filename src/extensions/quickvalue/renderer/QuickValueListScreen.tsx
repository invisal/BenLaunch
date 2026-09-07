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
import type { QuickValueDef } from "../shared/types";

/**
 * The QuickValue manager list, as a screen pushed onto the launcher's navigation
 * stack. Its own component — it only borrows the launcher's *look* (`List.*`) and
 * its keyboard-nav approach (Base UI Autocomplete in `mode="none"`), not its
 * behaviour. The list is small, so it isn't virtualized.
 *
 * A management list: rows show name + description, Enter / click opens the
 * metadata screen, and per-row management actions live in the ⌘K menu. Live
 * values are the job of the `qv:*` rows in the launcher's own search, not here.
 */
function QuickValueListScreen({
  onEdit,
  onCreate,
  onExit,
}: {
  onEdit: (id: string) => void;
  onCreate: () => void;
  /** Leave the manager — back to the launcher search. */
  onExit: () => void;
}) {
  const [items, setItems] = useState<QuickValueDef[] | null>(null);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState<QuickValueDef | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [armedDeleteId, setArmedDeleteId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(() => {
    void window.api.quickValue.list().then(setItems);
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
      (qv) =>
        qv.name.toLowerCase().includes(q) ||
        (qv.description ?? "").toLowerCase().includes(q),
    );
  }, [items, query]);

  async function toggleExposed(qv: QuickValueDef): Promise<void> {
    await window.api.quickValue.setExposed(qv.id, !qv.exposed);
    reload();
  }

  async function remove(qv: QuickValueDef): Promise<void> {
    await window.api.quickValue.delete(qv.id);
    reload();
  }

  const menuItems = useMemo<FooterMenuItem[]>(() => {
    const newItem: FooterMenuItem = {
      id: "new",
      label: "New QuickValue",
      onSelect: onCreate,
    };
    const qv = highlighted ?? filtered[0] ?? null;
    if (!qv) return [newItem];
    const armed = armedDeleteId === qv.id;
    return [
      { id: "edit", label: "Edit QuickValue", onSelect: () => onEdit(qv.id) },
      {
        id: "expose",
        label: qv.exposed ? "Hide from Launcher" : "Expose in Launcher",
        onSelect: () => void toggleExposed(qv),
      },
      {
        id: "delete",
        label: armed ? `Delete "${qv.name}"? Select again` : "Delete QuickValue",
        onSelect: () => {
          if (armed) {
            setArmedDeleteId(null);
            void remove(qv);
          } else {
            setArmedDeleteId(qv.id);
          }
        },
      },
      newItem,
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlighted, filtered, armedDeleteId, onEdit, onCreate]);

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
      onItemHighlighted={(qv) => setHighlighted(qv ?? null)}
    >
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
        <List.Header>
          <Autocomplete.Input
            ref={inputRef}
            onKeyDown={onInputKeyDown}
            placeholder="Search QuickValues..."
            autoFocus
            render={<List.Input />}
          />
        </List.Header>

        <List>
          <Autocomplete.List className="relative w-full">
            {(qv: QuickValueDef) => (
              <Autocomplete.Item
                key={qv.id}
                value={qv}
                onClick={() => onEdit(qv.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setHighlighted(qv);
                  setMenuOpen(true);
                }}
                render={(props, state) => (
                  <List.Item
                    {...props}
                    highlighted={state.highlighted}
                    icon="⚡"
                    title={qv.name}
                    subtitle={qv.description || qv.id}
                    badge={qv.exposed ? "Exposed" : undefined}
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
                  ? "No QuickValues yet. Create one to get started."
                  : "No matches."}
            </List.Empty>
          )}
        </List>

        <Footer>
          <Footer.Left>
            <Footer.Label>
              {filtered.length} QuickValue{filtered.length === 1 ? "" : "s"}
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

export default QuickValueListScreen;
