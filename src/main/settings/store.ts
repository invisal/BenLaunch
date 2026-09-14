/**
 * Persisted user settings — today just the custom-layout gap size, laid out so
 * more settings can join `SettingsFile` later without a migration (a missing
 * key just falls back to its default).
 *
 * Deliberately Electron-free (mirrors `usage/store.ts`): the `userData` directory
 * is injected by the caller, so `node --test` can exercise it against a temp dir.
 * Advisory, like the usage store — every filesystem failure is swallowed with a
 * `[settings]` prefix and leaves the in-memory state intact.
 */
import { readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type {
  CalculatorSettings,
  NumberFormatPreference,
} from "../../shared/types";

/** Bumped when the persisted shape changes, to invalidate old files. */
const SETTINGS_VERSION = 1;

/** Default "preferred gap" (px) a custom layout's `useGap` inserts around it, absent a saved override. */
const DEFAULT_GAP_PX = 8;

interface SettingsFile {
  version: number;
  savedAt: number;
  /**
   * The user's preferred gap (px), for a custom layout's "Use preferred gap
   * settings" toggle. Optional so a `SETTINGS_VERSION` 1 file saved before this
   * existed still validates — a missing value just falls back to `DEFAULT_GAP_PX`.
   */
  gapPx?: number;
  /** Calculator: fetch live crypto prices. Optional — missing means the default (on). */
  cryptoEnabled?: boolean;
  /** Calculator: number format. Optional — missing means `system`. */
  numberFormat?: NumberFormatPreference;
}

/** In-memory state — unlike `SettingsFile`, every field is populated (defaulted on load). */
interface State extends CalculatorSettings {
  gapPx: number;
}

const DEFAULT_CALCULATOR: CalculatorSettings = {
  cryptoEnabled: true,
  numberFormat: "system",
};

const NUMBER_FORMATS: readonly NumberFormatPreference[] = [
  "system",
  "dot",
  "comma",
];

function emptyState(): State {
  return { gapPx: DEFAULT_GAP_PX, ...DEFAULT_CALCULATOR };
}

function isSettingsFile(value: unknown): value is SettingsFile {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SettingsFile>;
  if (candidate.version !== SETTINGS_VERSION) return false;
  return (
    (candidate.gapPx === undefined || typeof candidate.gapPx === "number") &&
    (candidate.cryptoEnabled === undefined ||
      typeof candidate.cryptoEnabled === "boolean") &&
    (candidate.numberFormat === undefined ||
      NUMBER_FORMATS.includes(candidate.numberFormat))
  );
}

export class SettingsStore {
  private readonly dir: string;
  private state = emptyState();
  private loaded = false;

  constructor(opts: { dir: string }) {
    this.dir = opts.dir;
  }

  /** Load `settings.json` into memory. Corrupt / missing / old-version -> empty state. */
  init(): void {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const parsed: unknown = JSON.parse(readFileSync(this.path(), "utf8"));
      if (isSettingsFile(parsed)) {
        this.state = {
          gapPx: parsed.gapPx ?? DEFAULT_GAP_PX,
          cryptoEnabled:
            parsed.cryptoEnabled ?? DEFAULT_CALCULATOR.cryptoEnabled,
          numberFormat: parsed.numberFormat ?? DEFAULT_CALCULATOR.numberFormat,
        };
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error("[settings] Failed to read store:", error);
      }
    }
  }

  /** The user's preferred gap (px) for a custom layout's "Use preferred gap settings" toggle. */
  getGapSize(): number {
    this.init();
    return this.state.gapPx;
  }

  /** Persists immediately. */
  setGapSize(px: number): void {
    this.init();
    this.state.gapPx = Math.max(0, px);
    this.persist();
  }

  getCalculatorSettings(): CalculatorSettings {
    this.init();
    return {
      cryptoEnabled: this.state.cryptoEnabled,
      numberFormat: this.state.numberFormat,
    };
  }

  /** Merge `patch` (invalid fields ignored), persist, and return the result. */
  setCalculatorSettings(
    patch: Partial<CalculatorSettings>,
  ): CalculatorSettings {
    this.init();
    if (typeof patch.cryptoEnabled === "boolean")
      this.state.cryptoEnabled = patch.cryptoEnabled;
    if (patch.numberFormat && NUMBER_FORMATS.includes(patch.numberFormat)) {
      this.state.numberFormat = patch.numberFormat;
    }
    this.persist();
    return this.getCalculatorSettings();
  }

  private path(): string {
    return join(this.dir, "settings.json");
  }

  /** Atomic temp-write + rename, mirroring `usage/store.ts`. */
  private persist(): void {
    const file = this.path();
    const tmp = `${file}.tmp`;
    const payload: SettingsFile = {
      version: SETTINGS_VERSION,
      savedAt: Date.now(),
      gapPx: this.state.gapPx,
      cryptoEnabled: this.state.cryptoEnabled,
      numberFormat: this.state.numberFormat,
    };
    try {
      writeFileSync(tmp, JSON.stringify(payload));
      renameSync(tmp, file);
    } catch (error) {
      console.error("[settings] Failed to write store:", error);
      try {
        unlinkSync(tmp);
      } catch {
        /* nothing to clean up */
      }
    }
  }
}
