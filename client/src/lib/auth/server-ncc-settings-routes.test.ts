import { describe, expect, it, vi } from "vitest";

import { loginNccStaff } from "../../../../server/nccAuthSession";
import { registerNccSettingsRoutes } from "../../../../server/nccSettingsRoutes";

const sealKey = "test-only-ncc-auth-session-key-32-characters";
const accessExpiresAt = "2099-01-01T00:15:00Z";
const refreshExpiresAt = "2099-02-01T00:00:00Z";

type RouteHandler = (
  request: Request,
  response: Response
) => Promise<void> | void;
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

function env(overrides: NodeJS.ProcessEnv = {}) {
  return {
    NILE_NCC_STAFF_AUTH_ENABLED: "1",
    NILE_NCC_SETTINGS_ENABLED: "1",
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

function captureRoutes(options: {
  env: NodeJS.ProcessEnv;
  api: Record<string, unknown>;
}) {
  const routes = new Map<string, RouteHandler>();
  const app = {
    get(path: string, handler: RouteHandler) {
      routes.set(path, handler);
    },
    post(path: string, handler: RouteHandler) {
      routes.set(`POST ${path}`, handler);
    },
    patch(path: string, handler: RouteHandler) {
      routes.set(`PATCH ${path}`, handler);
    },
  };
  registerNccSettingsRoutes(app, {
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
  return {
    headers: cookie ? { cookie } : {},
    params,
    body,
    query,
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

const reasonRow = {
  id: "reason-1",
  name: "Too expensive",
  status: "active",
  sort_order: 3,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
};

const actionReasonRow = {
  ...reasonRow,
  kind: "disable_branch",
};

const areaRow = {
  id: "area-1",
  name: "English",
  status: "active",
  sort_order: 1,
  placement_test_courses: [
    { moodle_course_id: 7, shortname: "PT-EN", fullname: "Placement English" },
  ],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
};

const fieldRow = {
  id: "field-1",
  entity_type: "branch",
  field_key: "license_no",
  label: "License number",
  field_type: "text",
  is_required: false,
  is_active: true,
  help_text: null,
  options_json: null,
  sort_order: 0,
};

describe("NCC settings routes", () => {
  it("returns 503 while the settings flag is off", async () => {
    const routes = captureRoutes({
      env: env({ NILE_NCC_SETTINGS_ENABLED: "0" }),
      api: {},
    });
    const read = responseRecorder();
    const write = responseRecorder();

    await routes.get("/api/ncc/settings/lost-reasons")?.(
      request(),
      read.response
    );
    await routes.get("POST /api/ncc/settings/lost-reasons")?.(
      request("nilelearn_ncc_session=x", undefined, { name: "x" }),
      write.response
    );

    expect(read.result).toEqual({
      status: 503,
      body: { error: "NCC settings are not active." },
    });
    expect(write.result).toEqual({
      status: 503,
      body: { error: "NCC settings are not active." },
    });
  });

  it("returns 404 without an NCC session cookie", async () => {
    const routes = captureRoutes({ env: env(), api: {} });
    const { response, result } = responseRecorder();

    await routes.get("/api/ncc/settings/action-reasons")?.(
      request(),
      response
    );

    expect(result).toEqual({
      status: 404,
      body: { error: "EMS settings are unavailable for this session." },
    });
  });

  it("lists lost reasons with no-store and Vary Cookie headers", async () => {
    const cookie = await login();
    const lostReasons = vi.fn(async () => ({ ok: true, data: [reasonRow] }));
    const routes = captureRoutes({ env: env(), api: { lostReasons } });
    const { headers, response, result } = responseRecorder();

    await routes.get("/api/ncc/settings/lost-reasons")?.(
      request(cookie, undefined, undefined, { activeOnly: "true" }),
      response
    );

    expect(lostReasons).toHaveBeenCalledWith("access-ncc-session-1", true);
    expect(result).toEqual({
      status: 200,
      body: {
        items: [
          {
            id: "reason-1",
            name: "Too expensive",
            status: "active",
            sortOrder: 3,
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-02T00:00:00Z",
          },
        ],
      },
    });
    expect(headers.get("Cache-Control")).toBe("private, no-store");
    expect(headers.get("Vary")).toBe("Cookie");
  });

  it("rejects an invalid action-reason kind before calling EMS", async () => {
    const cookie = await login();
    const actionReasons = vi.fn(async () => ({ ok: true, data: [] }));
    const routes = captureRoutes({ env: env(), api: { actionReasons } });
    const { response, result } = responseRecorder();

    await routes.get("/api/ncc/settings/action-reasons")?.(
      request(cookie, undefined, undefined, { kind: "bogus" }),
      response
    );

    expect(result).toEqual({
      status: 400,
      body: { error: "Request query is invalid." },
    });
    expect(actionReasons).not.toHaveBeenCalled();
  });

  it("filters action reasons by kind and active flag", async () => {
    const cookie = await login();
    const actionReasons = vi.fn(async () => ({
      ok: true,
      data: [actionReasonRow],
    }));
    const routes = captureRoutes({ env: env(), api: { actionReasons } });
    const { response, result } = responseRecorder();

    await routes.get("/api/ncc/settings/action-reasons")?.(
      request(cookie, undefined, undefined, {
        kind: "disable_branch",
        activeOnly: "true",
      }),
      response
    );

    expect(actionReasons).toHaveBeenCalledWith(
      "access-ncc-session-1",
      "disable_branch",
      true
    );
    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      items: [
        expect.objectContaining({
          id: "reason-1",
          kind: "disable_branch",
          name: "Too expensive",
        }),
      ],
    });
  });

  it("creates a lost reason with snake_case upstream fields", async () => {
    const cookie = await login();
    const createLostReason = vi.fn(async () => ({
      ok: true,
      data: reasonRow,
    }));
    const routes = captureRoutes({ env: env(), api: { createLostReason } });
    const { response, result } = responseRecorder();

    await routes.get("POST /api/ncc/settings/lost-reasons")?.(
      request(cookie, undefined, { name: "Moved abroad", sortOrder: 4 }),
      response
    );

    expect(createLostReason).toHaveBeenCalledWith("access-ncc-session-1", {
      name: "Moved abroad",
      sort_order: 4,
    });
    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      reason: expect.objectContaining({ id: "reason-1", sortOrder: 3 }),
    });
  });

  it("rejects malformed write bodies before calling EMS", async () => {
    const cookie = await login();
    const createLostReason = vi.fn(async () => ({ ok: true, data: reasonRow }));
    const routes = captureRoutes({ env: env(), api: { createLostReason } });
    const { response, result } = responseRecorder();

    await routes.get("POST /api/ncc/settings/lost-reasons")?.(
      request(cookie, undefined, { name: "  ", extra: true }),
      response
    );

    expect(result).toEqual({
      status: 400,
      body: { error: "Request body is invalid." },
    });
    expect(createLostReason).not.toHaveBeenCalled();
  });

  it("forwards the action-reason CSV import and returns the summary", async () => {
    const cookie = await login();
    const importActionReasons = vi.fn(async () => ({
      ok: true,
      data: { created: 2, updated: 1 },
    }));
    const routes = captureRoutes({ env: env(), api: { importActionReasons } });
    const { response, result } = responseRecorder();

    await routes.get("POST /api/ncc/settings/action-reasons/import")?.(
      request(cookie, undefined, {
        csv: "id,action,name\nr1,lost,Too expensive",
        overwrite: true,
      }),
      response
    );

    expect(importActionReasons).toHaveBeenCalledWith("access-ncc-session-1", {
      csv: "id,action,name\nr1,lost,Too expensive",
      overwrite: true,
    });
    expect(result).toEqual({
      status: 200,
      body: { result: { created: 2, updated: 1 } },
    });
  });

  it("requires a reason id when disabling an area of study", async () => {
    const cookie = await login();
    const disableAreaOfStudy = vi.fn(async () => ({ ok: true, data: areaRow }));
    const routes = captureRoutes({ env: env(), api: { disableAreaOfStudy } });
    const missing = responseRecorder();
    const ok = responseRecorder();

    await routes.get("POST /api/ncc/settings/areas-of-study/:areaId/disable")?.(
      request(cookie, { areaId: "area-1" }, {}),
      missing.response
    );
    await routes.get("POST /api/ncc/settings/areas-of-study/:areaId/disable")?.(
      request(cookie, { areaId: "area-1" }, { reasonId: "reason-9" }),
      ok.response
    );

    expect(missing.result).toEqual({
      status: 400,
      body: { error: "Reason is required." },
    });
    expect(disableAreaOfStudy).toHaveBeenCalledWith(
      "access-ncc-session-1",
      "area-1",
      "reason-9"
    );
    expect(ok.result.status).toBe(200);
  });

  it("maps placement course ids to the upstream shape on area create", async () => {
    const cookie = await login();
    const createAreaOfStudy = vi.fn(async () => ({ ok: true, data: areaRow }));
    const routes = captureRoutes({ env: env(), api: { createAreaOfStudy } });
    const { response, result } = responseRecorder();

    await routes.get("POST /api/ncc/settings/areas-of-study")?.(
      request(cookie, undefined, {
        name: "English",
        sortOrder: 1,
        placementCourseIds: [7],
      }),
      response
    );

    expect(createAreaOfStudy).toHaveBeenCalledWith("access-ncc-session-1", {
      name: "English",
      sort_order: 1,
      placement_test_courses: [{ moodle_course_id: 7 }],
    });
    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      area: expect.objectContaining({
        id: "area-1",
        placementCourses: [
          {
            moodleCourseId: 7,
            shortname: "PT-EN",
            fullname: "Placement English",
          },
        ],
      }),
    });
  });

  it("validates the custom-fields query and forwards filters", async () => {
    const cookie = await login();
    const customFieldDefinitions = vi.fn(async () => ({
      ok: true,
      data: [fieldRow],
    }));
    const routes = captureRoutes({
      env: env(),
      api: { customFieldDefinitions },
    });
    const bad = responseRecorder();
    const good = responseRecorder();

    await routes.get("/api/ncc/settings/custom-fields")?.(
      request(cookie, undefined, undefined, { isActive: "yes" }),
      bad.response
    );
    await routes.get("/api/ncc/settings/custom-fields")?.(
      request(cookie, undefined, undefined, {
        entityType: "branch",
        isActive: "true",
      }),
      good.response
    );

    expect(bad.result).toEqual({
      status: 400,
      body: { error: "Request query is invalid." },
    });
    expect(customFieldDefinitions).toHaveBeenCalledWith(
      "access-ncc-session-1",
      "branch",
      true
    );
    expect(good.result).toEqual({
      status: 200,
      body: {
        items: [
          {
            id: "field-1",
            entityType: "branch",
            fieldKey: "license_no",
            label: "License number",
            fieldType: "text",
            isRequired: false,
            isActive: true,
            helpText: null,
            options: null,
            sortOrder: 0,
          },
        ],
      },
    });
  });

  it("creates a custom field with snake_case upstream fields", async () => {
    const cookie = await login();
    const createCustomField = vi.fn(async () => ({ ok: true, data: fieldRow }));
    const routes = captureRoutes({ env: env(), api: { createCustomField } });
    const { response, result } = responseRecorder();

    await routes.get("POST /api/ncc/settings/custom-fields")?.(
      request(cookie, undefined, {
        entityType: "branch",
        fieldKey: "license_no",
        label: "License number",
        fieldType: "select",
        options: ["A", "B"],
        helpText: "As issued",
      }),
      response
    );

    expect(createCustomField).toHaveBeenCalledWith("access-ncc-session-1", {
      entity_type: "branch",
      field_key: "license_no",
      label: "License number",
      field_type: "select",
      options_json: ["A", "B"],
      help_text: "As issued",
    });
    expect(result.status).toBe(200);
  });

  it("passes an upstream 403 through unchanged", async () => {
    const cookie = await login();
    const createLostReason = vi.fn(async () => ({
      ok: false,
      error: { error: "forbidden", status: 403 },
    }));
    const routes = captureRoutes({ env: env(), api: { createLostReason } });
    const { response, result } = responseRecorder();

    await routes.get("POST /api/ncc/settings/lost-reasons")?.(
      request(cookie, undefined, { name: "Denied" }),
      response
    );

    expect(result.status).toBe(403);
  });

  it("returns 502 when EMS sends malformed catalog data", async () => {
    const cookie = await login();
    const areasOfStudy = vi.fn(async () => ({
      ok: true,
      data: [{ id: 1, name: null }],
    }));
    const routes = captureRoutes({ env: env(), api: { areasOfStudy } });
    const { response, result } = responseRecorder();

    await routes.get("/api/ncc/settings/areas-of-study")?.(
      request(cookie),
      response
    );

    expect(result).toEqual({
      status: 502,
      body: { error: "NCC EMS returned invalid settings data." },
    });
  });
});
