import { describe, expect, it, vi } from "vitest";

import {
  getNccRequestSession,
  listNccWorkspaces,
  loginNccStaff,
  logoutNccSession,
  nccStaffAuthEnabled,
  resolveNccAuthSession,
  switchNccRole,
  switchNccWorkspace,
  validateNccAuthConfiguration,
} from "../../../../server/nccAuthSession";

const sealKey = "test-only-ncc-auth-session-key-32-characters";
const accessExpiresAt = "2099-01-01T00:15:00Z";
const refreshExpiresAt = "2099-02-01T00:00:00Z";

function env(overrides: NodeJS.ProcessEnv = {}) {
  return {
    NILE_NCC_STAFF_AUTH_ENABLED: "1",
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

function me(
  options: {
    sessionId?: string;
    assignedRole?: string;
    activeRole?: string;
    workspaceBranchId?: string | null;
  } = {}
) {
  const assignedRole = options.assignedRole ?? "super_admin";
  return {
    session_id: options.sessionId ?? "ncc-session-1",
    user: {
      id: "ncc-user-1",
      email: "staff@example.test",
      assigned_role: assignedRole,
      status: "active",
      is_active: true,
      profile: { first_name: "NCC", last_name: "Staff" },
      departments:
        assignedRole === "hod"
          ? [
              {
                department_id: "department-1",
                name: "Academic",
                status: "active",
              },
            ]
          : null,
    },
    assigned_role: assignedRole,
    active_role: options.activeRole ?? assignedRole,
    workspace_branch_id: options.workspaceBranchId ?? null,
    scopes:
      assignedRole === "super_admin"
        ? [{ scope_type: "global", scope_id: null, is_live: true }]
        : [{ scope_type: "branch", scope_id: "branch-1", is_live: true }],
  };
}

function responseRecorder() {
  const headers = new Map<string, string | string[]>();
  return {
    headers,
    response: {
      setHeader(name: string, value: string | string[]) {
        headers.set(name, value);
      },
    },
  };
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

async function login(
  options: {
    assignedRole?: string;
    activeRole?: string;
    workspaceBranchId?: string | null;
  } = {}
) {
  const { headers, response } = responseRecorder();
  const api = {
    login: vi.fn(async () => ({ ok: true, data: tokens() })),
    me: vi.fn(async () => ({ ok: true, data: me(options) })),
    logout: vi.fn(async () => ({ ok: true, data: null })),
  };
  const session = await loginNccStaff(
    "staff@example.test",
    "password",
    response,
    {
      env: env(),
      createClient: () => api as never,
    }
  );
  return { api, headers, session, cookie: sessionCookie(headers) };
}

describe("NCC staff auth configuration", () => {
  it("keeps the provider disabled by default", () => {
    expect(nccStaffAuthEnabled({})).toBe(false);
    expect(() => validateNccAuthConfiguration({})).not.toThrow();
  });

  it("requires an allowlisted upstream and session key when enabled", () => {
    expect(() =>
      validateNccAuthConfiguration({ NILE_NCC_STAFF_AUTH_ENABLED: "1" })
    ).toThrow(/allowlisted HTTPS/);
    expect(() =>
      validateNccAuthConfiguration({
        NILE_NCC_STAFF_AUTH_ENABLED: "1",
        EMS_STAGING_BASE_URL: "https://staging.example/api",
        EMS_STAGING_ALLOWED_HOSTS: "staging.example",
      })
    ).toThrow(/session protection/);
    expect(() => validateNccAuthConfiguration(env())).not.toThrow();
  });
});

describe("NCC staff auth session", () => {
  it("derives staff authority and seals tokens outside JavaScript storage", async () => {
    const result = await login();
    const setCookie = result.headers.get("Set-Cookie");
    expect(result.session).toMatchObject({
      id: "ncc-session-1",
      userId: "ncc-user-1",
      email: "staff@example.test",
      name: "NCC Staff",
      roles: ["superadmin"],
      activeRole: "superadmin",
      assignedRole: "superadmin",
      provider: "ncc",
      authorizationModel: "external",
      branchIds: [],
      departmentIds: [],
    });
    expect(setCookie).toEqual([
      expect.stringContaining("nilelearn_session=;"),
      expect.stringContaining("nilelearn_ncc_session="),
    ]);
    expect(JSON.stringify(setCookie)).not.toContain("access-ncc-session-1");
    expect(JSON.stringify(setCookie)).not.toContain("refresh-ncc-session-1");
    expect(result.cookie).toBeTruthy();
  });

  it("resolves the sealed session across instances", async () => {
    const result = await login({ assignedRole: "hod", activeRole: "hod" });
    expect(
      getNccRequestSession({ headers: { cookie: result.cookie } }, env())
    ).toMatchObject({
      activeRole: "headofdepartment",
      assignedRole: "headofdepartment",
      branchIds: ["branch-1"],
      departmentIds: ["department-1"],
    });
  });

  it("revalidates with me and rotates an expired access token once", async () => {
    const initial = await login();
    const nextTokens = tokens("ncc-session-2");
    const api = {
      me: vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          error: { error: "Not authenticated", status: 401 },
        })
        .mockResolvedValueOnce({
          ok: true,
          data: me({ sessionId: "ncc-session-2" }),
        }),
      refresh: vi.fn(async () => ({ ok: true, data: nextTokens })),
    };
    const { headers, response } = responseRecorder();
    const session = await resolveNccAuthSession(
      { headers: { cookie: initial.cookie } },
      response,
      { env: env(), createClient: () => api as never }
    );
    expect(api.refresh).toHaveBeenCalledWith("refresh-ncc-session-1");
    expect(api.me).toHaveBeenNthCalledWith(1, "access-ncc-session-1");
    expect(api.me).toHaveBeenNthCalledWith(2, "access-ncc-session-2");
    expect(session?.id).toBe("ncc-session-2");
    expect(sessionCookie(headers)).toBeTruthy();
  });

  it("switches role using the NCC role name and verified replacement tokens", async () => {
    const initial = await login();
    const api = {
      switchRole: vi.fn(async () => ({
        ok: true,
        data: tokens("ncc-session-2"),
      })),
      me: vi.fn(async () => ({
        ok: true,
        data: me({
          sessionId: "ncc-session-2",
          assignedRole: "super_admin",
          activeRole: "teacher",
        }),
      })),
    };
    const { response } = responseRecorder();
    const session = await switchNccRole(
      { headers: { cookie: initial.cookie } },
      response,
      "teacher",
      { env: env(), createClient: () => api as never }
    );
    expect(api.switchRole).toHaveBeenCalledWith(
      "access-ncc-session-1",
      "teacher"
    );
    expect(session.activeRole).toBe("teacher");
    expect(session.assignedRole).toBe("superadmin");
  });

  it("lists active branch workspaces through a closed DTO", async () => {
    const initial = await login({
      assignedRole: "branch_admin",
      activeRole: "branch_admin",
    });
    const api = {
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
    };
    const { response } = responseRecorder();
    await expect(
      listNccWorkspaces({ headers: { cookie: initial.cookie } }, response, {
        env: env(),
        createClient: () => api as never,
      })
    ).resolves.toEqual([
      {
        id: "branch-1",
        name: "Cairo",
        timezone: "Africa/Cairo",
      },
    ]);
  });

  it("switches branch workspace and narrows operational branch scope", async () => {
    const initial = await login({
      assignedRole: "registrar",
      activeRole: "registrar",
    });
    const api = {
      switchWorkspace: vi.fn(async () => ({
        ok: true,
        data: me({
          assignedRole: "registrar",
          activeRole: "registrar",
          workspaceBranchId: "branch-1",
        }),
      })),
    };
    const { response } = responseRecorder();
    const session = await switchNccWorkspace(
      { headers: { cookie: initial.cookie } },
      response,
      "branch-1",
      { env: env(), createClient: () => api as never }
    );
    expect(api.switchWorkspace).toHaveBeenCalledWith(
      "access-ncc-session-1",
      "branch-1"
    );
    expect(session.workspaceBranchId).toBe("branch-1");
    expect(session.branchIds).toEqual(["branch-1"]);
  });

  it("revokes remotely before clearing the NCC cookie", async () => {
    const initial = await login();
    const logout = vi.fn(async () => ({ ok: true, data: null }));
    const { headers, response } = responseRecorder();
    await logoutNccSession({ headers: { cookie: initial.cookie } }, response, {
      env: env(),
      createClient: () => ({ logout }) as never,
    });
    expect(logout).toHaveBeenCalledWith("access-ncc-session-1");
    expect(headers.get("Set-Cookie")).toContain("Max-Age=0");
  });
});
