import { useEffect, useMemo, useState } from "react";
import { cn } from "cnfast";
import { Form, Layout } from "@renderer/shared/ui";
import { useShortcut } from "@renderer/lib/use-shortcut";
import {
  formatBytes,
  toJsonDocument,
  toPlainText,
  toTableRows,
} from "../shared/format.ts";
import { looksTabular } from "../shared/table.ts";
import {
  ALWAYS_TABULAR,
  BINARY_FORMATS,
  EXPORT_FORMATS,
  type ExportFormat,
  type Recognition,
} from "../shared/types";
import { Tag } from "./parts.tsx";

/**
 * "Export As…" — pick a format, pick a destination, see what you'll get.
 *
 * The preview is the point of this screen. Converting a scan to a spreadsheet
 * is the step where an OCR app is most likely to quietly hand you something
 * wrong, so the exact text (or the exact grid) that will be written is shown
 * first, produced by the same `../shared/format.ts` functions the main-process
 * exporters call — not a re-implementation of them.
 *
 * Built on the shared `Layout` + `Form` + `Layout.Footer` the other in-launcher
 * forms use (Create Quicklink, custom window layouts), so it looks and keys
 * like the rest of the app.
 */

/** The format picker: one card per format, arrow-key and click navigable. */
function FormatPicker({
  value,
  onChange,
}: {
  value: ExportFormat;
  onChange: (format: ExportFormat) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Format" className="flex gap-1.5">
      {EXPORT_FORMATS.map((format) => (
        <button
          key={format.id}
          type="button"
          role="radio"
          aria-checked={format.id === value}
          onClick={() => onChange(format.id)}
          className={cn(
            "flex-1 rounded border px-2 py-2 text-xs font-medium transition-colors",
            format.id === value
              ? "border-foreground-subtle bg-item-selected text-foreground"
              : "border-border text-foreground-subtle hover:bg-item-hover hover:text-foreground",
          )}
        >
          <span className="block truncate">{format.label}</span>
          <span className="mt-0.5 block text-[10px] font-normal opacity-70">
            .{format.extension}
          </span>
        </button>
      ))}
    </div>
  );
}

