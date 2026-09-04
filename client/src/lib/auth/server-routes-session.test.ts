import { afterEach, describe, expect, it, vi } from "vitest";

import { registerApiRoutes } from "../../../../server/routes";
import {
  resetDefaultSessionStore,
  SessionAuthorityDeniedError,
  SessionCommandConflictError,
  SessionRepositoryUnavailableError,
  setSessionStore,
  type SessionStore,
} from "../../../../server/sessionStore";
import {
  NormalizedWorkflowUnavailableError,
  resetNormalizedWorkflowRepository,
  setNormalizedWorkflowRepository,
} from "../../../../server/normalizedWorkflowRepository";
import { scopePlatformStateForSession } from "../../../../server/routes";
import { setPlatformStateRepository } from "../../../../server/platformRepository";
import { seedPlatformState } from "../domain/seed";

type RouteHandler = (
  request: unknown,
  response: unknown
) => Promise<void> | void;

function captureRoutes() {
  const getRoutes = new Map<string, RouteHandler>();
  const postRoutes = new Map<string, RouteHandler>();
  const app = {
    use: vi.fn(),
    get(path: string, handler: RouteHandler) {
      getRoutes.set(path, handler);
    },
    post(path: string, handler: RouteHandler) {
      postRoutes.set(path, handler);
    },
  };
  registerApiRoutes(app as never);
  return { getRoutes, postRoutes };
}

function request(method: string, body: Record<string, unknown> = {}) {
  return {
    method,
    body,
    query: {},
    headers: { cookie: "nilelearn_session=durable-token" },
    ip: "127.0.0.1",
    get(name: string) {
      return name === "X-Nile-Learn-Request" ? "browser" : undefined;
    },
  };
}

function qaFixtureRequest(
  method: string,
  body: Record<string, unknown> = {},
  enabled = true
) {
  const base = request(method, body);
  return {
    ...base,
    get(name: string) {
      if (name === "X-Nile-Learn-Request") return "browser";
      if (name === "X-Nile-Learn-QA-Fixture" && enabled) return "1";
      return undefined;
    },
  };
}

function responseRecorder() {
  const headers = new Map<string, string>();
  const result: { status: number; body?: unknown } = { status: 200 };
  const response = {
    setHeader(name: string, value: string) {
      headers.set(name, value);
    },
    status(code: number) {
      result.status = code;
      return response;
    },
    json(body: unknown) {
      result.body = body;
    },
  };
  return { headers, response, result };
}

function unavailableRepository(): SessionStore {
  return {
    kind: "supabase",
    create: async () => undefined,
    get: async () => {
      throw new SessionRepositoryUnavailableError();
    },
    delete: async () => {
      throw new SessionRepositoryUnavailableError();
    },
    clear: async () => undefined,
  };
}

