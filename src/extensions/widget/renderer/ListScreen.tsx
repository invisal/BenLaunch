import { useCallback, useEffect, useState } from "react";
import { ListScreen as ListScreenBase } from "@renderer/shared/ui";
import type { FooterMenuItem } from "@renderer/shared/ui";
import type { WidgetDef } from "../shared/types";

/**
 * The Widget manager list, as a screen pushed onto the launcher's navigation
 * stack. Built on the shared `ListScreen` from `@renderer/shared/ui` (imported
 * here as `ListScreenBase`) — it only supplies the data, the row markup, and the
 * ⌘K menu; the Autocomplete wiring, query state, highlight tracking and Escape
 * handling all live in the shared component.
 *
 * A management list: rows show name + description, Enter / click opens the
 * metadata screen, and per-row management actions live in the ⌘K menu. Live
 * values are the job of the `widget:*` rows in the launcher's own search, not here.
 */
function ListScreen({
  onEdit,
  onCreate,
}: {
  onEdit: (id: string) => void;
  onCreate: () => void;
}) {
  const [items, setItems] = useState<WidgetDef[] | null>(null);

  const reload = useCallback(() => {
    void window.api.widget.list().then(setItems);
  }, []);

  // Re-fetches on mount and whenever this screen returns to the top of the stack
  // (a pushed screen unmounts our Effects; React re-mounts them on the way back).
  useEffect(() => {
    reload();
  }, [reload]);

  async function toggleExposed(widget: WidgetDef): Promise<void> {
    await window.api.widget.setExposed(widget.id, !widget.exposed);
    reload();
  }

  async function remove(widget: WidgetDef): Promise<void> {
    await window.api.widget.delete(widget.id);
    reload();
  }

  const menu = (widget: WidgetDef | null): FooterMenuItem[] => {
    const newItem: FooterMenuItem = {
      id: "new",
      label: "New Widget",
      onSelect: onCreate,
    };
    if (!widget) return [newItem];
    return [
      { id: "edit", label: "Edit Widget", onSelect: () => onEdit(widget.id) },
      {
        id: "expose",
        label: widget.exposed ? "Hide from Launcher" : "Expose in Launcher",
        onSelect: () => void toggleExposed(widget),
      },
      {
        id: "delete",
        label: "Delete Widget",
        confirmLabel: `Delete "${widget.name}"? Select again`,
        danger: true,
        onSelect: () => void remove(widget),
      },
      newItem,
    ];
  };

  return (
    <ListScreenBase
      data={items}
      getId={(widget) => widget.id}
      getSearchText={(widget) => `${widget.name} ${widget.description ?? ""}`}
      placeholder="Search Widgets..."
      renderItem={(widget, { highlighted }) => (
        <ListScreenBase.Item
          highlighted={highlighted}
          icon="⚡"
          title={widget.name}
          subtitle={widget.description || widget.id}
          badge={widget.exposed ? "Exposed" : undefined}
        />
      )}
      onActivate={(widget) => onEdit(widget.id)}
      menu={menu}
      footerLabel={(n) => `${n} Widget${n === 1 ? "" : "s"}`}
      emptyLabel="No Widgets yet. Create one to get started."
    />
  );
}

export default ListScreen;
