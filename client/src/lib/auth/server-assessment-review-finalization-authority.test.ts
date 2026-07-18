import { afterEach, describe, expect, it, vi } from "vitest";
import type { ServerSession } from "../../../../server/auth";
import type { PlatformRepository } from "../../../../server/platformRepository";
import { setPlatformStateRepository } from "../../../../server/platformRepository";
import {
  applyPlatformWorkflowAction,
  parsePlatformWorkflowAction,
} from "../../../../server/platformState";
import { seedPlatformState } from "../domain/seed";
import type { PlatformState, QuizAttempt } from "../domain/types";

function cloneState() {
  return JSON.parse(JSON.stringify(seedPlatformState)) as PlatformState;
}

function session(
  activeRole: ServerSession["activeRole"],
  userId: string
): ServerSession {
  return {
    id: `assessment_review_${activeRole}_${userId}`,
    userId,
    email: `${activeRole}@nilelearn.local`,
    name: activeRole,
    roles: [activeRole],
    activeRole,
    provider: "demo",
    authorizationModel: "snapshot",
    createdAt: "2026-07-11T00:00:00.000Z",
    expiresAt: "2026-07-11T23:59:00.000Z",
  };
}

function repositoryFor(state: PlatformState): PlatformRepository {
  let storedState = state;
  return {
    readSnapshot: vi.fn(async () => ({
      state: storedState,
      persistence: "local" as const,
      syncedAt: "2026-07-11T00:00:00.000Z",
    })),
    writeSnapshot: vi.fn(async (nextState: PlatformState) => {
      storedState = nextState;
      return "local" as const;
    }),
    recordEvent: vi.fn(async () => undefined),
  };
}

let restoreRepository: (() => void) | undefined;

afterEach(() => {
  restoreRepository?.();
  restoreRepository = undefined;
});

function install(state: PlatformState) {
  const repository = repositoryFor(state);
  restoreRepository = setPlatformStateRepository(repository);
  return repository;
}

function addOutsidePendingAttempt(state: PlatformState) {
  const attempt: QuizAttempt = {
    id: "attempt_review_outside_department",
    quizId: "quiz_ar_l1_letters",
    studentId: "stu_alex_demo",
    startedAt: "2026-07-10T10:00:00.000Z",
    submittedAt: "2026-07-10T10:10:00.000Z",
    status: "pending",
    score: 0,
    maxScore: 100,
    answers: { qbi_ar_l1_letter_mcq: "ب" },
  };
  state.quizAttempts.unshift(attempt);
  return attempt;
}

describe("server assessment review finalization authority", () => {
  it("uses the authenticated teacher actor and refuses a second review without another write", async () => {
    const state = cloneState();
    const repository = install(state);

    const result = await applyPlatformWorkflowAction(
      {
        type: "quiz.review",
        attemptId: "attempt_ar_teacher_review",
        score: 93,
        feedback: "Teacher-scoped final review.",
        actorId: "spoofed_actor",
      },
      session("teacher", "usr_teacher_demo")
    );

    expect(
      result.state.quizAttempts.find(
        item => item.id === "attempt_ar_teacher_review"
      )
    ).toMatchObject({ status: "completed", score: 93 });
    expect(result.state.auditLogs[0]).toMatchObject({
      action: "quiz.reviewed",
      entityId: "attempt_ar_teacher_review",
      actorId: "usr_teacher_demo",
    });
    expect(repository.writeSnapshot).toHaveBeenCalledTimes(1);

    await expect(
      applyPlatformWorkflowAction(
        {
          type: "quiz.review",
          attemptId: "attempt_ar_teacher_review",
          score: 70,
          feedback: "Unsafe replacement review.",
        },
        session("teacher", "usr_teacher_demo")
      )
    ).rejects.toThrow("Only a pending quiz attempt can be reviewed.");
    expect(repository.writeSnapshot).toHaveBeenCalledTimes(1);
  });

  it("keeps HOD review scope narrow while allowing Super Admin global review", async () => {
    const state = cloneState();
    const attempt = addOutsidePendingAttempt(state);
    const repository = install(state);

    await expect(
      applyPlatformWorkflowAction(
        {
          type: "quiz.review",
          attemptId: attempt.id,
          score: 86,
          feedback: "Out-of-scope review.",
        },
        session("headofdepartment", "usr_hod_demo")
      )
    ).rejects.toThrow("HOD can only review department quiz attempts.");
    expect(repository.writeSnapshot).not.toHaveBeenCalled();

    const result = await applyPlatformWorkflowAction(
      {
        type: "quiz.review",
        attemptId: attempt.id,
        score: 86,
        feedback: "Global final review.",
      },
      session("superadmin", "usr_admin_demo")
    );

    expect(
      result.state.quizAttempts.find(item => item.id === attempt.id)
    ).toMatchObject({ status: "completed", score: 86 });
    expect(result.state.auditLogs[0]).toMatchObject({
      action: "quiz.reviewed",
      entityId: attempt.id,
      actorId: "usr_admin_demo",
    });
    expect(repository.writeSnapshot).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed review payloads before a workflow action runs", () => {
    expect(
      parsePlatformWorkflowAction({
        type: "quiz.review",
        attemptId: "attempt_ar_teacher_review",
        score: Number.NaN,
        feedback: "Invalid score.",
      })
    ).toBeNull();
    expect(
      parsePlatformWorkflowAction({
        type: "assignment.grade",
        submissionId: "sub_ar_grammar_draft",
        score: 91,
        feedback: "",
      })
    ).toBeNull();
  });

  it.each([
    {
      label: "assignment grading",
      action: {
        type: "assignment.grade" as const,
        submissionId: "sub_ar_grammar_draft",
        score: 90,
        feedback: "Roster authority is required.",
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
      },
      message: "Teacher can only review assigned class quiz attempts.",
    },
  ])(
    "rejects roster-orphan $label without persistence",
    async ({ action, message }) => {
      const state = cloneState();
      state.classGroups = state.classGroups.map(group =>
        group.courseRunId === "run_ar_l3_2026"
          ? {
              ...group,
              studentIds: group.studentIds.filter(id => id !== "stu_demo"),
            }
          : group
      );
      const stateBeforeDenial = JSON.parse(
        JSON.stringify(state)
      ) as PlatformState;
      const repository = install(state);

      await expect(
        applyPlatformWorkflowAction(
          action,
          session("teacher", "usr_teacher_demo")
        )
      ).rejects.toThrow(message);

      expect(state).toEqual(stateBeforeDenial);
      expect(repository.writeSnapshot).not.toHaveBeenCalled();
      expect(repository.recordEvent).not.toHaveBeenCalled();
    }
  );
});
