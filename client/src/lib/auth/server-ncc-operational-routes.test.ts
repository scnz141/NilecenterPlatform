import { describe, expect, it, vi } from "vitest";

import { loginNccStaff } from "../../../../server/nccAuthSession";
import { registerNccOperationalRoutes } from "../../../../server/nccOperationalRoutes";

const sealKey = "test-only-ncc-auth-session-key-32-characters";
const accessExpiresAt = "2099-01-01T00:15:00Z";
const refreshExpiresAt = "2099-02-01T00:00:00Z";

type Request = {
  headers: { cookie?: string };
  params?: Record<string, string>;
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

function student(overrides: Record<string, unknown> = {}) {
  return {
    id: "student-1",
    first_name: "Nile",
    last_name: "Student",
    email: "student@example.test",
    phone: "+20 100",
    date_of_birth: null,
    branch_id: "branch-1",
    branch_name: "Cairo",
    moodle_user_id: 42,
    status: "active",
    guardian_name: "Guardian",
    guardian_phone: "+20 200",
    guardian_email: "guardian@example.test",
    guardian_relationship: "Parent",
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-12T10:00:00Z",
    generated_moodle_password: "never-return-this",
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
    moodle_group_id: null,
    schedule_days_of_week: null,
    schedule_start_time: null,
    schedule_end_time: null,
    default_room_id: null,
    default_room_name: null,
    status: "active",
    active_enrolment_count: 8,
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-12T10:00:00Z",
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

  it("translates student guardians and omits generated credentials", async () => {
    const cookie = await login();
    const withoutGuardian = student({
      id: "student-2",
      email: "second@example.test",
      guardian_name: null,
      guardian_phone: null,
      guardian_email: null,
      guardian_relationship: null,
    });
    delete withoutGuardian.moodle_user_id;
    const routes = captureRoutes({
      env: env(),
      api: {
        students: vi.fn(async () => ({
          ok: true,
          data: [student(), withoutGuardian],
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
            guardian: {
              name: "Guardian",
              phone: "+20 200",
              email: "guardian@example.test",
              relationship: "Parent",
            },
            moodleLinked: true,
          },
          { id: "student-2", guardian: null, moodleLinked: false },
        ],
      },
    });
    expect(JSON.stringify(result.body)).not.toContain(
      "generated_moodle_password"
    );
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
          data: [
            {
              id: "room-1",
              branch_id: "branch-1",
              branch_name: "Cairo",
              name: "Room 1",
              capacity: 20,
              status: "active",
            },
          ],
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
});