/** The grid preview, drawn as an actual table so columns are visibly columns. */
function GridPreview({ rows }: { rows: string[][] }) {
  return (
    <table className="w-full table-fixed border-collapse text-xs">
      <tbody>
        {rows.slice(0, 12).map((row, rowIndex) => (
          <tr key={rowIndex} className="border-b border-border last:border-b-0">
            {row.map((cell, cellIndex) => (
              <td
                key={cellIndex}
                className="truncate border-r border-border px-1.5 py-1 last:border-r-0"
                title={cell}
              >
                {cell || <span className="text-foreground-subtle">—</span>}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ExportScreen({
  id,
  onDone,
}: {
  id: string;
  /** Leave the screen — Escape, or after a successful export. */
  onDone: () => void;
}) {
  const [recognition, setRecognition] = useState<
    Recognition | null | undefined
  >(undefined);
  const [format, setFormat] = useState<ExportFormat>("txt");
  const [table, setTable] = useState(false);
  const [includeConfidence, setIncludeConfidence] = useState(false);
  const [path, setPath] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    void window.api.textFromImage.get(id).then((found) => {
      setRecognition(found);
      if (found) setTable(looksTabular(found.lines));
    });
  }, [id]);

  // The suggested filename carries the format's extension, so it has to follow
  // the format rather than being picked once. A path the user chose themselves
  // is left alone — `saved` is cleared here too, since a changed format means
  // the previous file is no longer what this form would write.
  useEffect(() => {
    setSaved(null);
    void window.api.textFromImage.suggestPath(id, format).then(setPath);
  }, [id, format]);

  const tabular = ALWAYS_TABULAR.includes(format) || table;

  const preview = useMemo(() => {
    if (!recognition) return null;
    if (format === "csv") {
      return {
        kind: "grid" as const,
        rows: toTableRows(recognition.lines, { includeConfidence }),
      };
    }
    if (BINARY_FORMATS.includes(format)) {
      return tabular
        ? {
            kind: "grid" as const,
            rows: toTableRows(recognition.lines, { includeConfidence }),
          }
        : { kind: "text" as const, text: toPlainText(recognition.lines) };
    }
    if (format === "json") {
      return {
        kind: "text" as const,
        text: JSON.stringify(
          toJsonDocument(recognition, { table: tabular, includeConfidence }),
          null,
          2,
        ),
      };
    }
    return { kind: "text" as const, text: toPlainText(recognition.lines) };
  }, [recognition, format, tabular, includeConfidence]);

  /** Roughly what a text export will weigh. Not shown for the binary formats,
   *  where the text is only part of what gets written. */
  const size = useMemo(
    () =>
      preview?.kind === "text" && !BINARY_FORMATS.includes(format)
        ? new Blob([preview.text]).size
        : null,
    [preview, format],
  );

  async function choosePath(): Promise<void> {
    const picked = await window.api.textFromImage.chooseExportPath(id, format);
    if (picked) {
      setPath(picked);
      setSaved(null);
    }
  }

  async function save(): Promise<void> {
    if (busy || !path) return;
    setBusy(true);
    setError(null);
    try {
      const result = await window.api.textFromImage.exportAs(id, {
        format,
        table: tabular,
        includeConfidence,
        path,
      });
      if (result.ok) {
        setSaved(result.path);
      } else if (!result.cancelled) {
        setError(result.error);
      }
    } finally {
      setBusy(false);
    }
  }

  useShortcut({
    Escape: onDone,
    "CommandOrControl+Enter": busy ? undefined : () => void save(),
  });

  const details = EXPORT_FORMATS.find((entry) => entry.id === format);

  return (
    <Layout>
      <Layout.Header title="Export Recognized Text" onBack={onDone} />
      <Layout.Content className="p-4">
        {recognition === null ? (
          <p className="text-sm text-foreground-subtle">
            That recognition is gone.
          </p>
        ) : (
          <Form labelWidth={96} controlWidth={420}>
            <Form.Field label="Format" description={details?.description}>
              <FormatPicker value={format} onChange={setFormat} />
            </Form.Field>

            <Form.Field
              label="Save to"
              error={error ?? undefined}
              description={
                size == null ? undefined : `About ${formatBytes(size)}`
              }
            >
              <Form.Trigger onClick={() => void choosePath()}>
                {path || "Choose a location…"}
              </Form.Trigger>
            </Form.Field>

            <Form.Switch
              label={
                ALWAYS_TABULAR.includes(format)
                  ? "Reconstruct table columns (always, for this format)"
                  : "Reconstruct table columns"
              }
              checked={tabular}
              disabled={ALWAYS_TABULAR.includes(format)}
              onCheckedChange={setTable}
            />
            <Form.Switch
              label="Include per-line confidence"
              checked={includeConfidence}
              onCheckedChange={setIncludeConfidence}
            />

            <Form.Field
              label="Preview"
              description={
                preview?.kind === "grid"
                  ? `${preview.rows.length} row${preview.rows.length === 1 ? "" : "s"} × ${preview.rows[0]?.length ?? 0} column${preview.rows[0]?.length === 1 ? "" : "s"}`
                  : "The first part of the file, exactly as it will be written."
              }
            >
              <div className="max-h-56 overflow-auto rounded border border-border bg-input p-2">
                {preview == null ? (
                  <span className="text-xs text-foreground-subtle">
                    Loading…
                  </span>
                ) : preview.kind === "grid" ? (
                  <GridPreview rows={preview.rows} />
                ) : (
                  <pre className="whitespace-pre-wrap wrap-break-word text-xs">
                    {preview.text.slice(0, 4000)}
                  </pre>
                )}
              </div>
            </Form.Field>
          </Form>
        )}
      </Layout.Content>
      <Layout.Footer>
        <Layout.Footer.Left>
          <Layout.Footer.Button shortcut="Escape" onClick={onDone}>
            {saved ? "Done" : "Cancel"}
          </Layout.Footer.Button>
          {saved && (
            <Layout.Footer.Button
              onClick={() => void window.api.textFromImage.reveal(saved)}
            >
              Show in Folder
            </Layout.Footer.Button>
          )}
        </Layout.Footer.Left>
        <Layout.Footer.Right>
          {saved ? (
            <Layout.Footer.Label>Saved to {saved}</Layout.Footer.Label>
          ) : (
            <Layout.Footer.Label>
              <Tag>{details?.label}</Tag>
            </Layout.Footer.Label>
          )}
          <Layout.Footer.Button
            variant="primary"
            shortcut="CommandOrControl+Enter"
            loading={busy}
            loadingLabel="Exporting…"
            disabled={!path || recognition == null}
            onClick={() => void save()}
          >
            {saved ? "Export Again" : "Export"}
          </Layout.Footer.Button>
        </Layout.Footer.Right>
      </Layout.Footer>
    </Layout>
  );
}

export default ExportScreen;
