import * as chrono from "chrono-node";
import type { Calculation } from "../../../../shared/types";
import { formatCalendarSpan, formatDate } from "./format.ts";

/**
 * Age from a birth date — "age from 1990-05-01", "how old is someone born
 * 8 Dec 1988". Whole years as the headline, the exact span and the next
 * birthday as chips.
 */
const PHRASINGS: readonly RegExp[] = [
  /^age\s+(?:from|of|since|for)\s+(.+)$/i,
  /^how\s+old\s+(?:is\s+|am\s+i\s+if\s+)?(?:someone\s+|a\s+person\s+|i\s+was\s+|you\s+are\s+)?born\s+(?:on\s+|in\s+)?(.+)$/i,
  /^(?:born|birthday|dob)\s+(?:on\s+)?(.+?)\s+(?:age|how\s+old)$/i,
];

const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function resolveAge(input: string, now: Date): Calculation | null {
  for (const pattern of PHRASINGS) {
    const match = input.match(pattern);
    if (!match) continue;

    const text = match[1].trim();
    const results = chrono.parse(text, now, {});
    if (results.length !== 1) return null;
    const [result] = results;
    if (result.index !== 0 || result.text.length !== text.length) return null;
    if (!result.start.isCertain("year")) return null;

    const born = startOfDay(result.start.date());
    const today = startOfDay(now);
    if (born > today) return null;

    let years = today.getFullYear() - born.getFullYear();
    const birthdayThisYear = new Date(
      today.getFullYear(),
      born.getMonth(),
      born.getDate(),
    );
    if (birthdayThisYear > today) years -= 1;

    const nextBirthday =
      birthdayThisYear >= today
        ? birthdayThisYear
        : new Date(today.getFullYear() + 1, born.getMonth(), born.getDate());
    const daysToBirthday = Math.round(
      (nextBirthday.getTime() - today.getTime()) / 86_400_000,
    );

    return {
      expression: input,
      value: `${years} ${years === 1 ? "year" : "years"}`,
      rawValue: String(years),
      details: [
        { label: "Exact", value: formatCalendarSpan(born, today, "days") },
        {
          label: "Next birthday",
          value:
            daysToBirthday === 0
              ? "today 🎂"
              : `${formatDate(nextBirthday, now).value} (in ${daysToBirthday} ${daysToBirthday === 1 ? "day" : "days"})`,
        },
      ],
    };
  }
  return null;
}
