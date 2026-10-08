import type {
  NccClassDto,
  NccEnrolmentDto,
  NccLeadDto,
  NccPlacementTestDto,
  NccTrialLessonDto,
} from "@/lib/backend/api";
import { fillPercent, periodWindows, type Period } from "./dashboard";

/**
 * Pure report math over live EMS rows. Every builder takes already-fetched
 * records plus a current and previous window and returns plain data; the page
 * localizes labels and formats numbers. `null` means "not meaningful here"
 * (division by zero, no previous window), never a silent 0. A `null` label
 * means the record did not carry the field and the UI shows its own
 * localized fallback.
 */

export type ReportWindow = { from: string; to: string } | null;

export function reportWindows(
  period: Period,
  today = new Date()
): { current: ReportWindow; previous: ReportWindow } {
  const windows = periodWindows(period, today);
  const map = (window: { createdFrom: string; createdTo: string } | null) =>
    window ? { from: window.createdFrom, to: window.createdTo } : null;
  return { current: map(windows.current), previous: map(windows.previous) };
}

/** Date inside the window (inclusive, date precision); `all` = any set date. */
export function inWindow(
  iso: string | null | undefined,
  window: ReportWindow
): boolean {
  if (!iso) return false;
  const day = iso.slice(0, 10);
  if (window === null) return true;
  return day >= window.from && day <= window.to;
}

export type SeriesPoint = {
  /** First day of the bucket, ISO date. */
  from: string;
  count: number;
};

export type ReportSeries = {
  granularity: "week" | "month";
  points: SeriesPoint[];
};

const DAY = 864e5;
const shift = (date: Date, days: number) => new Date(date.getTime() + days * DAY);
const iso = (date: Date) => date.toISOString().slice(0, 10);
const parseDay = (day: string) => new Date(`${day}T00:00:00Z`);

function mondayOf(day: string): Date {
  const date = parseDay(day);
  return shift(date, -((date.getUTCDay() + 6) % 7));
}

/**
 * Monday-starting buckets covering the window, oldest first. Edge buckets are
 * clipped to the window so a column never claims days outside the period.
 */
function weekBuckets(window: { from: string; to: string }) {
  const buckets: { from: string; to: string }[] = [];
  let monday = mondayOf(window.from);
  while (iso(monday) <= window.to) {
    buckets.push({
      from: iso(monday) < window.from ? window.from : iso(monday),
      to: iso(shift(monday, 6)) > window.to ? window.to : iso(shift(monday, 6)),
    });
    monday = shift(monday, 7);
  }
  return buckets;
}

/** The last `months` calendar months, oldest first. */
function monthBuckets(months: number, today: Date) {
  const buckets: { from: string; to: string }[] = [];
  for (let back = months - 1; back >= 0; back--) {
    const first = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - back, 1)
    );
    const next = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - back + 1, 1)
    );
    const last = shift(next, -1);
    buckets.push({ from: iso(first), to: iso(last > today ? today : last) });
  }
  return buckets;
}

/* ---------------- Shared shapes ------------------------------------------- */

export type Outcome = {
  total: number;
  open: number;
  registered: number;
  lost: number;
  /** Registered share of decided (registered + lost); null when none decided. */
  conversion: number | null;
};

function outcomeOf(leads: { status: string }[]): Outcome {
  const registered = leads.filter(lead => lead.status === "registered").length;
  const lost = leads.filter(lead => lead.status === "lost").length;
  const decided = registered + lost;
  return {
    total: leads.length,
    open: leads.length - decided,
    registered,
    lost,
    conversion: decided ? Math.round((registered / decided) * 100) : null,
  };
}

export type BreakdownRow = {
  label: string | null;
  leads: number;
  open: number;
  registered: number;
  lost: number;
  conversion: number | null;
};

function breakdown(
  leads: NccLeadDto[],
  key: (lead: NccLeadDto) => string | null
): BreakdownRow[] {
  const groups = new Map<string | null, NccLeadDto[]>();
  for (const lead of leads) {
    const label = key(lead);
    groups.set(label, [...(groups.get(label) ?? []), lead]);
  }
  return Array.from(groups, ([label, items]) => {
    const outcome = outcomeOf(items);
    return {
      label,
      leads: items.length,
      open: outcome.open,
      registered: outcome.registered,
      lost: outcome.lost,
      conversion: outcome.conversion,
    };
  }).sort(
    (a, b) => b.leads - a.leads || (a.label ?? "").localeCompare(b.label ?? "")
  );
}

