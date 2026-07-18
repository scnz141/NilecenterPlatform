import { beforeEach, describe, expect, it } from "vitest";

import type { ServerSession } from "../../../../server/auth";
import {
  createMemoryNileFormsCompatibilityRepository,
  type NileFormsCompatibilityRepository,
} from "../../../../server/nileFormsCompatibilityRepository";
import { createNileFormsService } from "../../../../server/nileFormsService";
import { createNileRequestsService } from "../../../../server/nileRequestsService";
import { seedPlatformState } from "@/lib/domain/seed";

const fixedNow = new Date("2026-07-18T09:00:00.000Z");
let repository: NileFormsCompatibilityRepository;
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
const arabicHod = session("headofdepartment", "usr_hod_demo", {
  branchIds: ["br_global"],
  departmentIds: ["dep_arabic"],
});
const quranHod = session("headofdepartment", "usr_hod_quran_demo", {
  branchIds: ["br_global"],
  departmentIds: ["dep_quran"],
});
const superAdmin = session("superadmin", "usr_admin_demo");

function services() {
  const common = {
    repository,
    now: () => fixedNow,
    randomId: (prefix: string) => `${prefix}_test_${++idCounter}`,
    readAuthorityState: async () => structuredClone(seedPlatformState),
  };
  return {
    forms: createNileFormsService({
      ...common,
      draftKey: Buffer.alloc(32, 8),
    }),
    requests: createNileRequestsService(common),
  };
}

async function acceptedIncident(
  clientSubmissionId: string,
  answers: Record<string, unknown> = {}
) {
  const { forms } = services();
  const submitted = await forms.submit({
    publicationId: "publication_form_incident_1",
    clientSubmissionId,
    session: cairoStudent,
    answers: {
      location: "Room 204",
      issue_type: "maintenance",
      severity: 3,
      details: "The classroom projector loses power during every lesson.",
      ...answers,
    },
  });
  await forms.reviewSubmission(superAdmin, submitted.submission.id, {
    decision: "under_review",
    expectedRevision: 1,
  });
  const accepted = await forms.reviewSubmission(
    superAdmin,
    submitted.submission.id,
    {
      decision: "accepted",
      comments: "Verified by operations.",
      expectedRevision: 2,
    }
  );
  return accepted.submission;
}

async function createRequest(
  clientSubmissionId = "incident-client-0001",
  idempotencyKey = "request-create-0001"
) {
  const submission = await acceptedIncident(clientSubmissionId);
  const { requests } = services();
  const created = await requests.createFromReviewedSubmission(
    superAdmin,
    submission.id,
    {
      expectedSubmissionRevision: submission.revision,
      idempotencyKey,
    }
  );
  return { submission, created, requests };
}

beforeEach(() => {
  idCounter = 0;
  repository = createMemoryNileFormsCompatibilityRepository();
});

