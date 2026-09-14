import { describe, expect, it, vi } from "vitest";

import { loginNccStaff } from "../../../../server/nccAuthSession";
import { registerNccOperationalRoutes } from "../../../../server/nccOperationalRoutes";

const sealKey = "test-only-ncc-auth-session-key-32-characters";
const accessExpiresAt = "2099-01-01T00:15:00Z";
const refreshExpiresAt = "2099-02-01T00:00:00Z";

type Request = {
  headers: { cookie?: string };
  params?: Record<string, string>;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
};
type Response = {
  setHeader(name: string, value: string | string[]): void;
  status(code: number): Response;
  json(body: unknown): void;
};
type Handler = (request: Request, response: Response) => void | Promise<void>;

function env(overrides: NodeJS.ProcessEnv = {}) {
  return {
    NILE_NCC_STAFF_AUTH_ENABLED: "1",
    NILE_NCC_ADMISSIONS_READS_ENABLED: "1",
    NILE_NCC_ADMISSIONS_WRITES_ENABLED: "1",
    NILE_NCC_DELIVERY_READS_ENABLED: "1",
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
  sessionId = "ncc-session-1",
  role = "super_admin",
  workspaceBranchId: string | null = null
) {
  return {
    session_id: sessionId,
    user: {
      id: "ncc-user-1",
      email: "staff@example.test",
      profile: { first_name: "NCC", last_name: "Staff" },
      departments: null,
    },
    assigned_role: role,
    active_role: role,
    workspace_branch_id: workspaceBranchId,
    scopes:
      role === "super_admin"
        ? [{ scope_type: "global", scope_id: null, is_live: true }]
        : [{ scope_type: "branch", scope_id: "branch-1", is_live: true }],
  };
}

function student(overrides: Record<string, unknown> = {}) {
  return {
    id: "student-1",
    first_name: "Nile",
    last_name: "Student",
    email: "student@example.test",
    phone: "+20 100",
    date_of_birth: "2010-05-01",
    nationality: "EGY",
    address: "12 Nile St",
    gender: "female",
    passport_number: null,
    national_id: null,
    guardians: [
      {
        sort_order: 1,
        name: "Guardian",
        phone: "+20 200",
        email: "guardian@example.test",
        relationship: "Parent",
      },
    ],
    branch_id: "branch-1",
    branch_name: "Cairo",
    moodle_user_id: 42,
    status: "active",
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-12T10:00:00Z",
    generated_moodle_password: "never-return-this",
    ...overrides,
  };
}

function lead(overrides: Record<string, unknown> = {}) {
  return {
    id: "lead-1",
    first_name: "Nile",
    last_name: "Lead",
    email: "lead@example.test",
    phone: null,
    branch_id: "branch-1",
    branch_name: "Cairo",
    status: "new",
    preferred_courses: [{ course_id: "course-1", course_name: "Arabic" }],
    wants_online: true,
    wants_onsite: false,
    entry_path: "direct",
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-12T10:00:00Z",
    ...overrides,
  };
}

function placementTest() {
  return {
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
    room_id: null,
    room_name: null,
    status: "scheduled",
    created_at: null,
    updated_at: null,
  };
}

function classRow() {
  return {
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
    teacher_ids: ["teacher-1", "teacher-2"],
    moodle_group_id: null,
    schedule_days_of_week: null,
    schedule_start_time: null,
    schedule_end_time: null,
    default_room_id: null,
    default_room_name: null,
    status: "active",
    sort_order: 0,
    active_enrolment_count: 8,
    created_by: null,
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-12T10:00:00Z",
  };
}

function roomRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "room-1",
    branch_id: "branch-1",
    branch_name: "Cairo",
    name: "Room 1",
    capacity: 20,
    status: "active",
    sort_order: 0,
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-12T10:00:00Z",
    ...overrides,
  };
}

function courseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "course-1",
    fullname: "Arabic Language",
    shortname: "AR1",
    department_id: "department-1",
    department_name: "Languages",
    department_status: "active",
    moodle_course_id: 501,
    idnumber: "AR-1",
    displayname: "Arabic 1",
    category_id: 3,
    category_name: "Languages",
    moodle_visible: true,
    moodle_attendance_id: null,
    moodle_refreshed_at: "2026-09-12T09:00:00Z",
    moodle_refresh_error: null,
    warnings: [],
    status: "active",
    sort_order: 0,
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-12T10:00:00Z",
    ...overrides,
  };
}

