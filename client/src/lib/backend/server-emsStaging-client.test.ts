import { describe, expect, it, vi } from "vitest";

import {
  createEmsStagingClient,
  extractTokens,
  mapEmsRoleToLocal,
  mapLocalRoleToEms,
  normalizeEmsClass,
  normalizeEmsCustomFieldDefinitions,
  normalizeEmsLead,
  normalizeEmsMe,
  normalizeEmsPlacementTest,
  normalizeEmsRooms,
  normalizeEmsStaffUsers,
  normalizeEmsStudent,
  normalizeEmsStudentEnrolments,
  normalizeEmsTeacherWorkspace,
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
    expect(
      normalizeEmsMe({
        ...mePayload(),
        scopes: [
          { scope_type: "branch", scope_id: "branch-1", is_live: "false" },
        ],
      })
    ).toBeNull();
  });

  it("normalizes closed staff user rows and rejects malformed live scope flags", () => {
    const base = {
      id: "user-1",
      email: "hod@example.test",
      assigned_role: "hod",
      status: "active",
      is_active: true,
      moodle_user_id: 42,
      last_login_at: "2026-09-12T10:00:00Z",
      created_at: "2026-09-01T10:00:00Z",
      updated_at: "2026-09-12T10:00:00Z",
      profile: {
        first_name: "NCC",
        last_name: "HOD",
        phone: null,
        custom_fields: { private: true },
      },
      scopes: [
        { scope_type: "branch", scope_id: "branch-1", is_live: true },
      ],
      departments: [
        {
          department_id: "department-1",
          name: "Academic",
          status: "active",
        },
      ],
      custom_fields: { ignored: true },
    };
    const users = normalizeEmsStaffUsers([
      base,
      {
        ...base,
        id: "user-2",
        email: "teacher@example.test",
        assigned_role: "teacher",
        moodle_user_id: null,
        last_login_at: null,
        profile: null,
        scopes: [{ scope_type: "branch", scope_id: "branch-2" }],
        departments: null,
      },
    ]);

    expect(users).toEqual([
      {
        id: "user-1",
        email: "hod@example.test",
        name: "NCC HOD",
        firstName: "NCC",
        lastName: "HOD",
        phone: null,
        role: "headofdepartment",
        status: "active",
        isActive: true,
        scopeType: "branch",
        branchIds: ["branch-1"],
        departments: [
          { id: "department-1", name: "Academic", status: "active" },
        ],
        moodleLinked: true,
        lastLoginAt: "2026-09-12T10:00:00Z",
        createdAt: "2026-09-01T10:00:00Z",
        updatedAt: "2026-09-12T10:00:00Z",
        customFields: { ignored: true },
      },
      {
        id: "user-2",
        email: "teacher@example.test",
        name: "teacher@example.test",
        firstName: "",
        lastName: "",
        phone: null,
        role: "teacher",
        status: "active",
        isActive: true,
        scopeType: "branch",
        branchIds: ["branch-2"],
        departments: [],
        moodleLinked: false,
        lastLoginAt: null,
        createdAt: "2026-09-01T10:00:00Z",
        updatedAt: "2026-09-12T10:00:00Z",
        customFields: { ignored: true },
      },
    ]);
    expect(
      normalizeEmsStaffUsers([
        {
          ...base,
          scopes: [
            { scope_type: "branch", scope_id: "branch-1", is_live: "false" },
          ],
        },
      ])
    ).toBeNull();
  });

  it("accepts omitted optional staff fields and rejects invalid departments", () => {
    const row = {
      id: "user-optional",
      email: "teacher@example.test",
      assigned_role: "teacher",
      status: "active",
      is_active: true,
      created_at: "2026-09-01T10:00:00Z",
      updated_at: "2026-09-12T10:00:00Z",
      profile: null,
      scopes: [{ scope_type: "branch", scope_id: "branch-1" }],
    };

    expect(normalizeEmsStaffUsers([row])).toEqual([
      expect.objectContaining({
        id: "user-optional",
        departments: [],
        moodleLinked: false,
        lastLoginAt: null,
        customFields: {},
      }),
    ]);
    expect(
      normalizeEmsStaffUsers([{ ...row, departments: "x" }])
    ).toBeNull();
    expect(
      normalizeEmsStaffUsers([
        { ...row, custom_fields: { nested: { value: true } } },
      ])
    ).toBeNull();
  });

  it("normalizes active user profile custom-field definitions", () => {
    expect(
      normalizeEmsCustomFieldDefinitions([
        {
          id: "field-1",
          entity_type: "user_profile",
          field_key: "employee_number",
          label: "Employee number",
          field_type: "text",
          is_required: true,
          is_active: true,
          sort_order: 1,
          options_json: null,
          help_text: "Use the EMS number.",
        },
      ])
    ).toEqual([
      {
        id: "field-1",
        fieldKey: "employee_number",
        label: "Employee number",
        fieldType: "text",
        isRequired: true,
        helpText: "Use the EMS number.",
        options: null,
        sortOrder: 1,
      },
    ]);
  });
});

