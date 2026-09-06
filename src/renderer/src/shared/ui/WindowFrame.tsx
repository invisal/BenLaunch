import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "cnfast";
import "./window-frame.css";

/**
 * The chrome for a framed window (Settings, QuickValue). The OS title bar is
 * hidden (see `src/main/window-chrome.ts`), so this draws our own: a draggable
 * bar with the title and, on Windows/Linux, the min/max/close buttons. macOS
 * keeps its native traffic lights, which sit over the left of the bar.
 *
 * The launcher does NOT use this — it's a frameless spotlight overlay with its
 * own glassy look and no title bar.
 */
const isMac = window.api.platform === "darwin";

// `-webkit-app-region` isn't in React's CSSProperties; the cast keeps it typed.
const DRAG = { WebkitAppRegion: "drag" } as CSSProperties;
const NO_DRAG = { WebkitAppRegion: "no-drag" } as CSSProperties;

interface WindowFrameProps {
  /** Shown centered-left in the title bar. */
  title?: string;
  /** Optional controls rendered in the title bar, before the window buttons. */
  toolbar?: ReactNode;
  /** Extra classes for the content area (the region below the title bar). */
  contentClassName?: string;
  children: ReactNode;
}

/**
 * Lets a nested screen override the title-bar text for as long as it's mounted
 * (see `WindowFrame.Title`). The slot is the DOM node the override portals
 * into; `register`/`unregister` maintain a stack so the most recently mounted
 * `<WindowFrame.Title>` wins and unmounting falls back to the previous entry
 * (or the `title` prop when the stack is empty).
 */
interface TitleSlotValue {
  slot: HTMLElement | null;
  register: () => number;
  unregister: (id: number) => void;
  activeId: number | null;
}

const TitleSlotContext = createContext<TitleSlotValue | null>(null);

function WindowFrameBase({
  title,
  toolbar,
  contentClassName,
  children,
}: WindowFrameProps) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const stackRef = useRef<number[]>([]);
  const nextIdRef = useRef(0);
  const [, bump] = useReducer((n: number) => n + 1, 0);

  const titleSlot: TitleSlotValue = {
    slot,
    register: () => {
      const id = nextIdRef.current++;
      stackRef.current.push(id);
      bump();
      return id;
    },
    unregister: (id: number) => {
      stackRef.current = stackRef.current.filter((entry) => entry !== id);
      bump();
    },
    activeId: stackRef.current.at(-1) ?? null,
  };

  return (
    <TitleSlotContext.Provider value={titleSlot}>
      <div className="window-frame flex h-screen w-screen flex-col overflow-hidden text-foreground">
        <div
          style={DRAG}
          className={cn(
            "flex h-9 shrink-0 items-center gap-2 border-b border-border pr-1 text-xs",
            // Leave room for the macOS traffic lights on the left.
            isMac ? "pl-20" : "pl-3",
          )}
        >
          <div className="flex min-w-0 flex-1 items-center text-foreground">
            {titleSlot.activeId === null ? (
              <span className="truncate">{title}</span>
            ) : null}
            <span ref={setSlot} className="contents" />
          </div>
          {toolbar ? (
            <div style={NO_DRAG} className="flex shrink-0 items-center gap-1">
              {toolbar}
            </div>
          ) : null}
          {!isMac ? <WindowControls /> : null}
        </div>
        <div className={cn("flex min-h-0 flex-1 flex-col", contentClassName)}>
          {children}
        </div>
      </div>
    </TitleSlotContext.Provider>
  );
}

/**
 * Portals its children into the enclosing `WindowFrame`'s title bar, replacing
 * the default `title` until this component unmounts. Mount more than one and
 * the last to mount shows; unmounting it reveals the previous.
 */
function WindowFrameTitle({ children }: { children: ReactNode }) {
  const ctx = useContext(TitleSlotContext);
  const [id, setId] = useState<number | null>(null);

  useEffect(() => {
    if (!ctx) return;
    const myId = ctx.register();
    setId(myId);
    return () => ctx.unregister(myId);
    // Mount/unmount only: `register`/`unregister` touch refs, and re-running on
    // every render would thrash the stack. `ctx` is a single stable provider.
  }, []);

  if (!ctx || !ctx.slot || id === null || ctx.activeId !== id) return null;
  return createPortal(children, ctx.slot);
}

export const WindowFrame = Object.assign(WindowFrameBase, {
  Title: WindowFrameTitle,
});

function WindowControls() {
  return (
    <div style={NO_DRAG} className="flex shrink-0 items-center">
      <ControlButton
        label="Minimize"
        onClick={() => window.api.windowControls.minimize()}
      >
        <rect x="2" y="5.5" width="8" height="1" />
      </ControlButton>
      <ControlButton
        label="Maximize"
        onClick={() => window.api.windowControls.toggleMaximize()}
      >
        <rect
          x="2.5"
          y="2.5"
          width="7"
          height="7"
          fill="none"
          stroke="currentColor"
        />
      </ControlButton>
      <ControlButton
        label="Close"
        danger
        onClick={() => window.api.windowControls.close()}
      >
        <path
          d="M2.5 2.5l7 7M9.5 2.5l-7 7"
          stroke="currentColor"
          strokeWidth="1"
        />
      </ControlButton>
    </div>
  );
}

function ControlButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "grid h-9 w-11 place-items-center text-foreground-subtle transition-colors",
        danger
          ? "hover:bg-red-600 hover:text-white"
          : "hover:bg-item-hover hover:text-foreground",
      )}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="currentColor"
        aria-hidden
      >
        {children}
      </svg>
    </button>
  );
}