function captureRoutes(options: {
  env: NodeJS.ProcessEnv;
  api: Record<string, unknown>;
}) {
  const routes = new Map<string, Handler>();
  const app = {
    get(path: string, handler: Handler) {
      routes.set(path, handler);
    },
    post(path: string, handler: Handler) {
      routes.set(`POST ${path}`, handler);
    },
    patch(path: string, handler: Handler) {
      routes.set(`PATCH ${path}`, handler);
    },
  };
  registerNccOperationalRoutes(app, {
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

function request(
  cookie = "",
  params?: Record<string, string>,
  body?: Record<string, unknown>,
  query?: Record<string, unknown>
): Request {
  return { headers: cookie ? { cookie } : {}, params, body, query };
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
  role = "super_admin",
  workspaceBranchId: string | null = null
) {
  const { headers, response } = responseRecorder();
  const api = {
    login: vi.fn(async () => ({ ok: true, data: tokens() })),
    me: vi.fn(async () => ({
      ok: true,
      data: me("ncc-session-1", role, workspaceBranchId),
    })),
    logout: vi.fn(async () => ({ ok: true, data: null })),
  };
  await loginNccStaff("staff@example.test", "password", response, {
    env: env(),
    createClient: () => api as never,
  });
  return sessionCookie(headers);
}

describe("NCC operational routes", () => {
  it("returns 503 while each operational family flag is off", async () => {
    const routes = captureRoutes({
      env: env({
        NILE_NCC_ADMISSIONS_READS_ENABLED: "0",
        NILE_NCC_DELIVERY_READS_ENABLED: "0",
      }),
      api: {},
    });
    const admissions = responseRecorder();
    const delivery = responseRecorder();

    await routes.get("/api/ncc/admissions/students")?.(
      request(),
      admissions.response
    );
    await routes.get("/api/ncc/delivery/classes")?.(
      request(),
      delivery.response
    );

    expect(admissions.result).toEqual({
      status: 503,
      body: { error: "NCC admissions reads are not active." },
    });
    expect(delivery.result).toEqual({
      status: 503,
      body: { error: "NCC delivery reads are not active." },
    });
  });

  it("returns 404 without an NCC session cookie", async () => {
    const routes = captureRoutes({ env: env(), api: {} });
    const { response, result } = responseRecorder();

    await routes.get("/api/ncc/admissions/students")?.(request(), response);

    expect(result).toEqual({
      status: 404,
      body: { error: "EMS data is unavailable for this session." },
    });
  });

  it("translates student identity, guardians, and omits credentials", async () => {
    const cookie = await login();
    const withoutGuardians: Partial<ReturnType<typeof student>> = student({
      id: "student-2",
      email: "second@example.test",
    });
    delete withoutGuardians.guardians;
    delete withoutGuardians.moodle_user_id;
    const routes = captureRoutes({
      env: env(),
      api: {
        students: vi.fn(async () => ({
          ok: true,
          data: [
            student({
              guardians: [
                {
                  sort_order: 1,
                  name: "Guardian",
                  phone: "+20 200",
                  email: "guardian@example.test",
                  relationship: "Parent",
                },
                {
                  sort_order: 2,
                  name: "Second Guardian",
                  phone: "+20 300",
                  email: "g2@example.test",
                  relationship: "Father",
                },
              ],
            }),
            withoutGuardians,
          ],
        })),
      },
    });
    const { response, result } = responseRecorder();

    await routes.get("/api/ncc/admissions/students")?.(
      request(cookie),
      response
    );

    expect(result).toMatchObject({
      status: 200,
      body: {
        items: [
          {
            id: "student-1",
            nationality: "EGY",
            address: "12 Nile St",
            gender: "female",
            passportNumber: null,
            nationalId: null,
            guardians: [
              {
                sortOrder: 1,
                name: "Guardian",
                phone: "+20 200",
                email: "guardian@example.test",
                relationship: "Parent",
              },
              {
                sortOrder: 2,
                name: "Second Guardian",
                phone: "+20 300",
                email: "g2@example.test",
                relationship: "Father",
              },
            ],
            moodleLinked: true,
          },
          { id: "student-2", guardians: [], moodleLinked: false },
        ],
      },
    });
    expect(JSON.stringify(result.body)).not.toContain(
      "generated_moodle_password"
    );
  });

  it("fails closed for duplicate guardian sort orders", async () => {
    const cookie = await login();
    const duplicate = {
      sort_order: 1,
      name: "Guardian",
      phone: "+20 200",
      email: "g@example.test",
      relationship: "Parent",
    };
    const routes = captureRoutes({
      env: env(),
      api: {
        students: vi.fn(async () => ({
          ok: true,
          data: [
            student({
              guardians: [duplicate, { ...duplicate, name: "Second" }],
            }),
          ],
        })),
      },
    });
    const { response, result } = responseRecorder();

    await routes.get("/api/ncc/admissions/students")?.(
      request(cookie),
      response
    );

    expect(result).toEqual({
      status: 502,
      body: { error: "NCC EMS returned invalid admissions data." },
    });
  });

  it("fails closed for malformed student guardians", async () => {
    const cookie = await login();
    const routes = captureRoutes({
      env: env(),
      api: {
        students: vi.fn(async () => ({
          ok: true,
          data: [student({ guardians: { name: "not-an-array" } })],
        })),
      },
    });
    const { response, result } = responseRecorder();

    await routes.get("/api/ncc/admissions/students")?.(
      request(cookie),
      response
    );

    expect(result).toEqual({
      status: 502,
      body: { error: "NCC EMS returned invalid admissions data." },
    });
  });

  it("passes through branch selection and role denials", async () => {
    const cookie = await login();
    const students = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        error: { error: "select a branch", status: 400 },
      })
      .mockResolvedValueOnce({
        ok: false,
        error: { error: "Forbidden", status: 403 },
      });
    const routes = captureRoutes({ env: env(), api: { students } });
    const branch = responseRecorder();
    const denied = responseRecorder();

    await routes.get("/api/ncc/admissions/students")?.(
      request(cookie),
      branch.response
    );
    await routes.get("/api/ncc/admissions/students")?.(
      request(cookie),
      denied.response
    );

    expect(branch.result).toEqual({
      status: 400,
      body: { error: "select a branch" },
    });
    expect(denied.result).toEqual({
      status: 403,
      body: { error: "Forbidden" },
    });
  });

  it("translates placement subjects and nullable creation dates", async () => {
    const cookie = await login();
    const routes = captureRoutes({
      env: env(),
      api: {
        placementTests: vi.fn(async () => ({
          ok: true,
          data: [placementTest()],
        })),
      },
    });
    const { response, result } = responseRecorder();

    await routes.get("/api/ncc/admissions/placement-tests")?.(
      request(cookie),
      response
    );

    expect(result).toMatchObject({
      status: 200,
      body: {
        items: [
          {
            subject: {
              type: "lead",
              id: "lead-1",
              name: "Nile Lead",
              email: "lead@example.test",
            },
            createdAt: null,
          },
        ],
      },
    });
  });

  it("translates classes with teachers and nullable schedule", async () => {
    const cookie = await login();
    const routes = captureRoutes({
      env: env(),
      api: {
        classes: vi.fn(async () => ({ ok: true, data: [classRow()] })),
      },
    });
    const { response, result } = responseRecorder();

    await routes.get("/api/ncc/delivery/classes")?.(request(cookie), response);

    expect(result).toMatchObject({
      status: 200,
      body: {
        items: [
          {
            teachers: [
              { id: "teacher-1", name: "Nile Teacher" },
              { id: "teacher-2", name: "Second Teacher" },
            ],
            schedule: { daysOfWeek: null },
          },
        ],
      },
    });
  });

  it("translates rooms", async () => {
    const cookie = await login();
    const routes = captureRoutes({
      env: env(),
      api: {
        rooms: vi.fn(async () => ({
          ok: true,
          data: [roomRow()],
        })),
      },
    });
    const { response, result } = responseRecorder();

    await routes.get("/api/ncc/delivery/rooms")?.(request(cookie), response);

    expect(result).toEqual({
      status: 200,
      body: {
        items: [
          {
            id: "room-1",
            branchId: "branch-1",
            branchName: "Cairo",
            name: "Room 1",
            capacity: 20,
            status: "active",
            sortOrder: 0,
            createdAt: "2026-09-01T10:00:00Z",
            updatedAt: "2026-09-12T10:00:00Z",
          },
        ],
      },
    });
  });

  it("keeps non-HTTPS teacher workspace URLs out of the DTO", async () => {
    const cookie = await login();
    const routes = captureRoutes({
      env: env(),
      api: {
        teacherWorkspace: vi.fn(async () => ({
          ok: true,
          data: {
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
          },
        })),
      },
    });
    const { response, result } = responseRecorder();

    await routes.get("/api/ncc/delivery/teacher-workspace")?.(
      request(cookie),
      response
    );

    expect(result).toMatchObject({
      status: 200,
      body: {
        workspace: {
          moodleSiteUrl: null,
          classes: [{ moodleCourseUrl: null }],
        },
      },
    });
  });

  it("fails closed for invalid lead status", async () => {
    const cookie = await login();
    const routes = captureRoutes({
      env: env(),
      api: {
        leads: vi.fn(async () => ({
          ok: true,
          data: [
            {
              id: "lead-1",
              first_name: "Nile",
              last_name: "Lead",
              email: "lead@example.test",
              branch_id: "branch-1",
              branch_name: "Cairo",
              status: "bogus",
              created_at: "2026-09-01T10:00:00Z",
              updated_at: "2026-09-12T10:00:00Z",
            },
          ],
        })),
      },
    });
    const { response, result } = responseRecorder();

    await routes.get("/api/ncc/admissions/leads")?.(request(cookie), response);

    expect(result).toEqual({
      status: 502,
      body: { error: "NCC EMS returned invalid admissions data." },
    });
  });

  it("refreshes once and rotates the sealed cookie", async () => {
    const cookie = await login();
    const students = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        error: { error: "Not authenticated", status: 401 },
      })
      .mockResolvedValueOnce({ ok: true, data: [student()] });
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
      api: { students, refresh, me: meRequest },
    });
    const { headers, response, result } = responseRecorder();

    await routes.get("/api/ncc/admissions/students")?.(
      request(cookie),
      response
    );

    expect(result.status).toBe(200);
    expect(refresh).toHaveBeenCalledWith("refresh-ncc-session-1");
    expect(students).toHaveBeenNthCalledWith(2, "access-ncc-session-2");
    expect(meRequest).toHaveBeenCalledWith("access-ncc-session-2");
    expect(sessionCookie(headers)).toBeTruthy();
  });

  it("keeps admissions writes behind their own flag", async () => {
    const cookie = await login();
    const routes = captureRoutes({
      env: env({ NILE_NCC_ADMISSIONS_WRITES_ENABLED: "0" }),
      api: {},
    });
    const post = responseRecorder();
    const patch = responseRecorder();
    await routes.get("POST /api/ncc/admissions/leads")?.(
      request(cookie, undefined, {}),
      post.response
    );
    await routes.get("PATCH /api/ncc/admissions/leads/:leadId")?.(
      request(cookie, { leadId: "lead-1" }, {}),
      patch.response
    );
    expect(post.result.status).toBe(503);
    expect(patch.result.status).toBe(503);
  });

  it("derives the registrar branch and rejects invalid branch authority", async () => {
    const registrarCookie = await login("registrar", "branch-1");
    const noWorkspaceCookie = await login("registrar", null);
    const superadminCookie = await login();
    const createLead = vi.fn(
      async (_token: string, _body: Record<string, unknown>) => ({
        ok: true,
        data: lead(),
      })
    );
    const routes = captureRoutes({ env: env(), api: { createLead } });
    const created = responseRecorder();
    const mismatch = responseRecorder();
    const missingWorkspace = responseRecorder();
    const missingSuperBranch = responseRecorder();
    const body = {
      firstName: "Nile",
      lastName: "Lead",
      email: "lead@example.test",
    };
    await routes.get("POST /api/ncc/admissions/leads")?.(
      request(registrarCookie, undefined, body),
      created.response
    );
    await routes.get("POST /api/ncc/admissions/leads")?.(
      request(registrarCookie, undefined, { ...body, branchId: "branch-2" }),
      mismatch.response
    );
    await routes.get("POST /api/ncc/admissions/leads")?.(
      request(noWorkspaceCookie, undefined, body),
      missingWorkspace.response
    );
    await routes.get("POST /api/ncc/admissions/leads")?.(
      request(superadminCookie, undefined, body),
      missingSuperBranch.response
    );
    expect(createLead.mock.calls[0]?.[1]).toMatchObject({
      branch_id: "branch-1",
    });
    expect(mismatch.result.body).toEqual({
      error: "branchId must match the selected branch.",
    });
    expect(missingWorkspace.result.body).toEqual({
      error: "Choose a branch before creating records.",
    });
    expect(missingSuperBranch.result.body).toEqual({
      error: "branchId is required.",
    });
  });

  it("sends only provided lead PATCH fields and rejects terminal status", async () => {
    const cookie = await login("registrar", "branch-1");
    const patchLead = vi.fn(async () => ({
      ok: true,
      data: lead({ phone: "+20" }),
    }));
    const routes = captureRoutes({ env: env(), api: { patchLead } });
    const saved = responseRecorder();
    const rejected = responseRecorder();
    await routes.get("PATCH /api/ncc/admissions/leads/:leadId")?.(
      request(cookie, { leadId: "lead-1" }, { phone: "+20" }),
      saved.response
    );
    await routes.get("PATCH /api/ncc/admissions/leads/:leadId")?.(
      request(cookie, { leadId: "lead-1" }, { status: "converted" }),
      rejected.response
    );
    expect(patchLead).toHaveBeenCalledWith("access-ncc-session-1", "lead-1", {
      phone: "+20",
    });
    expect(rejected.result.status).toBe(400);
  });

  it("maps lead create and patch preference fields", async () => {
    const cookie = await login("registrar", "branch-1");
    const createLead = vi.fn(
      async (_token: string, _body: Record<string, unknown>) => ({
        ok: true,
        data: lead(),
      })
    );
    const patchLead = vi.fn(async () => ({ ok: true, data: lead() }));
    const routes = captureRoutes({
      env: env(),
      api: { createLead, patchLead },
    });
    const created = responseRecorder();
    const patched = responseRecorder();
    await routes.get("POST /api/ncc/admissions/leads")?.(
      request(cookie, undefined, {
        firstName: "Nile",
        lastName: "Lead",
        email: "lead@example.test",
        preferredCourseIds: ["course-1", "course-2"],
        wantsOnline: true,
        wantsOnsite: false,
        entryPath: "placement",
      }),
      created.response
    );
    await routes.get("PATCH /api/ncc/admissions/leads/:leadId")?.(
      request(
        cookie,
        { leadId: "lead-1" },
        {
          preferredCourseIds: [],
          wantsOnline: false,
          entryPath: null,
          status: "placement_test",
        }
      ),
      patched.response
    );
    expect(createLead.mock.calls[0]?.[1]).toMatchObject({
      branch_id: "branch-1",
      preferred_course_ids: ["course-1", "course-2"],
      wants_online: true,
      wants_onsite: false,
      entry_path: "placement",
    });
    expect(createLead.mock.calls[0]?.[1]).not.toHaveProperty(
      "preferred_course_id"
    );
    expect(patchLead).toHaveBeenCalledWith("access-ncc-session-1", "lead-1", {
      preferred_course_ids: [],
      wants_online: false,
      entry_path: null,
      status: "placement_test",
    });
  });

  it("marks a lead ready through the dedicated provider action", async () => {
    const cookie = await login("registrar", "branch-1");
    const markLeadReady = vi.fn(async () => ({
      ok: true,
      data: lead({ status: "ready" }),
    }));
    const routes = captureRoutes({ env: env(), api: { markLeadReady } });
    const result = responseRecorder();
    await routes.get("POST /api/ncc/admissions/leads/:leadId/ready")?.(
      request(cookie, { leadId: "lead-1" }),
      result.response
    );
    expect(markLeadReady).toHaveBeenCalledWith(
      "access-ncc-session-1",
      "lead-1"
    );
    expect(result.result).toMatchObject({
      status: 200,
      body: { lead: { status: "ready" } },
    });
  });

  it("requires identity fields for conversion and maps them", async () => {
    const cookie = await login("registrar", "branch-1");
    const convertLead = vi.fn(async () => ({
      ok: true,
      data: {
        lead: lead({ status: "converted", student_id: "student-1" }),
        student: student(),
      },
    }));
    const routes = captureRoutes({ env: env(), api: { convertLead } });
    const missing = responseRecorder();
    const result = responseRecorder();
    await routes.get("POST /api/ncc/admissions/leads/:leadId/convert")?.(
      request(cookie, { leadId: "lead-1" }, {}),
      missing.response
    );
    await routes.get("POST /api/ncc/admissions/leads/:leadId/convert")?.(
      request(
        cookie,
        { leadId: "lead-1" },
        {
          nationality: "EGY",
          address: "12 Nile St",
          gender: "female",
          dateOfBirth: "2010-05-01",
          phone: "+20 100",
          guardians: [
            {
              sortOrder: 1,
              name: "Guardian",
              phone: "+20 200",
              email: "g@example.test",
              relationship: "Parent",
            },
          ],
        }
      ),
      result.response
    );
    expect(missing.result.status).toBe(400);
    expect(convertLead).toHaveBeenCalledTimes(1);
    expect(convertLead).toHaveBeenCalledWith("access-ncc-session-1", "lead-1", {
      nationality: "EGY",
      address: "12 Nile St",
      gender: "female",
      date_of_birth: "2010-05-01",
      phone: "+20 100",
      guardians: [
        {
          sort_order: 1,
          name: "Guardian",
          phone: "+20 200",
          email: "g@example.test",
          relationship: "Parent",
        },
      ],
    });
    expect(result.result).toMatchObject({
      status: 200,
      body: { lead: { status: "converted" }, student: { id: "student-1" } },
    });
  });

  it("maps student identity create and null-clearing PATCH fields", async () => {
    const cookie = await login("registrar", "branch-1");
    const createStudent = vi.fn(
      async (_token: string, _body: Record<string, unknown>) => ({
        ok: true,
        data: student(),
      })
    );
    const patchStudent = vi.fn(async () => ({
      ok: true,
      data: student({ passport_number: null }),
    }));
    const routes = captureRoutes({
      env: env(),
      api: { createStudent, patchStudent },
    });
    const created = responseRecorder();
    const patched = responseRecorder();
    await routes.get("POST /api/ncc/admissions/students")?.(
      request(cookie, undefined, {
        firstName: "Nile",
        lastName: "Student",
        email: "student@example.test",
        nationality: "EGY",
        address: "12 Nile St",
        gender: "female",
        dateOfBirth: "2010-05-01",
        passportNumber: "A123",
        guardians: [
          {
            sortOrder: 1,
            name: "Guardian",
            phone: "+20",
            email: "g@example.test",
            relationship: "Parent",
          },
        ],
      }),
      created.response
    );
    await routes.get("PATCH /api/ncc/admissions/students/:studentId")?.(
      request(
        cookie,
        { studentId: "student-1" },
        { passportNumber: null, guardians: [] }
      ),
      patched.response
    );
    expect(createStudent.mock.calls[0]?.[1]).toMatchObject({
      branch_id: "branch-1",
      nationality: "EGY",
      address: "12 Nile St",
      gender: "female",
      date_of_birth: "2010-05-01",
      passport_number: "A123",
      guardians: [
        {
          sort_order: 1,
          name: "Guardian",
          phone: "+20",
          email: "g@example.test",
          relationship: "Parent",
        },
      ],
    });
    expect(patchStudent).toHaveBeenCalledWith(
      "access-ncc-session-1",
      "student-1",
      { passport_number: null, guardians: [] }
    );
  });

  it("rejects student create without required identity fields", async () => {
    const cookie = await login("registrar", "branch-1");
    const createStudent = vi.fn(async () => ({ ok: true, data: student() }));
    const routes = captureRoutes({ env: env(), api: { createStudent } });
    const result = responseRecorder();
    await routes.get("POST /api/ncc/admissions/students")?.(
      request(cookie, undefined, {
        firstName: "Nile",
        lastName: "Student",
        email: "student@example.test",
      }),
      result.response
    );
    expect(result.result.status).toBe(400);
    expect(createStudent).not.toHaveBeenCalled();
  });

  it("maps placement subjects and validates update and result bodies", async () => {
    const cookie = await login("registrar", "branch-1");
    const createPlacementTest = vi.fn(
      async (_token: string, _body: Record<string, unknown>) => ({
        ok: true,
        data: placementTest(),
      })
    );
    const routes = captureRoutes({ env: env(), api: { createPlacementTest } });
    const leadResult = responseRecorder();
    const studentResult = responseRecorder();
    const emptyPatch = responseRecorder();
    const missingCourse = responseRecorder();
    const base = { scheduledAt: "2026-09-13T10:00:00Z" };
    await routes.get("POST /api/ncc/admissions/placement-tests")?.(
      request(cookie, undefined, {
        ...base,
        subject: { type: "lead", id: "lead-1" },
      }),
      leadResult.response
    );
    await routes.get("POST /api/ncc/admissions/placement-tests")?.(
      request(cookie, undefined, {
        ...base,
        subject: { type: "student", id: "student-1" },
      }),
      studentResult.response
    );
    await routes.get(
      "PATCH /api/ncc/admissions/placement-tests/:placementTestId"
    )?.(
      request(cookie, { placementTestId: "placement-1" }, {}),
      emptyPatch.response
    );
    await routes.get(
      "POST /api/ncc/admissions/placement-tests/:placementTestId/record-result"
    )?.(
      request(cookie, { placementTestId: "placement-1" }, {}),
      missingCourse.response
    );
    expect(createPlacementTest.mock.calls[0]?.[1]).toMatchObject({
      lead_id: "lead-1",
    });
    expect(createPlacementTest.mock.calls[0]?.[1]).not.toHaveProperty(
      "student_id"
    );
    expect(createPlacementTest.mock.calls[1]?.[1]).toMatchObject({
      student_id: "student-1",
    });
    expect(createPlacementTest.mock.calls[1]?.[1]).not.toHaveProperty(
      "lead_id"
    );
    expect(emptyPatch.result.status).toBe(400);
    expect(missingCourse.result.body).toEqual({
      error: "recommendedCourseId is required.",
    });
  });

  it("passes provider write errors through and translates courses", async () => {
    const cookie = await login("registrar", "branch-1");
    const routes = captureRoutes({
      env: env(),
      api: {
        createLead: vi.fn(async () => ({
          ok: false,
          error: { error: "Already exists", status: 409 },
        })),
        courses: vi.fn(async () => ({
          ok: true,
          data: [courseRow()],
        })),
      },
    });
    const conflict = responseRecorder();
    const courses = responseRecorder();
    await routes.get("POST /api/ncc/admissions/leads")?.(
      request(cookie, undefined, {
        firstName: "Nile",
        lastName: "Lead",
        email: "lead@example.test",
      }),
      conflict.response
    );
    await routes.get("/api/ncc/delivery/courses")?.(
      request(cookie),
      courses.response
    );
    expect(conflict.result).toEqual({
      status: 409,
      body: { error: "Already exists" },
    });
    expect(courses.result).toMatchObject({
      status: 200,
      body: {
        items: [
          { id: "course-1", fullname: "Arabic Language", status: "active" },
        ],
      },
    });
  });
});

