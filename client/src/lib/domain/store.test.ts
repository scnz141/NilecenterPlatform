import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { platformStore } from "./store";
import { applyPlatformWorkflowAction } from "./actions";
import type { PendingMediaAttachment } from "./types";

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

function pendingMedia(
  kind: PendingMediaAttachment["kind"] = "audio"
): PendingMediaAttachment {
  return {
    id: `pending_${kind}`,
    name: kind === "audio" ? "recitation.mp3" : "worksheet.pdf",
    type: kind === "audio" ? "audio/mpeg" : "application/pdf",
    size: 2048,
    kind,
    previewLabel:
      kind === "audio" ? "recitation.mp3 · 2 KB" : "worksheet.pdf · 2 KB",
    storageStatus: "pending_storage",
    createdAt: "2026-07-06T10:00:00.000Z",
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
  it("starts without hardcoded entity rows until the server snapshot hydrates it", () => {
    window.localStorage.clear();

    const state = platformStore.getState();

    expect(state.users).toEqual([]);
    expect(state.students).toEqual([]);
    expect(state.courses).toEqual([]);
    expect(state.classGroups).toEqual([]);
    expect(state.auditLogs).toEqual([]);
  });

  it("keeps a scoped snapshot authoritative instead of merging global seed rows", () => {
    const scoped = platformStore.getState();
    scoped.users = scoped.users.filter(item => item.id === "usr_student_demo");
    scoped.staffProfiles = [];
    scoped.courseRuns = scoped.courseRuns.filter(
      item => item.id === "run_ar_l3_2026"
    );
    scoped.classGroups = scoped.classGroups.filter(
      item => item.id === "class_ar_l3_a"
    );
    scoped.events = scoped.events.filter(item => item.id === "evt_ar_live");
    scoped.portalSettings = [];

    platformStore.setState(scoped);
    const restored = platformStore.getState();

    expect(restored.users.map(item => item.id)).toEqual(["usr_student_demo"]);
    expect(restored.staffProfiles).toEqual([]);
    expect(restored.courseRuns.map(item => item.id)).toEqual([
      "run_ar_l3_2026",
    ]);
    expect(restored.classGroups.map(item => item.id)).toEqual([
      "class_ar_l3_a",
    ]);
    expect(restored.events.map(item => item.id)).toEqual(["evt_ar_live"]);
    expect(restored.portalSettings).toEqual([]);
  });

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
    const courseModuleIds = new Set(
      state.modules
        .filter(item => item.courseId === module?.courseId)
        .map(item => item.id)
    );
    const courseLessonIds = new Set(
      state.lessons
        .filter(item => courseModuleIds.has(item.moduleId))
        .map(item => item.id)
    );
    const completedLessonIds = new Set(
      state.lessonProgress
        .filter(
          item =>
            item.studentId === "stu_demo" &&
            item.enrollmentId === initialEnrollment?.id &&
            item.status === "completed" &&
            courseLessonIds.has(item.lessonId)
        )
        .map(item => item.lessonId)
    );
    completedLessonIds.add(lesson.id);
    const expectedProgress = Math.round(
      (completedLessonIds.size / courseLessonIds.size) * 100
    );

    platformStore.completeLesson(
      lesson.id,
      "stu_demo",
      "usr_student_demo",
      initialEnrollment?.id
    );
    const afterFirst = platformStore
      .getState()
      .enrollments.find(item => item.id === initialEnrollment?.id);

    platformStore.completeLesson(
      lesson.id,
      "stu_demo",
      "usr_student_demo",
      initialEnrollment?.id
    );
    const afterSecond = platformStore
      .getState()
      .enrollments.find(item => item.id === initialEnrollment?.id);

    expect(afterFirst?.progress).toBe(expectedProgress);
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

  it("rejects blank assignment submissions", () => {
    const assignment = platformStore.getState().assignments[0];

    expect(() => platformStore.submitAssignment(assignment.id, "   ")).toThrow(
      "Assignment response or attachment is required"
    );
  });

  it("stores pending media metadata for file and audio submissions", () => {
    const assignment = platformStore
      .getState()
      .assignments.find(item => item.id === "asg_qt_audio");
    expect(assignment).toBeTruthy();

    const submission = platformStore.submitAssignment(
      assignment!.id,
      "",
      "stu_demo",
      "usr_student_demo",
      [pendingMedia("audio")]
    );

    expect(submission.pendingMedia).toHaveLength(1);
    expect(submission.pendingMedia?.[0]).toMatchObject({
      name: "recitation.mp3",
      storageStatus: "pending_storage",
      kind: "audio",
    });
  });

  it("rejects assessment creation for missing course runs", () => {
    expect(() =>
      platformStore.createAssignment({
        courseRunId: "run_missing",
        title: "Unscoped assignment",
        dueAt: "2026-07-20T18:00:00+03:00",
        submissionType: "text",
        rubric: ["Accuracy"],
      })
    ).toThrow("Course run run_missing was not found");

    expect(() =>
      platformStore.createQuiz({
        courseRunId: "run_missing",
        title: "Unscoped quiz",
        dueAt: "2026-07-20T18:00:00+03:00",
        durationMinutes: 20,
        attemptsAllowed: 1,
        questionTypes: ["short_answer"],
      })
    ).toThrow("Course run run_missing was not found");
  });

  it("normalizes quiz duration, attempts, and question types", () => {
    const run = platformStore.getState().courseRuns[0];

    const quiz = platformStore.createQuiz({
      courseRunId: run.id,
      title: "  Trimmed quiz  ",
      dueAt: "2026-07-20T18:00:00+03:00",
      durationMinutes: -20,
      attemptsAllowed: 0,
      questionTypes: ["", "  "],
    });

    expect(quiz.title).toBe("Trimmed quiz");
    expect(quiz.durationMinutes).toBe(5);
    expect(quiz.attemptsAllowed).toBe(1);
    expect(quiz.questionTypes).toEqual(["short_answer"]);
    expect(quiz.questionIds).toEqual([]);
  });

  it("sets quiz questions with dedupe, derived types, and audit evidence", () => {
    const state = platformStore.getState();
    const run = state.courseRuns.find(item => item.id === "run_ar_l3_2026");
    const quiz = platformStore.createQuiz({
      courseRunId: run!.id,
      title: "Draft question set quiz",
      dueAt: "2026-07-20T18:00:00+03:00",
      durationMinutes: 20,
      attemptsAllowed: 1,
      questionTypes: ["short_answer"],
    });
    const questions = state.questionBankItems.filter(
      item => item.courseRunId === quiz?.courseRunId
    );
    expect(quiz).toBeTruthy();
    expect(questions.length).toBeGreaterThanOrEqual(2);

    const updated = platformStore.setQuizQuestions(quiz!.id, [
      questions[0].id,
      questions[1].id,
      questions[0].id,
    ]);
    const after = platformStore.getState();

    expect(updated.questionIds).toEqual([questions[0].id, questions[1].id]);
    expect(updated.questionTypes).toEqual(
      Array.from(new Set([questions[0].type, questions[1].type]))
    );
    expect(after.auditLogs[0]).toMatchObject({
      action: "quiz.questions.updated",
      entityType: "Quiz",
      entityId: quiz!.id,
    });
  });

  it("rejects quiz question attachment across course runs", () => {
    const state = platformStore.getState();
    const quiz = platformStore.createQuiz({
      courseRunId: "run_ar_l3_2026",
      title: "Draft cross-run quiz",
      dueAt: "2026-07-20T18:00:00+03:00",
      durationMinutes: 20,
      attemptsAllowed: 1,
      questionTypes: ["short_answer"],
    });
    const otherRunQuestion = state.questionBankItems.find(
      item => item.courseRunId !== quiz?.courseRunId
    );

    expect(() =>
      platformStore.setQuizQuestions(quiz!.id, [otherRunQuestion!.id])
    ).toThrow("Quiz questions must belong to the same course run");
  });

  it("creates normalized question bank items with audit evidence", () => {
    const run = platformStore.getState().courseRuns[0];

    const question = platformStore.createQuestionBankItem({
      courseRunId: run.id,
      prompt: "  Explain the rule with one example.  ",
      questionType: "essay",
      difficulty: "challenge",
      tags: [" grammar ", "", "review"],
      choices: ["", "Choice A"],
      answerKey: "  Teacher key  ",
      rubric: [" Accuracy ", ""],
    });
    const state = platformStore.getState();

    expect(question.prompt).toBe("Explain the rule with one example.");
    expect(question.tags).toEqual(["grammar", "review"]);
    expect(question.choices).toEqual(["Choice A"]);
    expect(question.answerKey).toBe("Teacher key");
    expect(question.rubric).toEqual(["Accuracy"]);
    expect(state.questionBankItems[0].id).toBe(question.id);
    expect(state.auditLogs[0]).toMatchObject({
      action: "question.created",
      entityType: "QuestionBankItem",
      entityId: question.id,
    });
  });

  it("rejects invalid question bank creation", () => {
    const run = platformStore.getState().courseRuns[0];

    expect(() =>
      platformStore.createQuestionBankItem({
        courseRunId: "run_missing",
        prompt: "Valid prompt",
        questionType: "short_answer",
        difficulty: "core",
        tags: [],
      })
    ).toThrow("Course run run_missing was not found");

    expect(() =>
      platformStore.createQuestionBankItem({
        courseRunId: run.id,
        prompt: "   ",
        questionType: "short_answer",
        difficulty: "core",
        tags: [],
      })
    ).toThrow("Question prompt is required");
  });

  it("creates a connected student account with enrollment, class roster, and lesson progress", () => {
    const before = platformStore.getState();
    const classBefore = before.classGroups.find(
      item => item.id === "class_ar_l3_a"
    );
    const lessonCount = before.modules
      .filter(item => item.courseId === "course_ar_l3")
      .flatMap(module =>
        before.lessons.filter(lesson => lesson.moduleId === module.id)
      ).length;

    const result = platformStore.applyAction({
      type: "user.create",
      name: "QA Student Account",
      email: "qa.student.account@nilelearn.local",
      phone: "+20 100 000 0101",
      role: "student",
      branchId: "br_online",
      departmentId: "dep_arabic",
      status: "active",
      preferredLanguage: "English",
      courseRunId: "run_ar_l3_2026",
      classGroupId: "class_ar_l3_a",
      currentLevel: "Arabic Level 3",
      ageGroup: "Adult",
      notes: "Created by unit test.",
      actorId: "usr_admin_demo",
    });
    const after = platformStore.getState();
    const created = result.result as {
      user: { id: string; activeRole: string };
      student: { id: string; userId: string };
      enrollment: { studentId: string; courseRunId: string };
    };
    const classAfter = after.classGroups.find(
      item => item.id === "class_ar_l3_a"
    );

    expect(created.user.activeRole).toBe("student");
    expect(created.student.userId).toBe(created.user.id);
    expect(created.enrollment).toMatchObject({
      studentId: created.student.id,
      courseRunId: "run_ar_l3_2026",
    });
    expect(classAfter?.studentIds).toContain(created.student.id);
    expect(classAfter?.studentIds.length).toBe(
      (classBefore?.studentIds.length ?? 0) + 1
    );
    expect(
      after.lessonProgress.filter(item => item.studentId === created.student.id)
    ).toHaveLength(lessonCount);
    expect(after.auditLogs[0]).toMatchObject({
      action: "user.created",
      entityType: "User",
      entityId: created.user.id,
    });
  });

  it("creates a registrar student lifecycle record with class, teacher, invoice, and audit evidence", () => {
    const before = platformStore.getState();
    const classBefore = before.classGroups.find(
      item => item.id === "class_ar_l3_cairo"
    );
    const lessonCount = before.modules
      .filter(item => item.courseId === "course_ar_l3")
      .flatMap(module =>
        before.lessons.filter(lesson => lesson.moduleId === module.id)
      ).length;

    const result = platformStore.applyAction({
      type: "student.create",
      fullName: "QA Registrar Student",
      email: "qa.registrar.student@nilelearn.local",
      phone: "+20 100 000 0808",
      branchId: "br_cairo",
      preferredLanguage: "English",
      courseInterest: "Arabic Language",
      ageGroup: "Teen minor",
      guardianName: "QA Guardian",
      guardianPhone: "+20 100 000 0809",
      currentLevel: "Arabic Level 3",
      status: "active",
      notes: "Created by registrar lifecycle test.",
      courseRunId: "run_ar_l3_cairo_2026",
      classGroupId: "class_ar_l3_cairo",
      source: "direct",
      actorId: "usr_registrar_demo",
    });
    const after = platformStore.getState();
    const created = result.result as {
      user: { id: string; activeRole: string; branchId?: string };
      student: {
        id: string;
        userId: string;
        guardianName?: string;
        source?: string;
        courseInterest?: string;
      };
      enrollment: {
        id: string;
        studentId: string;
        courseRunId: string;
        levelId?: string;
        classGroupId?: string;
        teacherId?: string;
        source?: string;
      };
      invoice?: {
        studentId: string;
        enrollmentId?: string;
        status: string;
      };
    };
    const classAfter = after.classGroups.find(
      item => item.id === "class_ar_l3_cairo"
    );

    expect(result.action).toBe("student.created");
    expect(created.user).toMatchObject({
      activeRole: "student",
      branchId: "br_cairo",
    });
    expect(created.student).toMatchObject({
      userId: created.user.id,
      guardianName: "QA Guardian",
      source: "direct",
      courseInterest: "Arabic Language",
    });
    expect(created.enrollment).toMatchObject({
      studentId: created.student.id,
      courseRunId: "run_ar_l3_cairo_2026",
      levelId: "lvl_ar_l3",
      classGroupId: "class_ar_l3_cairo",
      teacherId: "usr_teacher_demo",
      source: "direct",
    });
    expect(created.invoice).toMatchObject({
      studentId: created.student.id,
      enrollmentId: created.enrollment.id,
      status: "pending",
    });
    expect(classAfter?.studentIds).toContain(created.student.id);
    expect(classAfter?.studentIds.length).toBe(
      (classBefore?.studentIds.length ?? 0) + 1
    );
    expect(
      after.lessonProgress.filter(item => item.studentId === created.student.id)
    ).toHaveLength(lessonCount);
    expect(after.auditLogs[0]).toMatchObject({
      action: "enrollment.created",
      entityType: "Enrollment",
      entityId: created.enrollment.id,
    });
    expect(
      after.auditLogs.some(
        item =>
          item.action === "student.created" &&
          item.entityId === created.student.id
      )
    ).toBe(true);
  });

  it("requires guardian details for minor student creation", () => {
    expect(() =>
      platformStore.applyAction({
        type: "student.create",
        fullName: "QA Minor Student",
        email: "qa.minor.student@nilelearn.local",
        phone: "+20 100 000 0810",
        branchId: "br_cairo",
        preferredLanguage: "English",
        courseInterest: "Arabic Language",
        ageGroup: "Child minor",
        currentLevel: "Arabic Level 1",
        status: "active",
        courseRunId: "run_ar_l3_cairo_2026",
        classGroupId: "class_ar_l3_cairo",
        actorId: "usr_registrar_demo",
      })
    ).toThrow("Guardian name and phone are required");
  });

  it("rejects direct student creation when identity or class assignment is incomplete", () => {
    expect(() =>
      platformStore.applyAction({
        type: "student.create",
        fullName: "Duplicate Student",
        email: "student.demo@nilelearn.local",
        phone: "+20 100 000 0811",
        branchId: "br_cairo",
        preferredLanguage: "English",
        courseInterest: "Arabic Language",
        ageGroup: "Adult",
        currentLevel: "Arabic Level 3",
        status: "active",
        courseRunId: "run_ar_l3_cairo_2026",
        classGroupId: "class_ar_l3_cairo",
        actorId: "usr_registrar_demo",
      })
    ).toThrow("already in the identity directory");

    const initial = platformStore.getState();
    platformStore.setState({
      ...initial,
      classGroups: initial.classGroups.map(item =>
        item.id === "class_ar_l3_cairo"
          ? { ...item, capacity: item.studentIds.length }
          : item
      ),
    });

    expect(() =>
      platformStore.applyAction({
        type: "student.create",
        fullName: "Full Class Student",
        email: "full.class.student@nilelearn.local",
        phone: "+20 100 000 0812",
        branchId: "br_cairo",
        preferredLanguage: "English",
        courseInterest: "Arabic Language",
        ageGroup: "Adult",
        currentLevel: "Arabic Level 3",
        status: "active",
        courseRunId: "run_ar_l3_cairo_2026",
        classGroupId: "class_ar_l3_cairo",
        actorId: "usr_registrar_demo",
      })
    ).toThrow("already at capacity");
  });

  it("rejects forged student intake lineage without lifecycle writes", () => {
    const before = platformStore.getState();
    const counts = {
      users: before.users.length,
      students: before.students.length,
      enrollments: before.enrollments.length,
      invoices: before.invoices.length,
      auditLogs: before.auditLogs.length,
    };
    const leadBefore = before.leads.find(item => item.id === "lead_demo_1");
    const applicationBefore = before.applications.find(
      item => item.id === "app_demo_1"
    );
    const placementBefore = before.placementTests.find(
      item => item.id === "pt_demo_1"
    );

    expect(() =>
      platformStore.applyAction({
        type: "student.create",
        fullName: "Forged Direct Student",
        email: "forged.direct@nilelearn.local",
        phone: "+20 100 000 0813",
        branchId: "br_online",
        preferredLanguage: "English",
        courseInterest: "Arabic Language",
        ageGroup: "Adult",
        currentLevel: "Arabic Level 3",
        status: "active",
        courseRunId: "run_ar_l3_2026",
        classGroupId: "class_ar_l3_a",
        source: "direct",
        leadId: "lead_demo_1",
        applicationId: "app_demo_1",
        placementTestId: "pt_demo_1",
        actorId: "usr_registrar_demo",
      })
    ).toThrow("Direct student creation cannot use intake record links.");

    expect(() =>
      platformStore.applyAction({
        type: "student.create",
        fullName: "Mismatched Application Student",
        email: "different.identity@nilelearn.local",
        phone: "+20 100 000 0814",
        branchId: "br_online",
        preferredLanguage: "English",
        courseInterest: "Arabic Language",
        ageGroup: "Adult",
        currentLevel: "Arabic Level 3",
        status: "active",
        courseRunId: "run_ar_l3_2026",
        classGroupId: "class_ar_l3_a",
        source: "application",
        applicationId: "app_demo_1",
        actorId: "usr_registrar_demo",
      })
    ).toThrow("Student identity must match the linked intake records.");

    const after = platformStore.getState();
    expect(after.users).toHaveLength(counts.users);
    expect(after.students).toHaveLength(counts.students);
    expect(after.enrollments).toHaveLength(counts.enrollments);
    expect(after.invoices).toHaveLength(counts.invoices);
    expect(after.auditLogs).toHaveLength(counts.auditLogs);
    expect(after.leads.find(item => item.id === "lead_demo_1")).toEqual(
      leadBefore
    );
    expect(after.applications.find(item => item.id === "app_demo_1")).toEqual(
      applicationBefore
    );
    expect(after.placementTests.find(item => item.id === "pt_demo_1")).toEqual(
      placementBefore
    );
  });

  it("converts an application into an enrollment workflow with level mapping", () => {
    const leadResult = platformStore.applyAction({
      type: "lead.create",
      fullName: "QA Application Lead",
      email: "qa.application.lead@nilelearn.local",
      phone: "+20 100 000 0820",
      subject: "Quran Tajweed",
      country: "Egypt",
      source: "manual",
      notes: "Can read Arabic letters",
      actorId: "usr_registrar_demo",
    });
    const lead = leadResult.result as { id: string };
    const application = platformStore.convertLeadToApplication(lead.id)!;
    const workflow = platformStore.convertApplicationToEnrollment(
      application.id
    )!;
    const after = platformStore.getState();

    expect(workflow).toMatchObject({
      leadId: lead.id,
      applicationId: application.id,
      targetCourseId: "course_qt_1",
      targetLevelId: "lvl_qt_1",
      status: "ready_to_enroll",
      source: "application",
    });
    expect(
      after.applications.find(item => item.id === application.id)?.status
    ).toBe("approved");
    expect(after.communicationLogs[0]).toMatchObject({
      actorId: "usr_registrar_demo",
      channel: "manual",
      subject: "Enrollment handoff",
      status: "completed",
    });
    expect(after.communicationLogs[0].body).toContain(
      "no external message was sent"
    );
    expect(
      after.communicationLogs.some(
        item => item.subject === "Lead conversion" && item.channel === "manual"
      )
    ).toBe(true);
    expect(after.auditLogs[0]).toMatchObject({
      action: "application.converted",
      entityType: "EnrollmentWorkflow",
      entityId: workflow.id,
    });
  });

  it("creates a direct registrar application with lead, communication log, and audit evidence", () => {
    const created = platformStore.createApplication({
      fullName: "QA Direct Application",
      email: "qa.direct.application@nilelearn.local",
      phone: "+20 100 000 0825",
      branchId: "br_cairo",
      courseInterest: "Arabic Language",
      schedulePreference: "Weekend mornings",
      notes: "Direct application store test.",
      source: "manual",
    });
    const after = platformStore.getState();

    expect(created.lead).toMatchObject({
      fullName: "QA Direct Application",
      email: "qa.direct.application@nilelearn.local",
      status: "ready_to_enroll",
      subject: "Arabic Language",
    });
    expect(created.application).toMatchObject({
      leadId: created.lead.id,
      branchId: "br_cairo",
      courseInterest: "Arabic Language",
      schedulePreference: "Weekend mornings",
      status: "pending",
    });
    expect(created.communicationLog).toMatchObject({
      actorId: "usr_registrar_demo",
      channel: "manual",
      subject: "Application intake",
      status: "completed",
    });
    expect(
      after.applications.find(item => item.id === created.application.id)
    ).toBeTruthy();
    expect(after.communicationLogs[0].id).toBe(created.communicationLog.id);
    expect(after.auditLogs[0]).toMatchObject({
      action: "application.created",
      entityType: "Application",
      entityId: created.application.id,
    });
    expect(() =>
      platformStore.createApplication({
        fullName: "QA Duplicate Application",
        email: "qa.direct.application@nilelearn.local",
        phone: "+20 100 000 0826",
        branchId: "br_cairo",
        courseInterest: "Arabic Language",
        schedulePreference: "Evening",
      })
    ).toThrow("An application already exists for this email.");
    expect(() =>
      platformStore.createApplication({
        fullName: "Existing Student Application",
        email: "student.demo@nilelearn.local",
        phone: "+20 100 000 0827",
        branchId: "br_online",
        courseInterest: "Arabic Language",
        schedulePreference: "Evening",
      })
    ).toThrow("already in the identity directory");
  });

  it("sends messages with attachment metadata, notification, communication log, and audit evidence", () => {
    const message = platformStore.sendMessage({
      fromUserId: "usr_teacher_demo",
      toUserId: "usr_student_demo",
      subject: "Lesson material",
      body: "Please review the attached lesson note.",
      attachments: [
        {
          name: "lesson-note.pdf",
          type: "application/pdf",
          size: 280000,
          kind: "document",
          previewLabel: "PDF - 273 KB",
        },
      ],
    });
    const after = platformStore.getState();

    expect(message).toMatchObject({
      fromUserId: "usr_teacher_demo",
      toUserId: "usr_student_demo",
      subject: "Lesson material",
      attachments: [
        {
          name: "lesson-note.pdf",
          kind: "document",
          previewLabel: "PDF - 273 KB",
        },
      ],
    });
    expect(after.communicationLogs[0]).toMatchObject({
      actorId: "usr_teacher_demo",
      channel: "in_app",
      subject: "Lesson material",
      relatedUserId: "usr_student_demo",
      status: "completed",
      attachments: message.attachments,
    });
    expect(after.notifications[0]).toMatchObject({
      userId: "usr_student_demo",
      title: "Lesson material",
      href: "/app/student/messages",
      relatedMessageId: message.id,
    });
    expect(after.auditLogs[0]).toMatchObject({
      action: "message.sent",
      actorId: "usr_teacher_demo",
      entityType: "Message",
      entityId: message.id,
    });

    platformStore.markMessageRead(message.id);
    expect(
      platformStore.getState().messages.find(item => item.id === message.id)
    ).toMatchObject({ read: true });
    expect(
      platformStore
        .getState()
        .notifications.find(item => item.relatedMessageId === message.id)
    ).toMatchObject({ read: true });
  });

  it("creates per-recipient rows for internal broadcast messages", () => {
    const before = platformStore.getState();
    const message = platformStore.sendMessage({
      fromUserId: "usr_admin_demo",
      toUserId: "usr_student_demo",
      recipientUserIds: ["usr_student_demo", "usr_teacher_demo"],
      subject: "Platform notice",
      body: "Internal platform notice.",
    });
    const after = platformStore.getState();
    const createdMessages = after.messages.filter(
      item => item.subject === "Platform notice"
    );

    expect(message.toUserId).toBe("usr_student_demo");
    expect(createdMessages).toHaveLength(2);
    expect(createdMessages.map(item => item.toUserId).sort()).toEqual([
      "usr_student_demo",
      "usr_teacher_demo",
    ]);
    expect(
      after.communicationLogs.length - before.communicationLogs.length
    ).toBe(2);
    expect(
      after.notifications.filter(item => item.title === "Platform notice")
    ).toHaveLength(2);
    expect(
      after.auditLogs.filter(
        item =>
          item.action === "message.sent" && item.actorId === "usr_admin_demo"
      )
    ).toHaveLength(2);
  });

  it("maps placement results to the matching course and level", () => {
    const booking = platformStore.applyAction({
      type: "placement.create",
      fullName: "QA Tajweed Placement",
      email: "qa.tajweed.placement@nilelearn.local",
      phone: "+20 100 000 0830",
      branchId: "br_online",
      subject: "Quran Tajweed",
      preferredDate: "2026-07-15",
      currentLevel: "Can read Arabic letters",
      actorId: "usr_registrar_demo",
    }).result as { id: string };

    platformStore.recordPlacementResult(
      booking.id,
      "Tajweed 1",
      86,
      "Ready for tajweed group."
    );
    platformStore.recordPlacementResult(
      booking.id,
      "Tajweed 2",
      90,
      "Updated after oral review."
    );
    const after = platformStore.getState();
    const workflow = platformStore
      .getState()
      .enrollmentWorkflows.find(item => item.placementTestId === booking.id);
    const workflows = after.enrollmentWorkflows.filter(
      item => item.placementTestId === booking.id
    );

    expect(workflows).toHaveLength(1);
    expect(workflow).toMatchObject({
      placementTestId: booking.id,
      targetCourseId: "course_qt_1",
      targetLevelId: "lvl_qt_1",
      recommendedLevel: "Tajweed 2",
      source: "placement",
      status: "ready_to_enroll",
    });
    expect(
      after.placementTests.find(item => item.id === booking.id)
    ).toMatchObject({
      status: "completed",
      recommendedLevel: "Tajweed 2",
    });
    expect(
      after.placementResults.find(item => item.bookingId === booking.id)
    ).toMatchObject({
      score: 90,
      recommendedLevel: "Tajweed 2",
      notes: "Updated after oral review.",
    });
    expect(after.auditLogs[0]).toMatchObject({
      action: "placement.result_updated",
      entityType: "PlacementTestResult",
    });
  });

  it("updates student status through registrar workflow and syncs linked account and enrollment", () => {
    const result = platformStore.updateStudentStatus(
      "stu_cairo_demo",
      "paused"
    );
    const after = platformStore.getState();
    const user = after.users.find(item => item.id === "usr_student_cairo_demo");
    const enrollment = after.enrollments.find(
      item => item.studentId === "stu_cairo_demo"
    );

    expect(result?.status).toBe("paused");
    expect(user?.status).toBe("paused");
    expect(enrollment?.status).toBe("paused");
    expect(after.auditLogs[0]).toMatchObject({
      action: "student.status_updated",
      entityType: "StudentProfile",
      entityId: "stu_cairo_demo",
    });
  });

  it("creates a connected teacher account with class assignment and availability", () => {
    const fixture = platformStore.getState();
    platformStore.setState({
      ...fixture,
      courseRuns: [
        ...fixture.courseRuns,
        {
          id: "run_qt_teacher_creation",
          courseId: "course_qt_1",
          branchId: "br_online",
          teacherId: "",
          term: "Summer 2026 QA",
          startsOn: "2026-06-01",
          endsOn: "2026-08-31",
          status: "active",
        },
      ],
      classGroups: [
        ...fixture.classGroups,
        {
          id: "class_qt_teacher_creation",
          courseRunId: "run_qt_teacher_creation",
          name: "Quran Tajweed - Teacher Creation QA",
          capacity: 12,
          schedule: "Tue/Thu 10:30",
          roomId: "room_online_b",
          meetingLinkId: "meet_qt_1",
          studentIds: ["stu_demo"],
        },
      ],
    });

    const result = platformStore.applyAction({
      type: "user.create",
      name: "QA Teacher Account",
      email: "qa.teacher.account@nilelearn.local",
      phone: "+20 100 000 0202",
      role: "teacher",
      branchId: "br_online",
      departmentId: "dep_arabic",
      status: "active",
      courseRunId: "run_qt_teacher_creation",
      subjects: ["Quran", "Tajweed"],
      specialization: ["Tajweed 1"],
      availability: ["Thursday 10:00 12:00"],
      notes: "Created by unit test.",
      actorId: "usr_admin_demo",
    });
    const after = platformStore.getState();
    const created = result.result as {
      user: { id: string; activeRole: string };
      teacherProfile: {
        userId: string;
        branchId: string;
        departmentId: string;
        subjects: string[];
        teachingLevels: string[];
        specialties: string[];
        availabilityStatus: string;
        assignedClassIds: string[];
        status: string;
      };
      teacherAssignment: {
        classGroups: { id: string }[];
        availability: { teacherId: string }[];
      };
    };
    const run = after.courseRuns.find(
      item => item.id === "run_qt_teacher_creation"
    );

    expect(created.user.activeRole).toBe("teacher");
    expect(created.teacherProfile.userId).toBe(created.user.id);
    expect(created.teacherProfile.branchId).toBe("br_online");
    expect(created.teacherProfile.departmentId).toBe("dep_arabic");
    expect(created.teacherProfile.subjects).toEqual(
      expect.arrayContaining(["Quran", "Tajweed"])
    );
    expect(created.teacherProfile.teachingLevels).toEqual(
      expect.arrayContaining(["Tajweed 1"])
    );
    expect(created.teacherProfile.specialties).toEqual(
      expect.arrayContaining(["Quran", "Tajweed", "Tajweed 1"])
    );
    expect(created.teacherProfile.availabilityStatus).toBe("available");
    expect(created.teacherProfile.assignedClassIds).toContain(
      "class_qt_teacher_creation"
    );
    expect(created.teacherProfile.status).toBe("active");
    expect(run?.teacherId).toBe(created.user.id);
    expect(
      created.teacherAssignment.classGroups.map(item => item.id)
    ).toContain("class_qt_teacher_creation");
    expect(
      after.teacherAvailability.some(
        item =>
          item.teacherId === created.user.id && item.weekday === "Thursday"
      )
    ).toBe(true);
    expect(after.auditLogs[0]).toMatchObject({
      action: "user.created",
      entityType: "User",
      entityId: created.user.id,
    });
    expect(
      after.auditLogs.some(
        item =>
          item.action === "teacher.assigned" &&
          item.entityId === "run_qt_teacher_creation"
      )
    ).toBe(true);
  });

  it("creates a staff registrar account with profile scope and audit evidence", () => {
    const result = platformStore.applyAction({
      type: "staff.user.create",
      name: "QA Registrar",
      email: "qa.registrar@nilelearn.local",
      phone: "+20 100 000 0707",
      role: "registrar",
      branchId: "br_cairo",
      departmentId: "dep_admissions",
      status: "active",
      permissionScope: "admissions",
      operationalScope: ["leads", "placement", "enrollments"],
      notes: "Created by unit test.",
      actorId: "usr_admin_demo",
    });
    const after = platformStore.getState();
    const created = result.result as {
      user: { id: string; activeRole: string };
      staffProfile: {
        userId: string;
        role: string;
        permissionScope: string;
        operationalScope: string[];
      };
      relationshipSummary: string;
    };

    expect(result.action).toBe("staff.user.created");
    expect(created.user.activeRole).toBe("registrar");
    expect(created.staffProfile).toMatchObject({
      userId: created.user.id,
      role: "registrar",
      permissionScope: "admissions",
    });
    expect(created.staffProfile.operationalScope).toEqual(
      expect.arrayContaining(["leads", "placement"])
    );
    expect(after.students.some(item => item.userId === created.user.id)).toBe(
      false
    );
    expect(
      after.staffProfiles.some(item => item.userId === created.user.id)
    ).toBe(true);
    expect(after.auditLogs[0]).toMatchObject({
      action: "staff.user.created",
      entityType: "User",
      entityId: created.user.id,
    });
    expect(created.relationshipSummary).toContain("Registrar profile");

    platformStore.applyAction({
      type: "user.update",
      userId: created.user.id,
      activeRole: "registrar",
      roles: ["registrar"],
      branchId: "br_online",
      departmentId: "dep_admissions",
      status: "paused",
      actorId: "usr_admin_demo",
    });
    const updated = platformStore
      .getState()
      .staffProfiles.find(item => item.userId === created.user.id);
    expect(updated).toMatchObject({
      status: "paused",
      branchIds: ["br_online"],
      departmentIds: ["dep_admissions"],
    });
  });

  it("creates a staff teacher foundation without assigning a course run", () => {
    const before = platformStore.getState();
    const runBefore = before.courseRuns.find(
      item => item.id === "run_ar_l3_2026"
    );
    const result = platformStore.applyAction({
      type: "staff.user.create",
      name: "QA Staff Teacher",
      email: "qa.staff.teacher@nilelearn.local",
      role: "teacher",
      branchId: "br_online",
      departmentId: "dep_arabic",
      status: "pending",
      permissionScope: "department",
      subjects: ["Arabic grammar"],
      teachingLevels: ["Arabic Level 3"],
      availabilityStatus: "limited",
      actorId: "usr_admin_demo",
    });
    const after = platformStore.getState();
    const created = result.result as {
      user: { id: string; activeRole: string };
      staffProfile: { userId: string; availabilityStatus: string };
      teacherProfile: {
        userId: string;
        branchId: string;
        departmentId: string;
        subjects: string[];
        teachingLevels: string[];
        specialties: string[];
        availabilityStatus: string;
        assignedClassIds: string[];
        status: string;
      };
    };
    const runAfter = after.courseRuns.find(
      item => item.id === "run_ar_l3_2026"
    );

    expect(created.user.activeRole).toBe("teacher");
    expect(created.staffProfile.availabilityStatus).toBe("limited");
    expect(created.teacherProfile.userId).toBe(created.user.id);
    expect(created.teacherProfile.branchId).toBe("br_online");
    expect(created.teacherProfile.departmentId).toBe("dep_arabic");
    expect(created.teacherProfile.subjects).toEqual(["Arabic grammar"]);
    expect(created.teacherProfile.teachingLevels).toEqual(["Arabic Level 3"]);
    expect(created.teacherProfile.specialties).toEqual(
      expect.arrayContaining(["Arabic grammar", "Arabic Level 3"])
    );
    expect(created.teacherProfile.availabilityStatus).toBe("limited");
    expect(created.teacherProfile.assignedClassIds).toEqual([]);
    expect(created.teacherProfile.status).toBe("pending");
    expect(runAfter?.teacherId).toBe(runBefore?.teacherId);
    expect(
      after.auditLogs.some(
        item =>
          item.action === "teacher.assigned" &&
          item.entityId === created.user.id
      )
    ).toBe(false);
  });

  it("rejects staff account creation for student roles and missing role fields", () => {
    expect(() =>
      platformStore.applyAction({
        type: "staff.user.create",
        name: "Wrong Staff Student",
        email: "wrong.staff.student@nilelearn.local",
        role: "student" as never,
        branchId: "br_online",
        departmentId: "dep_arabic",
        actorId: "usr_admin_demo",
      })
    ).toThrow("Student accounts must be created through registrar admissions");

    expect(() =>
      platformStore.applyAction({
        type: "staff.user.create",
        name: "No Level Teacher",
        email: "no.level.teacher@nilelearn.local",
        role: "teacher",
        branchId: "br_online",
        departmentId: "dep_arabic",
        permissionScope: "department",
        subjects: ["Arabic"],
        teachingLevels: [],
        availabilityStatus: "available",
        actorId: "usr_admin_demo",
      })
    ).toThrow("Teacher accounts require at least one teaching level");

    expect(() =>
      platformStore.applyAction({
        type: "staff.user.create",
        name: "Wrong Scope Admin",
        email: "wrong.scope.admin@nilelearn.local",
        role: "superadmin",
        branchId: "br_global",
        departmentId: "dep_platform",
        permissionScope: "branch",
        actorId: "usr_admin_demo",
      })
    ).toThrow("Super admin accounts require global permission scope");

    expect(() =>
      platformStore.applyAction({
        type: "staff.user.create",
        name: "Wrong Scope Registrar",
        email: "wrong.scope.registrar@nilelearn.local",
        role: "registrar",
        branchId: "br_cairo",
        departmentId: "dep_admissions",
        permissionScope: "department",
        actorId: "usr_admin_demo",
      })
    ).toThrow("Registrar accounts require admissions permission scope");

    expect(() =>
      platformStore.applyAction({
        type: "staff.user.create",
        name: "Wrong Scope HOD",
        email: "wrong.scope.hod@nilelearn.local",
        role: "headofdepartment",
        branchId: "br_global",
        departmentId: "dep_arabic",
        permissionScope: "branch",
        actorId: "usr_admin_demo",
      })
    ).toThrow("HOD accounts require department permission scope");

    expect(() =>
      platformStore.applyAction({
        type: "staff.user.create",
        name: "No Scope Branch Admin",
        email: "no.scope.branch@nilelearn.local",
        role: "branchadmin",
        branchId: "br_cairo",
        departmentId: "dep_operations",
        permissionScope: "operations",
        operationalScope: [],
        actorId: "usr_admin_demo",
      })
    ).toThrow("Branch admin accounts require at least one operational scope");
  });

  it("rejects connected student accounts with mismatched branch and class scope", () => {
    expect(() =>
      platformStore.applyAction({
        type: "user.create",
        name: "Wrong Branch Student",
        email: "wrong.branch.student@nilelearn.local",
        phone: "+20 100 000 0303",
        role: "student",
        branchId: "br_cairo",
        departmentId: "dep_arabic",
        status: "active",
        courseRunId: "run_ar_l3_2026",
        classGroupId: "class_ar_l3_a",
        actorId: "usr_admin_demo",
      })
    ).toThrow("Student branch must match");
  });

  it("rejects connected accounts with invalid branch or status", () => {
    expect(() =>
      platformStore.applyAction({
        type: "user.create",
        name: "Invalid Scope User",
        email: "invalid.scope@nilelearn.local",
        phone: "+20 100 000 0404",
        role: "registrar",
        branchId: "br_missing",
        departmentId: "dep_admissions",
        status: "active",
        actorId: "usr_admin_demo",
      })
    ).toThrow("Choose a valid branch");

    expect(() =>
      platformStore.applyAction({
        type: "user.create",
        name: "Invalid Status User",
        email: "invalid.status@nilelearn.local",
        phone: "+20 100 000 0505",
        role: "registrar",
        branchId: "br_cairo",
        departmentId: "dep_admissions",
        status: "issued" as never,
        actorId: "usr_admin_demo",
      })
    ).toThrow("Choose a valid account status");
  });

  it("rejects teacher account creation when the selected course run already has a teacher", () => {
    expect(() =>
      platformStore.applyAction({
        type: "user.create",
        name: "Replacement Teacher",
        email: "replacement.teacher@nilelearn.local",
        phone: "+20 100 000 0606",
        role: "teacher",
        branchId: "br_online",
        departmentId: "dep_arabic",
        status: "active",
        courseRunId: "run_ar_l3_2026",
        subjects: ["Arabic"],
        specialization: ["Arabic Level 3"],
        actorId: "usr_admin_demo",
      })
    ).toThrow("already has a teacher");
  });

  it("updates user access through the workflow action and keeps linked student status in sync", () => {
    const before = platformStore.getState();
    const user = before.users.find(item => item.id === "usr_student_demo");
    const student = before.students.find(item => item.userId === user?.id);
    expect(user).toBeTruthy();
    expect(student).toBeTruthy();

    const result = platformStore.applyAction({
      type: "user.update",
      userId: "usr_student_demo",
      activeRole: "student",
      roles: ["student", "registrar"],
      branchId: "br_online",
      departmentId: "dep_admissions",
      status: "paused",
      actorId: "usr_admin_demo",
    });
    const after = platformStore.getState();
    const updatedUser = after.users.find(
      item => item.id === "usr_student_demo"
    );
    const updatedStudent = after.students.find(
      item => item.userId === "usr_student_demo"
    );
    const updatedEnrollment = after.enrollments.find(
      item => item.studentId === updatedStudent?.id
    );

    expect(result.action).toBe("user.updated");
    expect(updatedUser?.roles).toEqual(["student", "registrar"]);
    expect(updatedUser?.status).toBe("paused");
    expect(updatedUser?.departmentId).toBe("dep_admissions");
    expect(updatedStudent?.status).toBe("paused");
    expect(updatedEnrollment?.status).toBe("paused");
    expect(after.auditLogs[0]).toMatchObject({
      action: "user.updated",
      entityType: "User",
      entityId: "usr_student_demo",
    });
  });

  it("rejects user updates when the active role is not assigned", () => {
    expect(() =>
      platformStore.applyAction({
        type: "user.update",
        userId: "usr_teacher_demo",
        activeRole: "teacher",
        roles: ["student"],
        branchId: "br_online",
        departmentId: "dep_arabic",
        status: "active",
        actorId: "usr_admin_demo",
      })
    ).toThrow("Active role must be one of the assigned roles");
  });

  it("updates role permissions through the workflow action with audit evidence", () => {
    const before = platformStore.getState();
    const initiallyGranted =
      before.permissions.teacher.includes("payments:read");

    const result = platformStore.applyAction({
      type: "permission.update",
      role: "teacher",
      permission: "payments:read",
      granted: !initiallyGranted,
      actorId: "usr_admin_demo",
    });
    const after = platformStore.getState();
    const granted = after.permissions.teacher.includes("payments:read");

    expect(result.action).toBe("permission.updated");
    expect(granted).toBe(!initiallyGranted);
    expect(after.auditLogs[0]).toMatchObject({
      action: "permission.updated",
      entityType: "Role",
      entityId: "teacher",
      actorId: "usr_admin_demo",
    });
  });

  it("updates branch status through the workflow action with audit evidence", () => {
    const result = platformStore.applyAction({
      type: "branch.update",
      branchId: "br_cairo",
      status: "paused",
      actorId: "usr_admin_demo",
    });
    const after = platformStore.getState();
    const branch = after.branches.find(item => item.id === "br_cairo");

    expect(result.action).toBe("branch.updated");
    expect(branch?.status).toBe("paused");
    expect(after.auditLogs[0]).toMatchObject({
      action: "branch.updated",
      entityType: "Branch",
      entityId: "br_cairo",
      actorId: "usr_admin_demo",
    });
  });

  it("updates room status through the workflow action with audit evidence", () => {
    const result = platformStore.applyAction({
      type: "room.status.update",
      roomId: "room_cairo_4",
      status: "paused",
      actorId: "usr_branch_demo",
    });
    const after = platformStore.getState();
    const room = after.rooms.find(item => item.id === "room_cairo_4");

    expect(result.action).toBe("room.status_updated");
    expect(room?.status).toBe("paused");
    expect(after.auditLogs[0]).toMatchObject({
      action: "room.status_updated",
      entityType: "Room",
      entityId: "room_cairo_4",
      actorId: "usr_branch_demo",
    });
  });

  it("creates branch rooms through the workflow action with audit evidence", () => {
    const result = platformStore.applyAction({
      type: "room.create",
      branchId: "br_cairo",
      name: "  QA Teaching Studio  ",
      capacity: 24,
      equipment: [" Projector ", "", "Smart board"],
      actorId: "usr_branch_demo",
    });
    const after = platformStore.getState();
    const room = after.rooms.find(item => item.id === result.entityId);

    expect(result.action).toBe("room.created");
    expect(room).toMatchObject({
      branchId: "br_cairo",
      name: "QA Teaching Studio",
      capacity: 24,
      equipment: ["Projector", "Smart board"],
      status: "active",
    });
    expect(after.auditLogs[0]).toMatchObject({
      action: "room.created",
      entityType: "Room",
      entityId: result.entityId,
      actorId: "usr_branch_demo",
    });
  });

  it("rejects governance updates with invalid role, permission, or branch", () => {
    expect(() =>
      platformStore.applyAction({
        type: "permission.update",
        role: "teacher",
        permission: "system.invalid" as never,
        granted: true,
        actorId: "usr_admin_demo",
      })
    ).toThrow("Choose a valid permission");

    expect(() =>
      platformStore.applyAction({
        type: "permission.update",
        role: "invalid" as never,
        permission: "students:read",
        granted: true,
        actorId: "usr_admin_demo",
      })
    ).toThrow("Choose a valid account role");

    expect(() =>
      platformStore.applyAction({
        type: "branch.update",
        branchId: "br_missing",
        status: "active",
        actorId: "usr_admin_demo",
      })
    ).toThrow("Branch br_missing was not found");

    expect(() =>
      platformStore.applyAction({
        type: "room.status.update",
        roomId: "room_missing",
        status: "active",
        actorId: "usr_branch_demo",
      })
    ).toThrow("Room room_missing was not found");

    expect(() =>
      platformStore.applyAction({
        type: "room.create",
        branchId: "br_missing",
        name: "New room",
        capacity: 20,
        actorId: "usr_branch_demo",
      })
    ).toThrow("Branch br_missing was not found");

    expect(() =>
      platformStore.applyAction({
        type: "room.create",
        branchId: "br_cairo",
        name: "Cairo Room 4",
        capacity: 20,
        actorId: "usr_branch_demo",
      })
    ).toThrow("Cairo Room 4 already exists in Cairo B1");
  });

  it("updates integration status through the workflow action with sync timestamp and audit", () => {
    const result = platformStore.applyAction({
      type: "integration.status.update",
      integrationId: "supabase",
      status: "mock_mode",
      actorId: "usr_admin_demo",
    });
    const after = platformStore.getState();
    const integration = after.integrations.find(item => item.id === "supabase");

    expect(result.action).toBe("integration.status_updated");
    expect(integration?.status).toBe("mock_mode");
    expect(integration?.lastSyncAt).toBeTruthy();
    expect(after.auditLogs[0]).toMatchObject({
      action: "integration.status_updated",
      entityType: "IntegrationConfig",
      entityId: "supabase",
      actorId: "usr_admin_demo",
    });
  });

  it("logs integration local checks and system health checks through workflow actions", () => {
    const check = platformStore.applyAction({
      type: "integration.local_check",
      integrationId: "moodle",
      actorId: "usr_admin_demo",
    });
    const health = platformStore.applyAction({
      type: "system.health_check",
      score: 87.6,
      actorId: "usr_admin_demo",
    });
    const after = platformStore.getState();

    expect(check.action).toBe("integration.local_checked");
    expect(health.action).toBe("system.health_checked");
    expect(after.auditLogs[0]).toMatchObject({
      action: "system.health_checked",
      entityType: "PlatformSystem",
      entityId: "health",
    });
    expect(after.auditLogs[1]).toMatchObject({
      action: "integration.local_checked",
      entityType: "IntegrationConfig",
      entityId: "moodle",
    });
    expect(after.auditLogs[0].summary).toContain("88%");
  });

  it("saves platform settings through a workflow action with audit evidence", () => {
    const result = platformStore.applyAction({
      type: "settings.save",
      organization: "Nile Center",
      defaultLanguage: "English",
      academicTerm: "Summer 2026",
      retentionDays: 730,
      actorId: "usr_admin_demo",
    });
    const after = platformStore.getState();

    expect(result.action).toBe("settings.saved");
    expect(result.entityType).toBe("PlatformSettings");
    expect(result.entityId).toBe("global");
    expect(result.result).toMatchObject({
      settings: {
        organization: "Nile Center",
        defaultLanguage: "English",
        academicTerm: "Summer 2026",
        retentionDays: 730,
        updatedBy: "usr_admin_demo",
      },
    });
    expect(after.settings).toMatchObject({
      organization: "Nile Center",
      defaultLanguage: "English",
      academicTerm: "Summer 2026",
      retentionDays: 730,
      updatedBy: "usr_admin_demo",
    });
    expect(after.auditLogs[0]).toMatchObject({
      action: "settings.saved",
      entityType: "PlatformSettings",
      entityId: "global",
      actorId: "usr_admin_demo",
    });
    expect(after.auditLogs[0].summary).toContain("730 day retention");
  });

  it("rejects integration actions with invalid integration or status", () => {
    expect(() =>
      platformStore.applyAction({
        type: "integration.status.update",
        integrationId: "missing" as never,
        status: "mock_mode",
        actorId: "usr_admin_demo",
      })
    ).toThrow("Integration missing was not found");

    expect(() =>
      platformStore.applyAction({
        type: "integration.status.update",
        integrationId: "moodle",
        status: "paused" as never,
        actorId: "usr_admin_demo",
      })
    ).toThrow("Choose a valid integration status");
  });

  it("rejects invalid platform settings workflow actions", () => {
    expect(() =>
      platformStore.applyAction({
        type: "settings.save",
        organization: "",
        defaultLanguage: "English",
        academicTerm: "Summer 2026",
        retentionDays: 365,
        actorId: "usr_admin_demo",
      })
    ).toThrow("Organization is required");

    expect(() =>
      platformStore.applyAction({
        type: "settings.save",
        organization: "Nile Center",
        defaultLanguage: "English",
        academicTerm: "Summer 2026",
        retentionDays: 7,
        actorId: "usr_admin_demo",
      })
    ).toThrow("Audit retention days must be between 30 and 3650");
  });

  it("does not create quiz attempts after the configured attempt limit", () => {
    const quiz = platformStore.getState().quizzes[0];

    platformStore.submitQuizAttempt(quiz.id, {
      qbi_ar_conditional_mcq: "إذا",
      qbi_ar_market_short: "I visited the market. I bought dates.",
    });
    const allowedState = platformStore.getState();
    const allowedAttempts = allowedState.quizAttempts.filter(
      item => item.quizId === quiz.id && item.studentId === "stu_demo"
    );

    expect(() =>
      platformStore.submitQuizAttempt(quiz.id, {
        qbi_ar_conditional_mcq: "إذا",
      })
    ).toThrow("No quiz attempts remaining");
    const cappedAttempts = platformStore
      .getState()
      .quizAttempts.filter(
        item => item.quizId === quiz.id && item.studentId === "stu_demo"
      );

    expect(allowedAttempts).toHaveLength(quiz.attemptsAllowed);
    expect(cappedAttempts).toHaveLength(quiz.attemptsAllowed);
  });

  it("rejects quiz submissions with answers for unattached questions", () => {
    const quiz = platformStore
      .getState()
      .quizzes.find(item => item.id === "quiz_qt_madd");
    expect(quiz).toBeTruthy();

    expect(() =>
      platformStore.submitQuizAttempt(quiz!.id, {
        qbi_ar_conditional_mcq: "إذا",
      })
    ).toThrow("Quiz answers must match attached questions");

    const after = platformStore.getState();
    expect(
      after.quizAttempts.filter(
        item => item.quizId === quiz!.id && item.studentId === "stu_demo"
      )
    ).toHaveLength(0);
    expect(after.grades.some(item => item.itemId === quiz!.id)).toBe(false);
  });

  it("stores manual quiz answers as pending review without creating a grade", () => {
    const quiz = platformStore
      .getState()
      .quizzes.find(item => item.id === "quiz_qt_madd");
    expect(quiz).toBeTruthy();

    const attempt = platformStore.submitQuizAttempt(quiz!.id, {
      qbi_qt_madd_oral: "Recorded Madd Munfasil example with stretch length.",
    });

    expect(attempt).toMatchObject({
      quizId: quiz!.id,
      studentId: "stu_demo",
      status: "pending",
      score: 0,
      maxScore: 100,
      answers: {
        qbi_qt_madd_oral: "Recorded Madd Munfasil example with stretch length.",
      },
    });
    expect(
      platformStore
        .getState()
        .grades.some(
          item => item.itemId === quiz!.id && item.studentId === "stu_demo"
        )
    ).toBe(false);
  });

  it("stores pending media metadata on quiz attempts", () => {
    const quiz = platformStore
      .getState()
      .quizzes.find(item => item.id === "quiz_qt_madd");
    expect(quiz).toBeTruthy();

    const attempt = platformStore.submitQuizAttempt(
      quiz!.id,
      { qbi_qt_madd_oral: "Pending media attached" },
      "stu_demo",
      "usr_student_demo",
      [pendingMedia("audio")]
    );

    expect(attempt.pendingMedia).toHaveLength(1);
    expect(attempt.pendingMedia?.[0].storageStatus).toBe("pending_storage");
  });

  it("reviews quiz attempts and updates grade, notification, and audit evidence", () => {
    const quiz = platformStore
      .getState()
      .quizzes.find(item => item.id === "quiz_qt_madd");
    const attempt = platformStore.submitQuizAttempt(quiz!.id, {
      qbi_qt_madd_oral: "Recorded Madd Munfasil example.",
    });
    expect(attempt.status).toBe("pending");
    platformStore.setState({
      ...platformStore.getState(),
      grades: [
        {
          id: "legacy_qt_grade",
          studentId: "stu_demo",
          courseRunId: quiz!.courseRunId,
          itemTitle: quiz!.title,
          score: 72,
          maxScore: 100,
          feedback: "Legacy title-only grade.",
        },
        ...platformStore.getState().grades,
      ],
    });

    const reviewed = platformStore.reviewQuizAttempt(
      attempt.id,
      94,
      "Strong recitation. Review stretch length once more."
    );
    const after = platformStore.getState();
    const grade = after.grades.find(
      item => item.itemId === quiz!.id && item.studentId === "stu_demo"
    );

    expect(reviewed).toMatchObject({
      id: attempt.id,
      score: 94,
      status: "completed",
    });
    expect(grade).toMatchObject({
      itemId: quiz!.id,
      itemTitle: quiz!.title,
      score: 94,
      feedback: "Strong recitation. Review stretch length once more.",
    });
    expect(after.notifications[0]).toMatchObject({
      title: "Quiz reviewed",
      userId: "usr_student_demo",
    });
    expect(after.auditLogs[0]).toMatchObject({
      action: "quiz.reviewed",
      entityType: "QuizAttempt",
      entityId: attempt.id,
    });
  });

  it("clamps assignment grading score and persists normalized feedback", () => {
    const submission = platformStore
      .getState()
      .assignmentSubmissions.find(item => item.status === "pending");
    expect(submission).toBeTruthy();

    const graded = platformStore.gradeAssignmentSubmission(
      submission!.id,
      140,
      "  Strong work  "
    );
    const grade = platformStore
      .getState()
      .grades.find(item => item.itemId === graded?.assignmentId);

    expect(graded?.score).toBe(100);
    expect(graded?.feedback).toBe("Strong work");
    expect(grade?.score).toBe(100);
    expect(grade?.feedback).toBe("Strong work");
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
      after.enrollments.find(item => item.id === "enr_ar_l3")?.attendanceRate
    ).toBe(50);
    expect(
      after.classSessions.find(item => item.id === "session_ar_live")
        ?.attendanceSaved
    ).toBe(true);
    expect(
      after.auditLogs.some(
        item =>
          item.action === "attendance.saved" &&
          item.entityId === "class_ar_l3_a"
      )
    ).toBe(true);
  });

  it("saves attendance when the caller supplies the linked calendar event id", () => {
    const saved = platformStore.saveAttendanceBulk(
      "class_ar_l3_a",
      "evt_ar_live",
      {
        stu_demo: "late",
      }
    );
    const after = platformStore.getState();

    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      classGroupId: "class_ar_l3_a",
      studentId: "stu_demo",
      sessionId: "session_ar_live",
      status: "late",
    });
    expect(
      after.classSessions.find(item => item.id === "session_ar_live")
        ?.attendanceSaved
    ).toBe(true);
  });

  it("saves teacher attendance notes without duplicating clean audit rows", () => {
    const state = platformStore.getState();
    platformStore.setState({
      ...state,
      attendance: [],
      auditLogs: [],
      classSessions: state.classSessions.map(session =>
        session.id === "session_ar_live"
          ? { ...session, attendanceSaved: false }
          : session
      ),
    });

    const first = platformStore.saveAttendanceBulk(
      "class_ar_l3_a",
      "session_ar_live",
      { stu_demo: "late" },
      { stu_demo: "Arrived after warmup" },
      "usr_teacher_demo"
    );
    const afterFirst = platformStore.getState();

    const second = platformStore.saveAttendanceBulk(
      "class_ar_l3_a",
      "session_ar_live",
      { stu_demo: "late" },
      { stu_demo: "Arrived after warmup" },
      "usr_teacher_demo"
    );
    const afterSecond = platformStore.getState();

    const third = platformStore.saveAttendanceBulk(
      "class_ar_l3_a",
      "session_ar_live",
      { stu_demo: "late" },
      { stu_demo: "Parent approved late arrival" },
      "usr_teacher_demo"
    );
    const afterThird = platformStore.getState();

    expect(first[0]).toMatchObject({
      studentId: "stu_demo",
      status: "late",
      notes: "Arrived after warmup",
    });
    expect(second[0].notes).toBe("Arrived after warmup");
    expect(third[0].notes).toBe("Parent approved late arrival");
    expect(
      afterFirst.auditLogs.filter(item => item.action === "attendance.saved")
    ).toHaveLength(1);
    expect(
      afterSecond.auditLogs.filter(item => item.action === "attendance.saved")
    ).toHaveLength(1);
    expect(
      afterThird.auditLogs.filter(item => item.action === "attendance.saved")
    ).toHaveLength(2);
  });

  it("does not append duplicate attendance audit rows for clean saves", () => {
    platformStore.saveAttendanceBulk("class_ar_l3_a", "session_ar_live", {
      stu_demo: "late",
    });
    const afterFirst = platformStore.getState();
    const firstAuditCount = afterFirst.auditLogs.filter(
      item =>
        item.action === "attendance.saved" && item.entityId === "class_ar_l3_a"
    ).length;

    platformStore.saveAttendanceBulk("class_ar_l3_a", "session_ar_live", {
      stu_demo: "late",
    });
    const afterSecond = platformStore.getState();
    const secondAuditCount = afterSecond.auditLogs.filter(
      item =>
        item.action === "attendance.saved" && item.entityId === "class_ar_l3_a"
    ).length;

    expect(firstAuditCount).toBe(1);
    expect(secondAuditCount).toBe(firstAuditCount);
  });

  it("returns existing attendance records without mutating audit rows for clean saves", () => {
    platformStore.saveAttendanceBulk("class_ar_l3_a", "session_ar_live", {
      stu_demo: "late",
    });
    const before = platformStore.getState();
    const beforeAuditIds = before.auditLogs.map(item => item.id);

    const second = platformStore.saveAttendanceBulk(
      "class_ar_l3_a",
      "session_ar_live",
      {
        stu_demo: "late",
      }
    );
    const after = platformStore.getState();

    expect(second).toHaveLength(1);
    expect(after.auditLogs.map(item => item.id)).toEqual(beforeAuditIds);
    expect(
      after.attendance.filter(
        item =>
          item.classGroupId === "class_ar_l3_a" &&
          item.studentId === "stu_demo" &&
          item.sessionId === "session_ar_live"
      )
    ).toHaveLength(1);
  });

  it("rejects attendance saves that do not match the full class roster", () => {
    expect(() =>
      platformStore.saveAttendanceBulk("class_ar_l3_a", "session_ar_live", {})
    ).toThrow("Attendance is missing roster student stu_demo");

    expect(() =>
      platformStore.saveAttendanceBulk("class_ar_l3_a", "session_ar_live", {
        stu_demo: "present",
        stu_unknown: "absent",
      })
    ).toThrow("Student stu_unknown is not in this class roster");
  });

  it("rejects attendance saves for missing sessions", () => {
    expect(() =>
      platformStore.saveAttendanceBulk("class_ar_l3_a", "session_missing", {
        stu_demo: "present",
      })
    ).toThrow("Attendance session session_missing was not found.");

    expect(
      platformStore
        .getState()
        .classSessions.find(item => item.id === "session_ar_live")
        ?.attendanceSaved
    ).toBe(false);
  });

  it("rejects attendance saves when the session belongs to another class", () => {
    expect(() =>
      platformStore.saveAttendanceBulk(
        "class_ar_l3_a",
        "session_ar_cairo_live",
        {
          stu_demo: "present",
        }
      )
    ).toThrow("Attendance session does not belong to this class group");

    expect(
      platformStore
        .getState()
        .classSessions.find(item => item.id === "session_ar_cairo_live")
        ?.attendanceSaved
    ).toBe(false);
  });

  it("saves mixed attendance states for a complete roster", () => {
    const state = platformStore.getState();
    platformStore.setState({
      ...state,
      attendance: [],
      classGroups: state.classGroups.map(group =>
        group.id === "class_ar_l3_a"
          ? { ...group, studentIds: ["stu_demo", "stu_cairo_demo"] }
          : group
      ),
      auditLogs: [],
    });

    const saved = platformStore.saveAttendanceBulk(
      "class_ar_l3_a",
      "session_ar_live",
      {
        stu_demo: "excused",
        stu_cairo_demo: "absent",
      },
      "usr_teacher_demo"
    );
    const after = platformStore.getState();

    expect(saved).toHaveLength(2);
    expect(
      saved.map(record => [record.studentId, record.status]).sort()
    ).toEqual([
      ["stu_cairo_demo", "absent"],
      ["stu_demo", "excused"],
    ]);
    expect(
      after.classSessions.find(item => item.id === "session_ar_live")
        ?.attendanceSaved
    ).toBe(true);
    expect(after.auditLogs[0]).toMatchObject({
      action: "attendance.saved",
      entityType: "AttendanceRecord",
      entityId: "class_ar_l3_a",
      summary: "Saved attendance for 2 learner(s).",
    });
  });

  it("counts late and excused as attended while absent lowers the attendance rate", () => {
    const state = platformStore.getState();
    platformStore.setState({
      ...state,
      attendance: [],
      events: [
        ...state.events,
        {
          id: "evt_ar_followup",
          type: "class_session",
          title: "Arabic L3 follow up",
          startsAt: "2026-06-28T09:00:00+03:00",
          endsAt: "2026-06-28T10:00:00+03:00",
          ownerId: "usr_teacher_demo",
          branchId: "br_online",
          classGroupId: "class_ar_l3_a",
          status: "active",
        },
      ],
      classSessions: [
        ...state.classSessions.map(session =>
          session.id === "session_ar_live"
            ? { ...session, attendanceSaved: false }
            : session
        ),
        {
          id: "session_ar_followup",
          classGroupId: "class_ar_l3_a",
          eventId: "evt_ar_followup",
          title: "Arabic L3 follow up",
          startsAt: "2026-06-28T09:00:00+03:00",
          endsAt: "2026-06-28T10:00:00+03:00",
          status: "active",
          attendanceSaved: false,
        },
      ],
    });

    platformStore.saveAttendanceBulk("class_ar_l3_a", "session_ar_live", {
      stu_demo: "absent",
    });
    expect(
      platformStore.getState().enrollments.find(item => item.id === "enr_ar_l3")
        ?.attendanceRate
    ).toBe(0);

    platformStore.saveAttendanceBulk("class_ar_l3_a", "session_ar_followup", {
      stu_demo: "late",
    });
    expect(
      platformStore.getState().enrollments.find(item => item.id === "enr_ar_l3")
        ?.attendanceRate
    ).toBe(50);

    platformStore.saveAttendanceBulk("class_ar_l3_a", "session_ar_live", {
      stu_demo: "excused",
    });
    expect(
      platformStore.getState().enrollments.find(item => item.id === "enr_ar_l3")
        ?.attendanceRate
    ).toBe(100);
  });

  it("ignores stale attendance records when recalculating enrollment attendance rate", () => {
    const state = platformStore.getState();
    platformStore.setState({
      ...state,
      attendance: [
        {
          id: "att_orphan_legacy",
          classGroupId: "class_ar_l3_a",
          studentId: "stu_demo",
          sessionId: "legacy_unmapped_session",
          status: "absent",
          notes: "Legacy import row without a current session",
        },
      ],
      events: [
        ...state.events,
        {
          id: "evt_ar_followup",
          type: "class_session",
          title: "Arabic L3 follow up",
          startsAt: "2026-06-28T09:00:00+03:00",
          endsAt: "2026-06-28T10:00:00+03:00",
          ownerId: "usr_teacher_demo",
          branchId: "br_online",
          classGroupId: "class_ar_l3_a",
          status: "active",
        },
      ],
      classSessions: [
        ...state.classSessions.map(session =>
          session.id === "session_ar_live"
            ? { ...session, attendanceSaved: false }
            : session
        ),
        {
          id: "session_ar_followup",
          classGroupId: "class_ar_l3_a",
          eventId: "evt_ar_followup",
          title: "Arabic L3 follow up",
          startsAt: "2026-06-28T09:00:00+03:00",
          endsAt: "2026-06-28T10:00:00+03:00",
          status: "active",
          attendanceSaved: false,
        },
      ],
    });

    platformStore.saveAttendanceBulk("class_ar_l3_a", "session_ar_live", {
      stu_demo: "present",
    });
    platformStore.saveAttendanceBulk("class_ar_l3_a", "session_ar_followup", {
      stu_demo: "late",
    });

    const after = platformStore.getState();
    expect(
      after.enrollments.find(item => item.id === "enr_ar_l3")?.attendanceRate
    ).toBe(100);
    expect(after.attendance.some(item => item.id === "att_orphan_legacy")).toBe(
      true
    );
  });

  it("lets a branch actor save branch attendance with audit evidence", () => {
    const saved = platformStore.saveAttendanceBulk(
      "class_ar_l3_cairo",
      "session_ar_cairo_live",
      {
        stu_cairo_demo: "late",
      },
      "usr_branch_demo"
    );
    const after = platformStore.getState();
    const record = after.attendance.find(
      item =>
        item.classGroupId === "class_ar_l3_cairo" &&
        item.sessionId === "session_ar_cairo_live" &&
        item.studentId === "stu_cairo_demo"
    );

    expect(saved).toHaveLength(1);
    expect(record?.status).toBe("late");
    expect(
      after.classSessions.find(item => item.id === "session_ar_cairo_live")
        ?.attendanceSaved
    ).toBe(true);
    expect(after.auditLogs[0]).toMatchObject({
      actorId: "usr_branch_demo",
      action: "attendance.saved",
      entityType: "AttendanceRecord",
      entityId: "class_ar_l3_cairo",
      summary: "Saved attendance for 1 learner(s).",
    });
    expect(after.auditLogs[0]?.createdAt).toBeTruthy();
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

  it("records partial payment balance, reference, and clamps final overpayment", () => {
    const invoice = platformStore.getState().invoices[0];

    const partial = platformStore.recordPayment(
      invoice.id,
      "usr_registrar_demo",
      {
        amount: 300,
        method: "bank_transfer",
        reference: "BT-REG-001",
      }
    );
    const afterPartial = platformStore.getState();
    const partialRows = afterPartial.payments.filter(
      item => item.invoiceId === invoice.id
    );
    const partialReport = platformStore
      .exportReportRows("finance")
      .find(item => item.id === invoice.id);

    expect(partial).toMatchObject({
      amount: 300,
      method: "bank_transfer",
      reference: "BT-REG-001",
      status: "paid",
    });
    expect(
      afterPartial.invoices.find(item => item.id === invoice.id)?.status
    ).toBe("pending");
    expect(partialRows).toHaveLength(2);
    expect(partialReport).toMatchObject({
      paid: 1500,
      balance: 900,
      status: "pending",
    });

    const finalPayment = platformStore.recordPayment(
      invoice.id,
      "usr_registrar_demo",
      {
        amount: 2000,
        method: "card",
        reference: "CARD-FINAL",
      }
    );
    const afterFinal = platformStore.getState();
    const finalReport = platformStore
      .exportReportRows("finance")
      .find(item => item.id === invoice.id);

    expect(finalPayment).toMatchObject({
      amount: 900,
      method: "card",
      reference: "CARD-FINAL",
    });
    expect(
      afterFinal.invoices.find(item => item.id === invoice.id)?.status
    ).toBe("paid");
    const enrollment = afterFinal.enrollments.find(
      item => item.studentId === invoice.studentId
    );
    expect(enrollment).toBeTruthy();
    expect(afterFinal.auditLogs[0].summary).toContain(invoice.id);
    expect(afterFinal.auditLogs[0].summary).toContain(enrollment!.id);
    expect(finalReport).toMatchObject({
      paid: 2400,
      balance: 0,
      status: "paid",
    });
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

  it("rejects missing admissions targets without mutating another record", () => {
    const before = platformStore.getState();
    const leadStatuses = before.leads.map(item => [item.id, item.status]);
    const placementStatuses = before.placementTests.map(item => [
      item.id,
      item.status,
    ]);
    const applicationCount = before.applications.length;
    const placementResultCount = before.placementResults.length;
    const auditCount = before.auditLogs.length;

    expect(() =>
      platformStore.convertLeadToApplication("lead_missing_exact_target")
    ).toThrow("Lead lead_missing_exact_target was not found.");
    expect(() =>
      platformStore.recordPlacementResult(
        "placement_missing_exact_target",
        "Arabic Level 3",
        80,
        "Must not update another booking."
      )
    ).toThrow(
      "Placement booking placement_missing_exact_target was not found."
    );

    const after = platformStore.getState();
    expect(after.leads.map(item => [item.id, item.status])).toEqual(
      leadStatuses
    );
    expect(after.placementTests.map(item => [item.id, item.status])).toEqual(
      placementStatuses
    );
    expect(after.applications).toHaveLength(applicationCount);
    expect(after.placementResults).toHaveLength(placementResultCount);
    expect(after.auditLogs).toHaveLength(auditCount);
  });

  it.each([-1, 101])(
    "rejects out-of-range placement score %s without lifecycle writes",
    score => {
      const booking = platformStore.getState().placementTests[0];
      const before = platformStore.getState();
      const resultCount = before.placementResults.length;
      const workflowCount = before.enrollmentWorkflows.length;
      const auditCount = before.auditLogs.length;

      expect(() =>
        platformStore.recordPlacementResult(
          booking.id,
          "Arabic Level 3",
          score,
          "Invalid score must fail."
        )
      ).toThrow("Placement score must be between 0 and 100.");

      const after = platformStore.getState();
      expect(after.placementResults).toHaveLength(resultCount);
      expect(after.enrollmentWorkflows).toHaveLength(workflowCount);
      expect(after.auditLogs).toHaveLength(auditCount);
      expect(after.placementTests.find(item => item.id === booking.id)).toEqual(
        booking
      );
    }
  );

  it("activates an enrollment workflow into a student account, class seat, and invoice", () => {
    const lead = platformStore.createLead({
      fullName: "Activation Lead",
      email: "activation.lead@nilelearn.local",
      phone: "+20 100 000 0101",
      subject: "Arabic Language",
      notes: "Needs morning class",
    });
    platformStore.createPlacementBooking({
      fullName: lead.fullName,
      email: lead.email,
      phone: lead.phone,
      subject: lead.subject,
      preferredDate: "2026-07-10",
      currentLevel: "Can read short texts",
      branchId: "br_online",
    });
    const booking = platformStore
      .getState()
      .placementTests.find(item => item.email === lead.email);
    expect(booking).toBeTruthy();

    platformStore.recordPlacementResult(
      booking!.id,
      "Arabic Level 3",
      82,
      "Ready for Level 3",
      "usr_registrar_demo"
    );
    const workflow = platformStore
      .getState()
      .enrollmentWorkflows.find(item => item.placementTestId === booking!.id);
    expect(workflow?.status).toBe("ready_to_enroll");

    const activated = platformStore.activateEnrollmentWorkflow(workflow!.id, {
      courseRunId: "run_ar_l3_2026",
      classGroupId: "class_ar_l3_a",
    });
    const after = platformStore.getState();
    const user = after.users.find(item => item.id === activated?.userId);
    const enrollment = after.enrollments.find(
      item =>
        item.studentId === activated?.id &&
        item.courseRunId === "run_ar_l3_2026"
    );
    const classGroup = after.classGroups.find(
      item => item.id === "class_ar_l3_a"
    );
    const invoice = after.invoices.find(
      item => item.studentId === activated?.id
    );
    const lessonRows = after.lessonProgress.filter(
      item => item.studentId === activated?.id
    );
    const workflowAfter = after.enrollmentWorkflows.find(
      item => item.id === workflow!.id
    );
    const runAssignments = after.assignments.filter(
      item => item.courseRunId === "run_ar_l3_2026"
    );
    const runQuizzes = after.quizzes.filter(
      item => item.courseRunId === "run_ar_l3_2026"
    );
    const classSessions = after.classSessions.filter(
      item => item.classGroupId === "class_ar_l3_a"
    );
    const classEvents = after.events.filter(
      item => item.classGroupId === "class_ar_l3_a"
    );

    expect(user).toMatchObject({
      name: "Activation Lead",
      email: "activation.lead@nilelearn.local",
      activeRole: "student",
      branchId: "br_online",
      status: "active",
    });
    expect(activated).toMatchObject({
      status: "active",
      currentLevel: "Arabic Level 3",
      preferredLanguage: "English",
    });
    expect(enrollment).toMatchObject({
      status: "active",
      progress: 0,
      classGroupId: "class_ar_l3_a",
      teacherId: "usr_teacher_demo",
    });
    expect(workflowAfter).toMatchObject({
      studentId: activated?.id,
      courseRunId: "run_ar_l3_2026",
      classGroupId: "class_ar_l3_a",
      status: "active",
    });
    expect(classGroup?.studentIds).toContain(activated?.id);
    expect(invoice).toMatchObject({
      enrollmentId: enrollment?.id,
      amount: 2400,
      currency: "EGP",
      status: "pending",
    });
    expect(lessonRows.length).toBeGreaterThan(0);
    expect(runAssignments.length).toBeGreaterThan(0);
    expect(runQuizzes.length).toBeGreaterThan(0);
    expect(classSessions.length).toBeGreaterThan(0);
    expect(classEvents.length).toBeGreaterThan(0);
    expect(after.auditLogs[0]).toMatchObject({
      action: "enrollment.activated",
      entityType: "EnrollmentWorkflow",
      entityId: workflow!.id,
    });
  });

  it("keeps application and placement transitions in one enrollment workflow", () => {
    const applicationResult = platformStore.createApplication({
      fullName: "Linked Placement Learner",
      email: "linked.placement@nilelearn.local",
      phone: "+20 100 000 0111",
      branchId: "br_cairo",
      courseInterest: "Arabic Language",
      schedulePreference: "Evening",
      notes: "Placement is required before enrollment.",
    });
    const booking = platformStore.createPlacementBooking({
      leadId: applicationResult.lead.id,
      fullName: "Ignored client identity",
      email: "ignored@nilelearn.local",
      phone: "+20 000 000 0000",
      branchId: "br_cairo",
      subject: "Ignored client subject",
      preferredDate: "2026-07-16",
      currentLevel: "Placement pending",
    });

    expect(booking).toMatchObject({
      leadId: applicationResult.lead.id,
      fullName: applicationResult.lead.fullName,
      email: applicationResult.lead.email,
      phone: applicationResult.lead.phone,
      branchId: applicationResult.application.branchId,
      subject: applicationResult.application.courseInterest,
    });

    platformStore.recordPlacementResult(
      booking.id,
      "Arabic Level 3",
      84,
      "Ready for the assigned level."
    );
    const afterPlacement = platformStore.getState();
    const placementWorkflow = afterPlacement.enrollmentWorkflows.find(
      item => item.placementTestId === booking.id
    );
    expect(placementWorkflow).toMatchObject({
      leadId: applicationResult.lead.id,
      applicationId: applicationResult.application.id,
      placementTestId: booking.id,
      source: "placement",
      status: "ready_to_enroll",
    });

    const converted = platformStore.convertApplicationToEnrollment(
      applicationResult.application.id
    );
    const linkedWorkflows = platformStore
      .getState()
      .enrollmentWorkflows.filter(
        item => item.leadId === applicationResult.lead.id
      );
    expect(linkedWorkflows).toHaveLength(1);
    expect(converted.id).toBe(placementWorkflow?.id);
    expect(converted).toMatchObject({
      applicationId: applicationResult.application.id,
      placementTestId: booking.id,
      recommendedLevel: "Arabic Level 3",
      source: "placement",
    });

    const beforeRejectedUpdate = platformStore.getState();
    platformStore.setState({
      ...beforeRejectedUpdate,
      enrollmentWorkflows: beforeRejectedUpdate.enrollmentWorkflows.map(item =>
        item.id === converted.id ? { ...item, status: "active" } : item
      ),
    });
    const activeSnapshot = platformStore.getState();
    const resultBefore = activeSnapshot.placementResults.find(
      item => item.bookingId === booking.id
    );
    const auditCountBefore = activeSnapshot.auditLogs.length;
    expect(() =>
      platformStore.recordPlacementResult(
        booking.id,
        "Arabic Level 4",
        90,
        "Must not replace an active handoff."
      )
    ).toThrow(
      "Active enrollment workflows cannot be replaced by placement results."
    );
    const afterRejectedUpdate = platformStore.getState();
    expect(
      afterRejectedUpdate.placementResults.find(
        item => item.bookingId === booking.id
      )
    ).toEqual(resultBefore);
    expect(afterRejectedUpdate.auditLogs).toHaveLength(auditCountBefore);
  });

  it("activates an application handoff with level, class, invoice, and portal learning data", () => {
    const created = platformStore.createApplication({
      fullName: "Application Activation Student",
      email: "application.activation@nilelearn.local",
      phone: "+20 100 000 0102",
      branchId: "br_cairo",
      courseInterest: "Arabic Language",
      schedulePreference: "Morning",
      notes: "Application handoff activation test.",
      source: "manual",
    });
    const workflow = platformStore.convertApplicationToEnrollment(
      created.application.id
    )!;

    const activated = platformStore.activateEnrollmentWorkflow(workflow.id, {
      courseRunId: "run_ar_l3_cairo_2026",
      classGroupId: "class_ar_l3_cairo",
    });
    const after = platformStore.getState();
    const enrollment = after.enrollments.find(
      item => item.studentId === activated?.id
    );
    const classGroup = after.classGroups.find(
      item => item.id === "class_ar_l3_cairo"
    );
    const invoice = after.invoices.find(
      item => item.studentId === activated?.id
    );
    const lessonRows = after.lessonProgress.filter(
      item => item.studentId === activated?.id
    );
    const workflowAfter = after.enrollmentWorkflows.find(
      item => item.id === workflow.id
    );

    expect(activated).toMatchObject({
      status: "active",
      source: "application",
      currentLevel: workflow.recommendedLevel,
      courseInterest: "Arabic Language",
    });
    expect(activated?.currentLevel).not.toBe("Placement pending");
    expect(enrollment).toMatchObject({
      status: "active",
      classGroupId: "class_ar_l3_cairo",
      teacherId: "usr_teacher_demo",
    });
    expect(classGroup?.studentIds).toContain(activated?.id);
    expect(invoice).toMatchObject({
      enrollmentId: enrollment?.id,
      amount: 2400,
      currency: "EGP",
      status: "pending",
    });
    expect(lessonRows.length).toBeGreaterThan(0);
    expect(workflowAfter).toMatchObject({
      studentId: activated?.id,
      status: "active",
      nextStep: "Portal active, class assigned, invoice pending payment",
    });
    expect(
      after.applications.find(item => item.id === created.application.id)
        ?.status
    ).toBe("approved");
    expect(after.leads.find(item => item.id === created.lead.id)?.status).toBe(
      "active"
    );
    expect(invoice).toBeTruthy();
    expect(after.auditLogs[0].summary).toContain(invoice!.id);
  });

  it("does not duplicate a workflow activation", () => {
    const workflow = platformStore.getState().enrollmentWorkflows[0];
    const exactAssignment = {
      courseRunId: "run_ar_l3_2026",
      classGroupId: "class_ar_l3_a",
    };
    const first = platformStore.activateEnrollmentWorkflow(
      workflow.id,
      exactAssignment
    );
    const usersAfterFirst = platformStore.getState().users.length;
    const second = platformStore.activateEnrollmentWorkflow(workflow.id);
    const afterSecond = platformStore.getState();

    expect(second?.id).toBe(first?.id);
    expect(afterSecond.users).toHaveLength(usersAfterFirst);
    expect(
      afterSecond.enrollmentWorkflows.find(item => item.id === workflow.id)
        ?.studentId
    ).toBe(first?.id);
  });

  it("rejects conflicting assignment changes after workflow activation", () => {
    const workflow = platformStore.getState().enrollmentWorkflows[0];
    const first = platformStore.activateEnrollmentWorkflow(workflow.id, {
      courseRunId: "run_ar_l3_2026",
      classGroupId: "class_ar_l3_a",
    });

    expect(first?.id).toBeTruthy();
    expect(() =>
      platformStore.activateEnrollmentWorkflow(workflow.id, {
        courseRunId: "run_ar_l3_cairo_2026",
        classGroupId: "class_ar_l3_cairo",
      })
    ).toThrow("cannot be reassigned to a different course run");
  });

  it("requires real intake identity before activating an enrollment workflow", () => {
    const state = platformStore.getState();
    platformStore.setState({
      ...state,
      enrollmentWorkflows: [
        {
          id: "ew_missing_identity",
          targetCourseId: "course_ar_l3",
          targetLevelId: "lvl_ar_l3",
          source: "lead",
          status: "ready_to_enroll",
          nextStep: "Complete intake identity",
          updatedAt: "2026-07-01T09:00:00+03:00",
        },
        ...state.enrollmentWorkflows,
      ],
    });

    expect(() =>
      platformStore.activateEnrollmentWorkflow("ew_missing_identity", {
        courseRunId: "run_ar_l3_2026",
        classGroupId: "class_ar_l3_a",
      })
    ).toThrow("requires lead or placement identity");
  });

  it("does not duplicate certificate issue notifications or audit entries", () => {
    const certificate = platformStore.getState().certificates[0];

    platformStore.approveCertificate(certificate.id, "usr_hod_demo");
    platformStore.issueCertificate(certificate.id, "usr_hod_demo");
    const afterFirst = platformStore.getState();
    const firstIssuedCertificate = afterFirst.certificates.find(
      item => item.id === certificate.id
    );
    const firstDocuments = afterFirst.documents.filter(
      item =>
        item.type === "certificate" &&
        item.ownerId === certificate.studentId &&
        item.url === `#certificate-${certificate.id}`
    );
    platformStore.issueCertificate(certificate.id, "usr_hod_demo");
    const afterSecond = platformStore.getState();
    const secondDocuments = afterSecond.documents.filter(
      item =>
        item.type === "certificate" &&
        item.ownerId === certificate.studentId &&
        item.url === `#certificate-${certificate.id}`
    );

    expect(
      afterSecond.certificates.find(item => item.id === certificate.id)?.status
    ).toBe("issued");
    expect(
      afterSecond.certificates.find(item => item.id === certificate.id)
        ?.issuedBy
    ).toBe(firstIssuedCertificate?.issuedBy);
    expect(
      afterSecond.certificates.find(item => item.id === certificate.id)
        ?.issuedAt
    ).toBe(firstIssuedCertificate?.issuedAt);
    expect(firstDocuments).toHaveLength(1);
    expect(secondDocuments).toHaveLength(1);
    expect(secondDocuments[0]).toMatchObject({
      title: `${certificate.verificationCode} certificate`,
      status: "active",
    });
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

    const issued = platformStore.issueCertificate(
      certificate.id,
      "usr_hod_demo"
    );
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

  it("does not issue draft or revoked certificates", () => {
    const state = platformStore.getState();
    const base = state.certificates[0];
    platformStore.setState({
      ...state,
      certificates: [
        {
          ...base,
          id: "cert_draft_issue_test",
          status: "draft",
          verificationCode: "NCL-DRAFT-ISSUE",
        },
        {
          ...base,
          id: "cert_revoked_issue_test",
          status: "revoked",
          verificationCode: "NCL-REVOKED-ISSUE",
        },
      ],
      notifications: [],
      auditLogs: [],
    });

    expect(
      platformStore.issueCertificate("cert_draft_issue_test", "usr_hod_demo")
    ).toBeUndefined();
    expect(
      platformStore.issueCertificate("cert_revoked_issue_test", "usr_hod_demo")
    ).toBeUndefined();

    const after = platformStore.getState();
    expect(after.certificates.map(item => item.status)).toEqual([
      "draft",
      "revoked",
    ]);
    expect(
      after.notifications.filter(item => item.title === "Certificate issued")
    ).toHaveLength(0);
    expect(
      after.auditLogs.filter(item => item.action === "certificate.issued")
    ).toHaveLength(0);
  });

  it("approves only eligible pending certificates and records audit evidence", () => {
    const certificate = platformStore.getState().certificates[0];

    const approved = platformStore.approveCertificate(
      certificate.id,
      "usr_hod_demo"
    );
    const after = platformStore.getState();

    expect(approved?.status).toBe("approved");
    expect(approved?.approvedBy).toBe("usr_hod_demo");
    expect(approved?.approvedAt).toBeTruthy();
    expect(
      after.auditLogs.filter(item => item.action === "certificate.approved")
    ).toHaveLength(1);
  });

  it("does not duplicate approval audit or rewrite approval evidence", () => {
    const certificate = platformStore.getState().certificates[0];

    platformStore.approveCertificate(certificate.id, "usr_hod_demo");
    const afterFirst = platformStore.getState();
    const firstApprovedCertificate = afterFirst.certificates.find(
      item => item.id === certificate.id
    );

    platformStore.approveCertificate(certificate.id, "usr_admin_demo");
    const afterSecond = platformStore.getState();
    const secondApprovedCertificate = afterSecond.certificates.find(
      item => item.id === certificate.id
    );

    expect(secondApprovedCertificate?.status).toBe("approved");
    expect(secondApprovedCertificate?.approvedBy).toBe(
      firstApprovedCertificate?.approvedBy
    );
    expect(secondApprovedCertificate?.approvedAt).toBe(
      firstApprovedCertificate?.approvedAt
    );
    expect(
      afterSecond.auditLogs.filter(
        item => item.action === "certificate.approved"
      )
    ).toHaveLength(1);
  });

  it("does not approve draft revoked or ineligible certificates", () => {
    const state = platformStore.getState();
    const base = state.certificates[0];
    platformStore.setState({
      ...state,
      certificates: [
        {
          ...base,
          id: "cert_draft_test",
          status: "draft",
          verificationCode: "NCL-DRAFT-TEST",
        },
        {
          ...base,
          id: "cert_revoked_test",
          status: "revoked",
          verificationCode: "NCL-REVOKED-TEST",
        },
        {
          ...base,
          id: "cert_ineligible_test",
          status: "pending_approval",
          grade: 79,
          attendanceRate: 94,
          verificationCode: "NCL-INELIGIBLE-TEST",
        },
      ],
      auditLogs: [],
    });

    expect(
      platformStore.approveCertificate("cert_draft_test", "usr_hod_demo")
    ).toBeUndefined();
    expect(
      platformStore.approveCertificate("cert_revoked_test", "usr_hod_demo")
    ).toBeUndefined();
    expect(
      platformStore.approveCertificate("cert_ineligible_test", "usr_hod_demo")
    ).toBeUndefined();

    const after = platformStore.getState();
    expect(after.certificates.map(item => item.status)).toEqual([
      "draft",
      "revoked",
      "pending_approval",
    ]);
    expect(
      after.auditLogs.filter(item => item.action === "certificate.approved")
    ).toHaveLength(0);
  });

  it("rejects pending certificates with durable HOD decision evidence", () => {
    const certificate = platformStore.getState().certificates[0];

    const rejected = platformStore.rejectCertificate(
      certificate.id,
      "usr_hod_demo",
      "Attendance evidence needs academic review"
    );
    const after = platformStore.getState();

    expect(rejected?.status).toBe("rejected");
    expect(rejected?.rejectedBy).toBe("usr_hod_demo");
    expect(rejected?.rejectedAt).toBeTruthy();
    expect(rejected?.rejectionReason).toBe(
      "Attendance evidence needs academic review"
    );
    expect(
      after.auditLogs.filter(item => item.action === "certificate.rejected")
    ).toHaveLength(1);
    expect(after.auditLogs[0]?.summary).toContain(
      "Attendance evidence needs academic review"
    );
  });

  it("does not issue rejected certificates", () => {
    const certificate = platformStore.getState().certificates[0];

    platformStore.rejectCertificate(
      certificate.id,
      "usr_hod_demo",
      "Eligibility evidence was incomplete"
    );
    const issued = platformStore.issueCertificate(
      certificate.id,
      "usr_hod_demo"
    );
    const after = platformStore.getState();

    expect(issued).toBeUndefined();
    expect(
      after.certificates.find(item => item.id === certificate.id)?.status
    ).toBe("rejected");
    expect(
      after.notifications.filter(item => item.title === "Certificate issued")
    ).toHaveLength(0);
    expect(
      after.auditLogs.filter(item => item.action === "certificate.issued")
    ).toHaveLength(0);
  });

  it("does not reject certificates without a decision reason", () => {
    const certificate = platformStore.getState().certificates[0];

    const rejected = platformStore.rejectCertificate(
      certificate.id,
      "usr_hod_demo",
      " "
    );
    const after = platformStore.getState();

    expect(rejected).toBeUndefined();
    expect(
      after.certificates.find(item => item.id === certificate.id)?.status
    ).toBe("pending_approval");
    expect(
      after.auditLogs.filter(item => item.action === "certificate.rejected")
    ).toHaveLength(0);
  });

  it("rejects cross-branch calendar class groups", () => {
    const before = platformStore.getState();
    const onlineClass = before.classGroups.find(
      item => item.id === "class_ar_l3_a"
    );
    expect(onlineClass).toBeTruthy();

    expect(() =>
      platformStore.createCalendarEvent(
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
      )
    ).toThrow("Calendar class group must belong to the event branch");

    const after = platformStore.getState();

    expect(after.events).toHaveLength(before.events.length);
    expect(after.classSessions).toHaveLength(before.classSessions.length);
  });

  it("rejects class sessions without a class group", () => {
    expect(() =>
      platformStore.createCalendarEvent(
        {
          title: "Missing class group",
          type: "live_session",
          startsAt: "2026-07-04T10:00:00+03:00",
          endsAt: "2026-07-04T11:00:00+03:00",
          ownerId: "usr_teacher_demo",
          branchId: "br_online",
          roomId: "room_online_a",
        },
        "usr_teacher_demo"
      )
    ).toThrow("Calendar class session requires a class group");
  });

  it("creates an active calendar event and class session when no conflict exists", () => {
    const result = platformStore.createCalendarEvent(
      {
        title: "Arabic makeup class",
        type: "live_session",
        startsAt: "2026-07-02T10:00:00+03:00",
        endsAt: "2026-07-02T11:00:00+03:00",
        ownerId: "usr_teacher_demo",
        branchId: "br_online",
        roomId: "room_online_a",
        classGroupId: "class_ar_l3_a",
      },
      "usr_teacher_demo"
    );
    const after = platformStore.getState();

    expect(result.conflicts).toHaveLength(0);
    expect(result.event.status).toBe("active");
    expect(
      after.classSessions.some(item => item.eventId === result.event.id)
    ).toBe(true);
    expect(
      after.auditLogs.some(
        item =>
          item.action === "calendar.created" &&
          item.entityId === result.event.id
      )
    ).toBe(true);
  });

  it("saves class sessions outside teacher availability as pending", () => {
    const result = platformStore.createCalendarEvent(
      {
        title: "Arabic outside availability",
        type: "live_session",
        startsAt: "2026-07-04T10:00:00+03:00",
        endsAt: "2026-07-04T11:00:00+03:00",
        ownerId: "usr_teacher_demo",
        branchId: "br_online",
        roomId: "room_online_a",
        classGroupId: "class_ar_l3_a",
      },
      "usr_teacher_demo"
    );
    const after = platformStore.getState();

    expect(result.conflicts).toHaveLength(0);
    expect(result.availabilityGaps).toEqual(["usr_teacher_demo"]);
    expect(result.event.status).toBe("pending");
    expect(
      after.auditLogs.some(
        item =>
          item.action === "calendar.created_with_conflict" &&
          item.entityId === result.event.id &&
          item.summary.includes("teacher availability review")
      )
    ).toBe(true);
  });

  it("saves conflicting calendar events as pending with audit evidence", () => {
    const result = platformStore.createCalendarEvent(
      {
        title: "Overlapping Arabic class",
        type: "live_session",
        startsAt: "2026-06-26T09:15:00+03:00",
        endsAt: "2026-06-26T10:00:00+03:00",
        ownerId: "usr_teacher_demo",
        branchId: "br_online",
        roomId: "room_online_a",
        classGroupId: "class_ar_l3_a",
      },
      "usr_teacher_demo"
    );
    const after = platformStore.getState();

    expect(result.conflicts.length).toBeGreaterThan(0);
    expect(result.event.status).toBe("pending");
    expect(
      after.auditLogs.some(
        item =>
          item.action === "calendar.created_with_conflict" &&
          item.entityId === result.event.id
      )
    ).toBe(true);
  });

  it("flags branch-created class sessions that overlap the assigned teacher", () => {
    const result = platformStore.createCalendarEvent(
      {
        title: "Branch overlap with teacher",
        type: "live_session",
        startsAt: "2026-06-26T09:20:00+03:00",
        endsAt: "2026-06-26T10:10:00+03:00",
        ownerId: "usr_branch_demo",
        branchId: "br_online",
        classGroupId: "class_ar_l3_a",
      },
      "usr_branch_demo"
    );

    expect(result.conflicts.some(item => item.id === "evt_ar_live")).toBe(true);
    expect(result.event.status).toBe("pending");
  });

  it("rejects invalid calendar time ranges", () => {
    expect(() =>
      platformStore.createCalendarEvent(
        {
          title: "Invalid class range",
          type: "live_session",
          startsAt: "2026-07-04T11:00:00+03:00",
          endsAt: "2026-07-04T10:00:00+03:00",
          ownerId: "usr_teacher_demo",
          branchId: "br_online",
          roomId: "room_online_a",
          classGroupId: "class_ar_l3_a",
        },
        "usr_teacher_demo"
      )
    ).toThrow("Calendar event requires a valid time range");
  });

  it("rejects calendar rooms outside the selected event branch", () => {
    expect(() =>
      platformStore.createCalendarEvent(
        {
          title: "Wrong room branch",
          type: "room_booking",
          startsAt: "2026-07-04T10:00:00+03:00",
          endsAt: "2026-07-04T11:00:00+03:00",
          ownerId: "usr_branch_demo",
          branchId: "br_cairo",
          roomId: "room_online_a",
        },
        "usr_branch_demo"
      )
    ).toThrow("Calendar room must belong to the event branch");
  });

  it("rejects room bookings without a room", () => {
    expect(() =>
      platformStore.createCalendarEvent(
        {
          title: "Room missing",
          type: "room_booking",
          startsAt: "2026-07-04T10:00:00+03:00",
          endsAt: "2026-07-04T11:00:00+03:00",
          ownerId: "usr_branch_demo",
          branchId: "br_cairo",
        },
        "usr_branch_demo"
      )
    ).toThrow("Room booking requires a room");
  });

  it("creates calendar events with an actor-derived owner", () => {
    const result = platformStore.createCalendarEvent(
      {
        title: "Actor owned reminder",
        type: "reminder",
        startsAt: "2026-07-04T10:00:00+03:00",
        endsAt: "2026-07-04T10:15:00+03:00",
        branchId: "br_online",
      },
      "usr_teacher_demo"
    );

    expect(result.event.ownerId).toBe("usr_teacher_demo");
  });

  it("rejects calendar events without branch scope", () => {
    expect(() =>
      platformStore.createCalendarEvent(
        {
          title: "Unscoped calendar reminder",
          type: "reminder",
          startsAt: "2026-07-04T10:00:00+03:00",
          endsAt: "2026-07-04T10:15:00+03:00",
        },
        "usr_teacher_demo"
      )
    ).toThrow("Calendar event requires a branch");
  });

  it("rejects calendar events with unknown branches", () => {
    expect(() =>
      platformStore.createCalendarEvent(
        {
          title: "Fake branch event",
          type: "reminder",
          startsAt: "2026-07-04T10:00:00+03:00",
          endsAt: "2026-07-04T10:15:00+03:00",
          branchId: "br_missing",
        },
        "usr_teacher_demo"
      )
    ).toThrow("Branch br_missing was not found");
  });

  it("marks owner-only calendar overlaps as pending with audit evidence", () => {
    const first = platformStore.createCalendarEvent(
      {
        title: "Teacher planning block",
        type: "reminder",
        startsAt: "2026-07-05T09:00:00+03:00",
        endsAt: "2026-07-05T10:00:00+03:00",
        branchId: "br_online",
      },
      "usr_teacher_demo"
    );
    const second = platformStore.createCalendarEvent(
      {
        title: "Teacher overlap block",
        type: "reminder",
        startsAt: "2026-07-05T09:30:00+03:00",
        endsAt: "2026-07-05T10:15:00+03:00",
        branchId: "br_online",
      },
      "usr_teacher_demo"
    );
    const after = platformStore.getState();

    expect(first.event.status).toBe("active");
    expect(second.conflicts.map(item => item.id)).toContain(first.event.id);
    expect(second.event.status).toBe("pending");
    expect(
      after.auditLogs.some(
        item =>
          item.action === "calendar.created_with_conflict" &&
          item.entityId === second.event.id &&
          item.summary.includes("1 conflict")
      )
    ).toBe(true);
  });

  it("creates room bookings without class sessions", () => {
    const before = platformStore.getState();
    const result = platformStore.createCalendarEvent(
      {
        title: "Cairo room maintenance",
        type: "room_booking",
        startsAt: "2026-07-06T12:00:00+03:00",
        endsAt: "2026-07-06T13:00:00+03:00",
        branchId: "br_cairo",
        roomId: "room_cairo_4",
      },
      "usr_branch_demo"
    );
    const after = platformStore.getState();

    expect(result.event.status).toBe("active");
    expect(result.event.classGroupId).toBeUndefined();
    expect(after.classSessions).toHaveLength(before.classSessions.length);
    expect(after.events[0]).toMatchObject({
      id: result.event.id,
      type: "room_booking",
      roomId: "room_cairo_4",
    });
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
        pendingMedia: [pendingMedia("audio")],
      },
      "usr_student_demo"
    );
    const after = platformStore.getState();

    expect(submission).toMatchObject({
      studentId: "stu_demo",
      teacherId: plan!.teacherId,
      status: "pending",
      pendingMedia: [
        expect.objectContaining({
          name: "recitation.mp3",
          storageStatus: "pending_storage",
        }),
      ],
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

  it("allows Quran recitation submissions while storage is still pending", () => {
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

    expect(submission.status).toBe("pending");
    expect(submission.pendingMedia).toEqual([]);
  });

  it("updates Quran progress with clamped scores and audit evidence", () => {
    const progress = platformStore.getState().quranProgress[0];

    const updated = platformStore.updateQuranProgress(
      progress.id,
      130,
      -12,
      "Revision cycle adjusted after recitation review.",
      "usr_teacher_demo"
    );
    const after = platformStore.getState();

    expect(updated).toMatchObject({
      id: progress.id,
      memorizedPercent: 100,
      tajweedScore: 0,
      notes: "Revision cycle adjusted after recitation review.",
    });
    expect(
      after.auditLogs.some(
        item =>
          item.action === "quran.progress_updated" &&
          item.entityId === progress.id &&
          item.actorId === "usr_teacher_demo"
      )
    ).toBe(true);
  });

  it("reviews a recitation with feedback notification and audit evidence", () => {
    const submission = platformStore.getState().recitationSubmissions[0];

    const reviewed = platformStore.reviewRecitation(
      submission.id,
      "Strong recitation. Review ghunnah timing before next submission.",
      "usr_teacher_demo"
    );
    const after = platformStore.getState();

    expect(reviewed).toMatchObject({
      id: submission.id,
      status: "approved",
      feedback:
        "Strong recitation. Review ghunnah timing before next submission.",
    });
    expect(
      after.notifications.some(
        item =>
          item.title === "Recitation reviewed" &&
          item.body ===
            "Strong recitation. Review ghunnah timing before next submission."
      )
    ).toBe(true);
    expect(
      after.auditLogs.some(
        item =>
          item.action === "recitation.reviewed" &&
          item.entityId === submission.id &&
          item.actorId === "usr_teacher_demo"
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
        dueAt: "2026-07-04T18:00:00.000Z",
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
      status: "draft",
    });
    expect(after.quizzes[0]).toMatchObject({
      id: quiz.id,
      courseRunId: run.id,
      dueAt: "2026-07-04T18:00:00.000Z",
      status: "draft",
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

  it("blocks unassigned teachers from class-scoped assessment, attendance, and grading work", () => {
    const state = platformStore.getState();
    const submission = state.assignmentSubmissions.find(
      item => item.assignmentId === "asg_ar_grammar"
    );
    const attempt = state.quizAttempts.find(
      item => item.quizId === "quiz_ar_3"
    );
    expect(submission).toBeTruthy();
    expect(attempt).toBeTruthy();

    expect(() =>
      platformStore.createAssignment(
        {
          courseRunId: "run_ar_l3_2026",
          title: "Unassigned teacher assignment",
          dueAt: "2026-07-03T18:00:00.000Z",
          submissionType: "text",
          rubric: ["Accuracy"],
        },
        "usr_teacher_spare"
      )
    ).toThrow("Teacher can only create assessments for assigned course runs.");

    expect(() =>
      platformStore.saveAttendanceBulk(
        "class_ar_l3_a",
        "session_ar_live",
        { stu_demo: "present" },
        "usr_teacher_spare"
      )
    ).toThrow("Teacher can only save attendance for assigned classes.");

    expect(() =>
      platformStore.gradeAssignmentSubmission(
        submission!.id,
        88,
        "This should not be accepted.",
        "usr_teacher_spare"
      )
    ).toThrow("Teacher can only grade assigned class submissions.");

    expect(() =>
      platformStore.reviewQuizAttempt(
        attempt!.id,
        88,
        "This should not be accepted.",
        "usr_teacher_spare"
      )
    ).toThrow("Teacher can only review assigned class quiz attempts.");

    const after = platformStore.getState();
    expect(
      after.assignmentSubmissions.find(item => item.id === submission!.id)
        ?.status
    ).toBe(submission!.status);
    expect(
      after.quizAttempts.find(item => item.id === attempt!.id)?.status
    ).toBe(attempt!.status);
  });
});

describe("platformStore frontend utility helpers", () => {
  it("verifies issued certificates by code with public-safe student and course context", () => {
    const certificate = platformStore.getState().certificates[0];
    platformStore.approveCertificate(certificate.id, "usr_hod_demo");
    platformStore.issueCertificate(certificate.id, "usr_hod_demo");

    const result = platformStore.verifyCertificate(
      `  ${certificate.verificationCode.toLowerCase()}  `
    );

    expect(result).toMatchObject({
      verificationCode: certificate.verificationCode,
      studentName: "Student Demo",
      courseTitle: "Standard Arabic Level 3",
      status: "issued",
    });
    expect(result?.issuedAt).toBeTruthy();
    expect("certificate" in result!).toBe(false);
    expect("student" in result!).toBe(false);
    expect("user" in result!).toBe(false);
    expect("course" in result!).toBe(false);
  });

  it("does not verify pending certificates by code", () => {
    const certificate = platformStore.getState().certificates[0];

    expect(
      platformStore.verifyCertificate(certificate.verificationCode)
    ).toBeNull();
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

  it("exports attendance and audit rows after attendance saves", () => {
    platformStore.saveAttendanceBulk(
      "class_ar_l3_a",
      "session_ar_live",
      { stu_demo: "late" },
      "usr_teacher_demo"
    );

    const attendanceRows = platformStore.exportReportRows("attendance");
    const auditRows = platformStore.exportReportRows("audit");
    const attendanceRow = attendanceRows.find(
      item =>
        item.classGroupId === "class_ar_l3_a" &&
        item.sessionId === "session_ar_live" &&
        item.studentId === "stu_demo"
    );
    const auditRow = auditRows.find(item => item.action === "attendance.saved");
    const attendanceCsv = platformStore.buildCsv([attendanceRow!]);
    const auditCsv = platformStore.buildCsv([auditRow!]);

    expect(attendanceRow).toMatchObject({
      classGroupId: "class_ar_l3_a",
      sessionId: "session_ar_live",
      studentId: "stu_demo",
      status: "late",
    });
    expect(auditRow).toMatchObject({
      actorId: "usr_teacher_demo",
      action: "attendance.saved",
      entityType: "AttendanceRecord",
      entityId: "class_ar_l3_a",
      summary: "Saved attendance for 1 learner(s).",
    });
    expect(attendanceCsv).toContain("classGroupId");
    expect(attendanceCsv).toContain("session_ar_live");
    expect(auditCsv).toContain("actorId,action,entityType");
    expect(auditCsv).toContain("attendance.saved");
  });

  it("saves report presets with owner, role, filters, and audit evidence", () => {
    const preset = platformStore.saveReportPreset({
      role: "branchadmin",
      label: "Cairo attendance exceptions",
      reportType: "attendance",
      search: "late",
      status: "late",
      rowCount: 1,
      actorId: "usr_branch_demo",
    });
    const after = platformStore.getState();

    expect(preset).toMatchObject({
      ownerUserId: "usr_branch_demo",
      role: "branchadmin",
      label: "Cairo attendance exceptions",
      reportType: "attendance",
      search: "late",
      status: "late",
      rowCount: 1,
    });
    expect(after.reportPresets[0]).toMatchObject({ id: preset.id });
    expect(after.auditLogs[0]).toMatchObject({
      actorId: "usr_branch_demo",
      action: "report.preset.saved",
      entityType: "ReportPreset",
      entityId: preset.id,
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

  it("assigns a teacher across profile, course run, schedule, availability, and audit", () => {
    const state = platformStore.getState();
    platformStore.setState({
      ...state,
      users: [
        {
          id: "usr_teacher_new",
          name: "New Teacher",
          email: "new.teacher@nilelearn.local",
          roles: ["teacher"],
          activeRole: "teacher",
          branchId: "br_online",
          departmentId: "dep_arabic",
          status: "active",
        },
        ...state.users,
      ],
      teachers: state.teachers.filter(
        item => item.userId !== "usr_teacher_new"
      ),
      teacherAvailability: state.teacherAvailability.filter(
        item => item.teacherId !== "usr_teacher_new"
      ),
    });

    const assignment = platformStore.assignTeacherToCourseRun(
      "usr_teacher_new",
      "run_ar_l3_2026",
      {
        departmentId: "dep_arabic",
        specialties: ["Arabic grammar", "Arabic Level 3"],
        teachingLevels: ["Arabic Level 3"],
        availability: ["Mon 09:00", "Wed 09:00-10:30"],
        actorId: "usr_admin_demo",
      }
    );
    const after = platformStore.getState();
    const run = after.courseRuns.find(item => item.id === "run_ar_l3_2026");
    const classGroup = after.classGroups.find(
      item => item.courseRunId === run?.id
    );
    const event = after.events.find(
      item => item.classGroupId === classGroup?.id
    );
    const profile = after.teachers.find(
      item => item.userId === "usr_teacher_new"
    );
    const staffProfile = after.staffProfiles.find(
      item => item.userId === "usr_teacher_new" && item.role === "teacher"
    );
    const runEnrollments = after.enrollments.filter(
      item => item.courseRunId === "run_ar_l3_2026"
    );
    const previousProfile = after.teachers.find(
      item => item.userId === "usr_teacher_demo"
    );
    const audit = after.auditLogs.find(
      item => item.action === "teacher.assigned"
    );

    expect(assignment.previousTeacher?.id).toBe("usr_teacher_demo");
    expect(assignment.classGroups.length).toBeGreaterThan(0);
    expect(run?.teacherId).toBe("usr_teacher_new");
    expect(event?.ownerId).toBe("usr_teacher_new");
    expect(profile).toMatchObject({
      userId: "usr_teacher_new",
      departmentId: "dep_arabic",
      branchId: "br_online",
      subjects: expect.arrayContaining(["Arabic grammar"]),
      teachingLevels: expect.arrayContaining(["Arabic Level 3"]),
      specialties: expect.arrayContaining(["Arabic grammar", "Arabic Level 3"]),
      assignedClassIds: expect.arrayContaining(["class_ar_l3_a"]),
      availabilityStatus: "available",
      status: "active",
    });
    expect(previousProfile?.assignedClassIds).not.toContain("class_ar_l3_a");
    expect(previousProfile?.assignedClassIds).toEqual(
      expect.arrayContaining([
        "class_ar_l3_cairo",
        "class_qt_1_b",
        "class_ar_l3_assign_qa",
      ])
    );
    expect(staffProfile).toMatchObject({
      userId: "usr_teacher_new",
      role: "teacher",
      branchIds: expect.arrayContaining(["br_online"]),
      departmentIds: expect.arrayContaining(["dep_arabic"]),
      subjects: expect.arrayContaining(["Arabic grammar"]),
      teachingLevels: expect.arrayContaining(["Arabic Level 3"]),
      permissionScope: "department",
      status: "active",
    });
    expect(runEnrollments.length).toBeGreaterThan(0);
    expect(
      runEnrollments.every(item => item.teacherId === "usr_teacher_new")
    ).toBe(true);
    expect(
      after.teacherAvailability.filter(
        item => item.teacherId === "usr_teacher_new"
      )
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          weekday: "Monday",
          startsAt: "09:00",
          endsAt: "10:30",
          branchId: "br_online",
        }),
        expect.objectContaining({
          weekday: "Wednesday",
          startsAt: "09:00",
          endsAt: "10:30",
          branchId: "br_online",
        }),
      ])
    );
    expect(audit).toMatchObject({
      actorId: "usr_admin_demo",
      entityType: "CourseRun",
      entityId: "run_ar_l3_2026",
    });
    expect(audit?.summary).toContain("reassigned from Teacher Demo");
  });

  it("rejects teacher assignment when department, branch, or status is invalid", () => {
    const initial = platformStore.getState();
    platformStore.setState({
      ...initial,
      users: [
        {
          id: "usr_teacher_invalid_scope",
          name: "Invalid Scope Teacher",
          email: "invalid.scope.teacher@nilelearn.local",
          roles: ["teacher"],
          activeRole: "teacher",
          branchId: "br_online",
          departmentId: "dep_arabic",
          status: "active",
        },
        ...initial.users,
      ],
    });

    expect(() =>
      platformStore.assignTeacherToCourseRun(
        "usr_teacher_invalid_scope",
        "run_ar_l3_2026",
        {
          departmentId: "dep_operations",
          specialties: ["Arabic grammar"],
        }
      )
    ).toThrow("not available in the selected course branch");

    expect(() =>
      platformStore.assignTeacherToCourseRun(
        "usr_teacher_invalid_scope",
        "run_ar_l3_2026",
        {
          departmentId: "dep_admissions",
          specialties: ["Arabic grammar"],
        }
      )
    ).toThrow("must own the selected course run");

    expect(() =>
      platformStore.assignTeacherToCourseRun(
        "usr_teacher_invalid_scope",
        "run_ar_l3_2026",
        {
          departmentId: "dep_arabic",
          status: "issued" as never,
        }
      )
    ).toThrow("valid account status");
  });

  it("rejects teacher assignment for unknown users, non-teachers, cross-branch teachers, inactive runs, and invalid availability", () => {
    const initial = platformStore.getState();
    platformStore.setState({
      ...initial,
      users: [
        {
          id: "usr_not_teacher_assign",
          name: "Registrar Not Teacher",
          email: "registrar.not.teacher@nilelearn.local",
          roles: ["registrar"],
          activeRole: "registrar",
          branchId: "br_online",
          departmentId: "dep_admissions",
          status: "active",
        },
        {
          id: "usr_teacher_wrong_branch",
          name: "Wrong Branch Teacher",
          email: "wrong.branch.teacher@nilelearn.local",
          roles: ["teacher"],
          activeRole: "teacher",
          branchId: "br_cairo",
          departmentId: "dep_arabic",
          status: "active",
        },
        {
          id: "usr_teacher_inactive_run",
          name: "Inactive Run Teacher",
          email: "inactive.run.teacher@nilelearn.local",
          roles: ["teacher"],
          activeRole: "teacher",
          branchId: "br_online",
          departmentId: "dep_arabic",
          status: "active",
        },
        ...initial.users,
      ],
      courseRuns: [
        ...initial.courseRuns,
        {
          ...initial.courseRuns[0],
          id: "run_ar_l3_cancelled_test",
          teacherId: "usr_teacher_demo",
          status: "cancelled",
        },
      ],
    });

    expect(() =>
      platformStore.applyAction({
        type: "teacher.assign",
        userId: "usr_missing_teacher",
        courseRunId: "run_ar_l3_2026",
        name: "Hidden Teacher" as never,
        email: "hidden.teacher@nilelearn.local" as never,
        departmentId: "dep_arabic",
      })
    ).toThrow("Teacher user usr_missing_teacher was not found");

    expect(() =>
      platformStore.assignTeacherToCourseRun(
        "usr_not_teacher_assign",
        "run_ar_l3_2026",
        {
          departmentId: "dep_arabic",
        }
      )
    ).toThrow("does not have teacher access");

    expect(() =>
      platformStore.assignTeacherToCourseRun(
        "usr_teacher_wrong_branch",
        "run_ar_l3_2026",
        {
          departmentId: "dep_arabic",
        }
      )
    ).toThrow("branch must match");

    expect(() =>
      platformStore.assignTeacherToCourseRun(
        "usr_teacher_inactive_run",
        "run_ar_l3_cancelled_test",
        {
          departmentId: "dep_arabic",
        }
      )
    ).toThrow("active or pending course run");

    expect(() =>
      platformStore.assignTeacherToCourseRun(
        "usr_teacher_inactive_run",
        "run_ar_l3_2026",
        {
          departmentId: "dep_arabic",
          availability: ["not a slot"],
        }
      )
    ).toThrow("Use availability");
  });

  it("records orphaned previous teacher id when reassignment history is missing a user row", () => {
    const initial = platformStore.getState();
    platformStore.setState({
      ...initial,
      users: [
        {
          id: "usr_teacher_orphan_reassign",
          name: "Orphan Reassign Teacher",
          email: "orphan.reassign.teacher@nilelearn.local",
          roles: ["teacher"],
          activeRole: "teacher",
          branchId: "br_online",
          departmentId: "dep_arabic",
          status: "active",
        },
        ...initial.users.filter(
          item => item.id !== "usr_orphan_previous_teacher"
        ),
      ],
      courseRuns: initial.courseRuns.map(run =>
        run.id === "run_ar_l3_2026"
          ? { ...run, teacherId: "usr_orphan_previous_teacher" }
          : run
      ),
    });

    const assignment = platformStore.assignTeacherToCourseRun(
      "usr_teacher_orphan_reassign",
      "run_ar_l3_2026",
      {
        departmentId: "dep_arabic",
        availability: ["Fri 09:00"],
      }
    );
    const audit = platformStore
      .getState()
      .auditLogs.find(item => item.action === "teacher.assigned");

    expect(assignment.previousTeacher).toBeUndefined();
    expect(assignment.previousTeacherId).toBe("usr_orphan_previous_teacher");
    expect(audit?.summary).toContain(
      "reassigned from usr_orphan_previous_teacher"
    );
  });

  it("keeps teacher assignment idempotent and preserves course-run scoped tools", () => {
    const initial = platformStore.getState();
    platformStore.setState({
      ...initial,
      users: [
        {
          id: "usr_teacher_repeat",
          name: "Repeat Teacher",
          email: "repeat.teacher@nilelearn.local",
          roles: ["teacher"],
          activeRole: "teacher",
          branchId: "br_online",
          departmentId: "dep_arabic",
          status: "active",
        },
        ...initial.users,
      ],
      teachers: initial.teachers.filter(
        item => item.userId !== "usr_teacher_repeat"
      ),
      teacherAvailability: initial.teacherAvailability.filter(
        item => item.teacherId !== "usr_teacher_repeat"
      ),
    });

    platformStore.assignTeacherToCourseRun(
      "usr_teacher_repeat",
      "run_ar_l3_2026",
      {
        departmentId: "dep_arabic",
        specialties: ["Arabic grammar"],
        teachingLevels: ["Arabic Level 3"],
        availability: ["Mon 09:00", "Mon 09:00"],
      }
    );
    platformStore.assignTeacherToCourseRun(
      "usr_teacher_repeat",
      "run_ar_l3_2026",
      {
        departmentId: "dep_arabic",
        specialties: ["Arabic grammar"],
        teachingLevels: ["Arabic Level 3"],
        availability: ["Mon 09:00"],
      }
    );

    const after = platformStore.getState();
    const teacherRuns = after.courseRuns.filter(
      run => run.teacherId === "usr_teacher_repeat"
    );
    const teacherRunIds = new Set(teacherRuns.map(run => run.id));
    const teacherClasses = after.classGroups.filter(group =>
      teacherRunIds.has(group.courseRunId)
    );
    const teacherSessions = after.classSessions.filter(session =>
      teacherClasses.some(group => group.id === session.classGroupId)
    );
    const teacherAssignments = after.assignments.filter(assignment =>
      teacherRunIds.has(assignment.courseRunId)
    );
    const teacherQuizzes = after.quizzes.filter(quiz =>
      teacherRunIds.has(quiz.courseRunId)
    );
    const profileRows = after.teachers.filter(
      item => item.userId === "usr_teacher_repeat"
    );
    const slots = after.teacherAvailability.filter(
      item => item.teacherId === "usr_teacher_repeat"
    );

    expect(profileRows).toHaveLength(1);
    expect(profileRows[0].assignedClassIds).toEqual(
      expect.arrayContaining(["class_ar_l3_a"])
    );
    expect(slots).toHaveLength(1);
    expect(teacherClasses.map(item => item.id)).toContain("class_ar_l3_a");
    expect(teacherSessions.map(item => item.id)).toContain("session_ar_live");
    expect(teacherAssignments.map(item => item.id)).toContain("asg_ar_grammar");
    expect(teacherQuizzes.map(item => item.id)).toContain("quiz_ar_3");
  });

  it("creates curriculum modules through the workflow action with audit evidence", () => {
    const state = platformStore.getState();
    const beforeCount = state.modules.filter(
      item => item.courseId === "course_ar_l3"
    ).length;
    const result = applyPlatformWorkflowAction(state, {
      type: "curriculum.module.create",
      courseId: "course_ar_l3",
      title: "QA Curriculum Action",
      outcomes: ["Map lesson outcome", "Review source"],
      actorId: "usr_hod_demo",
    });

    expect(result.action).toBe("curriculum.module_created");
    expect(result.entityType).toBe("Module");
    expect(state.modules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          courseId: "course_ar_l3",
          title: "QA Curriculum Action",
          order: beforeCount + 1,
          outcomes: ["Map lesson outcome", "Review source"],
        }),
      ])
    );
    expect(state.auditLogs[0]).toMatchObject({
      actorId: "usr_hod_demo",
      action: "curriculum.module_created",
      entityType: "Module",
    });
  });

  it("updates course status through the workflow action with audit evidence", () => {
    const state = platformStore.getState();
    const result = applyPlatformWorkflowAction(state, {
      type: "course.status.update",
      courseId: "course_ar_l3",
      status: "paused",
      actorId: "usr_hod_demo",
    });

    expect(result.action).toBe("course.status_updated");
    expect(result.entityType).toBe("Course");
    expect(result.entityId).toBe("course_ar_l3");
    expect(state.courses.find(item => item.id === "course_ar_l3")?.status).toBe(
      "paused"
    );
    expect(state.auditLogs[0]).toMatchObject({
      actorId: "usr_hod_demo",
      action: "course.status_updated",
      entityType: "Course",
      entityId: "course_ar_l3",
    });
  });

  it("updates material publish state through the workflow action with audit evidence", () => {
    const state = platformStore.getState();
    const result = applyPlatformWorkflowAction(state, {
      type: "material.publish.update",
      id: "res_ar_pdf",
      published: false,
      actorId: "usr_teacher_demo",
    });

    expect(result.action).toBe("material.unpublished");
    expect(result.entityType).toBe("LessonResource");
    expect(result.entityId).toBe("res_ar_pdf");
    expect(
      state.resources.find(item => item.id === "res_ar_pdf")?.published
    ).toBe(false);
    expect(state.auditLogs[0]).toMatchObject({
      actorId: "usr_teacher_demo",
      action: "material.unpublished",
      entityType: "LessonResource",
      entityId: "res_ar_pdf",
    });
  });

  it("updates safe student profile and preference fields with audit evidence", () => {
    const state = platformStore.getState();
    const beforeUser = state.users.find(item => item.id === "usr_student_demo");

    const result = applyPlatformWorkflowAction(state, {
      type: "profile.update",
      userId: "usr_student_demo",
      name: "Student Profile QA",
      phone: "+20 100 000 7777",
      preferredLanguage: "Arabic",
      timezone: "Africa/Cairo",
      country: "Egypt",
      guardianName: "Guardian QA",
      guardianPhone: "+20 100 000 8888",
      notificationPreferences: {
        messages: false,
        schedule: true,
      },
      actorId: "usr_student_demo",
    });

    const user = state.users.find(item => item.id === "usr_student_demo");
    const student = state.students.find(
      item => item.userId === "usr_student_demo"
    );

    expect(result.action).toBe("profile.updated");
    expect(user).toMatchObject({
      name: "Student Profile QA",
      phone: "+20 100 000 7777",
      preferredLanguage: "Arabic",
      timezone: "Africa/Cairo",
      activeRole: beforeUser?.activeRole,
      branchId: beforeUser?.branchId,
      departmentId: beforeUser?.departmentId,
    });
    expect(user?.notificationPreferences).toMatchObject({
      messages: false,
      schedule: true,
      academic: true,
    });
    expect(student).toMatchObject({
      country: "Egypt",
      preferredLanguage: "Arabic",
      guardianName: "Guardian QA",
      guardianPhone: "+20 100 000 8888",
    });
    expect(state.auditLogs.map(item => item.action)).toEqual(
      expect.arrayContaining(["profile.updated", "preferences.updated"])
    );
  });

  it("updates teacher title and availability without changing role scope", () => {
    const state = platformStore.getState();
    const beforeUser = state.users.find(item => item.id === "usr_teacher_demo");
    const beforeStaffProfile = state.staffProfiles.find(
      item => item.userId === "usr_teacher_demo" && item.role === "teacher"
    );

    applyPlatformWorkflowAction(state, {
      type: "profile.update",
      userId: "usr_teacher_demo",
      name: "Teacher Profile QA",
      title: "Senior Arabic Teacher",
      availabilityStatus: "limited",
      actorId: "usr_teacher_demo",
    });

    const user = state.users.find(item => item.id === "usr_teacher_demo");
    const staffProfile = state.staffProfiles.find(
      item => item.userId === "usr_teacher_demo" && item.role === "teacher"
    );
    const teacherProfile = state.teachers.find(
      item => item.userId === "usr_teacher_demo"
    );

    expect(user).toMatchObject({
      name: "Teacher Profile QA",
      activeRole: beforeUser?.activeRole,
      branchId: beforeUser?.branchId,
      departmentId: beforeUser?.departmentId,
    });
    expect(staffProfile).toMatchObject({
      title: "Senior Arabic Teacher",
      availabilityStatus: "limited",
      branchIds: beforeStaffProfile?.branchIds,
      departmentIds: beforeStaffProfile?.departmentIds,
    });
    expect(teacherProfile).toMatchObject({ availabilityStatus: "limited" });
    expect(state.auditLogs[0]).toMatchObject({
      action: "profile.updated",
      actorId: "usr_teacher_demo",
    });
  });

  it("ignores protected role and scope fields in self profile updates", () => {
    const state = platformStore.getState();

    applyPlatformWorkflowAction(state, {
      type: "profile.update",
      userId: "usr_teacher_demo",
      name: "Teacher Safe Edit",
      activeRole: "superadmin",
      roles: ["superadmin"],
      branchId: "br_global",
      departmentId: "dep_admin",
    } as any);

    const user = state.users.find(item => item.id === "usr_teacher_demo");

    expect(user).toMatchObject({
      name: "Teacher Safe Edit",
      activeRole: "teacher",
      roles: ["teacher"],
      branchId: "br_online",
      departmentId: "dep_arabic",
    });
  });

  it("rejects incomplete minor guardian updates without partial profile mutation", () => {
    const state = platformStore.getState();
    state.students = state.students.map(item =>
      item.id === "stu_demo"
        ? {
            ...item,
            ageGroup: "Under 18",
            guardianName: "Current Guardian",
            guardianPhone: "+20 100 000 1111",
          }
        : item
    );

    expect(() =>
      applyPlatformWorkflowAction(state, {
        type: "profile.update",
        userId: "usr_student_demo",
        name: "Should Not Persist",
        guardianName: "",
        guardianPhone: "",
      })
    ).toThrow("Guardian name and phone are required for minor students.");

    expect(state.users.find(item => item.id === "usr_student_demo")?.name).toBe(
      "Student Demo"
    );
    expect(state.students.find(item => item.id === "stu_demo")).toMatchObject({
      guardianName: "Current Guardian",
      guardianPhone: "+20 100 000 1111",
    });
  });
});
