import { describe, expect, it, vi } from "vitest";

import type { ServerSession } from "../../../../server/auth";
import { registerMoodleCommandRoutes } from "../../../../server/moodleCommandRoutes";

type Handler = (
  request: {
    body?: Record<string, unknown>;
    params?: Record<string, string | undefined>;
    headers: { cookie?: string };
    get(name: string): string | undefined;
  },
  response: ReturnType<typeof recorder>["response"]
) => Promise<void> | void;

function recorder() {
  const result: { status: number; body?: unknown } = { status: 200 };
  const response = {
    status(code: number) {
      result.status = code;
      return response;
    },
    json(body: unknown) {
      result.body = body;
    },
  };
  return { response, result };
}

function routes(
  env: NodeJS.ProcessEnv,
  repository: Record<string, unknown>,
  session: ServerSession | null = null
) {
  const handlers = new Map<string, Handler>();
  registerMoodleCommandRoutes(
    {
      get(path, handler) {
        handlers.set(`GET ${path}`, handler as Handler);
      },
      post(path, handler) {
        handlers.set(`POST ${path}`, handler as Handler);
      },
    },
    env,
    repository as never,
    { processOne: vi.fn() } as never,
    vi.fn(async () => session) as never
  );
  return handlers;
}

const normalizedTeacher: ServerSession = {
  id: "session-teacher",
  userId: "user-teacher",
  email: "teacher@example.test",
  name: "Synthetic Teacher",
  roles: ["teacher"],
  activeRole: "teacher",
  provider: "supabase",
  authorizationModel: "normalized",
  createdAt: "2026-07-24T00:00:00.000Z",
  expiresAt: "2026-07-25T00:00:00.000Z",
};

const normalizedAdmin: ServerSession = {
  ...normalizedTeacher,
  id: "session-admin",
  userId: "user-admin",
  email: "admin@example.test",
  name: "Synthetic Admin",
  roles: ["superadmin"],
  activeRole: "superadmin",
};

const enabledMoodleEnv = {
  NILE_MOODLE_COMMAND_RUNTIME_ENABLED: "1",
  NILE_MOODLE_PLUGIN_ACCEPTED: "1",
  MOODLE_COMMAND_BASE_URL: "https://moodle.example.test",
  MOODLE_COMMAND_TOKEN: "synthetic-test-token",
} as NodeJS.ProcessEnv;