describe("Nile Requests reviewed-submission lifecycle", () => {
  it("creates one request from exact immutable reviewed evidence", async () => {
    const submission = await acceptedIncident("incident-client-lineage-0001");
    const stateBefore = await repository.read();
    const sourceBefore = structuredClone(
      stateBefore.submissions.find(item => item.id === submission.id)
    );
    const { requests } = services();

    const candidate = await requests.getCreationCandidate(
      cairoBranchAdmin,
      submission.id
    );
    expect(candidate).toMatchObject({
      requesterName: "Cairo Student Demo",
      branchName: "Cairo B1",
      mappedRequest: {
        location: "Room 204",
        category: "maintenance",
        priority: "high",
      },
    });

    const first = await requests.createFromReviewedSubmission(
      cairoBranchAdmin,
      submission.id,
      {
        expectedSubmissionRevision: submission.revision,
        idempotencyKey: "request-lineage-create-0001",
      }
    );
    const replay = await requests.createFromReviewedSubmission(
      cairoBranchAdmin,
      submission.id,
      {
        expectedSubmissionRevision: submission.revision,
        idempotencyKey: "request-lineage-create-0001",
      }
    );
    expect(replay).toMatchObject({ replayed: true });
    expect(replay.request.id).toBe(first.request.id);
    expect(first.request).toMatchObject({
      requestNumber: "REQ-2026-0001",
      requesterUserId: "usr_student_cairo_demo",
      sourceSubmissionId: submission.id,
      sourceDefinitionId: "form_incident",
      sourcePublicationId: "publication_form_incident_1",
      sourceVersionId: "version_form_incident_1",
      branchId: "br_cairo",
      departmentId: "dep_arabic",
      status: "open",
      version: 1,
    });

    await expect(
      requests.createFromReviewedSubmission(cairoBranchAdmin, submission.id, {
        expectedSubmissionRevision: submission.revision,
        idempotencyKey: "request-lineage-create-0002",
      })
    ).rejects.toMatchObject({ code: "request_source_already_used" });

    const stateAfter = await repository.read();
    expect(
      stateAfter.submissions.find(item => item.id === submission.id)
    ).toEqual(sourceBefore);
    expect(stateAfter.requests.requests).toHaveLength(1);
    expect(
      stateAfter.auditEvents.filter(
        event =>
          event.entityType === "NileRequest" &&
          event.entityId === first.request.id
      )
    ).toHaveLength(1);
  });

  it("executes the complete scoped command loop with immutable history", async () => {
    const { created, requests } = await createRequest();
    const requestId = created.request.id;

    const assigned = await requests.assign(cairoBranchAdmin, requestId, {
      expectedVersion: 1,
      assigneeUserId: "usr_hod_demo",
      reason: "Arabic department owns this classroom.",
      idempotencyKey: "request-assign-0001",
    });
    expect(assigned.request).toMatchObject({
      status: "assigned",
      assigneeUserId: "usr_hod_demo",
      version: 2,
    });
    const replay = await requests.assign(cairoBranchAdmin, requestId, {
      expectedVersion: 1,
      assigneeUserId: "usr_hod_demo",
      reason: "Arabic department owns this classroom.",
      idempotencyKey: "request-assign-0001",
    });
    expect(replay).toMatchObject({ replayed: true });
    expect(replay.request.version).toBe(2);

    await requests.start(arabicHod, requestId, {
      expectedVersion: 2,
      idempotencyKey: "request-start-0001",
    });
    await requests.comment(cairoStudent, requestId, {
      expectedVersion: 3,
      body: "The issue also affects the audio system.",
      idempotencyKey: "request-comment-0001",
    });
    await requests.reprioritize(cairoBranchAdmin, requestId, {
      expectedVersion: 4,
      priority: "urgent",
      reason: "The room is needed for tomorrow's classes.",
      idempotencyKey: "request-priority-0001",
    });
    const resolved = await requests.resolve(arabicHod, requestId, {
      expectedVersion: 5,
      resolution: "Replaced the projector power supply and tested the audio.",
      idempotencyKey: "request-resolve-0001",
    });
    expect(resolved.request).toMatchObject({
      status: "resolved",
      priority: "urgent",
      version: 6,
    });

    const detail = await requests.getRequest(cairoStudent, requestId);
    expect(detail.comments).toHaveLength(1);
    expect(detail.activities.map(item => item.type)).toEqual([
      "created",
      "assigned",
      "started",
      "commented",
      "reprioritized",
      "resolved",
    ]);
    expect(detail.reassignments).toHaveLength(1);
    expect(detail.capabilities).toEqual({
      canAssign: false,
      canReprioritize: false,
      canStart: false,
      canComment: false,
      canResolve: false,
      canCancel: false,
    });

    const beforeDenied = await repository.read();
    await expect(
      requests.comment(cairoStudent, requestId, {
        expectedVersion: 6,
        body: "This must not be appended.",
        idempotencyKey: "request-terminal-comment-0001",
      })
    ).rejects.toMatchObject({ code: "request_terminal" });
    expect(await repository.read()).toEqual(beforeDenied);
  });

  it("denies cross-scope, stale, conflicting, and malformed commands with no writes", async () => {
    const { created, requests } = await createRequest(
      "incident-client-denials-0001",
      "request-denials-create-0001"
    );
    const requestId = created.request.id;

    await expect(
      requests.getRequest(alexBranchAdmin, requestId)
    ).rejects.toMatchObject({
      code: "request_scope_denied",
    });
    await expect(
      requests.getRequest(quranHod, requestId)
    ).rejects.toMatchObject({
      code: "request_scope_denied",
    });
    const before = await repository.read();
    await expect(
      requests.assign(alexBranchAdmin, requestId, {
        expectedVersion: 1,
        assigneeUserId: "usr_branch_alex_demo",
        reason: "Cross branch assignment attempt.",
        idempotencyKey: "request-cross-scope-0001",
      })
    ).rejects.toMatchObject({ code: "request_scope_denied" });
    await expect(
      requests.assign(cairoBranchAdmin, requestId, {
        expectedVersion: 99,
        assigneeUserId: "usr_hod_demo",
        reason: "Stale assignment attempt.",
        idempotencyKey: "request-stale-assign-0001",
      })
    ).rejects.toMatchObject({ code: "request_version_conflict" });
    expect(await repository.read()).toEqual(before);

    await requests.assign(cairoBranchAdmin, requestId, {
      expectedVersion: 1,
      assigneeUserId: "usr_hod_demo",
      reason: "Correct scoped assignment.",
      idempotencyKey: "request-conflict-key-0001",
    });
    const afterSuccess = await repository.read();
    await expect(
      requests.assign(cairoBranchAdmin, requestId, {
        expectedVersion: 1,
        assigneeUserId: "usr_branch_demo",
        reason: "Different command under the same key.",
        idempotencyKey: "request-conflict-key-0001",
      })
    ).rejects.toMatchObject({ code: "request_idempotency_conflict" });
    expect(await repository.read()).toEqual(afterSuccess);
  });

  it("lets a requester read, comment, and cancel only their own non-active request", async () => {
    const { created, requests } = await createRequest(
      "incident-client-requester-0001",
      "request-requester-create-0001"
    );
    const requestId = created.request.id;
    expect(await requests.listRequests(cairoStudent)).toHaveLength(1);

    const commented = await requests.comment(cairoStudent, requestId, {
      expectedVersion: 1,
      body: "Please avoid the morning lesson window.",
      idempotencyKey: "request-requester-comment-0001",
    });
    const cancelled = await requests.cancel(cairoStudent, requestId, {
      expectedVersion: commented.request.version,
      reason: "The issue was resolved locally before assignment.",
      idempotencyKey: "request-requester-cancel-0001",
    });
    expect(cancelled.request).toMatchObject({
      status: "cancelled",
      version: 3,
    });
    expect(await requests.listRequests(alexBranchAdmin)).toEqual([]);
  });
});
