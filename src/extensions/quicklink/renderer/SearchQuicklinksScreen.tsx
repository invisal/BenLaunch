import { useCallback, useEffect, useMemo, useState } from "react";
import { Footer, ListScreen } from "@renderer/shared/ui";
import type { FooterMenuItem } from "@renderer/shared/ui";
import { matchAction } from "@shared/search";
import type { Route } from "@renderer/screens/launcher/router/types";
import {
  displayIcon,
  prettyLink,
  type OpenWithApp,
  type QuicklinkEntry,
} from "../shared/types";
import QuicklinkDetail from "./QuicklinkDetail";
import {
  createQuicklinkItem,
  quicklinkMenuItems,
  type QuicklinkMenuHost,
} from "./menu-items";

/** Shown in the tag filter's trigger when nothing is filtered out. */
const ALL_TAGS = "All Tags";

/**
 * Score for a quicklink whose *file name* contains the query — "invoice" for
 * `~/Documents/2026/invoice-april.pdf`. Ranked above a match anywhere else in
 * the link (a query hitting the middle of a long URL says much less) but below
 * a deliberately-typed alias, which `matchAction` scores at 100.
 */
const FILENAME_MATCH_SCORE = 8;
/** Score for a query found anywhere else in the link — a host, a path segment. */
const LINK_MATCH_SCORE = 2;

