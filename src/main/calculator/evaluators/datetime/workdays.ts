import * as chrono from "chrono-node";
import type { Calculation } from "../../../../shared/types";
import { formatNumber } from "../../common/locale.ts";
import { roundDisplay } from "../../common/precision.ts";
import { addBusinessDays, businessDaysBetween } from "./business.ts";
import { formatDate } from "./format.ts";
import {
  firstDayOfPeriod,
  lastDayOfPeriod,
  quarterStart,
  shiftPeriod,
  type Period,
} from "./period.ts";

/**
 * Working time rather than raw time (pere-doc #24) — a standard Mon–Fri,
 * 8-hour day, no public holidays (same as Raycast).
 *
 *   workdays in March            → `22 workdays`
 *   workhours in 2026            → `2,088 hours`
 *   55h in workdays              → `6.875 workdays`
 *   10 workdays from today       → `Fri, Sep 18`
 *   workdays between 1 Mar and 30 Jun → `87 workdays`
 *   workdays until 25 Dec / workdays left in the quarter
 */
export const HOURS_PER_WORKDAY = 8;

const WORKDAY = String.raw`(?:work\s*days?|working\s+days?|business\s+days?)`;
const WORKHOUR = String.raw`(?:work\s*hours?|working\s+hours?|business\s+hours?)`;

const COUNT_IN = new RegExp(
  String.raw`^(${WORKDAY}|${WORKHOUR})\s+in\s+(.+)$`,
  "i",
);
const HOURS_TO_DAYS = new RegExp(
  String.raw`^(\d+(?:\.\d+)?)\s*(?:h|hrs?|hours?)\s+(?:in|to|as|into)\s+${WORKDAY}$`,
  "i",
);
const DAYS_TO_HOURS = new RegExp(
  String.raw`^(\d+(?:\.\d+)?)\s*${WORKDAY}\s+(?:in|to|as|into)\s+(?:h|hrs?|hours?)$`,
  "i",
);
const STEP = new RegExp(
  String.raw`^(\d+)\s+${WORKDAY}\s+(from|after|before)\s+(.+)$`,
  "i",
);
const STEP_AGO = new RegExp(String.raw`^(\d+)\s+${WORKDAY}\s+ago$`, "i");
const IN_STEP = new RegExp(String.raw`^in\s+(\d+)\s+${WORKDAY}$`, "i");
const BETWEEN = new RegExp(
  String.raw`^(${WORKDAY}|${WORKHOUR})\s+(?:between|from)\s+(.+?)\s+(?:and|to|until)\s+(.+)$`,
  "i",
);
const UNTIL = new RegExp(
  String.raw`^(${WORKDAY}|${WORKHOUR})\s+(?:until|till|left\s+until)\s+(.+)$`,
  "i",
);
const LEFT_IN = new RegExp(
  String.raw`^(${WORKDAY}|${WORKHOUR})\s+left\s+in\s+(?:the\s+|this\s+)?(quarter|year|month|week)$`,
  "i",
);

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

/**
 * A named period → its first and last day: `2026`, `March`, `Mar 2027`,
 * `Q1`, `Q3 2027`, `this|next|last month|quarter|year|week`, `the month`.
 */
export function parsePeriod(text: string, now: Date): [Date, Date] | null {
  const t = text.trim().toLowerCase();

  if (/^\d{4}$/.test(t))
    return [new Date(Number(t), 0, 1), new Date(Number(t), 11, 31)];

  const quarter = t.match(/^q([1-4])(?:\s+(\d{4}))?$/);
  if (quarter) {
    const start = quarterStart(
      Number(quarter[1]),
      quarter[2] ? Number(quarter[2]) : now.getFullYear(),
    );
    return [start, lastDayOfPeriod("quarter", start)];
  }

  const relative = t.match(
    /^(?:(this|next|last)\s+|the\s+)?(month|quarter|year|week)$/,
  );
  if (relative) {
    const period = relative[2] as Period;
    const delta = { next: 1, last: -1 }[relative[1] ?? ""] ?? 0;
    const ref = shiftPeriod(period, now, delta);
    return [firstDayOfPeriod(period, ref), lastDayOfPeriod(period, ref)];
  }

  const month = t.match(/^([a-z]{3,})\.?(?:\s+(\d{4}))?$/);
  if (month) {
    const index = MONTHS.findIndex((m) => m.startsWith(month[1]));
    if (index === -1) return null;
    const year = month[2] ? Number(month[2]) : now.getFullYear();
    return [new Date(year, index, 1), new Date(year, index + 1, 0)];
  }

  return null;
}

