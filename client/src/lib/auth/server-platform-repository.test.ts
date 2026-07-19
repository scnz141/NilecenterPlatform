import { afterEach, describe, expect, it, vi } from "vitest";
import type { ServerSession } from "../../../../server/auth";
import type { PlatformRepository } from "../../../../server/platformRepository";
import {
  createSnapshotPlatformRepository,
  normalizePersistedPlatformState,
  normalizePlatformState,
  setPlatformStateRepository,
  validatePlatformRepositoryConfiguration,
} from "../../../../server/platformRepository";
import {
  applyPlatformWorkflowAction,
  getPlatformStateSnapshot,
} from "../../../../server/platformState";
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
const originalEnvironment = {
  NODE_ENV: process.env.NODE_ENV,
  NILE_SESSION_REPOSITORY: process.env.NILE_SESSION_REPOSITORY,
  NILE_PLATFORM_STATE_REQUIRE_SUPABASE:
    process.env.NILE_PLATFORM_STATE_REQUIRE_SUPABASE,
  NILE_PLATFORM_STATE_LOCAL_ONLY: process.env.NILE_PLATFORM_STATE_LOCAL_ONLY,
  QA_PLATFORM_STATE_LOCAL_ONLY: process.env.QA_PLATFORM_STATE_LOCAL_ONLY,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
};

function restoreEnvironmentValue(
  key: keyof typeof originalEnvironment,
  value: string | undefined
) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

