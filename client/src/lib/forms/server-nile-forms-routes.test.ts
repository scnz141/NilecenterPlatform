import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ServerSession } from "../../../../server/auth";
import {
  createMemoryNileFormsCompatibilityRepository,
  getNileFormsCompatibilityRepository,
  resetDefaultNileFormsCompatibilityRepository,
  setNileFormsCompatibilityRepository,
} from "../../../../server/nileFormsCompatibilityRepository";
import {
  registerNileFormsRoutes,
  resetNileFormsRateLimitsForTests,
} from "../../../../server/nileFormsRoutes";
import { createNileFormsService } from "../../../../server/nileFormsService";
import { createNileFormsMigrationService } from "../../../../server/nileFormsMigrationService";
import { seedPlatformState } from "@/lib/domain/seed";

type RouteHandler = (
  request: unknown,
  response: unknown
) => Promise<void> | void;

function captureRoutes(getSession: () => Promise<ServerSession | null>) {
  const getRoutes = new Map<string, RouteHandler>();
  const postRoutes = new Map<string, RouteHandler>();
  const repository = getNileFormsCompatibilityRepository();
  registerNileFormsRoutes(
    {
      get(path, handler) {
        getRoutes.set(path, handler as RouteHandler);
      },
      post(path, handler) {
        postRoutes.set(path, handler as RouteHandler);
      },
    },
    {
      getSession,
      service: createNileFormsService({
        repository,
        readAuthorityState: async () => structuredClone(seedPlatformState),
      }),
      migrationService: createNileFormsMigrationService({ repository }),
    }
  );
  return { getRoutes, postRoutes, repository };
}

function request(
  method: string,
  input: {
    body?: Record<string, unknown>;
    params?: Record<string, string>;
    headers?: Record<string, string>;
    ip?: string;
  } = {}
) {
  const headers = Object.fromEntries(
    Object.entries(input.headers ?? {}).map(([key, value]) => [
      key.toLowerCase(),
      value,
    ])
  );
  return {
    method,
    body: input.body ?? {},
    query: {},
    params: input.params ?? {},
    headers: { cookie: headers.cookie },
    ip: input.ip ?? "127.0.0.1",
    get(name: string) {
      return headers[name.toLowerCase()];
    },
  };
}

function responseRecorder() {
  const result: { status: number; body?: unknown } = { status: 200 };
  const response = {
    setHeader() {},
    status(code: number) {
      result.status = code;
      return response;
    },
    json(body: unknown) {
      result.body = body;
    },
  };
  return { response, result };
}

const registrar: ServerSession = {
  id: "session_registrar",
  userId: "usr_registrar_demo",
  email: "registrar.demo@nilelearn.local",
  name: "Registrar Demo",
  roles: ["registrar"],
  activeRole: "registrar",
  branchIds: ["br_cairo"],
  provider: "demo",
  authorizationModel: "snapshot",
  createdAt: "2026-07-11T12:00:00.000Z",
  expiresAt: "2026-07-12T00:00:00.000Z",
};

const student: ServerSession = {
  id: "session_student",
  userId: "usr_student_demo",
  email: "student.demo@nilelearn.local",
  name: "Student Demo",
  roles: ["student"],
  activeRole: "student",
  branchIds: ["br_online"],
  departmentIds: ["dep_arabic"],
  provider: "demo",
  authorizationModel: "snapshot",
  createdAt: "2026-07-11T12:00:00.000Z",
  expiresAt: "2026-07-12T00:00:00.000Z",
};

const superAdmin: ServerSession = {
  id: "session_admin",
  userId: "usr_admin_demo",
  email: "admin.demo@nilelearn.local",
  name: "Admin Demo",
  roles: ["superadmin"],
  activeRole: "superadmin",
  provider: "demo",
  authorizationModel: "snapshot",
  createdAt: "2026-07-11T12:00:00.000Z",
  expiresAt: "2026-07-12T00:00:00.000Z",
};

let restoreRepository: (() => void) | undefined;

beforeEach(() => {
  restoreRepository = setNileFormsCompatibilityRepository(
    createMemoryNileFormsCompatibilityRepository()
  );
  resetNileFormsRateLimitsForTests();
});

afterEach(() => {
  vi.unstubAllEnvs();
  restoreRepository?.();
  restoreRepository = undefined;
  resetDefaultNileFormsCompatibilityRepository();
  resetNileFormsRateLimitsForTests();
});