const isHours = (word: string) => /hour/i.test(word);

function count(
  input: string,
  word: string,
  days: number,
  extra: { label: string; value: string }[] = [],
): Calculation {
  if (isHours(word)) {
    const hours = days * HOURS_PER_WORKDAY;
    return {
      expression: input,
      value: `${formatNumber(hours)} hours`,
      rawValue: String(hours),
      details: [{ label: "Workdays", value: formatNumber(days) }, ...extra],
    };
  }
  return {
    expression: input,
    value: `${formatNumber(days)} ${days === 1 ? "workday" : "workdays"}`,
    rawValue: String(days),
    details: [
      { label: "Work hours", value: formatNumber(days * HOURS_PER_WORKDAY) },
      ...extra,
    ],
  };
}

function parseDate(text: string, now: Date): Date | null {
  if (/^(?:today|now)$/i.test(text.trim())) return now;
  return chrono.parseDate(text, now, { forwardDate: true });
}

const nextDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);

export function resolveWorkdays(input: string, now: Date): Calculation | null {
  const hoursToDays = input.match(HOURS_TO_DAYS);
  if (hoursToDays) {
    const hours = Number(hoursToDays[1]);
    const days = hours / HOURS_PER_WORKDAY;
    const whole = Math.floor(days);
    const rest = roundDisplay(hours - whole * HOURS_PER_WORKDAY);
    return {
      expression: input,
      value: `${formatNumber(roundDisplay(days))} workdays`,
      rawValue: String(roundDisplay(days)),
      details: [
        {
          label: "",
          value:
            rest === 0
              ? `${whole} workdays`
              : `${whole} workdays ${formatNumber(rest)} hours`,
        },
      ],
    };
  }

  const daysToHours = input.match(DAYS_TO_HOURS);
  if (daysToHours) {
    const hours = Number(daysToHours[1]) * HOURS_PER_WORKDAY;
    return {
      expression: input,
      value: `${formatNumber(hours)} hours`,
      rawValue: String(hours),
    };
  }

  const countIn = input.match(COUNT_IN);
  if (countIn) {
    const range = parsePeriod(countIn[2], now);
    if (!range) return null;
    return count(input, countIn[1], businessDaysBetween(...range));
  }

  const step =
    input.match(STEP) ?? input.match(STEP_AGO) ?? input.match(IN_STEP);
  if (step) {
    const n = Number(step[1]);
    const direction = step[2]?.toLowerCase();
    const isAgo = /ago$/i.test(input);
    const from = step[3] ? parseDate(step[3], now) : now;
    if (!from) return null;
    const date = addBusinessDays(
      from,
      direction === "before" || isAgo ? -n : n,
    );
    const { value, rawValue } = formatDate(date, now);
    return { expression: input, value, rawValue };
  }

  const between = input.match(BETWEEN);
  if (between) {
    // Nearest reading for the start (like `difference.ts`), the end chained after it.
    const a = /^(?:today|now)$/i.test(between[2].trim())
      ? now
      : chrono.parseDate(between[2], now, {});
    const b = a ? chrono.parseDate(between[3], a, { forwardDate: true }) : null;
    if (!a || !b) return null;
    return count(input, between[1], businessDaysBetween(a, b));
  }

  const until = input.match(UNTIL);
  if (until) {
    const target = parseDate(until[2], now);
    if (!target || target <= now) return null;
    // From tomorrow through the target day — today is already under way.
    return count(input, until[1], businessDaysBetween(nextDay(now), target));
  }

  const left = input.match(LEFT_IN);
  if (left) {
    const end = lastDayOfPeriod(left[2].toLowerCase() as Period, now);
    return count(
      input,
      left[1],
      end > now ? businessDaysBetween(nextDay(now), end) : 0,
    );
  }

  return null;
}
