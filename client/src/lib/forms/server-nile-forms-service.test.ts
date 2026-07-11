import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ServerSession } from "../../../../server/auth";
import {
  createMemoryNileFormsRepository,
  resetDefaultNileFormsRepository,
  setNileFormsRepository,
  type NileFormsRepository,
} from "../../../../server/nileFormsRepository";
import {
  createNileFormsService,
  NileFormsError,
} from "../../../../server/nileFormsService";
import type { FormVersionContent } from "@shared/nileForms";
import { nileFormsTemplateContent } from "@shared/nileFormsFixtures";
import { seedPlatformState } from "@/lib/domain/seed";

const fixedNow = new Date("2026-07-11T15:00:00.000Z");
let restoreRepository: (() => void) | undefined;
let testRepository: NileFormsRepository;
let idCounter = 0;

function session(
  role: ServerSession["activeRole"],
  userId: string,
  scope: { branchIds?: string[]; departmentIds?: string[] } = {}
): ServerSession {
  return {
    id: `session_${role}`,
    userId,
    email: `${role}@nilelearn.local`,
    name: role,
    roles: [role],
    activeRole: role,
    provider: "demo",
    authorizationModel: "snapshot",
    branchIds: scope.branchIds,
    departmentIds: scope.departmentIds,
    createdAt: "2026-07-11T12:00:00.000Z",
    expiresAt: "2026-07-12T00:00:00.000Z",
  };
}

const registrar = session("registrar", "usr_registrar_demo", {
  branchIds: ["br_cairo"],
});
const branchAdmin = session("branchadmin", "usr_branch_demo", {
  branchIds: ["br_cairo"],
});
const student = session("student", "usr_student_demo", {
  branchIds: ["br_online"],
  departmentIds: ["dep_arabic"],
});
const superAdmin = session("superadmin", "usr_admin_demo");

function createService(
  overrides: Parameters<typeof createNileFormsService>[0] = {}
) {
  return createNileFormsService({
    repository: testRepository,
    now: () => fixedNow,
    randomId: prefix => `${prefix}_test_${++idCounter}`,
    draftKey: Buffer.alloc(32, 7),
    executePromotion: vi.fn(async () => ({
      commandId: "command_test_1",
      entityType: "Lead",
      entityId: "lead_test_1",
    })),
    readAuthorityState: async () => structuredClone(seedPlatformState),
    ...overrides,
  });
}

async function submitPublicEnquiry(service: ReturnType<typeof createService>) {
  return service.submit({
    publicationId: "publication_form_enquiry_1",
    clientSubmissionId: "submission-client-0001",
    answers: {
      full_name: "Public Applicant",
      email: "public@example.test",
      phone: "+20 100 000 0000",
      course_interest: "arabic",
      preferred_contact: "email",
    },
  });
}

beforeEach(() => {
  idCounter = 0;
  testRepository = createMemoryNileFormsRepository();
  restoreRepository = setNileFormsRepository(testRepository);
});

