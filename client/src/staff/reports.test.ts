import { describe, expect, it } from "vitest";
import type {
  NccClassDto,
  NccEnrolmentDto,
  NccLeadDto,
  NccPlacementTestDto,
  NccTrialLessonDto,
} from "@/lib/backend/api";
import {
  admissionsReport,
  bookingsReport,
  classesReport,
  enrolmentsReport,
  inWindow,
  reportWindows,
} from "./reports";

const lead = (over: Partial<NccLeadDto>): NccLeadDto => ({
  id: "lead-1",
  firstName: "A",
  lastName: "B",
  name: "A B",
  email: "a@b.c",
  phone: null,
  branchId: "b1",
  branchName: "Main",
  preferredCourses: [],
  wantsOnline: false,
  wantsOnsite: false,
  entryPath: null,
  source: null,
  notes: null,
  leadType: "new",
  status: "in_process",
  assignedSsaId: null,
  assignedSsaName: null,
  groupId: null,
  groupLabel: null,
  studentId: null,
  createdAt: "2026-03-10T10:00:00Z",
  updatedAt: "2026-03-10T10:00:00Z",
  ...over,
});

const placement = (over: Partial<NccPlacementTestDto>): NccPlacementTestDto => ({
  id: "pl-1",
  branchId: "b1",
  branchName: "Main",
  subject: { type: "lead", id: "lead-1", name: "A B", email: "a@b.c" },
  scheduledAt: "2026-03-10T10:00:00Z",
  roomId: null,
  roomName: null,
  status: "scheduled",
  recommendedCourseId: null,
  recommendedCourseName: null,
  resultScore: null,
  resultNotes: null,
  completedAt: null,
  cancelledAt: null,
  createdAt: null,
  updatedAt: null,
  ...over,
});

const trial = (over: Partial<NccTrialLessonDto>): NccTrialLessonDto => ({
  id: "tr-1",
  branchId: "b1",
  branchName: "Main",
  subject: { type: "lead", id: "lead-1", name: "A B", email: "a@b.c" },
  scheduledAt: "2026-03-10T10:00:00Z",
  roomId: null,
  roomName: null,
  meetingUrl: null,
  areaOfStudyId: null,
  areaOfStudyName: null,
  courseId: null,
  courseName: null,
  status: "scheduled",
  recommendedCourseId: null,
  recommendedCourseName: null,
  resultScore: null,
  resultNotes: null,
  completedAt: null,
  cancelledAt: null,
  createdAt: "2026-03-01T10:00:00Z",
  updatedAt: "2026-03-01T10:00:00Z",
  ...over,
});

const enrolment = (over: Partial<NccEnrolmentDto>): NccEnrolmentDto => ({
  id: "en-1",
  studentId: "st-1",
  studentName: "S",
  courseId: "c1",
  courseName: "English A1",
  kind: "group",
  nextLevel: false,
  branchId: "b1",
  branchName: "Main",
  classId: null,
  className: null,
  status: "enrolled",
  enrolledAt: "2026-03-10T10:00:00Z",
  cancelledAt: null,
  toBePaid: 1000,
  paid: 400,
  remaining: 600,
  student: {
    firstName: "S",
    lastName: "T",
    email: "s@t.u",
    homeBranchId: "b1",
    moodleLinked: false,
  },
  classSummary: null,
  ...over,
});

const klass = (over: Partial<NccClassDto>): NccClassDto => ({
  id: "cl-1",
  name: "Class 1",
  courseId: "c1",
  courseName: "English A1",
  departmentId: "d1",
  departmentName: "English",
  branchId: "b1",
  branchName: "Main",
  capacity: 10,
  startAt: "2026-01-01",
  endAt: "2026-12-31",
  teachers: [],
  teacherIds: [],
  moodleGroupId: null,
  schedule: { daysOfWeek: [1, 3], startTime: "10:00", endTime: "11:00" },
  defaultRoomId: null,
  defaultRoomName: null,
  status: "active",
  sortOrder: 0,
  activeEnrolmentCount: 5,
  createdBy: null,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
  ...over,
});

const TODAY = new Date("2026-03-15T12:00:00Z");
const W = { from: "2026-03-01", to: "2026-03-15" };
const PREV = { from: "2026-02-14", to: "2026-02-28" };

