import { clipboard } from "electron";
import { Extension } from "@core/base";
import type { ActionDefinition } from "@main/types";
import { HISTORY_ROUTE } from "../shared/types";
import { pinEntryId, pinRow, refreshPin, type Evaluate } from "./pins";
import { HistoryStore } from "./store";

/**
 * Calculator History (Raycast's "Calculator History" + pinned calculations).
 *
 *  - a "Calculator History" command that opens the history screen
 *    (`../screen.tsx`, route `calculator-history`)
 *  - every pinned entry as a root-list row — `pinned` so the existing root
 *    sort in `actions.ts` floats it to the top of the empty-query view, and
 *    `isDeferredSubtitle` so its value is recomputed live (`pins.ts`) only
 *    when the row actually renders
 *
 * Entries are recorded from the renderer (copy / use-as-input on the
 * calculator row) over IPC — typing alone never records. As the extension's
 * composition root it owns the `HistoryStore` (persisted through
 * `this.storage`, `<userData>/extensions/calculator-history.json`) and exposes
 * it as `store` so `index.ts` can wire the IPC to the same instance.
 *
 * `evaluate` is injected (the calculator pipeline) rather than imported, so
 * the extension doesn't reach into `@main/calculator` itself.
 */
export class CalculatorHistoryExtension extends Extension {
  readonly store: HistoryStore;

  constructor(private readonly evaluate: Evaluate) {
    super("calculator-history");
    this.store = new HistoryStore(this.storage);
  }

  init(): void {
    this.store.init();
  }

  provide(): ActionDefinition[] {
    const open: ActionDefinition = {
      action: {
        id: "calculator-history:open",
        title: "Calculator History",
        subtitle: "Search, copy, re-run and pin past calculations",
        icon: "🧮",
        type: "command",
      },
      run: () => {},
    };
    const pins = this.store.pinned().map((entry) => ({
      action: pinRow(entry),
      run: () => {},
    }));
    return [open, ...pins];
  }

  execute(actionId: string): void {
    if (actionId === "calculator-history:open") {
      this.ctx.navigate(HISTORY_ROUTE);
      return;
    }
    // A pinned row run from main (the renderer normally copies it itself, like a Widget row).
    if (pinEntryId(actionId)) {
      const value = refreshPin(this.store, this.evaluate, actionId);
      if (value) clipboard.writeText(value);
    }
  }

  requestSubtitle(actionId: string): string | undefined {
    return refreshPin(this.store, this.evaluate, actionId);
  }
}
