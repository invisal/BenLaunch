import { relativeAge } from "../shared/format";
import { monogramIcon, prettyLink, type QuicklinkEntry } from "../shared/types";

/**
 * The right-hand pane of the "Search Quicklinks" manager: what the highlighted
 * quicklink is and what has happened to it. A banner with its icon and name,
 * then a metadata table — link, alias, tags, the app it opens in, and the
 * created / updated / opened timestamps.
 *
 * Deliberately no web preview of the target: fetching a page for its OG image
 * would announce every quicklink the user browses past to that site, which is
 * the same reason `monogramIcon` exists instead of a favicon service.
 */

/** One `Label · value` line. Skipped entirely when there's nothing to show. */
function Row({
  label,
  value,
  title,
}: {
  label: string;
  value?: string | null;
  /** Full text for the hover tooltip, when `value` is an abbreviation of it. */
  title?: string;
}) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/50 px-3 py-1.5 text-xs last:border-b-0">
      <span className="shrink-0 text-foreground-subtle">{label}</span>
      <span className="min-w-0 truncate text-right" title={title ?? value}>
        {value}
      </span>
    </div>
  );
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
  if (!entry) {
    return (
      <div className="grid h-full place-items-center px-4 text-center text-xs text-foreground-subtle">
        No Quicklink selected
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-col items-center gap-1.5 border-b border-border px-4 py-4">
        <img
          src={entry.icon ?? monogramIcon(entry.name)}
          alt=""
          className="h-10 w-10 rounded-lg object-contain"
        />
        <span className="max-w-full truncate text-sm font-medium">
          {entry.name}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Row label="Link" value={prettyLink(entry.link)} title={entry.link} />
        <Row label="Alias" value={entry.keyword} />
        <Row label="Tags" value={entry.tags?.join(", ")} />
        <Row label="Open With" value={entry.openWith} />
        <Row
          label="Created"
          value={
            entry.createdAt === undefined
              ? "Unknown"
              : relativeAge(entry.createdAt, now)
          }
          title={
            entry.createdAt === undefined
              ? "Created before Magibar tracked this"
              : new Date(entry.createdAt).toLocaleString()
          }
        />
        <Row
          label="Last Updated"
          value={
            entry.updatedAt === undefined
              ? "Never edited"
              : relativeAge(entry.updatedAt, now)
          }
          title={
            entry.updatedAt === undefined
              ? undefined
              : new Date(entry.updatedAt).toLocaleString()
          }
        />
        <Row
          label="Opened"
          value={opened(entry, now)}
          title={
            entry.lastOpenedAt === undefined
              ? "Never opened from the launcher"
              : new Date(entry.lastOpenedAt).toLocaleString()
          }
        />
        <Row
          label="In Root Search"
          value={entry.hidden ? "Hidden" : entry.pinned ? "Pinned" : "Shown"}
        />
      </div>
    </div>
  );
}

export default QuicklinkDetail;
