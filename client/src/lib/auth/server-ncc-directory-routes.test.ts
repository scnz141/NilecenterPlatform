import { describe, expect, it, vi } from "vitest";

import { loginNccStaff } from "../../../../server/nccAuthSession";
import { registerNccDirectoryRoutes } from "../../../../server/nccDirectoryRoutes";

const sealKey = "test-only-ncc-auth-session-key-32-characters";
const accessExpiresAt = "2099-01-01T00:15:00Z";
const refreshExpiresAt = "2099-02-01T00:00:00Z";

type RouteHandler = (request: Request, response: Response) => Promise<void> | void;
type Request = {
  headers: { cookie?: string };
  params?: Record<string, string>;
};
type Response = {
  setHeader(name: string, value: string | string[]): void;
  status(code: number): Response;
  json(body: unknown): void;
};

function env(overrides: NodeJS.ProcessEnv = {}) {
  return {
    NILE_NCC_STAFF_AUTH_ENABLED: "1",
    NILE_NCC_DIRECTORY_READS_ENABLED: "1",
    EMS_STAGING_BASE_URL: "https://staging.example/api",
    EMS_STAGING_ALLOWED_HOSTS: "staging.example",
    EMS_SESSION_SEAL_KEY: sealKey,
    NODE_ENV: "test",
    ...overrides,
  };
}

function tokens(sessionId = "ncc-session-1") {
  return {
    access_token: `access-${sessionId}`,
    refresh_token: `refresh-${sessionId}`,
    access_token_expires_at: accessExpiresAt,
    refresh_token_expires_at: refreshExpiresAt,
    session_id: sessionId,
  };
}

function me(sessionId = "ncc-session-1") {
  return {
    session_id: sessionId,
    user: {
      id: "ncc-user-1",
      email: "staff@example.test",
      profile: { first_name: "NCC", last_name: "Staff" },
      departments: null,
    },
    assigned_role: "super_admin",
    active_role: "super_admin",
    workspace_branch_id: null,
    scopes: [{ scope_type: "global", scope_id: null, is_live: true }],
  };
}

function staffUser(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: "staff-user-1",
    email: "admin@example.test",
    assigned_role: "super_admin",
    status: "active",
    is_active: true,
    moodle_user_id: 42,
    last_login_at: "2026-09-12T10:00:00Z",
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-12T10:00:00Z",
    profile: {
      first_name: "NCC",
      last_name: "Admin",
      phone: null,
      custom_fields: { private: true },
    },
    scopes: [{ scope_type: "global", scope_id: null, is_live: true }],
    departments: [
      {
        department_id: "department-1",
        name: "Academic",
        status: "active",
      },
    ],
    custom_fields: { private: true },
    ...overrides,
  };
}

function captureRoutes(options: {
  env: NodeJS.ProcessEnv;
  api: Record<string, unknown>;
}) {
  const routes = new Map<string, RouteHandler>();
  const app = {
    get(path: string, handler: RouteHandler) {
      routes.set(path, handler);
    },
  };
  registerNccDirectoryRoutes(app, {
    env: options.env,
    createClient: () => options.api as never,
  });
  return routes;
}

function responseRecorder() {
  const headers = new Map<string, string | string[]>();
  const result: { status: number; body?: unknown } = { status: 200 };
  const response: Response = {
    setHeader(name, value) {
      headers.set(name, value);
    },
    status(code) {
      result.status = code;
      return response;
    },
    json(body) {
      result.body = body;
    },
  };
  return { headers, result, response };
}

function request(cookie = "", params?: Record<string, string>): Request {
  return { headers: cookie ? { cookie } : {}, params };
}

function sessionCookie(headers: Map<string, string | string[]>) {
  const value = headers.get("Set-Cookie");
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return (
    values
      .find(item => item.startsWith("nilelearn_ncc_session="))
      ?.split(";")[0] ?? ""
  );
}

async function login() {
  const { headers, response } = responseRecorder();
  const api = {
    login: vi.fn(async () => ({ ok: true, data: tokens() })),
    me: vi.fn(async () => ({ ok: true, data: me() })),
    logout: vi.fn(async () => ({ ok: true, data: null })),
  };
  await loginNccStaff("staff@example.test", "password", response, {
    env: env(),
    createClient: () => api as never,
  });
  return sessionCookie(headers);
}

