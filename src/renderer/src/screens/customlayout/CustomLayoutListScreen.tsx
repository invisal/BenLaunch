import { useCallback, useEffect, useState } from "react";
import { ListScreen } from "@renderer/shared/ui";
import type { FooterMenuItem } from "@renderer/shared/ui";
import type { CustomLayoutDef } from "@shared/types";
import { PositionGlyph } from "./PositionGlyph";

/**
 * The custom-layout manager, as a screen pushed onto the launcher's navigation
 * stack — the counterpart to the Widget `ListScreen`, and built on the same
 * shared `ListScreen` from `@renderer/shared/ui`: it only supplies the data,
 * the row markup, and the ⌘K menu.
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

  const reload = useCallback(() => {
    void window.api.customLayout.list().then(setItems);
  }, []);

  // Re-fetches on mount and whenever this screen returns to the top of the stack
  // (a pushed screen unmounts our Effects; React re-mounts them on the way back).
  useEffect(() => {
    reload();
  }, [reload]);

  async function remove(def: CustomLayoutDef): Promise<void> {
    await window.api.customLayout.delete(def.id);
    reload();
  }

  const menu = (def: CustomLayoutDef | null): FooterMenuItem[] => {
    const newItem: FooterMenuItem = {
      id: "new",
      label: "New Command",
      onSelect: onCreate,
    };
    if (!def) return [newItem];
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
        label: "Delete Command",
        confirmLabel: `Delete "${def.name}"? Select again`,
        danger: true,
        onSelect: () => void remove(def),
      },
      newItem,
    ];
  };

  return (
    <ListScreen
      data={items}
      getId={(def) => def.id}
      getSearchText={(def) => `${def.name} ${def.position}`}
      placeholder="Search commands..."
      renderItem={(def, { highlighted }) => (
        <ListScreen.Item
          highlighted={highlighted}
          icon={
            <span className="block h-4 w-5">
              <PositionGlyph position={def.position} selected />
            </span>
          }
          title={def.name}
          subtitle={describe(def)}
        />
      )}
      onActivate={(def) => onApply(def.id)}
      onExit={onExit}
      menu={menu}
      footerLabel={(n) => `${n} Command${n === 1 ? "" : "s"}`}
      emptyLabel="No commands yet. Create one to get started."
    />
  );
}

export default CustomLayoutListScreen;
