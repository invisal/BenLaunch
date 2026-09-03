/**
 * Shared, evaluator-agnostic cleanup applied to every query before the
 * evaluators see it. Only touches *framing* — the words people wrap around a
 * query regardless of what kind it is:
 *
 *  - question lead-ins — "what is …", "calculate …"
 *  - a trailing "=", "equals" or "?"
 *  - runs of whitespace
 *
 * Everything domain-specific (spoken operators → `+`, `dollars` → `USD`, …)
 * belongs in the evaluator that cares — see `evaluators/<name>/normalize.ts`.
 */

/** Question lead-ins people type before a query. */
const LEAD_IN = /^(?:what'?s|what\s+is|calculate|compute)\s+/i

/** A trailing "=", "equals" or "?" — "2 + 2 =", "5 * 5 equals", "time in tokyo?". */
const TRAILING = /\s*(?:=|equals)?\s*\??\s*$/i

export function normalize(raw: string): string {
  return raw
    .trim()
    .replace(LEAD_IN, '')
    .replace(TRAILING, '')
    .replace(/\s+/g, ' ')
    .trim()
}