describe("Nile Forms API routes", () => {
  it("rejects a no-body cookie mutation before route logic when origin evidence is missing", async () => {
    const { postRoutes, repository } = captureRoutes(async () => superAdmin);
    const before = await repository.read();
    const { response, result } = responseRecorder();

    await postRoutes.get("/api/forms/publications/:publicationId/retire")?.(
      request("POST", {
        params: { publicationId: "publication_form_support_1" },
        headers: {
          cookie: "nilelearn_session=fake",
          "x-nile-learn-request": "browser",
        },
      }),
      response
    );

    expect(result).toEqual({
      status: 403,
      body: {
        error: "A valid request origin is required.",
        code: "forms_origin_denied",
      },
    });
    expect(await repository.read()).toEqual(before);
  });

  it("serves a bounded public publication without requiring a session", async () => {
    const { getRoutes } = captureRoutes(async () => null);
    const { response, result } = responseRecorder();

    await getRoutes.get("/api/forms/public/:slug")?.(
      request("GET", { params: { slug: "free-trial-enquiry" } }),
      response
    );

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      definition: { key: "public_enquiry" },
      publication: { slug: "free-trial-enquiry", audience: "public" },
      version: { versionNumber: 1 },
    });
  });

  it("requires an authenticated server session for management", async () => {
    const { getRoutes } = captureRoutes(async () => null);
    const { response, result } = responseRecorder();

    await getRoutes.get("/api/forms/definitions")?.(request("GET"), response);

    expect(result).toEqual({
      status: 401,
      body: {
        error: "Sign in required.",
        code: "sign_in_required",
        details: undefined,
      },
    });
  });

  it("keeps global admissions definitions under Super Admin ownership", async () => {
    const { getRoutes } = captureRoutes(async () => registrar);
    const { response, result } = responseRecorder();

    await getRoutes.get("/api/forms/definitions")?.(request("GET"), response);

    expect(result.status).toBe(200);
    expect(result.body).toEqual([]);
  });

  it("returns server-scoped management options", async () => {
    const { getRoutes } = captureRoutes(async () => registrar);
    const { response, result } = responseRecorder();

    await getRoutes.get("/api/forms/management-options")?.(
      request("GET"),
      response
    );

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      branches: [{ id: "br_cairo", label: "Cairo B1" }],
    });
    expect(result.body.users).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "usr_student_alex_demo" }),
      ])
    );
  });

  it("creates one public submission and reports idempotent replay", async () => {
    const { postRoutes } = captureRoutes(async () => null);
    const body = {
      clientSubmissionId: "route-client-0001",
      answers: {
        full_name: "Route Applicant",
        email: "route@example.test",
        phone: "+20 122 222 2222",
        preferred_branch: "br_cairo",
        course_interest: "arabic",
        preferred_contact: "email",
      },
    };
    const first = responseRecorder();
    const second = responseRecorder();
    const route = postRoutes.get("/api/forms/public/:slug/submit");

    await route?.(
      request("POST", { params: { slug: "free-trial-enquiry" }, body }),
      first.response
    );
    await route?.(
      request("POST", { params: { slug: "free-trial-enquiry" }, body }),
      second.response
    );

    expect(first.result.status).toBe(201);
    expect(first.result.body).toMatchObject({ replayed: false });
    expect(second.result.status).toBe(200);
    expect(second.result.body).toMatchObject({ replayed: true });
  });

  it("returns a submitted assigned response only to its owner", async () => {
    const { getRoutes, postRoutes } = captureRoutes(async () => student);
    const submit = responseRecorder();
    const submitRoute = postRoutes.get(
      "/api/forms/assigned/:publicationId/submit"
    );

    await submitRoute?.(
      request("POST", {
        params: { publicationId: "publication_form_consent_1" },
        body: {
          clientSubmissionId: "assigned-client-0001",
          answers: { accepted: true, typed_name: "Student Demo" },
        },
      }),
      submit.response
    );

    const submissionId = (submit.result.body as { submission: { id: string } })
      .submission.id;
    const detail = responseRecorder();
    const detailRoute = getRoutes.get(
      "/api/forms/assigned/:publicationId/submissions/:submissionId"
    );

    await detailRoute?.(
      request("GET", {
        params: {
          publicationId: "publication_form_consent_1",
          submissionId,
        },
      }),
      detail.response
    );

    expect(detail.result.status).toBe(200);
    expect(detail.result.body).toMatchObject({
      submission: { id: submissionId, respondentUserId: "usr_student_demo" },
      definition: { key: "learning_consent" },
      reviews: [],
    });
  });

  it("keeps offline device credentials in authenticated POST routes", async () => {
    const { postRoutes } = captureRoutes(async () => registrar);
    const enrolled = responseRecorder();

    await postRoutes.get("/api/forms/offline/devices")?.(
      request("POST", { body: { label: "Registrar tablet" } }),
      enrolled.response
    );

    expect(enrolled.result.status).toBe(201);
    const enrollment = enrolled.result.body as {
      device: { id: string };
      deviceToken: string;
    };
    expect(enrollment.deviceToken).toBeTruthy();

    const bundle = responseRecorder();
    await postRoutes.get("/api/forms/offline/bundle")?.(
      request("POST", {
        body: {
          deviceId: enrollment.device.id,
          deviceToken: enrollment.deviceToken,
        },
      }),
      bundle.response
    );

    expect(bundle.result.status).toBe(200);
    const offlineBundle = bundle.result.body as {
      device: { id: string };
      forms: Array<{ definition: { key: string } }>;
    };
    expect(offlineBundle.device.id).toBe(enrollment.device.id);
    expect(offlineBundle.forms.map(item => item.definition.key)).toEqual([
      "branch_incident",
    ]);
  });

  it("exposes migration status only to Super Admin without returning a key", async () => {
    const adminRoutes = captureRoutes(async () => superAdmin);
    const adminResult = responseRecorder();
    await adminRoutes.getRoutes.get("/api/forms/migration/jotform/status")?.(
      request("GET"),
      adminResult.response
    );

    expect(adminResult.result.status).toBe(200);
    expect(adminResult.result.body).toMatchObject({
      configured: expect.any(Boolean),
      region: expect.stringMatching(/^(standard|eu|hipaa)$/),
      targets: expect.any(Array),
    });
    expect(JSON.stringify(adminResult.result.body)).not.toContain("apiKey");

    const registrarRoutes = captureRoutes(async () => registrar);
    const registrarResult = responseRecorder();
    await registrarRoutes.getRoutes.get(
      "/api/forms/migration/jotform/status"
    )?.(request("GET"), registrarResult.response);
    expect(registrarResult.result).toMatchObject({
      status: 403,
      body: { code: "migration_authority_denied" },
    });
  });

  it("revokes an assignment through the scoped server route", async () => {
    const { postRoutes } = captureRoutes(async () => superAdmin);
    const assigned = responseRecorder();
    await postRoutes.get(
      "/api/forms/publications/:publicationId/assignments"
    )?.(
      request("POST", {
        params: { publicationId: "publication_form_support_1" },
        body: {
          target: { type: "user", userId: "usr_student_cairo_demo" },
        },
      }),
      assigned.response
    );
    expect(assigned.result.status).toBe(201);
    const assignmentId = (assigned.result.body as { id: string }).id;

    const revoked = responseRecorder();
    await postRoutes.get("/api/forms/assignments/:assignmentId/revoke")?.(
      request("POST", { params: { assignmentId } }),
      revoked.response
    );

    expect(revoked.result).toMatchObject({
      status: 200,
      body: { id: assignmentId, revokedAt: expect.any(String) },
    });
  });

  it("rate limits public write attempts by client address", async () => {
    const { postRoutes } = captureRoutes(async () => null);
    const route = postRoutes.get("/api/forms/public/:slug/submit");
    let last = responseRecorder();

    for (let index = 0; index < 13; index += 1) {
      last = responseRecorder();
      await route?.(
        request("POST", {
          ip: "203.0.113.8",
          headers: { "x-forwarded-for": `198.51.100.${index + 1}` },
          params: { slug: "free-trial-enquiry" },
          body: {
            clientSubmissionId: `rate-client-${String(index).padStart(4, "0")}`,
            answers: {},
          },
        }),
        last.response
      );
    }

    expect(last.result).toEqual({
      status: 429,
      body: {
        error: "Too many public form requests. Try again later.",
        code: "rate_limited",
      },
    });
  });

  it("preserves the public rate-limit budget across HMAC rotation", async () => {
    vi.stubEnv("NILE_FORMS_PUBLIC_HMAC_KEY", "11".repeat(32));
    vi.stubEnv("NILE_FORMS_PUBLIC_HMAC_KEY_VERSION", "1");
    vi.stubEnv("NILE_FORMS_PUBLIC_HMAC_PREVIOUS_KEY", "");
    vi.stubEnv("NILE_FORMS_PUBLIC_HMAC_PREVIOUS_KEY_VERSION", "");
    const { postRoutes } = captureRoutes(async () => null);
    const route = postRoutes.get("/api/forms/public/:slug/submit");

    for (let index = 0; index < 12; index += 1) {
      await route?.(
        request("POST", {
          ip: "203.0.113.44",
          params: { slug: "free-trial-enquiry" },
          body: {
            clientSubmissionId: `rotation-client-${String(index).padStart(4, "0")}`,
            answers: {},
          },
        }),
        responseRecorder().response
      );
    }

    vi.stubEnv("NILE_FORMS_PUBLIC_HMAC_KEY", "22".repeat(32));
    vi.stubEnv("NILE_FORMS_PUBLIC_HMAC_KEY_VERSION", "2");
    vi.stubEnv("NILE_FORMS_PUBLIC_HMAC_PREVIOUS_KEY", "11".repeat(32));
    vi.stubEnv("NILE_FORMS_PUBLIC_HMAC_PREVIOUS_KEY_VERSION", "1");
    const denied = responseRecorder();
    await route?.(
      request("POST", {
        ip: "203.0.113.44",
        params: { slug: "free-trial-enquiry" },
        body: {
          clientSubmissionId: "rotation-client-0012",
          answers: {},
        },
      }),
      denied.response
    );

    expect(denied.result).toMatchObject({
      status: 429,
      body: { code: "rate_limited" },
    });
  });
});