describe("reportWindows", () => {
  it("maps periodWindows to report windows", () => {
    const w = reportWindows("30d", TODAY);
    expect(w.current).toEqual({ from: "2026-02-14", to: "2026-03-15" });
    expect(w.previous).toEqual({ from: "2026-01-15", to: "2026-02-13" });
  });

  it("gives a 365-day window for 12m", () => {
    const w = reportWindows("12m", TODAY);
    expect(w.current).toEqual({ from: "2025-03-16", to: "2026-03-15" });
    expect(w.previous).toEqual({ from: "2024-03-16", to: "2025-03-15" });
  });

  it("has no windows for all", () => {
    expect(reportWindows("all", TODAY)).toEqual({ current: null, previous: null });
  });
});

describe("inWindow", () => {
  it("includes boundary dates and excludes outside", () => {
    expect(inWindow("2026-03-01T00:30:00Z", W)).toBe(true);
    expect(inWindow("2026-03-15T23:00:00Z", W)).toBe(true);
    expect(inWindow("2026-02-28T23:59:00Z", W)).toBe(false);
    expect(inWindow(null, W)).toBe(false);
  });

  it("counts any set date for all-time", () => {
    expect(inWindow("2020-01-01", null)).toBe(true);
    expect(inWindow(null, null)).toBe(false);
  });
});

describe("admissionsReport", () => {
  it("computes outcome KPIs and deltas on empty data", () => {
    const r = admissionsReport([], W, PREV, TODAY);
    expect(r.kpis).toEqual({ total: 0, open: 0, registered: 0, lost: 0, conversion: null });
    expect(r.previous).toEqual(r.kpis);
    expect(r.bySource).toEqual([]);
    expect(r.byBranch).toBeNull();
    expect(r.series.points.length).toBeGreaterThan(0);
  });

  it("counts registered/lost/open and conversion", () => {
    const leads = [
      lead({ id: "1", status: "registered" }),
      lead({ id: "2", status: "lost", lostReasonName: "Price" }),
      lead({ id: "3", status: "in_process" }),
      lead({ id: "4", status: "registered", createdAt: "2026-02-20T00:00:00Z" }), // previous
    ];
    const r = admissionsReport(leads, W, PREV, TODAY);
    expect(r.kpis.total).toBe(3);
    expect(r.kpis.registered).toBe(1);
    expect(r.kpis.lost).toBe(1);
    expect(r.kpis.open).toBe(1);
    expect(r.kpis.conversion).toBe(50);
    expect(r.previous?.registered).toBe(1);
  });

  it("conversion is null when nothing decided", () => {
    const r = admissionsReport([lead({ status: "follow_up" })], W, PREV, TODAY);
    expect(r.kpis.conversion).toBeNull();
  });

  it("groups sources, keeping Form: rows separate and null as missing", () => {
    const leads = [
      lead({ id: "1", source: "website" }),
      lead({ id: "2", source: "website" }),
      lead({ id: "3", source: "Form: Enquiry" }),
      lead({ id: "4", source: "Form: Trial" }),
      lead({ id: "5", source: null }),
    ];
    const r = admissionsReport(leads, W, PREV, TODAY);
    const labels = r.bySource.map(row => row.label);
    expect(labels).toEqual(["website", null, "Form: Enquiry", "Form: Trial"]);
    expect(r.bySource[0].leads).toBe(2);
  });

  it("groups lost reasons and owners with fallbacks", () => {
    const leads = [
      lead({ id: "1", status: "lost", lostReasonName: "Price" }),
      lead({ id: "2", status: "lost", lostReasonName: null }),
      lead({ id: "3", status: "registered", assignedSsaName: "Sara" }),
    ];
    const r = admissionsReport(leads, W, PREV, TODAY);
    expect(r.byLostReason.map(row => [row.label, row.count])).toEqual([
      [null, 1],
      ["Price", 1],
    ]);
    expect(r.byLostReason[0].share).toBe(50);
    expect(r.byOwner.map(row => row.label)).toEqual([null, "Sara"]);
  });

  it("classifies study mode and lead type", () => {
    const leads = [
      lead({ id: "1", wantsOnline: true, wantsOnsite: true }),
      lead({ id: "2", wantsOnline: true }),
      lead({ id: "3", wantsOnsite: true }),
      lead({ id: "4", leadType: "old_student" }),
    ];
    const r = admissionsReport(leads, W, PREV, TODAY);
    const modes = Object.fromEntries(r.byStudyMode.map(row => [row.label, row.count]));
    expect(modes).toEqual({ online: 1, onsite: 1, both: 1, unset: 1 });
    expect(r.byLeadType.find(row => row.label === "new")?.count).toBe(3);
    expect(r.byLeadType.find(row => row.label === "old_student")?.count).toBe(1);
  });

  it("produces weekly buckets for short windows and monthly for all", () => {
    const weekly = admissionsReport([], W, null, TODAY);
    expect(weekly.series.granularity).toBe("week");
    expect(weekly.series.points[0].from).toBe("2026-03-01"); // clipped to the window start
    const monthly = admissionsReport([], null, null, TODAY);
    expect(monthly.series.granularity).toBe("month");
    expect(monthly.series.points).toHaveLength(12);
    expect(monthly.series.points[0].from).toBe("2025-04-01");
    expect(monthly.series.points[11].from).toBe("2026-03-01");
  });

  it("clips the first weekly bucket to the window start", () => {
    // A 30-day window starting mid-week: the first column covers only the
    // window days, not the whole containing week.
    const window = { from: "2026-02-14", to: "2026-03-15" };
    const leads = [
      lead({ id: "early", createdAt: "2026-02-14T08:00:00Z" }),
      lead({ id: "before", createdAt: "2026-02-09T08:00:00Z" }), // same week, outside window
    ];
    const r = admissionsReport(leads, window, null, TODAY);
    expect(r.series.granularity).toBe("week");
    expect(r.series.points[0].from).toBe("2026-02-14");
    expect(r.series.points.every(point => point.from >= window.from)).toBe(true);
    expect(r.series.points[0].count).toBe(1); // the pre-window lead counts nowhere
    expect(r.series.points.reduce((sum, point) => sum + point.count, 0)).toBe(1);
  });

  it("shows the branch breakdown only when more than one branch appears", () => {
    const one = admissionsReport([lead({})], W, null, TODAY);
    expect(one.byBranch).toBeNull();
    const two = admissionsReport(
      [lead({ id: "1" }), lead({ id: "2", branchId: "b2", branchName: "West" })],
      W,
      null,
      TODAY
    );
    expect(two.byBranch?.map(row => row.label)).toEqual(["Main", "West"]);
  });
});