describe("NCC Moodle account routes", () => {
  const moodleEnv = () => env({ NILE_NCC_MOODLE_ACCOUNT_WRITES_ENABLED: "1" });

  it("blocks Moodle operations while the flag is off or without a session", async () => {
    const off = captureRoutes({ env: env(), api: {} });
    const flagOff = responseRecorder();
    await off.get("/api/ncc/moodle/users")?.(
      request("", undefined, undefined, { q: "abc" }),
      flagOff.response
    );
    expect(flagOff.result).toEqual({
      status: 503,
      body: { error: "NCC Moodle account operations are not active." },
    });

    const on = captureRoutes({ env: moodleEnv(), api: {} });
    const anonymous = responseRecorder();
    await on.get("/api/ncc/moodle/users")?.(
      request("", undefined, undefined, { q: "abc" }),
      anonymous.response
    );
    expect(anonymous.result).toEqual({
      status: 404,
      body: { error: "EMS data is unavailable for this session." },
    });
  });

  it("searches Moodle users with a trimmed >=2 query and strict mapping", async () => {
    const cookie = await login();
    const moodleUsers = vi.fn(async () => ({
      ok: true,
      data: [
        {
          moodle_user_id: 42,
          username: "jdoe",
          firstname: "Jane",
          lastname: "Doe",
          fullname: "Jane Doe",
          email: "jane@example.test",
        },
        { moodle_user_id: 7 },
      ],
    }));
    const routes = captureRoutes({
      env: moodleEnv(),
      api: { moodleUsers },
    });
    const { response, result } = responseRecorder();

    await routes.get("/api/ncc/moodle/users")?.(
      request(cookie, undefined, undefined, { q: "  jo  " }),
      response
    );

    expect(moodleUsers).toHaveBeenCalledWith("access-ncc-session-1", "jo");
    expect(result).toEqual({
      status: 200,
      body: {
        items: [
          {
            id: 42,
            username: "jdoe",
            firstName: "Jane",
            lastName: "Doe",
            fullName: "Jane Doe",
            email: "jane@example.test",
          },
          {
            id: 7,
            username: null,
            firstName: null,
            lastName: null,
            fullName: null,
            email: null,
          },
        ],
      },
    });
  });

  it("rejects short queries and malformed search results", async () => {
    const cookie = await login();
    const moodleUsers = vi.fn(async () => ({
      ok: true,
      data: [{ moodle_user_id: "42" }],
    }));
    const routes = captureRoutes({
      env: moodleEnv(),
      api: { moodleUsers },
    });
    const short = responseRecorder();
    const malformed = responseRecorder();

    await routes.get("/api/ncc/moodle/users")?.(
      request(cookie, undefined, undefined, { q: " a " }),
      short.response
    );
    await routes.get("/api/ncc/moodle/users")?.(
      request(cookie, undefined, undefined, { q: "abc" }),
      malformed.response
    );

    expect(short.result.status).toBe(400);
    expect(moodleUsers).toHaveBeenCalledTimes(1);
    expect(malformed.result).toEqual({
      status: 502,
      body: { error: "NCC EMS returned invalid Moodle account data." },
    });
  });

  it("creates a Student Moodle account and returns the password once", async () => {
    const cookie = await login();
    const bindStudentMoodle = vi.fn(async () => ({
      ok: true,
      data: { ...student(), generated_moodle_password: "moodle-pass-1" },
    }));
    const routes = captureRoutes({
      env: moodleEnv(),
      api: { bindStudentMoodle },
    });
    const { response, result } = responseRecorder();

    await routes.get("POST /api/ncc/admissions/students/:studentId/moodle")?.(
      request(cookie, { studentId: "student-1" }, { mode: "create" }),
      response
    );

    expect(bindStudentMoodle).toHaveBeenCalledWith(
      "access-ncc-session-1",
      "student-1",
      { mode: "create" }
    );
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      student: { id: "student-1" },
      oneTime: { generatedMoodlePassword: "moodle-pass-1" },
    });
    expect(JSON.stringify(result.body)).not.toContain(
      "generated_moodle_password"
    );
    expect(result.body).toMatchObject({
      student: expect.not.objectContaining({
        generatedMoodlePassword: expect.anything(),
      }),
    });
  });

  it("links a Student Moodle account without exposing a password", async () => {
    const cookie = await login();
    const bindStudentMoodle = vi.fn(async () => ({
      ok: true,
      data: student({ moodle_user_id: 42 }),
    }));
    const routes = captureRoutes({
      env: moodleEnv(),
      api: { bindStudentMoodle },
    });
    const { response, result } = responseRecorder();

    await routes.get("POST /api/ncc/admissions/students/:studentId/moodle")?.(
      request(
        cookie,
        { studentId: "student-1" },
        { mode: "link", moodleUserId: 42 }
      ),
      response
    );

    expect(bindStudentMoodle).toHaveBeenCalledWith(
      "access-ncc-session-1",
      "student-1",
      { mode: "link", moodle_user_id: 42 }
    );
    expect(result).toEqual({
      status: 200,
      body: {
        student: expect.objectContaining({ moodleLinked: true }),
        oneTime: { generatedMoodlePassword: null },
      },
    });
    expect(JSON.stringify(result.body)).not.toContain(
      "generated_moodle_password"
    );
  });

  it("rejects invalid bind bodies and missing generated passwords", async () => {
    const cookie = await login();
    const withoutSecret: Partial<ReturnType<typeof student>> = student();
    delete withoutSecret.generated_moodle_password;
    const bindStudentMoodle = vi.fn(async () => ({
      ok: true,
      data: withoutSecret,
    }));
    const routes = captureRoutes({
      env: moodleEnv(),
      api: { bindStudentMoodle },
    });
    const missingId = responseRecorder();
    const badId = responseRecorder();
    const extraKey = responseRecorder();
    const missingSecret = responseRecorder();
    const route = routes.get(
      "POST /api/ncc/admissions/students/:studentId/moodle"
    );

    await route?.(
      request(cookie, { studentId: "student-1" }, { mode: "link" }),
      missingId.response
    );
    await route?.(
      request(
        cookie,
        { studentId: "student-1" },
        { mode: "link", moodleUserId: 0 }
      ),
      badId.response
    );
    await route?.(
      request(
        cookie,
        { studentId: "student-1" },
        { mode: "link", moodleUserId: 42, extra: true }
      ),
      extraKey.response
    );
    await route?.(
      request(cookie, { studentId: "student-1" }, { mode: "create" }),
      missingSecret.response
    );

    expect(missingId.result.status).toBe(400);
    expect(badId.result.status).toBe(400);
    expect(extraKey.result.status).toBe(400);
    expect(missingSecret.result).toEqual({
      status: 502,
      body: { error: "NCC EMS returned invalid admissions data." },
    });
    expect(bindStudentMoodle).toHaveBeenCalledTimes(1);
  });

  it("resets a Student Moodle password through an empty POST", async () => {
    const cookie = await login();
    const resetStudentMoodlePassword = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        data: { generated_moodle_password: "reset-pass-1" },
      })
      .mockResolvedValueOnce({ ok: true, data: {} });
    const routes = captureRoutes({
      env: moodleEnv(),
      api: { resetStudentMoodlePassword },
    });
    const ok = responseRecorder();
    const missing = responseRecorder();
    const route = routes.get(
      "POST /api/ncc/admissions/students/:studentId/moodle/password"
    );

    await route?.(request(cookie, { studentId: "student-1" }), ok.response);
    await route?.(
      request(cookie, { studentId: "student-1" }),
      missing.response
    );

    expect(resetStudentMoodlePassword).toHaveBeenCalledWith(
      "access-ncc-session-1",
      "student-1"
    );
    expect(ok.result).toEqual({
      status: 200,
      body: { oneTime: { generatedMoodlePassword: "reset-pass-1" } },
    });
    expect(JSON.stringify(ok.result.body)).not.toContain(
      "generated_moodle_password"
    );
    expect(missing.result).toEqual({
      status: 502,
      body: { error: "NCC EMS returned invalid admissions data." },
    });
  });

  it("passes through scoped Moodle account denials", async () => {
    const cookie = await login();
    const bindStudentMoodle = vi.fn(async () => ({
      ok: false,
      error: { error: "Branch scope denied", status: 403 },
    }));
    const routes = captureRoutes({
      env: moodleEnv(),
      api: { bindStudentMoodle },
    });
    const { response, result } = responseRecorder();

    await routes.get("POST /api/ncc/admissions/students/:studentId/moodle")?.(
      request(cookie, { studentId: "student-1" }, { mode: "create" }),
      response
    );

    expect(result).toEqual({
      status: 403,
      body: { error: "Branch scope denied" },
    });
  });
});

