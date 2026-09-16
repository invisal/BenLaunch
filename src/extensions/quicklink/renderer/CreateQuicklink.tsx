import { useEffect, useRef } from "react";
import { cn } from "cnfast";
import { useImmer } from "use-immer";
import { Menu } from "@base-ui/react/menu";
import { Popover } from "@base-ui/react/popover";
import { Form, Layout, useField } from "@renderer/shared/ui";
import { useShortcut } from "@renderer/lib/use-shortcut";
import AppPicker from "./AppPicker";
import { hostOf, isImageUri, isLocalPath, originOf } from "../shared/link";
import {
  DYNAMIC_PLACEHOLDERS,
  monogramIcon,
  normalizeTags,
  validateDraft,
  type OpenWithApp,
  type QuicklinkDraft,
} from "../shared/types";

interface CreateQuicklinkProps {
  /**
   * Text from the search box when the form was opened. Pre-fills the Link field
   * only when it already looks like a URL or path. Ignored when `editId` /
   * `duplicateId` is set.
   */
  seed?: string;
  /** Edit this existing quicklink in place — Save writes back to it. */
  editId?: string;
  /** Seed every field from this quicklink, but Save creates a new one. */
  duplicateId?: string;
  onCancel: () => void;
  onCreated: (name: string) => void;
}

/**
 * The whole form as one Immer-managed object — the fields the user edits plus the
 * transient UI flags — so handlers mutate `state.x` through a single `setState`
 * recipe instead of juggling a dozen `useState` pairs.
 */
interface FormState {
  link: string;
  name: string;
  /** The name field has been typed in — stop deriving it from the link. */
  nameEdited: boolean;
  keyword: string;
  /** The user's own icon — emoji or URL. Empty means "derive it from the link". */
  icon: string;
  /** The icon field has been set explicitly — stop deriving it from the link. */
  iconEdited: boolean;
  /** The link's favicon, inlined by main as a `data:` URI. */
  fetchedIcon: string;
  /** A favicon lookup is in flight. */
  fetchingIcon: boolean;
  openWith: string;
  tags: string[];
  tagDraft: string;
  /** "Open With" candidates, loaded once. */
  apps: OpenWithApp[];
  /** Fetching an existing quicklink for Edit / Duplicate. */
  loading: boolean;
  saving: boolean;
  error: string | null;
}

const looksLikeLink = (text: string): boolean =>
  /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ||
  /^[~/]/.test(text) ||
  /^[a-z]:[\\/]/i.test(text) ||
  /^[^\s]+\.[a-z]{2,}(\/|$)/i.test(text);

/** `/Users/me/Notes/report.pdf` → `report`; `~/Downloads` → `Downloads`. */
function nameFromPath(link: string): string {
  const base =
    link
      .trim()
      .replace(/^file:\/\//i, "")
      .replace(/[\\/]+$/, "")
      .split(/[\\/]/)
      .pop() ?? "";
  // Drop a trailing extension, but keep a dotfile (".env") whole — and keep
  // the basename if that would leave nothing behind.
  return base.replace(/^(.+)\.[A-Za-z0-9]{1,8}$/, "$1") || base;
}

function nameFromLink(link: string): string {
  if (isLocalPath(link)) return nameFromPath(link);
  const host = hostOf(link);
  const label = (host ?? "").replace(/^www\./i, "").split(".")[0] ?? "";
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : "";
}

const iconBtnClass =
  "flex h-7 w-7 items-center justify-center rounded text-foreground-subtle hover:bg-item-hover hover:text-foreground";

/** Curly braces — "insert a dynamic placeholder token". */
function BracesIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1" />
      <path d="M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1" />
    </svg>
  );
}

/** Folder — "choose a file or folder". */
function FolderIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </svg>
  );
}

const inputPadding = "px-2.5 py-1.5 text-[13px]";

