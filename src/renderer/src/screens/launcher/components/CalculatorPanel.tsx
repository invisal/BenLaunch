import { cn } from "cnfast";
import type { ComponentPropsWithRef } from "react";
import type { Calculation } from "../../../../../shared/types";
import ExpressionTokens from "./ExpressionTokens";

/** Text the user can select and copy, despite the launcher's global `user-select: none`. */
const SELECTABLE = "cursor-text select-text";
const VALUE = `${SELECTABLE} overflow-x-auto whitespace-pre scrollbar-none [&::-webkit-scrollbar]:hidden`;

function Label({ children }: { children: string }) {
  return (
    <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.08em] text-foreground-subtle">
      {children}
    </div>
  );
}

interface CalculatorPanelProps extends ComponentPropsWithRef<"div"> {
  calculation: Calculation;
  highlighted: boolean;
}

/**
 * The first row of the result list whenever a query resolves to a `Calculation`.
 * Labelled Expression / Result fields split by a rule; both values are selectable
 * so they can be copied by hand. A `footnote` (currency's "Updated 2 days ago")
 * sits bottom-right of the result.
 */
function CalculatorPanel({
  calculation,
  highlighted,
  className,
  ...rest
}: CalculatorPanelProps) {
  return (
    <div
      {...rest}
      className={cn(
        "flex cursor-default flex-col gap-3 rounded-lg px-4 py-3.5",
        highlighted ? "bg-item-selected" : "bg-item-hover",
        className,
      )}
    >
      <div>
        <Label>Expression</Label>
        <div className={`${VALUE} text-[15px]`}>
          {calculation.tokens ? (
            <ExpressionTokens tokens={calculation.tokens} />
          ) : (
            <span className="text-foreground">{calculation.expression}</span>
          )}
        </div>
      </div>

      <div className="border-t border-border" />

      <div>
        <Label>Result</Label>
        <div className="flex items-end justify-between gap-3">
          <div className={`${VALUE} text-2xl font-semibold text-foreground`}>
            {calculation.value}
          </div>
          {calculation.footnote && (
            <div className="shrink-0 pb-0.5 text-[11px] text-foreground-subtle">
              {calculation.footnote}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CalculatorPanel;
