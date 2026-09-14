import type { Calculation } from "../../../../shared/types";
import {
  isValidCalendarDate,
  isValidClockTime,
} from "../../common/calendar.ts";
import { formatDateTime, relativePhrase } from "./format.ts";

/**
 * ISO 8601 timestamps and Unix epochs (pere-doc #23).
 *
 *   2024-03-15T14:30:00Z        → local date & time; chips: UTC, relative, weekday, epoch
 *   2024-03-15T14:30:00+02:00   (any offset, or none = local)
 *   epoch 1700000000 / unix 1700000000000 / 1700000000 unix
 *   now to unix / 2024-03-15T14:30:00Z to epoch
 *
 * A bare 10/13-digit number stays math — epochs need a keyword. Arithmetic
 * and differences on ISO operands (`… + 90 days`, `… to now`) are handled by
 * `arithmetic.ts` / `difference.ts`.
 */
const ISO =
  /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)\s*(Z|[+-]\d{2}:?\d{2})?$/i;

const EPOCH_PREFIX =
  /^(?:epoch|unix|timestamp|ts)(?:\s+time)?\s*(?:of\s+|=\s*)?(\d{10}|\d{13})$/i;
const EPOCH_SUFFIX = /^(\d{10}|\d{13})\s+(?:epoch|unix)(?:\s+time)?$/i;
const TO_EPOCH =
  /^(.+?)\s+(?:to|in|as)\s+(?:epoch|unix(?:\s+time)?|timestamp)$/i;

/**
 * `new Date` for an ISO timestamp — normalises a `+0200` offset (no colon)
 * first. The calendar and clock fields are validated before `Date` sees them:
 * `Date` would silently roll `2024-02-31` over to 2 March.
 */
export function parseIso(text: string): Date | null {
  const match = text.trim().match(ISO);
  if (!match) return null;
  const [, date, time, zone] = match;
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes, seconds = 0] = time.split(":").map(Number);
  if (!isValidCalendarDate(year, month, day)) return null;
  if (!isValidClockTime(hours, minutes, seconds)) return null;
  if (zone && zone.toUpperCase() !== "Z") {
    const offsetHours = Number(zone.slice(1, 3));
    const offsetMinutes = Number(zone.replace(":", "").slice(3, 5));
    if (offsetHours > 23 || offsetMinutes > 59) return null;
  }
  const offset =
    zone && /^[+-]\d{4}$/.test(zone)
      ? `${zone.slice(0, 3)}:${zone.slice(3)}`
      : zone;
  const parsed = new Date(
    `${date}T${time}${offset ? offset.toUpperCase() : ""}`,
  );
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function utcLabel(d: Date): string {
  return `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function describe(input: string, date: Date, now: Date): Calculation {
  const { value } = formatDateTime(date, now);
  return {
    expression: input,
    value,
    rawValue: date.toISOString(),
    details: [
      { label: "UTC", value: utcLabel(date) },
      { label: "", value: relativePhrase(date, now) },
      {
        label: "Weekday",
        value: new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(
          date,
        ),
      },
      { label: "Epoch", value: String(Math.floor(date.getTime() / 1000)) },
    ],
  };
}

export function resolveIso(input: string, now: Date): Calculation | null {
  const iso = parseIso(input);
  if (iso) return describe(input, iso, now);

  const epoch = input.match(EPOCH_PREFIX) ?? input.match(EPOCH_SUFFIX);
  if (epoch) {
    const digits = epoch[1];
    const date = new Date(Number(digits) * (digits.length === 13 ? 1 : 1000));
    return describe(input, date, now);
  }

  const toEpoch = input.match(TO_EPOCH);
  if (toEpoch) {
    const source = toEpoch[1].trim();
    const date = /^(?:now|right\s+now)$/i.test(source) ? now : parseIso(source);
    if (!date) return null;
    const seconds = Math.floor(date.getTime() / 1000);
    return {
      expression: input,
      value: String(seconds),
      rawValue: String(seconds),
      details: [
        { label: "Milliseconds", value: String(date.getTime()) },
        { label: "UTC", value: utcLabel(date) },
      ],
    };
  }

  return null;
}
