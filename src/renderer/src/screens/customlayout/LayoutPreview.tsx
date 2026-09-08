import type { CSSProperties } from "react";
import { anchorOrigin, AUTO_PREVIEW_FRACTION } from "@shared/anchor";
import type { CustomLayoutDraft, DisplayPreviewInfo } from "@shared/types";

/**
 * Scaled-down live preview of the layout's rect on the primary display. Shares
 * `anchorOrigin` with `computeCustomRect` (the real placement) and with
 * `customLayoutIcon` (the search row's icon), so the three can't disagree about
 * where a given anchor puts the window.
 *
 * The rect is drawn as an actual little window — title bar and all, with the
 * host platform's own controls — because "where does my window land" is much
 * easier to read off a window than off a plain filled rectangle.
 *
 * The gap is deliberately not drawn: it's a few px on a real screen, which at
 * this scale would be sub-pixel and misleading rather than informative.
 */

/** Matches `WindowFrame`'s check — the chrome the user actually sees. */
const PLATFORM = window.api.platform;

/**
 * The screen fills its pane's width, only shrinking below that when the pane is
 * too short for the display's aspect ratio (`max-h-full` does that). The cap is
 * a guard for a future wider window rather than a limit that binds today — the
 * pane is ~367px in the 640×420 launcher.
 */
const MAX_SCREEN_WIDTH = 560;

export function LayoutPreview({
  draft,
  display,
}: {
  draft: CustomLayoutDraft;
  display: DisplayPreviewInfo | null;
}) {
  if (!display) return <div className="h-full w-full rounded bg-background" />;

  const width =
    draft.widthPercent != null ? draft.widthPercent / 100 : AUTO_PREVIEW_FRACTION;
  const height =
    draft.heightPercent != null ? draft.heightPercent / 100 : AUTO_PREVIEW_FRACTION;

  // A unit box, so the origin comes back as fractions we can hand straight to CSS.
  const origin = anchorOrigin(
    draft.position,
    { width, height },
    { width: 1, height: 1 },
  );
  const offsetXFraction = draft.offsetXPercent / 100;
  const offsetYFraction =
    display.height === 0 ? 0 : draft.offsetYPoints / display.height;

  return (
    // `aspectRatio` is the display's real proportions (not a fixed 16:9), and
    // `max-h-full` shrinks it to fit the pane like `object-fit: contain` —
    // centered by the flex parent — instead of stretching to fill whatever
    // shape the surrounding panel happens to be. `ring` draws the bezel without
    // taking part in layout, so it can't skew the aspect ratio.
    <div className="flex h-full w-full items-center justify-center">
      <div
        className="relative max-h-full w-full overflow-hidden rounded-md bg-linear-to-br from-foreground-subtle/25 to-foreground-subtle/5 shadow-lg ring-1 ring-foreground-subtle/40"
        style={{
          aspectRatio: `${display.width} / ${display.height}`,
          maxWidth: MAX_SCREEN_WIDTH,
        }}
      >
        <MiniWindow
          style={{
            left: `${(origin.x + offsetXFraction) * 100}%`,
            top: `${(origin.y + offsetYFraction) * 100}%`,
            width: `${width * 100}%`,
            height: `${height * 100}%`,
          }}
        />
      </div>
    </div>
  );
}

/**
 * The layout's rect, drawn as a window: a title bar with this platform's
 * controls over a blank body.
 *
 * Everything is `shrink-0` and the root clips, so a layout small enough that
 * the controls don't fit loses them cleanly instead of bursting its own frame.
 */
function MiniWindow({ style }: { style: CSSProperties }) {
  return (
    <div
      style={style}
      className="absolute flex flex-col overflow-hidden rounded-[3px] bg-foreground/95 shadow-md ring-1 ring-black/25"
    >
      <div
        className={
          "flex h-1.75 shrink-0 items-center gap-0.5 border-b border-black/10 bg-black/10 px-0.75 " +
          (PLATFORM === "darwin" ? "justify-start" : "justify-end")
        }
      >
        <TitleBarControls />
      </div>
      <div className="min-h-0 flex-1" />
    </div>
  );
}

function TitleBarControls() {
  // macOS: three colour-coded lights on the left. The colours are the whole
  // signal at this size, so they're hard-coded rather than themed.
  if (PLATFORM === "darwin") {
    return (
      <>
        <Dot className="bg-[#ff5f57]" />
        <Dot className="bg-[#febc2e]" />
        <Dot className="bg-[#28c840]" />
      </>
    );
  }

  // Linux (GNOME/KDE): round buttons on the right, no colour coding.
  if (PLATFORM === "linux") {
    return (
      <>
        <Dot className="bg-black/25" />
        <Dot className="bg-black/25" />
        <Dot className="bg-black/25" />
      </>
    );
  }

  // Windows: minimise / maximise / close glyphs on the right. Drawn as one SVG
  // so the strokes stay crisp instead of turning to mush as sub-pixel divs.
  return (
    <svg
      viewBox="0 0 22 6"
      className="h-1 w-4 shrink-0 text-black/45"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      aria-hidden
    >
      <line x1="0.5" y1="3" x2="4.5" y2="3" />
      <rect x="9" y="0.5" width="4" height="5" />
      <line x1="17.5" y1="0.5" x2="21.5" y2="5.5" />
      <line x1="21.5" y1="0.5" x2="17.5" y2="5.5" />
    </svg>
  );
}

function Dot({ className }: { className: string }) {
  return (
    <span className={`h-0.75 w-0.75 shrink-0 rounded-full ${className}`} />
  );
}
