import { create, all, type Unit } from 'mathjs'

/**
 * The `mathjs` instance for the math evaluator.
 *
 * Its expression parser cannot execute arbitrary JS (no property access, no
 * `Function`), and since v11 the meta-functions that could widen the surface
 * (`import`, `createUnit`, …) are not reachable from an expression. We disable
 * them on the instance too, for defence in depth.
 */
const mathjs = create(all, { number: 'number' })

// Capture the real evaluator before neutering the meta-functions, so we keep a
// working reference while making `import(...)` etc. throw if ever reached.
const evaluateExpr = mathjs.evaluate.bind(mathjs)
mathjs.import(
  Object.fromEntries(
    ['import', 'createUnit', 'simplify', 'derivative', 'resolve'].map((name) => [
      name,
      () => {
        throw new Error(`${name} is disabled`)
      },
    ]),
  ),
  { override: true },
)

export type EvalResult =
  | { kind: 'number'; value: number }
  | { kind: 'unit'; value: Unit }

/**
 * Parses and evaluates `expression`. Returns `null` when it does not parse, or
 * resolves to something that is not an inline answer (a non-finite number, a
 * boolean, a function, a complex number, a matrix).
 */
export function tryEvaluate(expression: string): EvalResult | null {
  let result: unknown
  try {
    result = evaluateExpr(expression)
  } catch {
    return null
  }

  if (typeof result === 'number') {
    return Number.isFinite(result) ? { kind: 'number', value: result } : null
  }
  if (mathjs.isUnit(result)) {
    return { kind: 'unit', value: result }
  }
  return null
}

export { mathjs }
