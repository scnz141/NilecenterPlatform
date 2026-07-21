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
