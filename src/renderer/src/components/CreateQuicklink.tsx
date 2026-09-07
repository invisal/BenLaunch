import { useEffect, useMemo, useRef, type KeyboardEvent } from "react";
import { cn } from "cnfast";
import { useImmer } from "use-immer";
import { Menu } from "@base-ui/react/menu";
import { Popover } from "@base-ui/react/popover";
import AppPicker from "./AppPicker";
import {
  DYNAMIC_PLACEHOLDERS,
  monogramIcon,
  normalizeTags,
  validateDraft,
  type OpenWithApp,
  type QuicklinkDraft,
} from "../../../shared/quicklink";
import { formatShortcut } from "../lib/shortcut";

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
  icon: string;
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

const isImageIcon = (icon: string): boolean => /^(https?:|data:|file:)/.test(icon);

const looksLikeLink = (text: string): boolean =>
  /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ||
  /^[~/]/.test(text) ||
  /^[a-z]:[\\/]/i.test(text) ||
  /^[^\s]+\.[a-z]{2,}(\/|$)/i.test(text);

function hostOf(link: string): string | null {
  try {
    return new URL(link.replace(/\{[^}]*\}/g, "x")).hostname || null;
  } catch {
    return null;
  }
}

function nameFromLink(link: string): string {
  const host = hostOf(link);
  const label = (host ?? "").replace(/^www\./i, "").split(".")[0] ?? "";
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : "";
}

const inputClass =
  "w-full rounded-md border border-border bg-item-hover px-2.5 py-1.5 text-sm outline-none " +
  "placeholder:text-foreground-subtle focus:border-foreground-subtle";

