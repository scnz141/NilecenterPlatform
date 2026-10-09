import { intlLocale } from "./i18n";

/**
 * Date of birth rules shared by every staff form. The field keeps three raw
 * parts (day, month, year) in one string: a padded ISO date when the parts
 * form a real date, otherwise `year-month-day` exactly as typed, so partial
 * input never passes as a date. An empty field is "".
 */
export const DOB_MIN_YEAR = 1900;

export type DobParts = { day: string; month: string; year: string };

export type DobError = "incompleteDate" | "invalidDate" | "futureDate" | "tooEarly";

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function splitDob(value: string): DobParts {
  if (!value) return { day: "", month: "", year: "" };
  const [year = "", month = "", day = ""] = value.split("-");
  return {
    day: day.replace(/^0(?=\d)/, ""),
    month: month.replace(/^0(?=\d)/, ""),
    year,
  };
}

/** UTC date for any year. `Date.UTC` maps years 0 to 99 onto 1900 to 1999. */
function utcDate(year: number, month: number, day: number): Date {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date;
}

/** Real calendar date check: rejects 31 April, 29 February in common years, and so on. */
function isRealDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const date = utcDate(year, month, day);
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function composeDob({ day, month, year }: DobParts): string {
  const d = day.trim();
  const m = month.trim();
  const y = year.trim();
  if (!d && !m && !y) return "";
  if (/^\d{1,2}$/.test(d) && /^\d{1,2}$/.test(m) && /^\d{4}$/.test(y)) {
    if (isRealDate(Number(y), Number(m), Number(d))) {
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
  }
  return `${y}-${m}-${d}`;
}

function todayIso(today: Date): string {
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Error for a non-empty value, or null when the value is empty or valid. */
export function dobError(value: string, today = new Date()): DobError | null {
  if (!value) return null;
  const match = ISO.exec(value);
  if (!match) {
    const { day, month, year } = splitDob(value);
    if (!day || !month || year.length !== 4) return "incompleteDate";
    return "invalidDate";
  }
  const [year, month, day] = match.slice(1).map(Number);
  if (!isRealDate(year, month, day)) return "invalidDate";
  if (year < DOB_MIN_YEAR) return "tooEarly";
  if (value > todayIso(today)) return "futureDate";
  return null;
}

export function isValidDob(value: string, today = new Date()): boolean {
  return Boolean(value) && dobError(value, today) === null;
}

/** Whole years on `today`. Null for anything that is not a valid date. */
export function ageOn(value: string, today = new Date()): number | null {
  const match = ISO.exec(value);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  if (!isRealDate(year, month, day)) return null;
  let age = today.getFullYear() - year;
  if (
    today.getMonth() + 1 < month ||
    (today.getMonth() + 1 === month && today.getDate() < day)
  ) {
    age -= 1;
  }
  return age;
}

/**
 * "4 Mar 2012" in the UI language. Formats in UTC so a date-only value never
 * shifts by a day in time zones west of UTC.
 */
export function formatDob(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = ISO.exec(value);
  if (!match) return value;
  const [year, month, day] = match.slice(1).map(Number);
  return utcDate(year, month, day)
    .toLocaleDateString(intlLocale(), {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    })
    .replace(/ /g, "\u00a0");
}

/** Month names for the picker, January first, in the UI language. */
export function monthNames(): string[] {
  const format = new Intl.DateTimeFormat(intlLocale(), {
    month: "long",
    timeZone: "UTC",
  });
  return Array.from({ length: 12 }, (_, index) =>
    format.format(new Date(Date.UTC(2000, index, 1)))
  );
}
