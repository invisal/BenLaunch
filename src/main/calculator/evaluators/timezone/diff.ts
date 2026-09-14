import { getTimezoneOffset } from "date-fns-tz";
import type { Calculation } from "../../../../shared/types";
import { resolvePlace, type PlaceEntry } from "./places.ts";
import { offsetLabel } from "./format.ts";
import { systemZone } from "./clock.ts";

/**
 * Time difference between places (pere-doc #18) — DST-aware for *now*.
 *
 *   time diff Paris            → `Paris is 1 hour behind you`
 *   diff Tokyo                 → `Tokyo is 2 hours ahead of you`
 *   time difference between London and New York → `London is 5 hours ahead of New York`
 *   India time difference      → `India is 1 hour 30 minutes behind you`
 *
 * `rawValue` is the signed offset in hours (`+2`, `-5.5`).
 */
const DIFF =
  /^(?:time\s+)?diff(?:erence)?\s+(?:between\s+|with\s+|to\s+|for\s+|in\s+)?(.+?)(?:\s+(?:and|vs\.?|to|from)\s+(.+))?$/i;
const TRAILING_DIFF = /^(.+?)\s+time\s+diff(?:erence)?$/i;

const plural = (n: number, unit: string) =>
  `${n} ${n === 1 ? unit : `${unit}s`}`;

function hoursAndMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return plural(m, "minute");
  return m === 0
    ? plural(h, "hour")
    : `${plural(h, "hour")} ${plural(m, "minute")}`;
}

/**
 * An exact place, or a *prefix* of one ("time diff toky") — never a loose
 * subsequence match, which would turn a typo into a confidently wrong city.
 */
function lookup(text: string): PlaceEntry | null {
  const exact = resolvePlace(text, { fuzzy: false });
  if (exact) return exact;
  const fuzzy = resolvePlace(text);
  if (!fuzzy) return null;
  const typed = text.trim().toLowerCase();
  const names = [fuzzy.name, ...fuzzy.aliases].map((n) =>
    n
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase(),
  );
  return names.some((n) => n.startsWith(typed)) ? fuzzy : null;
}

/** `(A offset − B offset)` in minutes at `now`. */
function deltaMinutes(a: string, b: string, now: Date): number {
  return Math.round(
    (getTimezoneOffset(a, now) - getTimezoneOffset(b, now)) / 60_000,
  );
}

export function resolveDiff(
  input: string,
  now: Date,
  localZone: string = systemZone(),
): Calculation | null {
  const match = input.match(DIFF);
  const trailing = match ? null : input.match(TRAILING_DIFF);
  if (!match && !trailing) return null;

  const firstText = (match?.[1] ?? trailing![1]).trim();
  const secondText = match?.[2]?.trim();

  const first = lookup(firstText);
  if (!first) return null;
  const second = secondText ? lookup(secondText) : null;
  if (secondText && !second) return null;

  const otherZone = second?.timezone ?? localZone;
  const otherName = second ? second.name : "you";
  const delta = deltaMinutes(first.timezone, otherZone, now);
  const hours = delta / 60;
  const raw = `${hours > 0 ? "+" : ""}${Number(hours.toFixed(2))}`;

  const value =
    delta === 0
      ? second
        ? `${first.name} and ${second.name} are on the same time`
        : `${first.name} is on the same time as you`
      : `${first.name} is ${hoursAndMinutes(Math.abs(delta))} ${delta > 0 ? "ahead of" : "behind"} ${otherName}`;

  return {
    expression: input,
    value,
    rawValue: raw,
    details: [
      { label: first.name, value: offsetLabel(first.timezone, now) },
      {
        label: second ? second.name : "You",
        value: offsetLabel(otherZone, now),
      },
    ],
  };
}
