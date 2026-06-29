import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { platformStore } from "./store";

function createLocalStorageMock(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: vi.fn(() => values.clear()),
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    key: vi.fn((index: number) => Array.from(values.keys())[index] ?? null),
    removeItem: vi.fn((key: string) => values.delete(key)),
    setItem: vi.fn((key: string, value: string) =>
      values.set(key, String(value))
    ),
  };
}

beforeEach(() => {
  vi.stubGlobal("window", { localStorage: createLocalStorageMock() });
  platformStore.reset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("platformStore workflow guards", () => {
  it("does not increase enrollment progress twice for the same completed lesson", () => {
    const state = platformStore.getState();
    const lesson = state.lessons[0];
    const module = state.modules.find(item => item.id === lesson.moduleId);
    const courseRun = state.courseRuns.find(
      item => item.courseId === module?.courseId
    );
    const initialEnrollment = state.enrollments.find(
      item =>
        item.courseRunId === courseRun?.id && item.studentId === "stu_demo"
    );

    platformStore.completeLesson(lesson.id);
    const afterFirst = platformStore
      .getState()
      .enrollments.find(item => item.id === initialEnrollment?.id);

    platformStore.completeLesson(lesson.id);
    const afterSecond = platformStore
      .getState()
      .enrollments.find(item => item.id === initialEnrollment?.id);

    expect(afterFirst?.progress).toBe(
      Math.min(100, (initialEnrollment?.progress ?? 0) + 6)
    );
    expect(afterSecond?.progress).toBe(afterFirst?.progress);
  });

  it("starts a lesson without downgrading an already completed lesson", () => {
    const lesson = platformStore
      .getState()
      .lessons.find(item => item.id === "lesson_ar_patterns");
    expect(lesson).toBeTruthy();

    platformStore.startLesson(lesson!.id);
    const progress = platformStore
      .getState()
      .lessonProgress.find(
        item => item.lessonId === lesson!.id && item.studentId === "stu_demo"
      );

    expect(progress?.status).toBe("completed");
  });

  it("updates one pending assignment submission instead of duplicating it", () => {
    const assignment = platformStore.getState().assignments[0];

    const first = platformStore.submitAssignment(
      assignment.id,
      "First response"
    );
    const second = platformStore.submitAssignment(
      assignment.id,
      "Second response"
    );
    const submissions = platformStore
      .getState()
      .assignmentSubmissions.filter(
        item =>
          item.assignmentId === assignment.id && item.studentId === "stu_demo"
      );

    expect(submissions).toHaveLength(1);
    expect(second.id).toBe(first.id);
    expect(submissions[0].response).toBe("Second response");
  });

  it("does not create quiz attempts after the configured attempt limit", () => {
    const quiz = platformStore.getState().quizzes[0];

    platformStore.submitQuizAttempt(quiz.id, { q1: "first" });
    const allowedState = platformStore.getState();
    const allowedAttempts = allowedState.quizAttempts.filter(
      item => item.quizId === quiz.id && item.studentId === "stu_demo"
    );

    platformStore.submitQuizAttempt(quiz.id, { q1: "second" });
    const cappedAttempts = platformStore
      .getState()
      .quizAttempts.filter(
        item => item.quizId === quiz.id && item.studentId === "stu_demo"
      );

    expect(allowedAttempts).toHaveLength(quiz.attemptsAllowed);
    expect(cappedAttempts).toHaveLength(quiz.attemptsAllowed);
  });

  it("updates attendance by matching session or event id instead of duplicating it", () => {
    const before = platformStore.getState();
    const existing = before.attendance.find(
      item =>
        item.classGroupId === "class_ar_l3_a" &&
        item.studentId === "stu_demo" &&
        item.sessionId === "evt_ar_live"
    );
    expect(existing).toBeTruthy();

    platformStore.saveAttendanceBulk("class_ar_l3_a", "session_ar_live", {
      stu_demo: "late",
    });
    const after = platformStore.getState();
    const records = after.attendance.filter(
      item =>
        item.classGroupId === "class_ar_l3_a" &&
        item.studentId === "stu_demo" &&
        (item.sessionId === "session_ar_live" ||
          item.sessionId === "evt_ar_live")
    );

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      sessionId: "session_ar_live",
      status: "late",
    });
    expect(
      after.classSessions.find(item => item.id === "session_ar_live")
        ?.attendanceSaved
    ).toBe(true);
  });

  it("records only the outstanding payment amount once", () => {
    const invoice = platformStore.getState().invoices[0];

    platformStore.recordPayment(invoice.id);
    const afterFirst = platformStore.getState();
    const firstPayments = afterFirst.payments.filter(
      item => item.invoiceId === invoice.id
    );

    platformStore.recordPayment(invoice.id);
    const afterSecond = platformStore.getState();
    const secondPayments = afterSecond.payments.filter(
      item => item.invoiceId === invoice.id
    );

    expect(
      afterFirst.invoices.find(item => item.id === invoice.id)?.status
    ).toBe("paid");
    expect(firstPayments).toHaveLength(2);
    expect(secondPayments).toHaveLength(2);
  });

  it("reuses an application when converting the same lead again", () => {
    const lead = platformStore.createLead({
      fullName: "Regression Lead",
      email: "regression.lead@nilelearn.local",
      phone: "+20 100 000 0100",
      subject: "Arabic Language",
      notes: "Regression test lead",
    });

    const first = platformStore.convertLeadToApplication(lead.id);
    const second = platformStore.convertLeadToApplication(lead.id);
    const applications = platformStore
      .getState()
      .applications.filter(item => item.leadId === lead.id);

    expect(applications).toHaveLength(1);
    expect(second.id).toBe(first.id);
  });

  it("does not duplicate certificate issue notifications or audit entries", () => {
    const certificate = platformStore.getState().certificates[0];

    platformStore.approveCertificate(certificate.id, "usr_hod_demo");
    platformStore.issueCertificate(certificate.id, "usr_hod_demo");
    const afterFirst = platformStore.getState();
    platformStore.issueCertificate(certificate.id, "usr_hod_demo");
    const afterSecond = platformStore.getState();

    expect(
      afterSecond.certificates.find(item => item.id === certificate.id)?.status
    ).toBe("issued");
    expect(
      afterSecond.notifications.filter(
        item => item.title === "Certificate issued"
      )
    ).toHaveLength(
      afterFirst.notifications.filter(
        item => item.title === "Certificate issued"
      ).length
    );
    expect(
      afterSecond.auditLogs.filter(item => item.action === "certificate.issued")
    ).toHaveLength(1);
  });

  it("does not issue a certificate before approval", () => {
    const certificate = platformStore.getState().certificates[0];

    const issued = platformStore.issueCertificate(certificate.id, "usr_hod_demo");
    const after = platformStore.getState();

    expect(issued).toBeUndefined();
    expect(
      after.certificates.find(item => item.id === certificate.id)?.status
    ).toBe("pending_approval");
    expect(
      after.notifications.filter(item => item.title === "Certificate issued")
    ).toHaveLength(0);
    expect(
      after.auditLogs.filter(item => item.action === "certificate.issued")
    ).toHaveLength(0);
  });

  it("does not create a class session for a cross-branch class group", () => {
    const before = platformStore.getState();
    const onlineClass = before.classGroups.find(
      item => item.id === "class_ar_l3_a"
    );
    expect(onlineClass).toBeTruthy();

    const result = platformStore.createCalendarEvent(
      {
        title: "Cairo branch live class",
        type: "live_session",
        startsAt: "2026-07-04T10:00:00+03:00",
        endsAt: "2026-07-04T11:00:00+03:00",
        ownerId: "usr_branch_demo",
        branchId: "br_cairo",
        classGroupId: onlineClass!.id,
      },
      "usr_branch_demo"
    );
    const after = platformStore.getState();

    expect(result.event.branchId).toBe("br_cairo");
    expect(result.event.classGroupId).toBeUndefined();
    expect(
      after.classSessions.some(item => item.eventId === result.event.id)
    ).toBe(false);
  });

  it("creates a student recitation submission with teacher notification and audit", () => {
    const plan = platformStore
      .getState()
      .quranPlans.find(item => item.studentId === "stu_demo");
    expect(plan).toBeTruthy();

    const submission = platformStore.submitRecitation(
      {
        studentId: "stu_demo",
        teacherId: plan!.teacherId,
        title: "Surah Al-Baqarah review",
      },
      "usr_student_demo"
    );
    const after = platformStore.getState();

    expect(submission).toMatchObject({
      studentId: "stu_demo",
      teacherId: plan!.teacherId,
      status: "pending",
    });
    expect(after.recitationSubmissions[0].id).toBe(submission.id);
    expect(
      after.notifications.some(
        item =>
          item.userId === plan!.teacherId &&
          item.title === "Recitation submitted"
      )
    ).toBe(true);
    expect(
      after.auditLogs.some(
        item =>
          item.action === "recitation.submitted" &&
          item.entityId === submission.id
      )
    ).toBe(true);
  });

  it("creates teacher assignments and quizzes in the selected course run", () => {
    const run = platformStore.getState().courseRuns[0];

    const assignment = platformStore.createAssignment(
      {
        courseRunId: run.id,
        title: "Teacher regression assignment",
        dueAt: "2026-07-03T18:00:00.000Z",
        submissionType: "text",
        rubric: ["Accuracy", "Clarity"],
      },
      "usr_teacher_demo"
    );
    const quiz = platformStore.createQuiz(
      {
        courseRunId: run.id,
        title: "Teacher regression quiz",
        durationMinutes: 15,
        attemptsAllowed: 2,
        questionTypes: ["multiple_choice", "short_answer"],
      },
      "usr_teacher_demo"
    );
    const after = platformStore.getState();

    expect(after.assignments[0]).toMatchObject({
      id: assignment.id,
      courseRunId: run.id,
      status: "active",
    });
    expect(after.quizzes[0]).toMatchObject({
      id: quiz.id,
      courseRunId: run.id,
      status: "active",
    });
    expect(after.auditLogs[0].action).toBe("quiz.created");
    expect(after.auditLogs[1].action).toBe("assignment.created");
  });

  it("grades assignment submissions into grades, notifications, and audit", () => {
    const submission = platformStore.getState().assignmentSubmissions[0];

    const graded = platformStore.gradeAssignmentSubmission(
      submission.id,
      91,
      "Strong regression answer.",
      "usr_teacher_demo"
    );
    const after = platformStore.getState();

    expect(graded).toMatchObject({
      id: submission.id,
      status: "completed",
      score: 91,
      feedback: "Strong regression answer.",
    });
    expect(after.grades[0]).toMatchObject({
      studentId: submission.studentId,
      score: 91,
      feedback: "Strong regression answer.",
    });
    expect(after.notifications[0]).toMatchObject({
      userId: "usr_student_demo",
      title: "Assignment graded",
    });
    expect(after.auditLogs[0].action).toBe("assignment.graded");
  });
});