describe("NCC delivery write routes", () => {
  const deliveryEnv = () => env({ NILE_NCC_DELIVERY_WRITES_ENABLED: "1" });
  const classBody = {
    name: "Arabic A",
    courseId: "course-1",
    capacity: 20,
    startAt: "2026-09-01T10:00:00Z",
    endAt: "2026-12-01T10:00:00Z",
  };

  it("blocks delivery writes while the flag is off or without a session", async () => {
    const createRoom = vi.fn();
    const off = captureRoutes({ env: env(), api: { createRoom } });
    const flagOff = responseRecorder();
    await off.get("POST /api/ncc/delivery/rooms")?.(
      request("", undefined, { name: "Room 1" }),
      flagOff.response
    );
    expect(flagOff.result).toEqual({
      status: 503,
      body: { error: "NCC delivery writes are not active." },
    });

    const on = captureRoutes({ env: deliveryEnv(), api: { createRoom } });
    const anonymous = responseRecorder();
    await on.get("POST /api/ncc/delivery/rooms")?.(
      request("", undefined, { name: "Room 1" }),
      anonymous.response
    );
    expect(anonymous.result).toEqual({
      status: 404,
      body: { error: "EMS data is unavailable for this session." },
    });
    expect(createRoom).not.toHaveBeenCalled();
  });

  it("searches the Moodle picker and groups with encoded queries", async () => {
    const cookie = await login();
    const moodleCourses = vi.fn(async () => ({
      ok: true,
      data: {
        catalog_refreshed_at: "2026-09-12T09:00:00Z",
        warnings: ["stale"],
        error: null,
        courses: [
          {
            id: 7,
            shortname: "AR1",
            idnumber: null,
            fullname: "Arabic Language",
            displayname: null,
            category_id: 3,
            category_name: "Languages",
            visible: true,
          },
        ],
      },
    }));
    const moodleGroups = vi.fn(async () => ({
      ok: true,
      data: [
        {
          moodle_group_id: 9,
          name: "Group A",
          idnumber: "ga",
          courseid: 501,
        },
      ],
    }));
    const routes = captureRoutes({
      env: deliveryEnv(),
      api: { moodleCourses, moodleGroups },
    });
    const picker = responseRecorder();
    const groups = responseRecorder();
    const short = responseRecorder();

    await routes.get("/api/ncc/delivery/moodle-courses")?.(
      request(cookie, undefined, undefined, { q: "arab", refresh: "true" }),
      picker.response
    );
    await routes.get("/api/ncc/delivery/moodle-groups")?.(
      request(cookie, undefined, undefined, {
        courseId: "course-1",
        q: " group a ",
      }),
      groups.response
    );
    await routes.get("/api/ncc/delivery/moodle-groups")?.(
      request(cookie, undefined, undefined, {
        courseId: "course-1",
        q: "x",
      }),
      short.response
    );

    expect(moodleCourses).toHaveBeenCalledWith(
      "access-ncc-session-1",
      "arab",
      true
    );
    expect(moodleGroups).toHaveBeenCalledWith(
      "access-ncc-session-1",
      "course-1",
      "group a"
    );
    expect(picker.result).toEqual({
      status: 200,
      body: {
        refreshedAt: "2026-09-12T09:00:00Z",
        warnings: ["stale"],
        error: null,
        courses: [
          {
            id: 7,
            shortname: "AR1",
            idNumber: null,
            fullname: "Arabic Language",
            displayName: null,
            categoryId: 3,
            categoryName: "Languages",
            visible: true,
          },
        ],
      },
    });
    expect(groups.result).toEqual({
      status: 200,
      body: {
        items: [
          { id: 9, name: "Group A", idNumber: "ga", moodleCourseId: 501 },
        ],
      },
    });
    expect(short.result.status).toBe(400);
    expect(moodleGroups).toHaveBeenCalledTimes(1);
  });

  it("creates and patches courses with exact snake bodies", async () => {
    const cookie = await login();
    const createCourse = vi.fn(async () => ({
      ok: true,
      data: courseRow(),
    }));
    const patchCourse = vi.fn(async () => ({
      ok: true,
      data: courseRow({ sort_order: 4, moodle_attendance_id: 12 }),
    }));
    const routes = captureRoutes({
      env: deliveryEnv(),
      api: { createCourse, patchCourse },
    });
    const created = responseRecorder();
    const patched = responseRecorder();
    const rejected = responseRecorder();
    const badId = responseRecorder();

    await routes.get("POST /api/ncc/delivery/courses")?.(
      request(cookie, undefined, {
        departmentId: "department-1",
        moodleCourseId: 501,
        sortOrder: 2,
      }),
      created.response
    );
    await routes.get("PATCH /api/ncc/delivery/courses/:courseId")?.(
      request(
        cookie,
        { courseId: "course-1" },
        {
          sortOrder: 4,
          moodleAttendanceId: 12,
        }
      ),
      patched.response
    );
    await routes.get("PATCH /api/ncc/delivery/courses/:courseId")?.(
      request(cookie, { courseId: "course-1" }, { fullname: "x" }),
      rejected.response
    );
    await routes.get("POST /api/ncc/delivery/courses")?.(
      request(cookie, undefined, {
        departmentId: "department-1",
        moodleCourseId: 0,
      }),
      badId.response
    );

    expect(createCourse).toHaveBeenCalledWith("access-ncc-session-1", {
      department_id: "department-1",
      moodle_course_id: 501,
      sort_order: 2,
    });
    expect(patchCourse).toHaveBeenCalledWith(
      "access-ncc-session-1",
      "course-1",
      { sort_order: 4, moodle_attendance_id: 12 }
    );
    expect(created.result).toMatchObject({
      status: 200,
      body: { course: { id: "course-1", moodleCourseId: 501 } },
    });
    expect(rejected.result.status).toBe(400);
    expect(badId.result.status).toBe(400);
    expect(patchCourse).toHaveBeenCalledTimes(1);
    expect(createCourse).toHaveBeenCalledTimes(1);
  });

  it("runs course lifecycle and refresh as empty POSTs with passthrough errors", async () => {
    const cookie = await login();
    const disableCourse = vi.fn(async () => ({
      ok: true,
      data: courseRow({ status: "disabled" }),
    }));
    const refreshCourse = vi.fn(async () => ({
      ok: false,
      error: { error: "Not found", status: 404 },
    }));
    const routes = captureRoutes({
      env: deliveryEnv(),
      api: { disableCourse, refreshCourse },
    });
    const disabled = responseRecorder();
    const missing = responseRecorder();

    await routes.get("POST /api/ncc/delivery/courses/:courseId/disable")?.(
      request(cookie, { courseId: "course-1" }),
      disabled.response
    );
    await routes.get("POST /api/ncc/delivery/courses/:courseId/refresh")?.(
      request(cookie, { courseId: "course-9" }),
      missing.response
    );

    expect(disableCourse).toHaveBeenCalledWith(
      "access-ncc-session-1",
      "course-1"
    );
    expect(disabled.result).toMatchObject({
      status: 200,
      body: { course: { status: "disabled" } },
    });
    expect(missing.result).toEqual({
      status: 404,
      body: { error: "Not found" },
    });
  });

  it("derives workspace branch for staff creates and requires it for super admin", async () => {
    const registrarCookie = await login("registrar", "branch-1");
    const superadminCookie = await login();
    const createRoom = vi.fn(async () => ({ ok: true, data: roomRow() }));
    const createClass = vi.fn(async () => ({ ok: true, data: classRow() }));
    const routes = captureRoutes({
      env: deliveryEnv(),
      api: { createRoom, createClass },
    });
    const room = responseRecorder();
    const mismatch = responseRecorder();
    const klass = responseRecorder();
    const superRoom = responseRecorder();
    const superClass = responseRecorder();

    await routes.get("POST /api/ncc/delivery/rooms")?.(
      request(registrarCookie, undefined, { name: "Room 1", capacity: 20 }),
      room.response
    );
    await routes.get("POST /api/ncc/delivery/rooms")?.(
      request(registrarCookie, undefined, {
        name: "Room 1",
        branchId: "branch-2",
      }),
      mismatch.response
    );
    await routes.get("POST /api/ncc/delivery/classes")?.(
      request(registrarCookie, undefined, classBody),
      klass.response
    );
    await routes.get("POST /api/ncc/delivery/rooms")?.(
      request(superadminCookie, undefined, { name: "Room 1" }),
      superRoom.response
    );
    await routes.get("POST /api/ncc/delivery/classes")?.(
      request(superadminCookie, undefined, {
        ...classBody,
        branchId: "branch-9",
      }),
      superClass.response
    );

    expect(createRoom).toHaveBeenCalledWith("access-ncc-session-1", {
      branch_id: "branch-1",
      name: "Room 1",
      capacity: 20,
    });
    expect(createClass).toHaveBeenCalledWith(
      "access-ncc-session-1",
      expect.objectContaining({
        course_id: "course-1",
        branch_id: "branch-1",
        name: "Arabic A",
        capacity: 20,
        start_at: "2026-09-01T10:00:00Z",
        end_at: "2026-12-01T10:00:00Z",
      })
    );
    expect(mismatch.result).toEqual({
      status: 400,
      body: { error: "branchId must match the selected branch." },
    });
    expect(superRoom.result).toEqual({
      status: 400,
      body: { error: "branchId is required." },
    });
    expect(createClass).toHaveBeenLastCalledWith(
      "access-ncc-session-1",
      expect.objectContaining({ branch_id: "branch-9" })
    );
  });

  it("maps class schedules to snake fields and rejects invalid schedules", async () => {
    const cookie = await login("registrar", "branch-1");
    const createClass = vi.fn(async () => ({ ok: true, data: classRow() }));
    const routes = captureRoutes({
      env: deliveryEnv(),
      api: { createClass },
    });
    const created = responseRecorder();
    const invalidDay = responseRecorder();
    const reversed = responseRecorder();
    const extraKey = responseRecorder();

    await routes.get("POST /api/ncc/delivery/classes")?.(
      request(cookie, undefined, {
        ...classBody,
        teacherIds: ["teacher-1"],
        schedule: {
          daysOfWeek: [1, 3],
          startTime: "17:00",
          endTime: "18:30",
        },
        defaultRoomId: null,
      }),
      created.response
    );
    await routes.get("POST /api/ncc/delivery/classes")?.(
      request(cookie, undefined, {
        ...classBody,
        schedule: { daysOfWeek: [1, 7], startTime: "17:00", endTime: "18:00" },
      }),
      invalidDay.response
    );
    await routes.get("POST /api/ncc/delivery/classes")?.(
      request(cookie, undefined, {
        ...classBody,
        schedule: {
          daysOfWeek: [1],
          startTime: "18:00",
          endTime: "17:00",
        },
      }),
      reversed.response
    );
    await routes.get("POST /api/ncc/delivery/classes")?.(
      request(cookie, undefined, { ...classBody, room: "x" }),
      extraKey.response
    );

    expect(createClass).toHaveBeenCalledTimes(1);
    expect(createClass).toHaveBeenCalledWith(
      "access-ncc-session-1",
      expect.objectContaining({
        teacher_ids: ["teacher-1"],
        schedule_days_of_week: [1, 3],
        schedule_start_time: "17:00",
        schedule_end_time: "18:30",
        default_room_id: null,
      })
    );
    expect(invalidDay.result.status).toBe(400);
    expect(reversed.result.status).toBe(400);
    expect(extraKey.result.status).toBe(400);
  });

  it("patches class fields, blocks courseId/branchId, and runs lifecycle", async () => {
    const cookie = await login();
    const patchClass = vi.fn(async () => ({ ok: true, data: classRow() }));
    const enableClass = vi.fn(async () => ({ ok: true, data: classRow() }));
    const routes = captureRoutes({
      env: deliveryEnv(),
      api: { patchClass, enableClass },
    });
    const patched = responseRecorder();
    const rejected = responseRecorder();
    const cleared = responseRecorder();
    const enabled = responseRecorder();

    await routes.get("PATCH /api/ncc/delivery/classes/:classId")?.(
      request(cookie, { classId: "class-1" }, { capacity: 24 }),
      patched.response
    );
    await routes.get("PATCH /api/ncc/delivery/classes/:classId")?.(
      request(cookie, { classId: "class-1" }, { courseId: "course-2" }),
      rejected.response
    );
    await routes.get("PATCH /api/ncc/delivery/classes/:classId")?.(
      request(cookie, { classId: "class-1" }, { schedule: null }),
      cleared.response
    );
    await routes.get("POST /api/ncc/delivery/classes/:classId/enable")?.(
      request(cookie, { classId: "class-1" }),
      enabled.response
    );

    expect(patchClass).toHaveBeenNthCalledWith(
      1,
      "access-ncc-session-1",
      "class-1",
      { capacity: 24 }
    );
    expect(patchClass).toHaveBeenNthCalledWith(
      2,
      "access-ncc-session-1",
      "class-1",
      {
        schedule_days_of_week: null,
        schedule_start_time: null,
        schedule_end_time: null,
      }
    );
    expect(rejected.result.status).toBe(400);
    expect(enableClass).toHaveBeenCalledWith("access-ncc-session-1", "class-1");
  });

  it("enforces class Moodle bind XOR and syncs with an empty POST", async () => {
    const cookie = await login();
    const bindClassMoodle = vi.fn(async () => ({
      ok: true,
      data: classRow(),
    }));
    const syncClassMoodle = vi.fn(async () => ({
      ok: true,
      data: classRow(),
    }));
    const routes = captureRoutes({
      env: deliveryEnv(),
      api: { bindClassMoodle, syncClassMoodle },
    });
    const route = routes.get("POST /api/ncc/delivery/classes/:classId/moodle");
    const create = responseRecorder();
    const link = responseRecorder();
    const both = responseRecorder();
    const missing = responseRecorder();
    const sync = responseRecorder();

    await route?.(
      request(cookie, { classId: "class-1" }, { mode: "create" }),
      create.response
    );
    await route?.(
      request(
        cookie,
        { classId: "class-1" },
        { mode: "link", moodleGroupId: 9 }
      ),
      link.response
    );
    await route?.(
      request(
        cookie,
        { classId: "class-1" },
        { mode: "create", moodleGroupId: 9 }
      ),
      both.response
    );
    await route?.(
      request(cookie, { classId: "class-1" }, { mode: "link" }),
      missing.response
    );
    await routes.get("POST /api/ncc/delivery/classes/:classId/moodle/sync")?.(
      request(cookie, { classId: "class-1" }),
      sync.response
    );

    expect(bindClassMoodle).toHaveBeenNthCalledWith(
      1,
      "access-ncc-session-1",
      "class-1",
      { mode: "create" }
    );
    expect(bindClassMoodle).toHaveBeenNthCalledWith(
      2,
      "access-ncc-session-1",
      "class-1",
      { mode: "link", moodle_group_id: 9 }
    );
    expect(both.result.status).toBe(400);
    expect(missing.result.status).toBe(400);
    expect(bindClassMoodle).toHaveBeenCalledTimes(2);
    expect(syncClassMoodle).toHaveBeenCalledWith(
      "access-ncc-session-1",
      "class-1"
    );
    expect(sync.result).toMatchObject({ status: 200 });
  });

  it("patches rooms without branch and runs room lifecycle", async () => {
    const cookie = await login();
    const patchRoom = vi.fn(async () => ({
      ok: true,
      data: roomRow({ capacity: 30 }),
    }));
    const disableRoom = vi.fn(async () => ({
      ok: true,
      data: roomRow({ status: "disabled" }),
    }));
    const routes = captureRoutes({
      env: deliveryEnv(),
      api: { patchRoom, disableRoom },
    });
    const patched = responseRecorder();
    const branchPatch = responseRecorder();
    const disabled = responseRecorder();

    await routes.get("PATCH /api/ncc/delivery/rooms/:roomId")?.(
      request(cookie, { roomId: "room-1" }, { capacity: 30 }),
      patched.response
    );
    await routes.get("PATCH /api/ncc/delivery/rooms/:roomId")?.(
      request(cookie, { roomId: "room-1" }, { branchId: "branch-2" }),
      branchPatch.response
    );
    await routes.get("POST /api/ncc/delivery/rooms/:roomId/disable")?.(
      request(cookie, { roomId: "room-1" }),
      disabled.response
    );

    expect(patchRoom).toHaveBeenCalledWith("access-ncc-session-1", "room-1", {
      capacity: 30,
    });
    expect(branchPatch.result.status).toBe(400);
    expect(patchRoom).toHaveBeenCalledTimes(1);
    expect(disableRoom).toHaveBeenCalledWith("access-ncc-session-1", "room-1");
    expect(disabled.result).toMatchObject({
      status: 200,
      body: { room: { status: "disabled" } },
    });
  });
});

