import { useEffect, useState } from "react";
import { Detail } from "@renderer/shared/ui";
import { absoluteTime, formatBytes, relativeAge } from "@shared/format";
import { hostOf, isLocalPath } from "../shared/link";
import { displayIcon, prettyLink, type QuicklinkEntry } from "../shared/types";
import type { QuicklinkPreview } from "../shared/preview";

/**
 * The right-hand pane of the "Search Quicklinks" manager: what the highlighted
 * quicklink points at, previewed, and everything known about it underneath.
 *
 * A quicklink to a file shows the file — an image inline, a video frame or a
 * PDF's first page via the OS thumbnailer, the head of a text file, a CSV as a
 * grid, a folder as a listing — with the file card (icon, type, size) as the
 * fallback for anything that can't be drawn. Reading it is main's job
 * (`../main/preview.ts`); this only renders what comes back, since the
 * renderer has no filesystem access and the CSP only admits `data:` images.
 *
 * A quicklink to a website deliberately gets *no* web preview: fetching a page
 * for its OG image would announce every quicklink the user arrows past to that
 * site, which is the same reason `monogramIcon` exists instead of a favicon
 * service. It gets its icon, name and host instead.
 *
 * Built from the shared `Detail` parts, so this pane and every other
 * master/detail pane in the app stay the same thing in different clothes.
 */

/** How long a row stays highlighted before its file is read, in ms. */
const PREVIEW_DEBOUNCE_MS = 90;

/** Could `link` name something on disk we should try to preview at all? */
function isPreviewable(link: string): boolean {
  return isLocalPath(link) && !/\{[^}]*\}/.test(link);
}

/**
 * The preview for `link`, or `null` while one is in flight / when the link
 * isn't a path. Debounced: holding an arrow key down runs through a dozen rows
 * a second, and none of them should cost a file read. (Main caches by path +
 * mtime, so arrowing back onto a row is free.)
 */