const iconBtnClass =
  "flex h-7 w-7 items-center justify-center rounded text-foreground-subtle hover:bg-item-hover hover:text-foreground";

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[92px_1fr] items-start gap-3">
      <span className="pt-1.5 text-right text-xs font-medium text-foreground-subtle">
        {label}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

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
    void window.api.openWithApps().then((list) => {
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
    void window.api.getQuicklink(sourceId).then((ql) => {
      if (!live) return;
      setState((d) => {
        if (ql) {
          d.link = ql.link;
          d.name = duplicateId ? `${ql.name} Copy` : ql.name;
          d.nameEdited = true;
          d.keyword = ql.keyword ?? "";
          d.icon = ql.icon ?? "";
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

  const previewIcon = useMemo(() => {
    const trimmed = state.icon.trim();
    if (trimmed) return trimmed;
    return monogramIcon(effectiveName || state.link || "Quicklink");
  }, [state.icon, effectiveName, state.link]);

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
    const path = await window.api.pickQuicklinkPath(type);
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
      icon: state.icon.trim() || undefined,
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
      ? await window.api.updateQuicklink(editId, d)
      : await window.api.createQuicklink(d);
    if (result.ok) {
      onCreated(result.name);
      return;
    }
    setState((s) => {
      s.saving = false;
      s.error = result.error;
    });
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void save();
    }
  }

  if (state.loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background text-sm text-foreground-subtle">
        Loading…
      </div>
    );
  }

  return (
    <div
      className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground"
      onKeyDown={onKeyDown}
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2 [-webkit-app-region:drag]">
        <button
          type="button"
          onClick={onCancel}
          title="Back — Esc"
          className="rounded px-1.5 py-0.5 text-foreground-subtle hover:bg-item-hover [-webkit-app-region:no-drag]"
        >
          ←
        </button>
        <span className="text-sm font-medium">{heading}</span>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        <Row label="Link">
          <div className="relative">
            <textarea
              ref={linkRef}
              autoFocus
              rows={3}
              value={state.link}
              onChange={(e) =>
                setState((d) => {
                  d.link = e.target.value;
                })
              }
              placeholder="https://example.com/search?q={query}"
              spellCheck={false}
              className={cn(inputClass, "resize-none pr-2 font-mono text-[13px] leading-relaxed")}
            />
            <div className="absolute bottom-1.5 right-1.5 flex gap-0.5">
              <Menu.Root>
                <Menu.Trigger className={iconBtnClass} title="Insert placeholder">
                  {"{ }"}
                </Menu.Trigger>
                <Menu.Portal>
                  <Menu.Positioner side="top" align="end" sideOffset={6}>
                    <Menu.Popup className="w-60 rounded-md border border-border bg-background p-1 text-sm text-foreground shadow-lg outline-none">
                      {DYNAMIC_PLACEHOLDERS.map((p) => (
                        <Menu.Item
                          key={p.token}
                          onClick={() => insertIntoLink(p.token)}
                          className="flex cursor-default flex-col rounded px-2 py-1.5 outline-none data-[highlighted]:bg-item-selected"
                        >
                          <span className="font-mono text-xs">{p.token}</span>
                          <span className="text-xs text-foreground-subtle">{p.hint}</span>
                        </Menu.Item>
                      ))}
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.Root>

              <Menu.Root>
                <Menu.Trigger className={iconBtnClass} title="Choose file or folder">
                  📁
                </Menu.Trigger>
                <Menu.Portal>
                  <Menu.Positioner side="top" align="end" sideOffset={6}>
                    <Menu.Popup className="w-44 rounded-md border border-border bg-background p-1 text-sm text-foreground shadow-lg outline-none">
                      <Menu.Item
                        onClick={() => void pickPath("file")}
                        className="cursor-default rounded px-2 py-1.5 outline-none data-[highlighted]:bg-item-selected"
                      >
                        Choose File…
                      </Menu.Item>
                      <Menu.Item
                        onClick={() => void pickPath("directory")}
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
          <p className="mt-1 text-xs text-foreground-subtle">
            Include a placeholder like{" "}
            <code className="rounded bg-item-hover px-1">{"{query}"}</code> or{" "}
            <code className="rounded bg-item-hover px-1">{"{clipboard}"}</code> to
            pass an argument or context into the link.
          </p>
        </Row>

        <Row label="Name & Icon">
          <div className="flex gap-2">
            <input
              value={effectiveName}
              onChange={(e) =>
                setState((d) => {
                  d.nameEdited = true;
                  d.name = e.target.value;
                })
              }
              placeholder="Quicklink name"
              className={inputClass}
            />
            <Popover.Root>
              <Popover.Trigger
                className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-item-hover text-lg"
                title="Change icon"
              >
                {isImageIcon(previewIcon) ? (
                  <img src={previewIcon} alt="" className="h-5 w-5 object-contain" />
                ) : (
                  <span>{previewIcon}</span>
                )}
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner side="bottom" align="end" sideOffset={6}>
                  <Popover.Popup className="w-64 rounded-md border border-border bg-background p-2 text-sm text-foreground shadow-lg outline-none">
                    <div className="flex flex-col gap-2">
                      <input
                        value={state.icon}
                        onChange={(e) =>
                          setState((d) => {
                            d.icon = e.target.value;
                          })
                        }
                        placeholder="Emoji or image URL"
                        spellCheck={false}
                        className={inputClass}
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={!host}
                          onClick={() =>
                            host &&
                            setState((d) => {
                              d.icon = `https://${host}/favicon.ico`;
                            })
                          }
                          className={cn(
                            "flex-1 rounded border border-border px-2 py-1 text-xs",
                            host
                              ? "hover:bg-item-hover"
                              : "cursor-not-allowed text-foreground-subtle",
                          )}
                        >
                          Use favicon
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setState((d) => {
                              d.icon = "";
                            })
                          }
                          className="flex-1 rounded border border-border px-2 py-1 text-xs hover:bg-item-hover"
                        >
                          Automatic
                        </button>
                      </div>
                    </div>
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
          </div>
        </Row>

        <Row label="Alias">
          <input
            value={state.keyword}
            onChange={(e) =>
              setState((d) => {
                d.keyword = e.target.value;
              })
            }
            placeholder="Optional — e.g. g"
            spellCheck={false}
            className={inputClass}
          />
        </Row>

        <Row label="Open With">
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
        </Row>

        <Row label="Tags">
          <div
            className={cn(
              inputClass,
              "flex flex-wrap items-center gap-1.5 py-1",
            )}
          >
            {state.tags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 rounded bg-item-selected px-1.5 py-0.5 text-xs"
              >
                {tag}
                <button
                  type="button"
                  onClick={() =>
                    setState((d) => {
                      d.tags = d.tags.filter((t) => t !== tag);
                    })
                  }
                  className="text-foreground-subtle hover:text-foreground"
                >
                  ×
                </button>
              </span>
            ))}
            <input
              value={state.tagDraft}
              onChange={(e) =>
                setState((d) => {
                  d.tagDraft = e.target.value;
                })
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  commitTag();
                } else if (e.key === "Backspace" && !state.tagDraft && state.tags.length) {
                  setState((d) => {
                    d.tags.pop();
                  });
                }
              }}
              onBlur={commitTag}
              placeholder={state.tags.length ? "" : "Optional — press Enter to add"}
              className="min-w-[8ch] flex-1 bg-transparent text-sm outline-none placeholder:text-foreground-subtle"
            />
          </div>
        </Row>

        {state.error && (
          <p className="pl-[104px] text-xs text-red-400">{state.error}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-border px-4 py-2 text-xs text-foreground-subtle [-webkit-app-region:drag]">
        <span>Esc to go back</span>
        <button
          type="button"
          onClick={() => void save()}
          disabled={state.saving}
          className={cn(
            "flex items-center gap-2 rounded px-2 py-1 [-webkit-app-region:no-drag]",
            state.saving
              ? "text-foreground-subtle"
              : "bg-item-selected text-foreground hover:bg-item-hover",
          )}
        >
          {state.saving ? "Saving…" : isEdit ? "Save Changes" : "Save Quicklink"}
          <kbd className="rounded border border-border px-1.5 py-0.5 font-sans">
            {formatShortcut("CommandOrControl+Enter")}
          </kbd>
        </button>
      </div>
    </div>
  );
}

export default CreateQuicklink;
