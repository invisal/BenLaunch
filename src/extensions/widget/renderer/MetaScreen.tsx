import { useEffect, useState } from "react";
import { Form, Layout } from "@renderer/shared/ui";
import { useShortcut } from "@renderer/lib/use-shortcut";
import { DEFAULT_CODE } from "../shared/default-code";

/** Shared sizing for `Form.Input` / `Form.TextArea` — tighter than the
 *  default so this form's fields match Create Quicklink's. */
const inputPadding = "px-2.5 py-1.5 text-[13px]";

/**
 * The metadata for a Widget — name, description, "expose as command" — as a
 * screen pushed onto the launcher's navigation stack (not a framed window). The
 * code lives in its own window (`CodeScreen`).
 *
 * Create mode is deliberately minimal: just Name and Description. There's no
 * Code row or Expose switch yet — a new Widget is always exposed, seeded with
 * `DEFAULT_CODE`, and Save drops you straight into the code editor window.
 * The Expose switch and the "edit code" row only appear once the Widget exists.
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
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [exposed, setExposed] = useState(true);
  const [loaded, setLoaded] = useState(isCreate);
  const [busy, setBusy] = useState(false);

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
      code: isCreate ? DEFAULT_CODE : undefined,
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
              <Form.Field
                label="Name"
                description="What you see and type when searching the launcher."
              >
                <Form.Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Node stars"
                  autoFocus
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