function useFilePreview(link: string | undefined): QuicklinkPreview | null {
  const [preview, setPreview] = useState<QuicklinkPreview | null>(null);

  useEffect(() => {
    if (!link || !isPreviewable(link)) {
      setPreview(null);
      return;
    }
    let live = true;
    // Clear first: keeping the previous row's preview on screen while this
    // one loads is worse than a moment of "Reading…", because it looks like
    // an answer about the wrong file.
    setPreview(null);
    const timer = setTimeout(() => {
      void window.api.quicklink.filePreview(link).then((result) => {
        if (live) setPreview(result);
      });
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [link]);

  return preview;
}

/** Trailing note under a preview that only shows the start of something. */
function Truncated({ children }: { children: string }) {
  return (
    <div className="mt-2 border-t border-border/60 pt-1.5 text-[10px] text-foreground-subtle">
      {children}
    </div>
  );
}

/** A CSV/TSV head as a grid, first row as the header. */
function Table({ rows }: { rows: string[][] }) {
  const [header, ...body] = rows;
  return (
    <table className="w-full table-fixed border-collapse text-[11px]">
      <thead>
        <tr>
          {header.map((cell, index) => (
            <th
              key={index}
              title={cell}
              className="truncate border-b border-border px-1.5 py-1 text-left font-medium text-foreground-subtle"
            >
              {cell}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {body.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {header.map((_, cellIndex) => (
              <td
                key={cellIndex}
                title={row[cellIndex]}
                className="truncate border-b border-border/40 px-1.5 py-1"
              >
                {row[cellIndex] ?? ""}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** A folder's entries — directories first, as main sorted them. */
function FolderList({
  entries,
}: {
  entries: ReadonlyArray<{ name: string; directory: boolean }>;
}) {
  return (
    <ul className="flex w-full flex-col gap-0.5">
      {entries.map((entry) => (
        <li
          key={entry.name}
          className="flex items-center gap-2 rounded px-1 py-0.5 text-xs"
        >
          <span aria-hidden className="shrink-0 text-sm">
            {entry.directory ? "📁" : "📄"}
          </span>
          <span className="min-w-0 truncate" title={entry.name}>
            {entry.name}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The preview region for one quicklink: the file's contents when it has any we
 * can show, its card when it hasn't, and the link card for a web target.
 * Returns the `Detail.Preview` itself, since only it knows whether its content
 * wants centering (an image) or top-left alignment (text, a listing).
 */
function Preview({
  entry,
  preview,
}: {
  entry: QuicklinkEntry;
  preview: QuicklinkPreview | null;
}) {
  // Not a file at all: a website, a `spotify:` link, a `{query}` template.
  if (!isPreviewable(entry.link)) {
    return (
      <Detail.Preview>
        <Detail.Card
          icon={displayIcon(entry)}
          title={entry.name}
          subtitle={hostOf(entry.link) ?? prettyLink(entry.link)}
        />
      </Detail.Preview>
    );
  }

  if (!preview) {
    return (
      <Detail.Preview>
        <span className="text-xs text-foreground-subtle">Reading file…</span>
      </Detail.Preview>
    );
  }

  if (preview.status === "missing") {
    return (
      <Detail.Preview>
        <Detail.Card
          icon="🚫"
          tone="muted"
          title="File not found"
          subtitle={preview.path}
        />
      </Detail.Preview>
    );
  }

  if (preview.status === "unsupported") {
    return (
      <Detail.Preview>
        <Detail.Card
          icon={displayIcon(entry)}
          title={entry.name}
          subtitle={prettyLink(entry.link)}
        />
      </Detail.Preview>
    );
  }

  const { file, body } = preview;

  switch (body.type) {
    case "image":
    case "thumbnail":
      return (
        <Detail.Preview>
          <Detail.Media src={body.dataUrl} alt={file.name} />
        </Detail.Preview>
      );
    case "text":
      return (
        <Detail.Preview align="start">
          <div className="w-full">
            {/* Markdown and logs read as prose and should wrap; source code
                has meaningful columns and scrolls instead. */}
            <Detail.Text wrap={file.category === "text"}>
              {body.text}
            </Detail.Text>
            {body.truncated && (
              <Truncated>Showing the start of the file</Truncated>
            )}
          </div>
        </Detail.Preview>
      );
    case "table":
      return (
        <Detail.Preview align="start">
          <div className="w-full">
            <Table rows={body.rows} />
            {body.truncated && <Truncated>Showing the first rows</Truncated>}
          </div>
        </Detail.Preview>
      );
    case "folder":
      return (
        <Detail.Preview align="start">
          <div className="w-full">
            <FolderList entries={body.entries} />
            {body.truncated && <Truncated>Showing the first entries</Truncated>}
          </div>
        </Detail.Preview>
      );
    default:
      return (
        <Detail.Preview>
          <Detail.Card
            icon={file.icon ?? displayIcon(entry)}
            title={file.name}
            subtitle={
              file.bytes
                ? `${file.label} · ${formatBytes(file.bytes)}`
                : file.label
            }
          />
        </Detail.Preview>
      );
  }
}

/** `1,240 times` / `Once` / `Never`, plus when it last happened. */
function opened(entry: QuicklinkEntry, now: number): string {
  if (!entry.opens || entry.lastOpenedAt === undefined) return "Never";
  const when = relativeAge(entry.lastOpenedAt, now);
  return entry.opens === 1 ? when : `${when} · ${entry.opens}×`;
}

function QuicklinkDetail({
  entry,
  now,
}: {
  entry: QuicklinkEntry | null;
  /** Clock the relative timestamps are measured against, from the screen. */
  now: number;
}) {
  const preview = useFilePreview(entry?.link);

  if (!entry) return <Detail.Empty>No Quicklink selected</Detail.Empty>;

  const file = preview?.status === "ready" ? preview.file : null;

  return (
    <Detail>
      <Preview entry={entry} preview={preview} />

      <Detail.Info title={null}>
        <div className="mb-2 flex items-center gap-2">
          <img
            src={displayIcon(entry)}
            alt=""
            className="h-5 w-5 shrink-0 rounded object-contain"
          />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {entry.name}
          </span>
          {(entry.hidden || entry.pinned) && (
            <span className="shrink-0 rounded bg-item-selected px-1.5 py-0.5 text-[10px] text-foreground-subtle">
              {entry.hidden ? "Hidden" : "Pinned"}
            </span>
          )}
        </div>

        <Detail.Row
          label="Link"
          value={prettyLink(entry.link)}
          title={entry.link}
        />
        {file && (
          <Detail.Row
            label="Type"
            value={
              file.category === "folder" && file.childCount !== undefined
                ? `Folder · ${file.childCount} item${file.childCount === 1 ? "" : "s"}`
                : file.label
            }
          />
        )}
        {file && file.category !== "folder" && (
          <Detail.Row label="Size" value={formatBytes(file.bytes)} />
        )}
        {preview?.status === "ready" && preview.body.type === "image" && (
          <Detail.Row
            label="Dimensions"
            value={
              preview.body.width && preview.body.height
                ? `${preview.body.width}×${preview.body.height}`
                : undefined
            }
          />
        )}
        {file && (
          <Detail.Row
            label="Modified"
            value={relativeAge(file.modifiedAt, now)}
            title={absoluteTime(file.modifiedAt)}
          />
        )}
        <Detail.Row label="Alias" value={entry.keyword} />
        <Detail.Row label="Tags" value={entry.tags?.join(", ")} />
        <Detail.Row label="Open With" value={entry.openWith} />
        <Detail.Row
          label="Created"
          value={
            entry.createdAt === undefined
              ? "Unknown"
              : relativeAge(entry.createdAt, now)
          }
          title={
            entry.createdAt === undefined
              ? "Created before Magibar tracked this"
              : absoluteTime(entry.createdAt)
          }
        />
        <Detail.Row
          label="Last Updated"
          value={
            entry.updatedAt === undefined
              ? "Never edited"
              : relativeAge(entry.updatedAt, now)
          }
          title={
            entry.updatedAt === undefined
              ? undefined
              : absoluteTime(entry.updatedAt)
          }
        />
        <Detail.Row
          label="Opened"
          value={opened(entry, now)}
          title={
            entry.lastOpenedAt === undefined
              ? "Never opened from the launcher"
              : absoluteTime(entry.lastOpenedAt)
          }
        />
        <Detail.Row
          label="In Root Search"
          value={entry.hidden ? "Hidden" : entry.pinned ? "Pinned" : "Shown"}
        />
      </Detail.Info>
    </Detail>
  );
}

export default QuicklinkDetail;
