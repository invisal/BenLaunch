import { useEffect, useMemo, useState } from "react";
import { ListScreen, LIST_SCREEN_ITEM_HEIGHT } from "@renderer/shared/ui";
import type { FooterMenuItem } from "@renderer/shared/ui";
import { formatConfidence, toPlainText } from "../shared/format.ts";
import { looksTabular, toGrid } from "../shared/table.ts";
import type { OcrLine, Recognition } from "../shared/types";
import {
  ImagePreview,
  InfoRow,
  PaneHeading,
  RecognitionInfo,
  Tag,
} from "./parts.tsx";

/**
 * One recognition, line by line.
 *
 * The list is the recognized text itself — searchable, so a long scan is a
 * place you can find something in rather than a wall to scroll. The pane
 * beside it shows the source image with the highlighted line boxed on it,
 * which is what makes a wrong reading obvious: you can see the words the
 * engine was looking at.
 *
 * "Table" mode swaps the rows for the reconstructed grid
 * (`../shared/table.ts`) — the same grid the CSV and Excel exports write, so
 * what you check here is what you get in the file. It starts on when the page
 * actually looks tabular, and the footer says which mode is active either way.
 */

interface LineRow {
  kind: "line";
  key: string;
  line: OcrLine;
  index: number;
}

interface CellRow {
  kind: "row";
  key: string;
  cells: string[];
  /** The line this grid row came from, for the image overlay. */
  line: OcrLine | null;
}

type Row = LineRow | CellRow;

/** A grid row, drawn as columns rather than one run of text. */
function GridRow({
  cells,
  highlighted,
}: {
  cells: string[];
  highlighted: boolean;
}) {
  return (
    <div
      className={
        "flex h-10 cursor-default items-center gap-2 rounded px-2 py-1 " +
        (highlighted
          ? "bg-item-selected text-foreground"
          : "hover:bg-item-hover")
      }
    >
      {cells.map((cell, index) => (
        <span
          key={index}
          className="min-w-0 flex-1 truncate border-l border-border pl-2 first:border-l-0 first:pl-0"
        >
          {cell || <span className="text-foreground-subtle">—</span>}
        </span>
      ))}
    </div>
  );
}

function ResultScreen({
  id,
  onExport,
  onDismiss,
}: {
  id: string;
  onExport: (id: string) => void;
  /** Close the launcher entirely (after a copy). */
  onDismiss: () => void;
}) {
  const [recognition, setRecognition] = useState<
    Recognition | null | undefined
  >(undefined);
  const [table, setTable] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState<OcrLine | null>(null);

  useEffect(() => {
    void window.api.textFromImage.get(id).then((found) => {
      setRecognition(found);
      if (found) setTable(looksTabular(found.lines));
    });
  }, [id]);

  const rows = useMemo<Row[] | null>(() => {
    if (!recognition) return recognition === undefined ? null : [];
    const scored = recognition.lines.filter(
      (line) => line.text.trim().length > 0,
    );
    const all: Row[] = table
      ? toGrid(recognition.lines).map((cells, index) => ({
          kind: "row",
          key: `row:${index}`,
          cells,
          line: scored[index] ?? null,
        }))
      : recognition.lines.map((line, index) => ({
          kind: "line",
          key: `line:${index}`,
          line,
          index,
        }));

    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((row) =>
      (row.kind === "line" ? row.line.text : row.cells.join(" "))
        .toLowerCase()
        .includes(q),
    );
  }, [recognition, table, query]);

  async function copy(
    format: "txt" | "json" | "csv",
    label: string,
  ): Promise<void> {
    await window.api.textFromImage.copyAs(id, format, {
      table,
      includeConfidence: false,
    });
    setStatus(`${label} copied`);
  }

  function copyRow(row: Row): void {
    const text = row.kind === "line" ? row.line.text : row.cells.join("\t");
    void navigator.clipboard
      .writeText(text)
      .then(() => setStatus("Line copied"));
  }

  const menu = (target: Row | null): FooterMenuItem[] => [
    ...(target
      ? [
          {
            id: "copy-row",
            label: target.kind === "line" ? "Copy This Line" : "Copy This Row",
            shortcut: "Enter",
            onSelect: () => copyRow(target),
          },
        ]
      : []),
    {
      id: "copy-text",
      label: "Copy All Text",
      shortcut: "CommandOrControl+C",
      section: "Copy",
      onSelect: () => void copy("txt", "Text"),
    },
    {
      id: "copy-json",
      label: "Copy as JSON",
      section: "Copy",
      onSelect: () => void copy("json", "JSON"),
    },
    {
      id: "copy-csv",
      label: "Copy as CSV",
      section: "Copy",
      onSelect: () => void copy("csv", "CSV"),
    },
    {
      id: "table",
      label: table ? "Show Lines" : "Reconstruct Table",
      section: "View",
      onSelect: () => setTable((value) => !value),
    },
    {
      id: "export",
      label: "Export As…",
      shortcut: "CommandOrControl+E",
      section: "View",
      onSelect: () => onExport(id),
    },
  ];

  /** The line a row stands for — a grid row's is the line it was built from. */
  const lineOf = (row: Row | null): OcrLine | null => row?.line ?? null;

  return (
    <ListScreen
      data={rows}
      getId={(row) => row.key}
      inputValue={query}
      onInputChange={setQuery}
      serverFiltered
      placeholder="Search this text…"
      virtualized
      itemHeight={() => LIST_SCREEN_ITEM_HEIGHT}
      renderItem={(row, state) =>
        row.kind === "row" ? (
          <GridRow cells={row.cells} highlighted={state.highlighted} />
        ) : (
          <ListScreen.Item
            highlighted={state.highlighted}
            icon={
              <span className="text-xs text-foreground-subtle">
                {row.index + 1}
              </span>
            }
            title={row.line.text || " "}
            badge={
              row.line.confidence == null
                ? undefined
                : formatConfidence(row.line.confidence)
            }
          />
        )
      }
      onActivate={copyRow}
      onHighlightChange={(row) => setHighlighted(lineOf(row))}
      onInputKeyDown={(event) => {
        if (event.key === "c" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          void copy("txt", "Text");
        } else if (event.key === "e" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          onExport(id);
        } else if (event.key === "Enter" && event.shiftKey) {
          event.preventDefault();
          void copy("txt", "Text").then(onDismiss);
        }
      }}
      menu={menu}
      detail={() =>
        recognition ? (
          <div className="flex h-full flex-col">
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-3">
              <ImagePreview recognition={recognition} highlight={highlighted} />
            </div>
            <div className="max-h-52 shrink-0 overflow-y-auto border-t border-border p-3">
              <RecognitionInfo recognition={recognition} />
              <div className="mt-3">
                <PaneHeading>Export</PaneHeading>
                <InfoRow
                  label="Mode"
                  value={
                    <Tag>{table ? "Table (rows × columns)" : "Lines"}</Tag>
                  }
                />
                <InfoRow
                  label="Characters"
                  value={String(toPlainText(recognition.lines).length)}
                />
              </div>
            </div>
          </div>
        ) : null
      }
      footerLabel={(visible) =>
        status ??
        (recognition === null
          ? "That recognition is gone."
          : `${visible} ${table ? "row" : "line"}${visible === 1 ? "" : "s"}`)
      }
      emptyLabel={query.trim() ? "No matching lines" : "No text in this image."}
    />
  );
}

export default ResultScreen;