afterEach(() => {
  resetDefaultSessionStore();
  resetNormalizedWorkflowRepository();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("API durable session outage handling", () => {
  it("returns a controlled 503 when session lookup is unavailable", async () => {
    const restore = setSessionStore(unavailableRepository());
    const { getRoutes } = captureRoutes();
    const { response, result } = responseRecorder();

    await getRoutes.get("/api/auth/session")?.(request("GET"), response);

    expect(result).toEqual({
      status: 503,
      body: { error: "Session service is temporarily unavailable." },
    });
    restore();
  });

  it("retains the cookie and returns 503 when durable logout cannot revoke", async () => {
    const restore = setSessionStore(unavailableRepository());
    const { postRoutes } = captureRoutes();
    const { headers, response, result } = responseRecorder();

    await postRoutes.get("/api/auth/logout")?.(request("POST"), response);

    expect(result).toEqual({
      status: 503,
      body: { error: "Session service is temporarily unavailable." },
    });
    expect(headers.has("Set-Cookie")).toBe(false);
    restore();
  });

  it("retains the cookie when durable logout evidence conflicts", async () => {
    const repository: SessionStore = {
      kind: "supabase",
      create: async () => undefined,
      get: async () => null,
      delete: async () => {
        throw new SessionCommandConflictError();
      },
      clear: async () => undefined,
    };
    const restore = setSessionStore(repository);
    const { postRoutes } = captureRoutes();
    const { headers, response, result } = responseRecorder();

    await postRoutes.get("/api/auth/logout")?.(request("POST"), response);

    expect(result).toEqual({
      status: 409,
      body: { error: "Sign out could not be completed safely." },
    });
    expect(headers.has("Set-Cookie")).toBe(false);
    restore();
  });
});

describe("API normalized session and command boundaries", () => {
  it("switches role through a replacement server session", async () => {
    const create = vi.fn(async () => undefined);
    const remove = vi.fn(async () => undefined);
    const restore = setSessionStore({
      kind: "supabase",
      create,
      get: async () => ({
        id: "durable-token",
        userId: "40000000-0000-4000-8000-000000000002",
        authUserId: "10000000-0000-4000-8000-000000000002",
        email: "staff@nilelearn.local",
        name: "Scoped Staff",
        roles: ["teacher"],
        activeRole: "teacher",
        activeRoleGrantId: "50000000-0000-4000-8000-000000000002",
        branchIds: ["20000000-0000-4000-8000-000000000001"],
        departmentIds: ["30000000-0000-4000-8000-000000000001"],
        provider: "supabase",
        authorizationModel: "normalized",
        createdAt: "2026-07-22T00:00:00.000Z",
        expiresAt: "2099-07-22T12:00:00.000Z",
      }),
      delete: remove,
      clear: async () => undefined,
      resolveSupabaseIdentity: async () => ({
        userId: "40000000-0000-4000-8000-000000000002",
        authUserId: "10000000-0000-4000-8000-000000000002",
        email: "staff@nilelearn.local",
        name: "Scoped Staff",
        activeRole: "headofdepartment",
        activeRoleGrantId: "50000000-0000-4000-8000-000000000003",
        branchIds: ["20000000-0000-4000-8000-000000000001"],
        departmentIds: ["30000000-0000-4000-8000-000000000001"],
      }),
    });
    const { postRoutes } = captureRoutes();
    const { headers, response, result } = responseRecorder();

    await postRoutes.get("/api/auth/switch-role")?.(
      request("POST", { role: "headofdepartment" }),
      response
    );

    expect(result).toMatchObject({
      status: 200,
      body: {
        activeRole: "headofdepartment",
        authorizationModel: "normalized",
      },
    });
    expect(create).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledWith("durable-token");
    expect(headers.get("Set-Cookie")).toContain("nilelearn_session=");
    restore();
  });

  it("returns closed command evidence from the normalized endpoint", async () => {
    const restoreSession = setSessionStore({
      kind: "supabase",
      create: async () => undefined,
      get: async () => ({
        id: "durable-token",
        userId: "40000000-0000-4000-8000-000000000001",
        authUserId: "10000000-0000-4000-8000-000000000001",
        email: "student@nilelearn.local",
        name: "Normalized Student",
        roles: ["student"],
        activeRole: "student",
        activeRoleGrantId: "50000000-0000-4000-8000-000000000001",
        branchIds: ["20000000-0000-4000-8000-000000000001"],
        departmentIds: [],
        provider: "supabase",
        authorizationModel: "normalized",
        createdAt: "2026-07-22T00:00:00.000Z",
        expiresAt: "2099-07-22T12:00:00.000Z",
      }),
      delete: async () => undefined,
      clear: async () => undefined,
    });
    const restoreWorkflow = setNormalizedWorkflowRepository({
      readWorkspace: async () => structuredClone(seedPlatformState),
      apply: async () => ({
        state: structuredClone(seedPlatformState),
        persistence: "supabase",
        syncedAt: "2026-07-22T00:00:00.000Z",
        result: {
          action: "profile.updated",
          entityType: "User",
          entityId: "40000000-0000-4000-8000-000000000001",
          summary: "Profile updated.",
          result: {
            commandId: "60000000-0000-4000-8000-000000000001",
            version: 2,
            replayed: false,
          },
        },
      }),
    });
    const { postRoutes } = captureRoutes();
    const { response, result } = responseRecorder();

    await postRoutes.get("/api/platform/commands")?.(
      request("POST", {
        type: "profile.update",
        expectedVersion: 1,
        idempotencyKey: "profile:update:route-0001",
        payload: { name: "Updated Student" },
      }),
      response
    );

    expect(result).toEqual({
      status: 200,
      body: {
        commandId: "60000000-0000-4000-8000-000000000001",
        entityId: "40000000-0000-4000-8000-000000000001",
        version: 2,
        status: "applied",
        auditId: "60000000-0000-4000-8000-000000000001",
        outboxEventIds: [],
        allowedActions: [],
      },
    });
    restoreWorkflow();
    restoreSession();
  });

  it("rejects browser-provided actor authority in command payloads", async () => {
    const restore = setSessionStore({
      kind: "supabase",
      create: async () => undefined,
      get: async () => ({
        id: "durable-token",
        userId: "40000000-0000-4000-8000-000000000001",
        email: "student@nilelearn.local",
        name: "Normalized Student",
        roles: ["student"],
        activeRole: "student",
        provider: "supabase",
        authorizationModel: "normalized",
        createdAt: "2026-07-22T00:00:00.000Z",
        expiresAt: "2099-07-22T12:00:00.000Z",
      }),
      delete: async () => undefined,
      clear: async () => undefined,
    });
    const { postRoutes } = captureRoutes();
    const { response, result } = responseRecorder();

    await postRoutes.get("/api/platform/commands")?.(
      request("POST", {
        type: "profile.update",
        expectedVersion: 1,
        idempotencyKey: "profile:update:forged-0001",
        payload: { name: "Forged", actorId: "another-user" },
      }),
      response
    );

    expect(result).toEqual({
      status: 400,
      body: { error: "A valid platform command is required." },
    });
    restore();
  });
});

describe("API normalized Super Admin compatibility workspace", () => {
  it("reads through the normalized repository while unsupported mutations remain blocked", async () => {
    vi.stubEnv("NILE_PLATFORM_STATE_LOCAL_ONLY", "1");
    const repository: SessionStore = {
      kind: "supabase",
      create: async () => undefined,
      get: async () => ({
        id: "durable-token",
        userId: "60000000-0000-4000-8000-000000000001",
        authUserId: "10000000-0000-4000-8000-000000000001",
        email: "admin@example.test",
        name: "Normalized Admin",
        roles: ["superadmin"],
        activeRole: "superadmin",
        activeRoleGrantId: "50000000-0000-4000-8000-000000000001",
        branchIds: [],
        departmentIds: [],
        provider: "supabase",
        authorizationModel: "normalized",
        createdAt: "2026-07-22T00:00:00.000Z",
        expiresAt: "2099-07-22T12:00:00.000Z",
      }),
      delete: async () => undefined,
      clear: async () => undefined,
    };
    const normalizedSession = await repository.get("durable-token");
    if (!normalizedSession) throw new Error("Normalized test session missing.");
    const restore = setSessionStore(repository);
    const restoreWorkflow = setNormalizedWorkflowRepository({
      readWorkspace: async () =>
        scopePlatformStateForSession(seedPlatformState, normalizedSession),
      apply: async action => {
        throw new NormalizedWorkflowUnavailableError(
          `Normalized ${action.type} persistence is not active.`
        );
      },
    });
    const { getRoutes, postRoutes } = captureRoutes();
    const read = responseRecorder();
    const write = responseRecorder();

    await getRoutes.get("/api/platform/state")?.(request("GET"), read.response);
    await postRoutes.get("/api/platform/state/actions")?.(
      request("POST", {
        type: "notification.read",
        notificationId: "notification-1",
      }),
      write.response
    );

    expect(read.result.status).toBe(200);
    expect(read.result.body).toMatchObject({
      state: { users: [], branches: [], courses: [], auditLogs: [] },
    });
    expect(write.result).toEqual({
      status: 503,
      body: {
        error: "Normalized notification.read persistence is not active.",
      },
    });
    restoreWorkflow();
    restore();
  });
});

describe("API local-only portal QA fixture", () => {
  it("reads and writes complete fixtures only behind the local QA gate", async () => {
    vi.stubEnv("NILE_PLATFORM_STATE_LOCAL_ONLY", "1");
    const sessionRepository: SessionStore = {
      kind: "memory",
      create: async () => undefined,
      get: async () => ({
        id: "durable-token",
        userId: "usr_student_demo",
        email: "s@nl.test",
        name: "Student Demo",
        roles: ["student"],
        activeRole: "student",
        provider: "demo",
        authorizationModel: "compatibility",
        createdAt: "2026-07-22T00:00:00.000Z",
        expiresAt: "2099-07-22T12:00:00.000Z",
      }),
      delete: async () => undefined,
      clear: async () => undefined,
    };
    let storedState = structuredClone(seedPlatformState);
    const restoreSession = setSessionStore(sessionRepository);
    const restorePlatform = setPlatformStateRepository({
      readSnapshot: async () => ({
        state: structuredClone(storedState),
        persistence: "local",
        syncedAt: "2026-07-22T00:00:00.000Z",
      }),
      writeSnapshot: async state => {
        storedState = structuredClone(state);
        return "local";
      },
      recordEvent: async () => undefined,
    });

    try {
      const { getRoutes, postRoutes } = captureRoutes();
      const blocked = responseRecorder();
      const read = responseRecorder();
      const write = responseRecorder();
      const changed = structuredClone(seedPlatformState);
      changed.settings.academicTerm = "QA fixture term";

      await getRoutes.get("/api/platform/state/qa-fixture")?.(
        qaFixtureRequest("GET", {}, false),
        blocked.response
      );
      await getRoutes.get("/api/platform/state/qa-fixture")?.(
        qaFixtureRequest("GET"),
        read.response
      );
      await postRoutes.get("/api/platform/state/qa-fixture")?.(
        qaFixtureRequest("POST", { state: changed }),
        write.response
      );

      expect(blocked.result.status).toBe(404);
      expect(read.result).toMatchObject({
        status: 200,
        body: { state: { users: seedPlatformState.users } },
      });
      expect(write.result).toMatchObject({
        status: 200,
        body: {
          state: { settings: { academicTerm: "QA fixture term" } },
          persistence: "local",
        },
      });
      expect(storedState.settings.academicTerm).toBe("QA fixture term");
    } finally {
      restorePlatform();
      restoreSession();
    }
  });
});

describe("API login outcome classification", () => {
  function configureSupabaseAuth() {
    vi.stubEnv("SUPABASE_URL", "https://phase2-test.supabase.co");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");
    vi.stubEnv("DEMO_AUTH_ENABLED", "false");
  }

  function loginRequest() {
    return request("POST", {
      email: "teacher@nilelearn.local",
      password: "test-password",
      role: "teacher",
    });
  }

  it("returns 403 for an authenticated account without one mapped role grant", async () => {
    configureSupabaseAuth();
    const repository: SessionStore = {
      kind: "supabase",
      create: async () => undefined,
      get: async () => null,
      delete: async () => undefined,
      clear: async () => undefined,
      resolveSupabaseIdentity: async () => null,
    };
    const restore = setSessionStore(repository);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              user: {
                id: "10000000-0000-4000-8000-000000000002",
                email: "teacher@nilelearn.local",
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
      )
    );
    const { postRoutes } = captureRoutes();
    const { response, result } = responseRecorder();

    await postRoutes.get("/api/auth/login")?.(loginRequest(), response);

    expect(result).toEqual({
      status: 403,
      body: { error: "This account is not authorized for that role." },
    });
    restore();
  });

  it("returns 403 when normalized identity resolution is ambiguous", async () => {
    configureSupabaseAuth();
    const repository: SessionStore = {
      kind: "supabase",
      create: async () => undefined,
      get: async () => null,
      delete: async () => undefined,
      clear: async () => undefined,
      resolveSupabaseIdentity: async () => {
        throw new SessionAuthorityDeniedError();
      },
    };
    const restore = setSessionStore(repository);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              user: {
                id: "10000000-0000-4000-8000-000000000002",
                email: "teacher@nilelearn.local",
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
      )
    );
    const { postRoutes } = captureRoutes();
    const { response, result } = responseRecorder();

    await postRoutes.get("/api/auth/login")?.(loginRequest(), response);

    expect(result.status).toBe(403);
    restore();
  });

  it("returns 503 for provider network failures without demo fallback", async () => {
    configureSupabaseAuth();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      })
    );
    const { postRoutes } = captureRoutes();
    const { response, result } = responseRecorder();

    await postRoutes.get("/api/auth/login")?.(loginRequest(), response);

    expect(result).toEqual({
      status: 503,
      body: { error: "Sign in is temporarily unavailable." },
    });
  });
});

describe("API normalized password recovery", () => {
  it("updates the verified Supabase user through a recovery access token", async () => {
    vi.stubEnv("SUPABASE_URL", "https://phase2-test.supabase.co");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");
    vi.stubEnv("SUPABASE_SECRET_KEY", "test-secret-key");
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "a1000000-0000-4000-8000-000000000001",
            email: "admin@example.test",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const { postRoutes } = captureRoutes();
    const { response, result } = responseRecorder();

    await postRoutes.get("/api/auth/password-reset/confirm")?.(
      request("POST", {
        accessToken: "verified-recovery-token",
        password: "Strong recovery password 2026",
      }),
      response
    );

    expect(result).toEqual({
      status: 200,
      body: { ok: true, email: "admin@example.test" },
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1]?.[1]?.method).toBe("PUT");
  });
});