export type ShareRow = { label: string | null; count: number; share: number };

function withShare(total: number, rows: { label: string | null; count: number }[]) {
  return rows.map(row => ({
    ...row,
    share: total ? Math.round((row.count / total) * 100) : 0,
  }));
}

function countBy<T>(items: T[], key: (item: T) => string | null) {
  const counts = new Map<string | null, number>();
  for (const item of items) {
    const label = key(item);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return Array.from(counts, ([label, count]) => ({ label, count })).sort(
    (a, b) => b.count - a.count || (a.label ?? "").localeCompare(b.label ?? "")
  );
}

/* ---------------- Admissions ---------------------------------------------- */

export type AdmissionsReport = {
  kpis: Outcome;
  previous: Outcome | null;
  series: ReportSeries;
  funnel: { leads: number; decided: number; registered: number };
  bySource: BreakdownRow[];
  byLostReason: ShareRow[];
  byOwner: BreakdownRow[];
  byArea: BreakdownRow[];
  byBranch: BreakdownRow[] | null;
  byStudyMode: ShareRow[];
  byLeadType: ShareRow[];
};

/** Weekly buckets under ~14 weeks, monthly otherwise — matches the periods. */
const WEEKLY_MAX_DAYS = 100;

export function admissionsReport(
  leads: NccLeadDto[],
  window: ReportWindow,
  previous: ReportWindow,
  today = new Date()
): AdmissionsReport {
  const inPeriod = leads.filter(lead => inWindow(lead.createdAt, window));
  const before = previous
    ? leads.filter(lead => inWindow(lead.createdAt, previous))
    : null;
  const kpis = outcomeOf(inPeriod);
  const lost = inPeriod.filter(lead => lead.status === "lost");

  const weekly =
    window !== null &&
    parseDay(window.to).getTime() - parseDay(window.from).getTime() <=
      WEEKLY_MAX_DAYS * DAY;
  const buckets = weekly ? weekBuckets(window) : monthBuckets(12, today);
  const series: ReportSeries = {
    granularity: weekly ? "week" : "month",
    points: buckets.map(bucket => ({
      from: bucket.from,
      count: inPeriod.filter(
        lead =>
          lead.createdAt.slice(0, 10) >= bucket.from &&
          lead.createdAt.slice(0, 10) <= bucket.to
      ).length,
    })),
  };

  const modeOf = (lead: NccLeadDto) =>
    lead.wantsOnline && lead.wantsOnsite
      ? "both"
      : lead.wantsOnline
        ? "online"
        : lead.wantsOnsite
          ? "onsite"
          : "unset";

  const branches = new Set(inPeriod.map(lead => lead.branchId));

  return {
    kpis,
    previous: before ? outcomeOf(before) : null,
    series,
    funnel: {
      leads: inPeriod.length,
      decided: kpis.registered + kpis.lost,
      registered: kpis.registered,
    },
    bySource: breakdown(inPeriod, lead => lead.source),
    byLostReason: withShare(
      lost.length,
      countBy(lost, lead => lead.lostReasonName ?? null)
    ),
    byOwner: breakdown(inPeriod, lead => lead.assignedSsaName),
    byArea: breakdown(inPeriod, lead => lead.areaOfStudyName ?? null),
    byBranch:
      branches.size > 1
        ? breakdown(inPeriod, lead => lead.branchName ?? lead.branchId)
        : null,
    byStudyMode: withShare(
      inPeriod.length,
      ["online", "onsite", "both", "unset"].map(label => ({
        label,
        count: inPeriod.filter(lead => modeOf(lead) === label).length,
      }))
    ),
    byLeadType: withShare(inPeriod.length, countBy(inPeriod, lead => lead.leadType)),
  };
}

/* ---------------- Bookings ------------------------------------------------- */

export type BookingSide = {
  scheduled: number;
  completed: number;
  noShow: number;
  cancelled: number;
  /** completed / (completed + noShow); null when nobody was due. */
  showRate: number | null;
};

function bookingSide(items: { status: string }[]): BookingSide {
  const count = (status: string) => items.filter(item => item.status === status).length;
  const completed = count("completed");
  const noShow = count("no_show");
  const attended = completed + noShow;
  return {
    scheduled: count("scheduled"),
    completed,
    noShow,
    cancelled: count("cancelled"),
    showRate: attended ? Math.round((completed / attended) * 100) : null,
  };
}

export type BookingsReport = {
  placement: BookingSide;
  trial: BookingSide;
  placementShowRatePrevious: number | null;
  trialShowRatePrevious: number | null;
  placementScore: {
    count: number;
    average: number | null;
    min: number | null;
    max: number | null;
    bands: number[];
  };
  trialResults: ShareRow[];
  trialsByCourse: {
    label: string | null;
    trials: number;
    completed: number;
    showRate: number | null;
  }[];
  trialToRegistered: { converted: number; total: number; rate: number | null };
  byBranch: { label: string | null; placements: number; trials: number }[] | null;
};

export function bookingsReport(
  placements: NccPlacementTestDto[],
  trials: NccTrialLessonDto[],
  leads: NccLeadDto[],
  window: ReportWindow,
  previous: ReportWindow
): BookingsReport {
  const inPlacements = placements.filter(item => inWindow(item.scheduledAt, window));
  const inTrials = trials.filter(item => inWindow(item.scheduledAt, window));
  const beforePlacements = previous
    ? placements.filter(item => inWindow(item.scheduledAt, previous))
    : null;
  const beforeTrials = previous
    ? trials.filter(item => inWindow(item.scheduledAt, previous))
    : null;

  const scores = inPlacements
    .map(item => item.resultScore?.trim())
    .filter((value): value is string => Boolean(value))
    .map(Number)
    .filter(value => Number.isFinite(value));
  const max = scores.length ? Math.max(...scores) : null;
  const bands = [0, 0, 0, 0];
  if (max !== null && max > 0) {
    for (const score of scores) {
      bands[Math.min(3, Math.floor((score / max) * 4))]++;
    }
  } else if (scores.length) {
    bands[0] = scores.length;
  }

  // Result labels are free text in EMS: group case-insensitively, keep the
  // first-seen casing for display.
  const results = new Map<string, { label: string; count: number }>();
  for (const item of inTrials) {
    const raw = item.resultScore?.trim();
    if (!raw) continue;
    const key = raw.toLowerCase();
    const entry = results.get(key) ?? { label: raw, count: 0 };
    entry.count += 1;
    results.set(key, entry);
  }
  const resultRows = Array.from(results.values()).sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label)
  );

  const courses = new Map<string | null, { trials: number; completed: number }>();
  for (const item of inTrials) {
    const label = item.courseName;
    const entry = courses.get(label) ?? { trials: 0, completed: 0 };
    entry.trials += 1;
    if (item.status === "completed") entry.completed += 1;
    courses.set(label, entry);
  }

  const leadById = new Map(leads.map(lead => [lead.id, lead]));
  const completed = inTrials.filter(item => item.status === "completed");
  const joined = completed.filter(
    item => item.subject.type === "student" || leadById.has(item.subject.id)
  );
  const converted = joined.filter(
    item =>
      item.subject.type === "student" ||
      leadById.get(item.subject.id)?.status === "registered"
  ).length;

  const branches = new Map<
    string,
    { label: string | null; placements: number; trials: number }
  >();
  for (const item of inPlacements) {
    const entry = branches.get(item.branchId) ?? {
      label: item.branchName,
      placements: 0,
      trials: 0,
    };
    entry.placements += 1;
    branches.set(item.branchId, entry);
  }
  for (const item of inTrials) {
    const entry = branches.get(item.branchId) ?? {
      label: item.branchName,
      placements: 0,
      trials: 0,
    };
    entry.trials += 1;
    branches.set(item.branchId, entry);
  }

  return {
    placement: bookingSide(inPlacements),
    trial: bookingSide(inTrials),
    placementShowRatePrevious: beforePlacements
      ? bookingSide(beforePlacements).showRate
      : null,
    trialShowRatePrevious: beforeTrials ? bookingSide(beforeTrials).showRate : null,
    placementScore: {
      count: scores.length,
      average: scores.length
        ? Math.round(
            (scores.reduce((sum, value) => sum + value, 0) / scores.length) * 10
          ) / 10
        : null,
      min: scores.length ? Math.min(...scores) : null,
      max,
      bands,
    },
    trialResults: withShare(
      resultRows.reduce((sum, row) => sum + row.count, 0),
      resultRows
    ),
    trialsByCourse: Array.from(courses, ([label, entry]) => ({
      label,
      trials: entry.trials,
      completed: entry.completed,
      showRate: entry.trials ? Math.round((entry.completed / entry.trials) * 100) : null,
    })).sort((a, b) => b.trials - a.trials || (a.label ?? "").localeCompare(b.label ?? "")),
    trialToRegistered: {
      converted,
      total: joined.length,
      rate: joined.length ? Math.round((converted / joined.length) * 100) : null,
    },
    byBranch: branches.size > 1 ? Array.from(branches.values()) : null,
  };
}

