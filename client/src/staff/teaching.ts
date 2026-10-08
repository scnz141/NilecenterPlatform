import type {
  NccAttendanceDetailDto,
  NccClassDto,
  NccSessionDto,
} from "@/lib/backend/api";
import { intlLocale } from "./i18n";

/* ---------------- Weekdays ------------------------------------------ */

/** EMS weekdays: 0 = Monday … 6 = Sunday (OpenAPI and the NCC frontend). */
export const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

/** Localised weekday name; 5 January 2026 is a Monday. */
export function weekdayName(day: number, style: "short" | "long" = "short") {
  return new Date(Date.UTC(2026, 0, 5 + day)).toLocaleDateString(intlLocale(), {
    weekday: style,
    timeZone: "UTC",
  });
}

/** "Mon, Wed · 10:00–11:00", or null when the class has no usual days. */
export function scheduleText(schedule: NccClassDto["schedule"]): string | null {
  const { daysOfWeek, startTime, endTime } = schedule;
  if (!daysOfWeek?.length) return null;
  const days = new Intl.ListFormat(intlLocale(), { style: "short", type: "unit" }).format(
    [...daysOfWeek].sort((a, b) => a - b).map(day => weekdayName(day))
  );
  return startTime && endTime
    ? `${days} · ${startTime.slice(0, 5)}–${endTime.slice(0, 5)}`
    : days;
}

/* ---------------- Sessions ------------------------------------------ */

export function splitSessions(sessions: NccSessionDto[], now = Date.now()) {
  const upcoming: NccSessionDto[] = [];
  const past: NccSessionDto[] = [];
  const cancelled: NccSessionDto[] = [];
  for (const session of sessions) {
    if (session.status === "cancelled") cancelled.push(session);
    else if (Date.parse(session.endsAt) <= now) past.push(session);
    else upcoming.push(session);
  }
  upcoming.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  past.sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  cancelled.sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  return { upcoming, past, cancelled };
}

/** EMS refuses changes to a session that has started. */
export function sessionLocked(session: NccSessionDto, now = Date.now()) {
  return session.status === "cancelled" || Date.parse(session.startsAt) <= now;
}

/* ---------------- Session planning ---------------------------------- */

export type PlanRow = { weekday: number; hours: number };
export type PlanErrorKey = "dayRequired" | "dayTwice" | "wholeNumber" | "rangeInvalid";

export function validatePlan(
  rows: PlanRow[],
  fromDate: string,
  toDate: string
): PlanErrorKey | null {
  if (rows.length === 0) return "dayRequired";
  if (new Set(rows.map(row => row.weekday)).size !== rows.length) return "dayTwice";
  if (rows.some(row => !Number.isInteger(row.hours) || row.hours < 1 || row.hours > 24)) {
    return "wholeNumber";
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate) || fromDate > toDate) {
    return "rangeInvalid";
  }
  return null;
}

/** Default plan: the class's usual days with their usual length, if set. */
export function defaultPlanRows(item: Pick<NccClassDto, "schedule">): PlanRow[] {
  const { daysOfWeek, startTime, endTime } = item.schedule;
  const hours =
    startTime && endTime
      ? Math.max(1, Math.round((minutes(endTime) - minutes(startTime)) / 60))
      : 1;
  return (daysOfWeek ?? []).map(weekday => ({ weekday, hours }));
}

function minutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

/* ---------------- Class form ---------------------------------------- */

export type ClassDraft = {
  name: string;
  courseId: string;
  kind: "group" | "individual";
  capacity: string;
  startDate: string;
  endDate: string;
  teacherIds: string[];
  days: number[];
  startTime: string;
  endTime: string;
  meetingUrl: string;
};

export type ClassErrorKey =
  | "required"
  | "wholeNumber"
  | "endBeforeStart"
  | "timeOrder"
  | "timeBoth"
  | "daysNeedTime"
  | "meetingInvalid";