/** `https://example.com/a/b.pdf` → `b.pdf`; `C:\x\y.txt` → `y.txt`. */
function fileNameOf(link: string): string {
  const withoutQuery = link.split(/[?#]/)[0].replace(/[\\/]+$/, "");
  return withoutQuery.split(/[\\/]/).pop() ?? "";
}

/** A quicklink plus why (and how well) it matched the current query. */
interface Ranked {
  entry: QuicklinkEntry;
  score: number;
  /** The query hit the link rather than the name/alias/tags — see `renderItem`. */
  viaLink: boolean;
}

/**
 * Rank `items` against `query`, dropping what doesn't match.
 *
 * Name, alias and tags go through `matchAction` — the same fuzzy scoring the
 * launcher's own search uses, so "gh" finds "GitHub" here exactly as it does
 * at the root, and an exact alias still beats every fuzzy title hit.
 *
 * The link is matched too, but by substring rather than fuzzily: a fuzzy
 * subsequence test against a 90-character URL matches nearly any short query
 * and would flood the list with links that merely happen to contain the right
 * letters in the right order. Substring keeps a path search ("invoice",
 * "2026", "localhost:3000") precise — which is the whole point of being able
 * to search links at all.
 */
function rank(items: QuicklinkEntry[], query: string): Ranked[] {
  const trimmed = query.trim();
  if (!trimmed) {
    // No query: pinned first, then whatever the user actually opens, then
    // alphabetically — a stable order that puts the answer near the top
    // instead of showing the collection in creation order.
    return [...items]
      .sort(
        (a, b) =>
          Number(!!b.pinned) - Number(!!a.pinned) ||
          b.opens - a.opens ||
          a.name.localeCompare(b.name),
      )
      .map((entry) => ({ entry, score: 0, viaLink: false }));
  }

  const needle = trimmed.toLowerCase();
  const ranked: Ranked[] = [];

  for (const entry of items) {
    const { match, score } = matchAction(trimmed, {
      title: entry.name,
      keyword: entry.keyword,
      tags: entry.tags,
    });

    const link = entry.link.toLowerCase();
    const linkScore = !link.includes(needle)
      ? null
      : fileNameOf(link).includes(needle)
        ? FILENAME_MATCH_SCORE
        : LINK_MATCH_SCORE;

    if (!match && linkScore === null) continue;
    const best = Math.max(match ? score : -Infinity, linkScore ?? -Infinity);
    // The link is what surfaced this row whenever it out-scored the name —
    // including when the name matched too, weakly.
    ranked.push({ entry, score: best, viaLink: best === linkScore });
  }

  return ranked.sort(
    (a, b) =>
      b.score - a.score ||
      b.entry.opens - a.entry.opens ||
      a.entry.name.localeCompare(b.entry.name),
  );
}

/**
 * "Search Quicklinks" — the central place to browse, open and manage the
 * collection, pushed onto the launcher's navigation stack by the `ql:__search`
 * command. A master/detail screen: names on the left, everything known about
 * the highlighted one in `QuicklinkDetail` on the right — including a preview
 * of the file it points at, so the pane answers "is this the right one?"
 * without opening anything.
 *
 * Typing searches names, aliases and tags (fuzzily, ranked exactly as the
 * launcher's root search ranks them) *and* the link itself by substring, so a
 * quicklink is findable by the file it opens; Ctrl+P opens the tag filter,
 * which narrows the list to one tag. Enter opens the highlighted quicklink;
 * everything else — Open With, Pin, Edit, Duplicate, Hide, Copy, Delete — is
 * the Ctrl+K menu, built from the same `./menu-items` the launcher's own
 * action panel uses.
 *
 * Unlike the launcher's root list this shows hidden quicklinks too (marked
 * "Hidden"): this is the screen you'd come to to unhide one.
 */
function SearchQuicklinksScreen({
  push,
  dismiss,
}: {
  /** Push a screen onto the launcher's navigation stack (the Create/Edit form). */
  push: (route: Route) => void;
  /** Leave this screen and get the launcher out of the way, after opening a link. */
  dismiss: () => void;
}) {
  const [items, setItems] = useState<QuicklinkEntry[] | null>(null);
  const [apps, setApps] = useState<OpenWithApp[]>([]);
  /** The tag the list is narrowed to, or `null` for the whole collection. */
  const [tag, setTag] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  /** Clock the detail pane's relative ages are measured against; re-read with the list. */
  const [now, setNow] = useState(() => Date.now());

  const reload = useCallback(() => {
    setNow(Date.now());
    void window.api.quicklink.listQuicklinks().then(setItems);
  }, []);

  // Re-fetches on mount and whenever this screen returns to the top of the stack
  // (a pushed screen unmounts our Effects; React re-mounts them on the way back),
  // so an edit made in the form is reflected on the way back.
  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    let live = true;
    void window.api.quicklink.openWithApps().then((list) => {
      if (live) setApps(list);
    });
    return () => {
      live = false;
    };
  }, []);

  /** Every tag in use, for the filter menu. */
  const tags = useMemo(() => {
    const seen = new Set<string>();
    for (const ql of items ?? []) for (const t of ql.tags ?? []) seen.add(t);
    return [...seen].sort();
  }, [items]);

  // A tag that no longer exists (its last quicklink was deleted or retagged)
  // would filter the list down to nothing with no way back except Ctrl+P.
  useEffect(() => {
    if (tag && items && !tags.includes(tag)) setTag(null);
  }, [tag, tags, items]);

  // Tag filter first (it's a scope, not a search), then rank what's left.
  // Ranking happens here rather than in `ListScreen`'s built-in substring
  // filter so the order can express *how well* each row matched.
  const visible = useMemo(() => {
    if (items == null) return null;
    const scoped =
      tag === null ? items : items.filter((ql) => ql.tags?.includes(tag));
    return rank(scoped, query);
  }, [items, tag, query]);

  function open(ql: QuicklinkEntry): void {
    // No argument: a `{query}` link opens its origin rather than searching for
    // whatever happened to be typed in this screen's search box.
    void window.api.execute(`ql:${ql.id}`, "");
    dismiss();
  }

  // `query: ""` — a quicklink opened from here takes no argument, and a new one
  // starts from a blank name rather than from whatever is in the search box.
  const host = (ql: QuicklinkEntry | null): QuicklinkMenuHost => ({
    apps,
    query: "",
    push,
    reload,
    dismiss,
    open: () => ql && open(ql),
  });

  const menu = (row: Ranked | null): FooterMenuItem[] =>
    row
      ? quicklinkMenuItems(row.entry, host(row.entry))
      : [createQuicklinkItem(host(null))];

  const filterItems: FooterMenuItem[] = [
    {
      id: "__all",
      label: ALL_TAGS,
      icon: tag === null ? "✓" : undefined,
      onSelect: () => setTag(null),
    },
    ...tags.map((name) => ({
      id: `tag:${name}`,
      section: "Tags",
      label: name,
      icon: tag === name ? "✓" : undefined,
      onSelect: () => setTag(name),
    })),
  ];

  const count = visible?.length ?? 0;
  const searching = query.trim() !== "";

  return (
    <ListScreen
      data={visible}
      getId={(row) => row.entry.id}
      inputValue={query}
      onInputChange={setQuery}
      // `rank` above has already filtered and ordered the rows; re-filtering
      // them against the raw query text would undo link matching.
      serverFiltered
      placeholder="Search Quicklinks..."
      renderItem={(row, { highlighted }) => (
        <ListScreen.Item
          highlighted={highlighted}
          icon={displayIcon(row.entry)}
          title={row.entry.name}
          // The rows stay icon + name — the link belongs in the detail pane,
          // not squeezed into a 240px column — except when the link is *why*
          // this row is here, where hiding it would make the result look like
          // a mistake.
          subtitle={row.viaLink ? prettyLink(row.entry.link) : undefined}
          badge={
            row.entry.hidden ? "Hidden" : row.entry.pinned ? "📌" : undefined
          }
        />
      )}
      onActivate={(row) => open(row.entry)}
      menu={menu}
      detail={(row) => <QuicklinkDetail entry={row?.entry ?? null} now={now} />}
      customFooter={({ inputRef }) => (
        <>
          <Footer.Label>
            {count} Quicklink{count === 1 ? "" : "s"}
            {tag === null ? "" : ` tagged ${tag}`}
          </Footer.Label>
          {/* `finalFocus` puts the cursor back in the search box when the
              filter closes, so picking a tag and carrying on typing works. */}
          <Footer.Menu
            label={tag === null ? "Filter" : `Filter: ${tag}`}
            shortcut="CommandOrControl+P"
            placeholder="Filter by tag…"
            items={filterItems}
            finalFocus={inputRef}
          />
        </>
      )}
      // `serverFiltered` means `ListScreen` can no longer tell "nothing here"
      // apart from "this query matched nothing" — both collapse to an empty
      // `data` — so pick the right message here.
      emptyLabel={
        searching
          ? "No matching Quicklinks."
          : tag === null
            ? "No Quicklinks yet. Create one to get started."
            : `Nothing tagged ${tag}.`
      }
    />
  );
}

export default SearchQuicklinksScreen;