/* ---------------- Enrolments ----------------------------------------------- */

export const ENROLMENT_PENDING = [
  "pending_payment",
  "pending_class",
  "pending_group",
] as const;

export type EnrolmentGroupRow = {
  label: string;
  active: number;
  pending: number;
  completed: number;
  leftCancelled: number;
  billed: number;
  collected: number;
  outstanding: number;
};

export type EnrolmentsReport = {
  pipeline: {
    pendingPayment: number;
    pendingClass: number;
    pendingGroup: number;
    enrolled: number;
  };
  enrolledInPeriod: number;
  cancelledInPeriod: number;
  enrolledPrevious: number | null;
  cancelledPrevious: number | null;
  allTime: { completed: number; left: number; cancelled: number };
  money: {
    billed: number;
    collected: number;
    outstanding: number;
    outstandingPending: number;
    collectionRate: number | null;
  };
  byCourse: EnrolmentGroupRow[];
  byBranch: EnrolmentGroupRow[] | null;
  byKind: { individual: number; group: number };
};

export function enrolmentsReport(
  enrolments: NccEnrolmentDto[],
  window: ReportWindow,
  previous: ReportWindow
): EnrolmentsReport {
  const status = (list: NccEnrolmentDto[], value: string) =>
    list.filter(item => item.status === value).length;
  const sum = (list: NccEnrolmentDto[], key: "toBePaid" | "paid" | "remaining") =>
    list.reduce((total, item) => total + (item[key] ?? 0), 0);

  const groupBy = (key: (item: NccEnrolmentDto) => string): EnrolmentGroupRow[] => {
    const groups = new Map<string, NccEnrolmentDto[]>();
    for (const item of enrolments) {
      const label = key(item);
      groups.set(label, [...(groups.get(label) ?? []), item]);
    }
    return Array.from(groups, ([label, items]) => ({
      label,
      active: status(items, "enrolled"),
      pending: ENROLMENT_PENDING.reduce(
        (total, value) => total + status(items, value),
        0
      ),
      completed: status(items, "completed"),
      leftCancelled: status(items, "left") + status(items, "cancelled"),
      billed: sum(items, "toBePaid"),
      collected: sum(items, "paid"),
      outstanding: sum(items, "remaining"),
    })).sort((a, b) => b.billed - a.billed || a.label.localeCompare(b.label));
  };

  const billed = sum(enrolments, "toBePaid");
  const collected = sum(enrolments, "paid");
  const branches = new Set(enrolments.map(item => item.branchId));

  return {
    pipeline: {
      pendingPayment: status(enrolments, "pending_payment"),
      pendingClass: status(enrolments, "pending_class"),
      pendingGroup: status(enrolments, "pending_group"),
      enrolled: status(enrolments, "enrolled"),
    },
    enrolledInPeriod: enrolments.filter(item => inWindow(item.enrolledAt, window)).length,
    cancelledInPeriod: enrolments.filter(item =>
      inWindow(item.cancelledAt, window)
    ).length,
    enrolledPrevious: previous
      ? enrolments.filter(item => inWindow(item.enrolledAt, previous)).length
      : null,
    cancelledPrevious: previous
      ? enrolments.filter(item => inWindow(item.cancelledAt, previous)).length
      : null,
    allTime: {
      completed: status(enrolments, "completed"),
      left: status(enrolments, "left"),
      cancelled: status(enrolments, "cancelled"),
    },
    money: {
      billed,
      collected,
      outstanding: sum(enrolments, "remaining"),
      outstandingPending: sum(
        enrolments.filter(item => item.status === "pending_payment"),
        "remaining"
      ),
      collectionRate: billed ? Math.round((collected / billed) * 100) : null,
    },
    byCourse: groupBy(item => item.courseName),
    byBranch:
      branches.size > 1 ? groupBy(item => item.branchName ?? item.branchId) : null,
    byKind: {
      individual: enrolments.filter(item => item.kind === "individual").length,
      group: enrolments.filter(item => item.kind === "group").length,
    },
  };
}