const linkFieldClass = cn(
  "w-full resize-none rounded border border-border bg-input pr-2",
  inputPadding,
  "font-mono text-[13px] leading-relaxed text-foreground outline-none",
  "placeholder:text-foreground-subtle focus:border-foreground-subtle",
);

const tagFieldClass = cn(
  "flex w-full flex-wrap items-center gap-1.5 rounded border border-border bg-input",
  inputPadding,
  "focus-within:border-foreground-subtle",
);

function CreateQuicklink({
  seed,
  editId,
  duplicateId,
  onCancel,
  onCreated,
}: CreateQuicklinkProps) {
  const sourceId = editId ?? duplicateId;
  const isEdit = !!editId;
  const heading = isEdit
    ? "Edit Quicklink"
    : duplicateId
      ? "Duplicate Quicklink"
      : "Create Quicklink";

  const [state, setState] = useImmer<FormState>({
    link: seed && looksLikeLink(seed.trim()) ? seed.trim() : "",
    name: "",
    nameEdited: false,
    keyword: "",
    icon: "",
    iconEdited: false,
    fetchedIcon: "",
    fetchingIcon: false,
    openWith: "",
    tags: [],
    tagDraft: "",
    apps: [],
    loading: !!sourceId,
    saving: false,
    error: null,
  });
  const linkRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let live = true;
    void window.api.quicklink.openWithApps().then((list) => {
      if (live)
        setState((d) => {
          d.apps = list;
        });
    });
    return () => {
      live = false;
    };
  }, [setState]);

  useEffect(() => {
    if (!sourceId) return;
    let live = true;
    void window.api.quicklink.getQuicklink(sourceId).then((ql) => {
      if (!live) return;
      setState((d) => {
        if (ql) {
          d.link = ql.link;
          d.name = duplicateId ? `${ql.name} Copy` : ql.name;
          d.nameEdited = true;
          d.keyword = ql.keyword ?? "";
          d.icon = ql.icon ?? "";
          d.iconEdited = true;
          d.openWith = ql.openWith ?? "";
          d.tags = ql.tags ?? [];
        }
        d.loading = false;
      });
    });
    return () => {
      live = false;
    };
  }, [sourceId, duplicateId, setState]);

  // `autoFocus` only fires on mount; Edit / Duplicate mount behind a loading
  // screen, so move focus to the Link field once the form is shown.
  useEffect(() => {
    if (!state.loading) linkRef.current?.focus();
  }, [state.loading]);

  const effectiveName = state.nameEdited
    ? state.name
    : state.name || nameFromLink(state.link);
  const host = hostOf(state.link);
  const origin = originOf(state.link);
  const localPath = isLocalPath(state.link) ? state.link.trim() : null;

  /** Like `effectiveName`: derived from the link until the user picks their own. */
  const effectiveIcon = state.iconEdited ? state.icon : state.fetchedIcon;

  // Resolve the icon in main — the CSP blocks remote images here, so whichever
  // kind it is comes back inlined as a `data:` URI. A web link uses its site's
  // favicon; a file or folder uses the icon the OS draws for it, which is how a
  // `.pdf` looks like a PDF and a folder looks like a folder.
  //
  // Keyed on the origin (not the whole link), so editing a URL's path or query
  // doesn't re-fetch, and debounced so typing doesn't fire a lookup per
  // keystroke.
  useEffect(() => {
    if (state.iconEdited) return;
    const target = origin ?? localPath;
    if (!target) {
      setState((d) => {
        d.fetchedIcon = "";
        d.fetchingIcon = false;
      });
      return;
    }
    let live = true;
    setState((d) => {
      d.fetchingIcon = true;
    });
    const timer = setTimeout(() => {
      void window.api.quicklink.icon(target).then((icon) => {
        if (!live) return;
        setState((d) => {
          d.fetchedIcon = icon ?? "";
          d.fetchingIcon = false;
        });
      });
    }, 400);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [origin, localPath, state.iconEdited, setState]);

  // Only a `data:` icon can pass the launcher's CSP, so whether an icon will
  // render is decidable here — no need to paint one and repair it on error. A
  // hand-typed http(s)/file: icon, or one carried in by an old edit, falls back.
  const displayIcon =
    effectiveIcon.trim() && !/^(https?|file):/i.test(effectiveIcon.trim())
      ? effectiveIcon.trim()
      : monogramIcon(effectiveName || state.link || "Quicklink");

  function insertIntoLink(token: string): void {
    const el = linkRef.current;
    const start = el?.selectionStart ?? state.link.length;
    const end = el?.selectionEnd ?? state.link.length;
    setState((d) => {
      d.link = d.link.slice(0, start) + token + d.link.slice(end);
    });
    requestAnimationFrame(() => {
      el?.focus();
      const caret = start + token.length;
      el?.setSelectionRange(caret, caret);
    });
  }

  async function pickPath(type: "file" | "directory"): Promise<void> {
    const path = await window.api.quicklink.pickQuicklinkPath(type);
    if (path)
      setState((d) => {
        d.link = path;
      });
  }

  function commitTag(): void {
    const [tag] = normalizeTags([state.tagDraft]);
    setState((d) => {
      if (tag && !d.tags.includes(tag)) d.tags.push(tag);
      d.tagDraft = "";
    });
  }

  function draftFromState(): QuicklinkDraft {
    const allTags = normalizeTags([...state.tags, state.tagDraft]);
    return {
      link: state.link.trim(),
      name: (effectiveName || "").trim(),
      keyword: state.keyword.trim() || undefined,
      icon: effectiveIcon.trim() || undefined,
      openWith: state.openWith || undefined,
      tags: allTags.length ? allTags : undefined,
    };
  }

  async function save(): Promise<void> {
    if (state.saving) return;
    const d = draftFromState();
    const problem = validateDraft(d);
    if (problem) {
      setState((s) => {
        s.error = problem;
      });
      return;
    }
    setState((s) => {
      s.saving = true;
      s.error = null;
    });
    const result = editId
      ? await window.api.quicklink.updateQuicklink(editId, d)
      : await window.api.quicklink.createQuicklink(d);
    if (result.ok) {
      onCreated(result.name);
      return;
    }
    setState((s) => {
      s.saving = false;
      s.error = result.error;
    });
  }

  useShortcut({
    Escape: onCancel,
    "CommandOrControl+Enter": state.saving ? undefined : () => void save(),
  });

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      <Layout>
        <Layout.Header title={heading} onBack={onCancel} />
        <Layout.Content className="p-4">
          {state.loading ? (
            <p className="text-sm text-foreground-subtle">Loading…</p>
          ) : (
            <Form labelWidth={90} controlWidth={420} className="mt-0 gap-3">
              <Form.Field label="Link">
                <LinkField
                  linkRef={linkRef}
                  value={state.link}
                  onChange={(value) =>
                    setState((d) => {
                      d.link = value;
                    })
                  }
                  onInsertToken={insertIntoLink}
                  onPickPath={(type) => void pickPath(type)}
                />
                <p className="text-[11px] text-foreground-subtle">
                  Insert{" "}
                  <code className="rounded bg-item-hover px-1">
                    {"{query}"}
                  </code>{" "}
                  or{" "}
                  <code className="rounded bg-item-hover px-1">
                    {"{clipboard}"}
                  </code>{" "}
                  to pass context into the link.
                </p>
              </Form.Field>

              <Form.Field label="Name & Icon">
                <div className="flex gap-2">
                  <Form.Input
                    value={effectiveName}
                    onChange={(e) =>
                      setState((d) => {
                        d.nameEdited = true;
                        d.name = e.target.value;
                      })
                    }
                    placeholder="Quicklink name"
                    className={inputPadding}
                  />
                  <Popover.Root>
                    <Popover.Trigger
                      className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-input text-lg"
                      title="Change icon"
                    >
                      {isImageUri(displayIcon) ? (
                        <img
                          src={displayIcon}
                          alt=""
                          className="h-5 w-5 object-contain"
                        />
                      ) : (
                        <span>{displayIcon}</span>
                      )}
                    </Popover.Trigger>
                    <Popover.Portal>
                      <Popover.Positioner
                        side="bottom"
                        align="end"
                        sideOffset={6}
                      >
                        <Popover.Popup className="w-64 rounded-md border border-border bg-popover p-2 text-sm text-foreground shadow-lg outline-none">
                          <div className="flex flex-col gap-2">
                            <Form.Input
                              // An inlined favicon is a multi-KB data: URI —
                              // never show that as editable text.
                              value={
                                state.icon.startsWith("data:") ? "" : state.icon
                              }
                              onChange={(e) =>
                                setState((d) => {
                                  d.icon = e.target.value;
                                  // Clearing the field hands the icon back to
                                  // the link's favicon.
                                  d.iconEdited = e.target.value !== "";
                                })
                              }
                              placeholder="Emoji, e.g. 🚀"
                              spellCheck={false}
                              className={inputPadding}
                            />
                            <p className="text-[11px] text-foreground-subtle">
                              {state.iconEdited
                                ? "Emoji only — a remote URL can't be shown here."
                                : state.fetchingIcon
                                  ? "Looking up the icon…"
                                  : !state.fetchedIcon
                                    ? "Type a link to pick up its icon."
                                    : host
                                      ? `Using ${host}'s icon.`
                                      : "Using this file's icon."}
                            </p>
                            <button
                              type="button"
                              onClick={() =>
                                setState((d) => {
                                  d.icon = "";
                                  d.iconEdited = false;
                                })
                              }
                              className="rounded border border-border px-2 py-1 text-xs hover:bg-item-hover"
                            >
                              Reset to automatic
                            </button>
                          </div>
                        </Popover.Popup>
                      </Popover.Positioner>
                    </Popover.Portal>
                  </Popover.Root>
                </div>
              </Form.Field>

              <Form.Field label="Alias">
                <Form.Input
                  value={state.keyword}
                  onChange={(e) =>
                    setState((d) => {
                      d.keyword = e.target.value;
                    })
                  }
                  placeholder="Optional — e.g. g"
                  spellCheck={false}
                  className={inputPadding}
                />
              </Form.Field>

              <Form.Field label="Open With">
                <AppPicker
                  apps={state.apps}
                  value={state.openWith}
                  onChange={(path) =>
                    setState((d) => {
                      d.openWith = path;
                    })
                  }
                  defaultLabel="Default browser"
                />
              </Form.Field>

              <Form.Field label="Tags">
                <TagsField
                  tags={state.tags}
                  draft={state.tagDraft}
                  onDraftChange={(value) =>
                    setState((d) => {
                      d.tagDraft = value;
                    })
                  }
                  onCommit={commitTag}
                  onRemove={(tag) =>
                    setState((d) => {
                      d.tags = d.tags.filter((t) => t !== tag);
                    })
                  }
                  onRemoveLast={() =>
                    setState((d) => {
                      d.tags.pop();
                    })
                  }
                />
              </Form.Field>

              {state.error && (
                <p className="text-center text-xs text-red-500">
                  {state.error}
                </p>
              )}
            </Form>
          )}
        </Layout.Content>

        <Layout.Footer>
          <Layout.Footer.Left>
            <Layout.Footer.Button shortcut="Escape" onClick={onCancel}>
              Cancel
            </Layout.Footer.Button>
          </Layout.Footer.Left>
          <Layout.Footer.Right>
            <Layout.Footer.Button
              variant="primary"
              shortcut="CommandOrControl+Enter"
              loading={state.saving}
              loadingLabel="Saving…"
              onClick={() => void save()}
            >
              {isEdit ? "Save Changes" : "Save Quicklink"}
            </Layout.Footer.Button>
          </Layout.Footer.Right>
        </Layout.Footer>
      </Layout>
    </div>
  );
}