describe("EMS operational payload guards", () => {
  const student = {
    id: "student-1",
    first_name: "Nile",
    last_name: "Student",
    email: "student@example.test",
    branch_id: "branch-1",
    branch_name: "Cairo",
    status: "active",
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-12T10:00:00Z",
  };

  const lead = {
    id: "lead-1",
    first_name: "Nile",
    last_name: "Lead",
    email: "lead@example.test",
    branch_id: "branch-1",
    branch_name: "Cairo",
    status: "new",
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-12T10:00:00Z",
  };

  const placement = {
    id: "placement-1",
    branch_id: "branch-1",
    branch_name: "Cairo",
    subject: {
      subject_type: "lead",
      subject_id: "lead-1",
      first_name: "Nile",
      last_name: "Lead",
      email: "lead@example.test",
    },
    scheduled_at: null,
    status: "scheduled",
    created_at: null,
    updated_at: null,
  };

  const classRow = {
    id: "class-1",
    name: "Arabic A",
    course_id: "course-1",
    course_name: "Arabic",
    department_id: "department-1",
    department_name: "Languages",
    branch_id: "branch-1",
    branch_name: "Cairo",
    capacity: 20,
    start_at: "2026-09-01T10:00:00Z",
    end_at: "2026-12-01T10:00:00Z",
    teachers: [
      {
        id: "teacher-1",
        first_name: "Nile",
        last_name: "Teacher",
        email: "teacher@example.test",
      },
      {
        id: "teacher-2",
        first_name: "Second",
        last_name: "Teacher",
        email: "teacher2@example.test",
      },
    ],
    schedule_days_of_week: null,
    status: "active",
    active_enrolment_count: 8,
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-12T10:00:00Z",
  };

  it("normalizes students with absent optionals and rejects wrong field types", () => {
    expect(normalizeEmsStudent(student)).toMatchObject({
      name: "Nile Student",
      phone: null,
      dateOfBirth: null,
      moodleLinked: false,
      guardian: null,
    });
    expect(normalizeEmsStudent({ ...student, email: 4 })).toBeNull();
  });

  it("normalizes enrolment class summaries and rejects malformed summaries", () => {
    const enrolment = {
      student_id: "student-1",
      class_id: "class-1",
      status: "active",
      class_summary: {
        class_name: "Arabic A",
        branch_id: "branch-1",
        branch_name: "Cairo",
        course_id: "course-1",
        course_name: "Arabic",
        start_at: "2026-09-01T10:00:00Z",
        end_at: "2026-12-01T10:00:00Z",
        class_status: "active",
      },
    };
    expect(normalizeEmsStudentEnrolments([enrolment])).toEqual([
      {
        classId: "class-1",
        className: "Arabic A",
        courseName: "Arabic",
        status: "active",
        enrolledAt: null,
        withdrawnAt: null,
      },
    ]);
    expect(
      normalizeEmsStudentEnrolments([
        { ...enrolment, class_summary: "invalid" },
      ])
    ).toBeNull();
  });

  it("normalizes leads with absent optionals and rejects unknown status", () => {
    expect(normalizeEmsLead(lead)).toMatchObject({
      name: "Nile Lead",
      phone: null,
      preferredCourseId: null,
      source: null,
      studentId: null,
    });
    expect(normalizeEmsLead({ ...lead, status: "bogus" })).toBeNull();
  });

  it("normalizes placement subjects and nullable dates", () => {
    expect(normalizeEmsPlacementTest(placement)).toMatchObject({
      subject: {
        type: "lead",
        id: "lead-1",
        name: "Nile Lead",
        email: "lead@example.test",
      },
      createdAt: null,
      updatedAt: null,
    });
    expect(
      normalizeEmsPlacementTest({
        ...placement,
        subject: { ...placement.subject, subject_type: "guardian" },
      })
    ).toBeNull();
  });

  it("normalizes classes with teachers and nullable schedule", () => {
    expect(normalizeEmsClass(classRow)).toMatchObject({
      teachers: [
        { id: "teacher-1", name: "Nile Teacher" },
        { id: "teacher-2", name: "Second Teacher" },
      ],
      schedule: { daysOfWeek: null, startTime: null, endTime: null },
      moodleGroupId: null,
      defaultRoomId: null,
    });
    expect(normalizeEmsClass({ ...classRow, capacity: "20" })).toBeNull();
  });

  it("normalizes rooms with absent capacity and rejects invalid status", () => {
    const room = {
      id: "room-1",
      branch_id: "branch-1",
      branch_name: "Cairo",
      name: "Room 1",
      status: "active",
    };
    expect(normalizeEmsRooms([room])).toEqual([
      {
        id: "room-1",
        branchId: "branch-1",
        branchName: "Cairo",
        name: "Room 1",
        capacity: null,
        status: "active",
      },
    ]);
    expect(normalizeEmsRooms([{ ...room, status: "closed" }])).toBeNull();
  });

  it("normalizes teacher workspace URLs and rejects wrong item types", () => {
    const workspace = {
      moodle_site_url: "http://moodle.example.test",
      classes: [
        {
          id: "class-1",
          name: "Arabic A",
          course_name: "Arabic",
          status: "active",
          active_enrolment_count: 8,
          moodle_course_url: "http://moodle.example.test/course/1",
        },
      ],
      upcoming_sessions: [
        {
          id: "session-1",
          class_id: "class-1",
          class_name: "Arabic A",
          starts_at: "2026-09-13T10:00:00Z",
          ends_at: "2026-09-13T11:00:00Z",
          room_name: null,
          status: "scheduled",
        },
      ],
    };
    expect(normalizeEmsTeacherWorkspace(workspace)).toMatchObject({
      moodleSiteUrl: null,
      classes: [{ moodleCourseUrl: null }],
      upcomingSessions: [{ classId: "class-1", roomName: null }],
    });
    expect(
      normalizeEmsTeacherWorkspace({
        ...workspace,
        classes: [
          { ...workspace.classes[0], active_enrolment_count: "eight" },
        ],
      })
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
