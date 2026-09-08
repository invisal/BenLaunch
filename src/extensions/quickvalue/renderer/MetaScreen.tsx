import { useEffect, useState } from "react";
import { Form, Layout } from "@renderer/shared/ui";
import { useShortcut } from "@renderer/lib/use-shortcut";
import { DEFAULT_CODE } from "../shared/default-code";

/**
 * The metadata for a QuickValue — name, description, "expose as command" — as a
 * screen pushed onto the launcher's navigation stack (not a framed window). The
 * code lives in its own window (`CodeScreen`), opened by the "Code" row, which
 * persists the metadata first (with `DEFAULT_CODE` on create) so the editor has
 * a real id to save against.
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
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [exposed, setExposed] = useState(true);
  const [loaded, setLoaded] = useState(id === null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (id === null) return;
    let cancelled = false;
    void window.api.quickValue.get(id).then((def) => {
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
    const saved = await window.api.quickValue.save({
      id: id ?? undefined,
      name: name.trim(),
      description: description.trim() || undefined,
      // Seed code only on create; on edit, omit it so the code window wins.
      code: id === null ? DEFAULT_CODE : undefined,
      exposed,
    });
    return saved.id;
  }

  async function saveAndClose(): Promise<void> {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await persist();
      onDone();
    } finally {
      setBusy(false);
    }
  }

  async function saveAndEditCode(): Promise<void> {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const savedId = await persist();
      // Opens the standalone CodeMirror window (see QuickValueSource.execute).
      void window.api.execute(`qv:edit:${savedId}`, "");
      onDone();
    } finally {
      setBusy(false);
    }
  }

  useShortcut({
    Escape: onDone,
    "CommandOrControl+Enter": () => void saveAndClose(),
  });

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2 [-webkit-app-region:drag]">
        <button
          type="button"
          onClick={onDone}
          title="Back — Esc"
          className="rounded px-1.5 py-0.5 text-foreground-subtle hover:bg-item-hover [-webkit-app-region:no-drag]"
        >
          ←
        </button>
        <span className="text-sm font-medium">
          {id === null ? "Create QuickValue" : name || "Edit QuickValue"}
        </span>
      </div>

      <div className="min-h-0 flex-1">
        <Layout>
          <Layout.Content>
            {!loaded ? (
              <p className="text-sm text-foreground-subtle">Loading…</p>
            ) : (
              <Form>
                <Form.Field
                  label="Name"
                  description="What you see and type when searching the launcher."
                >
                  <Form.Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Node stars"
                    autoFocus
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
                  />
                </Form.Field>

                <Form.Field
                  label="Code"
                  description="Runs in a background Node process. Opens in the editor window."
                >
                  <Form.Trigger
                    onClick={() => void saveAndEditCode()}
                    disabled={busy || !name.trim()}
                  >
                    TypeScript
                  </Form.Trigger>
                </Form.Field>

                <Form.Switch
                  label="Expose as a launcher command"
                  checked={exposed}
                  onCheckedChange={setExposed}
                />
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
                onClick={() => void saveAndClose()}
              >
                Save
              </Layout.Footer.Button>
            </Layout.Footer.Right>
          </Layout.Footer>
        </Layout>
      </div>
    </div>
  );
}

export default MetaScreen;
