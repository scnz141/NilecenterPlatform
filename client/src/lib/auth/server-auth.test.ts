import { afterEach, describe, expect, it, vi } from "vitest";
import {
  attachSession,
  changeDemoPasswordForSession,
  confirmDemoPasswordReset,
  endRequestSession,
  getRequestSession,
  requestDemoPasswordReset,
  resetDemoPasswordResetState,
  signIn,
  type ServerSession,
  validateAuthConfiguration,
} from "../../../../server/auth";
import {
  resetDefaultSessionStore,
  SessionRepositoryUnavailableError,
  setSessionStore,
  type SessionStore,
} from "../../../../server/sessionStore";

const originalEnv = {
  NODE_ENV: process.env.NODE_ENV,
  DEMO_AUTH_ENABLED: process.env.DEMO_AUTH_ENABLED,
  VITE_DEMO_AUTH_ENABLED: process.env.VITE_DEMO_AUTH_ENABLED,
  NILE_DEMO_PASSWORD: process.env.NILE_DEMO_PASSWORD,
  SUPABASE_URL: process.env.SUPABASE_URL,
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
  VITE_SUPABASE_PUBLISHABLE_KEY: process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
};

afterEach(() => {
  if (originalEnv.NODE_ENV === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalEnv.NODE_ENV;
  }
  process.env.DEMO_AUTH_ENABLED = originalEnv.DEMO_AUTH_ENABLED;
  process.env.VITE_DEMO_AUTH_ENABLED = originalEnv.VITE_DEMO_AUTH_ENABLED;
  process.env.NILE_DEMO_PASSWORD = originalEnv.NILE_DEMO_PASSWORD;
  process.env.SUPABASE_URL = originalEnv.SUPABASE_URL;
  process.env.VITE_SUPABASE_URL = originalEnv.VITE_SUPABASE_URL;
  process.env.SUPABASE_PUBLISHABLE_KEY = originalEnv.SUPABASE_PUBLISHABLE_KEY;
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY =
    originalEnv.VITE_SUPABASE_PUBLISHABLE_KEY;
  process.env.VITE_SUPABASE_ANON_KEY = originalEnv.VITE_SUPABASE_ANON_KEY;
  resetDemoPasswordResetState();
  resetDefaultSessionStore();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("server demo auth", () => {
  function useDemoOnlyAuth() {
    delete process.env.SUPABASE_URL;
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.SUPABASE_PUBLISHABLE_KEY;
    delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.VITE_SUPABASE_ANON_KEY;
  }

  it("requires the configured Nile demo password when one is set", async () => {
    useDemoOnlyAuth();
    process.env.DEMO_AUTH_ENABLED = "true";
    process.env.NILE_DEMO_PASSWORD = "12345";

    await expect(
      signIn("s@nl.test", "wrong-password", "student")
    ).rejects.toThrow("Invalid email, password, or role.");

    const session = await signIn("s@nl.test", "12345", "student");
    expect(session.provider).toBe("demo");
    expect(session.activeRole).toBe("student");
    expect(session.userId).toBe("usr_student_demo");
  });

  it("keeps legacy demo-password behavior when no password env is configured", async () => {
    useDemoOnlyAuth();
    process.env.DEMO_AUTH_ENABLED = "true";
    delete process.env.NILE_DEMO_PASSWORD;

    const session = await signIn(
      "teacher.demo@nilelearn.local",
      "demo1234",
      "teacher"
    );
    expect(session.provider).toBe("demo");
    expect(session.activeRole).toBe("teacher");
  });

  it("keeps demo auth disabled by default in production unless explicitly enabled", async () => {
    useDemoOnlyAuth();
    process.env.NODE_ENV = "production";
    delete process.env.DEMO_AUTH_ENABLED;
    delete process.env.VITE_DEMO_AUTH_ENABLED;
    process.env.NILE_DEMO_PASSWORD = "production-demo-password";

    await expect(
      signIn("s@nl.test", "production-demo-password", "student")
    ).rejects.toThrow("Invalid email, password, or role.");

    process.env.DEMO_AUTH_ENABLED = "true";
    const session = await signIn(
      "s@nl.test",
      "production-demo-password",
      "student"
    );

    expect(session.provider).toBe("demo");
    expect(session.activeRole).toBe("student");
  });

  it("fails startup validation when production demo auth has no strong explicit password", () => {
    useDemoOnlyAuth();
    process.env.NODE_ENV = "production";
    process.env.DEMO_AUTH_ENABLED = "true";
    process.env.NILE_DEMO_PASSWORD = "short";

    expect(() => validateAuthConfiguration()).toThrow(
      "Production demo authentication requires an explicit NILE_DEMO_PASSWORD with at least 8 characters."
    );

    process.env.NILE_DEMO_PASSWORD = "production-demo-password";
    expect(() => validateAuthConfiguration()).not.toThrow();
  });

  it("resets a demo password without changing Supabase auth behavior", async () => {
    useDemoOnlyAuth();
    process.env.DEMO_AUTH_ENABLED = "true";
    process.env.NILE_DEMO_PASSWORD = "original-password";

    const request = requestDemoPasswordReset(
      "teacher.demo@nilelearn.local",
      "teacher"
    );
    expect(request.ok).toBe(true);
    expect(request.demoResetPath).toContain("/auth/reset-password?");

    const params = new URLSearchParams(request.demoResetPath!.split("?")[1]);
    const result = confirmDemoPasswordReset({
      token: params.get("token") ?? "",
      email: params.get("email") ?? "",
      password: "new-demo-password",
    });
    expect(result).toMatchObject({ ok: true, role: "teacher" });

    await expect(
      signIn("teacher.demo@nilelearn.local", "original-password", "teacher")
    ).resolves.toMatchObject({
      provider: "demo",
    });
    const session = await signIn(
      "teacher.demo@nilelearn.local",
      "new-demo-password",
      "teacher"
    );
    expect(session.provider).toBe("demo");
    expect(session.activeRole).toBe("teacher");
  });

  it("keeps reset request neutral for unknown accounts", () => {
    useDemoOnlyAuth();
    process.env.DEMO_AUTH_ENABLED = "true";

    const request = requestDemoPasswordReset("unknown@example.com", "student");

    expect(request.ok).toBe(true);
    expect(request.demoResetPath).toBeUndefined();
  });

  it("changes demo passwords only after validating current password and length", async () => {
    useDemoOnlyAuth();
    process.env.DEMO_AUTH_ENABLED = "true";
    process.env.NILE_DEMO_PASSWORD = "original-password";

    const session = await signIn(
      "teacher.demo@nilelearn.local",
      "original-password",
      "teacher"
    );

    expect(() =>
      changeDemoPasswordForSession(session, {
        currentPassword: "wrong-password",
        newPassword: "new-demo-password",
      })
    ).toThrow("Current password is incorrect.");
    expect(() =>
      changeDemoPasswordForSession(session, {
        currentPassword: "original-password",
        newPassword: "short",
      })
    ).toThrow("Use at least 8 characters.");

    expect(
      changeDemoPasswordForSession(session, {
        currentPassword: "original-password",
        newPassword: "new-demo-password",
      })
    ).toMatchObject({ ok: true, role: "teacher" });

    const nextSession = await signIn(
      "teacher.demo@nilelearn.local",
      "new-demo-password",
      "teacher"
    );
    expect(nextSession.provider).toBe("demo");
  });

  it("does not fake password changes for provider-managed sessions", () => {
    const session: ServerSession = {
      id: "sess_supabase",
      userId: "usr_teacher_demo",
      email: "teacher.demo@nilelearn.local",
      name: "Teacher Demo",
      roles: ["teacher"],
      activeRole: "teacher",
      provider: "supabase",
      createdAt: "2026-07-04T00:00:00.000Z",
      expiresAt: "2026-07-04T12:00:00.000Z",
    };

    expect(() =>
      changeDemoPasswordForSession(session, {
        currentPassword: "original-password",
        newPassword: "new-demo-password",
      })
    ).toThrow("Password changes are managed by your sign-in provider.");
  });
});

describe("server session store", () => {
  function responseRecorder() {
    const headers = new Map<string, string>();
    return {
      headers,
      response: {
        setHeader(name: string, value: string) {
          headers.set(name, value);
        },
      },
    };
  }

  function requestWithCookie(cookie?: string) {
    return { headers: { cookie } };
  }

  function testSession(overrides: Partial<ServerSession> = {}): ServerSession {
    return {
      id: "sess_test_1",
      userId: "usr_student_demo",
      email: "student.demo@nilelearn.local",
      name: "Student Demo",
      roles: ["student"],
      activeRole: "student",
      provider: "demo",
      createdAt: "2026-07-04T00:00:00.000Z",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      ...overrides,
    };
  }

  function createInspectableStore() {
    const sessions = new Map<string, ServerSession>();
    const store: SessionStore = {
      kind: "memory",
      create(session) {
        sessions.set(session.id, session);
      },
      get(sessionId) {
        return sessions.get(sessionId) ?? null;
      },
      delete(sessionId) {
        sessions.delete(sessionId);
      },
      clear() {
        sessions.clear();
      },
    };
    return { store, sessions };
  }

  it("reads request sessions through the configured server store", async () => {
    const { store } = createInspectableStore();
    const restoreStore = setSessionStore(store);
    const session = testSession();
    store.create(session);

    await expect(
      getRequestSession(requestWithCookie("nilelearn_session=sess_test_1"))
    ).resolves.toEqual(session);

    restoreStore();
  });

  it("attaches and ends sessions through the configured server store", async () => {
    const { store, sessions } = createInspectableStore();
    const restoreStore = setSessionStore(store);
    const { headers, response } = responseRecorder();
    const session = testSession();

    store.create(session);
    const body = attachSession(response, session);
    const cookie = headers.get("Set-Cookie") ?? "";

    expect(body).toMatchObject({
      userId: "usr_student_demo",
      activeRole: "student",
      provider: "demo",
    });
    expect(cookie).toContain("nilelearn_session=sess_test_1");
    expect(cookie).toContain("HttpOnly");

    await endRequestSession(
      requestWithCookie("nilelearn_session=sess_test_1"),
      response
    );

    expect(sessions.has("sess_test_1")).toBe(false);
    expect(headers.get("Set-Cookie")).toContain("Max-Age=0");

    restoreStore();
  });

  it("sets production cookies with secure HttpOnly session attributes", async () => {
    process.env.NODE_ENV = "production";
    vi.spyOn(Date, "now").mockReturnValue(
      Date.parse("2026-07-04T00:00:00.000Z")
    );
    const { headers, response } = responseRecorder();

    attachSession(
      response,
      testSession({ expiresAt: "2026-07-04T12:00:00.000Z" })
    );
    const cookie = headers.get("Set-Cookie") ?? "";

    expect(cookie).toContain("nilelearn_session=sess_test_1");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=43200");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Secure");

    await endRequestSession(
      requestWithCookie("nilelearn_session=sess_test_1"),
      response
    );

    expect(headers.get("Set-Cookie")).toContain("Max-Age=0");
    expect(headers.get("Set-Cookie")).toContain("Secure");
  });

  it("caps cookie lifetime at the normal session TTL", () => {
    vi.spyOn(Date, "now").mockReturnValue(
      Date.parse("2026-07-04T00:00:00.000Z")
    );
    const { headers, response } = responseRecorder();

    attachSession(
      response,
      testSession({ expiresAt: "2026-07-05T00:00:00.000Z" })
    );

    expect(headers.get("Set-Cookie")).toContain("; Max-Age=43200;");
  });

  it.each([
    ["expired", "2026-07-03T23:59:59.999Z"],
    ["invalid", "not-a-session-expiry"],
  ])("expires the cookie for %s persisted timing", (_label, expiresAt) => {
    vi.spyOn(Date, "now").mockReturnValue(
      Date.parse("2026-07-04T00:00:00.000Z")
    );
    const { headers, response } = responseRecorder();

    attachSession(response, testSession({ expiresAt }));

    expect(headers.get("Set-Cookie")).toContain("; Max-Age=0;");
  });

  it("keeps local development cookies non-secure for localhost testing", () => {
    process.env.NODE_ENV = "test";
    const { headers, response } = responseRecorder();

    attachSession(response, testSession());

    expect(headers.get("Set-Cookie")).toContain("HttpOnly");
    expect(headers.get("Set-Cookie")).toContain("SameSite=Lax");
    expect(headers.get("Set-Cookie")).not.toContain("Secure");
  });

  it("deletes expired sessions from the configured server store", async () => {
    const { store, sessions } = createInspectableStore();
    const restoreStore = setSessionStore(store);
    const session = testSession({ expiresAt: "2000-01-01T00:00:00.000Z" });
    store.create(session);

    await expect(
      getRequestSession(requestWithCookie("nilelearn_session=sess_test_1"))
    ).resolves.toBeNull();
    expect(sessions.has("sess_test_1")).toBe(false);

    restoreStore();
  });

  it("retains the browser cookie when durable revocation is unavailable", async () => {
    const store: SessionStore = {
      kind: "supabase",
      create: async () => undefined,
      get: async () => null,
      delete: async () => {
        throw new SessionRepositoryUnavailableError();
      },
      clear: async () => undefined,
    };
    const restoreStore = setSessionStore(store);
    const { headers, response } = responseRecorder();

    await expect(
      endRequestSession(
        requestWithCookie("nilelearn_session=sess_test_1"),
        response
      )
    ).rejects.toBeInstanceOf(SessionRepositoryUnavailableError);
    expect(headers.has("Set-Cookie")).toBe(false);

    restoreStore();
  });
});

describe("server durable session authority", () => {
  it("uses a role-grant-clipped durable expiry for the session cookie", async () => {
    const now = Date.parse("2026-07-04T00:00:00.000Z");
    vi.spyOn(Date, "now").mockReturnValue(now);
    process.env.SUPABASE_URL = "https://phase1-test.supabase.co";
    process.env.SUPABASE_PUBLISHABLE_KEY = "test-only-publishable-key";
    const repository: SessionStore = {
      kind: "supabase",
      create: async () => ({
        createdAt: "2026-07-04T00:00:00.000Z",
        expiresAt: "2026-07-04T00:02:00.999Z",
      }),
      get: async () => null,
      delete: async () => undefined,
      clear: async () => undefined,
      resolveSupabaseIdentity: async () => ({
        userId: "40000000-0000-4000-8000-000000000002",
        authUserId: "10000000-0000-4000-8000-000000000002",
        email: "teacher@nilelearn.local",
        name: "Local Teacher",
        activeRole: "teacher",
        activeRoleGrantId: "50000000-0000-4000-8000-000000000002",
        branchIds: ["20000000-0000-4000-8000-000000000001"],
        departmentIds: ["30000000-0000-4000-8000-000000000001"],
      }),
    };
    const restoreStore = setSessionStore(repository);
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
    const { headers, response } = (() => {
      const values = new Map<string, string>();
      return {
        headers: values,
        response: {
          setHeader(name: string, value: string) {
            values.set(name, value);
          },
        },
      };
    })();

    const session = await signIn(
      "teacher@nilelearn.local",
      "test-password",
      "teacher"
    );
    attachSession(response, session);

    expect(session.expiresAt).toBe("2026-07-04T00:02:00.999Z");
    expect(headers.get("Set-Cookie")).toContain("; Max-Age=120;");

    restoreStore();
  });

  it("uses normalized identity and one role grant instead of Auth metadata", async () => {
    process.env.SUPABASE_URL = "https://phase1-test.supabase.co";
    process.env.SUPABASE_PUBLISHABLE_KEY = "test-only-publishable-key";
    const create = vi.fn();
    const resolveSupabaseIdentity = vi.fn(async () => ({
      userId: "40000000-0000-4000-8000-000000000002",
      authUserId: "10000000-0000-4000-8000-000000000002",
      email: "teacher@nilelearn.local",
      name: "Local Teacher",
      activeRole: "teacher" as const,
      activeRoleGrantId: "50000000-0000-4000-8000-000000000002",
      branchIds: ["20000000-0000-4000-8000-000000000001"],
      departmentIds: ["30000000-0000-4000-8000-000000000001"],
    }));
    const repository: SessionStore = {
      kind: "supabase",
      create,
      get: async () => null,
      delete: async () => undefined,
      clear: async () => undefined,
      resolveSupabaseIdentity,
    };
    const restoreStore = setSessionStore(repository);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              user: {
                id: "10000000-0000-4000-8000-000000000002",
                email: "provider-email@nilelearn.local",
                app_metadata: { role: "student" },
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
      )
    );

    const session = await signIn(
      "teacher@nilelearn.local",
      "test-password",
      "teacher"
    );

    expect(resolveSupabaseIdentity).toHaveBeenCalledWith(
      "10000000-0000-4000-8000-000000000002",
      "teacher"
    );
    expect(session).toMatchObject({
      userId: "40000000-0000-4000-8000-000000000002",
      activeRole: "teacher",
      roles: ["teacher"],
      activeRoleGrantId: "50000000-0000-4000-8000-000000000002",
      branchIds: ["20000000-0000-4000-8000-000000000001"],
      departmentIds: ["30000000-0000-4000-8000-000000000001"],
      provider: "supabase",
      authorizationModel: "normalized",
    });
    expect(create).toHaveBeenCalledWith(session);

    restoreStore();
  });

  it("keeps Supabase Auth snapshot-compatible when the memory repository is selected", async () => {
    process.env.SUPABASE_URL = "https://phase1-test.supabase.co";
    process.env.SUPABASE_PUBLISHABLE_KEY = "test-only-publishable-key";
    const create = vi.fn();
    const repository: SessionStore = {
      kind: "memory",
      create,
      get: async () => null,
      delete: async () => undefined,
      clear: async () => undefined,
    };
    const restoreStore = setSessionStore(repository);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              user: {
                id: "10000000-0000-4000-8000-000000000002",
                email: "teacher@nilelearn.local",
                app_metadata: {
                  role: "teacher",
                  demo_user_id: "usr_teacher_demo",
                },
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
      )
    );

    const session = await signIn(
      "teacher@nilelearn.local",
      "test-password",
      "teacher"
    );

    expect(session).toMatchObject({
      userId: "usr_teacher_demo",
      provider: "supabase",
      authorizationModel: "snapshot",
    });
    expect(create).toHaveBeenCalledWith(session);

    restoreStore();
  });
});