describe("NCC directory routes", () => {
  it("returns 503 while the directory flag is off", async () => {
    const routes = captureRoutes({
      env: env({ NILE_NCC_DIRECTORY_READS_ENABLED: "0" }),
      api: {},
    });
    const { response, result } = responseRecorder();

    await routes.get("/api/ncc/directory/users")?.(request(), response);

    expect(result).toEqual({
      status: 503,
      body: { error: "NCC directory reads are not active." },
    });
  });

  it("returns 404 without an NCC session cookie", async () => {
    const routes = captureRoutes({ env: env(), api: {} });
    const { response, result } = responseRecorder();

    await routes.get("/api/ncc/directory/users")?.(request(), response);

    expect(result).toEqual({
      status: 404,
      body: { error: "EMS directory is unavailable for this session." },
    });
  });

  it("translates the scoped users list without leaking unknown fields", async () => {
    const cookie = await login();
    const users = vi.fn(async () => ({
      ok: true,
      data: [
        staffUser(),
        staffUser({
          id: "staff-user-2",
          email: "teacher@example.test",
          assigned_role: "teacher",
          moodle_user_id: null,
          last_login_at: null,
          profile: {
            first_name: "NCC",
            last_name: "Teacher",
            phone: "+20 100",
          },
          scopes: [
            { scope_type: "branch", scope_id: "branch-1", is_live: true },
          ],
          departments: null,
        }),
      ],
    }));
    const routes = captureRoutes({ env: env(), api: { users } });
    const { headers, response, result } = responseRecorder();

    await routes.get("/api/ncc/directory/users")?.(request(cookie), response);

    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      items: [
        expect.objectContaining({
          id: "staff-user-1",
          role: "superadmin",
          scopeType: "global",
          branchIds: [],
        }),
        expect.objectContaining({
          id: "staff-user-2",
          role: "teacher",
          scopeType: "branch",
          branchIds: ["branch-1"],
          departments: [],
        }),
      ],
    });
    expect(JSON.stringify(result.body)).not.toMatch(
      /access_token|refresh_token|custom_fields/
    );
    expect(headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("accepts users whose optional directory fields are omitted", async () => {
    const cookie = await login();
    const user = staffUser({ id: "staff-user-optional" });
    delete user.departments;
    delete user.moodle_user_id;
    delete user.last_login_at;
    const routes = captureRoutes({
      env: env(),
      api: {
        users: vi.fn(async () => ({ ok: true, data: [user] })),
      },
    });
    const { response, result } = responseRecorder();

    await routes.get("/api/ncc/directory/users")?.(request(cookie), response);

    expect(result).toMatchObject({
      status: 200,
      body: {
        items: [
          {
            id: "staff-user-optional",
            departments: [],
            moodleLinked: false,
            lastLoginAt: null,
          },
        ],
      },
    });
  });

  it("passes through upstream directory denials", async () => {
    const cookie = await login();
    const routes = captureRoutes({
      env: env(),
      api: {
        users: vi.fn(async () => ({
          ok: false,
          error: { error: "Forbidden", status: 403 },
        })),
      },
    });
    const { response, result } = responseRecorder();

    await routes.get("/api/ncc/directory/users")?.(request(cookie), response);

    expect(result).toEqual({ status: 403, body: { error: "Forbidden" } });
  });

  it("rejects staff directory rows with unsupported roles", async () => {
    const cookie = await login();
    const routes = captureRoutes({
      env: env(),
      api: {
        users: vi.fn(async () => ({
          ok: true,
          data: [staffUser({ assigned_role: "student" })],
        })),
      },
    });
    const { response, result } = responseRecorder();

    await routes.get("/api/ncc/directory/users")?.(request(cookie), response);

    expect(result).toEqual({
      status: 502,
      body: { error: "NCC EMS returned invalid directory data." },
    });
  });

  it("rejects malformed staff scope activity flags", async () => {
    const cookie = await login();
    const routes = captureRoutes({
      env: env(),
      api: {
        users: vi.fn(async () => ({
          ok: true,
          data: [
            staffUser({
              scopes: [
                {
                  scope_type: "branch",
                  scope_id: "branch-1",
                  is_live: "false",
                },
              ],
            }),
          ],
        })),
      },
    });
    const { response, result } = responseRecorder();

    await routes.get("/api/ncc/directory/users")?.(request(cookie), response);

    expect(result.status).toBe(502);
  });

  it("refreshes once and rotates the sealed session cookie", async () => {
    const cookie = await login();
    const users = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        error: { error: "Not authenticated", status: 401 },
      })
      .mockResolvedValueOnce({ ok: true, data: [staffUser()] });
    const refresh = vi.fn(async () => ({
      ok: true,
      data: tokens("ncc-session-2"),
    }));
    const meRequest = vi.fn(async () => ({
      ok: true,
      data: me("ncc-session-2"),
    }));
    const routes = captureRoutes({
      env: env(),
      api: { users, refresh, me: meRequest },
    });
    const { headers, response, result } = responseRecorder();

    await routes.get("/api/ncc/directory/users")?.(request(cookie), response);

    expect(result.status).toBe(200);
    expect(refresh).toHaveBeenCalledWith("refresh-ncc-session-1");
    expect(users).toHaveBeenNthCalledWith(1, "access-ncc-session-1");
    expect(users).toHaveBeenNthCalledWith(2, "access-ncc-session-2");
    expect(meRequest).toHaveBeenCalledWith("access-ncc-session-2");
    expect(sessionCookie(headers)).toBeTruthy();
  });

  it("returns one normalized user and passes through a missing user", async () => {
    const cookie = await login();
    const user = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, data: staffUser() })
      .mockResolvedValueOnce({
        ok: false,
        error: { error: "User not found", status: 404 },
      });
    const routes = captureRoutes({ env: env(), api: { user } });
    const found = responseRecorder();
    const missing = responseRecorder();

    await routes.get("/api/ncc/directory/users/:userId")?.(
      request(cookie, { userId: "staff-user-1" }),
      found.response
    );
    await routes.get("/api/ncc/directory/users/:userId")?.(
      request(cookie, { userId: "missing" }),
      missing.response
    );

    expect(found.result).toMatchObject({
      status: 200,
      body: { user: { id: "staff-user-1", role: "superadmin" } },
    });
    expect(user).toHaveBeenNthCalledWith(
      1,
      "access-ncc-session-1",
      "staff-user-1"
    );
    expect(missing.result).toEqual({
      status: 404,
      body: { error: "User not found" },
    });
  });

  it("returns all branch statuses and normalized departments", async () => {
    const cookie = await login();
    const routes = captureRoutes({
      env: env(),
      api: {
        branches: vi.fn(async () => ({
          ok: true,
          data: [
            {
              id: "branch-1",
              name: "Cairo",
              status: "active",
              timezone: "Africa/Cairo",
            },
            {
              id: "branch-2",
              name: "Closed",
              status: "disabled",
              timezone: "UTC",
            },
          ],
        })),
        departments: vi.fn(async () => ({
          ok: true,
          data: [
            {
              id: "department-1",
              name: "Academic",
              code: "ACA",
              status: "active",
            },
          ],
        })),
      },
    });
    const branches = responseRecorder();
    const departments = responseRecorder();

    await routes.get("/api/ncc/directory/branches")?.(
      request(cookie),
      branches.response
    );
    await routes.get("/api/ncc/directory/departments")?.(
      request(cookie),
      departments.response
    );

    expect(branches.result).toEqual({
      status: 200,
      body: {
        items: [
          {
            id: "branch-1",
            name: "Cairo",
            status: "active",
            timezone: "Africa/Cairo",
          },
          {
            id: "branch-2",
            name: "Closed",
            status: "disabled",
            timezone: "UTC",
          },
        ],
      },
    });
    expect(departments.result).toEqual({
      status: 200,
      body: {
        items: [
          {
            id: "department-1",
            name: "Academic",
            code: "ACA",
            status: "active",
          },
        ],
      },
    });
  });
});
