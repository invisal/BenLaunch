import type { ReactNode } from "react";
import { cn } from "cnfast";

/**
 * A vertical page layout for framed-window screens: a scrolling content region
 * above a footer that stays pinned to the bottom of the window.
 *
 *   <Layout>
 *     <Layout.Content>…form…</Layout.Content>
 *     <Layout.Footer>
 *       <button>Cancel</button>
 *     </Layout.Footer>
 *   </Layout>
 *
 * Drop it straight inside `WindowFrame` — it fills the height it's given. The
 * default padding on `Content` and `Footer` can be overridden with `className`
 * (conflicting Tailwind classes win over the defaults).
 */
function LayoutRoot({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      {children}
    </div>
  );
}

/** The scrolling body. */
function Content({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("min-h-0 flex-1 overflow-y-auto p-6", className)}>
      {children}
    </div>
  );
}

/** A bar pinned to the bottom of the layout, below the scrolling `Content`. */
function Footer({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-3 border-t border-border px-4 py-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

export const Layout = Object.assign(LayoutRoot, { Content, Footer });
