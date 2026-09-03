import type { Calculation } from "../../../../../shared/types";
import ExpressionTokens from "./ExpressionTokens";

/** Text the user can select and copy, despite the launcher's global `user-select: none`. */
const SELECTABLE = "cursor-text select-text";

function Label({ children }: { children: string }) {
  return (
    <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.08em] text-foreground-subtle">
      {children}
    </div>
  );
}

const VALUE =
  `${SELECTABLE} overflow-x-auto whitespace-pre scrollbar-none [&::-webkit-scrollbar]:hidden`;

/**
 * The calculator result panel — shown above the action list whenever a query
 * resolves to a `Calculation`. Labelled Expression / Result fields split by a
 * rule; both values are selectable so they can be copied by hand. A `footnote`
 * (e.g. currency's "Updated 2 days ago") sits bottom-right of the result.
 */
function CalculatorPanel({ calculation }: { calculation: Calculation }) {
  return (
    <div className="shrink-0 px-2 pt-2">
      <div className="flex flex-col gap-3 rounded-lg bg-item-hover px-4 py-3.5">
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
    </div>
  );
}

export default CalculatorPanel;
