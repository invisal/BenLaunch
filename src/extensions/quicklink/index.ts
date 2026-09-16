import { app, clipboard, dialog, shell, type BrowserWindow } from "electron";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { Extension } from "@core/base";
import { listOpenWithApps } from "@main/sources/apps/open-with";
import type { ActionDefinition } from "@main/types";
import { fetchFavicon } from "./main/favicon";
import {
  fillMissingIcons,
  isDuplicate,
  parseRaycastJson,
  toDraft,
  toRaycast,
  type ImportSummary,
} from "./main/transfer";
import {
  prettyLink,
  type QuicklinkCreateResult,
  type QuicklinkDraft,
} from "./shared/types";
import {
  QuicklinkStore,
  expandDynamic,
  hasPlaceholder,
  isWebTarget,
  monogramIcon,
  parseArgument,
  resolveLink,
  type Quicklink,
} from "./main/store";

/** Ids of the built-in management actions this source also provides. */
const EDIT_ACTION_ID = "ql:__edit";
const CREATE_ACTION_ID = "ql:__create";
const SEARCH_ACTION_ID = "ql:__search";
const IMPORT_ACTION_ID = "ql:__import";
const EXPORT_ACTION_ID = "ql:__export";

/**
 * The launcher-window state a modal file dialog needs: a parent to hang the
 * sheet off, and the blur-to-hide suppression so the launcher doesn't vanish
 * behind it. Owned by `main/index.ts` and handed over when the IPC is wired.
 */
export interface QuicklinkDialogHost {
  getLauncherWindow: () => BrowserWindow | null;
  setSuppressAutoHide: (value: boolean) => void;
}

/**
 * User-defined quicklinks (`ql:` ids) — named shortcuts to a URL, optionally with
 * a `{query}` placeholder that the typed argument is substituted into. This is a
 * query-driven source: `provide` looks at the current query so the result can
 * show a live preview of the URL that will open, but the action id stays stable
 * (`ql:<id>`) so usage-ranking still works. The argument is re-parsed from the
 * query at execution time.
 */
export class QuicklinkSource extends Extension {
  private readonly store = new QuicklinkStore({ dir: app.getPath("userData") });
  private dialogs: QuicklinkDialogHost | null = null;

  constructor() {
    super("ql");
  }

  /** Lets Import/Export open a file dialog parented to the launcher window. */
  useDialogs(host: QuicklinkDialogHost): void {
    this.dialogs = host;
  }

  init(): void {
    this.store.list();
  }

  refresh(): void {
    this.store.reload();
  }

  provide(query: string): ActionDefinition[] {
    const definitions = this.store
      .list()
      .map((link) => this.toDefinition(link, query));
    definitions.push(
      {
        action: {
          id: CREATE_ACTION_ID,
          title: "Create Quicklink",
          subtitle: "Add a shortcut to a URL, file, or folder",
          icon: "➕",
          type: "command",
        },
        run: () => {},
      },
      {
        action: {
          id: SEARCH_ACTION_ID,
          title: "Search Quicklinks",
          subtitle: "Browse, open and manage your quicklinks",
          icon: "🔎",
          type: "command",
        },
        run: () => {},
      },
      {
        action: {
          id: IMPORT_ACTION_ID,
          title: "Import Quicklinks",
          subtitle: "Add quicklinks from a Raycast JSON file",
          icon: "📥",
          type: "command",
        },
        run: () => {},
      },
      {
        action: {
          id: EXPORT_ACTION_ID,
          title: "Export Quicklinks",
          subtitle: "Save your quicklinks as a Raycast JSON file",
          icon: "📤",
          type: "command",
        },
        run: () => {},
      },
      {
        action: {
          id: EDIT_ACTION_ID,
          title: "Edit Quicklinks",
          subtitle: "Open quicklinks.json in your editor",
          icon: "🔗",
          type: "command",
        },
        run: () => {
          void shell.openPath(this.store.filePath());
        },
      },
    );
    return definitions;
  }

