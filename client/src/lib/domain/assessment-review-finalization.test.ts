import { describe, expect, it } from "vitest";
import {
  applyPlatformWorkflowAction,
  type PlatformWorkflowAction,
} from "./actions";
import { seedPlatformState } from "./seed";
import type { PlatformState } from "./types";

function cloneState() {
  return JSON.parse(JSON.stringify(seedPlatformState)) as PlatformState;
}

function createContext() {
  let sequence = 0;
  return {
    createId: (prefix: string) => `${prefix}_assessment_review_${++sequence}`,
    now: () => "2026-07-11T12:00:00.000Z",
  };
}

function apply(
  state: PlatformState,
  action: PlatformWorkflowAction,
  context: ReturnType<typeof createContext>
) {
  return applyPlatformWorkflowAction(state, action, context);
}

function expectDeniedWithoutMutation(
  state: PlatformState,
  action: PlatformWorkflowAction,
  context: ReturnType<typeof createContext>,
  message: string
) {
  const before = JSON.stringify(state);
  expect(() => apply(state, action, context)).toThrow(message);
  expect(JSON.stringify(state)).toBe(before);
}

describe("assessment review finalization", () => {
  it("finalizes a pending assignment submission once with grade, notification, and audit evidence", () => {
    const state = cloneState();
    const context = createContext();

    const result = apply(
      state,
      {
        type: "assignment.grade",
        submissionId: "sub_ar_grammar_draft",
        score: 92,
        feedback: "Clear structure and accurate grammar.",
        actorId: "usr_teacher_demo",
      },
      context
    );

    expect(result.result).toMatchObject({
      id: "sub_ar_grammar_draft",
      status: "completed",
      score: 92,
      feedback: "Clear structure and accurate grammar.",
    });
    expect(state.grades).toContainEqual(
      expect.objectContaining({
        studentId: "stu_demo",
        itemId: "asg_ar_grammar",
        score: 92,
      })
    );
    expect(state.notifications).toContainEqual(
      expect.objectContaining({
        userId: "usr_student_demo",
        title: "Assignment graded",
      })
    );
    expect(state.auditLogs).toContainEqual(
      expect.objectContaining({
        action: "assignment.graded",
        entityId: "sub_ar_grammar_draft",
      })
    );

    expectDeniedWithoutMutation(
      state,
      {
        type: "assignment.grade",
        submissionId: "sub_ar_grammar_draft",
        score: 75,
        feedback: "A second review must not overwrite the first.",
        actorId: "usr_teacher_demo",
      },
      context,
      "Only a pending assignment submission can be graded."
    );
  });

  it("alerts the assigned teacher about a pending quiz and finalizes that attempt once", () => {
    const state = cloneState();
    const context = createContext();
    const submitted = apply(
      state,
      {
        type: "quiz.submit",
        quizId: "quiz_qt_madd",
        answers: { qbi_qt_madd_oral: "Madd Munfasil recording attached." },
        actorId: "usr_student_demo",
      },
      context
    );
    const attempt = submitted.result as PlatformState["quizAttempts"][number];

    expect(attempt.status).toBe("pending");
    expect(state.notifications).toContainEqual(
      expect.objectContaining({
        userId: "usr_teacher_demo",
        title: "Quiz submitted",
        href: "/app/teacher/quizzes/review",
      })
    );

    apply(
      state,
      {
        type: "quiz.review",
        attemptId: attempt.id,
        score: 94,
        feedback: "Strong recitation with clear stretch control.",
        actorId: "usr_teacher_demo",
      },
      context
    );

    expect(
      state.quizAttempts.find(item => item.id === attempt.id)
    ).toMatchObject({
      status: "completed",
      score: 94,
    });
    expect(state.grades).toContainEqual(
      expect.objectContaining({
        studentId: "stu_demo",
        itemId: "quiz_qt_madd",
        score: 94,
      })
    );
    expect(state.notifications).toContainEqual(
      expect.objectContaining({
        userId: "usr_student_demo",
        title: "Quiz reviewed",
      })
    );
    expect(state.auditLogs).toContainEqual(
      expect.objectContaining({
        action: "quiz.reviewed",
        entityId: attempt.id,
      })
    );

    expectDeniedWithoutMutation(
      state,
      {
        type: "quiz.review",
        attemptId: attempt.id,
        score: 70,
        feedback: "A second review must not overwrite the result.",
        actorId: "usr_teacher_demo",
      },
      context,
      "Only a pending quiz attempt can be reviewed."
    );
  });

  it("rejects missing and malformed review inputs without changing records", () => {
    const state = cloneState();
    const context = createContext();

    expectDeniedWithoutMutation(
      state,
      {
        type: "assignment.grade",
        submissionId: "sub_missing",
        score: 90,
        feedback: "Missing submission.",
        actorId: "usr_teacher_demo",
      },
      context,
      "Assignment submission sub_missing was not found."
    );
    expectDeniedWithoutMutation(
      state,
      {
        type: "assignment.grade",
        submissionId: "sub_ar_grammar_draft",
        score: Number.NaN,
        feedback: "Invalid score.",
        actorId: "usr_teacher_demo",
      },
      context,
      "Assignment review score must be a finite number."
    );
    expectDeniedWithoutMutation(
      state,
      {
        type: "quiz.review",
        attemptId: "attempt_ar_3_demo",
        score: 88,
        feedback: "Completed attempts are immutable here.",
        actorId: "usr_teacher_demo",
      },
      context,
      "Only a pending quiz attempt can be reviewed."
    );
    expectDeniedWithoutMutation(
      state,
      {
        type: "quiz.review",
        attemptId: "attempt_missing",
        score: 88,
        feedback: "Missing attempt.",
        actorId: "usr_teacher_demo",
      },
      context,
      "Quiz attempt attempt_missing was not found."
    );
  });

  it.each([
    {
      label: "assignment grading",
      action: {
        type: "assignment.grade" as const,
        submissionId: "sub_ar_grammar_draft",
        score: 90,
        feedback: "Roster authority is required.",
        actorId: "usr_teacher_demo",
      },
      message: "Teacher can only grade assigned class submissions.",
    },
    {
      label: "quiz review",
      action: {
        type: "quiz.review" as const,
        attemptId: "attempt_ar_teacher_review",
        score: 90,
        feedback: "Roster authority is required.",
        actorId: "usr_teacher_demo",
      },
      message: "Teacher can only review assigned class quiz attempts.",
    },
  ])(
    "rejects $label when the enrollment remains but roster membership is missing",
    ({ action, message }) => {
      const state = cloneState();
      state.classGroups = state.classGroups.map(group =>
        group.courseRunId === "run_ar_l3_2026"
          ? {
              ...group,
              studentIds: group.studentIds.filter(id => id !== "stu_demo"),
            }
          : group
      );

      expectDeniedWithoutMutation(state, action, createContext(), message);
    }
  );
});
