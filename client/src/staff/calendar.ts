import { intlLocale } from "./i18n";

/**
 * Calendar maths on plain ISO dates ("2026-10-09"). Everything runs in UTC so
 * a date never shifts by a day with the device time zone or daylight saving.
 */

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(value: string | null | undefined): value is string {
  if (!value) return false;
  const match = ISO.exec(value);
  if (!match) return false;
  const date = toUtc(value);
  return date.getUTCDate() === Number(match[3]);
}

/** `Date.UTC` maps years 0 to 99 onto 1900 to 1999, so set the year directly. */
function toUtc(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date;
}

function fromUtc(date: Date): string {
  const year = String(date.getUTCFullYear()).padStart(4, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayIso(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function addDays(iso: string, days: number): string {
  const date = toUtc(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return fromUtc(date);
}

/** Month arithmetic that keeps the day where it can: 31 Jan + 1 month is 28 or 29 Feb. */
export function addMonths(iso: string, months: number): string {
  const date = toUtc(iso);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const last = daysInMonth(fromUtc(date));
  date.setUTCDate(Math.min(day, last));
  return fromUtc(date);
}

export function daysInMonth(iso: string): number {
  const date = toUtc(iso);
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(0);
  return date.getUTCDate();
}

export function startOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function sameMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

/** 0 is Sunday, 6 is Saturday. */
export function weekday(iso: string): number {
  return toUtc(iso).getUTCDay();
}

/** Keep a date inside optional bounds. ISO strings compare correctly as text. */
export function clampDate(iso: string, min?: string, max?: string): string {
  if (min && iso < min) return min;
  if (max && iso > max) return max;
  return iso;
}

export function inRange(iso: string, min?: string, max?: string): boolean {
  return !(min && iso < min) && !(max && iso > max);
}

/**
 * First day of the week for the UI language. Uses the browser's week data
 * when it has it; otherwise Saturday for Arabic (the Egyptian school week),
 * Monday for Turkish and British English.
 */
export function weekStartsOn(locale = intlLocale()): number {
  try {
    const info = new Intl.Locale(locale) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number };
      weekInfo?: { firstDay: number };
    };
    const firstDay = info.getWeekInfo?.().firstDay ?? info.weekInfo?.firstDay;
    if (firstDay) return firstDay % 7;
  } catch {
    // Older engines: fall through to the language default.
  }
  if (locale.startsWith("ar")) return 6;
  if (locale.startsWith("en-US")) return 0;
  return 1;
}

/** Six full weeks around the month of `iso`, starting on `firstDay`. */
export function monthGrid(iso: string, firstDay: number): string[] {
  const first = startOfMonth(iso);
  const offset = (weekday(first) - firstDay + 7) % 7;
  const start = addDays(first, -offset);
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

export function startOfWeek(iso: string, firstDay: number): string {
  return addDays(iso, -((weekday(iso) - firstDay + 7) % 7));
}

/* ---------------- Labels in the UI language ---------------- */

function format(iso: string, options: Intl.DateTimeFormatOptions, locale = intlLocale()) {
  return toUtc(iso).toLocaleDateString(locale, { ...options, timeZone: "UTC" });
}

/** "Sat, 10 Oct 2026" for the field. */
export function formatFieldDate(iso: string, locale?: string): string {
  return format(iso, { weekday: "short", day: "numeric", month: "short", year: "numeric" }, locale);
}

/** "Saturday, 10 October 2026" for screen readers. */
export function formatLongDate(iso: string, locale?: string): string {
  return format(iso, { weekday: "long", day: "numeric", month: "long", year: "numeric" }, locale);
}

export function formatMonthYear(iso: string, locale?: string): string {
  return format(iso, { month: "long", year: "numeric" }, locale);
}

export function formatDayNumber(iso: string, locale?: string): string {
  return format(iso, { day: "numeric" }, locale);
}

/** Narrow weekday names in display order, plus full names for headers' titles. */
export function weekdayNames(firstDay: number, locale?: string): { short: string; long: string }[] {
  // 2023-01-01 was a Sunday.
  return Array.from({ length: 7 }, (_, index) => {
    const iso = addDays("2023-01-01", (firstDay + index) % 7);
    return {
      short: format(iso, { weekday: "short" }, locale),
      long: format(iso, { weekday: "long" }, locale),
    };
  });
}

export function monthNamesShort(locale?: string): string[] {
  return Array.from({ length: 12 }, (_, index) =>
    format(`2023-${String(index + 1).padStart(2, "0")}-01`, { month: "short" }, locale)
  );
}

export function formatYear(year: number, locale?: string): string {
  return format(`${String(year).padStart(4, "0")}-01-01`, { year: "numeric" }, locale);
}