  /** Persist a quicklink from the Create form; surfaces validation errors to the renderer. */
  create(draft: QuicklinkDraft): QuicklinkCreateResult {
    try {
      const entry = this.store.add(draft);
      return { ok: true, name: entry.name };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Could not save.",
      };
    }
  }

  /** Apply an Edit-form draft to an existing quicklink; surfaces validation errors. */
  update(id: string, draft: QuicklinkDraft): QuicklinkCreateResult {
    try {
      const entry = this.store.update(id, draft);
      return { ok: true, name: entry.name };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Could not save.",
      };
    }
  }

  /** The quicklink `id`, for the renderer's Edit / Duplicate form. */
  get(id: string): Quicklink | undefined {
    return this.store.get(id);
  }

  /** Every quicklink, for the "Search Quicklinks" manager screen. */
  list(): Quicklink[] {
    return this.store.list();
  }

  /**
   * Pick a Raycast quicklinks JSON file and merge it in. Returns the summary, or
   * `null` if the user cancelled. Throws a user-facing message when the file
   * can't be read or isn't the array the format calls for.
   */
  private async importFromFile(): Promise<ImportSummary | null> {
    const parent = this.dialogs?.getLauncherWindow() ?? null;
    const options = {
      title: "Import Quicklinks",
      properties: ["openFile"] as Array<"openFile">,
      filters: [{ name: "JSON", extensions: ["json"] }],
    };

    this.dialogs?.setSuppressAutoHide(true);
    let path: string | undefined;
    try {
      const picked = parent
        ? await dialog.showOpenDialog(parent, options)
        : await dialog.showOpenDialog(options);
      if (picked.canceled) return null;
      path = picked.filePaths[0];
    } finally {
      this.dialogs?.setSuppressAutoHide(false);
    }
    if (!path) return null;

    let text: string;
    try {
      text = await readFile(path, "utf8");
    } catch {
      throw new Error("That file could not be read.");
    }

    const parsed = parseRaycastJson(text);
    if (!parsed) throw new Error("That file isn't a JSON array of quicklinks.");

    const apps = await listOpenWithApps();
    const drafts = parsed.entries.map((entry) => toDraft(entry, apps));

    // An entry with no `iconName` gets its site's favicon, like the Create form
    // does. Only for the ones that will actually be stored — re-importing a
    // file you already have shouldn't hit the network at all.
    const existing = this.store.list();
    await fillMissingIcons(
      drafts.filter((draft) => !isDuplicate(draft, existing)),
      fetchFavicon,
    );

    const summary = this.store.addMany(drafts, isDuplicate);
    return { ...summary, invalid: summary.invalid + parsed.invalid };
  }

  /**
   * Run an import/export and report it in a message box — the launcher is on its
   * way out by the time either finishes, so there's nowhere in-app to show the
   * result. A cancelled dialog (`null`) says nothing; a failure reports itself
   * rather than dying silently in the console.
   */
  private async runTransfer<T>(
    run: () => Promise<T | null>,
    describe: (result: T) => { message: string; detail: string },
  ): Promise<void> {
    try {
      const result = await run();
      if (result === null) return;
      const { message, detail } = describe(result);
      await dialog.showMessageBox({ type: "info", message, detail });
    } catch (error) {
      await dialog.showMessageBox({
        type: "error",
        message: "Quicklinks",
        detail:
          error instanceof Error ? error.message : "Something went wrong.",
      });
    }
  }

  /** Write every quicklink to a Raycast-format JSON file. Null if cancelled. */
  private async exportToFile(): Promise<string | null> {
    const parent = this.dialogs?.getLauncherWindow() ?? null;
    const options = {
      title: "Export Quicklinks",
      defaultPath: "quicklinks.json",
      filters: [{ name: "JSON", extensions: ["json"] }],
    };

    this.dialogs?.setSuppressAutoHide(true);
    let path: string | undefined;
    try {
      const picked = parent
        ? await dialog.showSaveDialog(parent, options)
        : await dialog.showSaveDialog(options);
      if (picked.canceled) return null;
      path = picked.filePath;
    } finally {
      this.dialogs?.setSuppressAutoHide(false);
    }
    if (!path) return null;

    const apps = await listOpenWithApps();
    const payload = this.store.list().map((link) => toRaycast(link, apps));
    try {
      await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    } catch {
      throw new Error("That file could not be written.");
    }
    return path;
  }

  /**
   * Subtitle for `actionId` with `argument` substituted in — what the launcher's
   * argument chip shows live as the user types, so the row previews the URL that
   * Enter will actually open.
   */
  preview(actionId: string, argument: string): string | null {
    const link = this.store
      .list()
      .find((entry) => `ql:${entry.id}` === actionId);
    if (!link) return null;
    const resolved = expandDynamic(resolveLink(link.link, argument));
    return `Open ${prettyLink(resolved)}`;
  }

  /** Delete the quicklink `id`. */
  remove(id: string): void {
    this.store.remove(id);
  }

  /** Pin or unpin the quicklink `id`. */
  setPinned(id: string, pinned: boolean): void {
    this.store.setPinned(id, pinned);
  }

  /** Hide the quicklink `id` from the root list, or reveal it. */
  setHidden(id: string, hidden: boolean): void {
    this.store.setHidden(id, hidden);
  }

  /**
   * Run a quicklink or the built-in "Edit Quicklinks" action. `argument` is the
   * text typed into the launcher's argument chip; when set it *is* the
   * `{query}` value, so the alias-prefix parsing is skipped. `openWithOverride`
   * comes from the Ctrl+K menu's "Open With" rows: a path forces that app,
   * an empty string forces the system default (ignoring the link's saved
   * `openWith`), and `undefined` uses whatever the link was saved with.
   */
  async execute(
    actionId: string,
    query: string,
    argument?: string,
    openWithOverride?: string,
  ): Promise<void> {
    if (actionId === CREATE_ACTION_ID) {
      this.ctx.navigate("quicklink-create", { seed: query });
      return;
    }

    if (actionId === SEARCH_ACTION_ID) {
      this.ctx.navigate("quicklink-search");
      return;
    }

    if (actionId === EDIT_ACTION_ID) {
      await shell.openPath(this.store.filePath());
      return;
    }

    if (actionId === IMPORT_ACTION_ID) {
      await this.runTransfer(
        () => this.importFromFile(),
        (summary) => {
          const parts = [`Added ${summary.added}`];
          if (summary.duplicates)
            parts.push(`skipped ${summary.duplicates} duplicate`);
          if (summary.invalid) parts.push(`${summary.invalid} unusable`);
          return {
            message: "Import complete",
            detail: `${parts.join(", ")}.`,
          };
        },
      );
      return;
    }

    if (actionId === EXPORT_ACTION_ID) {
      await this.runTransfer(
        () => this.exportToFile(),
        (path) => ({ message: "Quicklinks exported", detail: path }),
      );
      return;
    }

    const link = this.store
      .list()
      .find((entry) => `ql:${entry.id}` === actionId);
    if (!link) return;

    const withArgument = resolveLink(
      link.link,
      argument ?? parseArgument(query, link),
    );
    const needsClipboard = /\{\s*clipboard\s*\}/i.test(withArgument);
    const target = expandDynamic(withArgument, {
      clipboard: needsClipboard ? await clipboard.readText() : undefined,
    });

    // "Open With" a specific app: hand it the target as an argument. On macOS
    // `openWith` is a `.app` bundle (a directory) — not directly executable —
    // so it has to be launched via `open -a`, unlike Windows' `.exe` path.
    const openWith =
      openWithOverride === undefined ? link.openWith : openWithOverride;
    if (openWith && existsSync(openWith)) {
      const arg = target.replace(/^file:\/\//i, "");
      const [cmd, args] =
        process.platform === "darwin"
          ? ["open", ["-a", openWith, arg]]
          : [openWith, [arg]];
      execFile(cmd, args, (error) => {
        if (error)
          console.error(
            `[quicklinks] Failed to open ${target} with ${openWith}:`,
            error,
          );
      });
      return;
    }

    if (isWebTarget(target)) {
      await shell.openExternal(target);
    } else {
      const error = await shell.openPath(target.replace(/^file:\/\//i, ""));
      if (error)
        console.error(`[quicklinks] Failed to open ${target}: ${error}`);
    }
  }

  private toDefinition(link: Quicklink, query: string): ActionDefinition {
    const takesArgument = hasPlaceholder(link.link);
    const argument = parseArgument(query, link);
    // Preview only — the real open re-resolves with live clipboard/uuid values.
    const resolved = expandDynamic(resolveLink(link.link, argument));

    let subtitle: string;
    if (!takesArgument) {
      subtitle = prettyLink(link.link);
    } else if (argument) {
      subtitle = `Open ${prettyLink(resolved)}`;
    } else {
      // Show the target with the placeholder collapsed to an ellipsis, e.g.
      // "www.google.com/search?q=…", so it reads as a real destination.
      subtitle = prettyLink(link.link).replace(/\{[^}]*\}/g, "…");
    }

    return {
      action: {
        id: `ql:${link.id}`,
        title: link.name,
        subtitle,
        icon: link.icon ?? monogramIcon(link.name),
        type: "quicklink",
        ...(takesArgument ? { takesArgument: true } : {}),
        ...(link.keyword ? { keyword: link.keyword } : {}),
        ...(link.tags?.length ? { tags: link.tags } : {}),
        ...(link.pinned ? { pinned: true } : {}),
        ...(link.hidden ? { hidden: true } : {}),
      },
      run: () => {
        void this.execute(`ql:${link.id}`, query);
      },
    };
  }
}
