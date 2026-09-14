import { useCallback, useEffect, useState } from "react";
import { ListScreen } from "@renderer/shared/ui";
import type { FooterMenuItem } from "@renderer/shared/ui";
import { clipboardText, relativeAge, type CopyKind } from "../shared/format";
import type { HistoryEntry } from "../shared/types";

/**
 * The Calculator History list, as a screen pushed onto the launcher's
 * navigation stack. Built on the shared `ListScreen` (search, highlight,
 * Escape, ⌘K menu) exactly like the Widget manager — it only supplies the
 * data, the row markup and the menu.
 *
 * Pinned entries come first (the store orders them), each row shows
 * expression → result, and the search matches the typed query, the
 * expression and the result. Knows nothing about the router: navigation is
 * handed in by `../screen.tsx`.
 */
function HistoryListScreen({
  onRerun,
  onDismiss,
}: {
  /** Put `query` back into the launcher's search box. */
  onRerun: (query: string) => void;
  /** Close the launcher after a copy. */
  onDismiss: () => void;
}) {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [pinLimitHit, setPinLimitHit] = useState(false);

  const reload = useCallback(() => {
    void window.api.calculatorHistory.list().then(setEntries);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  function copy(entry: HistoryEntry, kind: CopyKind): void {
    void navigator.clipboard.writeText(clipboardText(entry, kind));
    onDismiss();
  }

  async function togglePin(entry: HistoryEntry): Promise<void> {
    const ok = await window.api.calculatorHistory.setPinned(
      entry.id,
      !entry.pinned,
    );
    setPinLimitHit(!ok);
    reload();
  }

  async function remove(entry: HistoryEntry): Promise<void> {
    await window.api.calculatorHistory.delete(entry.id);
    reload();
  }

  async function clearAll(): Promise<void> {
    await window.api.calculatorHistory.clear();
    reload();
  }

  const menu = (entry: HistoryEntry | null): FooterMenuItem[] => {
    const clearItem: FooterMenuItem = {
      id: "clear",
      label: "Clear History",
      confirmLabel: "Clear all unpinned entries? Select again",
      danger: true,
      section: "History",
      onSelect: () => void clearAll(),
    };
    if (!entry) return entries?.length ? [clearItem] : [];
    return [
      {
        id: "copy-result",
        label: "Copy Result",
        shortcut: "Enter",
        onSelect: () => copy(entry, "value"),
      },
      {
        id: "copy-unformatted",
        label: "Copy Unformatted",
        onSelect: () => copy(entry, "raw"),
      },
      {
        id: "copy-question-and-answer",
        label: "Copy Question & Answer",
        onSelect: () => copy(entry, "question-and-answer"),
      },
      {
        id: "rerun",
        label: "Re-run in Launcher",
        onSelect: () => onRerun(entry.query),
      },
      {
        id: "pin",
        label: entry.pinned ? "Unpin" : "Pin",
        onSelect: () => void togglePin(entry),
      },
      {
        id: "delete",
        label: "Delete Entry",
        confirmLabel: "Delete this entry? Select again",
        danger: true,
        section: "History",
        onSelect: () => void remove(entry),
      },
      clearItem,
    ];
  };

  const now = Date.now();

  return (
    <ListScreen
      data={entries}
      getId={(entry) => entry.id}
      getSearchText={(entry) =>
        `${entry.query} ${entry.expression} ${entry.value}`
      }
      placeholder="Search Calculator History..."
      renderItem={(entry, { highlighted }) => (
        <ListScreen.Item
          highlighted={highlighted}
          icon={entry.pinned ? "📌" : "🧮"}
          title={entry.expression}
          subtitle={`= ${entry.value}`}
          badge={entry.pinned ? "Pinned" : relativeAge(entry.createdAt, now)}
        />
      )}
      onActivate={(entry) => copy(entry, "value")}
      menu={menu}
      footerLabel={(n) =>
        pinLimitHit
          ? "Pin limit reached — unpin one first"
          : `${n} Calculation${n === 1 ? "" : "s"}`
      }
      emptyLabel="No calculations yet. Copy a calculator result to save it here."
      noMatchLabel="No matching calculations"
    />
  );
}

export default HistoryListScreen;
