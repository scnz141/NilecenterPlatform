import { beforeEach, describe, expect, it } from "vitest";

import type { ServerSession } from "../../../../server/auth";
import {
  createMemoryNileFormsCompatibilityRepository,
  type NileFormsCompatibilityRepository,
} from "../../../../server/nileFormsCompatibilityRepository";
import { registerNileRequestsRoutes } from "../../../../server/nileRequestsRoutes";
import { createNileRequestsService } from "../../../../server/nileRequestsService";
import { createNileFormsService } from "../../../../server/nileFormsService";
import { seedPlatformState } from "@/lib/domain/seed";

type RouteHandler = (
  request: unknown,
  response: unknown
) => Promise<void> | void;

const now = new Date("2026-07-18T09:00:00.000Z");
let repository: NileFormsCompatibilityRepository;
let activeSession: ServerSession | null;
let idCounter = 0;

function session(
  role: ServerSession["activeRole"],
  userId: string,
  scope: { branchIds?: string[]; departmentIds?: string[] } = {}
): ServerSession {
  return {
    id: `session_${role}_${userId}`,
    userId,
    email: `${userId}@nilelearn.local`,
    name: userId,
    roles: [role],
    activeRole: role,
    provider: "demo",
    authorizationModel: "snapshot",
    branchIds: scope.branchIds,
    departmentIds: scope.departmentIds,
    createdAt: "2026-07-18T08:00:00.000Z",
    expiresAt: "2026-07-19T08:00:00.000Z",
  };
}

const cairoStudent = session("student", "usr_student_cairo_demo", {
  branchIds: ["br_cairo"],
  departmentIds: ["dep_arabic"],
});
const cairoBranchAdmin = session("branchadmin", "usr_branch_demo", {
  branchIds: ["br_cairo"],
  departmentIds: ["dep_operations"],
});
const alexBranchAdmin = session("branchadmin", "usr_branch_alex_demo", {
  branchIds: ["br_alex"],
  departmentIds: ["dep_operations"],
});
const superAdmin = session("superadmin", "usr_admin_demo");

function dependencies() {
  return {
    repository,
    now: () => now,
    randomId: (prefix: string) => `${prefix}_route_${++idCounter}`,
    readAuthorityState: async () => structuredClone(seedPlatformState),
  };
}

function captureRoutes() {
  const getRoutes = new Map<string, RouteHandler>();
  const postRoutes = new Map<string, RouteHandler>();
  registerNileRequestsRoutes(
    {
      get(path, handler) {
        getRoutes.set(path, handler as RouteHandler);
      },
      post(path, handler) {
        postRoutes.set(path, handler as RouteHandler);
      },
    },
    {
      getSession: async () => activeSession,
      service: createNileRequestsService(dependencies()),
    }
  );
  return { getRoutes, postRoutes };
}

function request(
  method: string,
  input: {
    body?: Record<string, unknown>;
    params?: Record<string, string>;
    protectedMutation?: boolean;
  } = {}
) {
  const headers: Record<string, string> = input.protectedMutation
    ? {
        cookie: "nilelearn_session=fake",
        host: "localhost:3000",
        origin: "http://localhost:3000",
        "x-nile-learn-request": "browser",
        "sec-fetch-site": "same-origin",
        "sec-fetch-mode": "cors",
        "sec-fetch-dest": "empty",
      }
    : {};
  return {
    method,
    body: input.body ?? {},
    query: {},
    params: input.params ?? {},
    headers: { cookie: headers.cookie },
    ip: "127.0.0.1",
    get(name: string) {
      return headers[name.toLowerCase()];
    },
  };
}

