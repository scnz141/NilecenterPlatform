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

const paged = (items: unknown[]) => ({
  items,
  total: items.length,
  page: 1,
  page_size: 100,
});

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
    home_branch_id: "branch-1",
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
    lead_type: "new",
    status: "in_process",
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
    put(path: string, handler: Handler) {
      routes.set(`PUT ${path}`, handler);
    },
    delete(path: string, handler: Handler) {
      routes.set(`DELETE ${path}`, handler);
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
          data: paged([
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
          ]),
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
          data: paged([
            student({
              guardians: [duplicate, { ...duplicate, name: "Second" }],
            }),
          ]),
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
          data: paged([student({ guardians: { name: "not-an-array" } })]),
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
          data: paged([placementTest()]),
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
        classes: vi.fn(async () => ({
          ok: true,
          data: paged([classRow()]),
        })),
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
          data: paged([roomRow()]),
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
          data: paged([
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
          ]),
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
      .mockResolvedValueOnce({ ok: true, data: paged([student()]) });
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
    expect(students).toHaveBeenNthCalledWith(2, "access-ncc-session-2", {});
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

  it("requires identity fields for conversion and maps them", async () => {
    const cookie = await login("registrar", "branch-1");
    const convertLead = vi.fn(async () => ({
      ok: true,
      data: {
        lead: lead({ status: "registered", student_id: "student-1" }),
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
      body: { lead: { status: "registered" }, student: { id: "student-1" } },
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
        registration: { toBePaid: 500, paid: 200 },
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
    expect(createStudent.mock.calls[0]?.[1]).not.toHaveProperty("branch_id");
    expect(createStudent.mock.calls[0]?.[1]).toMatchObject({
      home_branch_id: "branch-1",
      registration: { to_be_paid: 500, paid: 200 },
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
      error: "resultScore is required.",
    });
  });

  it("sends the EMS-required placement result and cancel reason fields", async () => {
    const cookie = await login("registrar", "branch-1");
    const recordPlacementResult = vi.fn(
      async (_token: string, _id: string, _body: Record<string, unknown>) => ({
        ok: true,
        data: placementTest(),
      })
    );
    const cancelPlacementTest = vi.fn(async () => ({
      ok: true,
      data: placementTest(),
    }));
    const routes = captureRoutes({
      env: env(),
      api: { recordPlacementResult, cancelPlacementTest },
    });
    const record =
      "POST /api/ncc/admissions/placement-tests/:placementTestId/record-result";
    const cancel =
      "POST /api/ncc/admissions/placement-tests/:placementTestId/cancel";
    const noTeacher = responseRecorder();
    const recorded = responseRecorder();
    const noReason = responseRecorder();
    const cancelled = responseRecorder();
    const params = { placementTestId: "placement-1" };

    await routes.get(record)?.(
      request(cookie, params, { resultScore: "B1" }),
      noTeacher.response
    );
    await routes.get(record)?.(
      request(cookie, params, {
        resultScore: " B1 ",
        mentoringTeacherId: "teacher-1",
        resultNotes: "  ",
      }),
      recorded.response
    );
    await routes.get(cancel)?.(request(cookie, params, {}), noReason.response);
    await routes.get(cancel)?.(
      request(cookie, params, { reasonId: "reason-1" }),
      cancelled.response
    );

    expect(noTeacher.result).toEqual({
      status: 400,
      body: { error: "mentoringTeacherId is required." },
    });
    expect(recordPlacementResult).toHaveBeenCalledTimes(1);
    expect(recordPlacementResult.mock.calls[0]?.[2]).toEqual({
      result_score: "B1",
      mentoring_teacher_id: "teacher-1",
    });
    expect(recorded.result.status).toBe(200);
    expect(noReason.result.status).toBe(400);
    expect(cancelPlacementTest).toHaveBeenCalledTimes(1);
    expect(cancelPlacementTest).toHaveBeenCalledWith(
      "access-ncc-session-1",
      "placement-1",
      "reason-1"
    );
    expect(cancelled.result.status).toBe(200);
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
          data: paged([courseRow()]),
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
      request(cookie, undefined, undefined, {
        q: "arab",
        refresh: "true",
        unmapped: "true",
      }),
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
      true,
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
        totalHours: 40,
        areaOfStudyId: "area-1",
      }),
      created.response
    );
    const noHours = responseRecorder();
    await routes.get("POST /api/ncc/delivery/courses")?.(
      request(cookie, undefined, {
        departmentId: "department-1",
        moodleCourseId: 501,
      }),
      noHours.response
    );
    await routes.get("PATCH /api/ncc/delivery/courses/:courseId")?.(
      request(
        cookie,
        { courseId: "course-1" },
        {
          sortOrder: 4,
          moodleAttendanceId: 12,
          totalHours: 48,
          previousCourseId: null,
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
      total_hours: 40,
      area_of_study_id: "area-1",
      sort_order: 2,
    });
    // EMS rejects a course without total teaching hours (live 422).
    expect(noHours.result).toEqual({
      status: 400,
      body: { error: "totalHours is required." },
    });
    expect(patchCourse).toHaveBeenCalledWith(
      "access-ncc-session-1",
      "course-1",
      {
        previous_course_id: null,
        total_hours: 48,
        sort_order: 4,
        moodle_attendance_id: 12,
      }
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

  it("runs course lifecycle with a required disable reason and passthrough errors", async () => {
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

    const noReason = responseRecorder();
    await routes.get("POST /api/ncc/delivery/courses/:courseId/disable")?.(
      request(cookie, { courseId: "course-1" }),
      noReason.response
    );
    await routes.get("POST /api/ncc/delivery/courses/:courseId/disable")?.(
      request(cookie, { courseId: "course-1" }, { reasonId: "reason-1" }),
      disabled.response
    );
    await routes.get("POST /api/ncc/delivery/courses/:courseId/refresh")?.(
      request(cookie, { courseId: "course-9" }),
      missing.response
    );

    expect(noReason.result.status).toBe(400);
    expect(disableCourse).toHaveBeenCalledTimes(1);
    expect(disableCourse).toHaveBeenCalledWith(
      "access-ncc-session-1",
      "course-1",
      "reason-1"
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
    const noReason = responseRecorder();
    await routes.get("POST /api/ncc/delivery/rooms/:roomId/disable")?.(
      request(cookie, { roomId: "room-1" }),
      noReason.response
    );
    await routes.get("POST /api/ncc/delivery/rooms/:roomId/disable")?.(
      request(cookie, { roomId: "room-1" }, { reasonId: "reason-1" }),
      disabled.response
    );

    expect(patchRoom).toHaveBeenCalledWith("access-ncc-session-1", "room-1", {
      capacity: 30,
    });
    expect(branchPatch.result.status).toBe(400);
    expect(patchRoom).toHaveBeenCalledTimes(1);
    expect(noReason.result).toEqual({
      status: 400,
      body: { error: "reasonId is required." },
    });
    expect(disableRoom).toHaveBeenCalledTimes(1);
    expect(disableRoom).toHaveBeenCalledWith(
      "access-ncc-session-1",
      "room-1",
      "reason-1"
    );
    expect(disabled.result).toMatchObject({
      status: 200,
      body: { room: { status: "disabled" } },
    });
  });
});

describe("NCC delivery workflow routes", () => {
  const deliveryEnv = () => env({ NILE_NCC_DELIVERY_WRITES_ENABLED: "1" });
  const rosterRow = {
    id: "enrolment-1",
    student_id: "student-1",
    course_id: "course-1",
    course_name: "Arabic",
    kind: "group",
    next_level: false,
    branch_id: "branch-1",
    branch_name: "Cairo",
    class_id: "class-1",
    class_name: "Arabic A",
    status: "enrolled",
    enrolled_at: "2026-09-10T10:00:00Z",
    cancelled_at: null,
    student_name: "Nile Student",
    to_be_paid: null,
    paid: null,
    remaining: null,
    student: {
      first_name: "Nile",
      last_name: "Student",
      email: "student@example.test",
      home_branch_id: "branch-1",
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
            id: "enrolment-1",
            studentId: "student-1",
            status: "enrolled",
            student: { moodleLinked: true, homeBranchId: "branch-1" },
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

  it("attaches an enrolment to a class with the exact provider body", async () => {
    const cookie = await login();
    const attachClassEnrolment = vi.fn(async () => ({
      ok: true,
      data: rosterRow,
    }));
    const routes = captureRoutes({
      env: deliveryEnv(),
      api: { attachClassEnrolment },
    });
    const attached = responseRecorder();
    const invalid = responseRecorder();
    const extra = responseRecorder();

    await routes.get("POST /api/ncc/delivery/classes/:classId/enrolments")?.(
      request(cookie, { classId: "class-1" }, { enrolmentId: "enrolment-1" }),
      attached.response
    );
    await routes.get("POST /api/ncc/delivery/classes/:classId/enrolments")?.(
      request(cookie, { classId: "class-1" }, { enrolmentId: "  " }),
      invalid.response
    );
    await routes.get("POST /api/ncc/delivery/classes/:classId/enrolments")?.(
      request(cookie, { classId: "class-1" }, { enrolmentId: "enrolment-1", note: "x" }),
      extra.response
    );

    expect(attachClassEnrolment).toHaveBeenCalledTimes(1);
    expect(attachClassEnrolment).toHaveBeenCalledWith(
      "access-ncc-session-1",
      "class-1",
      { enrolment_id: "enrolment-1" }
    );
    expect(invalid.result.status).toBe(400);
    expect(extra.result.status).toBe(400);
    expect(attached.result).toMatchObject({
      status: 200,
      body: { enrolment: { id: "enrolment-1", studentId: "student-1" } },
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
        weekdayHours: [
          { weekday: 0, hours: 2 },
          { weekday: 3, hours: 1 },
        ],
        fromDate: "2026-09-17",
        toDate: "2026-10-17",
      }),
      proposed.response
    );
    await routes.get(
      "POST /api/ncc/delivery/classes/:classId/sessions/propose"
    )?.(
      request(cookie, { classId: "class-1" }, {
        weekdayHours: [
          { weekday: 1, hours: 2 },
          { weekday: 1, hours: 1 },
        ],
        fromDate: "2026-09-17",
        toDate: "2026-10-17",
      }),
      badDays.response
    );
    await routes.get(
      "POST /api/ncc/delivery/classes/:classId/sessions/propose"
    )?.(
      request(cookie, { classId: "class-1" }, {
        weekdayHours: [{ weekday: 1, hours: 2 }],
        fromDate: "2026-10-17",
        toDate: "2026-09-17",
      }),
      reversed.response
    );
    await routes.get(
      "POST /api/ncc/delivery/classes/:classId/sessions/propose"
    )?.(
      request(cookie, { classId: "class-1" }, {
        weekdayHours: [{ weekday: 1, hours: 2 }],
        fromDate: "2026-09-17",
        toDate: "2026-10-17",
        startHour: 9,
      }),
      extra.response
    );

    expect(proposeClassSessions).toHaveBeenCalledTimes(1);
    expect(proposeClassSessions).toHaveBeenCalledWith(
      "access-ncc-session-1",
      "class-1",
      {
        weekday_hours: [
          { weekday: 0, hours: 2 },
          { weekday: 3, hours: 1 },
        ],
        from_date: "2026-09-17",
        to_date: "2026-10-17",
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
    id: "enrolment-1",
    student_id: "student-1",
    course_id: "course-1",
    course_name: "Arabic",
    kind: "group",
    next_level: false,
    branch_id: "branch-1",
    branch_name: "Cairo",
    class_id: "class-1",
    class_name: "Arabic A",
    status: "enrolled",
    enrolled_at: "2026-09-10T10:00:00Z",
    cancelled_at: null,
    student_name: "Nile Student",
    to_be_paid: null,
    paid: null,
    remaining: null,
    student: {
      first_name: "Nile",
      last_name: "Student",
      email: "student@example.test",
      home_branch_id: "branch-1",
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
    const cancelSession = vi.fn();
    const routes = captureRoutes({
      env: deliveryEnv(),
      api: { cancelSession },
    });
    const cancelled = responseRecorder();
    await routes.get("POST /api/ncc/delivery/sessions/:sessionId/cancel")?.(
      request(cookie, { sessionId: "session-1" }, { note: "x" }),
      cancelled.response
    );
    expect(cancelled.result.status).toBe(400);
    expect(cancelSession).not.toHaveBeenCalled();
  });

  it("passes provider write errors through unchanged", async () => {
    const cookie = await login();
    const markSessionAttendance = vi.fn(async () => ({
      ok: false,
      error: { error: "Access control exception", status: 400 },
    }));
    const attachClassEnrolment = vi.fn(async () => ({
      ok: false,
      error: { error: "Student is already enrolled", status: 409 },
    }));
    const routes = captureRoutes({
      env: deliveryEnv(),
      api: { markSessionAttendance, attachClassEnrolment },
    });
    const denied = responseRecorder();
    const conflict = responseRecorder();
    await routes.get("POST /api/ncc/delivery/sessions/:sessionId/attendance")?.(
      request(cookie, { sessionId: "session-1" }, { marks: [] }),
      denied.response
    );
    await routes.get("POST /api/ncc/delivery/classes/:classId/enrolments")?.(
      request(cookie, { classId: "class-1" }, { enrolmentId: "enrolment-1" }),
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
      pending_enrolments: 0,
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
        pending_enrolments: 0,
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
            pendingEnrolments: 0,
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
              pendingEnrolments: 0,
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

  it("forwards an optional branch and created-date window", async () => {
    const cookie = await login();
    const dashboardSummary = vi.fn(async () => ({ ok: false, error: { error: "Forbidden", status: 403 } }));
    const routes = captureRoutes({ env: dashboardEnv(), api: { dashboardSummary } });
    const ok = responseRecorder();
    const reversed = responseRecorder();
    const unknown = responseRecorder();
    const handler = routes.get("/api/ncc/dashboard/summary");
    await handler?.(
      request(cookie, undefined, undefined, { branchId: "branch-1", createdFrom: "2026-10-01", createdTo: "2026-10-31" }),
      ok.response
    );
    await handler?.(request(cookie, undefined, undefined, { createdFrom: "2026-10-31", createdTo: "2026-10-01" }), reversed.response);
    await handler?.(request(cookie, undefined, undefined, { period: "30d" }), unknown.response);
    expect(dashboardSummary).toHaveBeenCalledTimes(1);
    expect(dashboardSummary).toHaveBeenCalledWith("access-ncc-session-1", {
      branchId: "branch-1",
      createdFrom: "2026-10-01",
      createdTo: "2026-10-31",
    });
    expect(reversed.result.status).toBe(400);
    expect(unknown.result.status).toBe(400);
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

describe("NCC staff auth routes", () => {
  it("returns 404 while the staff flag is off or the cookie is missing", async () => {
    const off = captureRoutes({
      env: env({ NILE_NCC_STAFF_AUTH_ENABLED: "0" }),
      api: {},
    });
    const flagOff = responseRecorder();
    await off.get("POST /api/ncc/auth/switch-role")?.(
      request("cookie=1", undefined, { targetRole: "registrar" }),
      flagOff.response
    );
    expect(flagOff.result.status).toBe(404);

    const on = captureRoutes({ env: env(), api: {} });
    const noCookie = responseRecorder();
    await on.get("POST /api/ncc/auth/switch-role")?.(
      request("", undefined, { targetRole: "registrar" }),
      noCookie.response
    );
    expect(noCookie.result.status).toBe(404);
  });

  it("rejects invalid switch-role bodies before the provider", async () => {
    const cookie = await login();
    const switchRole = vi.fn();
    const routes = captureRoutes({ env: env(), api: { switchRole } });
    for (const body of [
      {},
      { targetRole: "owner" },
      { targetRole: "registrar", extra: 1 },
      { role: "registrar" },
    ]) {
      const bad = responseRecorder();
      await routes.get("POST /api/ncc/auth/switch-role")?.(
        request(cookie, undefined, body),
        bad.response
      );
      expect(bad.result.status).toBe(400);
    }
    expect(switchRole).not.toHaveBeenCalled();
  });

  it("rejects illegal role switches with 403 before the provider", async () => {
    const switchRole = vi.fn();
    const registrar = await login("registrar", "branch-1");
    const routes = captureRoutes({ env: env(), api: { switchRole } });
    const denied = responseRecorder();
    await routes.get("POST /api/ncc/auth/switch-role")?.(
      request(registrar, undefined, { targetRole: "teacher" }),
      denied.response
    );
    expect(denied.result.status).toBe(403);

    const hod = await login("hod");
    const upward = responseRecorder();
    await routes.get("POST /api/ncc/auth/switch-role")?.(
      request(hod, undefined, { targetRole: "super_admin" }),
      upward.response
    );
    expect(upward.result.status).toBe(403);
    expect(switchRole).not.toHaveBeenCalled();
  });

  it("switches role, reseals the cookie, and returns the session", async () => {
    const cookie = await login("super_admin");
    const switchRole = vi.fn(async () => ({ ok: true, data: tokens("s2") }));
    const meAfter = vi.fn(async () => ({
      ok: true,
      data: me("s2", "registrar", "branch-1"),
    }));
    const routes = captureRoutes({
      env: env(),
      api: { switchRole, me: meAfter },
    });
    const res = responseRecorder();
    await routes.get("POST /api/ncc/auth/switch-role")?.(
      request(cookie, undefined, { targetRole: "registrar" }),
      res.response
    );
    expect(switchRole).toHaveBeenCalledWith("access-ncc-session-1", "registrar");
    expect(res.result.status).toBe(200);
    const session = (res.result.body as { session: { ncc: { activeRole: string } } }).session;
    expect(session.ncc.activeRole).toBe("registrar");
    expect(res.headers.get("Set-Cookie")).toBeTruthy();
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("Vary")).toBe("Cookie");
  });

  it("passes provider switch errors through and rejects inconsistent roles", async () => {
    const cookie = await login("super_admin");
    const forbidden = vi.fn(async () => ({
      ok: false,
      error: { error: "Forbidden", status: 403 },
    }));
    const deniedRoutes = captureRoutes({
      env: env(),
      api: { switchRole: forbidden },
    });
    const denied = responseRecorder();
    await deniedRoutes.get("POST /api/ncc/auth/switch-role")?.(
      request(cookie, undefined, { targetRole: "teacher" }),
      denied.response
    );
    expect(denied.result).toEqual({ status: 403, body: { error: "Forbidden" } });

    const switchRole = vi.fn(async () => ({ ok: true, data: tokens("s3") }));
    const wrongMe = vi.fn(async () => ({
      ok: true,
      data: me("s3", "hod"),
    }));
    const badRoutes = captureRoutes({
      env: env(),
      api: { switchRole, me: wrongMe },
    });
    const bad = responseRecorder();
    await badRoutes.get("POST /api/ncc/auth/switch-role")?.(
      request(cookie, undefined, { targetRole: "teacher" }),
      bad.response
    );
    expect(bad.result.status).toBe(502);
  });

  it("sets session scopes with snake keys and validates the body", async () => {
    const cookie = await login("super_admin");
    const switchSessionScopes = vi.fn(async () => ({
      ok: true,
      data: me("ncc-session-1", "super_admin"),
    }));
    const routes = captureRoutes({ env: env(), api: { switchSessionScopes } });
    const res = responseRecorder();
    await routes.get("POST /api/ncc/auth/session-scopes")?.(
      request(cookie, undefined, {
        branchIds: ["branch-1"],
        classIds: ["class-1"],
      }),
      res.response
    );
    expect(switchSessionScopes).toHaveBeenCalledWith("access-ncc-session-1", {
      branch_ids: ["branch-1"],
      class_ids: ["class-1"],
    });
    expect(res.result.status).toBe(200);

    for (const body of [
      {},
      { bogus: [] },
      { branchIds: ["", 1] },
      { branchId: "" },
    ]) {
      const bad = responseRecorder();
      await routes.get("POST /api/ncc/auth/session-scopes")?.(
        request(cookie, undefined, body),
        bad.response
      );
      expect(bad.result.status).toBe(400);
    }
  });

  it("returns normalized scope options and fails closed on malformed data", async () => {
    const cookie = await login();
    const sessionScopeOptions = vi.fn(async () => ({
      ok: true,
      data: {
        branches: [{ id: "b1", label: "Cairo" }],
        departments: [{ id: "d1", label: "Languages" }],
        classes: [{ id: "c1", label: "Arabic A" }],
      },
    }));
    const routes = captureRoutes({
      env: env(),
      api: { sessionScopeOptions },
    });
    const res = responseRecorder();
    await routes.get("/api/ncc/auth/session-scope-options")?.(
      request(cookie),
      res.response
    );
    expect(res.result).toEqual({
      status: 200,
      body: {
        branches: [{ id: "b1", label: "Cairo" }],
        departments: [{ id: "d1", label: "Languages" }],
        classes: [{ id: "c1", label: "Arabic A" }],
      },
    });

    const malformed = captureRoutes({
      env: env(),
      api: {
        sessionScopeOptions: vi.fn(async () => ({
          ok: true,
          data: { branches: [{ id: "" }] },
        })),
      },
    });
    const bad = responseRecorder();
    await malformed.get("/api/ncc/auth/session-scope-options")?.(
      request(cookie),
      bad.response
    );
    expect(bad.result.status).toBe(502);
  });

  it("lists auth sessions, revokes one, and logs out everywhere", async () => {
    const cookie = await login();
    const authSessions = vi.fn(async () => ({
      ok: true,
      data: [
        {
          id: "ncc-session-1",
          issued_at: "2026-09-14T09:00:00Z",
          last_seen_at: "2026-09-14T10:00:00Z",
          is_current: true,
          ip_address: null,
          user_agent: "Test browser",
        },
      ],
    }));
    const revokeAuthSession = vi.fn(async () => ({ ok: true, data: null }));
    const logoutAllSessions = vi.fn(async () => ({ ok: true, data: null }));
    const routes = captureRoutes({
      env: env(),
      api: { authSessions, revokeAuthSession, logoutAllSessions },
    });

    const list = responseRecorder();
    await routes.get("/api/ncc/auth/sessions")?.(request(cookie), list.response);
    expect(list.result.status).toBe(200);
    const items = (list.result.body as { items: { id: string; isCurrent: boolean }[] }).items;
    expect(items).toEqual([
      {
        id: "ncc-session-1",
        issuedAt: "2026-09-14T09:00:00Z",
        lastSeenAt: "2026-09-14T10:00:00Z",
        isCurrent: true,
        ipAddress: null,
        userAgent: "Test browser",
      },
    ]);

    const revoked = responseRecorder();
    await routes.get("DELETE /api/ncc/auth/sessions/:sessionId")?.(
      request(cookie, { sessionId: "other-session" }),
      revoked.response
    );
    expect(revokeAuthSession).toHaveBeenCalledWith(
      "access-ncc-session-1",
      "other-session"
    );
    expect(revoked.result).toEqual({ status: 200, body: { ok: true } });

    const withBody = responseRecorder();
    await routes.get("DELETE /api/ncc/auth/sessions/:sessionId")?.(
      request(cookie, { sessionId: "other" }, { reason: "x" }),
      withBody.response
    );
    expect(withBody.result.status).toBe(400);

    const out = responseRecorder();
    await routes.get("POST /api/ncc/auth/logout-all")?.(
      request(cookie),
      out.response
    );
    expect(logoutAllSessions).toHaveBeenCalledWith("access-ncc-session-1");
    expect(out.result).toEqual({ status: 200, body: { ok: true } });

    const outBody = responseRecorder();
    await routes.get("POST /api/ncc/auth/logout-all")?.(
      request(cookie, undefined, { a: 1 }),
      outBody.response
    );
    expect(outBody.result.status).toBe(400);
  });

  it("fails closed on malformed auth sessions", async () => {
    const cookie = await login();
    const authSessions = vi.fn(async () => ({
      ok: true,
      data: [{ id: "", issued_at: "nope" }],
    }));
    const routes = captureRoutes({ env: env(), api: { authSessions } });
    const res = responseRecorder();
    await routes.get("/api/ncc/auth/sessions")?.(request(cookie), res.response);
    expect(res.result.status).toBe(502);
  });
});

describe("NCC notification delete routes", () => {
  const notificationsEnv = () => env({ NILE_NCC_NOTIFICATIONS_ENABLED: "1" });

  it("deletes one and all notifications with empty bodies only", async () => {
    const cookie = await login();
    const deleteNotification = vi.fn(async () => ({ ok: true, data: null }));
    const deleteAllNotifications = vi.fn(async () => ({
      ok: true,
      data: { deleted: 3 },
    }));
    const routes = captureRoutes({
      env: notificationsEnv(),
      api: { deleteNotification, deleteAllNotifications },
    });

    const one = responseRecorder();
    await routes.get("DELETE /api/ncc/notifications/:notificationId")?.(
      request(cookie, { notificationId: "ntf-1" }),
      one.response
    );
    expect(deleteNotification).toHaveBeenCalledWith(
      "access-ncc-session-1",
      "ntf-1"
    );
    expect(one.result).toEqual({ status: 200, body: { ok: true } });

    const all = responseRecorder();
    await routes.get("POST /api/ncc/notifications/delete-all")?.(
      request(cookie),
      all.response
    );
    expect(deleteAllNotifications).toHaveBeenCalledWith(
      "access-ncc-session-1"
    );
    expect(all.result).toEqual({ status: 200, body: { deleted: 3 } });

    const withBody = responseRecorder();
    await routes.get("POST /api/ncc/notifications/delete-all")?.(
      request(cookie, undefined, { reason: "x" }),
      withBody.response
    );
    expect(withBody.result.status).toBe(400);
    expect(deleteAllNotifications).toHaveBeenCalledTimes(1);
  });

  it("returns 404 while the flag is off and fails closed on malformed data", async () => {
    const off = captureRoutes({
      env: env({ NILE_NCC_NOTIFICATIONS_ENABLED: "0" }),
      api: {},
    });
    const denied = responseRecorder();
    await off.get("DELETE /api/ncc/notifications/:notificationId")?.(
      request("cookie=1", { notificationId: "ntf-1" }),
      denied.response
    );
    expect(denied.result.status).toBe(503);

    const cookie = await login();
    const malformed = captureRoutes({
      env: notificationsEnv(),
      api: {
        deleteAllNotifications: vi.fn(async () => ({
          ok: true,
          data: { deleted: "many" },
        })),
      },
    });
    const bad = responseRecorder();
    await malformed.get("POST /api/ncc/notifications/delete-all")?.(
      request(cookie),
      bad.response
    );
    expect(bad.result).toEqual({
      status: 502,
      body: { error: "NCC EMS returned invalid notifications data." },
    });
  });
});

describe("NCC Moodle site routes", () => {
  const siteEnv = () =>
    env({
      NILE_NCC_SYSTEM_READS_ENABLED: "1",
      NILE_NCC_MOODLE_ACCOUNT_WRITES_ENABLED: "1",
    });

  const sitePayload = () => ({
    configured: true,
    has_token: true,
    site_url: "https://moodle.example.test",
    sitename: "Nile Moodle",
    release: "4.5.1",
    version_expected: true,
    last_checked_at: "2026-10-06T10:00:00Z",
    reachable: true,
    last_error: null,
    auto_create_student_moodle: true,
    placement_test_moodle_course_id: 7,
    warnings: [],
  });

  it("returns 503 while system reads are off and 404 without a session", async () => {
    const off = captureRoutes({ env: env(), api: {} });
    const denied = responseRecorder();
    await off.get("/api/ncc/moodle/site")?.(request(), denied.response);
    expect(denied.result.status).toBe(503);

    const on = captureRoutes({ env: siteEnv(), api: {} });
    const anon = responseRecorder();
    await on.get("/api/ncc/moodle/site")?.(request(), anon.response);
    expect(anon.result.status).toBe(404);
  });

  it("normalizes the site and never echoes a token", async () => {
    const cookie = await login();
    const moodleSite = vi.fn(async () => ({ ok: true, data: sitePayload() }));
    const routes = captureRoutes({ env: siteEnv(), api: { moodleSite } });
    const { response, result } = responseRecorder();

    await routes.get("/api/ncc/moodle/site")?.(request(cookie), response);

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      site: {
        configured: true,
        hasToken: true,
        siteUrl: "https://moodle.example.test",
        placementTestMoodleCourseId: 7,
      },
    });
    expect(JSON.stringify(result.body)).not.toContain("ws_token");
  });

  it("tests the connection without exposing ws_token", async () => {
    const cookie = await login();
    const testMoodleSite = vi.fn(async () => ({
      ok: true,
      data: {
        reachable: true,
        sitename: "Nile Moodle",
        release: "4.5.1",
        version_expected: true,
        warnings: [],
        error: null,
        ws_token: "provider-must-not-leak",
      },
    }));
    const routes = captureRoutes({ env: siteEnv(), api: { testMoodleSite } });
    const { response, result } = responseRecorder();

    await routes.get("POST /api/ncc/moodle/site/test")?.(
      request(cookie),
      response
    );

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      result: { reachable: true, sitename: "Nile Moodle" },
    });
    expect(JSON.stringify(result.body)).not.toContain("provider-must-not-leak");
  });

  it("validates write bodies and maps them upstream", async () => {
    const cookie = await login();
    const putMoodleSite = vi.fn(async () => ({
      ok: true,
      data: sitePayload(),
    }));
    const patchMoodleSite = vi.fn(async () => ({
      ok: true,
      data: sitePayload(),
    }));
    const routes = captureRoutes({
      env: siteEnv(),
      api: { putMoodleSite, patchMoodleSite },
    });
    const put = routes.get("PUT /api/ncc/moodle/site");
    const patch = routes.get("PATCH /api/ncc/moodle/site");

    for (const [index, body] of [
      {},
      { siteUrl: "https://moodle.example.test" },
      { siteUrl: "  ", wsToken: "token-1" },
      { siteUrl: "https://m.example", wsToken: "t", unknown: true },
      { siteUrl: "https://m.example", wsToken: "t".repeat(300) },
    ].entries()) {
      const { response, result } = responseRecorder();
      await put?.(request(cookie, undefined, body), response);
      expect(result.status, `body ${index}`).toBe(400);
    }
    expect(
      putMoodleSite.mock.calls.map(call => JSON.stringify(call[1]))
    ).toEqual([]);

    const okPut = responseRecorder();
    await put?.(
      request(cookie, undefined, {
        siteUrl: "https://moodle.example.test",
        wsToken: "token-1",
        autoCreateStudentMoodle: false,
        placementTestMoodleCourseId: 12,
      }),
      okPut.response
    );
    expect(putMoodleSite).toHaveBeenCalledWith("access-ncc-session-1", {
      site_url: "https://moodle.example.test",
      ws_token: "token-1",
      auto_create_student_moodle: false,
      placement_test_moodle_course_id: 12,
    });
    expect(okPut.result.status).toBe(200);

    const emptyPatch = responseRecorder();
    await patch?.(request(cookie, undefined, {}), emptyPatch.response);
    expect(emptyPatch.result.status).toBe(400);

    const okPatch = responseRecorder();
    await patch?.(
      request(cookie, undefined, { autoCreateStudentMoodle: true }),
      okPatch.response
    );
    expect(patchMoodleSite).toHaveBeenCalledWith("access-ncc-session-1", {
      auto_create_student_moodle: true,
    });
    expect(okPatch.result.status).toBe(200);
  });

  it("disconnects and normalizes the cleared site", async () => {
    const cookie = await login();
    const disconnectMoodleSite = vi.fn(async () => ({
      ok: true,
      data: { ...sitePayload(), configured: false, has_token: false },
    }));
    const routes = captureRoutes({
      env: siteEnv(),
      api: { disconnectMoodleSite },
    });
    const { response, result } = responseRecorder();

    await routes.get("POST /api/ncc/moodle/site/disconnect")?.(
      request(cookie),
      response
    );

    expect(disconnectMoodleSite).toHaveBeenCalledWith("access-ncc-session-1");
    expect(result.body).toMatchObject({
      site: { configured: false, hasToken: false },
    });
  });
});

describe("NCC admissions journey routes", () => {
  const enrolmentRow = (overrides: Record<string, unknown> = {}) => ({
    id: "enrolment-1",
    student_id: "student-1",
    course_id: "course-1",
    course_name: "Arabic",
    kind: "group",
    next_level: false,
    branch_id: "branch-1",
    branch_name: "Cairo",
    class_id: null,
    class_name: null,
    status: "pending_payment",
    enrolled_at: "2026-09-10T10:00:00Z",
    cancelled_at: null,
    student_name: "Nile Student",
    student: {
      first_name: "Nile",
      last_name: "Student",
      email: "student@example.test",
      home_branch_id: "branch-1",
      moodle_user_id: null,
    },
    to_be_paid: 1000,
    paid: 400,
    remaining: 600,
    ...overrides,
  });
  const trialRow = (overrides: Record<string, unknown> = {}) => ({
    id: "trial-1",
    branch_id: "branch-1",
    branch_name: "Cairo",
    subject: {
      subject_type: "lead",
      subject_id: "lead-1",
      first_name: "Nile",
      last_name: "Lead",
      email: "lead@example.test",
    },
    scheduled_at: "2026-10-10T10:00:00Z",
    room_id: null,
    meeting_url: "https://meet.example/abc",
    status: "scheduled",
    created_at: "2026-10-01T10:00:00Z",
    updated_at: "2026-10-01T10:00:00Z",
    ...overrides,
  });
  const groupRow = {
    id: "group-1",
    branch_id: "branch-1",
    branch_name: "Cairo",
    label: "Siblings",
    members: [
      {
        lead_id: "lead-1",
        first_name: "A",
        last_name: "One",
        email: "a@example.test",
        status: "in_process",
        is_primary: true,
      },
      {
        lead_id: "lead-2",
        first_name: "B",
        last_name: "Two",
        email: "b@example.test",
        status: "in_process",
      },
    ],
    created_at: "2026-10-01T10:00:00Z",
    updated_at: "2026-10-01T10:00:00Z",
  };

  it("maps allowlisted list filters, rejects unknown ones, and returns totals", async () => {
    const cookie = await login();
    const leads = vi.fn(async () => ({
      ok: true,
      data: { items: [lead()], total: 240, page: 3, page_size: 25 },
    }));
    const routes = captureRoutes({ env: env(), api: { leads } });
    const ok = responseRecorder();
    const unknown = responseRecorder();
    const badStatus = responseRecorder();
    const tooBig = responseRecorder();
    const handler = routes.get("/api/ncc/admissions/leads");

    await handler?.(
      request(cookie, undefined, undefined, {
        q: " sara ",
        status: "in_process,follow_up",
        wantsOnline: "true",
        branchId: ["branch-1"],
        page: "3",
        pageSize: "25",
        sort: "created_at",
        order: "desc",
      }),
      ok.response
    );
    await handler?.(
      request(cookie, undefined, undefined, { role: "x" }),
      unknown.response
    );
    await handler?.(
      request(cookie, undefined, undefined, { status: "won" }),
      badStatus.response
    );
    await handler?.(
      request(cookie, undefined, undefined, { pageSize: "500" }),
      tooBig.response
    );

    expect(leads).toHaveBeenCalledTimes(1);
    expect(leads).toHaveBeenCalledWith("access-ncc-session-1", {
      q: "sara",
      status: ["in_process", "follow_up"],
      wants_online: true,
      branch_id: ["branch-1"],
      page: 3,
      page_size: 25,
      sort: "created_at",
      order: "desc",
    });
    expect(ok.result.body).toMatchObject({ total: 240, page: 3, pageSize: 25 });
    expect(unknown.result).toEqual({
      status: 400,
      body: { error: "role is not a supported filter." },
    });
    expect(badStatus.result.status).toBe(400);
    expect(tooBig.result.status).toBe(400);
  });

  it("opens, updates, and closes course sales with workspace branch and reasons", async () => {
    const cookie = await login("registrar", "branch-1");
    const createEnrolment = vi.fn(async () => ({
      ok: true,
      data: enrolmentRow(),
    }));
    const patchEnrolment = vi.fn(async () => ({
      ok: true,
      data: enrolmentRow({ paid: 1000, remaining: 0, status: "pending_class" }),
    }));
    const cancelEnrolment = vi.fn(async () => ({
      ok: true,
      data: enrolmentRow({ status: "cancelled" }),
    }));
    const completeEnrolment = vi.fn(async () => ({
      ok: true,
      data: enrolmentRow({ status: "completed" }),
    }));
    const routes = captureRoutes({
      env: env(),
      api: { createEnrolment, patchEnrolment, cancelEnrolment, completeEnrolment },
    });
    const created = responseRecorder();
    const overpaid = responseRecorder();
    const otherBranch = responseRecorder();
    const patched = responseRecorder();
    const cancelNoReason = responseRecorder();
    const cancelled = responseRecorder();
    const completed = responseRecorder();
    const sale = {
      studentId: "student-1",
      courseId: "course-1",
      kind: "group",
      toBePaid: 1000,
      paid: 400,
    };

    await routes.get("POST /api/ncc/admissions/enrolments")?.(
      request(cookie, undefined, sale),
      created.response
    );
    await routes.get("POST /api/ncc/admissions/enrolments")?.(
      request(cookie, undefined, { ...sale, paid: 1200 }),
      overpaid.response
    );
    await routes.get("POST /api/ncc/admissions/enrolments")?.(
      request(cookie, undefined, { ...sale, branchId: "branch-2" }),
      otherBranch.response
    );
    await routes.get("PATCH /api/ncc/admissions/enrolments/:enrolmentId")?.(
      request(cookie, { enrolmentId: "enrolment-1" }, { paid: 1000 }),
      patched.response
    );
    await routes.get("POST /api/ncc/admissions/enrolments/:enrolmentId/cancel")?.(
      request(cookie, { enrolmentId: "enrolment-1" }, {}),
      cancelNoReason.response
    );
    await routes.get("POST /api/ncc/admissions/enrolments/:enrolmentId/cancel")?.(
      request(cookie, { enrolmentId: "enrolment-1" }, { reasonId: "reason-1" }),
      cancelled.response
    );
    await routes.get(
      "POST /api/ncc/admissions/enrolments/:enrolmentId/complete"
    )?.(request(cookie, { enrolmentId: "enrolment-1" }), completed.response);

    expect(createEnrolment).toHaveBeenCalledTimes(1);
    expect(createEnrolment).toHaveBeenCalledWith("access-ncc-session-1", {
      student_id: "student-1",
      course_id: "course-1",
      kind: "group",
      branch_id: "branch-1",
      to_be_paid: 1000,
      paid: 400,
    });
    expect(created.result.body).toMatchObject({
      enrolment: { status: "pending_payment", remaining: 600 },
    });
    expect(overpaid.result.body).toEqual({
      error: "paid cannot exceed toBePaid.",
    });
    expect(otherBranch.result.status).toBe(400);
    expect(patchEnrolment).toHaveBeenCalledWith(
      "access-ncc-session-1",
      "enrolment-1",
      { paid: 1000 }
    );
    expect(cancelNoReason.result.status).toBe(400);
    expect(cancelEnrolment).toHaveBeenCalledWith(
      "access-ncc-session-1",
      "enrolment-1",
      "reason-1"
    );
    expect(completed.result.body).toMatchObject({
      enrolment: { status: "completed" },
    });
  });

  it("books online trial lessons with https meeting links and records results", async () => {
    const cookie = await login("registrar", "branch-1");
    const createTrialLesson = vi.fn(async () => ({ ok: true, data: trialRow() }));
    const recordTrialLessonResult = vi.fn(async () => ({
      ok: true,
      data: trialRow({ status: "completed", result_score: "Good" }),
    }));
    const routes = captureRoutes({
      env: env(),
      api: { createTrialLesson, recordTrialLessonResult },
    });
    const created = responseRecorder();
    const insecure = responseRecorder();
    const recorded = responseRecorder();
    const base = {
      subject: { type: "lead", id: "lead-1" },
      scheduledAt: "2026-10-10T10:00:00Z",
    };

    await routes.get("POST /api/ncc/admissions/trial-lessons")?.(
      request(cookie, undefined, {
        ...base,
        meetingUrl: "https://meet.example/abc",
        courseId: "course-1",
      }),
      created.response
    );
    await routes.get("POST /api/ncc/admissions/trial-lessons")?.(
      request(cookie, undefined, { ...base, meetingUrl: "http://meet.example" }),
      insecure.response
    );
    await routes.get(
      "POST /api/ncc/admissions/trial-lessons/:trialLessonId/record-result"
    )?.(
      request(cookie, { trialLessonId: "trial-1" }, { resultScore: " Good " }),
      recorded.response
    );

    expect(createTrialLesson).toHaveBeenCalledWith("access-ncc-session-1", {
      lead_id: "lead-1",
      scheduled_at: "2026-10-10T10:00:00Z",
      meeting_url: "https://meet.example/abc",
      course_id: "course-1",
      branch_id: "branch-1",
    });
    expect(created.result.body).toMatchObject({
      trialLesson: { meetingUrl: "https://meet.example/abc", status: "scheduled" },
    });
    expect(insecure.result.body).toEqual({
      error: "meetingUrl must be an https URL.",
    });
    expect(recordTrialLessonResult.mock.calls[0]).toEqual([
      "access-ncc-session-1",
      "trial-1",
      { result_score: "Good" },
    ]);
  });

  it("returns a placement test Moodle password once and syncs Moodle results", async () => {
    const cookie = await login("registrar", "branch-1");
    const createPlacementTest = vi.fn(async () => ({
      ok: true,
      data: { ...placementTest(), generated_moodle_password: "Once-Only-1" },
    }));
    const syncPlacementMoodleResult = vi.fn(async () => ({
      ok: true,
      data: placementTest(),
    }));
    const routes = captureRoutes({
      env: env(),
      api: { createPlacementTest, syncPlacementMoodleResult },
    });
    const created = responseRecorder();
    const synced = responseRecorder();

    await routes.get("POST /api/ncc/admissions/placement-tests")?.(
      request(cookie, undefined, {
        subject: { type: "lead", id: "lead-1" },
        scheduledAt: "2026-10-10T10:00:00Z",
        meetingUrl: "https://meet.example/pt",
        placementMoodleCourseId: 12,
      }),
      created.response
    );
    await routes.get(
      "POST /api/ncc/admissions/placement-tests/:placementTestId/sync-moodle-result"
    )?.(request(cookie, { placementTestId: "placement-1" }), synced.response);

    expect(createPlacementTest.mock.calls[0]?.[1]).toEqual({
      lead_id: "lead-1",
      scheduled_at: "2026-10-10T10:00:00Z",
      meeting_url: "https://meet.example/pt",
      placement_moodle_course_id: 12,
      branch_id: "branch-1",
    });
    expect(created.result.body).toMatchObject({
      oneTime: { generatedMoodlePassword: "Once-Only-1" },
    });
    expect(JSON.stringify((created.result.body as { placementTest: unknown }).placementTest)).not.toContain(
      "Once-Only-1"
    );
    expect(syncPlacementMoodleResult).toHaveBeenCalledWith(
      "access-ncc-session-1",
      "placement-1"
    );
    expect(synced.result.status).toBe(200);
  });

  it("records lead and student registration fees", async () => {
    const cookie = await login("registrar", "branch-1");
    const registration = {
      id: "reg-1",
      branch_id: "branch-1",
      to_be_paid: 300,
      paid: 100,
      remaining: 200,
    };
    const putLeadRegistration = vi.fn(async () => ({
      ok: true,
      data: lead({ registration }),
    }));
    const patchStudentRegistration = vi.fn(async () => ({
      ok: true,
      data: student({ registration }),
    }));
    const routes = captureRoutes({
      env: env(),
      api: { putLeadRegistration, patchStudentRegistration },
    });
    const leadResult = responseRecorder();
    const studentResult = responseRecorder();
    const negative = responseRecorder();

    await routes.get("PUT /api/ncc/admissions/leads/:leadId/registration")?.(
      request(cookie, { leadId: "lead-1" }, { toBePaid: 300, paid: 100 }),
      leadResult.response
    );
    await routes.get(
      "PATCH /api/ncc/admissions/students/:studentId/registration"
    )?.(
      request(cookie, { studentId: "student-1" }, { toBePaid: 300 }),
      studentResult.response
    );
    await routes.get("PUT /api/ncc/admissions/leads/:leadId/registration")?.(
      request(cookie, { leadId: "lead-1" }, { toBePaid: -1 }),
      negative.response
    );

    expect(putLeadRegistration).toHaveBeenCalledWith(
      "access-ncc-session-1",
      "lead-1",
      { to_be_paid: 300, paid: 100 }
    );
    expect(leadResult.result.body).toMatchObject({
      lead: { registration: { toBePaid: 300, remaining: 200 } },
    });
    expect(studentResult.result.body).toMatchObject({
      student: { registration: { paid: 100 } },
    });
    expect(negative.result.status).toBe(400);
  });

  it("creates lead groups in the workspace branch with a member primary", async () => {
    const cookie = await login("registrar", "branch-1");
    const createLeadGroup = vi.fn(async () => ({ ok: true, data: groupRow }));
    const deleteLeadGroup = vi.fn(async () => ({ ok: true, data: null }));
    const routes = captureRoutes({
      env: env(),
      api: { createLeadGroup, deleteLeadGroup },
    });
    const created = responseRecorder();
    const single = responseRecorder();
    const outsider = responseRecorder();
    const deleted = responseRecorder();

    await routes.get("POST /api/ncc/admissions/lead-groups")?.(
      request(cookie, undefined, {
        label: " Siblings ",
        memberLeadIds: ["lead-1", "lead-2"],
        primaryLeadId: "lead-1",
      }),
      created.response
    );
    await routes.get("POST /api/ncc/admissions/lead-groups")?.(
      request(cookie, undefined, { memberLeadIds: ["lead-1"] }),
      single.response
    );
    await routes.get("POST /api/ncc/admissions/lead-groups")?.(
      request(cookie, undefined, {
        memberLeadIds: ["lead-1", "lead-2"],
        primaryLeadId: "lead-9",
      }),
      outsider.response
    );
    await routes.get("DELETE /api/ncc/admissions/lead-groups/:groupId")?.(
      request(cookie, { groupId: "group-1" }),
      deleted.response
    );

    expect(createLeadGroup).toHaveBeenCalledTimes(1);
    expect(createLeadGroup).toHaveBeenCalledWith("access-ncc-session-1", {
      member_lead_ids: ["lead-1", "lead-2"],
      primary_lead_id: "lead-1",
      label: "Siblings",
      branch_id: "branch-1",
    });
    expect(created.result.body).toMatchObject({
      group: { members: [{ isPrimary: true }, { isPrimary: false }] },
    });
    expect(single.result.status).toBe(400);
    expect(outsider.result.body).toEqual({
      error: "primaryLeadId must be a member.",
    });
    expect(deleted.result.body).toEqual({ deleted: true });
  });

  it("reads student learning, the printable report, and branch assignees", async () => {
    const cookie = await login("registrar", "branch-1");
    const learning = {
      student_id: "student-1",
      courses: [
        {
          class_id: "class-1",
          class_name: "Arabic A",
          course_id: "course-1",
          moodle_course_id: 7,
          course_name: "Arabic",
          course_grade: "85.00",
          course_completed: false,
          completion_status: "in_progress",
        },
      ],
      moodle_warning: null,
    };
    const studentLearning = vi.fn(async () => ({ ok: true, data: learning }));
    const studentReport = vi.fn(async () => ({
      ok: true,
      data: {
        identity: {
          id: "student-1",
          first_name: "Nile",
          last_name: "Student",
          email: "student@example.test",
          home_branch_id: "branch-1",
          branch_name: "Cairo",
          guardians: [{ sort_order: 1, name: "G", relationship: "Parent" }],
        },
        enrolments: [enrolmentRow({ status: "enrolled", class_id: "class-1" })],
        learning,
      },
    }));
    const assignees = vi.fn(async () => ({
      ok: true,
      data: {
        items: [
          {
            id: "ssa-1",
            email: "ssa@example.test",
            assigned_role: "ssa",
            first_name: "Sara",
            last_name: "Agent",
          },
        ],
        total: 1,
        page: 1,
        page_size: 100,
      },
    }));
    const routes = captureRoutes({
      env: env(),
      api: { studentLearning, studentReport, assignees },
    });
    const learned = responseRecorder();
    const reported = responseRecorder();
    const assigned = responseRecorder();

    await routes.get("/api/ncc/admissions/students/:studentId/learning")?.(
      request(cookie, { studentId: "student-1" }),
      learned.response
    );
    await routes.get("/api/ncc/admissions/students/:studentId/report")?.(
      request(cookie, { studentId: "student-1" }, undefined, {
        classId: "class-1",
      }),
      reported.response
    );
    await routes.get("/api/ncc/admissions/assignees")?.(
      request(cookie),
      assigned.response
    );

    expect(learned.result.body).toMatchObject({
      learning: { courses: [{ courseGrade: "85.00", moodleCourseId: 7 }] },
    });
    expect(studentReport).toHaveBeenCalledWith(
      "access-ncc-session-1",
      "student-1",
      "class-1"
    );
    expect(reported.result.body).toMatchObject({
      report: {
        identity: { name: "Nile Student" },
        enrolments: [{ status: "enrolled" }],
      },
    });
    expect(assignees).toHaveBeenCalledWith(
      "access-ncc-session-1",
      "branch-1",
      undefined
    );
    expect(assigned.result.body).toEqual({
      items: [
        { id: "ssa-1", name: "Sara Agent", email: "ssa@example.test", role: "ssa" },
      ],
    });
  });
});

describe("NCC teaching contract routes", () => {
  const deliveryEnv = () => env({ NILE_NCC_DELIVERY_WRITES_ENABLED: "1" });
  const attendanceDetail = {
    moodle_session_id: 7,
    attendanceid: 3,
    ems_session_id: null,
    sessdate: "2026-09-17T10:00:00Z",
    duration: 3600,
    groupid: 4,
    statuses: [
      { id: 1, acronym: "P", description: "Present" },
      { id: 2, acronym: "A", description: "Absent" },
    ],
    students: [
      {
        student_id: "student-1",
        first_name: "Nile",
        last_name: "Student",
        email: "student@example.test",
        moodle_user_id: 42,
        status_id: null,
        status_acronym: null,
        status_description: null,
        remarks: null,
      },
    ],
  };

  it("reads course statistics and refreshes the course list with filters", async () => {
    const cookie = await login();
    const courseStatistics = vi.fn(async () => ({
      ok: true,
      data: {
        active_classes: 2,
        enrolment_fill: 11,
        enrolment_capacity: 30,
        pending_enrolments: 3,
        open_leads: 5,
      },
    }));
    const refreshCourses = vi.fn(async () => ({
      ok: true,
      data: { items: [courseRow()], total: 1, page: 1, page_size: 25 },
    }));
    const routes = captureRoutes({
      env: deliveryEnv(),
      api: { courseStatistics, refreshCourses },
    });
    const stats = responseRecorder();
    const refreshed = responseRecorder();
    const badFilter = responseRecorder();

    await routes.get("/api/ncc/delivery/courses/:courseId/statistics")?.(
      request(cookie, { courseId: "course-1" }),
      stats.response
    );
    await routes.get("POST /api/ncc/delivery/courses/refresh")?.(
      request(cookie, undefined, undefined, {
        departmentId: "department-1",
        status: "active",
        pageSize: "25",
      }),
      refreshed.response
    );
    await routes.get("POST /api/ncc/delivery/courses/refresh")?.(
      request(cookie, undefined, undefined, { branchId: "x" }),
      badFilter.response
    );

    expect(stats.result.body).toEqual({
      statistics: {
        activeClasses: 2,
        enrolmentFill: 11,
        enrolmentCapacity: 30,
        pendingEnrolments: 3,
        openLeads: 5,
      },
    });
    expect(refreshCourses).toHaveBeenCalledWith("access-ncc-session-1", {
      department_id: "department-1",
      status: ["active"],
      page_size: 25,
    });
    expect(refreshed.result.body).toMatchObject({ total: 1, pageSize: 25 });
    expect(badFilter.result.status).toBe(400);
    expect(refreshCourses).toHaveBeenCalledTimes(1);
  });

  it("maps class kind, meeting link, owner, and branch moves", async () => {
    const cookie = await login();
    const patchClass = vi.fn(async () => ({ ok: true, data: classRow() }));
    const routes = captureRoutes({ env: deliveryEnv(), api: { patchClass } });
    const patched = responseRecorder();
    const badLink = responseRecorder();
    const badKind = responseRecorder();
    const handler = routes.get("PATCH /api/ncc/delivery/classes/:classId");

    await handler?.(
      request(
        cookie,
        { classId: "class-1" },
        {
          kind: "individual",
          meetingUrl: "https://meet.example/abc",
          assignedSsaId: null,
          branchId: "branch-2",
        }
      ),
      patched.response
    );
    await handler?.(
      request(cookie, { classId: "class-1" }, { meetingUrl: "http://x" }),
      badLink.response
    );
    await handler?.(
      request(cookie, { classId: "class-1" }, { kind: "duo" }),
      badKind.response
    );

    expect(patchClass).toHaveBeenCalledWith("access-ncc-session-1", "class-1", {
      kind: "individual",
      meeting_url: "https://meet.example/abc",
      assigned_ssa_id: null,
      branch_id: "branch-2",
    });
    expect(badLink.result.status).toBe(400);
    expect(badKind.result.status).toBe(400);
  });

  it("returns Moodle sync steps and warnings", async () => {
    const cookie = await login();
    const syncClassMoodle = vi.fn(async () => ({
      ok: true,
      data: {
        ...classRow(),
        warnings: ["2 students have no Moodle account"],
        steps: [
          { step: "group", status: "ok", detail: null, warnings: [] },
          { step: "students", status: "error", detail: "Not linked" },
        ],
      },
    }));
    const routes = captureRoutes({
      env: deliveryEnv(),
      api: { syncClassMoodle },
    });
    const synced = responseRecorder();
    await routes.get("POST /api/ncc/delivery/classes/:classId/moodle/sync")?.(
      request(cookie, { classId: "class-1" }, {}),
      synced.response
    );
    expect(synced.result.body).toMatchObject({
      class: { id: "class-1" },
      warnings: ["2 students have no Moodle account"],
      steps: [
        { step: "group", status: "ok", detail: null, warnings: [] },
        { step: "students", status: "error", detail: "Not linked", warnings: [] },
      ],
    });
  });

  it("reads and paints room availability within a bounded range", async () => {
    const cookie = await login();
    const roomHourCells = vi.fn(async () => ({
      ok: true,
      data: {
        timezone: "Africa/Cairo",
        from: "2026-11-02",
        to: "2026-11-08",
        cells: [{ date: "2026-11-02", hour: 9, status: "available" }],
        sessions: [],
      },
    }));
    const patchRoomHourCells = vi.fn(async () => ({
      ok: true,
      data: { applied: 1 },
    }));
    const routes = captureRoutes({
      env: deliveryEnv(),
      api: { roomHourCells, patchRoomHourCells },
    });
    const range = responseRecorder();
    const tooLong = responseRecorder();
    const painted = responseRecorder();
    const badOp = responseRecorder();

    await routes.get("/api/ncc/delivery/rooms/:roomId/hour-cells")?.(
      request(cookie, { roomId: "room-1" }, undefined, {
        from: "2026-11-02",
        to: "2026-11-08",
      }),
      range.response
    );
    await routes.get("/api/ncc/delivery/rooms/:roomId/hour-cells")?.(
      request(cookie, { roomId: "room-1" }, undefined, {
        from: "2026-01-01",
        to: "2026-06-01",
      }),
      tooLong.response
    );
    await routes.get("PATCH /api/ncc/delivery/rooms/:roomId/hour-cells")?.(
      request(
        cookie,
        { roomId: "room-1" },
        {
          ops: [
            { date: "2026-11-02", hour: 9, status: "available" },
            { date: "2026-11-02", hour: 10, status: null },
          ],
        }
      ),
      painted.response
    );
    await routes.get("PATCH /api/ncc/delivery/rooms/:roomId/hour-cells")?.(
      request(
        cookie,
        { roomId: "room-1" },
        { ops: [{ date: "2026-11-02", hour: 24, status: "available" }] }
      ),
      badOp.response
    );

    expect(roomHourCells).toHaveBeenCalledWith(
      "access-ncc-session-1",
      "room-1",
      "2026-11-02",
      "2026-11-08"
    );
    expect(range.result.body).toMatchObject({
      range: { timezone: "Africa/Cairo" },
    });
    expect(tooLong.result.status).toBe(400);
    expect(patchRoomHourCells).toHaveBeenCalledWith(
      "access-ncc-session-1",
      "room-1",
      [
        { date: "2026-11-02", hour: 9, status: "available" },
        { date: "2026-11-02", hour: 10, status: null },
      ]
    );
    expect(badOp.result.status).toBe(400);
    expect(patchRoomHourCells).toHaveBeenCalledTimes(1);
  });

  it("lists and marks Moodle attendance sessions for a class", async () => {
    const cookie = await login();
    const classAttendanceSessions = vi.fn(async () => ({
      ok: true,
      data: [
        {
          moodle_session_id: 7,
          sessdate: "2026-09-17T10:00:00Z",
          duration: 3600,
          groupid: 4,
          ems_session_id: "session-1",
        },
      ],
    }));
    const markClassAttendance = vi.fn(async () => ({
      ok: true,
      data: attendanceDetail,
    }));
    const routes = captureRoutes({
      env: deliveryEnv(),
      api: { classAttendanceSessions, markClassAttendance },
    });
    const list = responseRecorder();
    const marked = responseRecorder();
    const duplicate = responseRecorder();
    const badId = responseRecorder();
    const mark = routes.get(
      "POST /api/ncc/delivery/classes/:classId/attendance/sessions/:moodleSessionId"
    );

    await routes.get("/api/ncc/delivery/classes/:classId/attendance/sessions")?.(
      request(cookie, { classId: "class-1" }),
      list.response
    );
    await mark?.(
      request(
        cookie,
        { classId: "class-1", moodleSessionId: "7" },
        { marks: [{ studentId: " student-1 ", statusId: 1 }] }
      ),
      marked.response
    );
    await mark?.(
      request(
        cookie,
        { classId: "class-1", moodleSessionId: "7" },
        {
          marks: [
            { studentId: "student-1", statusId: 1 },
            { studentId: "student-1", statusId: 2 },
          ],
        }
      ),
      duplicate.response
    );
    await mark?.(
      request(
        cookie,
        { classId: "class-1", moodleSessionId: "abc" },
        { marks: [] }
      ),
      badId.response
    );

    expect(list.result.body).toEqual({
      items: [
        {
          moodleSessionId: 7,
          sessionDate: "2026-09-17T10:00:00Z",
          durationSeconds: 3600,
          moodleGroupId: 4,
          lastTaken: null,
          description: null,
          emsSessionId: "session-1",
        },
      ],
    });
    expect(markClassAttendance).toHaveBeenCalledWith(
      "access-ncc-session-1",
      "class-1",
      7,
      { marks: [{ student_id: "student-1", status_id: 1 }] }
    );
    expect(marked.result.body).toMatchObject({
      attendance: { moodleSessionId: 7 },
    });
    expect(duplicate.result.status).toBe(400);
    expect(badId.result.status).toBe(400);
    expect(markClassAttendance).toHaveBeenCalledTimes(1);
  });
});