describe("NCC delivery workflow routes", () => {
  const deliveryEnv = () => env({ NILE_NCC_DELIVERY_WRITES_ENABLED: "1" });
  const rosterRow = {
    student_id: "student-1",
    class_id: "class-1",
    class_name: "Arabic A",
    course_id: "course-1",
    course_name: "Arabic",
    status: "enrolled",
    enrolled_at: "2026-09-10T10:00:00Z",
    withdrawn_at: null,
    student: {
      first_name: "Nile",
      last_name: "Student",
      email: "student@example.test",
      branch_id: "branch-1",
      moodle_user_id: 42,
    },
  };
  const sessionRow = {
    id: "session-1",
    class_id: "class-1",
    class_name: "Arabic A",
    branch_id: "branch-1",
    room_id: "room-1",
    room_name: "Room 1",
    teacher_id: "teacher-1",
    teacher_name: "Nile Teacher",
    starts_at: "2026-09-17T10:00:00Z",
    ends_at: "2026-09-17T11:00:00Z",
    duration_hours: 1,
    status: "scheduled",
    created_at: "2026-09-12T09:00:00Z",
    updated_at: "2026-09-12T09:00:00Z",
  };
  const slot = {
    startsAt: "2026-09-17T10:00:00Z",
    durationHours: 1,
    teacherId: "teacher-1",
  };
  const attendanceRow = {
    moodle_session_id: 55,
    attendanceid: 13,
    ems_session_id: "session-1",
    sessdate: "2026-09-17",
    duration: 3600,
    groupid: 9,
    statuses: [{ id: 1, acronym: "P", description: "Present" }],
    students: [
      {
        student_id: "student-1",
        first_name: "Nile",
        last_name: "Student",
        email: "student@example.test",
        moodle_user_id: 42,
        status_id: "1",
        status_acronym: "P",
        status_description: "Present",
        remarks: null,
      },
    ],
  };
  const gradesRow = {
    class_id: "class-1",
    moodle_course_id: 501,
    course_name: "Arabic",
    students: [
      {
        student_id: "student-1",
        first_name: "Nile",
        last_name: "Student",
        email: "student@example.test",
        moodle_user_id: 42,
        course_grade: "85.00",
        grade_items: [
          {
            id: 7,
            itemname: "Quiz",
            itemtype: "mod",
            itemmodule: "quiz",
            gradeformatted: "9.00",
            percentageformatted: "90.00 %",
            grademin: 0,
            grademax: 10,
          },
        ],
      },
    ],
  };

  it("blocks workflow reads and writes behind their own flags", async () => {
    const classEnrolments = vi.fn();
    const createClassEnrolment = vi.fn();
    const readsOff = captureRoutes({
      env: env({ NILE_NCC_DELIVERY_READS_ENABLED: "0" }),
      api: { classEnrolments },
    });
    const read = responseRecorder();
    await readsOff.get("/api/ncc/delivery/classes/:classId/enrolments")?.(
      request("cookie=1", { classId: "class-1" }),
      read.response
    );
    expect(read.result).toEqual({
      status: 503,
      body: { error: "NCC delivery reads are not active." },
    });

    const writesOff = captureRoutes({ env: env(), api: { createClassEnrolment } });
    const write = responseRecorder();
    await writesOff.get("POST /api/ncc/delivery/classes/:classId/enrolments")?.(
      request("cookie=1", { classId: "class-1" }, { studentId: "student-1" }),
      write.response
    );
    expect(write.result).toEqual({
      status: 503,
      body: { error: "NCC delivery writes are not active." },
    });
    expect(classEnrolments).not.toHaveBeenCalled();
    expect(createClassEnrolment).not.toHaveBeenCalled();
  });

  it("reads roster, sessions, session detail, attendance, and grades", async () => {
    const cookie = await login();
    const classEnrolments = vi.fn(async () => ({ ok: true, data: [rosterRow] }));
    const classSessions = vi.fn(async () => ({ ok: true, data: [sessionRow] }));
    const session = vi.fn(async () => ({ ok: true, data: sessionRow }));
    const sessionAttendance = vi.fn(async () => ({
      ok: true,
      data: attendanceRow,
    }));
    const classGrades = vi.fn(async () => ({ ok: true, data: gradesRow }));
    const routes = captureRoutes({
      env: deliveryEnv(),
      api: {
        classEnrolments,
        classSessions,
        session,
        sessionAttendance,
        classGrades,
      },
    });
    const roster = responseRecorder();
    const sessions = responseRecorder();
    const detail = responseRecorder();
    const attendance = responseRecorder();
    const grades = responseRecorder();

    await routes.get("/api/ncc/delivery/classes/:classId/enrolments")?.(
      request(cookie, { classId: "class-1" }),
      roster.response
    );
    await routes.get("/api/ncc/delivery/classes/:classId/sessions")?.(
      request(cookie, { classId: "class-1" }),
      sessions.response
    );
    await routes.get("/api/ncc/delivery/sessions/:sessionId")?.(
      request(cookie, { sessionId: "session-1" }),
      detail.response
    );
    await routes.get("/api/ncc/delivery/sessions/:sessionId/attendance")?.(
      request(cookie, { sessionId: "session-1" }),
      attendance.response
    );
    await routes.get("/api/ncc/delivery/classes/:classId/grades")?.(
      request(cookie, { classId: "class-1" }),
      grades.response
    );

    expect(classEnrolments).toHaveBeenCalledWith("access-ncc-session-1", "class-1");
    expect(classSessions).toHaveBeenCalledWith("access-ncc-session-1", "class-1");
    expect(session).toHaveBeenCalledWith("access-ncc-session-1", "session-1");
    expect(sessionAttendance).toHaveBeenCalledWith(
      "access-ncc-session-1",
      "session-1"
    );
    expect(classGrades).toHaveBeenCalledWith("access-ncc-session-1", "class-1");
    expect(roster.result).toMatchObject({
      status: 200,
      body: {
        items: [
          {
            studentId: "student-1",
            status: "enrolled",
            student: { moodleLinked: true, branchId: "branch-1" },
          },
        ],
      },
    });
    expect(sessions.result).toMatchObject({
      status: 200,
      body: { items: [{ id: "session-1", status: "scheduled" }] },
    });
    expect(detail.result).toMatchObject({
      status: 200,
      body: { session: { id: "session-1" } },
    });
    expect(attendance.result).toMatchObject({
      status: 200,
      body: {
        attendance: {
          moodleSessionId: 55,
          attendanceId: 13,
          students: [{ studentId: "student-1", statusId: "1" }],
        },
      },
    });
    expect(grades.result).toMatchObject({
      status: 200,
      body: {
        grades: {
          classId: "class-1",
          moodleCourseId: 501,
          students: [{ studentId: "student-1", courseGrade: "85.00" }],
        },
      },
    });
  });

  it("creates, withdraws, and completes enrolments with exact bodies", async () => {
    const cookie = await login();
    const createClassEnrolment = vi.fn(async () => ({
      ok: true,
      data: rosterRow,
    }));
    const withdrawClassEnrolment = vi.fn(async () => ({
      ok: true,
      data: { ...rosterRow, status: "cancelled" },
    }));
    const completeClassEnrolment = vi.fn(async () => ({
      ok: true,
      data: { ...rosterRow, status: "completed" },
    }));
    const routes = captureRoutes({
      env: deliveryEnv(),
      api: {
        createClassEnrolment,
        withdrawClassEnrolment,
        completeClassEnrolment,
      },
    });
    const created = responseRecorder();
    const defaulted = responseRecorder();
    const invalid = responseRecorder();
    const extra = responseRecorder();
    const withdrawn = responseRecorder();
    const completed = responseRecorder();

    await routes.get("POST /api/ncc/delivery/classes/:classId/enrolments")?.(
      request(cookie, { classId: "class-1" }, { studentId: "student-1", status: "pending" }),
      created.response
    );
    await routes.get("POST /api/ncc/delivery/classes/:classId/enrolments")?.(
      request(cookie, { classId: "class-1" }, { studentId: "student-1" }),
      defaulted.response
    );
    await routes.get("POST /api/ncc/delivery/classes/:classId/enrolments")?.(
      request(cookie, { classId: "class-1" }, { studentId: "student-1", status: "cancelled" }),
      invalid.response
    );
    await routes.get("POST /api/ncc/delivery/classes/:classId/enrolments")?.(
      request(cookie, { classId: "class-1" }, { studentId: "student-1", note: "x" }),
      extra.response
    );
    await routes.get(
      "POST /api/ncc/delivery/classes/:classId/enrolments/:studentId/withdraw"
    )?.(
      request(cookie, { classId: "class-1", studentId: "student-1" }),
      withdrawn.response
    );
    await routes.get(
      "POST /api/ncc/delivery/classes/:classId/enrolments/:studentId/complete"
    )?.(
      request(cookie, { classId: "class-1", studentId: "student-1" }),
      completed.response
    );

    expect(createClassEnrolment).toHaveBeenNthCalledWith(
      1,
      "access-ncc-session-1",
      "class-1",
      { student_id: "student-1", status: "pending" }
    );
    expect(createClassEnrolment).toHaveBeenNthCalledWith(
      2,
      "access-ncc-session-1",
      "class-1",
      { student_id: "student-1" }
    );
    expect(createClassEnrolment).toHaveBeenCalledTimes(2);
    expect(invalid.result.status).toBe(400);
    expect(extra.result.status).toBe(400);
    expect(withdrawClassEnrolment).toHaveBeenCalledWith(
      "access-ncc-session-1",
      "class-1",
      "student-1"
    );
    expect(completeClassEnrolment).toHaveBeenCalledWith(
      "access-ncc-session-1",
      "class-1",
      "student-1"
    );
    expect(created.result).toMatchObject({
      status: 200,
      body: { enrolment: { studentId: "student-1" } },
    });
    expect(withdrawn.result).toMatchObject({
      status: 200,
      body: { enrolment: { status: "cancelled" } },
    });
    expect(completed.result).toMatchObject({
      status: 200,
      body: { enrolment: { status: "completed" } },
    });
  });

  it("proposes sessions with snake mapping and validates the range", async () => {
    const cookie = await login();
    const proposeClassSessions = vi.fn(async () => ({
      ok: true,
      data: {
        slots: [
          {
            starts_at: "2026-09-21T13:00:00Z",
            duration_hours: 1,
            teacher_id: "teacher-1",
            room_id: null,
          },
        ],
      },
    }));
    const routes = captureRoutes({
      env: deliveryEnv(),
      api: { proposeClassSessions },
    });
    const proposed = responseRecorder();
    const badDays = responseRecorder();
    const reversed = responseRecorder();
    const extra = responseRecorder();

    await routes.get(
      "POST /api/ncc/delivery/classes/:classId/sessions/propose"
    )?.(
      request(cookie, { classId: "class-1" }, {
        weekdays: [1, 3],
        hoursPerDay: 2,
        fromDate: "2026-09-17",
        toDate: "2026-10-17",
        startHour: 13,
      }),
      proposed.response
    );
    await routes.get(
      "POST /api/ncc/delivery/classes/:classId/sessions/propose"
    )?.(
      request(cookie, { classId: "class-1" }, {
        weekdays: [1, 1],
        hoursPerDay: 2,
        fromDate: "2026-09-17",
        toDate: "2026-10-17",
      }),
      badDays.response
    );
    await routes.get(
      "POST /api/ncc/delivery/classes/:classId/sessions/propose"
    )?.(
      request(cookie, { classId: "class-1" }, {
        weekdays: [1],
        hoursPerDay: 2,
        fromDate: "2026-10-17",
        toDate: "2026-09-17",
      }),
      reversed.response
    );
    await routes.get(
      "POST /api/ncc/delivery/classes/:classId/sessions/propose"
    )?.(
      request(cookie, { classId: "class-1" }, {
        weekdays: [1],
        hoursPerDay: 2,
        fromDate: "2026-09-17",
        toDate: "2026-10-17",
        roomId: "room-1",
      }),
      extra.response
    );

    expect(proposeClassSessions).toHaveBeenCalledTimes(1);
    expect(proposeClassSessions).toHaveBeenCalledWith(
      "access-ncc-session-1",
      "class-1",
      {
        weekdays: [1, 3],
        hours_per_day: 2,
        from_date: "2026-09-17",
        to_date: "2026-10-17",
        start_hour: 13,
      }
    );
    expect(proposed.result).toEqual({
      status: 200,
      body: {
        slots: [
          {
            startsAt: "2026-09-21T13:00:00Z",
            durationHours: 1,
            teacherId: "teacher-1",
            roomId: null,
          },
        ],
      },
    });
    expect(badDays.result.status).toBe(400);
    expect(reversed.result.status).toBe(400);
    expect(extra.result.status).toBe(400);
  });

  it("confirms and batches slots with exact mapping and unique starts", async () => {
    const cookie = await login();
    const confirmClassSessions = vi.fn(async () => ({
      ok: true,
      data: { sessions: [sessionRow], created_count: 1 },
    }));
    const batchClassSessions = vi.fn(async () => ({
      ok: true,
      data: { sessions: [sessionRow], created_count: 1 },
    }));
    const routes = captureRoutes({
      env: deliveryEnv(),
      api: { confirmClassSessions, batchClassSessions },
    });
    const confirmed = responseRecorder();
    const batched = responseRecorder();
    const duplicate = responseRecorder();
    const empty = responseRecorder();
    const malformed = responseRecorder();

    await routes.get(
      "POST /api/ncc/delivery/classes/:classId/sessions/confirm"
    )?.(
      request(cookie, { classId: "class-1" }, {
        slots: [{ ...slot, roomId: "room-1" }],
      }),
      confirmed.response
    );
    await routes.get(
      "POST /api/ncc/delivery/classes/:classId/sessions/batch"
    )?.(
      request(cookie, { classId: "class-1" }, { slots: [slot] }),
      batched.response
    );
    await routes.get(
      "POST /api/ncc/delivery/classes/:classId/sessions/batch"
    )?.(
      request(cookie, { classId: "class-1" }, { slots: [slot, slot] }),
      duplicate.response
    );
    await routes.get(
      "POST /api/ncc/delivery/classes/:classId/sessions/batch"
    )?.(
      request(cookie, { classId: "class-1" }, { slots: [] }),
      empty.response
    );
    await routes.get(
      "POST /api/ncc/delivery/classes/:classId/sessions/confirm"
    )?.(
      request(cookie, { classId: "class-1" }, {
        slots: [{ ...slot, durationHours: 0 }],
      }),
      malformed.response
    );

    expect(confirmClassSessions).toHaveBeenCalledWith(
      "access-ncc-session-1",
      "class-1",
      {
        slots: [
          {
            starts_at: "2026-09-17T10:00:00Z",
            duration_hours: 1,
            teacher_id: "teacher-1",
            room_id: "room-1",
          },
        ],
      }
    );
    expect(batchClassSessions).toHaveBeenCalledWith(
      "access-ncc-session-1",
      "class-1",
      {
        slots: [
          {
            starts_at: "2026-09-17T10:00:00Z",
            duration_hours: 1,
            teacher_id: "teacher-1",
            room_id: null,
          },
        ],
      }
    );
    expect(confirmed.result).toMatchObject({
      status: 200,
      body: { createdCount: 1, items: [{ id: "session-1" }] },
    });
    expect(duplicate.result.status).toBe(400);
    expect(empty.result.status).toBe(400);
    expect(malformed.result.status).toBe(400);
    expect(batchClassSessions).toHaveBeenCalledTimes(1);
  });

  it("patches and cancels sessions with field limits", async () => {
    const cookie = await login();
    const patchSession = vi.fn(async () => ({ ok: true, data: sessionRow }));
    const cancelSession = vi.fn(async () => ({
      ok: true,
      data: { ...sessionRow, status: "cancelled" },
    }));
    const routes = captureRoutes({
      env: deliveryEnv(),
      api: { patchSession, cancelSession },
    });
    const patched = responseRecorder();
    const emptyPatch = responseRecorder();
    const extra = responseRecorder();
    const reversed = responseRecorder();
    const cancelled = responseRecorder();

    await routes.get("PATCH /api/ncc/delivery/sessions/:sessionId")?.(
      request(cookie, { sessionId: "session-1" }, {
        durationHours: 2,
        roomId: null,
        teacherId: "teacher-2",
      }),
      patched.response
    );
    await routes.get("PATCH /api/ncc/delivery/sessions/:sessionId")?.(
      request(cookie, { sessionId: "session-1" }, {}),
      emptyPatch.response
    );
    await routes.get("PATCH /api/ncc/delivery/sessions/:sessionId")?.(
      request(cookie, { sessionId: "session-1" }, { classId: "x" }),
      extra.response
    );
    await routes.get("PATCH /api/ncc/delivery/sessions/:sessionId")?.(
      request(cookie, { sessionId: "session-1" }, {
        startsAt: "2026-09-17T12:00:00Z",
        endsAt: "2026-09-17T11:00:00Z",
      }),
      reversed.response
    );
    await routes.get("POST /api/ncc/delivery/sessions/:sessionId/cancel")?.(
      request(cookie, { sessionId: "session-1" }),
      cancelled.response
    );

    expect(patchSession).toHaveBeenCalledTimes(1);
    expect(patchSession).toHaveBeenCalledWith(
      "access-ncc-session-1",
      "session-1",
      { duration_hours: 2, room_id: null, teacher_id: "teacher-2" }
    );
    expect(emptyPatch.result.status).toBe(400);
    expect(extra.result.status).toBe(400);
    expect(reversed.result.status).toBe(400);
    expect(cancelSession).toHaveBeenCalledWith(
      "access-ncc-session-1",
      "session-1"
    );
    expect(cancelled.result).toMatchObject({
      status: 200,
      body: { session: { status: "cancelled" } },
    });
  });

  it("marks attendance with snake marks and accepts an empty replace", async () => {
    const cookie = await login();
    const markSessionAttendance = vi.fn(async () => ({
      ok: true,
      data: attendanceRow,
    }));
    const routes = captureRoutes({
      env: deliveryEnv(),
      api: { markSessionAttendance },
    });
    const marked = responseRecorder();
    const cleared = responseRecorder();
    const duplicate = responseRecorder();
    const badStatus = responseRecorder();

    await routes.get("POST /api/ncc/delivery/sessions/:sessionId/attendance")?.(
      request(cookie, { sessionId: "session-1" }, {
        marks: [{ studentId: "student-1", statusId: 1 }],
      }),
      marked.response
    );
    await routes.get("POST /api/ncc/delivery/sessions/:sessionId/attendance")?.(
      request(cookie, { sessionId: "session-1" }, { marks: [] }),
      cleared.response
    );
    await routes.get("POST /api/ncc/delivery/sessions/:sessionId/attendance")?.(
      request(cookie, { sessionId: "session-1" }, {
        marks: [
          { studentId: "student-1", statusId: 1 },
          { studentId: "student-1", statusId: 2 },
        ],
      }),
      duplicate.response
    );
    await routes.get("POST /api/ncc/delivery/sessions/:sessionId/attendance")?.(
      request(cookie, { sessionId: "session-1" }, {
        marks: [{ studentId: "student-1", statusId: "P" }],
      }),
      badStatus.response
    );

    expect(markSessionAttendance).toHaveBeenNthCalledWith(
      1,
      "access-ncc-session-1",
      "session-1",
      { marks: [{ student_id: "student-1", status_id: 1 }] }
    );
    expect(markSessionAttendance).toHaveBeenNthCalledWith(
      2,
      "access-ncc-session-1",
      "session-1",
      { marks: [] }
    );
    expect(markSessionAttendance).toHaveBeenCalledTimes(2);
    expect(marked.result).toMatchObject({
      status: 200,
      body: { attendance: { moodleSessionId: 55 } },
    });
    expect(duplicate.result.status).toBe(400);
    expect(badStatus.result.status).toBe(400);
  });

  it("passes provider errors through and fails closed on malformed payloads", async () => {
    const cookie = await login();
    const forbidden = vi.fn(async () => ({
      ok: false,
      error: { error: "Forbidden", status: 403 },
    }));
    const malformed = vi.fn(async () => ({
      ok: true,
      data: { moodle_session_id: "x" },
    }));
    const routes = captureRoutes({
      env: deliveryEnv(),
      api: { sessionAttendance: forbidden },
    });
    const denied = responseRecorder();
    await routes.get("/api/ncc/delivery/sessions/:sessionId/attendance")?.(
      request(cookie, { sessionId: "session-1" }),
      denied.response
    );
    expect(denied.result).toEqual({
      status: 403,
      body: { error: "Forbidden" },
    });

    const badRoutes = captureRoutes({
      env: deliveryEnv(),
      api: { sessionAttendance: malformed },
    });
    const bad = responseRecorder();
    await badRoutes.get("/api/ncc/delivery/sessions/:sessionId/attendance")?.(
      request(cookie, { sessionId: "session-1" }),
      bad.response
    );
    expect(bad.result).toEqual({
      status: 502,
      body: { error: "NCC EMS returned invalid delivery data." },
    });
  });
});