/** The Link textarea plus its overlaid "insert placeholder" / "choose file"
 *  menu buttons. Wired to the enclosing `Form.Field` like `Form.TextArea`. */
function LinkField({
  linkRef,
  value,
  onChange,
  onInsertToken,
  onPickPath,
}: {
  linkRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (value: string) => void;
  onInsertToken: (token: string) => void;
  onPickPath: (type: "file" | "directory") => void;
}) {
  const field = useField();
  return (
    <div className="relative">
      <textarea
        ref={linkRef}
        id={field?.id}
        aria-describedby={field?.descriptionId}
        aria-invalid={field?.invalid || undefined}
        autoFocus
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://example.com?q={query}"
        spellCheck={false}
        className={linkFieldClass}
      />
      <div className="absolute bottom-1.5 right-1.5 flex gap-0.5">
        <Menu.Root>
          <Menu.Trigger className={iconBtnClass} title="Insert placeholder">
            <BracesIcon />
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner side="top" align="end" sideOffset={6}>
              <Menu.Popup className="w-60 rounded-md border border-border bg-popover p-1 text-sm text-foreground shadow-lg outline-none">
                {DYNAMIC_PLACEHOLDERS.map((p) => (
                  <Menu.Item
                    key={p.token}
                    onClick={() => onInsertToken(p.token)}
                    className="flex cursor-default flex-col rounded px-2 py-1.5 outline-none data-[highlighted]:bg-item-selected"
                  >
                    <span className="font-mono text-xs">{p.token}</span>
                    <span className="text-xs text-foreground-subtle">
                      {p.hint}
                    </span>
                  </Menu.Item>
                ))}
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>

        <Menu.Root>
          <Menu.Trigger className={iconBtnClass} title="Choose file or folder">
            <FolderIcon />
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner side="top" align="end" sideOffset={6}>
              <Menu.Popup className="w-44 rounded-md border border-border bg-popover p-1 text-sm text-foreground shadow-lg outline-none">
                <Menu.Item
                  onClick={() => onPickPath("file")}
                  className="cursor-default rounded px-2 py-1.5 outline-none data-[highlighted]:bg-item-selected"
                >
                  Choose File…
                </Menu.Item>
                <Menu.Item
                  onClick={() => onPickPath("directory")}
                  className="cursor-default rounded px-2 py-1.5 outline-none data-[highlighted]:bg-item-selected"
                >
                  Choose Folder…
                </Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </div>
    </div>
  );
}

