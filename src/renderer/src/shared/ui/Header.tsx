import type { ReactNode } from "react";
import { cn } from "cnfast";

/** Back-navigation chevron for a framed screen's header. */
function BackIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M9.5 3.5L4.5 8l5 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The bar pinned to the top of a full-page screen (Create/Edit Widget,
 * Quicklink, custom Window layout, …): a back button and a title, sitting in
 * a window drag region — the header counterpart to `Footer`.
 *
 *   <Layout>
 *     <Layout.Header title="Create Widget" onBack={onCancel} />
 *     <Layout.Content>…</Layout.Content>
 *     <Layout.Footer>…</Layout.Footer>
 *   </Layout>
 *
 * The back button is always "Back — Esc" — bind the actual key with
 * `useShortcut` in the screen, same as `Footer.Button`'s `shortcut` hint.
 */
export function Header({
  title,
  onBack,
  className,
}: {
  title: ReactNode;
  onBack: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-2 border-b border-border px-3 py-2 [-webkit-app-region:drag]",
        className,
      )}
    >
      <button
        type="button"
        onClick={onBack}
        title="Back — Esc"
        className="rounded px-1.5 py-0.5 text-foreground-subtle hover:bg-item-hover [-webkit-app-region:no-drag]"
      >
        <BackIcon />
      </button>
      <span className="text-sm font-medium">{title}</span>
    </div>
  );
}
