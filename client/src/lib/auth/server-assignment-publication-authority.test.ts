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
import type { Assignment, PlatformState } from "../domain/types";

function cloneState() {
  return JSON.parse(JSON.stringify(seedPlatformState)) as PlatformState;
}

function session(
  activeRole: ServerSession["activeRole"],
  userId: string
): ServerSession {
  return {
    id: `assignment_publication_${activeRole}_${userId}`,
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
  const assignment: Assignment = {
    id,
    courseRunId,
    title: "Scoped assignment draft",
    dueAt: "2026-07-20T18:00:00+03:00",
    submissionType: "text",
    rubric: ["Accuracy"],
    status: "draft",
  };
  state.assignments.unshift(assignment);
  return assignment;
}

describe("server assignment publication authority", () => {
  it("lets the assigned teacher update and publish with session-derived actor evidence", async () => {
    const state = cloneState();
    const repository = install(state);
    const assignment = addDraft(state, "asg_server_assignment_own");
    const teacher = session("teacher", "usr_teacher_demo");

    await applyPlatformWorkflowAction(
      {
        type: "assignment.update",
        assignmentId: assignment.id,
        title: "Updated by assigned teacher",
        dueAt: "2026-07-22T18:00:00+03:00",
        submissionType: "file",
        rubric: ["Evidence"],
        actorId: "spoofed_actor",
      },
      teacher
    );
    const output = await applyPlatformWorkflowAction(
      {
        type: "assignment.status.update",
        assignmentId: assignment.id,
        status: "active",
        actorId: "spoofed_actor",
      },
      teacher
    );

    expect(
      output.state.assignments.find(item => item.id === assignment.id)
    ).toMatchObject({
      title: "Updated by assigned teacher",
      submissionType: "file",
      status: "active",
    });
    expect(output.state.auditLogs).toContainEqual(
      expect.objectContaining({
        action: "assignment.published",
        entityId: assignment.id,
        actorId: "usr_teacher_demo",
      })
    );
    expect(repository.writeSnapshot).toHaveBeenCalledTimes(2);
  });

  it("denies an unassigned teacher and branch admin without persistence", async () => {
    const state = cloneState();
    const assignment = addDraft(state, "asg_server_assignment_denied");
    const before = JSON.parse(JSON.stringify(state)) as PlatformState;
    const repository = install(state);
    const action = {
      type: "assignment.status.update" as const,
      assignmentId: assignment.id,
      status: "active" as const,
    };

    await expect(
      applyPlatformWorkflowAction(
        action,
        session("teacher", "usr_teacher_alex_demo")
      )
    ).rejects.toThrow(
      "Teacher can only manage assignments for assigned course runs."
    );
    await expect(
      applyPlatformWorkflowAction(
        action,
        session("branchadmin", "usr_branch_demo")
      )
    ).rejects.toThrow("Role branchadmin cannot run assignment.status.update.");
    expect(state).toEqual(before);
    expect(repository.writeSnapshot).not.toHaveBeenCalled();
  });

  it("enforces HOD department scope and permits global superadmin governance", async () => {
    const state = cloneState();
    const own = addDraft(state, "asg_server_assignment_hod");
    const outside = addDraft(
      state,
      "asg_server_assignment_outside",
      "run_ar_l1_alex_2026"
    );
    install(state);

    await applyPlatformWorkflowAction(
      {
        type: "assignment.update",
        assignmentId: own.id,
        title: "Department reviewed draft",
        dueAt: own.dueAt,
        submissionType: own.submissionType,
        rubric: own.rubric,
      },
      session("headofdepartment", "usr_hod_demo")
    );
    await expect(
      applyPlatformWorkflowAction(
        {
          type: "assignment.update",
          assignmentId: outside.id,
          title: "Out of department edit",
          dueAt: outside.dueAt,
          submissionType: outside.submissionType,
          rubric: outside.rubric,
        },
        session("headofdepartment", "usr_hod_demo")
      )
    ).rejects.toThrow("HOD can only manage assignments in their department.");
    await applyPlatformWorkflowAction(
      {
        type: "assignment.update",
        assignmentId: outside.id,
        title: "Globally governed draft",
        dueAt: outside.dueAt,
        submissionType: outside.submissionType,
        rubric: outside.rubric,
      },
      session("superadmin", "usr_admin_demo")
    );

    expect(own.title).toBe("Department reviewed draft");
    expect(outside.title).toBe("Globally governed draft");
  });

  it("parses complete lifecycle commands and rejects invalid statuses", () => {
    expect(
      parsePlatformWorkflowAction({
        type: "assignment.update",
        assignmentId: "asg_ar_grammar",
        title: "Updated assignment",
        dueAt: "2026-07-20T18:00:00+03:00",
        submissionType: "audio",
        rubric: ["Fluency"],
      })
    ).toMatchObject({
      type: "assignment.update",
      assignmentId: "asg_ar_grammar",
      submissionType: "audio",
    });
    expect(
      parsePlatformWorkflowAction({
        type: "assignment.status.update",
        assignmentId: "asg_ar_grammar",
        status: "paused",
      })
    ).toBeNull();
  });

  it("projects only published or completed assignments to the student", () => {
    const state = cloneState();
    addDraft(state, "asg_server_assignment_hidden_draft");
    const cancelled = addDraft(
      state,
      "asg_server_assignment_hidden_cancelled"
    );
    cancelled.status = "cancelled";
    const completed = addDraft(
      state,
      "asg_server_assignment_visible_completed"
    );
    completed.status = "completed";

    const projection = scopePlatformStateForSession(
      state,
      session("student", "usr_student_demo")
    );
    const ids = projection.assignments.map(item => item.id);

    expect(ids).toContain("asg_ar_grammar");
    expect(ids).toContain(completed.id);
    expect(ids).not.toContain("asg_server_assignment_hidden_draft");
    expect(ids).not.toContain(cancelled.id);
  });
});
