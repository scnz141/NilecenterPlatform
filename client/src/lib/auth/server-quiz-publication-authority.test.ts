import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ServerSession } from "../../../../server/auth";
import type { PlatformRepository } from "../../../../server/platformRepository";
import { setPlatformStateRepository } from "../../../../server/platformRepository";
import {
  applyPlatformWorkflowAction,
  parsePlatformWorkflowAction,
} from "../../../../server/platformState";
import { scopePlatformStateForSession } from "../../../../server/routes";
import { seedPlatformState } from "../domain/seed";
import type { PlatformState, Quiz } from "../domain/types";

function cloneState() {
  return JSON.parse(JSON.stringify(seedPlatformState)) as PlatformState;
}

function session(
  activeRole: ServerSession["activeRole"],
  userId: string
): ServerSession {
  return {
    id: `quiz_publication_${activeRole}_${userId}`,
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
  return {
    readSnapshot: vi.fn(async () => ({
      state,
      persistence: "local" as const,
      syncedAt: "2026-07-11T00:00:00.000Z",
    })),
    writeSnapshot: vi.fn(async () => "local" as const),
    recordEvent: vi.fn(async () => undefined),
  };
}

let restoreRepository: (() => void) | undefined;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-11T09:00:00.000Z"));
});

afterEach(() => {
  restoreRepository?.();
  restoreRepository = undefined;
  vi.useRealTimers();
});

function install(state: PlatformState) {
  const repository = repositoryFor(state);
  restoreRepository = setPlatformStateRepository(repository);
  return repository;
}

function addDraft(
  state: PlatformState,
  id: string,
  courseRunId = "run_ar_l3_2026"
) {
  const quiz: Quiz = {
    id,
    courseRunId,
    title: "Scoped quiz draft",
    dueAt: "2026-07-20T18:00:00+03:00",
    durationMinutes: 20,
    questionTypes: ["multiple_choice"],
    questionIds:
      courseRunId === "run_ar_l3_2026"
        ? ["qbi_ar_conditional_mcq"]
        : ["qbi_ar_l1_letter_mcq"],
    attemptsAllowed: 2,
    status: "draft",
  };
  state.quizzes.unshift(quiz);
  return quiz;
}

describe("server quiz publication authority", () => {
  it("lets the assigned teacher update and publish with session-derived audit actor", async () => {
    const state = cloneState();
    const repository = install(state);
    const quiz = addDraft(state, "quiz_server_own");
    const teacher = session("teacher", "usr_teacher_demo");

    await applyPlatformWorkflowAction(
      {
        type: "quiz.update",
        quizId: quiz.id,
        title: "Updated scoped quiz",
        dueAt: "2026-07-22T18:00:00+03:00",
        durationMinutes: 30,
        attemptsAllowed: 3,
        actorId: "spoofed_actor",
      },
      teacher
    );
    const output = await applyPlatformWorkflowAction(
      {
        type: "quiz.status.update",
        quizId: quiz.id,
        status: "active",
        actorId: "spoofed_actor",
      },
      teacher
    );

    expect(output.state.quizzes.find(item => item.id === quiz.id)).toMatchObject({
      title: "Updated scoped quiz",
      durationMinutes: 30,
      attemptsAllowed: 3,
      status: "active",
    });
    expect(output.state.auditLogs).toContainEqual(
      expect.objectContaining({
        action: "quiz.published",
        entityId: quiz.id,
        actorId: "usr_teacher_demo",
      })
    );
    expect(repository.writeSnapshot).toHaveBeenCalledTimes(2);
  });

  it("denies an unassigned teacher and branch admin without persistence", async () => {
    const state = cloneState();
    const quiz = addDraft(state, "quiz_server_denied");
    const before = JSON.parse(JSON.stringify(state)) as PlatformState;
    const repository = install(state);
    const action = {
      type: "quiz.status.update" as const,
      quizId: quiz.id,
      status: "active" as const,
    };

    await expect(
      applyPlatformWorkflowAction(
        action,
        session("teacher", "usr_teacher_alex_demo")
      )
    ).rejects.toThrow("Teacher can only manage quizzes for assigned course runs.");
    await expect(
      applyPlatformWorkflowAction(
        action,
        session("branchadmin", "usr_branch_demo")
      )
    ).rejects.toThrow("Role branchadmin cannot run quiz.status.update.");
    expect(state).toEqual(before);
    expect(repository.writeSnapshot).not.toHaveBeenCalled();
  });

  it("enforces HOD department scope and permits superadmin governance", async () => {
    const state = cloneState();
    const own = addDraft(state, "quiz_server_hod");
    const outside = addDraft(
      state,
      "quiz_server_outside",
      "run_ar_l1_alex_2026"
    );
    install(state);

    await applyPlatformWorkflowAction(
      {
        type: "quiz.update",
        quizId: own.id,
        title: "Department reviewed quiz",
        dueAt: own.dueAt,
        durationMinutes: own.durationMinutes,
        attemptsAllowed: own.attemptsAllowed,
      },
      session("headofdepartment", "usr_hod_demo")
    );
    await expect(
      applyPlatformWorkflowAction(
        {
          type: "quiz.update",
          quizId: outside.id,
          title: "Out of department quiz",
          dueAt: outside.dueAt,
          durationMinutes: outside.durationMinutes,
          attemptsAllowed: outside.attemptsAllowed,
        },
        session("headofdepartment", "usr_hod_demo")
      )
    ).rejects.toThrow("HOD can only manage quizzes in their department.");
    await applyPlatformWorkflowAction(
      {
        type: "quiz.update",
        quizId: outside.id,
        title: "Globally governed quiz",
        dueAt: outside.dueAt,
        durationMinutes: outside.durationMinutes,
        attemptsAllowed: outside.attemptsAllowed,
      },
      session("superadmin", "usr_admin_demo")
    );

    expect(own.title).toBe("Department reviewed quiz");
    expect(outside.title).toBe("Globally governed quiz");
  });

  it("parses complete lifecycle commands and rejects invalid statuses", () => {
    expect(
      parsePlatformWorkflowAction({
        type: "quiz.update",
        quizId: "quiz_ar_3",
        title: "Updated quiz",
        dueAt: "2026-07-20T18:00:00+03:00",
        durationMinutes: 30,
        attemptsAllowed: 2,
      })
    ).toMatchObject({ type: "quiz.update", quizId: "quiz_ar_3" });
    expect(
      parsePlatformWorkflowAction({
        type: "quiz.status.update",
        quizId: "quiz_ar_3",
        status: "paused",
      })
    ).toBeNull();
  });

  it("projects only published or completed quizzes and their question previews to students", () => {
    const state = cloneState();
    const draft = addDraft(state, "quiz_server_hidden_draft");
    const cancelled = addDraft(state, "quiz_server_hidden_cancelled");
    cancelled.status = "cancelled";
    const completed = addDraft(state, "quiz_server_visible_completed");
    completed.status = "completed";

    const projection = scopePlatformStateForSession(
      state,
      session("student", "usr_student_demo")
    );
    const ids = projection.quizzes.map(item => item.id);
    const previewQuizIds = new Set(
      projection.quizQuestionPreviews.map(item => item.quizId)
    );

    expect(ids).toContain("quiz_ar_3");
    expect(ids).toContain(completed.id);
    expect(ids).not.toContain(draft.id);
    expect(ids).not.toContain(cancelled.id);
    expect(previewQuizIds).toContain(completed.id);
    expect(previewQuizIds).not.toContain(draft.id);
    expect(previewQuizIds).not.toContain(cancelled.id);
  });
});
