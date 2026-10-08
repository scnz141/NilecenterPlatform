import { dayKey, needsOutcome } from "./pages/booking-list";

/** Greeting for the local hour: morning before 12, afternoon before 18. */
export function greetingPart(hour: number): "morning" | "afternoon" | "evening" {
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

/** Whole-number fill percentage; 0 when there is no capacity. */
export function fillPercent(fill: number, capacity: number): number {
  if (capacity <= 0) return 0;
  return Math.min(100, Math.round((fill / capacity) * 100));
}

/**
 * Scheduled bookings split into today's agenda (branch calendar day, in time
 * order) and every past booking that still needs a result, today's included.
 */
export function splitToday<
  T extends { status: string; scheduledAt: string | null; branchId: string },
>(
  bookings: T[],
  zoneFor: (branchId: string) => string | undefined,
  now = Date.now()
): { today: T[]; overdue: T[] } {
  const today: T[] = [];
  const overdue: T[] = [];
  for (const booking of bookings) {
    if (booking.status !== "scheduled" || !booking.scheduledAt) continue;
    const zone = zoneFor(booking.branchId);
    const isToday =
      dayKey(booking.scheduledAt, zone) ===
      dayKey(new Date(now).toISOString(), zone);
    if (isToday) today.push(booking);
    if (needsOutcome(booking, now)) overdue.push(booking);
  }
  today.sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""));
  return { today, overdue };
}

/* ---------------- Insights ------------------------------------------ */

export type Period = "7d" | "30d" | "90d" | "all";
export const PERIODS: Period[] = ["7d", "30d", "90d", "all"];
const DAYS: Record<Exclude<Period, "all">, number> = { "7d": 7, "30d": 30, "90d": 90 };

const iso = (date: Date) => date.toISOString().slice(0, 10);
const shift = (date: Date, days: number) => new Date(date.getTime() + days * 864e5);

/** Inclusive created-date window ending today, and the window before it. */
export function periodWindows(period: Period, today = new Date()) {
  if (period === "all") return { current: null, previous: null };
  const days = DAYS[period];
  const end = today;
  const start = shift(end, -(days - 1));
  return {
    current: { createdFrom: iso(start), createdTo: iso(end) },
    previous: { createdFrom: iso(shift(start, -days)), createdTo: iso(shift(start, -1)) },
  };
}

/** The last `weeks` Monday-to-Sunday windows, oldest first, this week last. */
export function weekWindows(weeks: number, today = new Date()) {
  const monday = shift(today, -((today.getUTCDay() + 6) % 7));
  return Array.from({ length: weeks }, (_, index) => {
    const start = shift(monday, -7 * (weeks - 1 - index));
    return { createdFrom: iso(start), createdTo: iso(shift(start, 6)) };
  });
}

type Count = { key: string; count: number };

/** Lead outcomes from status counts: open, registered, lost, conversion. */
export function leadOutcomes(byStatus: Count[]) {
  const count = (key: string) => byStatus.find(item => item.key === key)?.count ?? 0;
  const registered = count("registered");
  const lost = count("lost");
  const total = byStatus.reduce((sum, item) => sum + item.count, 0);
  const open = total - registered - lost;
  const decided = registered + lost;
  return { total, open, registered, lost, conversion: decided ? Math.round((registered / decided) * 100) : null };
}

/** Placement and trial outcomes, with the share of booked people who came. */
export function bookingOutcomes(byStatus: Count[]) {
  const count = (key: string) => byStatus.find(item => item.key === key)?.count ?? 0;
  const side = (prefix: "placement" | "trial") => {
    const completed = count(`${prefix}_completed`);
    const noShow = count(`${prefix}_no_show`);
    const attended = completed + noShow;
    return {
      scheduled: count(`${prefix}_scheduled`),
      completed,
      cancelled: count(`${prefix}_cancelled`),
      noShow,
      showRate: attended ? Math.round((completed / attended) * 100) : null,
    };
  };
  return { placement: side("placement"), trial: side("trial") };
}

/** Change against the previous window; null when there is nothing to compare. */
export function delta(current: number | null, previous: number | null) {
  if (current === null || previous === null) return null;
  return current - previous;
}
