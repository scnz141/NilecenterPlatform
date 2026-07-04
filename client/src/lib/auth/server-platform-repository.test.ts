import { afterEach, describe, expect, it, vi } from "vitest";
import type { ServerSession } from "../../../../server/auth";
import type { PlatformRepository } from "../../../../server/platformRepository";
import { setPlatformStateRepository } from "../../../../server/platformRepository";
import { applyPlatformWorkflowAction, getPlatformStateSnapshot } from "../../../../server/platformState";
import { seedPlatformState } from "../domain/seed";
import type { PlatformState } from "../domain/types";

function cloneSeed(): PlatformState {
  return JSON.parse(JSON.stringify(seedPlatformState)) as PlatformState;
}

function sessionForTeacher(): ServerSession {
  return {
    id: "test_teacher",
    userId: "usr_teacher_demo",
    email: "teacher.demo@nilelearn.local",
    name: "Teacher Demo",
    roles: ["teacher"],
    activeRole: "teacher",
    provider: "demo",
    createdAt: "2026-07-04T00:00:00.000Z",
    expiresAt: "2026-07-04T12:00:00.000Z",
  };
}

let restoreRepository: (() => void) | undefined;

afterEach(() => {
  restoreRepository?.();
  restoreRepository = undefined;
});

describe("platform repository boundary", () => {
  it("reads platform snapshots through the configured repository", async () => {
    const state = cloneSeed();
    state.users = state.users.filter((user) => user.id === "usr_admin_demo");
    const repository: PlatformRepository = {
      readSnapshot: vi.fn(async () => ({
        state,
        persistence: "local",
        syncedAt: "2026-07-04T00:00:00.000Z",
      })),
      writeSnapshot: vi.fn(async () => "local"),
      recordEvent: vi.fn(async () => undefined),
    };
    restoreRepository = setPlatformStateRepository(repository);

    const snapshot = await getPlatformStateSnapshot();

    expect(repository.readSnapshot).toHaveBeenCalledTimes(1);
    expect(snapshot.persistence).toBe("local");
    expect(snapshot.state.users).toHaveLength(1);
    expect(snapshot.state.users[0]?.id).toBe("usr_admin_demo");
    expect(repository.writeSnapshot).not.toHaveBeenCalled();
  });

  it("applies workflow actions through the configured repository adapter", async () => {
    let savedState: PlatformState | undefined;
    const repository: PlatformRepository = {
      readSnapshot: vi.fn(async () => ({
        state: cloneSeed(),
        persistence: "local",
        syncedAt: "2026-07-04T00:00:00.000Z",
      })),
      writeSnapshot: vi.fn(async (state) => {
        savedState = JSON.parse(JSON.stringify(state)) as PlatformState;
        return "local";
      }),
      recordEvent: vi.fn(async () => undefined),
    };
    restoreRepository = setPlatformStateRepository(repository);

    const result = await applyPlatformWorkflowAction(
      {
        type: "attendance.save",
        classGroupId: "class_ar_l3_a",
        sessionId: "session_ar_live",
        statuses: { stu_demo: "late" },
        notes: { stu_demo: "Repository boundary save" },
      },
      sessionForTeacher(),
    );

    expect(repository.readSnapshot).toHaveBeenCalledTimes(1);
    expect(repository.writeSnapshot).toHaveBeenCalledTimes(1);
    expect(repository.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "attendance.saved",
        actorId: "usr_teacher_demo",
        entityType: "AttendanceRecord",
        entityId: "class_ar_l3_a",
      }),
    );
    expect(result.persistence).toBe("local");
    expect(savedState?.attendance).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          classGroupId: "class_ar_l3_a",
          sessionId: "session_ar_live",
          studentId: "stu_demo",
          status: "late",
          notes: "Repository boundary save",
        }),
      ]),
    );
    expect(savedState?.classSessions.find((session) => session.id === "session_ar_live")).toMatchObject({
      attendanceSaved: true,
    });
  });
});
