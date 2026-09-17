import type { ReactNode } from "react";
import { cn } from "cnfast";

/**
 * The right-hand pane of a master/detail `ListScreen` — what the highlighted
 * row *is*, at a glance, and everything known about it underneath.
 *
 *   <Detail>
 *     <Detail.Preview>
 *       <Detail.Media src={dataUrl} />
 *     </Detail.Preview>
 *     <Detail.Info>
 *       <Detail.Row label="Size" value="2.3 MB" />
 *     </Detail.Info>
 *   </Detail>
 *
 * A pane built from these parts reads the same as every other: one content
 * region that takes the space left over, then a fixed metadata block with a
 * hairline above it. Search Quicklinks is built on them; the Clipboard History
 * pane still hand-rolls its own halves and should move onto these when it's
 * next touched — the two had already drifted apart on padding, row type scale
 * and the wording of "nothing selected".
 *
 * The pane is narrow (~240–400px inside a 640px launcher), so everything here
 * is built to truncate rather than push: `Row` values clip with a tooltip,
 * `Media` contains rather than crops, `Text` scrolls in both directions.
 */

function DetailRoot({
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

/** Nothing is highlighted (an empty list, or nothing selected yet). */
function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="grid h-full place-items-center px-6 text-center text-xs text-foreground-subtle">
      {children}
    </div>
  );
}

/**
 * The content region: takes the height the `Info` block leaves. Centered by
 * default, for a preview that is one object (an image, a file card);
 * `align="start"` for content that reads from the top-left instead (text, a
 * table, a list of folder entries).
 */
function Preview({
  align = "center",
  className,
  children,
}: {
  align?: "center" | "start";
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "min-h-0 flex-1 overflow-auto p-3",
        align === "center" ? "flex items-center justify-center" : "",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** A previewed image/thumbnail — contained, never cropped or upscaled past 1×. */
function Media({ src, alt = "" }: { src: string; alt?: string }) {
  return (
    <img
      src={src}
      alt={alt}
      className="max-h-full max-w-full rounded-md object-contain shadow-lg shadow-black/30"
    />
  );
}

/**
 * Monospaced text content (a file's first lines, a copied snippet). `wrap`
 * soft-wraps long lines, for prose; the default keeps them intact and scrolls
 * sideways, so indented code still lines up.
 */
function Text({
  wrap = false,
  children,
}: {
  wrap?: boolean;
  children: ReactNode;
}) {
  return (
    <pre
      className={cn(
        "w-full font-mono text-[11px] leading-[1.6] text-foreground/90",
        wrap ? "whitespace-pre-wrap wrap-break-word" : "whitespace-pre",
      )}
    >
      {children}
    </pre>
  );
}

/**
 * The fallback preview when the content itself can't be shown: a large icon
 * with a name and a type line under it — a `.zip`, a video with no OS
 * thumbnail, a web link. Deliberately the same shape as a real preview so the
 * pane doesn't visibly degrade into an error state.
 */
function Card({
  icon,
  title,
  subtitle,
  tone = "default",
}: {
  /** A data-URI/emoji icon, or a ready-made element. */
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** `"muted"` for a fallback the user should read as a non-result (missing file). */
  tone?: "default" | "muted";
}) {
  return (
    <div className="flex max-w-full flex-col items-center gap-2 px-2 text-center">
      <span
        className={cn(
          "grid h-14 w-14 place-items-center text-4xl",
          tone === "muted" && "opacity-60",
        )}
      >
        {typeof icon === "string" && /^(data:|file:|https?:)/i.test(icon) ? (
          // `app.getFileIcon` tops out at 32px on Windows even for
          // `size: "large"`, so the box is kept near that rather than
          // scaling a small bitmap up into a blur.
          <img src={icon} alt="" className="h-12 w-12 object-contain" />
        ) : (
          icon
        )}
      </span>
      <span className="max-w-full truncate text-sm font-medium">{title}</span>
      {subtitle != null && (
        <span className="max-w-full text-xs text-foreground-subtle">
          {subtitle}
        </span>
      )}
    </div>
  );
}

/**
 * The metadata block pinned under the preview. Caps at 45% of the pane so a
 * long list of rows can never squeeze the preview out; scrolls past that.
 */
function Info({
  title = "Information",
  className,
  children,
}: {
  /** Heading above the rows. `null` for a block that needs none. */
  title?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "max-h-[45%] shrink-0 overflow-y-auto border-t border-border p-3",
        className,
      )}
    >
      {title != null && (
        <div className="mb-1 text-[11px] font-medium tracking-wide text-foreground-subtle uppercase">
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * One `Label · value` line. Renders nothing when `value` is empty, so a pane
 * can list every field it *might* know and let the blanks fall away.
 */
function Row({
  label,
  value,
  icon,
  title,
}: {
  label: ReactNode;
  value?: ReactNode;
  /** Small image shown before the value — an app icon, a favicon. */
  icon?: string;
  /** Hover tooltip, when `value` is an abbreviation of something longer. */
  title?: string;
}) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex items-baseline justify-between gap-4 py-[3px] text-xs">
      <span className="shrink-0 text-foreground-subtle">{label}</span>
      <span
        className="flex min-w-0 items-center gap-1.5 text-right"
        title={title ?? (typeof value === "string" ? value : undefined)}
      >
        {icon && (
          <img src={icon} alt="" className="h-3.5 w-3.5 shrink-0 rounded-sm" />
        )}
        <span className="min-w-0 truncate">{value}</span>
      </span>
    </div>
  );
}

export const Detail = Object.assign(DetailRoot, {
  Empty,
  Preview,
  Media,
  Text,
  Card,
  Info,
  Row,
});
