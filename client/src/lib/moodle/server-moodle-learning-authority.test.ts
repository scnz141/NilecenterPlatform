import { describe, expect, it, vi } from "vitest";

import type { ServerSession } from "../../../../server/auth";
import {
  createSupabaseNormalizedWorkflowRepository,
  NormalizedWorkflowValidationError,
} from "../../../../server/normalizedWorkflowRepository";
import {
  isMoodleOwnedLearningAction,
  MOODLE_OWNED_LEARNING_ACTION_TYPES,
} from "../../../../server/moodleLearningAuthority";

const teacherSession: ServerSession = {
  id: "normalized-teacher-session",
  userId: "40000000-0000-4000-8000-000000000003",
  authUserId: "10000000-0000-4000-8000-000000000003",
  email: "teacher@example.test",
  name: "Normalized Teacher",
  roles: ["teacher"],
  activeRole: "teacher",
  activeRoleGrantId: "50000000-0000-4000-8000-000000000003",
  branchIds: ["20000000-0000-4000-8000-000000000001"],
  departmentIds: ["65000000-0000-4000-8000-000000000001"],
  provider: "supabase",
  authorizationModel: "normalized",
  createdAt: "2026-07-23T00:00:00.000Z",
  expiresAt: "2026-07-23T12:00:00.000Z",
};

describe("Moodle-owned learning authority", () => {
  it("classifies every legacy learning mutation as Moodle-owned", () => {
    expect(MOODLE_OWNED_LEARNING_ACTION_TYPES).toEqual(
      expect.arrayContaining([
        "lesson.start",
        "material.publish.update",
        "assignment.create",
        "assignment.submit",
        "assignment.grade",
        "quiz.create",
        "quiz.submit",
        "quiz.review",
        "question.create",
      ])
    );
    expect(isMoodleOwnedLearningAction({ type: "assignment.create" })).toBe(
      true
    );
    expect(isMoodleOwnedLearningAction({ type: "attendance.save" })).toBe(
      false
    );
  });

  it("rejects normalized native assignment writes before any database call", async () => {
    const adminFetch = vi.fn();
    const repository = createSupabaseNormalizedWorkflowRepository(adminFetch);

    await expect(
      repository.apply(
        {
          type: "assignment.create",
          courseRunId: "run-1",
          classGroupId: "class-1",
          title: "Provider-owned assignment",
          dueAt: "2026-08-01T10:00:00.000Z",
          submissionType: "text",
          rubric: [],
          idempotencyKey: "assignment-command-1",
        },
        teacherSession
      )
    ).rejects.toThrow(NormalizedWorkflowValidationError);
    await expect(
      repository.apply(
        {
          type: "assignment.create",
          courseRunId: "run-1",
          classGroupId: "class-1",
          title: "Provider-owned assignment",
          dueAt: "2026-08-01T10:00:00.000Z",
          submissionType: "text",
          rubric: [],
          idempotencyKey: "assignment-command-2",
        },
        teacherSession
      )
    ).rejects.toThrow("managed in Moodle");
    expect(adminFetch).not.toHaveBeenCalled();
  });
});
