import type { ReactNode } from "react";
import { cn } from "cnfast";
import { formatConfidence } from "../shared/format.ts";
import type { EngineInfo, OcrLine, Recognition } from "../shared/types";

/**
 * The small presentational pieces the three Read Text screens share, so a
 * recognition is described the same way wherever it's shown — the library's
 * detail pane, the result screen and the export form all render the same
 * metadata rows and the same image preview.
 *
 * Styling here is deliberately limited to the app's own tokens
 * (`text-foreground-subtle`, `border-border`, `bg-item-selected`, …) rather
 * than raw colours, so these follow the launcher's theme like every other
 * shared component does.
 */

/** A label/value row, as used down the right-hand information panes. */
export function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-6 py-0.5 text-xs">
      <span className="shrink-0 text-foreground-subtle">{label}</span>
      <span className="min-w-0 truncate text-right">{value}</span>
    </div>
  );
}

/** A section heading inside a detail pane. */
export function PaneHeading({ children }: { children: ReactNode }) {
  return <div className="mb-1 text-xs font-medium">{children}</div>;
}

/** A small status pill — the engine's name, a language tag, a warning. */
export function Tag({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "warning";
}) {
  return (
    <span
      className={cn(
        "shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium",
        tone === "warning"
          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
          : "bg-item-selected text-foreground-subtle",
      )}
    >
      {children}
    </span>
  );
}

/**
 * The source image, with the highlighted line boxed on top of it.
 *
 * The overlay is positioned in percentages of the *source* image's
 * dimensions, not the thumbnail's, so it stays correct at whatever size the
 * pane happens to render the picture — and correct too for the image the
 * engine actually read, which may have been scaled (see `main/image.ts`).
 */
export function ImagePreview({
  recognition,
  highlight,
  className,
}: {
  recognition: Recognition;
  /** Drawn as a box over the image. Omit for a plain preview. */
  highlight?: OcrLine | null;
  className?: string;
}) {
  const { width, height } = recognition.imageSize;
  const box =
    highlight && width > 0 && height > 0 && highlight.box.width > 0
      ? {
          left: `${(highlight.box.x / width) * 100}%`,
          top: `${(highlight.box.y / height) * 100}%`,
          width: `${(highlight.box.width / width) * 100}%`,
          height: `${(highlight.box.height / height) * 100}%`,
        }
      : null;

  return (
    <div className={cn("relative inline-block max-w-full", className)}>
      <img
        src={recognition.thumbnailDataUrl}
        alt=""
        className="block max-h-full max-w-full rounded object-contain"
      />
      {box && (
        <span
          aria-hidden
          style={box}
          className="pointer-events-none absolute rounded-[2px] border border-sky-400 bg-sky-400/20"
        />
      )}
    </div>
  );
}

/** Where a recognition came from, in one line. */
export function sourceLabel(recognition: Recognition): string {
  const { source } = recognition;
  if (source.kind === "file") return source.path;
  if (source.kind === "drop") return source.name;
  return "Clipboard";
}

/** The metadata block shared by the library and result detail panes. */
export function RecognitionInfo({
  recognition,
  extra,
}: {
  recognition: Recognition;
  /** Rows appended after the standard ones. */
  extra?: ReactNode;
}) {
  const words = recognition.lines.reduce(
    (sum, line) => sum + line.words.length,
    0,
  );
  return (
    <>
      <PaneHeading>Information</PaneHeading>
      <InfoRow label="Source" value={sourceLabel(recognition)} />
      <InfoRow
        label="Dimensions"
        value={`${recognition.imageSize.width}×${recognition.imageSize.height}`}
      />
      <InfoRow
        label="Text"
        value={`${recognition.lines.length} line${recognition.lines.length === 1 ? "" : "s"}, ${words} word${words === 1 ? "" : "s"}`}
      />
      <InfoRow
        label="Confidence"
        value={formatConfidence(recognition.confidence)}
      />
      <InfoRow label="Language" value={recognition.language} />
      <InfoRow label="Recognized in" value={`${recognition.durationMs} ms`} />
      {extra}
    </>
  );
}

/**
 * The engine card shown beside the "Read text from…" rows: what will do the
 * recognizing, or — the case worth designing for — why nothing can, with the
 * specific remedy rather than a shrug.
 */
export function EnginePanel({ engine }: { engine: EngineInfo | null }) {
  if (!engine) {
    return (
      <div className="p-4 text-sm text-foreground-subtle">
        Checking for a text recognizer…
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col justify-center gap-3 p-6 text-center">
      <div className="text-3xl" aria-hidden>
        {engine.available ? "🔎" : "⚠️"}
      </div>
      <div>
        <div className="text-sm font-medium">{engine.name}</div>
        <div className="mt-1 text-xs text-foreground-subtle">
          {engine.available
            ? `On-device recognition · ${engine.languages.length} language${engine.languages.length === 1 ? "" : "s"}`
            : "Unavailable"}
        </div>
      </div>
      {engine.available ? (
        <p className="text-xs leading-relaxed text-foreground-subtle">
          Copy a screenshot, pick an image file, or drop one on this window.
          Nothing leaves your machine.
        </p>
      ) : (
        <p className="text-xs leading-relaxed text-foreground-subtle">
          {engine.reason}
        </p>
      )}
      {engine.available && engine.languages.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1">
          {engine.languages.slice(0, 6).map((language) => (
            <Tag key={language.tag}>{language.tag}</Tag>
          ))}
          {engine.languages.length > 6 && (
            <Tag>+{engine.languages.length - 6}</Tag>
          )}
        </div>
      )}
    </div>
  );
}