describe("Moodle command routes", () => {
  it("lets normalized Super Admin inspect the queue while writes remain disabled", async () => {
    const listForAdmin = vi.fn(async () => [
      {
        commandId: "d6100000-0000-4000-8000-000000000001",
        operation: "delivery_course.clone",
        status: "queued",
        attemptCount: 0,
        createdAt: "2026-07-24T00:00:00.000Z",
        updatedAt: "2026-07-24T00:00:00.000Z",
      },
    ]);
    const handlers = routes({}, { listForAdmin }, normalizedAdmin);
    const result = recorder();

    await handlers.get("GET /api/integrations/moodle/commands")!(
      { headers: {}, get: () => undefined },
      result.response
    );

    expect(result.result).toEqual({
      status: 200,
      body: {
        commands: [
          expect.objectContaining({
            operation: "delivery_course.clone",
            status: "queued",
          }),
        ],
        runtimeState: "disabled",
      },
    });
    expect(listForAdmin).toHaveBeenCalledWith(50);
  });

  it("denies teachers and gives compatibility admins an empty authority state", async () => {
    const listForAdmin = vi.fn();
    const teacherHandlers = routes({}, { listForAdmin }, normalizedTeacher);
    const teacher = recorder();
    await teacherHandlers.get("GET /api/integrations/moodle/commands")!(
      { headers: {}, get: () => undefined },
      teacher.response
    );
    expect(teacher.result.status).toBe(403);

    const compatibilityHandlers = routes(
      {},
      { listForAdmin },
      {
        ...normalizedAdmin,
        provider: "demo",
        authorizationModel: "snapshot",
      }
    );
    const compatibility = recorder();
    await compatibilityHandlers.get("GET /api/integrations/moodle/commands")!(
      { headers: {}, get: () => undefined },
      compatibility.response
    );
    expect(compatibility.result).toEqual({
      status: 200,
      body: {
        commands: [],
        runtimeState: "normalized_session_required",
      },
    });
    expect(listForAdmin).not.toHaveBeenCalled();
  });

  it("reports role capabilities without bypassing command scope checks", async () => {
    const enabled = routes(enabledMoodleEnv, {}, normalizedTeacher);
    const available = recorder();
    await enabled.get("GET /api/integrations/moodle/capabilities")!(
      { headers: {}, get: () => undefined },
      available.response
    );
    expect(available.result).toEqual({
      status: 200,
      body: expect.objectContaining({
        state: "available",
        operations: expect.arrayContaining(["resource.upsert", "grade.update"]),
        nativeLaunchKinds: expect.arrayContaining([
          "lesson_authoring",
          "video_time_authoring",
        ]),
        scopeValidatedOnCommand: true,
      }),
    });

    const disabled = routes({}, {}, normalizedTeacher);
    const unavailable = recorder();
    await disabled.get("GET /api/integrations/moodle/capabilities")!(
      { headers: {}, get: () => undefined },
      unavailable.response
    );
    expect(unavailable.result.body).toEqual({
      state: "disabled",
      operations: [],
      nativeLaunchKinds: [],
      scopeValidatedOnCommand: true,
    });

    const incomplete = routes(
      { NILE_MOODLE_COMMAND_RUNTIME_ENABLED: "1" } as NodeJS.ProcessEnv,
      {},
      normalizedTeacher
    );
    const blocked = recorder();
    await incomplete.get("GET /api/integrations/moodle/capabilities")!(
      { headers: {}, get: () => undefined },
      blocked.response
    );
    expect(blocked.result.body).toEqual({
      state: "disabled",
      operations: [],
      nativeLaunchKinds: [],
      scopeValidatedOnCommand: true,
    });
  });

  it("does not expose command capabilities to compatibility sessions", async () => {
    const handlers = routes(
      enabledMoodleEnv,
      {},
      {
        ...normalizedTeacher,
        provider: "demo",
        authorizationModel: "snapshot",
      }
    );
    const result = recorder();
    await handlers.get("GET /api/integrations/moodle/capabilities")!(
      { headers: {}, get: () => undefined },
      result.response
    );
    expect(result.result.body).toEqual({
      state: "normalized_session_required",
      operations: [],
      nativeLaunchKinds: [],
      scopeValidatedOnCommand: true,
    });
  });

  it("requires the dedicated launch exchange secret", async () => {
    const consumeLaunch = vi.fn(async () => ({
      launchId: "d6100000-0000-4000-8000-000000000001",
      actorExternalId: "21",
      targetExternalId: "42",
      kind: "quiz_attempt",
      returnPath: "/app/student/quizzes",
    }));
    const env = {
      ...enabledMoodleEnv,
      NILE_MOODLE_WORKER_SECRET: "worker-secret-only",
      CRON_SECRET: "cron-secret-only",
      NILE_MOODLE_LAUNCH_EXCHANGE_SECRET: "launch-secret-only",
    } as NodeJS.ProcessEnv;
    const handlers = routes(env, { consumeLaunch });
    const handler = handlers.get(
      "POST /api/internal/moodle-launches/exchange"
    )!;

    for (const deniedSecret of ["worker-secret-only", "cron-secret-only"]) {
      const denied = recorder();
      await handler(
        {
          body: { ticket: "a".repeat(43) },
          headers: {},
          get: () => `Bearer ${deniedSecret}`,
        },
        denied.response
      );
      expect(denied.result.status).toBe(401);
    }
    expect(consumeLaunch).not.toHaveBeenCalled();

    const allowed = recorder();
    await handler(
      {
        body: { ticket: "a".repeat(43) },
        headers: {},
        get: () => "Bearer launch-secret-only",
      },
      allowed.response
    );
    expect(allowed.result.status).toBe(200);
    expect(consumeLaunch).toHaveBeenCalledOnce();
  });
});