describe("NCC delivery workflow routes review hardening", () => {
  const deliveryEnv = () => env({ NILE_NCC_DELIVERY_WRITES_ENABLED: "1" });
  const sessionRow = {
    id: "session-1",
    class_id: "class-1",
    class_name: "Arabic A",
    branch_id: "branch-1",
    room_id: "room-1",
    room_name: "Room 1",
    teacher_id: "teacher-1",
    teacher_name: "Nile Teacher",
    starts_at: "2026-09-17T10:00:00Z",
    ends_at: "2026-09-17T11:00:00Z",
    duration_hours: 1,
    status: "scheduled",
    created_at: "2026-09-12T09:00:00Z",
    updated_at: "2026-09-12T09:00:00Z",
  };
  const rosterRow = {
    student_id: "student-1",
    class_id: "class-1",
    class_name: "Arabic A",
    course_id: "course-1",
    course_name: "Arabic",
    status: "enrolled",
    enrolled_at: "2026-09-10T10:00:00Z",
    withdrawn_at: null,
    student: {
      first_name: "Nile",
      last_name: "Student",
      email: "student@example.test",
      branch_id: "branch-1",
      moodle_user_id: 42,
    },
  };
  const attendanceRow = {
    moodle_session_id: 55,
    attendanceid: 13,
    ems_session_id: "session-1",
    sessdate: "2026-09-17",
    duration: 3600,
    groupid: 9,
    statuses: [],
    students: [],
  };

  it("rejects impossible calendar dates before the provider", async () => {
    const cookie = await login();
    const proposeClassSessions = vi.fn();
    const routes = captureRoutes({
      env: deliveryEnv(),
      api: { proposeClassSessions },
    });
    const impossible = responseRecorder();
    await routes.get(
      "POST /api/ncc/delivery/classes/:classId/sessions/propose"
    )?.(
      request(cookie, { classId: "class-1" }, {
        weekdays: [1],
        hoursPerDay: 1,
        fromDate: "2026-02-30",
        toDate: "2026-03-05",
      }),
      impossible.response
    );
    expect(impossible.result.status).toBe(400);
    expect(proposeClassSessions).not.toHaveBeenCalled();
  });

  it("trims slot teacher/room IDs before upstream", async () => {
    const cookie = await login();
    const batchClassSessions = vi.fn(async () => ({
      ok: true,
      data: { sessions: [sessionRow], created_count: 1 },
    }));
    const routes = captureRoutes({
      env: deliveryEnv(),
      api: { batchClassSessions },
    });
    const sent = responseRecorder();
    await routes.get(
      "POST /api/ncc/delivery/classes/:classId/sessions/batch"
    )?.(
      request(cookie, { classId: "class-1" }, {
        slots: [
          {
            startsAt: "2026-09-17T10:00:00Z",
            durationHours: 1,
            teacherId: " teacher-1 ",
            roomId: " room-1 ",
          },
        ],
      }),
      sent.response
    );
    expect(batchClassSessions).toHaveBeenCalledWith(
      "access-ncc-session-1",
      "class-1",
      {
        slots: [
          {
            starts_at: "2026-09-17T10:00:00Z",
            duration_hours: 1,
            teacher_id: "teacher-1",
            room_id: "room-1",
          },
        ],
      }
    );
    expect(sent.result.status).toBe(200);
  });

  it("trims attendance mark student IDs and rejects padded duplicates", async () => {
    const cookie = await login();
    const markSessionAttendance = vi.fn(async () => ({
      ok: true,
      data: attendanceRow,
    }));
    const routes = captureRoutes({
      env: deliveryEnv(),
      api: { markSessionAttendance },
    });
    const marked = responseRecorder();
    const duplicate = responseRecorder();
    await routes.get("POST /api/ncc/delivery/sessions/:sessionId/attendance")?.(
      request(cookie, { sessionId: "session-1" }, {
        marks: [{ studentId: " student-1 ", statusId: 1 }],
      }),
      marked.response
    );
    await routes.get("POST /api/ncc/delivery/sessions/:sessionId/attendance")?.(
      request(cookie, { sessionId: "session-1" }, {
        marks: [
          { studentId: "student-1", statusId: 1 },
          { studentId: " student-1 ", statusId: 2 },
        ],
      }),
      duplicate.response
    );
    expect(markSessionAttendance).toHaveBeenCalledTimes(1);
    expect(markSessionAttendance).toHaveBeenCalledWith(
      "access-ncc-session-1",
      "session-1",
      { marks: [{ student_id: "student-1", status_id: 1 }] }
    );
    expect(duplicate.result.status).toBe(400);
  });

  it("rejects non-empty bodies on lifecycle actions before the provider", async () => {
    const cookie = await login();
    const withdrawClassEnrolment = vi.fn();
    const completeClassEnrolment = vi.fn();
    const cancelSession = vi.fn();
    const routes = captureRoutes({
      env: deliveryEnv(),
      api: { withdrawClassEnrolment, completeClassEnrolment, cancelSession },
    });
    const withdrawn = responseRecorder();
    const completed = responseRecorder();
    const cancelled = responseRecorder();
    await routes.get(
      "POST /api/ncc/delivery/classes/:classId/enrolments/:studentId/withdraw"
    )?.(
      request(cookie, { classId: "class-1", studentId: "student-1" }, { reason: "x" }),
      withdrawn.response
    );
    await routes.get(
      "POST /api/ncc/delivery/classes/:classId/enrolments/:studentId/complete"
    )?.(
      request(cookie, { classId: "class-1", studentId: "student-1" }, { note: 1 }),
      completed.response
    );
    await routes.get("POST /api/ncc/delivery/sessions/:sessionId/cancel")?.(
      request(cookie, { sessionId: "session-1" }, { note: "x" }),
      cancelled.response
    );
    expect(withdrawn.result.status).toBe(400);
    expect(completed.result.status).toBe(400);
    expect(cancelled.result.status).toBe(400);
    expect(withdrawClassEnrolment).not.toHaveBeenCalled();
    expect(completeClassEnrolment).not.toHaveBeenCalled();
    expect(cancelSession).not.toHaveBeenCalled();
  });

  it("passes provider write errors through unchanged", async () => {
    const cookie = await login();
    const markSessionAttendance = vi.fn(async () => ({
      ok: false,
      error: { error: "Access control exception", status: 400 },
    }));
    const createClassEnrolment = vi.fn(async () => ({
      ok: false,
      error: { error: "Student is already enrolled", status: 409 },
    }));
    const routes = captureRoutes({
      env: deliveryEnv(),
      api: { markSessionAttendance, createClassEnrolment },
    });
    const denied = responseRecorder();
    const conflict = responseRecorder();
    await routes.get("POST /api/ncc/delivery/sessions/:sessionId/attendance")?.(
      request(cookie, { sessionId: "session-1" }, { marks: [] }),
      denied.response
    );
    await routes.get("POST /api/ncc/delivery/classes/:classId/enrolments")?.(
      request(cookie, { classId: "class-1" }, { studentId: "student-1" }),
      conflict.response
    );
    expect(denied.result).toEqual({
      status: 400,
      body: { error: "Access control exception" },
    });
    expect(conflict.result).toEqual({
      status: 409,
      body: { error: "Student is already enrolled" },
    });
  });
});