/** The tag chips + draft input, styled like a `Form.Input` but multi-part.
 *  Wired to the enclosing `Form.Field` like `Form.Input`. */
function TagsField({
  tags,
  draft,
  onDraftChange,
  onCommit,
  onRemove,
  onRemoveLast,
}: {
  tags: string[];
  draft: string;
  onDraftChange: (value: string) => void;
  onCommit: () => void;
  onRemove: (tag: string) => void;
  onRemoveLast: () => void;
}) {
  const field = useField();
  return (
    <div className={tagFieldClass}>
      {tags.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-1 rounded bg-item-selected px-1.5 py-0.5 text-xs"
        >
          {tag}
          <button
            type="button"
            onClick={() => onRemove(tag)}
            className="text-foreground-subtle hover:text-foreground"
          >
            ×
          </button>
        </span>
      ))}
      <input
        id={field?.id}
        aria-describedby={field?.descriptionId}
        aria-invalid={field?.invalid || undefined}
        value={draft}
        onChange={(e) => onDraftChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            onCommit();
          } else if (e.key === "Backspace" && !draft && tags.length) {
            onRemoveLast();
          }
        }}
        onBlur={onCommit}
        placeholder={tags.length ? "" : "Optional — press Enter to add"}
        className="min-w-[8ch] flex-1 bg-transparent text-[13px] outline-none placeholder:text-foreground-subtle"
      />
    </div>
  );
}

export default CreateQuicklink;
