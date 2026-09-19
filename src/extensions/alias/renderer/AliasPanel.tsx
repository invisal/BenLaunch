import { useEffect, useRef, useState } from "react";
import { Footer } from "@renderer/shared/ui";
import { useShortcut } from "@renderer/lib/use-shortcut";

interface AliasPanelProps {
  actionId: string;
  title: string;
  icon?: string;
  /** The alias already set for this action, if any. */
  current?: string;
  onClose: () => void;
}

/**
 * The content of the "Set/Change Alias" row's `panel` (see `renderer/context-menu.tsx`)
 * — a real text input, unlike the Hotkey row's key-combo capture: an alias is
 * free-form text rather than a key combo, and trying to fit that into the
 * menu's own search-filtered list (an earlier version of this accumulated
 * keystrokes into the row's own label) meant fighting the menu's search box
 * instead of just using a normal input. Rendered inside `Footer.Menu`'s own
 * popup chrome — no border/shadow/positioning of its own, and no Escape
 * handling: the popup's own capture-phase listener already routes Escape to
 * `onClose` before it reaches this input.
 *
 * There's no separate "Remove" control: clearing the field and saving
 * removes the alias.
 */
function AliasPanel({
  actionId,
  title,
  icon,
  current,
  onClose,
}: AliasPanelProps) {
  const [value, setValue] = useState(current ?? "");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  async function save(): Promise<void> {
    if (saving) return;
    setSaving(true);
    const alias = value.trim();
    if (alias) {
      await window.api.actionAliases.set(actionId, alias);
    } else if (current) {
      await window.api.actionAliases.remove(actionId);
    }
    onClose();
  }

  useShortcut({ Enter: () => void save() });

  const isImageIcon = icon && /^(https?:|data:|file:)/.test(icon);

  return (
    <div className="flex flex-col gap-2 p-3 [-webkit-app-region:no-drag]">
      <div className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-foreground-subtle">
        {icon &&
          (isImageIcon ? (
            <img
              src={icon}
              alt=""
              className="h-3.5 w-3.5 shrink-0 object-contain"
            />
          ) : (
            <span className="shrink-0">{icon}</span>
          ))}
        <span className="truncate">
          {current ? "Change Alias" : "Set Alias"} — {title}
        </span>
      </div>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/\s/g, ""))}
        placeholder="Enter Alias…"
        spellCheck={false}
        className="w-full rounded border border-border bg-input px-2.5 py-1.5 text-sm outline-none placeholder:text-foreground-subtle focus:border-foreground-subtle"
      />
      <Footer>
        <Footer.Left>
          <Footer.Button shortcutLabel="Esc" onClick={onClose}>
            Close
          </Footer.Button>
        </Footer.Left>
        <Footer.Right>
          <Footer.Button
            variant="primary"
            shortcut="Enter"
            loading={saving}
            loadingLabel="Saving…"
            onClick={() => void save()}
          >
            Save
          </Footer.Button>
        </Footer.Right>
      </Footer>
    </div>
  );
}

export default AliasPanel;
