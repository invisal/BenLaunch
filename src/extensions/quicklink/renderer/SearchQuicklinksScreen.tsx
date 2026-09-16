import { useCallback, useEffect, useMemo, useState } from "react";
import { Footer, ListScreen } from "@renderer/shared/ui";
import type { FooterMenuItem } from "@renderer/shared/ui";
import type { Route } from "@renderer/screens/launcher/router/types";
import {
  monogramIcon,
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
 * "Search Quicklinks" — the central place to browse, open and manage the
 * collection, pushed onto the launcher's navigation stack by the `ql:__search`
 * command. A master/detail screen: names on the left, everything known about
 * the highlighted one in `QuicklinkDetail` on the right (so the rows here stay
 * icon + name — the link lives in the pane, not squeezed into a 240px column).
 *
 * Typing searches by name (plus keyword and tags, the same things the launcher
 * matches on); Ctrl+P opens the tag filter, which narrows the list to one tag.
 * Enter opens the highlighted quicklink; everything else — Open With, Pin,
 * Edit, Duplicate, Hide, Copy, Delete — is the Ctrl+K menu, built from the
 * same `./menu-items` the launcher's own action panel uses.
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

  const visible = useMemo(
    () =>
      tag === null
        ? items
        : (items ?? []).filter((ql) => ql.tags?.includes(tag)),
    [items, tag],
  );

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

  const menu = (ql: QuicklinkEntry | null): FooterMenuItem[] =>
    ql ? quicklinkMenuItems(ql, host(ql)) : [createQuicklinkItem(host(null))];

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

  return (
    <ListScreen
      data={visible}
      getId={(ql) => ql.id}
      getSearchText={(ql) =>
        [ql.name, ql.keyword ?? "", ...(ql.tags ?? [])].join(" ")
      }
      placeholder="Search Quicklinks..."
      renderItem={(ql, { highlighted }) => (
        <ListScreen.Item
          highlighted={highlighted}
          icon={ql.icon ?? monogramIcon(ql.name)}
          title={ql.name}
          badge={ql.hidden ? "Hidden" : ql.pinned ? "📌" : undefined}
        />
      )}
      onActivate={open}
      menu={menu}
      detail={(ql) => <QuicklinkDetail entry={ql} now={now} />}
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
      emptyLabel={
        tag === null
          ? "No Quicklinks yet. Create one to get started."
          : `Nothing tagged ${tag}.`
      }
      noMatchLabel="No matching Quicklinks."
    />
  );
}

export default SearchQuicklinksScreen;