afterEach(() => {
  restoreRepository?.();
  restoreRepository = undefined;
  resetDefaultNileFormsRepository();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("Nile Forms server authority", () => {
  it("scopes definition management by owner role and branch", async () => {
    const service = createService();

    await expect(service.listDefinitions(registrar)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "form_application",
          branchId: "br_cairo",
        }),
        expect.objectContaining({ id: "form_placement", branchId: "br_cairo" }),
      ])
    );
    await expect(
      service.getDefinition(registrar, "form_incident")
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "form_scope_denied",
    });
    await expect(
      service.createDefinition(registrar, {
        key: "alex_intake",
        titleEn: "Alex intake",
        titleAr: "طلب الإسكندرية",
        category: "admissions",
        branchId: "br_alex",
      })
    ).rejects.toMatchObject({ statusCode: 403, code: "branch_scope_denied" });
  });

  it("creates a new draft when a published version is edited and keeps the original immutable", async () => {
    const service = createService();
    const draft = await service.createDraftVersion(
      registrar,
      "form_application"
    );
    expect(draft.versionNumber).toBe(2);
    expect(draft.status).toBe("draft");

    const content: FormVersionContent = {
      ...structuredClone(draft.content),
      title: { en: "Updated application", ar: "طلب محدّث" },
    };
    const saved = await service.updateDraftVersion(
      registrar,
      "form_application",
      draft.id,
      { expectedRevision: 1, content }
    );
    expect(saved.revision).toBe(2);

    const published = await service.publishVersion(
      registrar,
      "form_application",
      draft.id,
      {
        slug: "course-application-v2",
        audience: "public",
        allowDrafts: true,
      }
    );
    expect(published.version.status).toBe("published");

    await expect(
      service.updateDraftVersion(registrar, "form_application", draft.id, {
        expectedRevision: 2,
        content,
      })
    ).rejects.toMatchObject({ statusCode: 409, code: "version_immutable" });
    const bundle = await service.getDefinition(registrar, "form_application");
    expect(bundle.versions.find(item => item.versionNumber === 1)?.status).toBe(
      "published"
    );
  });

  it("stores guest drafts with only a token hash and encrypted payload", async () => {
    const repository = createMemoryNileFormsRepository();
    testRepository = repository;
    restoreRepository?.();
    restoreRepository = setNileFormsRepository(repository);
    const service = createService();

    const saved = await service.saveDraft({
      publicationId: "publication_form_enquiry_1",
      answers: { full_name: "Draft Applicant", injected_role: "superadmin" },
    });
    expect(saved.draftToken).toBeTruthy();
    expect(saved.answers).toEqual({ full_name: "Draft Applicant" });

    const state = await repository.read();
    expect(state.drafts[0].guestTokenHash).not.toBe(saved.draftToken);
    expect(state.drafts[0].encryptedPayload).not.toContain("Draft Applicant");
    expect(JSON.stringify(state)).not.toContain(saved.draftToken!);

    await expect(
      service.loadDraft({
        publicationId: "publication_form_enquiry_1",
        draftToken: saved.draftToken,
      })
    ).resolves.toMatchObject({ answers: { full_name: "Draft Applicant" } });
  });

  it("returns only assigned forms whose definition scope also matches the session", async () => {
    const service = createService();
    const assigned = await service.listAssigned(student);
    const keys = assigned.map(item => item.definition.key);

    expect(keys).toContain("student_support");
    expect(keys).toContain("learning_consent");
    expect(keys).not.toContain("attendance_exception");
    expect(keys).not.toContain("branch_incident");
  });

  it("keeps a single response on an owner-only detail route until it is withdrawn", async () => {
    const service = createService();
    const { submission } = await service.submit({
      publicationId: "publication_form_consent_1",
      session: student,
      clientSubmissionId: "consent-client-0001",
      answers: {
        accepted: true,
        typed_name: "Student Demo",
      },
    });

    await expect(
      service.getAssignedForm(student, "publication_form_consent_1")
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "response_limit_reached",
      details: { submissionId: submission.id },
    });
    await expect(
      service.getOwnSubmission(
        session("student", "usr_student_cairo_demo", {
          branchIds: ["br_cairo"],
          departmentIds: ["dep_arabic"],
        }),
        "publication_form_consent_1",
        submission.id
      )
    ).rejects.toMatchObject({ statusCode: 403, code: "ownership_denied" });

    const detail = await service.getOwnSubmission(
      student,
      "publication_form_consent_1",
      submission.id
    );
    expect(detail).toMatchObject({
      submission: { id: submission.id, status: "submitted" },
      definition: { key: "learning_consent" },
    });
    expect(detail.reviews).toEqual([]);

    await service.withdrawSubmission(
      student,
      submission.id,
      submission.revision
    );
    await expect(
      service.getAssignedForm(student, "publication_form_consent_1")
    ).resolves.toMatchObject({
      publication: { id: "publication_form_consent_1" },
    });
  });

  it("does not reveal an assigned draft after the assignment is revoked", async () => {
    const repository = createMemoryNileFormsRepository();
    testRepository = repository;
    restoreRepository?.();
    restoreRepository = setNileFormsRepository(repository);
    const service = createService();

    await service.saveDraft({
      publicationId: "publication_form_support_1",
      session: student,
      answers: {
        category: "technical",
        subject: "Course access",
        details: "I need help opening my next Arabic lesson.",
        urgent: true,
      },
    });
    const assignment = (await repository.read()).assignments.find(
      item => item.publicationId === "publication_form_support_1"
    );
    if (!assignment) throw new Error("Expected student support assignment");
    await service.revokeAssignment(superAdmin, assignment.id);

    await expect(
      service.loadDraft({
        publicationId: "publication_form_support_1",
        session: student,
      })
    ).rejects.toMatchObject({ statusCode: 403, code: "assignment_denied" });
  });

  it("validates, strips unknown answers, records evidence, and replays idempotently", async () => {
    const repository = createMemoryNileFormsRepository();
    testRepository = repository;
    restoreRepository?.();
    restoreRepository = setNileFormsRepository(repository);
    const service = createService();

    const first = await service.submit({
      publicationId: "publication_form_enquiry_1",
      clientSubmissionId: "submission-client-0002",
      answers: {
        full_name: "Applicant",
        email: "applicant@example.test",
        phone: "+20 111 111 1111",
        course_interest: "quran",
        preferred_contact: "phone",
        actorId: "usr_admin_demo",
      },
    });
    const replay = await service.submit({
      publicationId: "publication_form_enquiry_1",
      clientSubmissionId: "submission-client-0002",
      answers: {
        full_name: "Applicant",
        email: "applicant@example.test",
        phone: "+20 111 111 1111",
        course_interest: "quran",
        preferred_contact: "phone",
      },
    });

    expect(first.replayed).toBe(false);
    expect(first.submission.branchId).toBe("br_cairo");
    expect(first.submission.answers).not.toHaveProperty("actorId");
    expect(replay).toEqual({ submission: first.submission, replayed: true });
    const state = await repository.read();
    expect(state.submissions).toHaveLength(1);
    expect(state.auditEvents).toContainEqual(
      expect.objectContaining({ action: "form.submitted" })
    );
    expect(state.outboxEvents).toContainEqual(
      expect.objectContaining({ eventType: "form.submitted" })
    );
  });

  it("rejects an idempotency key reused with different answers", async () => {
    const service = createService();
    await submitPublicEnquiry(service);

    await expect(
      service.submit({
        publicationId: "publication_form_enquiry_1",
        clientSubmissionId: "submission-client-0001",
        answers: {
          full_name: "Different Applicant",
          email: "different@example.test",
          phone: "+20 199 999 9999",
          course_interest: "english",
          preferred_contact: "email",
        },
      })
    ).rejects.toMatchObject({ statusCode: 409, code: "idempotency_conflict" });
  });

  it("enforces the linear review lifecycle and optimistic revision", async () => {
    const service = createService();
    const { submission } = await submitPublicEnquiry(service);

    await expect(
      service.reviewSubmission(registrar, submission.id, {
        decision: "accepted",
        expectedRevision: 1,
      })
    ).rejects.toMatchObject({ code: "review_transition_invalid" });

    const started = await service.reviewSubmission(registrar, submission.id, {
      decision: "under_review",
      expectedRevision: 1,
    });
    expect(started.submission.status).toBe("under_review");

    await expect(
      service.reviewSubmission(registrar, submission.id, {
        decision: "accepted",
        expectedRevision: 1,
      })
    ).rejects.toMatchObject({ code: "revision_conflict" });

    const accepted = await service.reviewSubmission(registrar, submission.id, {
      decision: "accepted",
      expectedRevision: 2,
      comments: "Identity and course request checked.",
    });
    expect(accepted.submission.status).toBe("accepted");
    expect(accepted.submission.revision).toBe(3);
  });

  it("denies cross-workflow review scope", async () => {
    const service = createService();
    const { submission } = await submitPublicEnquiry(service);

    await expect(
      service.reviewSubmission(branchAdmin, submission.id, {
        decision: "under_review",
        expectedRevision: 1,
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "submission_scope_denied",
    });
  });

  it("promotes accepted submissions once through the registered adapter", async () => {
    const executePromotion = vi.fn(async () => ({
      commandId: "command_lead_1",
      entityType: "Lead",
      entityId: "lead_1",
    }));
    const service = createService({ executePromotion });
    const { submission } = await submitPublicEnquiry(service);
    await service.reviewSubmission(registrar, submission.id, {
      decision: "under_review",
      expectedRevision: 1,
    });
    await service.reviewSubmission(registrar, submission.id, {
      decision: "accepted",
      expectedRevision: 2,
    });

    const promotion = await service.promoteSubmission(
      registrar,
      submission.id,
      {
        expectedRevision: 3,
        idempotencyKey: "promotion-client-0001",
      }
    );
    const replay = await service.promoteSubmission(registrar, submission.id, {
      expectedRevision: 3,
      idempotencyKey: "promotion-client-0001",
    });

    expect(promotion).toMatchObject({
      adapter: "lead.create",
      status: "succeeded",
      resultingEntityId: "lead_1",
    });
    expect(replay).toEqual(promotion);
    expect(executePromotion).toHaveBeenCalledTimes(1);
  });

  it("exports only server-scoped submissions and explicitly reportable fields", async () => {
    const service = createService();
    await submitPublicEnquiry(service);
    const exported = await service.exportSubmissions(registrar);

    expect(exported.rowCount).toBe(1);
    expect(exported.csv).toContain("course_interest");
    expect(exported.csv).not.toContain("preferred_contact");
    expect(exported.csv).not.toContain("public@example.test");
  });

  it("fails closed for normalized sessions until durable form persistence is active", async () => {
    const service = createService();
    const normalized = {
      ...superAdmin,
      authorizationModel: "normalized" as const,
    };

    await expect(service.listDefinitions(normalized)).rejects.toBeInstanceOf(
      NileFormsError
    );
    await expect(service.listDefinitions(normalized)).rejects.toMatchObject({
      statusCode: 503,
      code: "normalized_persistence_inactive",
    });
  });

  it("keeps restricted fields out of offline publication settings", async () => {
    const service = createService();
    const created = await service.createDefinition(superAdmin, {
      key: "restricted_staff_form",
      titleEn: "Restricted staff form",
      titleAr: "نموذج موظفين مقيد",
      category: "consent",
    });
    const restricted = structuredClone(nileFormsTemplateContent.incident);
    restricted.pages[0].fields[0].dataClass = "health";
    await service.updateDraftVersion(
      superAdmin,
      created.definition.id,
      created.version.id,
      {
        expectedRevision: 1,
        content: restricted,
      }
    );

    await expect(
      service.publishVersion(
        superAdmin,
        created.definition.id,
        created.version.id,
        {
          slug: "restricted-staff-form",
          audience: "assigned",
          offlineEligible: true,
        }
      )
    ).rejects.toMatchObject({ statusCode: 400, code: "offline_not_eligible" });
  });

  it("enrolls staff devices and downloads only assigned offline-safe forms", async () => {
    const service = createService();

    await expect(
      service.enrollOfflineDevice(student, "Student phone")
    ).rejects.toMatchObject({ statusCode: 403, code: "offline_staff_only" });

    const enrollment = await service.enrollOfflineDevice(
      branchAdmin,
      "Cairo front desk"
    );
    expect(enrollment.deviceToken).toMatch(/^[a-zA-Z0-9_-]+$/);

    const bundle = await service.getOfflineBundle(
      branchAdmin,
      enrollment.device.id,
      enrollment.deviceToken
    );
    expect(bundle.forms.map(item => item.definition.key)).toEqual([
      "branch_incident",
    ]);
    expect(Date.parse(bundle.expiresAt) - fixedNow.getTime()).toBe(
      72 * 60 * 60 * 1_000
    );

    await expect(
      service.getOfflineBundle(
        branchAdmin,
        enrollment.device.id,
        "wrong-device-token"
      )
    ).rejects.toMatchObject({ statusCode: 403, code: "offline_device_denied" });
  });

  it("expires and revokes offline device credentials", async () => {
    const service = createService();
    const enrollment = await service.enrollOfflineDevice(
      branchAdmin,
      "Cairo front desk"
    );

    await service.revokeOfflineDevice(branchAdmin, enrollment.device.id);
    await expect(
      service.getOfflineBundle(
        branchAdmin,
        enrollment.device.id,
        enrollment.deviceToken
      )
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "offline_device_revoked",
    });

    const active = await service.enrollOfflineDevice(
      branchAdmin,
      "Second device"
    );
    const expiredService = createService({
      now: () => new Date(fixedNow.getTime() + 73 * 60 * 60 * 1_000),
    });
    await expect(
      expiredService.getOfflineBundle(
        branchAdmin,
        active.device.id,
        active.deviceToken
      )
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "offline_device_expired",
    });
  });

  it("syncs one offline response idempotently and emits one submission", async () => {
    const repository = createMemoryNileFormsRepository();
    testRepository = repository;
    restoreRepository?.();
    restoreRepository = setNileFormsRepository(repository);
    const service = createService();
    const enrollment = await service.enrollOfflineDevice(
      branchAdmin,
      "Cairo front desk"
    );
    const item = {
      publicationId: "publication_form_incident_1",
      versionId: "version_form_incident_1",
      clientSubmissionId: "offline-client-0001",
      clientSubmittedAt: fixedNow.toISOString(),
      respondentUserId: branchAdmin.userId,
      answers: {
        location: "Room 4",
        issue_type: "maintenance",
        severity: 3,
        details: "The classroom projector has stopped powering on.",
      },
    };

    const first = await service.syncOfflineBatch(
      branchAdmin,
      enrollment.device.id,
      enrollment.deviceToken,
      [item]
    );
    const replay = await service.syncOfflineBatch(
      branchAdmin,
      enrollment.device.id,
      enrollment.deviceToken,
      [item]
    );

    expect(first.receipts).toEqual([
      expect.objectContaining({
        clientSubmissionId: "offline-client-0001",
        status: "accepted",
      }),
    ]);
    expect(replay.receipts).toEqual(first.receipts);
    const state = await repository.read();
    expect(state.submissions).toHaveLength(1);
    expect(state.submissions[0]).toMatchObject({
      source: "offline",
      status: "submitted",
      respondentUserId: branchAdmin.userId,
    });
    expect(state.syncReceipts).toHaveLength(1);
    expect(
      state.outboxEvents.filter(item => item.eventType === "form.submitted")
    ).toHaveLength(1);
  });

  it("quarantines an offline response when the assignment changes before sync", async () => {
    const repository = createMemoryNileFormsRepository();
    testRepository = repository;
    restoreRepository?.();
    restoreRepository = setNileFormsRepository(repository);
    const service = createService();
    const enrollment = await service.enrollOfflineDevice(
      branchAdmin,
      "Cairo front desk"
    );
    await service.getOfflineBundle(
      branchAdmin,
      enrollment.device.id,
      enrollment.deviceToken
    );
    await repository.transaction(state => {
      const assignment = state.assignments.find(
        item => item.publicationId === "publication_form_incident_1"
      );
      if (!assignment) throw new Error("Expected incident assignment");
      assignment.revokedAt = fixedNow.toISOString();
    });

    const result = await service.syncOfflineBatch(
      branchAdmin,
      enrollment.device.id,
      enrollment.deviceToken,
      [
        {
          publicationId: "publication_form_incident_1",
          versionId: "version_form_incident_1",
          clientSubmissionId: "offline-client-0002",
          clientSubmittedAt: fixedNow.toISOString(),
          respondentUserId: branchAdmin.userId,
          answers: {
            location: "Reception",
            issue_type: "safety",
            severity: 5,
            details: "Water is collecting beside the main reception doorway.",
          },
        },
      ]
    );

    expect(result.receipts[0]).toMatchObject({
      status: "quarantined",
      reason: "assignment_or_scope_changed",
    });
    const state = await repository.read();
    expect(state.submissions[0].status).toBe("quarantined");
    expect(state.outboxEvents).toHaveLength(0);
  });

  it("binds submission idempotency to the authenticated respondent", async () => {
    const service = createService();
    const cairoStudent = session("student", "usr_student_cairo_demo", {
      branchIds: ["br_cairo"],
      departmentIds: ["dep_arabic"],
    });
    const answers = {
      full_name: "Student Applicant",
      email: "student@example.test",
      phone: "+20 100 000 0000",
      course_interest: "arabic",
      preferred_contact: "email",
    };

    const first = await service.submit({
      publicationId: "publication_form_enquiry_1",
      session: student,
      clientSubmissionId: "respondent-bound-0001",
      answers,
    });
    await expect(
      service.submit({
        publicationId: "publication_form_enquiry_1",
        session: cairoStudent,
        clientSubmissionId: "respondent-bound-0001",
        answers,
      })
    ).rejects.toMatchObject({ statusCode: 409, code: "idempotency_conflict" });
    expect(first.submission.respondentUserId).toBe(student.userId);
  });

  it("opens a scheduled publication when its opening time arrives", async () => {
    const repository = createMemoryNileFormsRepository();
    testRepository = repository;
    restoreRepository?.();
    restoreRepository = setNileFormsRepository(repository);
    await repository.transaction(state => {
      const publication = state.publications.find(
        item => item.id === "publication_form_enquiry_1"
      );
      if (!publication) throw new Error("Expected enquiry publication");
      publication.status = "scheduled";
      publication.opensAt = "2026-07-11T14:00:00.000Z";
    });

    await expect(
      createService().getPublicForm("free-trial-enquiry")
    ).resolves.toMatchObject({
      publication: { id: "publication_form_enquiry_1" },
    });
  });

  it("rejects entity references outside server-resolved options", async () => {
    const service = createService();
    await expect(
      service.submit({
        publicationId: "publication_form_application_1",
        clientSubmissionId: "invalid-entity-0001",
        answers: {
          full_name: "Applicant",
          email: "applicant@example.test",
          phone: "+20 111 111 1111",
          date_of_birth: "1998-04-12",
          preferred_branch: "br_alex",
          course_interest: "arabic",
          schedule_preference: "Weekday evenings",
          current_level: "beginner",
          goals: "I want to build a strong Arabic foundation for study.",
          consent: true,
        },
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "answers_invalid",
      details: { preferred_branch: expect.any(Array) },
    });
  });

  it("keeps delegated review inside the submission branch", async () => {
    const service = createService();
    const { submission } = await submitPublicEnquiry(service);
    const onlineRegistrar = session("registrar", "usr_registrar_online_demo", {
      branchIds: ["br_online"],
    });

    await expect(
      service.reviewSubmission(onlineRegistrar, submission.id, {
        decision: "under_review",
        expectedRevision: 1,
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "submission_scope_denied",
    });
  });

  it("replays an identical review command without another mutation", async () => {
    const repository = createMemoryNileFormsRepository();
    testRepository = repository;
    restoreRepository?.();
    restoreRepository = setNileFormsRepository(repository);
    const service = createService();
    const { submission } = await submitPublicEnquiry(service);
    const command = { decision: "under_review", expectedRevision: 1 };

    const first = await service.reviewSubmission(
      registrar,
      submission.id,
      command
    );
    const replay = await service.reviewSubmission(
      registrar,
      submission.id,
      command
    );

    expect(first.replayed).toBe(false);
    expect(replay).toMatchObject({
      replayed: true,
      review: { id: first.review.id },
    });
    const state = await repository.read();
    expect(state.reviews).toHaveLength(1);
    expect(
      state.auditEvents.filter(item => item.action === "form.under_review")
    ).toHaveLength(1);
  });

  it("serializes concurrent promotion so the adapter executes once", async () => {
    const executePromotion = vi.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return {
        commandId: "command_concurrent_1",
        entityType: "Lead",
        entityId: "lead_concurrent_1",
      };
    });
    const service = createService({ executePromotion });
    const { submission } = await submitPublicEnquiry(service);
    await service.reviewSubmission(registrar, submission.id, {
      decision: "under_review",
      expectedRevision: 1,
    });
    await service.reviewSubmission(registrar, submission.id, {
      decision: "accepted",
      expectedRevision: 2,
    });

    const input = {
      expectedRevision: 3,
      idempotencyKey: "promotion-concurrent-0001",
    };
    const [first, replay] = await Promise.all([
      service.promoteSubmission(registrar, submission.id, input),
      service.promoteSubmission(registrar, submission.id, input),
    ]);

    expect(first).toMatchObject({ status: "succeeded" });
    expect(replay).toEqual(first);
    expect(executePromotion).toHaveBeenCalledTimes(1);
  });
});