afterEach(() => {
  restoreRepository?.();
  restoreRepository = undefined;
  for (const [key, value] of Object.entries(originalEnvironment)) {
    restoreEnvironmentValue(key as keyof typeof originalEnvironment, value);
  }
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("platform repository boundary", () => {
  it("normalizes invalid snapshots back to a complete seed state", () => {
    const state = normalizePlatformState(null);

    expect(state.users.length).toBeGreaterThan(0);
    expect(state.branches.length).toBeGreaterThan(0);
    expect(state.courseRuns.length).toBeGreaterThan(0);
    expect(state.auditLogs.length).toBe(seedPlatformState.auditLogs.length);
  });

  it("normalizes partial snapshots without dropping seeded compatibility records", () => {
    const state = normalizePlatformState({
      users: [
        {
          ...seedPlatformState.users[0],
          id: "usr_repository_test",
          email: "repository.test@nilelearn.local",
          name: "Repository Test",
        },
      ],
      staffProfiles: [],
      courseRuns: [],
      classGroups: [],
      events: [],
      portalSettings: [],
      reportPresets: [],
    });

    expect(state.users.some(user => user.id === "usr_repository_test")).toBe(
      true
    );
    expect(state.users.some(user => user.id === "usr_admin_demo")).toBe(true);
    expect(state.staffProfiles.length).toBeGreaterThanOrEqual(
      seedPlatformState.staffProfiles.length
    );
    expect(state.courseRuns.length).toBeGreaterThanOrEqual(
      seedPlatformState.courseRuns.length
    );
    expect(state.classGroups.length).toBeGreaterThanOrEqual(
      seedPlatformState.classGroups.length
    );
    expect(state.events.length).toBeGreaterThanOrEqual(
      seedPlatformState.events.length
    );
    expect(state.portalSettings.length).toBeGreaterThanOrEqual(
      seedPlatformState.portalSettings.length
    );
    expect(state.reportPresets.length).toBeGreaterThanOrEqual(
      seedPlatformState.reportPresets.length
    );
  });

  it("keeps a complete persisted snapshot database-authoritative without restoring seed records", () => {
    const persisted = cloneSeed();
    persisted.users = persisted.users.filter(
      user => user.id === "usr_admin_demo"
    );
    persisted.courseRuns = [];
    persisted.classGroups = [];
    persisted.enrollments = [];

    const state = normalizePersistedPlatformState(persisted);

    expect(state.users).toHaveLength(1);
    expect(state.users[0]?.id).toBe("usr_admin_demo");
    expect(state.courseRuns).toEqual([]);
    expect(state.classGroups).toEqual([]);
    expect(state.enrollments).toEqual([]);
  });

  it("rejects incomplete persisted snapshots instead of filling them from code", () => {
    expect(() => normalizePersistedPlatformState({ users: [] })).toThrow(
      "persisted platform snapshot is incomplete"
    );
  });

  it("requires strict database state with compatibility sessions in production", () => {
    process.env.NODE_ENV = "production";
    process.env.NILE_SESSION_REPOSITORY = "supabase_compatibility";
    delete process.env.NILE_PLATFORM_STATE_REQUIRE_SUPABASE;

    expect(() => validatePlatformRepositoryConfiguration()).toThrow(
      "require NILE_PLATFORM_STATE_REQUIRE_SUPABASE=1"
    );

    process.env.NILE_PLATFORM_STATE_REQUIRE_SUPABASE = "1";
    expect(() => validatePlatformRepositoryConfiguration()).not.toThrow();
  });

  it("fails closed when the strict Supabase snapshot is missing", async () => {
    delete process.env.NILE_PLATFORM_STATE_LOCAL_ONLY;
    delete process.env.QA_PLATFORM_STATE_LOCAL_ONLY;
    process.env.NILE_PLATFORM_STATE_REQUIRE_SUPABASE = "1";
    process.env.SUPABASE_URL = "https://strict-state-test.supabase.co";
    process.env.SUPABASE_SECRET_KEY = "test-only-secret";
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
      )
    );

    await expect(
      createSnapshotPlatformRepository().readSnapshot()
    ).rejects.toThrow("No platform snapshot exists");
  });

  it("does not fall back to a local file when strict Supabase writes fail", async () => {
    delete process.env.NILE_PLATFORM_STATE_LOCAL_ONLY;
    delete process.env.QA_PLATFORM_STATE_LOCAL_ONLY;
    process.env.NILE_PLATFORM_STATE_REQUIRE_SUPABASE = "1";
    process.env.SUPABASE_URL = "https://strict-state-test.supabase.co";
    process.env.SUPABASE_SECRET_KEY = "test-only-secret";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("unavailable", { status: 503 }))
    );

    await expect(
      createSnapshotPlatformRepository().writeSnapshot(cloneSeed())
    ).rejects.toThrow("Supabase platform state write failed with 503");
  });

  it("defaults legacy class groups without a status to active", () => {
    const legacyClassGroup = { ...seedPlatformState.classGroups[0] } as {
      id: string;
      status?: PlatformState["classGroups"][number]["status"];
    };
    delete legacyClassGroup.status;

    const state = normalizePlatformState({
      classGroups: [legacyClassGroup],
    });

    expect(
      state.classGroups.find(item => item.id === legacyClassGroup.id)?.status
    ).toBe("active");
  });

  it("refreshes legacy enrollment teacher caches from the course run", () => {
    const legacyState = cloneSeed();
    legacyState.enrollments = legacyState.enrollments.map(enrollment =>
      enrollment.id === "enr_ar_l3"
        ? { ...enrollment, teacherId: "usr_teacher_alex_demo" }
        : enrollment
    );

    const state = normalizePlatformState(legacyState);

    expect(
      state.enrollments.find(item => item.id === "enr_ar_l3")?.teacherId
    ).toBe("usr_teacher_demo");
  });

  it("adds Nile Forms permissions to a legacy cached permission catalog once", () => {
    const legacyState = cloneSeed();
    delete legacyState.permissionCatalogVersion;
    for (const role of Object.keys(legacyState.permissions) as Array<
      keyof PlatformState["permissions"]
    >) {
      legacyState.permissions[role] = legacyState.permissions[role].filter(
        permission =>
          !permission.startsWith("forms:") &&
          !permission.startsWith("form_submissions:")
      );
    }

    const state = normalizePlatformState(legacyState);

    expect(state.permissionCatalogVersion).toBe(1);
    expect(state.permissions.student).toEqual(
      expect.arrayContaining(["forms:read", "forms:respond"])
    );
    expect(state.permissions.superadmin).toEqual(
      expect.arrayContaining(["forms:read", "forms:write", "forms:publish"])
    );
  });

  it("does not restore a Forms permission removed after the catalog migration", () => {
    const state = cloneSeed();
    state.permissions.student = state.permissions.student.filter(
      permission => permission !== "forms:read"
    );

    const normalized = normalizePlatformState(state);

    expect(normalized.permissionCatalogVersion).toBe(1);
    expect(normalized.permissions.student).not.toContain("forms:read");
  });

  it("reads platform snapshots through the configured repository", async () => {
    const state = cloneSeed();
    state.users = state.users.filter(user => user.id === "usr_admin_demo");
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
      writeSnapshot: vi.fn(async state => {
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
      sessionForTeacher()
    );

    expect(repository.readSnapshot).toHaveBeenCalledTimes(1);
    expect(repository.writeSnapshot).toHaveBeenCalledTimes(1);
    expect(repository.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "attendance.saved",
        actorId: "usr_teacher_demo",
        entityType: "AttendanceRecord",
        entityId: "class_ar_l3_a",
      })
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
      ])
    );
    expect(
      savedState?.classSessions.find(
        session => session.id === "session_ar_live"
      )
    ).toMatchObject({
      attendanceSaved: true,
    });
  });

  it("keeps workflow mutations successful when repository event logging fails", async () => {
    let savedState: PlatformState | undefined;
    const repository: PlatformRepository = {
      readSnapshot: vi.fn(async () => ({
        state: cloneSeed(),
        persistence: "local",
        syncedAt: "2026-07-04T00:00:00.000Z",
      })),
      writeSnapshot: vi.fn(async state => {
        savedState = JSON.parse(JSON.stringify(state)) as PlatformState;
        return "local";
      }),
      recordEvent: vi.fn(async () => {
        throw new Error("event sink unavailable");
      }),
    };
    restoreRepository = setPlatformStateRepository(repository);

    const result = await applyPlatformWorkflowAction(
      {
        type: "attendance.save",
        classGroupId: "class_ar_l3_a",
        sessionId: "session_ar_live",
        statuses: { stu_demo: "excused" },
        notes: {
          stu_demo: "Event sink failure should not block snapshot save",
        },
      },
      sessionForTeacher()
    );

    expect(repository.writeSnapshot).toHaveBeenCalledTimes(1);
    expect(repository.recordEvent).toHaveBeenCalledTimes(1);
    expect(result.result).toMatchObject({
      action: "attendance.saved",
      entityType: "AttendanceRecord",
      entityId: "class_ar_l3_a",
    });
    expect(result.persistence).toBe("local");
    expect(savedState?.attendance).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          classGroupId: "class_ar_l3_a",
          sessionId: "session_ar_live",
          studentId: "stu_demo",
          status: "excused",
        }),
      ])
    );
  });

  it("records repository events with source persistence and server-owned request evidence", async () => {
    const repository: PlatformRepository = {
      readSnapshot: vi.fn(async () => ({
        state: cloneSeed(),
        persistence: "supabase",
        syncedAt: "2026-07-04T00:00:00.000Z",
      })),
      writeSnapshot: vi.fn(async () => "local"),
      recordEvent: vi.fn(async () => undefined),
    };
    restoreRepository = setPlatformStateRepository(repository);

    await applyPlatformWorkflowAction(
      {
        type: "attendance.save",
        classGroupId: "class_ar_l3_a",
        sessionId: "session_ar_live",
        statuses: { stu_demo: "present" },
        notes: { stu_demo: "Payload evidence" },
      },
      sessionForTeacher()
    );

    expect(repository.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "attendance.saved",
        actorId: "usr_teacher_demo",
        entityType: "AttendanceRecord",
        entityId: "class_ar_l3_a",
        payload: expect.objectContaining({
          sourcePersistence: "supabase",
          request: expect.objectContaining({
            type: "attendance.save",
            actorId: "usr_teacher_demo",
            classGroupId: "class_ar_l3_a",
            sessionId: "session_ar_live",
          }),
        }),
      })
    );
  });
});
