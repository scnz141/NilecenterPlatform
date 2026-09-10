import { describe, expect, it, vi } from "vitest";

import {
  createEmsStagingClient,
  extractTokens,
  mapEmsRoleToLocal,
  mapLocalRoleToEms,
  normalizeEmsMe,
  resolveEmsStagingConfig,
  translateEmsError,
} from "../../../../server/emsStagingClient";
import {
  EMS_SESSION_COOKIE_NAME,
  EmsSessionConfigurationError,
  EmsSessionInvalidError,
  openEmsSession,
  sealEmsSession,
} from "../../../../server/emsSessionEnvelope";
import { registerEmsStagingRoutes } from "../../../../server/emsStagingRoutes";

const sealKey = "test-only-ems-session-seal-key-32-characters";
const accessExpiresAt = "2099-01-01T00:15:00Z";
const refreshExpiresAt = "2099-02-01T00:00:00Z";

function authPayload(accessToken = "access-1", refreshToken = "refresh-1") {
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    access_token_expires_at: accessExpiresAt,
    refresh_token_expires_at: refreshExpiresAt,
    session_id: "ems-session-1",
  };
}

function mePayload() {
  return {
    session_id: "ems-session-1",
    user: {
      id: "ems-user-1",
      email: "admin@example.test",
      profile: { first_name: "NCC", last_name: "Admin" },
      departments: null,
    },
    assigned_role: "super_admin",
    active_role: "super_admin",
    workspace_branch_id: null,
    scopes: [{ scope_type: "global", scope_id: null, is_live: true }],
  };
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("EMS staging config", () => {
  it("returns null when no base URL is configured", () => {
    expect(resolveEmsStagingConfig({})).toBeNull();
    expect(resolveEmsStagingConfig({ EMS_STAGING_BASE_URL: "   " })).toBeNull();
  });

  it("trims trailing slashes and clamps the timeout", () => {
    expect(
      resolveEmsStagingConfig({
        EMS_STAGING_BASE_URL: "https://staging.example/api///",
        EMS_STAGING_ALLOWED_HOSTS: "staging.example",
      })
    ).toEqual({
      baseUrl: "https://staging.example/api",
      timeoutMs: 15000,
    });
    expect(
      resolveEmsStagingConfig({
        EMS_STAGING_BASE_URL: "https://staging.example/api",
        EMS_STAGING_ALLOWED_HOSTS: "staging.example",
        EMS_STAGING_TIMEOUT_MS: "999999",
      })?.timeoutMs
    ).toBe(60000);
  });

  it("rejects non-HTTPS and non-allowlisted upstreams", () => {
    expect(
      resolveEmsStagingConfig({
        EMS_STAGING_BASE_URL: "http://staging.example/api",
        EMS_STAGING_ALLOWED_HOSTS: "staging.example",
      })
    ).toBeNull();
    expect(
      resolveEmsStagingConfig({
        EMS_STAGING_BASE_URL: "https://other.example/api",
        EMS_STAGING_ALLOWED_HOSTS: "staging.example",
      })
    ).toBeNull();
  });
});

describe("EMS staging role mapping", () => {
  it("maps EMS roles to local roles and back", () => {
    expect(mapEmsRoleToLocal("super_admin")).toBe("superadmin");
    expect(mapEmsRoleToLocal("branch_admin")).toBe("branchadmin");
    expect(mapEmsRoleToLocal("hod")).toBe("headofdepartment");
    expect(mapEmsRoleToLocal("registrar")).toBe("registrar");
    expect(mapEmsRoleToLocal("teacher")).toBe("teacher");
    expect(mapEmsRoleToLocal("student")).toBeNull();
    expect(mapLocalRoleToEms("superadmin")).toBe("super_admin");
    expect(mapLocalRoleToEms("headofdepartment")).toBe("hod");
    expect(mapLocalRoleToEms("student")).toBeNull();
  });
});

describe("EMS staging error translation", () => {
  it("passes string details through", () => {
    expect(translateEmsError(400, { detail: "Course not found" })).toEqual({
      error: "Course not found",
    });
  });

  it("summarizes 422 validation arrays with the field name", () => {
    expect(
      translateEmsError(422, {
        detail: [
          { loc: ["body", "capacity"], msg: "Input should be >= 1", type: "x" },
        ],
      })
    ).toEqual({
      error: "Validation failed: capacity Input should be >= 1",
      details: [
        { loc: ["body", "capacity"], msg: "Input should be >= 1", type: "x" },
      ],
    });
  });

  it("falls back for unknown shapes", () => {
    expect(translateEmsError(500, null)).toEqual({
      error: "Request failed with 500",
    });
    expect(translateEmsError(502, "<html>bad gateway</html>")).toEqual({
      error: "Request failed with 502",
    });
  });
});

describe("EMS staging payload guards", () => {
  it("extracts complete token pairs with their server expiries", () => {
    expect(extractTokens(authPayload())).toEqual({
      accessToken: "access-1",
      refreshToken: "refresh-1",
      accessTokenExpiresAt: accessExpiresAt,
      refreshTokenExpiresAt: refreshExpiresAt,
      sessionId: "ems-session-1",
    });
    expect(
      extractTokens({ access_token: "access-1", refresh_token: "refresh-1" })
    ).toBeNull();
    expect(extractTokens(null)).toBeNull();
  });

  it("normalizes me snapshots and rejects unknown roles", () => {
    expect(normalizeEmsMe(mePayload())).toEqual({
      sessionId: "ems-session-1",
      userId: "ems-user-1",
      email: "admin@example.test",
      name: "NCC Admin",
      assignedRole: "super_admin",
      activeRole: "super_admin",
      workspaceBranchId: null,
      departmentIds: [],
      scopes: [{ scopeType: "global", scopeId: null, isLive: true }],
    });
    expect(
      normalizeEmsMe({ assigned_role: "student", active_role: "student" })
    ).toBeNull();
  });
});

describe("EMS session envelope", () => {
  const payload = {
    ownerSessionId: "nile-session-1",
    accessToken: "access-1",
    refreshToken: "refresh-1",
    accessTokenExpiresAt: accessExpiresAt,
    refreshTokenExpiresAt: refreshExpiresAt,
    sessionId: "ems-session-1",
  };

  it("round-trips tokens without exposing them in plaintext", () => {
    const envelope = sealEmsSession(payload, { EMS_SESSION_SEAL_KEY: sealKey });
    expect(envelope).not.toContain(payload.accessToken);
    expect(envelope).not.toContain(payload.refreshToken);
    expect(openEmsSession(envelope, { EMS_SESSION_SEAL_KEY: sealKey })).toEqual(
      payload
    );
  });

  it("rejects missing configuration and tampering", () => {
    expect(() => sealEmsSession(payload, {})).toThrow(
      EmsSessionConfigurationError
    );
    const envelope = sealEmsSession(payload, { EMS_SESSION_SEAL_KEY: sealKey });
    const tamperAt = Math.floor(envelope.length / 2);
    const replacement = envelope[tamperAt] === "A" ? "B" : "A";
    const tampered = `${envelope.slice(0, tamperAt)}${replacement}${envelope.slice(tamperAt + 1)}`;
    expect(() =>
      openEmsSession(tampered, {
        EMS_SESSION_SEAL_KEY: sealKey,
      })
    ).toThrow(EmsSessionInvalidError);
  });
});

describe("EMS staging client requests", () => {
  it("sends a browser-like UA and JSON bodies", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { pong: true }));
    const client = createEmsStagingClient({
      baseUrl: "https://staging.example/api",
      fetchImpl,
    });
    const result = await client.ping();
    expect(result.ok).toBe(true);
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["User-Agent"]).toContain(
      "Mozilla"
    );
    expect(init.redirect).toBe("error");
  });

  it("sends remote logout with the bearer token", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const client = createEmsStagingClient({
      baseUrl: "https://staging.example/api",
      fetchImpl,
    });
    const result = await client.logout("access-1");
    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://staging.example/api/auth/logout",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer access-1" }),
      })
    );
  });
});

