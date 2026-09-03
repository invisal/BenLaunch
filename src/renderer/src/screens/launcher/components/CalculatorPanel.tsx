import type { ReactNode } from "react";
import type { Calculation } from "../../../../../shared/types";
import ExpressionTokens from "./ExpressionTokens";

/** Text the user can select and copy, despite the launcher's global `user-select: none`. */
const SELECTABLE = "cursor-text select-text";

function Field({ label, size, children }: { label: string; size: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.08em] text-foreground-subtle">
        {label}
      </div>
      <div
        className={`${SELECTABLE} ${size} overflow-x-auto whitespace-pre scrollbar-none [&::-webkit-scrollbar]:hidden`}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * The calculator result panel — shown above the action list whenever a query
 * resolves to a `Calculation`. Labelled Expression / Result fields split by a
 * rule; both values are selectable so they can be copied by hand.
 */
function CalculatorPanel({ calculation }: { calculation: Calculation }) {
  return (
    <div className="shrink-0 px-2 pt-2">
      <div className="flex flex-col gap-3 rounded-lg bg-item-hover px-4 py-3.5">
        <Field label="Expression" size="text-[15px]">
          {calculation.tokens ? (
            <ExpressionTokens tokens={calculation.tokens} />
          ) : (
            <span className="text-foreground">{calculation.expression}</span>
          )}
        </Field>

        <div className="border-t border-border" />

        <Field label="Result" size="text-2xl font-semibold text-foreground">
          {calculation.value}
        </Field>
      </div>
    </div>
  );
}

export default CalculatorPanel;
