import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ListScreen, LIST_SCREEN_ITEM_HEIGHT } from "@renderer/shared/ui";
import type { FooterMenuItem } from "@renderer/shared/ui";
import { absoluteTime, groupLabel, toPlainText } from "../shared/format.ts";
import type {
  EngineInfo,
  Recognition,
  RecognizeRequest,
} from "../shared/types";
import {
  EnginePanel,
  ImagePreview,
  InfoRow,
  RecognitionInfo,
} from "./parts.tsx";

/**
 * The extension's home screen: the two ways to start a recognition, followed
 * by everything already recognized.
 *
 * The "Read text from…" rows sit *in* the list rather than behind a ⌘K menu
 * because they are the whole point of the screen — on a first run there is
 * nothing else on it, and a screen whose primary action is hidden in a menu is
 * the kind of thing that makes an app feel cheap. They're ordinary rows, so
 * they're searchable ("clip" finds "Clipboard Image") and reachable with the
 * same keys as everything else.
 *
 * Knows nothing about the router: navigation is handed in by `../screen.tsx`.
 */

/** A section heading (`"Read text from"`, `"Pinned"`, `"Today"`, …). */
interface HeaderRow {
  kind: "header";
  key: string;
  label: string;
}

/** One of the two ways to start a recognition. */
interface ActionRow {
  kind: "action";
  key: string;
  request: RecognizeRequest;
  title: string;
  subtitle: string;
  icon: string;
}

interface EntryRow {
  kind: "entry";
  entry: Recognition;
}

type Row = HeaderRow | ActionRow | EntryRow;

const HEADER_ROW_HEIGHT = 28;

const ACTIONS: ActionRow[] = [
  {
    kind: "action",
    key: "action:clipboard",
    request: { kind: "clipboard" },
    title: "Clipboard Image",
    subtitle: "Recognize whatever image is on the clipboard",
    icon: "📋",
  },
  {
    kind: "action",
    key: "action:file",
    request: { kind: "file" },
    title: "Image File…",
    subtitle: "Choose a screenshot, photo or scan",
    icon: "🖼️",
  },
];

/** Groups recognitions under the action rows: pins first, then by day. */
function buildRows(
  entries: Recognition[],
  actions: ActionRow[],
  now: number,
): Row[] {
  const rows: Row[] = [];
  if (actions.length) {
    rows.push({ kind: "header", key: "group:read", label: "Read text from" });
    rows.push(...actions);
  }

  const pinned = entries.filter((entry) => entry.pinned);
  if (pinned.length) {
    rows.push({ kind: "header", key: "group:pinned", label: "Pinned" });
    for (const entry of pinned) rows.push({ kind: "entry", entry });
  }

  let lastLabel: string | null = null;
  for (const entry of entries.filter((item) => !item.pinned)) {
    const label = groupLabel(entry.createdAt, now);
    if (label !== lastLabel) {
      rows.push({ kind: "header", key: `group:${label}`, label });
      lastLabel = label;
    }
    rows.push({ kind: "entry", entry });
  }
  return rows;
}

function matches(row: ActionRow | EntryRow, query: string): boolean {
  const haystack =
    row.kind === "action"
      ? `${row.title} ${row.subtitle}`
      : `${row.entry.preview} ${toPlainText(row.entry.lines)}`;
  return haystack.toLowerCase().includes(query);
}

/** The right-hand pane for a recognition: the image, its text, its metadata. */
function EntryDetail({ entry }: { entry: Recognition }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-center border-b border-border p-3">
        <ImagePreview recognition={entry} className="max-h-40" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <pre className="whitespace-pre-wrap wrap-break-word text-sm">
          {toPlainText(entry.lines)}
        </pre>
      </div>
      <div className="max-h-44 shrink-0 overflow-y-auto border-t border-border p-3">
        <RecognitionInfo
          recognition={entry}
          extra={
            <InfoRow label="Recognized" value={absoluteTime(entry.createdAt)} />
          }
        />
      </div>
    </div>
  );
}

