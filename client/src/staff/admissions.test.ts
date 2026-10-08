import { describe, expect, it } from "vitest";
import {
  ageOn,
  identityPayload,
  leadJourney,
  paidShare,
  parseAmount,
  validateIdentity,
  type IdentityInput,
} from "./admissions";

const lead = (overrides: Partial<Parameters<typeof leadJourney>[0]> = {}) => ({
  status: "in_process" as const,
  entryPath: "unset" as const,
  studentId: null,
  registration: null,
  ...overrides,
});
const fee = {
  id: "r",
  branchId: "b",
  toBePaid: 500,
  paid: 200,
  remaining: 300,
};

describe("leadJourney", () => {
  it("starts new leads at the placement test", () => {
    const { next, steps } = leadJourney(lead(), [], []);
    expect(next).toBe("book_placement");
    expect(steps).toEqual({
      contact: "done",
      placement: "now",
      trial: "later",
      fee: "later",
      student: "later",
    });
  });

  it("honours direct and trial entry paths", () => {
    expect(leadJourney(lead({ entryPath: "direct" }), [], []).next).toBe("fee");
    expect(
      leadJourney(lead({ entryPath: "direct" }), [], []).steps.placement
    ).toBe("skipped");
    expect(leadJourney(lead({ entryPath: "trial" }), [], []).next).toBe(
      "book_trial"
    );
  });

  it("asks for results while a booking is scheduled", () => {
    expect(leadJourney(lead(), [{ status: "scheduled" }], []).next).toBe(
      "record_placement"
    );
    expect(
      leadJourney(lead(), [{ status: "completed" }], [{ status: "scheduled" }])
        .next
    ).toBe("record_trial");
  });

  it("ignores cancelled and missed bookings", () => {
    const result = leadJourney(
      lead(),
      [{ status: "cancelled" }, { status: "no_show" }],
      []
    );
    expect(result.next).toBe("book_placement");
  });

  it("moves to the fee after a completed test, then to conversion", () => {
    const afterTest = leadJourney(lead(), [{ status: "completed" }], []);
    expect(afterTest.next).toBe("fee");
    expect(afterTest.steps.placement).toBe("done");
    expect(afterTest.steps.fee).toBe("now");
    const afterFee = leadJourney(
      lead({ registration: fee }),
      [{ status: "completed" }],
      []
    );
    expect(afterFee.next).toBe("convert");
    expect(afterFee.steps.trial).toBe("skipped");
    expect(afterFee.steps.student).toBe("now");
  });

  it("ends at the student record or a lost lead", () => {
    const student = leadJourney(
      lead({ studentId: "s-1", status: "registered" }),
      [],
      []
    );
    expect(student.next).toBe("open_student");
    expect(student.steps.student).toBe("done");
    expect(student.steps.placement).toBe("skipped");
    expect(
      leadJourney(lead({ status: "lost" }), [{ status: "scheduled" }], []).next
    ).toBe("lost");
  });
});

describe("money helpers", () => {
  it("parses typed amounts strictly", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount(" 1,250.5 ")).toBe(1250.5);
    expect(parseAmount("12.345")).toBeNaN();
    expect(parseAmount("-3")).toBeNaN();
  });

  it("computes the paid share for the progress bar", () => {
    expect(paidShare({ toBePaid: 500, paid: 200 })).toBe(0.4);
    expect(paidShare({ toBePaid: 0, paid: null })).toBe(1);
    expect(paidShare({ toBePaid: 100, paid: 150 })).toBe(1);
  });
});

