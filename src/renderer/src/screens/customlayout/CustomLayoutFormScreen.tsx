import { useEffect, useState } from "react";
import { cn } from "cnfast";
import { Form, Layout } from "@renderer/shared/ui";
import { useShortcut } from "@renderer/lib/use-shortcut";
import type { CustomLayoutDraft, DisplayPreviewInfo } from "@shared/types";
import { LayoutPreview } from "./LayoutPreview";
import { POSITIONS, PositionGlyph } from "./PositionGlyph";

/**
 * Design one custom window layout — name, size, offset, anchor — as a screen
 * pushed onto the launcher's navigation stack (the same place Create Quicklink
 * and the Widget metadata form live). Serves create, edit and duplicate,
 * like `CreateQuicklink`.
 *
 * Two panes: the live preview on the left, the controls on the right. The
 * sidebar is the tight one — see the height budget on `<aside>` below.
 */

const DEFAULT_DRAFT: CustomLayoutDraft = {
  name: "",
  position: "top-left",
  widthPercent: null,
  heightPercent: null,
  offsetXPercent: 0,
  offsetYPoints: 0,
  useGap: true,
};

function CustomLayoutFormScreen({
  editId,
  duplicateId,
  onCancel,
  onSaved,
}: {
  /** Edit this existing layout in place — Save writes back to it. */
  editId?: string;
  /** Seed every field from this layout, but Save creates a new one. */
  duplicateId?: string;
  onCancel: () => void;
  onSaved: (name: string) => void;
}) {
  const [draft, setDraft] = useState<CustomLayoutDraft>(DEFAULT_DRAFT);
  const [display, setDisplay] = useState<DisplayPreviewInfo | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadId = editId ?? duplicateId ?? null;

  useEffect(() => {
    void window.api.getDisplayInfo().then(setDisplay);
  }, []);

  // `RouteStackOutlet` keys its `<Activity>` entries on `index:name`, so
  // Edit A → back → Edit B re-uses this component instance. Everything derived
  // from `loadId` has to be reset here, or B would render A's geometry.
  useEffect(() => {
    if (loadId === null) {
      setDraft(DEFAULT_DRAFT);
      setLoaded(true);
      return;
    }
    setDraft(DEFAULT_DRAFT);
    setLoaded(false);
    let cancelled = false;
    void window.api.customLayout.get(loadId).then((def) => {
      if (cancelled || !def) return;
      setDraft({ ...def, name: duplicateId ? `${def.name} Copy` : def.name });
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [loadId, duplicateId]);

  function set<K extends keyof CustomLayoutDraft>(
    key: K,
    value: CustomLayoutDraft[K],
  ): void {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  const name = draft.name.trim();

  async function save(): Promise<void> {
    if (!name || busy) return;
    setBusy(true);
    try {
      // `id` is omitted for create *and* duplicate, so the store mints a fresh
      // slug instead of overwriting the layout we copied from.
      await window.api.customLayout.save({ ...draft, name, id: editId });
      onSaved(name);
    } finally {
      setBusy(false);
    }
  }

  useShortcut({
    Escape: onCancel,
    "CommandOrControl+Enter": !name || busy ? undefined : () => void save(),
  });

  const heading = editId
    ? draft.name || "Edit Command"
    : duplicateId
      ? "Duplicate Command"
      : "Create Command";

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
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

      <div className="min-h-0 flex-1">
        <Layout>
          {/* `Layout.Content` defaults to `p-6 overflow-y-auto`; the panes own
              their own padding and the sidebar owns the only scroller.
              `overflow-y-hidden` (not `overflow-hidden`) is what actually
              overrides the default — tailwind-merge treats `overflow` and
              `overflow-y` as separate groups, so the latter would survive. */}
          <Layout.Content className="flex min-h-0 overflow-y-hidden p-0">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col border-r border-border p-3">
              <LayoutPreview draft={draft} display={display} />
            </div>

            {/* Height budget: the launcher is a fixed 640×420 and can't resize,
                which leaves 339px inside this pane. The form measures 318px —
                only ~5px spare, and that is what pays for the `h-8` position
                grid. It is why the rows sit on `gap-1.5` and the text controls
                on `py-1`; anything added here has to find its space first.
                `overflow-y-auto` is the graceful fallback for an OS text-scale
                bump, not somewhere a default setup should land. */}
            <aside className="flex w-[248px] min-h-0 shrink-0 flex-col overflow-y-auto px-3 py-2">
              {!loaded ? (
                <p className="text-xs text-foreground-subtle">Loading…</p>
              ) : (
                <Form variant="stacked" className="gap-1.5" onSubmit={() => void save()}>
                  <Form.Field label="Name">
                    <Form.Input
                      value={draft.name}
                      onChange={(e) => set("name", e.target.value)}
                      placeholder="Command Name"
                      autoFocus
                      className="px-2 py-1"
                    />
                  </Form.Field>

                  <Form.Field label="Size">
                    <div className="flex gap-1.5">
                      <PercentOrAutoInput
                        label="W"
                        value={draft.widthPercent}
                        onChange={(v) => set("widthPercent", v)}
                      />
                      <PercentOrAutoInput
                        label="H"
                        value={draft.heightPercent}
                        onChange={(v) => set("heightPercent", v)}
                      />
                    </div>
                  </Form.Field>

                  <Form.Field label="Offset">
                    <div className="flex gap-1.5">
                      <NumberInput
                        label="X"
                        unit="%"
                        value={draft.offsetXPercent}
                        onChange={(v) => set("offsetXPercent", v)}
                      />
                      <NumberInput
                        label="Y"
                        unit="pt"
                        value={draft.offsetYPoints}
                        onChange={(v) => set("offsetYPoints", v)}
                      />
                    </div>
                  </Form.Field>

                  <Form.Switch
                    size="sm"
                    label="Use preferred gap setting"
                    checked={draft.useGap}
                    onCheckedChange={(checked) => set("useGap", checked)}
                  />

                  <Form.Field label="Position">
                    {/* Spans the column: the cells share the width evenly and
                        each button fills its cell, so the row reads as one grid
                        rather than three small glyphs adrift in wide cells. */}
                    <div className="grid grid-cols-3 gap-1.5">
                      {POSITIONS.map((position) => (
                        <button
                          key={position}
                          type="button"
                          onClick={() => set("position", position)}
                          className={cn(
                            "flex h-8 w-full items-center justify-center rounded border",
                            draft.position === position
                              ? "border-foreground bg-item-selected"
                              : "border-border hover:bg-item-hover",
                          )}
                          title={position}
                        >
                          <PositionGlyph
                            position={position}
                            selected={draft.position === position}
                          />
                        </button>
                      ))}
                    </div>
                  </Form.Field>
                </Form>
              )}
            </aside>
          </Layout.Content>

          <Layout.Footer>
            <Layout.Footer.Left>
              <Layout.Footer.Button shortcut="Escape" onClick={onCancel}>
                Cancel
              </Layout.Footer.Button>
              <Layout.Footer.Label>
                {display
                  ? `${display.label} · ${display.width} × ${display.height}`
                  : ""}
              </Layout.Footer.Label>
            </Layout.Footer.Left>

            <Layout.Footer.Right>
              <Layout.Footer.Button
                variant="primary"
                shortcut="CommandOrControl+Enter"
                loading={busy}
                loadingLabel="Saving…"
                disabled={!name}
                onClick={() => void save()}
              >
                {editId ? "Save Changes" : "Create"}
              </Layout.Footer.Button>
            </Layout.Footer.Right>
          </Layout.Footer>
        </Layout>
      </div>
    </div>
  );
}

/**
 * Shared shell for the two compound unit inputs — `[label] [value] [unit]` in
 * one bordered box, matching `Form.Input`'s tokens at a tighter height.
 *
 * The field holds the text you are typing in local state rather than being
 * driven straight off the number. Half-finished entries — "-", "33.", "" — are
 * not numbers yet, and rendering the parsed value back over them would delete
 * the keystroke that produced them: you could never type a negative offset or a
 * decimal. `commit` still fires per keystroke (the preview updates live) but
 * only for text that parses; the draft is dropped on blur, so the field then
 * snaps to whatever was actually stored.
 */
function UnitInput({
  label,
  unit,
  text,
  placeholder,
  commit,
}: {
  label: string;
  unit: string;
  /** Canonical rendering of the current value, shown whenever not mid-edit. */
  text: string;
  placeholder?: string;
  /** Called on every keystroke. Ignore anything that isn't a value yet. */
  commit: (raw: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1 rounded border border-border bg-input px-1.5 py-1">
      <span className="text-xs text-foreground-subtle">{label}</span>
      <input
        value={draft ?? text}
        placeholder={placeholder}
        inputMode="decimal"
        onChange={(e) => {
          setDraft(e.target.value);
          commit(e.target.value);
        }}
        onBlur={() => setDraft(null)}
        className="min-w-0 flex-1 bg-transparent text-right text-xs outline-none placeholder:text-foreground-subtle"
      />
      <span className="text-xs text-foreground-subtle">{unit}</span>
    </div>
  );
}

/**
 * A percentage that also accepts "Auto" (stored as `null`) — the width/height
 * axes. Auto shows as an empty field with an "Auto" placeholder rather than the
 * literal word, so typing into it starts a number instead of appending to one.
 */
function PercentOrAutoInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <UnitInput
      label={label}
      unit="%"
      text={value == null ? "" : String(value)}
      placeholder="Auto"
      commit={(raw) => {
        const trimmed = raw.trim();
        if (trimmed === "" || trimmed.toLowerCase() === "auto") {
          onChange(null);
          return;
        }
        const n = Number(trimmed);
        if (Number.isFinite(n)) onChange(Math.min(100, Math.max(0, n)));
      }}
    />
  );
}

/** A plain number with a unit suffix — the offset axes, which may go negative. */
function NumberInput({
  label,
  unit,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <UnitInput
      label={label}
      unit={unit}
      text={String(value)}
      placeholder="0"
      commit={(raw) => {
        const trimmed = raw.trim();
        // "" means the user is clearing the field to retype — treat it as 0
        // without fighting them for the empty box (the draft keeps it empty).
        if (trimmed === "") {
          onChange(0);
          return;
        }
        const n = Number(trimmed);
        if (Number.isFinite(n)) onChange(n);
      }}
    />
  );
}

export default CustomLayoutFormScreen;