function responseRecorder() {
  const result: { status: number; body?: unknown } = { status: 200 };
  const response = {
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

async function acceptedIncident() {
  const forms = createNileFormsService({
    ...dependencies(),
    draftKey: Buffer.alloc(32, 9),
  });
  const submitted = await forms.submit({
    publicationId: "publication_form_incident_1",
    clientSubmissionId: "route-incident-client-0001",
    session: cairoStudent,
    answers: {
      location: "Cairo Room 204",
      issue_type: "equipment",
      severity: 4,
      details: "The classroom display loses power during scheduled lessons.",
    },
  });
  await forms.reviewSubmission(superAdmin, submitted.submission.id, {
    decision: "under_review",
    expectedRevision: 1,
  });
  return (
    await forms.reviewSubmission(superAdmin, submitted.submission.id, {
      decision: "accepted",
      comments: "Verified for operations.",
      expectedRevision: 2,
    })
  ).submission;
}

beforeEach(() => {
  repository = createMemoryNileFormsCompatibilityRepository();
  activeSession = null;
  idCounter = 0;
});

describe("Nile Requests API routes", () => {
  it("requires an authenticated server session for request reads", async () => {
    const { getRoutes } = captureRoutes();
    const { response, result } = responseRecorder();

    await getRoutes.get("/api/requests")?.(request("GET"), response);

    expect(result).toEqual({
      status: 401,
      body: {
        error: "Sign in required.",
        code: "sign_in_required",
        details: undefined,
      },
    });
  });

  it("rejects a cookie mutation without first-party origin evidence and writes nothing", async () => {
    const submission = await acceptedIncident();
    activeSession = cairoBranchAdmin;
    const { postRoutes } = captureRoutes();
    const before = await repository.read();
    const { response, result } = responseRecorder();

    await postRoutes.get("/api/requests/from-submission/:submissionId")?.(
      {
        ...request("POST", {
          body: {
            expectedSubmissionRevision: submission.revision,
            idempotencyKey: "request-route-origin-0001",
          },
          params: { submissionId: submission.id },
        }),
        headers: { cookie: "nilelearn_session=fake" },
      },
      response
    );

    expect(result).toEqual({
      status: 403,
      body: {
        error: "Missing first-party request header.",
        code: "forms_first_party_header_required",
      },
    });
    expect(await repository.read()).toEqual(before);
  });

  it("creates through the protected route and lets only scoped actors read the result", async () => {
    const submission = await acceptedIncident();
    activeSession = cairoBranchAdmin;
    const routes = captureRoutes();
    const created = responseRecorder();

    await routes.postRoutes.get(
      "/api/requests/from-submission/:submissionId"
    )?.(
      request("POST", {
        protectedMutation: true,
        params: { submissionId: submission.id },
        body: {
          expectedSubmissionRevision: submission.revision,
          idempotencyKey: "request-route-create-0001",
        },
      }),
      created.response
    );

    expect(created.result.status).toBe(201);
    expect(created.result.body).toMatchObject({
      replayed: false,
      request: {
        requesterUserId: "usr_student_cairo_demo",
        branchId: "br_cairo",
        sourceSubmissionId: submission.id,
      },
    });
    const requestId = (created.result.body as { request: { id: string } })
      .request.id;

    activeSession = cairoStudent;
    const owner = responseRecorder();
    await routes.getRoutes.get("/api/requests/:requestId")?.(
      request("GET", { params: { requestId } }),
      owner.response
    );
    expect(owner.result.status).toBe(200);
    expect(owner.result.body).toMatchObject({
      request: { id: requestId },
      capabilities: { canComment: true, canCancel: true },
    });

    activeSession = alexBranchAdmin;
    const denied = responseRecorder();
    await routes.getRoutes.get("/api/requests/:requestId")?.(
      request("GET", { params: { requestId } }),
      denied.response
    );
    expect(denied.result).toMatchObject({
      status: 403,
      body: { code: "request_scope_denied" },
    });
  });

  it("returns typed optimistic conflicts from command routes", async () => {
    const submission = await acceptedIncident();
    activeSession = cairoBranchAdmin;
    const routes = captureRoutes();
    const created = responseRecorder();
    await routes.postRoutes.get(
      "/api/requests/from-submission/:submissionId"
    )?.(
      request("POST", {
        protectedMutation: true,
        params: { submissionId: submission.id },
        body: {
          expectedSubmissionRevision: submission.revision,
          idempotencyKey: "request-route-conflict-create-0001",
        },
      }),
      created.response
    );
    const requestId = (created.result.body as { request: { id: string } })
      .request.id;
    const conflict = responseRecorder();

    await routes.postRoutes.get("/api/requests/:requestId/assign")?.(
      request("POST", {
        protectedMutation: true,
        params: { requestId },
        body: {
          expectedVersion: 99,
          assigneeUserId: "usr_hod_demo",
          reason: "Arabic department owns the room.",
          idempotencyKey: "request-route-conflict-0001",
        },
      }),
      conflict.response
    );

    expect(conflict.result).toMatchObject({
      status: 409,
      body: {
        code: "request_version_conflict",
        details: { currentVersion: 1 },
      },
    });
  });
});