export function validateClassDraft(
  draft: ClassDraft,
  creating: boolean
): Partial<Record<keyof ClassDraft, ClassErrorKey>> {
  const errors: Partial<Record<keyof ClassDraft, ClassErrorKey>> = {};
  if (!draft.name.trim()) errors.name = "required";
  if (creating && !draft.courseId) errors.courseId = "required";
  const capacity = Number(draft.capacity);
  if (!Number.isInteger(capacity) || capacity < 1) errors.capacity = "wholeNumber";
  if (!draft.startDate) errors.startDate = "required";
  if (!draft.endDate) errors.endDate = "required";
  else if (draft.startDate && draft.endDate <= draft.startDate) errors.endDate = "endBeforeStart";
  const hasTime = Boolean(draft.startTime || draft.endTime);
  if (Boolean(draft.startTime) !== Boolean(draft.endTime)) errors.startTime = "timeBoth";
  else if (hasTime && draft.endTime <= draft.startTime) errors.endTime = "timeOrder";
  if (!errors.startTime && Boolean(draft.days.length) !== hasTime) errors.days = "daysNeedTime";
  const url = draft.meetingUrl.trim();
  if (url && !/^https:\/\/\S+$/.test(url)) errors.meetingUrl = "meetingInvalid";
  return errors;
}

export function scheduleFromDraft(draft: ClassDraft) {
  return draft.days.length && draft.startTime && draft.endTime
    ? {
        daysOfWeek: [...draft.days].sort((a, b) => a - b),
        startTime: draft.startTime,
        endTime: draft.endTime,
      }
    : null;
}

/* ---------------- Attendance ---------------------------------------- */

/**
 * Status chosen per student: edits win over what Moodle has stored. Returns
 * the effective map and how many students have a status.
 */
export function attendanceState(
  detail: Pick<NccAttendanceDetailDto, "students">,
  edits: Record<string, number>
) {
  const effective: Record<string, number | null> = {};
  let marked = 0;
  for (const student of detail.students) {
    const stored = student.statusId ? Number(student.statusId) : null;
    const value = edits[student.studentId] ?? (Number.isFinite(stored) ? stored : null);
    effective[student.studentId] = value;
    if (value !== null) marked += 1;
  }
  return { effective, marked, total: detail.students.length };
}

/** Marks to send: only students whose status differs from Moodle. */
export function changedMarks(
  detail: Pick<NccAttendanceDetailDto, "students">,
  edits: Record<string, number>
) {
  return detail.students
    .filter(student => edits[student.studentId] !== undefined)
    .filter(student => String(edits[student.studentId]) !== student.statusId)
    .map(student => ({ studentId: student.studentId, statusId: edits[student.studentId] }));
}

/** Present first, then late, excused, absent, then anything else. */
export function orderStatuses<T extends { acronym: string | null }>(statuses: T[]) {
  const rank = (acronym: string | null) => {
    const index = ["P", "L", "E", "A"].indexOf((acronym ?? "").toUpperCase());
    return index === -1 ? 9 : index;
  };
  return [...statuses].sort((a, b) => rank(a.acronym) - rank(b.acronym));
}

/* ---------------- Teacher week -------------------------------------- */

export type WeekEntry<S> = { session: S; classId: string; className: string };

/**
 * Scheduled sessions grouped onto the seven ISO dates of a week, in time
 * order. `dayOf` maps an instant to its calendar date in the right zone.
 */
export function weekAgenda<S extends Pick<NccSessionDto, "startsAt" | "status">>(
  entries: WeekEntry<S>[],
  dates: string[],
  dayOf: (iso: string) => string
): Map<string, WeekEntry<S>[]> {
  const days = new Map(dates.map(date => [date, [] as WeekEntry<S>[]]));
  for (const entry of entries) {
    if (entry.session.status === "cancelled") continue;
    days.get(dayOf(entry.session.startsAt))?.push(entry);
  }
  days.forEach(list => list.sort((a, b) => a.session.startsAt.localeCompare(b.session.startsAt)));
  return days;
}

/** The Moodle attendance session created for an EMS session, if any. */
export function attendanceFor<A extends { emsSessionId: string | null }>(
  sessionId: string,
  attendance: A[]
): A | null {
  return attendance.find(item => item.emsSessionId === sessionId) ?? null;
}