describe("platformStore frontend utility helpers", () => {
  it("verifies issued certificates by code with student and course context", () => {
    const certificate = platformStore.getState().certificates[0];
    platformStore.approveCertificate(certificate.id, "usr_hod_demo");
    platformStore.issueCertificate(certificate.id, "usr_hod_demo");

    const result = platformStore.verifyCertificate(
      `  ${certificate.verificationCode.toLowerCase()}  `
    );

    expect(result?.certificate.id).toBe(certificate.id);
    expect(result?.user?.name).toBe("Student Demo");
    expect(result?.course?.title).toBe("Standard Arabic Level 3");
  });

  it("does not verify pending certificates by code", () => {
    const certificate = platformStore.getState().certificates[0];

    expect(platformStore.verifyCertificate(certificate.verificationCode)).toBeNull();
  });

  it("returns null for unknown certificate codes", () => {
    expect(platformStore.verifyCertificate("NCL-UNKNOWN")).toBeNull();
  });

  it("exports finance report rows with paid and balance totals", () => {
    const invoice = platformStore.getState().invoices[0];

    const rows = platformStore.exportReportRows("finance");
    const row = rows.find(item => item.id === invoice.id);

    expect(row).toMatchObject({
      id: invoice.id,
      amount: 2400,
      paid: 1200,
      balance: 1200,
      status: "pending",
    });
  });

  it("builds escaped CSV from report rows", () => {
    const csv = platformStore.buildCsv([
      { name: "Student, Demo", note: "Line one\nLine two", score: 88 },
    ]);

    expect(csv).toContain("name,note,score");
    expect(csv).toContain('"Student, Demo"');
    expect(csv).toContain('"Line one\nLine two"');
  });
});