type Handler = (
  request: {
    headers: { cookie?: string };
    body?: Record<string, unknown>;
    get(name: string): string | undefined;
  },
  response: {
    status(code: number): unknown;
    json(body: unknown): void;
    setHeader(name: string, value: string): void;
  }
) => void | Promise<void>;

function testSession(id = "nile-session-1", activeRole = "superadmin") {
  return {
    id,
    activeRole,
    expiresAt: "2099-01-15T00:00:00Z",
  };
}

function request(
  options: {
    body?: Record<string, unknown>;
    cookie?: string;
  } = {}
) {
  return {
    headers: options.cookie ? { cookie: options.cookie } : {},
    body: options.body,
    get: () => undefined,
  };
}

function harness(options: {
  session?: ReturnType<typeof testSession> | null;
  env?: NodeJS.ProcessEnv;
  client?: Record<string, unknown>;
}) {
  const routes = new Map<string, Handler>();
  const app = {
    get(path: string, handler: Handler) {
      routes.set(`GET ${path}`, handler);
    },
    post(path: string, handler: Handler) {
      routes.set(`POST ${path}`, handler);
    },
  };
  const statuses: number[] = [];
  const bodies: unknown[] = [];
  const headers = new Map<string, string>();
  const response = () => {
    const target = {
      status(code: number) {
        statuses.push(code);
        return target;
      },
      json(body: unknown) {
        bodies.push(body);
      },
      setHeader(name: string, value: string) {
        headers.set(name, value);
      },
    };
    return target;
  };
  registerEmsStagingRoutes(app, {
    env: options.env ?? {
      EMS_STAGING_BASE_URL: "https://staging.example/api",
      EMS_STAGING_ALLOWED_HOSTS: "staging.example",
      EMS_SESSION_SEAL_KEY: sealKey,
      NODE_ENV: "test",
    },
    getSession: async () => options.session ?? null,
    createClient:
      options.client === undefined ? undefined : () => options.client as never,
  });
  return { routes, statuses, bodies, headers, response };
}