describe("NCC system health route", () => {
  const systemEnv = () => env({ NILE_NCC_SYSTEM_READS_ENABLED: "1" });
  const healthRow = {
    status: "healthy",
    checked_at: "2026-09-14T10:00:00Z",
    components: {
      api: { status: "ok", detail: null },
      database: { status: "ok", detail: null },
      schema_check: { status: "ok", detail: null, missing_tables: null },
      migration: { status: "ok", detail: null, version: "2026.09.01" },
      moodle: {
        status: "ok",
        detail: null,
        configured: true,
        has_token: true,
        reachable: true,
        sitename: "Moodle No Data",
        release: "4.5.7+",
        version_expected: true,
        warnings: [],
      },
    },
  };

  it("returns 503 without calling the provider while the system flag is off", async () => {
    const systemHealth = vi.fn();
    const routes = captureRoutes({
      env: env({ NILE_NCC_SYSTEM_READS_ENABLED: "0" }),
      api: { systemHealth },
    });
    const read = responseRecorder();
    await routes.get("/api/ncc/system/health")?.(
      request("cookie=1"),
      read.response
    );
    expect(read.result).toEqual({
      status: 503,
      body: { error: "NCC system reads are not active." },
    });
    expect(systemHealth).not.toHaveBeenCalled();
  });

  it("returns 404 without an NCC session cookie", async () => {
    const systemHealth = vi.fn();
    const routes = captureRoutes({ env: systemEnv(), api: { systemHealth } });
    const read = responseRecorder();
    await routes.get("/api/ncc/system/health")?.(
      request(),
      read.response
    );
    expect(read.result.status).toBe(404);
    expect(systemHealth).not.toHaveBeenCalled();
  });

  it("returns the normalized health shape", async () => {
    const cookie = await login();
    const systemHealth = vi.fn(async () => ({ ok: true, data: healthRow }));
    const routes = captureRoutes({ env: systemEnv(), api: { systemHealth } });
    const read = responseRecorder();
    await routes.get("/api/ncc/system/health")?.(
      request(cookie),
      read.response
    );
    expect(read.result).toEqual({
      status: 200,
      body: {
        health: {
          status: "healthy",
          checkedAt: "2026-09-14T10:00:00Z",
          components: {
            api: { status: "ok", detail: null },
            database: { status: "ok", detail: null },
            schemaCheck: { status: "ok", detail: null, missingTables: null },
            migration: {
              status: "ok",
              detail: null,
              version: "2026.09.01",
            },
            moodle: {
              status: "ok",
              detail: null,
              configured: true,
              reachable: true,
              siteName: "Moodle No Data",
              release: "4.5.7+",
              versionExpected: true,
              warnings: [],
            },
          },
        },
      },
    });
    expect(read.headers.get("Cache-Control")).toBe("private, no-store");
    expect(read.headers.get("Vary")).toBe("Cookie");
  });

  it("passes provider errors through and fails closed on malformed payloads", async () => {
    const cookie = await login();
    const forbidden = vi.fn(async () => ({
      ok: false,
      error: { error: "Forbidden", status: 403 },
    }));
    const routes = captureRoutes({
      env: systemEnv(),
      api: { systemHealth: forbidden },
    });
    const denied = responseRecorder();
    await routes.get("/api/ncc/system/health")?.(
      request(cookie),
      denied.response
    );
    expect(denied.result).toEqual({
      status: 403,
      body: { error: "Forbidden" },
    });

    const malformed = vi.fn(async () => ({
      ok: true,
      data: { status: "healthy" },
    }));
    const badRoutes = captureRoutes({
      env: systemEnv(),
      api: { systemHealth: malformed },
    });
    const bad = responseRecorder();
    await badRoutes.get("/api/ncc/system/health")?.(
      request(cookie),
      bad.response
    );
    expect(bad.result).toEqual({
      status: 502,
      body: { error: "NCC EMS returned invalid system data." },
    });
  });
});

describe("NCC dashboard summary route", () => {
  const dashboardEnv = () =>
    env({ NILE_NCC_DASHBOARD_READS_ENABLED: "1" });
  const summaryRow = {
    cards: {
      active_students: 1,
      open_leads: 0,
      active_classes: 1,
      enrolment_fill: 1,
      enrolment_capacity: 20,
      scheduled_placements: 0,
      scheduled_trials: 0,
      staff_count: 4,
    },
    by_branch: [
      {
        branch_id: "branch-1",
        branch_name: "NILE-QA-20260914",
        active_students: 1,
        open_leads: 0,
        active_classes: 1,
        enrolment_fill: 1,
        enrolment_capacity: 20,
        scheduled_placements: 0,
        scheduled_trials: 0,
        staff_count: 4,
      },
    ],
    charts: {
      students_by_branch: [
        { key: "branch-1", label: "NILE-QA-20260914", count: 1 },
      ],
      leads_by_status: [],
      placement_trial_by_status: [],
      class_fill_by_branch: [],
    },
  };

  it("returns 503 without calling the provider while the dashboard flag is off", async () => {
    const dashboardSummary = vi.fn();
    const routes = captureRoutes({
      env: env({ NILE_NCC_DASHBOARD_READS_ENABLED: "0" }),
      api: { dashboardSummary },
    });
    const read = responseRecorder();
    await routes.get("/api/ncc/dashboard/summary")?.(
      request("cookie=1"),
      read.response
    );
    expect(read.result).toEqual({
      status: 503,
      body: { error: "NCC dashboard reads are not active." },
    });
    expect(dashboardSummary).not.toHaveBeenCalled();
  });

  it("returns 404 without an NCC session cookie", async () => {
    const dashboardSummary = vi.fn();
    const routes = captureRoutes({
      env: dashboardEnv(),
      api: { dashboardSummary },
    });
    const read = responseRecorder();
    await routes.get("/api/ncc/dashboard/summary")?.(
      request(),
      read.response
    );
    expect(read.result.status).toBe(404);
    expect(dashboardSummary).not.toHaveBeenCalled();
  });

  it("returns the normalized summary shape", async () => {
    const cookie = await login();
    const dashboardSummary = vi.fn(async () => ({
      ok: true,
      data: summaryRow,
    }));
    const routes = captureRoutes({
      env: dashboardEnv(),
      api: { dashboardSummary },
    });
    const read = responseRecorder();
    await routes.get("/api/ncc/dashboard/summary")?.(
      request(cookie),
      read.response
    );
    expect(read.result).toEqual({
      status: 200,
      body: {
        summary: {
          cards: {
            activeStudents: 1,
            openLeads: 0,
            activeClasses: 1,
            enrolmentFill: 1,
            enrolmentCapacity: 20,
            scheduledPlacements: 0,
            scheduledTrials: 0,
            staffCount: 4,
          },
          byBranch: [
            {
              branchId: "branch-1",
              branchName: "NILE-QA-20260914",
              activeStudents: 1,
              openLeads: 0,
              activeClasses: 1,
              enrolmentFill: 1,
              enrolmentCapacity: 20,
              scheduledPlacements: 0,
              scheduledTrials: 0,
              staffCount: 4,
            },
          ],
          charts: {
            studentsByBranch: [
              { key: "branch-1", label: "NILE-QA-20260914", count: 1 },
            ],
            leadsByStatus: [],
            placementTrialByStatus: [],
            classFillByBranch: [],
          },
        },
      },
    });
    expect(read.headers.get("Cache-Control")).toBe("private, no-store");
    expect(read.headers.get("Vary")).toBe("Cookie");
  });

  it("passes provider errors through and fails closed on malformed payloads", async () => {
    const cookie = await login();
    const forbidden = vi.fn(async () => ({
      ok: false,
      error: { error: "Forbidden", status: 403 },
    }));
    const routes = captureRoutes({
      env: dashboardEnv(),
      api: { dashboardSummary: forbidden },
    });
    const denied = responseRecorder();
    await routes.get("/api/ncc/dashboard/summary")?.(
      request(cookie),
      denied.response
    );
    expect(denied.result).toEqual({
      status: 403,
      body: { error: "Forbidden" },
    });

    const malformed = vi.fn(async () => ({
      ok: true,
      data: { cards: { active_students: -1 } },
    }));
    const badRoutes = captureRoutes({
      env: dashboardEnv(),
      api: { dashboardSummary: malformed },
    });
    const bad = responseRecorder();
    await badRoutes.get("/api/ncc/dashboard/summary")?.(
      request(cookie),
      bad.response
    );
    expect(bad.result).toEqual({
      status: 502,
      body: { error: "NCC EMS returned invalid dashboard data." },
    });
  });
});