describe("validateIdentity", () => {
  const base: IdentityInput = {
    nationality: "egy",
    address: "12 Nile St",
    gender: "female",
    dateOfBirth: "2012-03-04",
    nationalId: "30101011234567",
    passportNumber: "",
    guardians: [
      {
        name: "Mona",
        phone: "+20100",
        email: "mona@example.com",
        relationship: "Mother",
      },
    ],
  };
  const today = new Date("2026-10-07T12:00:00Z");

  it("accepts a complete Egyptian minor", () => {
    expect(validateIdentity(base, today)).toEqual({});
  });

  it("requires a national ID for Egyptian nationals only", () => {
    expect(
      validateIdentity({ ...base, nationalId: "" }, today).nationalId
    ).toBe("nationalIdRequired");
    expect(
      validateIdentity({ ...base, nationality: "SAU", nationalId: "" }, today)
        .nationalId
    ).toBeUndefined();
    expect(
      validateIdentity({ ...base, nationalId: "123" }, today).nationalId
    ).toBe("invalidNationalId");
  });

  it("requires a guardian under 18 and complete guardian rows", () => {
    expect(validateIdentity({ ...base, guardians: [] }, today).guardians).toBe(
      "guardianRequired"
    );
    expect(
      validateIdentity(
        { ...base, dateOfBirth: "2000-01-01", guardians: [] },
        today
      ).guardians
    ).toBeUndefined();
    expect(
      validateIdentity(
        {
          ...base,
          guardians: [{ name: "X", phone: "", email: "", relationship: "" }],
        },
        today
      ).guardians
    ).toBe("guardianIncomplete");
  });

  it("computes age around the birthday", () => {
    expect(ageOn("2008-10-07", today)).toBe(18);
    expect(ageOn("2008-10-08", today)).toBe(17);
  });

  it("builds the BFF payload with ordered guardians", () => {
    expect(identityPayload({ ...base, passportNumber: " A1 " })).toMatchObject({
      nationality: "EGY",
      nationalId: "30101011234567",
      passportNumber: "A1",
      guardians: [{ sortOrder: 1, name: "Mona" }],
    });
  });
});

describe("agenda helpers", async () => {
  const { dayKey, needsOutcome } = await import("./pages/booking-list");
  const { leadListQuery } = await import("./pages/leads-page");

  it("flags past scheduled bookings that still need a result", () => {
    const now = Date.parse("2026-10-07T12:00:00Z");
    expect(
      needsOutcome(
        { status: "scheduled", scheduledAt: "2026-10-07T09:00:00Z" },
        now
      )
    ).toBe(true);
    expect(
      needsOutcome(
        { status: "scheduled", scheduledAt: "2026-10-08T09:00:00Z" },
        now
      )
    ).toBe(false);
    expect(
      needsOutcome(
        { status: "completed", scheduledAt: "2026-10-01T09:00:00Z" },
        now
      )
    ).toBe(false);
  });

  it("groups by the branch calendar day, not UTC", () => {
    expect(dayKey("2026-10-07T22:30:00Z", "Africa/Cairo")).toBe("2026-10-08");
    expect(dayKey("2026-10-07T22:30:00Z", "UTC")).toBe("2026-10-07");
  });

  it("maps short URL filters to the BFF lead query", () => {
    expect(
      leadListQuery({
        pageSize: 25,
        q: "sara",
        mode: "online",
        owner: "none",
        area: "a-1",
        page: 2,
      })
    ).toEqual({
      pageSize: 25,
      page: 2,
      q: "sara",
      areaOfStudyId: "a-1",
      wantsOnline: true,
      unassigned: true,
    });
    expect(
      leadListQuery({ pageSize: 25, owner: "ssa-1", mode: "onsite" })
    ).toEqual({
      pageSize: 25,
      assignedSsaId: "ssa-1",
      wantsOnsite: true,
    });
  });
});

describe("enrolment actions", async () => {
  const { enrolmentActions } = await import("./pages/enrolment-actions");
  const sale = (status: string, extra: Record<string, unknown> = {}) =>
    ({ status, nextLevel: false, classId: null, ...extra }) as Parameters<
      typeof enrolmentActions
    >[0];

  it("offers payment and cancel while waiting, and class only once paid", () => {
    expect(enrolmentActions(sale("pending_payment"))).toEqual({
      payment: true,
      attach: false,
      complete: false,
      leave: false,
      cancel: true,
    });
    expect(enrolmentActions(sale("pending_group")).attach).toBe(true);
    expect(
      enrolmentActions(sale("pending_class", { classId: "c-1" })).attach
    ).toBe(false);
  });

  it("completes enrolled sales and allows leave only for next level", () => {
    expect(enrolmentActions(sale("enrolled")).complete).toBe(true);
    expect(enrolmentActions(sale("enrolled")).leave).toBe(false);
    expect(enrolmentActions(sale("enrolled", { nextLevel: true })).leave).toBe(
      true
    );
    expect(
      Object.values(enrolmentActions(sale("completed"))).some(Boolean)
    ).toBe(false);
    expect(
      Object.values(enrolmentActions(sale("cancelled"))).some(Boolean)
    ).toBe(false);
  });
});
