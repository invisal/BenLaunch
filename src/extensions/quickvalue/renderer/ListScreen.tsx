import { useCallback, useEffect, useState } from "react";
import { ListScreen as ListScreenBase } from "@renderer/shared/ui";
import type { FooterMenuItem } from "@renderer/shared/ui";
import type { QuickValueDef } from "../shared/types";

/**
 * The QuickValue manager list, as a screen pushed onto the launcher's navigation
 * stack. Built on the shared `ListScreen` from `@renderer/shared/ui` (imported
 * here as `ListScreenBase`) — it only supplies the data, the row markup, and the
 * ⌘K menu; the Autocomplete wiring, query state, highlight tracking and Escape
 * handling all live in the shared component.
 *
 * A management list: rows show name + description, Enter / click opens the
 * metadata screen, and per-row management actions live in the ⌘K menu. Live
 * values are the job of the `qv:*` rows in the launcher's own search, not here.
 */
function ListScreen({
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

  const reload = useCallback(() => {
    void window.api.quickValue.list().then(setItems);
  }, []);

  // Re-fetches on mount and whenever this screen returns to the top of the stack
  // (a pushed screen unmounts our Effects; React re-mounts them on the way back).
  useEffect(() => {
    reload();
  }, [reload]);

  async function toggleExposed(qv: QuickValueDef): Promise<void> {
    await window.api.quickValue.setExposed(qv.id, !qv.exposed);
    reload();
  }

  async function remove(qv: QuickValueDef): Promise<void> {
    await window.api.quickValue.delete(qv.id);
    reload();
  }

  const menu = (qv: QuickValueDef | null): FooterMenuItem[] => {
    const newItem: FooterMenuItem = {
      id: "new",
      label: "New QuickValue",
      onSelect: onCreate,
    };
    if (!qv) return [newItem];
    return [
      { id: "edit", label: "Edit QuickValue", onSelect: () => onEdit(qv.id) },
      {
        id: "expose",
        label: qv.exposed ? "Hide from Launcher" : "Expose in Launcher",
        onSelect: () => void toggleExposed(qv),
      },
      {
        id: "delete",
        label: "Delete QuickValue",
        confirmLabel: `Delete "${qv.name}"? Select again`,
        danger: true,
        onSelect: () => void remove(qv),
      },
      newItem,
    ];
  };

  return (
    <ListScreenBase
      data={items}
      getId={(qv) => qv.id}
      getSearchText={(qv) => `${qv.name} ${qv.description ?? ""}`}
      placeholder="Search QuickValues..."
      renderItem={(qv, { highlighted }) => (
        <ListScreenBase.Item
          highlighted={highlighted}
          icon="⚡"
          title={qv.name}
          subtitle={qv.description || qv.id}
          badge={qv.exposed ? "Exposed" : undefined}
        />
      )}
      onActivate={(qv) => onEdit(qv.id)}
      onExit={onExit}
      menu={menu}
      footerLabel={(n) => `${n} QuickValue${n === 1 ? "" : "s"}`}
      emptyLabel="No QuickValues yet. Create one to get started."
    />
  );
}

export default ListScreen;