function ReadTextScreen({
  /** Recognize this as soon as the screen mounts — the `Read Text from
   *  Clipboard Image` / `…Image File` commands land here. */
  autoStart,
  onOpenResult,
  onExport,
  onDismiss,
}: {
  autoStart?: "clipboard" | "file";
  onOpenResult: (id: string) => void;
  onExport: (id: string) => void;
  /** Close the launcher entirely (after a copy). */
  onDismiss: () => void;
}) {
  const [entries, setEntries] = useState<Recognition[] | null>(null);
  const [engine, setEngine] = useState<EngineInfo | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  // Tracked here rather than trusted from `ListScreen`'s highlight, for the
  // same reason Clipboard History does it: a plain click routes through Base
  // UI's "commit selection" path and can momentarily clear the highlight.
  const [selected, setSelected] = useState<Row | null>(null);

  const reload = useCallback(
    () => void window.api.textFromImage.list().then(setEntries),
    [],
  );

  useEffect(() => {
    reload();
    void window.api.textFromImage.engine().then(setEngine);
  }, [reload]);

  const run = useCallback(
    async (request: RecognizeRequest, label: string) => {
      setBusy(true);
      setStatus(label);
      try {
        const result = await window.api.textFromImage.recognize(request);
        reload();
        if (result.ok) {
          setStatus(null);
          onOpenResult(result.recognition.id);
        } else {
          // A dismissed file picker isn't a failure and says nothing.
          setStatus(result.cancelled ? null : result.error);
        }
      } finally {
        setBusy(false);
      }
    },
    [onOpenResult, reload],
  );

  // The launcher commands navigate here with a `start` payload rather than
  // recognizing inside `execute()` — see the note in `../index.ts`. Guarded by
  // a ref so React's development double-invoke can't run it twice (which for
  // "file" would mean two pickers).
  const started = useRef(false);
  useEffect(() => {
    if (!autoStart || started.current) return;
    started.current = true;
    void run(
      autoStart === "clipboard" ? { kind: "clipboard" } : { kind: "file" },
      autoStart === "clipboard"
        ? "Reading the clipboard image…"
        : "Waiting for a file…",
    );
  }, [autoStart, run]);

  /**
   * Drop an image anywhere on the window. The bytes are read here and sent
   * over IPC rather than passing a path: the launcher's renderer has no Node
   * integration, and modern Electron no longer exposes `File.path` at all.
   */
  useEffect(() => {
    const allow = (event: DragEvent): void => event.preventDefault();
    const onDrop = (event: DragEvent): void => {
      event.preventDefault();
      const file = event.dataTransfer?.files?.[0];
      if (!file || busy) return;
      void file
        .arrayBuffer()
        .then((buffer) =>
          run(
            { kind: "bytes", name: file.name, data: new Uint8Array(buffer) },
            `Reading ${file.name}…`,
          ),
        );
    };
    window.addEventListener("dragover", allow);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", allow);
      window.removeEventListener("drop", onDrop);
    };
  }, [busy, run]);

  const rows = useMemo(() => {
    if (entries == null) return null;
    const q = query.trim().toLowerCase();
    const actions = q ? ACTIONS.filter((row) => matches(row, q)) : ACTIONS;
    const matching = q
      ? entries.filter((entry) => matches({ kind: "entry", entry }, q))
      : entries;
    return buildRows(matching, actions, Date.now());
  }, [entries, query]);

  const entryCount = rows?.filter((row) => row.kind === "entry").length ?? 0;
  const selectedEntry = selected?.kind === "entry" ? selected.entry : null;

  // Keeps `selected` pointing at something that still exists — the entry may
  // have been deleted, or refreshed into a new object by a pin toggle.
  useEffect(() => {
    if (!selectedEntry || entries == null) return;
    const current = entries.find((entry) => entry.id === selectedEntry.id);
    if (current !== selectedEntry) {
      setSelected(current ? { kind: "entry", entry: current } : null);
    }
  }, [entries, selectedEntry]);

  function activate(row: Row): void {
    if (row.kind === "header" || busy) return;
    if (row.kind === "action") {
      void run(
        row.request,
        row.request.kind === "clipboard"
          ? "Reading the clipboard image…"
          : "Waiting for a file…",
      );
      return;
    }
    onOpenResult(row.entry.id);
  }

  async function copy(entry: Recognition): Promise<void> {
    await window.api.textFromImage.copyAs(entry.id, "txt", {
      table: false,
      includeConfidence: false,
    });
    onDismiss();
  }

  async function togglePin(entry: Recognition): Promise<void> {
    const ok = await window.api.textFromImage.setPinned(
      entry.id,
      !entry.pinned,
    );
    setStatus(ok ? null : "Pin limit reached — unpin one first");
    reload();
  }

  const menu = (): FooterMenuItem[] => {
    const items: FooterMenuItem[] = [];
    if (selectedEntry) {
      items.push(
        {
          id: "open",
          label: "Open Result",
          shortcut: "Enter",
          onSelect: () => onOpenResult(selectedEntry.id),
        },
        {
          id: "copy",
          label: "Copy Text",
          shortcut: "CommandOrControl+C",
          onSelect: () => void copy(selectedEntry),
        },
        {
          id: "export",
          label: "Export As…",
          shortcut: "CommandOrControl+E",
          onSelect: () => onExport(selectedEntry.id),
        },
        {
          id: "pin",
          label: selectedEntry.pinned ? "Unpin" : "Pin",
          onSelect: () => void togglePin(selectedEntry),
        },
        {
          id: "delete",
          label: "Delete Recognition",
          confirmLabel: "Delete this recognition? Select again",
          danger: true,
          section: "Library",
          onSelect: () =>
            void window.api.textFromImage.delete(selectedEntry.id).then(reload),
        },
      );
    }
    if (entryCount > 0) {
      items.push({
        id: "clear",
        label: "Clear Library",
        confirmLabel: "Delete every unpinned recognition? Select again",
        danger: true,
        section: "Library",
        onSelect: () => void window.api.textFromImage.clear().then(reload),
      });
    }
    return items;
  };

  return (
    <ListScreen
      data={rows}
      getId={(row) => (row.kind === "entry" ? row.entry.id : row.key)}
      inputValue={query}
      onInputChange={setQuery}
      serverFiltered
      isDisabled={(row) => row.kind === "header"}
      placeholder="Read text from an image, or search what you've read…"
      virtualized
      itemHeight={(row) =>
        row.kind === "header" ? HEADER_ROW_HEIGHT : LIST_SCREEN_ITEM_HEIGHT
      }
      renderItem={(row, { highlighted }) =>
        row.kind === "header" ? (
          <div className="flex h-7 items-end px-1.5 pb-1 text-xs font-medium text-foreground-subtle">
            {row.label}
          </div>
        ) : row.kind === "action" ? (
          <ListScreen.Item
            highlighted={highlighted}
            icon={row.icon}
            title={row.title}
            subtitle={row.subtitle}
          />
        ) : (
          <ListScreen.Item
            highlighted={row.entry.id === selectedEntry?.id}
            icon={row.entry.thumbnailDataUrl}
            title={row.entry.preview}
            badge={row.entry.pinned ? "📌" : undefined}
          />
        )
      }
      onActivate={(row) => {
        if (row.kind !== "header") setSelected(row);
        activate(row);
      }}
      onHighlightChange={(row) => {
        if (row && row.kind !== "header") setSelected(row);
      }}
      onInputKeyDown={(event, row) => {
        if (row?.kind !== "entry") return;
        if (event.key === "c" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          void copy(row.entry);
        } else if (event.key === "e" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          onExport(row.entry.id);
        }
      }}
      menu={menu}
      detail={() =>
        selectedEntry ? (
          <EntryDetail entry={selectedEntry} />
        ) : (
          <EnginePanel engine={engine} />
        )
      }
      footerLabel={() =>
        status ??
        (busy
          ? "Recognizing…"
          : `${entryCount} recognition${entryCount === 1 ? "" : "s"}`)
      }
      emptyLabel={
        query.trim()
          ? "No matches"
          : "Nothing yet — copy a screenshot or pick an image file."
      }
    />
  );
}

export default ReadTextScreen;
