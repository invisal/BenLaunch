import type { FooterMenuItem } from "@renderer/shared/ui";
import type { Route } from "@renderer/screens/launcher/router/types";
import type { OpenWithApp } from "../shared/types";

/**
 * The actions a quicklink offers, shared by the two places that offer them:
 * the launcher's Ctrl+K panel (`./context-menu`, where the target is the
 * highlighted `ql:*` row) and the "Search Quicklinks" manager
 * (`./SearchQuicklinksScreen`, where it's the highlighted list row). Both show
 * the same rows in the same order — only the plumbing behind `open`, `reload`
 * and `dismiss` differs, which is what `QuicklinkMenuHost` carries.
 */

/** What the rows need to know about the quicklink they act on. */
export interface QuicklinkMenuTarget {
  /** Store id — the action id without its `ql:` prefix. */
  id: string;
  name: string;
  pinned?: boolean;
  hidden?: boolean;
}

/** What the rows need from whichever screen is showing them. */
export interface QuicklinkMenuHost {
  /** Apps offered under "Open With". */
  apps: OpenWithApp[];
  /**
   * The text a quicklink resolves its `{query}` placeholder against, and the
   * seed for "Create Quicklink". The launcher passes its search box; the
   * manager screen has no argument to give, so it passes `""`.
   */
  query: string;
  /** Push a screen onto the launcher's navigation stack (the Create/Edit form). */
  push(route: Route): void;
  /** Re-read the quicklinks after pin/hide/delete changed one. */
  reload(): void;
  /** Close the menu's owner and get the launcher out of the way. */
  dismiss(): void;
  /** Open the quicklink the way Enter on its row would. */
  open(): void;
}

/**
 * The "Open With" row: a submenu holding the system default plus every
 * resolved app. It's a list of its own rather than a `section` inlined into
 * the menu because `host.apps` is every installed app that can take a path as
 * an argument — on Windows, every Start-Menu shortcut resolving to an `.exe`,
 * which inline would bury Pin/Edit/Delete under a hundred rows.
 */
function openWithItem(
  ql: QuicklinkMenuTarget,
  host: QuicklinkMenuHost,
): FooterMenuItem {
  // The system default is the empty path — the same "no override" the IPC call
  // already takes — so it's just the first app in the list, not its own row.
  const apps: OpenWithApp[] = [{ name: "Default App", path: "" }, ...host.apps];
  return {
    id: "open-with",
    label: "Open With",
    items: apps.map((app) => ({
      id: `ow:${app.path || "__default"}`,
      label: app.name,
      icon: app.icon,
      onSelect: () => {
        void window.api.quicklink.openQuicklinkWith(
          `ql:${ql.id}`,
          host.query,
          app.path,
        );
        host.dismiss();
      },
    })),
  };
}

/** The "Create Quicklink" row, which every menu ends up offering. */
export function createQuicklinkItem(host: QuicklinkMenuHost): FooterMenuItem {
  return {
    id: "create-quicklink",
    section: "Quicklink",
    label: "Create Quicklink",
    onSelect: () =>
      host.push({ name: "quicklink-create", payload: { seed: host.query } }),
  };
}

/** Open / Open With / manage / copy / delete, for one quicklink. */
export function quicklinkMenuItems(
  ql: QuicklinkMenuTarget,
  host: QuicklinkMenuHost,
): FooterMenuItem[] {
  return [
    {
      id: "run",
      label: "Open Quicklink",
      shortcut: "Enter",
      onSelect: host.open,
    },
    openWithItem(ql, host),
    {
      id: "pin",
      section: "Manage Quicklink",
      label: ql.pinned ? "Unpin Quicklink" : "Pin Quicklink",
      onSelect: async () => {
        await window.api.quicklink.setQuicklinkPinned(ql.id, !ql.pinned);
        host.reload();
      },
    },
    {
      id: "edit",
      section: "Manage Quicklink",
      label: "Edit Quicklink",
      onSelect: () =>
        host.push({ name: "quicklink-edit", payload: { id: ql.id } }),
    },
    {
      id: "duplicate",
      section: "Manage Quicklink",
      label: "Duplicate Quicklink",
      onSelect: () =>
        host.push({ name: "quicklink-duplicate", payload: { id: ql.id } }),
    },
    {
      id: "hide",
      section: "Manage Quicklink",
      label: ql.hidden ? "Show in Root Search" : "Hide in Root Search",
      onSelect: async () => {
        await window.api.quicklink.setQuicklinkHidden(ql.id, !ql.hidden);
        host.reload();
      },
    },
    {
      id: "copy-name",
      section: "Copy",
      label: "Copy Name",
      shortcut: "CommandOrControl+C",
      onSelect: () => void navigator.clipboard.writeText(ql.name),
    },
    {
      id: "copy-link",
      section: "Copy",
      label: "Copy Link",
      onSelect: async () => {
        const stored = await window.api.quicklink.getQuicklink(ql.id);
        if (stored) await navigator.clipboard.writeText(stored.link);
      },
    },
    createQuicklinkItem(host),
    {
      id: "delete",
      section: "Danger Zone",
      label: "Delete Quicklink",
      confirmLabel: `Click again to delete "${ql.name}"`,
      danger: true,
      onSelect: async () => {
        await window.api.quicklink.deleteQuicklink(ql.id);
        host.reload();
      },
    },
  ];
}
