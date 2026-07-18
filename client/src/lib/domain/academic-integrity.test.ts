import { describe, expect, it } from "vitest";
import {
  applyCompleteLesson,
  applyPlatformWorkflowAction,
  applyStartLesson,
  applySubmitAssignment,
  applySubmitQuizAttempt,
} from "./actions";
import { seedPlatformState } from "./seed";
import type { PlatformState } from "./types";

function cloneState() {
  return JSON.parse(JSON.stringify(seedPlatformState)) as PlatformState;
}

function createContext() {
  let sequence = 0;
  return {
    createId: (prefix: string) => `${prefix}_academic_${++sequence}`,
    now: () => "2026-07-10T12:00:00.000Z",
  };
}

function enrollment(state: PlatformState, enrollmentId: string) {
  return state.enrollments.find(item => item.id === enrollmentId);
}

describe("academic relationship integrity", () => {
  it("requires an active student before any learning mutation", () => {
    const mutations: Array<{
      label: string;
      run: (state: PlatformState) => unknown;
    }> = [
      {
        label: "lesson start",
        run: state =>
          applyStartLesson(state, {
            lessonId: "lesson_ar_conditional",
            studentId: "stu_demo",
          }),
      },
      {
        label: "lesson completion",
        run: state =>
          applyCompleteLesson(state, {
            lessonId: "lesson_ar_conditional",
            studentId: "stu_demo",
          }),
      },
      {
        label: "assignment submission",
        run: state =>
          applySubmitAssignment(state, {
            assignmentId: "asg_ar_grammar",
            response: "Completed response",
            studentId: "stu_demo",
          }),
      },
      {
        label: "quiz submission",
        run: state =>
          applySubmitQuizAttempt(state, {
            quizId: "quiz_ar_3",
            answers: {
              qbi_ar_conditional_mcq: "إذا",
              qbi_ar_market_short: "I visited the market. I bought dates.",
            },
            studentId: "stu_demo",
          }),
      },
    ];

    for (const mutation of mutations) {
      const state = cloneState();
      const student = state.students.find(item => item.id === "stu_demo")!;
      student.status = "paused";
      const before = JSON.stringify(state);

      expect(() => mutation.run(state), mutation.label).toThrow(
        "Student stu_demo must be active"
      );
      expect(JSON.stringify(state), mutation.label).toBe(before);
    }

    const inactiveAccountState = cloneState();
    inactiveAccountState.users.find(
      item => item.id === "usr_student_demo"
    )!.status = "paused";
    const before = JSON.stringify(inactiveAccountState);
    expect(() =>
      applyStartLesson(inactiveAccountState, {
        lessonId: "lesson_ar_conditional",
        studentId: "stu_demo",
      })
    ).toThrow("Student stu_demo must be active");
    expect(JSON.stringify(inactiveAccountState)).toBe(before);
  });

  it("requires an active enrollment in the assessment's exact active course run", () => {
    const assignmentState = cloneState();
    assignmentState.assignments.push({
      id: "asg_ar_other_run",
      courseRunId: "run_ar_l3_assign_qa",
      title: "Other run assignment",
      dueAt: "2026-07-20T12:00:00.000Z",
      submissionType: "text",
      rubric: ["Accuracy"],
      status: "active",
    });
    expect(() =>
      applySubmitAssignment(assignmentState, {
        assignmentId: "asg_ar_other_run",
        response: "A class roster alone is not an enrollment.",
        studentId: "stu_demo",
      })
    ).toThrow("active enrollment in course run run_ar_l3_assign_qa");

    const quizState = cloneState();
    quizState.quizzes.push({
      id: "quiz_ar_other_run",
      courseRunId: "run_ar_l3_assign_qa",
      title: "Other run quiz",
      dueAt: "2026-07-20T12:00:00.000Z",
      durationMinutes: 10,
      questionTypes: ["short_answer"],
      questionIds: [],
      attemptsAllowed: 1,
      status: "active",
    });
    expect(() =>
      applySubmitQuizAttempt(quizState, {
        quizId: "quiz_ar_other_run",
        answers: { response: "Not enrolled in this run" },
        studentId: "stu_demo",
      })
    ).toThrow("active enrollment in course run run_ar_l3_assign_qa");

    const inactiveEnrollmentState = cloneState();
    enrollment(inactiveEnrollmentState, "enr_ar_l3")!.status = "paused";
    expect(() =>
      applySubmitAssignment(inactiveEnrollmentState, {
        assignmentId: "asg_ar_grammar",
        response: "Inactive enrollment",
        studentId: "stu_demo",
      })
    ).toThrow("active enrollment in course run run_ar_l3_2026");

    const inactiveRunState = cloneState();
    inactiveRunState.courseRuns.find(
      item => item.id === "run_ar_l3_2026"
    )!.status = "paused";
    expect(() =>
      applyCompleteLesson(inactiveRunState, {
        lessonId: "lesson_ar_conditional",
        studentId: "stu_demo",
      })
    ).toThrow("active enrollment in an active course run");
  });

  it("rejects submissions to inactive assignments and quizzes before mutation", () => {
    const assignmentState = cloneState();
    assignmentState.assignments.find(
      item => item.id === "asg_ar_grammar"
    )!.status = "paused";
    const assignmentSubmissions = assignmentState.assignmentSubmissions.length;
    expect(() =>
      applySubmitAssignment(assignmentState, {
        assignmentId: "asg_ar_grammar",
        response: "Should not submit",
        studentId: "stu_demo",
      })
    ).toThrow("Assignment asg_ar_grammar must be active");
    expect(assignmentState.assignmentSubmissions).toHaveLength(
      assignmentSubmissions
    );

    const quizState = cloneState();
    quizState.quizzes.find(item => item.id === "quiz_qt_madd")!.status =
      "completed";
    const quizAttempts = quizState.quizAttempts.length;
    expect(() =>
      applySubmitQuizAttempt(quizState, {
        quizId: "quiz_qt_madd",
        answers: { qbi_qt_madd_oral: "Should not submit" },
        studentId: "stu_demo",
      })
    ).toThrow("Quiz quiz_qt_madd must be active");
    expect(quizState.quizAttempts).toHaveLength(quizAttempts);
  });

  it("derives lesson progress for the selected enrollment without crossing repeated runs", () => {
    const state = cloneState();
    const primaryEnrollment = enrollment(state, "enr_ar_l3")!;
    state.enrollments.push({
      ...primaryEnrollment,
      id: "enr_ar_l3_second_run",
      courseRunId: "run_ar_l3_assign_qa",
      classGroupId: "class_ar_l3_assign_qa",
      progress: 99,
    });
    const courseLessonIds = new Set(
      state.modules
        .filter(item => item.courseId === "course_ar_l3")
        .flatMap(module =>
          state.lessons
            .filter(lesson => lesson.moduleId === module.id)
            .map(lesson => lesson.id)
        )
    );
    state.lessonProgress.push(
      ...Array.from(courseLessonIds).map((lessonId, index) => ({
        id: `lp_second_run_${index}`,
        studentId: "stu_demo",
        enrollmentId: "enr_ar_l3_second_run",
        lessonId,
        status: "not_started" as const,
      }))
    );
    const unrelatedProgress = enrollment(state, "enr_qt_1")!.progress;

    expect(() =>
      applyCompleteLesson(state, {
        lessonId: "lesson_ar_conditional",
        studentId: "stu_demo",
      })
    ).toThrow("Enrollment selection is required");

    applyCompleteLesson(
      state,
      {
        lessonId: "lesson_ar_conditional",
        enrollmentId: "enr_ar_l3",
        studentId: "stu_demo",
      },
      createContext()
    );

    expect(enrollment(state, "enr_ar_l3")?.progress).toBe(40);
    expect(enrollment(state, "enr_ar_l3_second_run")?.progress).toBe(99);
    expect(enrollment(state, "enr_qt_1")?.progress).toBe(unrelatedProgress);

    applyCompleteLesson(
      state,
      {
        lessonId: "lesson_ar_conditional",
        enrollmentId: "enr_ar_l3_second_run",
        studentId: "stu_demo",
      },
      createContext()
    );
    expect(enrollment(state, "enr_ar_l3")?.progress).toBe(40);
    expect(enrollment(state, "enr_ar_l3_second_run")?.progress).toBe(20);
  });

  it("recomputes exact-run enrollment grades after teacher assignment grading", () => {
    const state = cloneState();
    const primaryEnrollment = enrollment(state, "enr_ar_l3")!;
    state.enrollments.push({
      ...primaryEnrollment,
      id: "enr_ar_l3_duplicate",
      currentGrade: 1,
    });
    const unrelatedGrade = enrollment(state, "enr_qt_1")!.currentGrade;

    applyPlatformWorkflowAction(
      state,
      {
        type: "assignment.grade",
        submissionId: "sub_ar_grammar_draft",
        score: 92,
        feedback: "Exact run grade",
        actorId: "usr_teacher_demo",
      },
      createContext()
    );

    expect(enrollment(state, "enr_ar_l3")?.currentGrade).toBe(90);
    expect(enrollment(state, "enr_ar_l3_duplicate")?.currentGrade).toBe(90);
    expect(enrollment(state, "enr_qt_1")?.currentGrade).toBe(unrelatedGrade);
  });

  it("recomputes exact-run enrollment grades after an HOD-authorized quiz review", () => {
    const state = cloneState();
    state.quizAttempts.push({
      id: "attempt_qt_review",
      quizId: "quiz_qt_madd",
      studentId: "stu_demo",
      startedAt: "2026-07-10T11:00:00.000Z",
      submittedAt: "2026-07-10T11:05:00.000Z",
      status: "pending",
      score: 0,
      maxScore: 100,
      answers: { qbi_qt_madd_oral: "Pending review" },
    });
    state.grades.push({
      id: "grade_qt_prior",
      studentId: "stu_demo",
      courseRunId: "run_qt_1_2026",
      itemTitle: "Prior Tajweed check",
      score: 80,
      maxScore: 100,
      feedback: "Prior grade",
    });
    const unrelatedGrade = enrollment(state, "enr_ar_l3")!.currentGrade;

    applyPlatformWorkflowAction(
      state,
      {
        type: "quiz.review",
        attemptId: "attempt_qt_review",
        score: 100,
        feedback: "Reviewed by the authorized HOD path",
        actorId: "usr_hod_demo",
      },
      createContext()
    );

    expect(enrollment(state, "enr_qt_1")?.currentGrade).toBe(90);
    expect(enrollment(state, "enr_ar_l3")?.currentGrade).toBe(unrelatedGrade);
  });

  it("recomputes exact-run enrollment grades after an auto-graded quiz write", () => {
    const state = cloneState();
    state.questionBankItems.push({
      id: "qbi_ar_auto",
      courseRunId: "run_ar_l3_2026",
      prompt: "Choose the correct answer.",
      type: "multiple_choice",
      difficulty: "foundation",
      tags: ["integrity"],
      choices: ["correct", "incorrect"],
      answerKey: "correct",
      rubric: ["Accuracy"],
      createdBy: "usr_teacher_demo",
      updatedAt: "2026-07-10T11:00:00.000Z",
      status: "active",
    });
    state.quizzes.push({
      id: "quiz_ar_auto",
      courseRunId: "run_ar_l3_2026",
      title: "Auto-grade integrity check",
      dueAt: "2026-07-20T12:00:00.000Z",
      durationMinutes: 10,
      questionTypes: ["multiple_choice"],
      questionIds: ["qbi_ar_auto"],
      attemptsAllowed: 2,
      status: "active",
    });
    const unrelatedGrade = enrollment(state, "enr_qt_1")!.currentGrade;

    applySubmitQuizAttempt(
      state,
      {
        quizId: "quiz_ar_auto",
        answers: { qbi_ar_auto: "correct" },
        studentId: "stu_demo",
      },
      createContext()
    );

    expect(enrollment(state, "enr_ar_l3")?.currentGrade).toBe(94);
    expect(enrollment(state, "enr_qt_1")?.currentGrade).toBe(unrelatedGrade);

    applySubmitQuizAttempt(
      state,
      {
        quizId: "quiz_ar_auto",
        answers: { qbi_ar_auto: "incorrect" },
        studentId: "stu_demo",
      },
      createContext()
    );

    const quizGrades = state.grades.filter(
      item =>
        item.studentId === "stu_demo" &&
        item.courseRunId === "run_ar_l3_2026" &&
        item.itemId === "quiz_ar_auto"
    );
    expect(quizGrades).toHaveLength(1);
    expect(quizGrades[0].score).toBe(0);
  });

  it.each([
    {
      label: "unknown run",
      courseRunId: "run_missing",
      classGroupId: "class_ar_l3_a",
      message: "Course run run_missing was not found",
    },
    {
      label: "run for another course",
      courseRunId: "run_qt_1_2026",
      classGroupId: "class_qt_1_b",
      message: "does not match this enrollment workflow",
    },
    {
      label: "unknown class",
      courseRunId: "run_ar_l3_2026",
      classGroupId: "class_missing",
      message: "Class group class_missing was not found",
    },
    {
      label: "class from another run",
      courseRunId: "run_ar_l3_2026",
      classGroupId: "class_ar_l3_cairo",
      message: "does not belong to course run run_ar_l3_2026",
    },
  ])(
    "rejects an explicitly requested $label instead of falling back",
    ({ courseRunId, classGroupId, message }) => {
      const state = cloneState();
      const before = JSON.stringify(state);

      expect(() =>
        applyPlatformWorkflowAction(
          state,
          {
            type: "enrollment.activate",
            workflowId: "ew_demo_1",
            courseRunId,
            classGroupId,
            actorId: "usr_registrar_demo",
          },
          createContext()
        )
      ).toThrow(message);
      expect(JSON.stringify(state)).toBe(before);
    }
  );

  it("rejects inactive runs and full classes without falling back", () => {
    const inactiveRunState = cloneState();
    inactiveRunState.courseRuns.find(
      item => item.id === "run_ar_l3_2026"
    )!.status = "paused";
    const inactiveRunBefore = JSON.stringify(inactiveRunState);
    expect(() =>
      applyPlatformWorkflowAction(
        inactiveRunState,
        {
          type: "enrollment.activate",
          workflowId: "ew_demo_1",
          courseRunId: "run_ar_l3_2026",
          classGroupId: "class_ar_l3_a",
        },
        createContext()
      )
    ).toThrow("Course run run_ar_l3_2026 must be active");
    expect(JSON.stringify(inactiveRunState)).toBe(inactiveRunBefore);

    const fullClassState = cloneState();
    const fullClass = fullClassState.classGroups.find(
      item => item.id === "class_ar_l3_a"
    )!;
    fullClass.capacity = fullClass.studentIds.length;
    const fullClassBefore = JSON.stringify(fullClassState);
    expect(() =>
      applyPlatformWorkflowAction(
        fullClassState,
        {
          type: "enrollment.activate",
          workflowId: "ew_demo_1",
          courseRunId: "run_ar_l3_2026",
          classGroupId: "class_ar_l3_a",
        },
        createContext()
      )
    ).toThrow("Class group class_ar_l3_a is full");
    expect(JSON.stringify(fullClassState)).toBe(fullClassBefore);
  });

  it("rejects learning and activation when the parent course is inactive", () => {
    const learningState = cloneState();
    learningState.courses.find(item => item.id === "course_ar_l3")!.status =
      "paused";
    expect(() =>
      applySubmitAssignment(learningState, {
        assignmentId: "asg_ar_grammar",
        response: "Paused parent course",
        studentId: "stu_demo",
      })
    ).toThrow("Course course_ar_l3 must be active");

    const activationState = cloneState();
    activationState.courses.find(item => item.id === "course_ar_l3")!.status =
      "paused";
    expect(() =>
      applyPlatformWorkflowAction(
        activationState,
        {
          type: "enrollment.activate",
          workflowId: "ew_demo_1",
          courseRunId: "run_ar_l3_2026",
          classGroupId: "class_ar_l3_a",
        },
        createContext()
      )
    ).toThrow("Course course_ar_l3 must be active before enrollment activation");
  });

  it("rejects unknown and partially activated enrollment workflows", () => {
    const unknownState = cloneState();
    expect(() =>
      applyPlatformWorkflowAction(
        unknownState,
        { type: "enrollment.activate", workflowId: "ew_missing" },
        createContext()
      )
    ).toThrow("Enrollment workflow ew_missing was not found");

    const partialState = cloneState();
    const workflow = partialState.enrollmentWorkflows.find(
      item => item.id === "ew_demo_1"
    )!;
    workflow.studentId = "stu_demo";
    workflow.courseRunId = "run_ar_l3_assign_qa";
    workflow.classGroupId = "class_ar_l3_assign_qa";
    workflow.status = "active";
    expect(() =>
      applyPlatformWorkflowAction(
        partialState,
        { type: "enrollment.activate", workflowId: workflow.id },
        createContext()
      )
    ).toThrow("is incomplete: enrollment is missing");
  });

  it("does not use targets stored on an unactivated workflow as write inputs", () => {
    const state = cloneState();
    const workflow = state.enrollmentWorkflows.find(
      item => item.id === "ew_demo_1"
    )!;
    workflow.courseRunId = "run_ar_l3_2026";
    workflow.classGroupId = "class_ar_l3_a";
    const before = JSON.stringify(state);

    expect(() =>
      applyPlatformWorkflowAction(
        state,
        { type: "enrollment.activate", workflowId: workflow.id },
        createContext()
      )
    ).toThrow(
      "Enrollment activation requires an exact course run and class group."
    );
    expect(JSON.stringify(state)).toBe(before);
  });

  it("protects the global Super Admin settings authority", () => {
    const state = cloneState();
    expect(() =>
      applyPlatformWorkflowAction(
        state,
        {
          type: "permission.update",
          role: "superadmin",
          permission: "settings:write",
          granted: false,
          actorId: "usr_admin_demo",
        },
        createContext()
      )
    ).toThrow("Super Admin settings authority cannot be removed");
    expect(state.permissions.superadmin).toContain("settings:write");
  });

  it("keeps an activated workflow idempotent after it fills the final class seat", () => {
    const state = cloneState();
    const classGroup = state.classGroups.find(
      item => item.id === "class_ar_l3_a"
    )!;
    classGroup.capacity = classGroup.studentIds.length + 1;
    const context = createContext();
    const action = {
      type: "enrollment.activate" as const,
      workflowId: "ew_demo_1",
      courseRunId: "run_ar_l3_2026",
      classGroupId: "class_ar_l3_a",
      actorId: "usr_registrar_demo",
    };

    const first = applyPlatformWorkflowAction(state, action, context)
      .result as PlatformState["students"][number];
    const classAfterFirst = state.classGroups.find(
      item => item.id === "class_ar_l3_a"
    )!;
    const countsAfterFirst = {
      users: state.users.length,
      students: state.students.length,
      enrollments: state.enrollments.length,
      invoices: state.invoices.length,
      auditLogs: state.auditLogs.length,
      classMembers: classAfterFirst.studentIds.length,
    };
    expect(classAfterFirst.studentIds).toHaveLength(classAfterFirst.capacity);

    const second = applyPlatformWorkflowAction(state, action, context)
      .result as PlatformState["students"][number];
    const classAfterSecond = state.classGroups.find(
      item => item.id === "class_ar_l3_a"
    )!;

    expect(second.id).toBe(first.id);
    expect({
      users: state.users.length,
      students: state.students.length,
      enrollments: state.enrollments.length,
      invoices: state.invoices.length,
      auditLogs: state.auditLogs.length,
      classMembers: classAfterSecond.studentIds.length,
    }).toEqual(countsAfterFirst);
    expect(
      classAfterSecond.studentIds.filter(studentId => studentId === first.id)
    ).toHaveLength(1);
    expect(() =>
      applyPlatformWorkflowAction(
        state,
        { ...action, courseRunId: "run_missing" },
        context
      )
    ).toThrow("Course run run_missing was not found");
  });
});
