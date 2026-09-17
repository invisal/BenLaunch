import { useEffect, useState } from "react";
import { cn } from "cnfast";
import { Combobox } from "@base-ui/react/combobox";
import { Form, Layout } from "@renderer/shared/ui";
import { useShortcut } from "@renderer/lib/use-shortcut";
import { WIDGET_TEMPLATES, getWidgetTemplate, type WidgetTemplate } from "../shared/templates";

/** Shared sizing for `Form.Input` / `Form.TextArea` — tighter than the
 *  default so this form's fields match Create Quicklink's. */
const inputPadding = "px-2.5 py-1.5 text-[13px]";

/** Selected-item indicator inside the template list. */
function CheckIcon() {
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
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/** Trigger's dropdown affordance — rotates when the popup is open. */
function ChevronDownIcon({ className }: { className?: string }) {
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
      className={cn("shrink-0 transition-transform", className)}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/**
 * A searchable, theme-matched replacement for a native `<select>` — same
 * building blocks as Quicklink's `AppPicker` ("Open With"). Only meaningful on
 * create: picking a template seeds the code the Widget starts with, plus (for
 * anything but "From Scratch") the Name/Description fields below.
 */
function TemplatePicker({
  value,
  onChange,
}: {
  value: WidgetTemplate;
  onChange: (template: WidgetTemplate) => void;
}) {
  return (
    <Combobox.Root
      items={WIDGET_TEMPLATES}
      value={value}
      onValueChange={(template: WidgetTemplate | null) => template && onChange(template)}
    >
      <Combobox.Trigger
        autoFocus
        className={cn(
          "group flex w-full items-center gap-2 rounded border border-border bg-input",
          "px-2.5 py-1.5 text-left text-[13px] outline-none focus:border-foreground-subtle",
        )}
      >
        <span className="min-w-0 flex-1 truncate">
          <Combobox.Value>
            {(template: WidgetTemplate | null) => template?.name ?? "Choose a template"}
          </Combobox.Value>
        </span>
        <ChevronDownIcon className="text-foreground-subtle group-data-[popup-open]:rotate-180" />
      </Combobox.Trigger>

      <Combobox.Portal>
        <Combobox.Positioner sideOffset={6} collisionPadding={10} className="z-50">
          <Combobox.Popup
            className={cn(
              "flex max-h-[min(18rem,var(--available-height))] w-[var(--anchor-width)] flex-col overflow-hidden",
              "rounded-md border border-border bg-popover text-sm text-foreground shadow-lg outline-none",
            )}
          >
            <div className="border-b border-border p-1">
              <Combobox.Input
                placeholder="Search templates…"
                className="w-full bg-transparent px-1.5 py-1 text-[13px] outline-none placeholder:text-foreground-subtle"
              />
            </div>
            <Combobox.List className="flex flex-col gap-0.5 overflow-y-auto p-1">
              {(template: WidgetTemplate) => (
                <Combobox.Item
                  key={template.id}
                  value={template}
                  className={cn(
                    "flex cursor-default items-center gap-2 rounded px-2 py-1.5 outline-none",
                    "data-[highlighted]:bg-item-selected",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{template.name}</span>
                  <Combobox.ItemIndicator className="shrink-0 text-foreground-subtle">
                    <CheckIcon />
                  </Combobox.ItemIndicator>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

/**
 * The metadata for a Widget — name, description, "expose as command" — as a
 * screen pushed onto the launcher's navigation stack (not a framed window). The
 * code lives in its own window (`CodeScreen`).
 *
 * Create mode is deliberately minimal: Template, Name and Description. There's
 * no Code row or Expose switch yet — a new Widget is always exposed, and Save
 * drops you straight into the code editor window with the picked template's
 * code already in it. The Expose switch and the "edit code" row only appear
 * once the Widget exists.
 *
 * On edit we deliberately never send `code` back on save — the store keeps the
 * existing code when a draft omits it — so saving here can't clobber an edit
 * made in the code window.
 */
function MetaScreen({
  id,
  onDone,
}: {
  /** `null` when creating. */
  id: string | null;
  /** Return to the list (the adapter also reloads it). */
  onDone: () => void;
}) {
  const isCreate = id === null;
  const [template, setTemplate] = useState(() => getWidgetTemplate(undefined));
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [exposed, setExposed] = useState(true);
  const [loaded, setLoaded] = useState(isCreate);
  const [busy, setBusy] = useState(false);

  /** Picking a template also seeds Name/Description — "From Scratch" has
   *  no real name of its own, so it clears them instead. */
  function pickTemplate(next: WidgetTemplate): void {
    setTemplate(next);
    setName(next.id === "blank" ? "" : next.name);
    setDescription(next.id === "blank" ? "" : next.description);
  }

  useEffect(() => {
    if (isCreate) return;
    let cancelled = false;
    void window.api.widget.get(id).then((def) => {
      if (cancelled || !def) return;
      setName(def.name);
      setDescription(def.description ?? "");
      setExposed(def.exposed);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  /** Persist the metadata (keeping any existing code) and return the id. */
  async function persist(): Promise<string> {
    const saved = await window.api.widget.save({
      id: id ?? undefined,
      name: name.trim(),
      description: description.trim() || undefined,
      // Seed code only on create; on edit, omit it so the code window wins.
      code: isCreate ? template.code : undefined,
      // New Widgets are always exposed; the switch only exists on edit.
      exposed: isCreate ? true : exposed,
    });
    return saved.id;
  }

  /**
   * Save. On create this hands off to the code editor window (a new Widget has
   * nothing but boilerplate code, so the next step is always to write it); on
   * edit it just returns to the list.
   */
  async function save(): Promise<void> {
    await saveThen(isCreate);
  }

  /** Persist, optionally open the code window, then return to the list. */
  async function saveThen(openCode: boolean): Promise<void> {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const savedId = await persist();
      if (openCode) {
        // Opens the standalone CodeMirror window (see WidgetSource.execute).
        void window.api.execute(`widget:edit:${savedId}`, "");
      }
      onDone();
    } finally {
      setBusy(false);
    }
  }

  useShortcut({
    Escape: onDone,
    "CommandOrControl+Enter": () => void save(),
  });

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      <Layout>
        <Layout.Header
          title={isCreate ? "Create Widget" : name || "Edit Widget"}
          onBack={onDone}
        />
        <Layout.Content className="p-4">
          {!loaded ? (
            <p className="text-sm text-foreground-subtle">Loading…</p>
          ) : (
            <Form labelWidth={90} controlWidth={420} className="mt-0 gap-3">
              {isCreate && (
                <Form.Field label="Template" description={template.description}>
                  <TemplatePicker value={template} onChange={pickTemplate} />
                </Form.Field>
              )}

              <Form.Field
                label="Name"
                description="What you see and type when searching the launcher."
              >
                <Form.Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Node stars"
                  autoFocus={!isCreate}
                  className={inputPadding}
                />
              </Form.Field>

              <Form.Field
                label="Description"
                description="Optional. A note to yourself — not shown in the launcher."
              >
                <Form.TextArea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What this value is, where it comes from"
                  className={inputPadding}
                />
              </Form.Field>

              {!isCreate && (
                <>
                  <Form.Field
                    label="Code"
                    description="Runs in a background Node process. Opens in the editor window."
                  >
                    <Form.Trigger
                      onClick={() => void saveThen(true)}
                      disabled={busy || !name.trim()}
                      className={inputPadding}
                    >
                      TypeScript
                    </Form.Trigger>
                  </Form.Field>

                  <Form.Switch
                    label="Expose as a launcher command"
                    checked={exposed}
                    onCheckedChange={setExposed}
                  />
                </>
              )}
            </Form>
          )}
        </Layout.Content>

        <Layout.Footer>
          <Layout.Footer.Left>
            <Layout.Footer.Button shortcut="Escape" onClick={onDone}>
              Cancel
            </Layout.Footer.Button>
          </Layout.Footer.Left>

          <Layout.Footer.Right>
            <Layout.Footer.Button
              variant="primary"
              shortcut="CommandOrControl+Enter"
              loading={busy}
              loadingLabel="Saving…"
              disabled={!name.trim()}
              onClick={() => void save()}
            >
              {isCreate ? "Create & Edit Code" : "Save"}
            </Layout.Footer.Button>
          </Layout.Footer.Right>
        </Layout.Footer>
      </Layout>
    </div>
  );
}

export default MetaScreen;
