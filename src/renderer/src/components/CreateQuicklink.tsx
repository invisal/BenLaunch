import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { cn } from "cnfast";
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
   * only when it already looks like a URL or path.
   */
  seed?: string;
  onCancel: () => void;
  onCreated: (name: string) => void;
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

function CreateQuicklink({ seed, onCancel, onCreated }: CreateQuicklinkProps) {
  const seededLink = seed && looksLikeLink(seed.trim()) ? seed.trim() : "";

  const [link, setLink] = useState(seededLink);
  const [name, setName] = useState("");
  const [nameEdited, setNameEdited] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [icon, setIcon] = useState("");
  const [openWith, setOpenWith] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [apps, setApps] = useState<OpenWithApp[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const linkRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let live = true;
    void window.api.openWithApps().then((list) => {
      if (live) setApps(list);
    });
    return () => {
      live = false;
    };
  }, []);

  const effectiveName = nameEdited ? name : name || nameFromLink(link);
  const host = hostOf(link);

  const previewIcon = useMemo(() => {
    const trimmed = icon.trim();
    if (trimmed) return trimmed;
    return monogramIcon(effectiveName || link || "Quicklink");
  }, [icon, effectiveName, link]);

  function insertIntoLink(token: string): void {
    const el = linkRef.current;
    const start = el?.selectionStart ?? link.length;
    const end = el?.selectionEnd ?? link.length;
    const next = link.slice(0, start) + token + link.slice(end);
    setLink(next);
    requestAnimationFrame(() => {
      el?.focus();
      const caret = start + token.length;
      el?.setSelectionRange(caret, caret);
    });
  }

  async function pickPath(type: "file" | "directory"): Promise<void> {
    const path = await window.api.pickQuicklinkPath(type);
    if (path) setLink(path);
  }

  function commitTag(): void {
    const [tag] = normalizeTags([tagDraft]);
    if (tag && !tags.includes(tag)) setTags([...tags, tag]);
    setTagDraft("");
  }

  function draft(): QuicklinkDraft {
    const allTags = normalizeTags([...tags, tagDraft]);
    return {
      link: link.trim(),
      name: (effectiveName || "").trim(),
      keyword: keyword.trim() || undefined,
      icon: icon.trim() || undefined,
      openWith: openWith || undefined,
      tags: allTags.length ? allTags : undefined,
    };
  }

  async function save(): Promise<void> {
    if (saving) return;
    const d = draft();
    const problem = validateDraft(d);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    const result = await window.api.createQuicklink(d);
    setSaving(false);
    if (result.ok) onCreated(result.name);
    else setError(result.error);
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
        <span className="text-sm font-medium">Create Quicklink</span>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        <Row label="Link">
          <div className="relative">
            <textarea
              ref={linkRef}
              autoFocus
              rows={3}
              value={link}
              onChange={(e) => setLink(e.target.value)}
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
              onChange={(e) => {
                setNameEdited(true);
                setName(e.target.value);
              }}
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
                        value={icon}
                        onChange={(e) => setIcon(e.target.value)}
                        placeholder="Emoji or image URL"
                        spellCheck={false}
                        className={inputClass}
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={!host}
                          onClick={() => host && setIcon(`https://${host}/favicon.ico`)}
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
                          onClick={() => setIcon("")}
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
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Optional — e.g. g"
            spellCheck={false}
            className={inputClass}
          />
        </Row>

        <Row label="Open With">
          <AppPicker
            apps={apps}
            value={openWith}
            onChange={setOpenWith}
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
            {tags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 rounded bg-item-selected px-1.5 py-0.5 text-xs"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => setTags(tags.filter((t) => t !== tag))}
                  className="text-foreground-subtle hover:text-foreground"
                >
                  ×
                </button>
              </span>
            ))}
            <input
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  commitTag();
                } else if (e.key === "Backspace" && !tagDraft && tags.length) {
                  setTags(tags.slice(0, -1));
                }
              }}
              onBlur={commitTag}
              placeholder={tags.length ? "" : "Optional — press Enter to add"}
              className="min-w-[8ch] flex-1 bg-transparent text-sm outline-none placeholder:text-foreground-subtle"
            />
          </div>
        </Row>

        {error && <p className="pl-[104px] text-xs text-red-400">{error}</p>}
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-border px-4 py-2 text-xs text-foreground-subtle [-webkit-app-region:drag]">
        <span>Esc to go back</span>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className={cn(
            "flex items-center gap-2 rounded px-2 py-1 [-webkit-app-region:no-drag]",
            saving
              ? "text-foreground-subtle"
              : "bg-item-selected text-foreground hover:bg-item-hover",
          )}
        >
          {saving ? "Saving…" : "Save Quicklink"}
          <kbd className="rounded border border-border px-1.5 py-0.5 font-sans">
            {formatShortcut("CommandOrControl+Enter")}
          </kbd>
        </button>
      </div>
    </div>
  );
}

export default CreateQuicklink;