describe("bookingsReport", () => {
  it("counts statuses and show rate per side", () => {
    const placements = [
      placement({ id: "p1", status: "completed" }),
      placement({ id: "p2", status: "no_show" }),
      placement({ id: "p3", status: "scheduled" }),
      placement({ id: "p4", status: "cancelled" }),
    ];
    const r = bookingsReport(placements, [], [], W, PREV);
    expect(r.placement).toEqual({
      scheduled: 1,
      completed: 1,
      noShow: 1,
      cancelled: 1,
      showRate: 50,
    });
  });

  it("show rate is null with no attended bookings", () => {
    const r = bookingsReport(
      [placement({ status: "scheduled" })],
      [],
      [],
      W,
      null
    );
    expect(r.placement.showRate).toBeNull();
  });

  it("filters by scheduledAt and null scheduledAt is excluded", () => {
    const placements = [
      placement({ id: "p1" }),
      placement({ id: "p2", scheduledAt: null }),
      placement({ id: "p3", scheduledAt: "2026-02-20T00:00:00Z" }),
    ];
    const r = bookingsReport(placements, [], [], W, PREV);
    expect(r.placement.scheduled).toBe(1);
    expect(r.placementShowRatePrevious).toBeNull();
  });

  it("summarises numeric scores and bands only", () => {
    const placements = [
      placement({ id: "p1", status: "completed", resultScore: "90" }),
      placement({ id: "p2", status: "completed", resultScore: "30" }),
      placement({ id: "p3", status: "completed", resultScore: "A1" }),
      placement({ id: "p4", status: "completed", resultScore: null }),
    ];
    const r = bookingsReport(placements, [], [], W, null);
    expect(r.placementScore.count).toBe(2);
    expect(r.placementScore.average).toBe(60);
    expect(r.placementScore.min).toBe(30);
    expect(r.placementScore.max).toBe(90);
    expect(r.placementScore.bands.reduce((a, b) => a + b, 0)).toBe(2);
  });

  it("groups trial result labels case-insensitively", () => {
    const trials = [
      trial({ id: "t1", status: "completed", resultScore: "Pass" }),
      trial({ id: "t2", status: "completed", resultScore: " pass " }),
      trial({ id: "t3", status: "completed", resultScore: "Fail" }),
    ];
    const r = bookingsReport([], trials, [], W, null);
    expect(r.trialResults.map(row => [row.label, row.count, row.share])).toEqual([
      ["Pass", 2, 67],
      ["Fail", 1, 33],
    ]);
  });

  it("joins completed trials to leads for the registered rate", () => {
    const leads = [
      lead({ id: "lead-1", status: "registered" }),
      lead({ id: "lead-2", status: "lost" }),
    ];
    const trials = [
      trial({ id: "t1", status: "completed", subject: { type: "lead", id: "lead-1", name: "", email: "" } }),
      trial({ id: "t2", status: "completed", subject: { type: "lead", id: "lead-2", name: "", email: "" } }),
      trial({ id: "t3", status: "completed", subject: { type: "student", id: "st-1", name: "", email: "" } }),
      trial({ id: "t4", status: "completed", subject: { type: "lead", id: "missing", name: "", email: "" } }),
    ];
    const r = bookingsReport([], trials, leads, W, null);
    expect(r.trialToRegistered).toEqual({ converted: 2, total: 3, rate: 67 });
  });
});

