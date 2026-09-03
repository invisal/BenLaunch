import type { CalcToken, CalcTokenKind } from "../../../../../shared/types";

/**
 * Tailwind classes per token kind. Numbers carry the weight; operators and
 * punctuation recede; units / functions / constants keep a faint accent from the
 * `--color-syntax-*` theme vars (see index.css).
 */
const CLASS: Record<CalcTokenKind, string> = {
  number: "font-semibold text-foreground",
  operator: "text-foreground-subtle",
  paren: "text-foreground-subtle",
  punct: "text-foreground-subtle",
  function: "text-syntax-function",
  constant: "text-syntax-constant",
  unit: "text-syntax-unit",
  whitespace: "",
};

/**
 * Renders a normalized calculator expression with syntax highlighting.
 * `white-space: pre` keeps the whitespace tokens exact and on one line — the
 * container handles overflow.
 */
function ExpressionTokens({ tokens }: { tokens: CalcToken[] }) {
  return (
    <span className="whitespace-pre">
      {tokens.map((token, index) => (
        <span key={index} className={CLASS[token.kind]}>
          {token.text}
        </span>
      ))}
    </span>
  );
}

export default ExpressionTokens;