/* ---------------- Classes -------------------------------------------------- */

export type ClassesReport = {
  kpis: {
    activeClasses: number;
    seatsTaken: number;
    capacity: number;
    fill: number;
    freeSeats: number;
  };
  byCourse: {
    label: string;
    courseId: string;
    classes: number;
    taken: number;
    capacity: number;
    fill: number;
  }[];
  byDepartment: {
    label: string;
    classes: number;
    taken: number;
    capacity: number;
    fill: number;
  }[];
  byBranch:
    | { label: string; classes: number; taken: number; capacity: number; fill: number }[]
    | null;
  teacherLoad: { name: string | null; classes: number; students: number }[];
  endingSoon: { id: string; name: string; endAt: string; daysLeft: number }[];
  weekdayLoad: number[];
};

export function classesReport(
  classes: NccClassDto[],
  today = new Date()
): ClassesReport {
  const taken = classes.reduce((sum, item) => sum + item.activeEnrolmentCount, 0);
  const capacity = classes.reduce((sum, item) => sum + item.capacity, 0);

  const groupBy = (key: (item: NccClassDto) => string) =>
    Array.from(
      classes
        .reduce((map, item) => {
          const label = key(item);
          const entry = map.get(label) ?? {
            courseId: item.courseId,
            label,
            classes: 0,
            taken: 0,
            capacity: 0,
          };
          entry.classes += 1;
          entry.taken += item.activeEnrolmentCount;
          entry.capacity += item.capacity;
          return map.set(label, entry);
        }, new Map<string, { courseId: string; label: string; classes: number; taken: number; capacity: number }>())
        .values()
    )
      .map(entry => ({ ...entry, fill: fillPercent(entry.taken, entry.capacity) }))
      .sort((a, b) => b.fill - a.fill || b.capacity - a.capacity);

  const teachers = new Map<
    string,
    { name: string | null; classes: number; students: number }
  >();
  for (const item of classes) {
    if (item.teachers.length === 0) {
      const entry = teachers.get("__none__") ?? {
        name: null,
        classes: 0,
        students: 0,
      };
      entry.classes += 1;
      entry.students += item.activeEnrolmentCount;
      teachers.set("__none__", entry);
      continue;
    }
    for (const teacher of item.teachers) {
      const entry = teachers.get(teacher.id) ?? {
        name: teacher.name || teacher.email,
        classes: 0,
        students: 0,
      };
      entry.classes += 1;
      entry.students += item.activeEnrolmentCount;
      teachers.set(teacher.id, entry);
    }
  }

  const todayDay = iso(today);
  const limit = iso(shift(today, 30));
  const weekdayLoad = Array.from({ length: 7 }, () => 0);
  for (const item of classes) {
    for (const day of item.schedule.daysOfWeek ?? []) {
      if (day >= 0 && day <= 6) weekdayLoad[day] += 1;
    }
  }

  const branches = new Set(classes.map(item => item.branchId));

  return {
    kpis: {
      activeClasses: classes.length,
      seatsTaken: taken,
      capacity,
      fill: fillPercent(taken, capacity),
      freeSeats: Math.max(0, capacity - taken),
    },
    byCourse: groupBy(item => item.courseName),
    byDepartment: groupBy(item => item.departmentName),
    byBranch: branches.size > 1 ? groupBy(item => item.branchName ?? item.branchId) : null,
    teacherLoad: Array.from(teachers.values()).sort(
      (a, b) =>
        b.classes - a.classes ||
        (a.name === null ? 1 : 0) - (b.name === null ? 1 : 0) ||
        (a.name ?? "").localeCompare(b.name ?? "")
    ),
    endingSoon: classes
      .filter(item => {
        const day = item.endAt.slice(0, 10);
        return day >= todayDay && day <= limit;
      })
      .map(item => ({
        id: item.id,
        name: item.name,
        endAt: item.endAt,
        daysLeft: Math.round(
          (parseDay(item.endAt.slice(0, 10)).getTime() - parseDay(todayDay).getTime()) /
            DAY
        ),
      }))
      .sort((a, b) => a.endAt.localeCompare(b.endAt)),
    weekdayLoad,
  };
}
