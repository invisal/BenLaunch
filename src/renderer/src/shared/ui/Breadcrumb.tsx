import { Children, Fragment, isValidElement, type ReactNode } from "react";
import { cn } from "cnfast";

/**
 * A compact breadcrumb trail, e.g. for the window title bar (`WindowFrame.Title`).
 * Separators are inserted automatically between crumbs, so compose only the
 * crumbs themselves:
 *
 *   <Breadcrumb>
 *     <Breadcrumb.Item>Quick Values</Breadcrumb.Item>
 *     <Breadcrumb.Current>Create</Breadcrumb.Current>
 *   </Breadcrumb>
 *
 * Pass `separator` to change the glyph. Dropping `<Breadcrumb.Separator>`
 * children in yourself turns the automatic ones off.
 */
function BreadcrumbRoot({
  separator = "/",
  className,
  children,
}: {
  separator?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const crumbs = Children.toArray(children).filter(isValidElement);
  const manual = crumbs.some((crumb) => crumb.type === Separator);

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("flex min-w-0 items-center", className)}
    >
      {crumbs.map((crumb, i) => (
        <Fragment key={i}>
          {i > 0 && !manual ? <Separator>{separator}</Separator> : null}
          {crumb}
        </Fragment>
      ))}
    </nav>
  );
}

/** A crumb for an ancestor level — muted, never truncated. */
function Item({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "shrink-0 whitespace-nowrap text-foreground-subtle",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** The final crumb — the current location. Truncates when space is tight. */
function Current({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      aria-current="page"
      className={cn("min-w-0 truncate text-foreground", className)}
    >
      {children}
    </span>
  );
}

/** The glyph between crumbs. Rendered automatically by `Breadcrumb`; export
 * exists for custom placement or styling. */
function Separator({
  className,
  children = "/",
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <span
      aria-hidden
      className={cn("mx-1.5 shrink-0 text-foreground-subtle", className)}
    >
      {children}
    </span>
  );
}

export const Breadcrumb = Object.assign(BreadcrumbRoot, {
  Item,
  Current,
  Separator,
});