describe("enrolmentsReport", () => {
  it("keeps the pipeline separate from in-period counts", () => {
    const list = [
      enrolment({ id: "e1", status: "pending_payment", enrolledAt: null }),
      enrolment({ id: "e2", status: "enrolled", enrolledAt: "2026-03-05T00:00:00Z" }),
      enrolment({
        id: "e3",
        status: "cancelled",
        enrolledAt: "2026-01-01T00:00:00Z",
        cancelledAt: "2026-03-07T00:00:00Z",
      }),
      enrolment({ id: "e4", status: "completed", enrolledAt: null }),
    ];
    const r = enrolmentsReport(list, W, PREV);
    expect(r.pipeline).toEqual({
      pendingPayment: 1,
      pendingClass: 0,
      pendingGroup: 0,
      enrolled: 1,
    });
    expect(r.enrolledInPeriod).toBe(1);
    expect(r.cancelledInPeriod).toBe(1);
    expect(r.allTime.completed).toBe(1);
  });

  it("sums money treating null as zero and gives null rate without billed", () => {
    const list = [
      enrolment({ id: "e1", toBePaid: 1000, paid: 400, remaining: 600 }),
      enrolment({ id: "e2", toBePaid: null, paid: null, remaining: null }),
      enrolment({ id: "e3", status: "pending_payment", toBePaid: 200, paid: 0, remaining: 200 }),
    ];
    const r = enrolmentsReport(list, W, null);
    expect(r.money.billed).toBe(1200);
    expect(r.money.collected).toBe(400);
    expect(r.money.outstanding).toBe(800);
    expect(r.money.outstandingPending).toBe(200);
    expect(r.money.collectionRate).toBe(33);
    const empty = enrolmentsReport([], W, null);
    expect(empty.money.collectionRate).toBeNull();
  });

  it("groups by course with status buckets", () => {
    const list = [
      enrolment({ id: "e1", status: "enrolled", courseName: "A" }),
      enrolment({ id: "e2", status: "pending_class", courseName: "A" }),
      enrolment({ id: "e3", status: "cancelled", courseName: "B" }),
    ];
    const r = enrolmentsReport(list, W, null);
    expect(r.byCourse.map(row => [row.label, row.active, row.pending, row.leftCancelled])).toEqual([
      ["A", 1, 1, 0],
      ["B", 0, 0, 1],
    ]);
    expect(r.byKind).toEqual({ individual: 0, group: 3 });
  });
});

describe("classesReport", () => {
  it("computes fill KPIs on empty and populated lists", () => {
    expect(classesReport([], TODAY).kpis).toEqual({
      activeClasses: 0,
      seatsTaken: 0,
      capacity: 0,
      fill: 0,
      freeSeats: 0,
    });
    const r = classesReport(
      [
        klass({ capacity: 10, activeEnrolmentCount: 7 }),
        klass({ id: "c2", capacity: 0, activeEnrolmentCount: 0 }),
      ],
      TODAY
    );
    expect(r.kpis.fill).toBe(70);
    expect(r.kpis.freeSeats).toBe(3);
  });

  it("loads teacher rows including an unassigned bucket", () => {
    const r = classesReport(
      [
        klass({ id: "c1", teachers: [{ id: "t1", name: "Sara", email: "s@x" }] }),
        klass({ id: "c2", teachers: [] }),
      ],
      TODAY
    );
    expect(r.teacherLoad.map(row => [row.name, row.classes])).toEqual([
      ["Sara", 1],
      [null, 1],
    ]);
  });

  it("flags classes ending within 30 days and counts weekday load", () => {
    const r = classesReport(
      [
        klass({ id: "c1", endAt: "2026-03-20" }),
        klass({ id: "c2", endAt: "2026-06-01" }),
      ],
      TODAY
    );
    expect(r.endingSoon.map(row => [row.id, row.daysLeft])).toEqual([["c1", 5]]);
    expect(r.weekdayLoad[1]).toBe(2); // both classes meet Monday
    expect(r.weekdayLoad[3]).toBe(2);
    expect(r.weekdayLoad[0]).toBe(0);
  });
});
