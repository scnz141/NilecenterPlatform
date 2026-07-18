import { afterEach, describe, expect, it, vi } from "vitest";
import type { ServerSession } from "../../../../server/auth";
import type { PlatformRepository } from "../../../../server/platformRepository";
import { setPlatformStateRepository } from "../../../../server/platformRepository";
import {
  applyPlatformWorkflowAction,
  parsePlatformWorkflowAction,
} from "../../../../server/platformState";
import { scopePlatformStateForSession } from "../../../../server/routes";
import { seedPlatformState } from "../domain/seed";
import type { PlatformState } from "../domain/types";

function cloneState() {
  return JSON.parse(JSON.stringify(seedPlatformState)) as PlatformState;
}

function session(
  activeRole: ServerSession["activeRole"],
  userId: string
): ServerSession {
  return {
    id: `class_session_${activeRole}`,
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

afterEach(() => {
  restoreRepository?.();
  restoreRepository = undefined;
});

function install(state: PlatformState) {
  const repository = repositoryFor(state);
  restoreRepository = setPlatformStateRepository(repository);
  return repository;
}

describe("server class-session authority", () => {
  it("lets a branch admin reschedule an in-scope session and persists audit evidence", async () => {
    const state = cloneState();
    const repository = install(state);
    const output = await applyPlatformWorkflowAction(
      {
        type: "class.session.reschedule",
        sessionId: "session_ar_cairo_upcoming",
        startsAt: "2026-07-05T15:00:00+03:00",
        endsAt: "2026-07-05T16:00:00+03:00",
        roomId: "room_cairo_4",
        reason: "Branch timetable adjustment",
        actorId: "spoofed_actor",
      },
      session("branchadmin", "usr_branch_demo")
    );

    expect(
      output.state.classSessions.find(
        item => item.id === "session_ar_cairo_upcoming"
      )
    ).toMatchObject({ startsAt: "2026-07-05T15:00:00+03:00" });
    expect(repository.writeSnapshot).toHaveBeenCalledTimes(1);
    expect(repository.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "class_session.rescheduled",
        actorId: "usr_branch_demo",
        entityId: "session_ar_cairo_upcoming",
      })
    );
    const branchProjection = scopePlatformStateForSession(
      output.state,
      session("branchadmin", "usr_branch_demo")
    );
    expect(branchProjection.auditLogs).toContainEqual(
      expect.objectContaining({
        action: "class_session.rescheduled",
        entityId: "session_ar_cairo_upcoming",
      })
    );
    const teacherProjection = scopePlatformStateForSession(
      output.state,
      session("teacher", "usr_teacher_demo")
    );
    expect(
      teacherProjection.classSessions.find(
        item => item.id === "session_ar_cairo_upcoming"
      )
    ).toMatchObject({ startsAt: "2026-07-05T15:00:00+03:00" });
    expect(teacherProjection.auditLogs).toContainEqual(
      expect.objectContaining({
        action: "class_session.rescheduled",
        entityId: "session_ar_cairo_upcoming",
      })
    );
    const studentProjection = scopePlatformStateForSession(
      output.state,
      session("student", "usr_student_cairo_demo")
    );
    expect(studentProjection.notifications).toContainEqual(
      expect.objectContaining({
        title: "Class rescheduled",
        href: "/app/student/calendar",
      })
    );
    expect(
      studentProjection.classSessions.find(
        item => item.id === "session_ar_cairo_upcoming"
      )
    ).toMatchObject({ startsAt: "2026-07-05T15:00:00+03:00" });
  });

  it("denies branch and teacher attempts outside their authoritative scope", async () => {
    const state = cloneState();
    const before = cloneState();
    const repository = install(state);

    await expect(
      applyPlatformWorkflowAction(
        {
          type: "class.session.cancel",
          sessionId: "session_hifz_online",
          reason: "Out of scope cancellation attempt",
        },
        session("branchadmin", "usr_branch_demo")
      )
    ).rejects.toThrow("Branch admin can only manage sessions in their branch.");

    await expect(
      applyPlatformWorkflowAction(
        {
          type: "class.session.cancel",
          sessionId: "session_hifz_online",
          reason: "Unassigned teacher cancellation attempt",
        },
        session("teacher", "usr_teacher_demo")
      )
    ).rejects.toThrow("Teacher can only manage sessions for assigned classes.");

    expect(state).toEqual(before);
    expect(repository.writeSnapshot).not.toHaveBeenCalled();
    expect(repository.recordEvent).not.toHaveBeenCalled();
  });

  it("rejects attendance when the paired calendar event is not deliverable without persistence", async () => {
    const state = cloneState();
    state.events.find(item => item.id === "evt_ar_live")!.status = "cancelled";
    const before = JSON.parse(JSON.stringify(state)) as PlatformState;
    const repository = install(state);

    await expect(
      applyPlatformWorkflowAction(
        {
          type: "attendance.save",
          classGroupId: "class_ar_l3_a",
          sessionId: "session_ar_live",
          statuses: { stu_demo: "present" },
        },
        session("teacher", "usr_teacher_demo")
      )
    ).rejects.toThrow(
      "Attendance can only be saved when the paired calendar event is active or completed."
    );

    expect(state).toEqual(before);
    expect(repository.writeSnapshot).not.toHaveBeenCalled();
    expect(repository.recordEvent).not.toHaveBeenCalled();
  });

  it("parses exact reschedule and cancellation commands only", () => {
    expect(
      parsePlatformWorkflowAction({
        type: "class.session.reschedule",
        sessionId: "session_ar_cairo_upcoming",
        startsAt: "2026-07-05T15:00:00+03:00",
        endsAt: "2026-07-05T16:00:00+03:00",
        roomId: "room_cairo_4",
        reason: "Branch timetable adjustment",
      })
    ).toMatchObject({
      type: "class.session.reschedule",
      sessionId: "session_ar_cairo_upcoming",
      roomId: "room_cairo_4",
    });
    expect(
      parsePlatformWorkflowAction({
        type: "class.session.cancel",
        sessionId: "session_ar_cairo_upcoming",
        reason: "no",
      })
    ).toBeNull();
  });
});
