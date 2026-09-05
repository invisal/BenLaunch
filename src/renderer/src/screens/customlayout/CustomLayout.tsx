import { useEffect, useState } from "react";
import { cn } from "cnfast";
import type {
  AnchorPosition,
  DisplayPreviewInfo,
} from "../../../../shared/types";

const POSITIONS: AnchorPosition[] = [
  "top-left",
  "top-center",
  "top-right",
  "middle-left",
  "middle-center",
  "middle-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

/** This window has exactly one job — no list/edit screens, no routing. Cancel/Create both close it. */
const DEFAULT_DRAFT = {
  name: "",
  position: "top-left" as AnchorPosition,
  widthPercent: null as number | null,
  heightPercent: null as number | null,
  offsetXPercent: 0,
  offsetYPoints: 0,
  useGap: true,
};

function CustomLayout() {
  const [draft, setDraft] = useState(DEFAULT_DRAFT);
  const [saving, setSaving] = useState(false);
  const [display, setDisplay] = useState<DisplayPreviewInfo | null>(null);

  useEffect(() => {
    void window.api.getDisplayInfo().then(setDisplay);
  }, []);

  function set<K extends keyof typeof DEFAULT_DRAFT>(
    key: K,
    value: (typeof DEFAULT_DRAFT)[K],
  ): void {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  async function save(): Promise<void> {
    if (!draft.name.trim()) return;
    setSaving(true);
    try {
      await window.api.customLayout.save({ ...draft, name: draft.name.trim() });
      window.close();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col border-r border-border p-4">
        <div className="flex shrink-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-500">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
              <rect
                x="3"
                y="3"
                width="18"
                height="18"
                rx="5"
                fill="white"
                fillOpacity="0.15"
              />
              <path
                d="M12 8v8M8 12h8"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <h1 className="text-base font-semibold">Create Command</h1>
        </div>

        <div className="mt-3 min-h-0 flex-1 rounded-lg border border-border bg-item-hover p-2">
          <Preview draft={draft} display={display} />
        </div>

        <p className="mt-2 shrink-0 text-xs text-foreground-subtle">
          {display
            ? `${display.label} · ${display.width} × ${display.height}`
            : " "}
        </p>
      </div>

      <div className="flex w-64 min-h-0 shrink-0 flex-col gap-3 overflow-y-auto p-4">
        <Field label="Name">
          <input
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Command Name"
            className="w-full rounded border border-border bg-transparent px-2.5 py-1.5 text-xs outline-none placeholder:text-foreground-subtle"
          />
        </Field>

        <Field label="Size">
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
        </Field>

        <Field label="Offset">
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
        </Field>

        <label className="flex items-center justify-between text-xs font-medium  tracking-wide text-foreground-subtle">
          Use preferred gap settings
          {/* <Switch.Root
            checked={draft.useGap}
            onCheckedChange={(checked) => set("useGap", checked)}
            className="relative h-5 w-9 shrink-0 rounded-full bg-foreground-subtle/30 transition-colors data-checked:bg-blue-500"
          >
            <Switch.Thumb className="block h-3.5 w-3.5 rounded-full bg-foreground shadow-sm transition-transform data-checked:translate-x-4" />
          </Switch.Root> */}
          <Switch
            checked={draft.useGap}
            onChange={(checked) => set("useGap", checked)}
          />
        </label>

        <Field label="Position">
          <div className="grid grid-cols-3 gap-1.5">
            {POSITIONS.map((position) => (
              <button
                key={position}
                type="button"
                onClick={() => set("position", position)}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded border",
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
        </Field>

        <div className="mt-auto flex shrink-0 items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => window.close()}
            className="rounded border border-border px-2.5 py-1.5 text-xs hover:bg-item-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !draft.name.trim()}
            className="rounded bg-item-selected px-2.5 py-1.5 text-xs text-foreground hover:brightness-125 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Filled-rect geometry for each anchor's `PositionGlyph`, as percentages of the icon box. */
const POSITION_GLYPH_RECT: Record<
  AnchorPosition,
  { left: number; top: number; width: number; height: number }
> = {
  "top-left": { left: 8, top: 8, width: 50, height: 50 },
  "top-center": { left: 8, top: 8, width: 84, height: 34 },
  "top-right": { left: 42, top: 8, width: 50, height: 50 },
  "middle-left": { left: 8, top: 8, width: 34, height: 84 },
  "middle-center": { left: 25, top: 25, width: 50, height: 50 },
  "middle-right": { left: 58, top: 8, width: 34, height: 84 },
  "bottom-left": { left: 8, top: 42, width: 50, height: 50 },
  "bottom-center": { left: 8, top: 58, width: 84, height: 34 },
  "bottom-right": { left: 42, top: 42, width: 50, height: 50 },
};

/** Mini "screen with a highlighted window region" icon — one per anchor, sized/placed to read at a glance. */
function PositionGlyph({
  position,
  selected,
}: {
  position: AnchorPosition;
  selected: boolean;
}) {
  const { left, top, width, height } = POSITION_GLYPH_RECT[position];

  return (
    <span
      className={cn(
        "relative block h-full w-full rounded-[5px] border",
        selected ? "border-foreground/70" : "border-foreground-subtle/40",
      )}
    >
      <span
        className={cn(
          "absolute rounded-[3px]",
          selected ? "bg-foreground" : "bg-foreground-subtle",
        )}
        style={{
          left: `${left}%`,
          top: `${top}%`,
          width: `${width}%`,
          height: `${height}%`,
        }}
      />
    </span>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium tracking-wide text-foreground-subtle">
        {label}
      </div>
      {children}
    </div>
  );
}

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
    <div className="flex min-w-0 flex-1 items-center gap-1 rounded border border-border px-1.5 py-1">
      <span className="text-xs text-foreground-subtle">{label}</span>
      <input
        value={value ?? "Auto"}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw.trim().toLowerCase() === "auto" || raw.trim() === "") {
            onChange(null);
            return;
          }
          const n = Number(raw);
          if (Number.isFinite(n)) onChange(Math.min(100, Math.max(0, n)));
        }}
        className="min-w-0 flex-1 bg-transparent text-right text-xs outline-none"
      />
      <span className="text-xs text-foreground-subtle">%</span>
    </div>
  );
}

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
    <div className="flex min-w-0 flex-1 items-center gap-1  border border-border px-1.5 py-1 rounded-lg">
      <span className="text-xs text-foreground-subtle">{label}</span>
      <input
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
        className="min-w-0 flex-1 bg-transparent text-right text-xs outline-none"
      />
      <span className="text-xs text-foreground-subtle">{unit}</span>
    </div>
  );
}

/** Scaled-down live preview of the layout's rect on the primary display, matching `computeCustomRect`'s anchor math. */
function Preview({
  draft,
  display,
}: {
  draft: typeof DEFAULT_DRAFT;
  display: DisplayPreviewInfo | null;
}) {
  if (!display) return <div className="h-full w-full rounded bg-background" />;

  const widthFraction =
    draft.widthPercent != null ? draft.widthPercent / 100 : 0.6;
  const heightFraction =
    draft.heightPercent != null ? draft.heightPercent / 100 : 0.6;
  const [vAnchor, hAnchor] = draft.position.split("-") as [
    "top" | "middle" | "bottom",
    "left" | "center" | "right",
  ];

  const left =
    hAnchor === "left"
      ? 0
      : hAnchor === "right"
        ? 1 - widthFraction
        : (1 - widthFraction) / 2;
  const top =
    vAnchor === "top"
      ? 0
      : vAnchor === "bottom"
        ? 1 - heightFraction
        : (1 - heightFraction) / 2;
  const offsetXFraction = draft.offsetXPercent / 100;
  const offsetYFraction =
    display.height === 0 ? 0 : draft.offsetYPoints / display.height;

  return (
    // `aspectRatio` is the display's real proportions (not a fixed 16:9), and
    // `max-h-full max-w-full` shrinks it to fit the box like `object-fit:
    // contain` — centered by the flex parent — instead of stretching to fill
    // whatever shape the surrounding panel happens to be.
    <div className="flex h-full w-full items-center justify-center">
      <div
        className="relative max-h-full w-full max-w-full overflow-hidden rounded bg-background"
        style={{ aspectRatio: `${display.width} / ${display.height}` }}
      >
        <div
          className="absolute rounded-sm border border-foreground-subtle bg-foreground/90"
          style={{
            left: `${(left + offsetXFraction) * 100}%`,
            top: `${(top + offsetYFraction) * 100}%`,
            width: `${widthFraction * 100}%`,
            height: `${heightFraction * 100}%`,
          }}
        />
      </div>
    </div>
  );
}

export default CustomLayout;

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  className?: string;
  disabled?: boolean;
}

export function Switch({
  checked,
  onChange,
  label,
  className,
  disabled,
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent transition-colors",
        checked ? "bg-blue-500" : "bg-foreground-subtle/30",
        disabled && "cursor-not-allowed opacity-40",
        className,
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-4" : "translate-x-0",
        )}
      />
    </button>
  );
}
