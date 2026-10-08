import { describe, expect, it } from "vitest";
import type { NccSessionDto } from "@/lib/backend/api";
import {
  attendanceState,
  changedMarks,
  defaultPlanRows,
  orderStatuses,
  scheduleFromDraft,
  scheduleText,
  sessionLocked,
  splitSessions,
  validateClassDraft,
  validatePlan,
  weekdayName,
  type ClassDraft,
} from "./teaching";

describe("weekdays", () => {
  it("uses EMS order: 0 is Monday", () => {
    expect(weekdayName(0, "long")).toBe("Monday");
    expect(weekdayName(6, "long")).toBe("Sunday");
  });

  it("renders a class schedule in day order", () => {
    expect(
      scheduleText({ daysOfWeek: [3, 1], startTime: "10:00:00", endTime: "11:30:00" })
    ).toBe("Tue, Thu · 10:00–11:30");
    expect(scheduleText({ daysOfWeek: null, startTime: null, endTime: null })).toBeNull();
  });
});

const session = (id: string, startsAt: string, endsAt: string, status: "scheduled" | "cancelled" = "scheduled") =>
  ({ id, startsAt, endsAt, status }) as NccSessionDto;

describe("sessions", () => {
  const now = Date.parse("2026-11-16T12:00:00Z");
  it("splits upcoming, past, and cancelled in reading order", () => {
    const { upcoming, past, cancelled } = splitSessions(
      [
        session("b", "2026-11-18T08:00:00Z", "2026-11-18T09:00:00Z"),
        session("a", "2026-11-17T08:00:00Z", "2026-11-17T09:00:00Z"),
        session("p1", "2026-11-10T08:00:00Z", "2026-11-10T09:00:00Z"),
        session("now", "2026-11-16T11:00:00Z", "2026-11-16T13:00:00Z"),
        session("x", "2026-11-19T08:00:00Z", "2026-11-19T09:00:00Z", "cancelled"),
      ],
      now
    );
    expect(upcoming.map(s => s.id)).toEqual(["now", "a", "b"]);
    expect(past.map(s => s.id)).toEqual(["p1"]);
    expect(cancelled.map(s => s.id)).toEqual(["x"]);
  });

  it("locks sessions that started or were cancelled", () => {
    expect(sessionLocked(session("s", "2026-11-16T11:00:00Z", "2026-11-16T13:00:00Z"), now)).toBe(true);
    expect(sessionLocked(session("s", "2026-11-17T11:00:00Z", "2026-11-17T12:00:00Z"), now)).toBe(false);
  });
});

describe("session planning", () => {
  it("validates days, hours, and range", () => {
    expect(validatePlan([], "2026-11-16", "2026-11-22")).toBe("dayRequired");
    expect(
      validatePlan(
        [
          { weekday: 0, hours: 1 },
          { weekday: 0, hours: 2 },
        ],
        "2026-11-16",
        "2026-11-22"
      )
    ).toBe("dayTwice");
    expect(validatePlan([{ weekday: 0, hours: 0 }], "2026-11-16", "2026-11-22")).toBe("wholeNumber");
    expect(validatePlan([{ weekday: 0, hours: 2 }], "2026-11-22", "2026-11-16")).toBe("rangeInvalid");
    expect(validatePlan([{ weekday: 0, hours: 2 }], "2026-11-16", "2026-11-22")).toBeNull();
  });

  it("starts from the class's usual days and length", () => {
    expect(
      defaultPlanRows({ schedule: { daysOfWeek: [1, 3], startTime: "10:00:00", endTime: "12:00:00" } })
    ).toEqual([
      { weekday: 1, hours: 2 },
      { weekday: 3, hours: 2 },
    ]);
  });
});

describe("class draft", () => {
  const draft: ClassDraft = {
    name: "Arabic A1",
    courseId: "course-1",
    kind: "group",
    capacity: "12",
    startDate: "2026-11-01",
    endDate: "2027-01-31",
    teacherIds: [],
    days: [0, 2],
    startTime: "10:00",
    endTime: "11:30",
    meetingUrl: "",
  };

  it("accepts a complete draft and builds the schedule", () => {
    expect(validateClassDraft(draft, true)).toEqual({});
    expect(scheduleFromDraft(draft)).toEqual({
      daysOfWeek: [0, 2],
      startTime: "10:00",
      endTime: "11:30",
    });
  });

  it("rejects bad seats, dates, times, and links", () => {
    expect(validateClassDraft({ ...draft, capacity: "0" }, true).capacity).toBe("wholeNumber");
    expect(validateClassDraft({ ...draft, endDate: "2026-10-01" }, true).endDate).toBe("endBeforeStart");
    expect(validateClassDraft({ ...draft, endTime: "" }, true).startTime).toBe("timeBoth");
    expect(validateClassDraft({ ...draft, endTime: "09:00" }, true).endTime).toBe("timeOrder");
    expect(validateClassDraft({ ...draft, days: [] }, true).days).toBe("daysNeedTime");
    expect(validateClassDraft({ ...draft, meetingUrl: "http://x" }, true).meetingUrl).toBe("meetingInvalid");
    expect(validateClassDraft({ ...draft, courseId: "" }, false).courseId).toBeUndefined();
  });
});

describe("attendance", () => {
  const detail = {
    students: [
      { studentId: "a", statusId: "5" },
      { studentId: "b", statusId: null },
      { studentId: "c", statusId: null },
    ],
  } as never;

  it("counts marked students with edits over stored marks", () => {
    expect(attendanceState(detail, { b: 6 })).toEqual({
      effective: { a: 5, b: 6, c: null },
      marked: 2,
      total: 3,
    });
  });

  it("sends only real changes", () => {
    expect(changedMarks(detail, { a: 5, b: 6 })).toEqual([{ studentId: "b", statusId: 6 }]);
  });

  it("orders statuses present, late, excused, absent", () => {
    expect(
      orderStatuses([
        { acronym: "A" },
        { acronym: "E" },
        { acronym: "P" },
        { acronym: "L" },
      ]).map(s => s.acronym)
    ).toEqual(["P", "L", "E", "A"]);
  });
});

describe("teacher week", () => {
  it("places sessions on their day in time order and skips cancelled ones", async () => {
    const { weekAgenda } = await import("./teaching");
    const entry = (id: string, startsAt: string, status = "scheduled") => ({
      session: { id, startsAt, status } as NccSessionDto,
      classId: "c",
      className: "Class",
    });
    const days = weekAgenda(
      [
        entry("late", "2026-11-16T14:00:00Z"),
        entry("early", "2026-11-16T08:00:00Z"),
        entry("gone", "2026-11-17T08:00:00Z", "cancelled"),
        entry("outside", "2026-11-30T08:00:00Z"),
      ],
      ["2026-11-16", "2026-11-17"],
      iso => iso.slice(0, 10)
    );
    expect(days.get("2026-11-16")?.map(e => e.session.id)).toEqual(["early", "late"]);
    expect(days.get("2026-11-17")).toEqual([]);
  });

  it("matches the Moodle attendance session by EMS session id", async () => {
    const { attendanceFor } = await import("./teaching");
    expect(attendanceFor("s1", [{ emsSessionId: "s2" }, { emsSessionId: "s1" }])).toEqual({ emsSessionId: "s1" });
    expect(attendanceFor("s3", [{ emsSessionId: null }])).toBeNull();
  });
});