function cookieFrom(headers: Map<string, string>) {
  return headers.get("Set-Cookie")?.split(";")[0] ?? "";
}

describe("EMS staging routes", () => {
  it("requires sign-in for status", async () => {
    const { routes, statuses, response } = harness({ session: null });
    await routes.get("GET /api/ems-staging/status")!(
      request(),
      response() as never
    );
    expect(statuses).toEqual([401]);
  });

  it("requires Super Admin for the link route", async () => {
    const { routes, statuses, response } = harness({
      session: testSession("nile-session-1", "teacher"),
    });
    await routes.get("POST /api/ems-staging/session")!(
      request({ body: { email: "a@b.c", password: "x" } }),
      response() as never
    );
    expect(statuses).toEqual([403]);
  });

  it("reports transport and session configuration without network access", async () => {
    const { routes, bodies, response } = harness({
      session: testSession(),
      env: { EMS_SESSION_SEAL_KEY: sealKey },
    });
    await routes.get("GET /api/ems-staging/status")!(
      request(),
      response() as never
    );
    expect(bodies).toEqual([
      {
        configured: false,
        reachable: false,
        linked: false,
        sessionProtectionConfigured: true,
      },
    ]);
  });

  it("refuses login before session protection is configured", async () => {
    const login = vi.fn();
    const { routes, statuses, bodies, response } = harness({
      session: testSession(),
      env: {
        EMS_STAGING_BASE_URL: "https://staging.example/api",
        EMS_STAGING_ALLOWED_HOSTS: "staging.example",
      },
      client: { login },
    });
    await routes.get("POST /api/ems-staging/session")!(
      request({ body: { email: "lead@example.com", password: "secret" } }),
      response() as never
    );
    expect(statuses).toEqual([503]);
    expect(bodies).toEqual([
      { error: "NCC EMS session protection is not configured." },
    ]);
    expect(login).not.toHaveBeenCalled();
  });

  it("seals the token pair in an HttpOnly cookie and returns only the me view", async () => {
    const login = vi.fn(async () => ({ ok: true, data: authPayload() }));
    const me = vi.fn(async () => ({ ok: true, data: mePayload() }));
    const logout = vi.fn(async () => ({ ok: true, data: null }));
    const { routes, statuses, bodies, headers, response } = harness({
      session: testSession(),
      client: { login, me, logout },
    });
    await routes.get("POST /api/ems-staging/session")!(
      request({ body: { email: "lead@example.com", password: "secret" } }),
      response() as never
    );
    const cookie = headers.get("Set-Cookie") ?? "";
    expect(statuses).toEqual([]);
    expect(bodies).toEqual([
      {
        assignedRole: "superadmin",
        activeRole: "superadmin",
        workspaceBranchId: null,
        scopes: [{ scopeType: "global", scopeId: null, isLive: true }],
      },
    ]);
    expect(cookie).toContain(`${EMS_SESSION_COOKIE_NAME}=`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).not.toContain("access-1");
    expect(cookie).not.toContain("refresh-1");
    expect(headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("sets Secure on the sealed production cookie", async () => {
    const { routes, headers, response } = harness({
      session: testSession(),
      env: {
        EMS_STAGING_BASE_URL: "https://staging.example/api",
        EMS_STAGING_ALLOWED_HOSTS: "staging.example",
        EMS_SESSION_SEAL_KEY: sealKey,
        NODE_ENV: "production",
      },
      client: {
        login: async () => ({ ok: true, data: authPayload() }),
        me: async () => ({ ok: true, data: mePayload() }),
      },
    });
    await routes.get("POST /api/ems-staging/session")!(
      request({ body: { email: "lead@example.com", password: "secret" } }),
      response() as never
    );
    expect(headers.get("Set-Cookie")).toContain("; Secure");
  });

  it("verifies a sealed session across route instances", async () => {
    const loginHarness = harness({
      session: testSession(),
      client: {
        login: async () => ({ ok: true, data: authPayload() }),
        me: async () => ({ ok: true, data: mePayload() }),
        logout: async () => ({ ok: true, data: null }),
      },
    });
    await loginHarness.routes.get("POST /api/ems-staging/session")!(
      request({ body: { email: "lead@example.com", password: "secret" } }),
      loginHarness.response() as never
    );

    const statusHarness = harness({
      session: testSession(),
      client: {
        ping: async () => ({ ok: true, data: { pong: true } }),
        me: async () => ({ ok: true, data: mePayload() }),
      },
    });
    await statusHarness.routes.get("GET /api/ems-staging/status")!(
      request({ cookie: cookieFrom(loginHarness.headers) }),
      statusHarness.response() as never
    );
    expect(statusHarness.bodies).toEqual([
      {
        configured: true,
        reachable: true,
        linked: true,
        sessionProtectionConfigured: true,
      },
    ]);
  });

  it("rejects a sealed EMS session owned by another Nile session", async () => {
    const envelope = sealEmsSession(
      {
        ownerSessionId: "other-session",
        accessToken: "access-1",
        refreshToken: "refresh-1",
        accessTokenExpiresAt: accessExpiresAt,
        refreshTokenExpiresAt: refreshExpiresAt,
        sessionId: "ems-session-1",
      },
      { EMS_SESSION_SEAL_KEY: sealKey }
    );
    const { routes, bodies, headers, response } = harness({
      session: testSession(),
      client: { ping: async () => ({ ok: true, data: { pong: true } }) },
    });
    await routes.get("GET /api/ems-staging/status")!(
      request({ cookie: `${EMS_SESSION_COOKIE_NAME}=${envelope}` }),
      response() as never
    );
    expect(bodies).toEqual([
      {
        configured: true,
        reachable: true,
        linked: false,
        sessionProtectionConfigured: true,
      },
    ]);
    expect(headers.get("Set-Cookie")).toContain("Max-Age=0");
  });

  it("rotates the sealed token pair after a 401 and retries once", async () => {
    const oldEnvelope = sealEmsSession(
      {
        ownerSessionId: "nile-session-1",
        accessToken: "access-old",
        refreshToken: "refresh-old",
        accessTokenExpiresAt: accessExpiresAt,
        refreshTokenExpiresAt: refreshExpiresAt,
        sessionId: "ems-session-1",
      },
      { EMS_SESSION_SEAL_KEY: sealKey }
    );
    const me = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        error: { error: "Not authenticated", status: 401 },
      })
      .mockResolvedValueOnce({ ok: true, data: mePayload() });
    const refresh = vi.fn(async () => ({
      ok: true,
      data: authPayload("access-new", "refresh-new"),
    }));
    const { routes, bodies, headers, response } = harness({
      session: testSession(),
      client: {
        ping: async () => ({ ok: true, data: { pong: true } }),
        me,
        refresh,
      },
    });
    await routes.get("GET /api/ems-staging/status")!(
      request({ cookie: `${EMS_SESSION_COOKIE_NAME}=${oldEnvelope}` }),
      response() as never
    );
    expect(bodies).toEqual([
      {
        configured: true,
        reachable: true,
        linked: true,
        sessionProtectionConfigured: true,
      },
    ]);
    expect(refresh).toHaveBeenCalledWith("refresh-old");
    expect(me).toHaveBeenNthCalledWith(1, "access-old");
    expect(me).toHaveBeenNthCalledWith(2, "access-new");
    const sealed = decodeURIComponent(cookieFrom(headers).split("=")[1]);
    expect(
      openEmsSession(sealed, { EMS_SESSION_SEAL_KEY: sealKey })
    ).toMatchObject({ accessToken: "access-new", refreshToken: "refresh-new" });
  });

  it("revokes the remote session and clears the local cookie", async () => {
    const envelope = sealEmsSession(
      {
        ownerSessionId: "nile-session-1",
        accessToken: "access-1",
        refreshToken: "refresh-1",
        accessTokenExpiresAt: accessExpiresAt,
        refreshTokenExpiresAt: refreshExpiresAt,
        sessionId: "ems-session-1",
      },
      { EMS_SESSION_SEAL_KEY: sealKey }
    );
    const logout = vi.fn(async () => ({ ok: true, data: null }));
    const { routes, bodies, headers, response } = harness({
      session: testSession(),
      client: { logout },
    });
    await routes.get("POST /api/ems-staging/logout")!(
      request({ cookie: `${EMS_SESSION_COOKIE_NAME}=${envelope}` }),
      response() as never
    );
    expect(logout).toHaveBeenCalledWith("access-1");
    expect(headers.get("Set-Cookie")).toContain("Max-Age=0");
    expect(bodies).toEqual([{ ok: true }]);
  });
});