describe("NCC audit events route", () => {
  const auditEnv = () => env({ NILE_NCC_AUDIT_READS_ENABLED: "1" });
  const auditRow = {
    id: "evt-1",
    stream: "auth",
    event_type: "auth.login.success",
    created_at: "2026-09-14T10:00:00Z",
    actor_display_name: "QA Admin",
    actor_user_id: "user-1",
    branch_id: null,
    entity_id: null,
    entity_label: null,
    secondary_entity_id: null,
    target_user_id: null,
    payload: { secret: "never" },
    ip_address: "10.0.0.1",
    user_agent: "curl/1.0",
  };

  it("returns 503 without calling the provider while the audit flag is off", async () => {
    const auditEvents = vi.fn();
    const routes = captureRoutes({
      env: env({ NILE_NCC_AUDIT_READS_ENABLED: "0" }),
      api: { auditEvents },
    });
    const read = responseRecorder();
    await routes.get("/api/ncc/audit/events")?.(
      request("cookie=1", undefined, undefined, { limit: "50" }),
      read.response
    );
    expect(read.result).toEqual({
      status: 503,
      body: { error: "NCC audit reads are not active." },
    });
    expect(auditEvents).not.toHaveBeenCalled();
  });

  it("returns 404 without an NCC session cookie", async () => {
    const auditEvents = vi.fn();
    const routes = captureRoutes({ env: auditEnv(), api: { auditEvents } });
    const read = responseRecorder();
    await routes.get("/api/ncc/audit/events")?.(request(), read.response);
    expect(read.result.status).toBe(404);
    expect(auditEvents).not.toHaveBeenCalled();
  });

  it("returns normalized events without payload, ip, or user agent", async () => {
    const cookie = await login();
    const auditEvents = vi.fn(async () => ({ ok: true, data: [auditRow] }));
    const routes = captureRoutes({ env: auditEnv(), api: { auditEvents } });
    const read = responseRecorder();
    await routes.get("/api/ncc/audit/events")?.(
      request(cookie, undefined, undefined, {
        stream: "auth",
        eventType: "  auth.login  ",
        limit: "25",
      }),
      read.response
    );
    expect(auditEvents).toHaveBeenCalledWith("access-ncc-session-1", {
      stream: "auth",
      eventType: "auth.login",
      limit: 25,
    });
    expect(read.result.status).toBe(200);
    const body = read.result.body as { items: Record<string, unknown>[] };
    expect(body.items[0]).toEqual({
      id: "evt-1",
      stream: "auth",
      eventType: "auth.login.success",
      createdAt: "2026-09-14T10:00:00Z",
      actorDisplayName: "QA Admin",
      actorUserId: "user-1",
      branchId: null,
      entityId: null,
      entityLabel: null,
      secondaryEntityId: null,
      targetUserId: null,
    });
    expect(read.headers.get("Cache-Control")).toBe("private, no-store");
    expect(read.headers.get("Vary")).toBe("Cookie");
  });

  it("rejects unexpected keys, bad stream, and bad limit", async () => {
    const cookie = await login();
    const auditEvents = vi.fn();
    const routes = captureRoutes({ env: auditEnv(), api: { auditEvents } });
    for (const query of [
      { extra: "x" },
      { stream: "payments" },
      { limit: "0" },
      { limit: "101" },
      { limit: "abc" },
      { eventType: "   " },
    ]) {
      const read = responseRecorder();
      await routes.get("/api/ncc/audit/events")?.(
        request(cookie, undefined, undefined, query),
        read.response
      );
      expect(read.result).toEqual({
        status: 400,
        body: { error: "Request query is invalid." },
      });
    }
    expect(auditEvents).not.toHaveBeenCalled();
  });

  it("passes provider errors through and fails closed on malformed payloads", async () => {
    const cookie = await login();
    const forbidden = vi.fn(async () => ({
      ok: false,
      error: { error: "Forbidden", status: 403 },
    }));
    const routes = captureRoutes({
      env: auditEnv(),
      api: { auditEvents: forbidden },
    });
    const denied = responseRecorder();
    await routes.get("/api/ncc/audit/events")?.(
      request(cookie),
      denied.response
    );
    expect(denied.result).toEqual({
      status: 403,
      body: { error: "Forbidden" },
    });

    const malformed = vi.fn(async () => ({
      ok: true,
      data: [{ id: "evt-1", stream: "payments" }],
    }));
    const badRoutes = captureRoutes({
      env: auditEnv(),
      api: { auditEvents: malformed },
    });
    const bad = responseRecorder();
    await badRoutes.get("/api/ncc/audit/events")?.(
      request(cookie),
      bad.response
    );
    expect(bad.result).toEqual({
      status: 502,
      body: { error: "NCC EMS returned invalid audit data." },
    });
  });
});

describe("NCC notification routes", () => {
  const notificationsEnv = () =>
    env({ NILE_NCC_NOTIFICATIONS_ENABLED: "1" });
  const notificationRow = {
    id: "ntf-1",
    category: "operations",
    kind: "enrolment",
    title: "Learner enrolled",
    body: "A learner was enrolled.",
    created_at: "2026-09-14T10:00:00Z",
    read_at: null,
    payload: { secret: "never" },
  };

  it("returns 503 without calling the provider while the flag is off", async () => {
    const notifications = vi.fn();
    const routes = captureRoutes({
      env: env({ NILE_NCC_NOTIFICATIONS_ENABLED: "0" }),
      api: { notifications },
    });
    const read = responseRecorder();
    await routes.get("/api/ncc/notifications")?.(
      request("cookie=1", undefined, undefined, { limit: "6" }),
      read.response
    );
    expect(read.result).toEqual({
      status: 503,
      body: { error: "NCC notifications reads are not active." },
    });
    expect(notifications).not.toHaveBeenCalled();
  });

  it("returns 404 without an NCC session cookie", async () => {
    const notifications = vi.fn();
    const routes = captureRoutes({
      env: notificationsEnv(),
      api: { notifications },
    });
    const read = responseRecorder();
    await routes.get("/api/ncc/notifications")?.(request(), read.response);
    expect(read.result.status).toBe(404);
    expect(notifications).not.toHaveBeenCalled();
  });

  it("returns normalized items without payload and validates query", async () => {
    const cookie = await login();
    const notifications = vi.fn(async () => ({
      ok: true,
      data: [notificationRow],
    }));
    const routes = captureRoutes({
      env: notificationsEnv(),
      api: { notifications },
    });
    const read = responseRecorder();
    await routes.get("/api/ncc/notifications")?.(
      request(cookie, undefined, undefined, {
        unread: "true",
        limit: "6",
      }),
      read.response
    );
    expect(notifications).toHaveBeenCalledWith("access-ncc-session-1", {
      unread: true,
      limit: 6,
    });
    const body = read.result.body as { items: Record<string, unknown>[] };
    expect(read.result.status).toBe(200);
    expect(body.items[0]).toEqual({
      id: "ntf-1",
      category: "operations",
      kind: "enrolment",
      title: "Learner enrolled",
      body: "A learner was enrolled.",
      createdAt: "2026-09-14T10:00:00Z",
      readAt: null,
    });
    expect("payload" in body.items[0]).toBe(false);
    expect(read.headers.get("Cache-Control")).toBe("private, no-store");
    expect(read.headers.get("Vary")).toBe("Cookie");

    for (const query of [
      { extra: "x" },
      { unread: "yes" },
      { limit: "0" },
      { limit: "101" },
    ]) {
      const bad = responseRecorder();
      await routes.get("/api/ncc/notifications")?.(
        request(cookie, undefined, undefined, query),
        bad.response
      );
      expect(bad.result.status).toBe(400);
    }

    const count = responseRecorder();
    const unreadCount = vi.fn(async () => ({
      ok: true,
      data: { unread_count: 2 },
    }));
    const countRoutes = captureRoutes({
      env: notificationsEnv(),
      api: { notificationUnreadCount: unreadCount },
    });
    await countRoutes.get("/api/ncc/notifications/unread-count")?.(
      request(cookie),
      count.response
    );
    expect(count.result).toEqual({
      status: 200,
      body: { unreadCount: 2 },
    });
  });

  it("marks one and all notifications read with empty bodies only", async () => {
    const cookie = await login();
    const markNotificationRead = vi.fn(async () => ({
      ok: true,
      data: { ...notificationRow, read_at: "2026-09-14T11:00:00Z" },
    }));
    const markAllNotificationsRead = vi.fn(async () => ({
      ok: true,
      data: { marked_read: 2 },
    }));
    const routes = captureRoutes({
      env: notificationsEnv(),
      api: { markNotificationRead, markAllNotificationsRead },
    });
    const one = responseRecorder();
    await routes.get("POST /api/ncc/notifications/:notificationId/read")?.(
      request(cookie, { notificationId: "ntf-1" }),
      one.response
    );
    expect(markNotificationRead).toHaveBeenCalledWith(
      "access-ncc-session-1",
      "ntf-1"
    );
    expect(one.result.status).toBe(200);
    expect(
      (one.result.body as { notification: { readAt: string } }).notification
        .readAt
    ).toBe("2026-09-14T11:00:00Z");

    const all = responseRecorder();
    await routes.get("POST /api/ncc/notifications/read-all")?.(
      request(cookie),
      all.response
    );
    expect(all.result).toEqual({ status: 200, body: { markedRead: 2 } });

    const withBody = responseRecorder();
    await routes.get("POST /api/ncc/notifications/read-all")?.(
      request(cookie, undefined, { reason: "x" }),
      withBody.response
    );
    expect(withBody.result.status).toBe(400);
    expect(markAllNotificationsRead).toHaveBeenCalledTimes(1);
  });

  it("passes provider errors through and fails closed on malformed payloads", async () => {
    const cookie = await login();
    const forbidden = vi.fn(async () => ({
      ok: false,
      error: { error: "Forbidden", status: 403 },
    }));
    const routes = captureRoutes({
      env: notificationsEnv(),
      api: { notifications: forbidden },
    });
    const denied = responseRecorder();
    await routes.get("/api/ncc/notifications")?.(
      request(cookie),
      denied.response
    );
    expect(denied.result).toEqual({
      status: 403,
      body: { error: "Forbidden" },
    });

    const malformed = vi.fn(async () => ({
      ok: true,
      data: [{ id: "" }],
    }));
    const badRoutes = captureRoutes({
      env: notificationsEnv(),
      api: { notifications: malformed },
    });
    const bad = responseRecorder();
    await badRoutes.get("/api/ncc/notifications")?.(
      request(cookie),
      bad.response
    );
    expect(bad.result).toEqual({
      status: 502,
      body: { error: "NCC EMS returned invalid notifications data." },
    });
  });
});
