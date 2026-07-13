import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ServerSession } from "../../../../server/auth";
import type {
  JotformClient,
  JotformSubmission,
} from "../../../../server/jotformClient";
import {
  createMemoryNileFormsCompatibilityRepository,
  resetDefaultNileFormsCompatibilityRepository,
  setNileFormsCompatibilityRepository,
  type NileFormsCompatibilityRepository,
} from "../../../../server/nileFormsCompatibilityRepository";
import { createNileFormsMigrationService } from "../../../../server/nileFormsMigrationService";

const fixedNow = new Date("2026-07-11T20:00:00.000Z");
let restoreRepository: (() => void) | undefined;
let testRepository: NileFormsCompatibilityRepository;
let idCounter = 0;

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

const registrar: ServerSession = {
  ...superAdmin,
  id: "session_registrar",
  userId: "usr_registrar_demo",
  roles: ["registrar"],
  activeRole: "registrar",
  branchIds: ["br_cairo"],
};

const questions = [
  { qid: "1", text: "Full name", type: "control_textbox", order: "1" },
  { qid: "2", text: "Email", type: "control_email", order: "2" },
  { qid: "3", text: "Phone", type: "control_phone", order: "3" },
  { qid: "4", text: "Course", type: "control_dropdown", order: "4" },
  { qid: "5", text: "Contact", type: "control_radio", order: "5" },
  { qid: "6", text: "Branch", type: "control_dropdown", order: "6" },
];

function answer(answer: unknown) {
  return { answer };
}

function sourceSubmission(
  id: string,
  values: [unknown, unknown, unknown, unknown, unknown, unknown]
): JotformSubmission {
  return {
    id,
    form_id: "1234567890123",
    created_at: "2026-06-10 12:00:00",
    answers: {
      "1": answer(values[0]),
      "2": answer(values[1]),
      "3": answer(values[2]),
      "4": answer(values[3]),
      "5": answer(values[4]),
      "6": answer(values[5]),
    },
  };
}

function fakeClient(submissions: JotformSubmission[]): JotformClient {
  return {
    region: "standard",
    async listForms() {
      return {
        forms: [
          {
            id: "1234567890123",
            title: "Legacy enquiry",
            status: "ENABLED",
            count: String(submissions.length),
          },
        ],
        resultSet: { offset: 0, limit: 1000, count: 1 },
      };
    },
    async getForm() {
      return {
        id: "1234567890123",
        title: "Legacy enquiry",
        status: "ENABLED",
        count: String(submissions.length),
      };
    },
    async getQuestions() {
      return questions;
    },
    async getSubmissions(_formId, offset = 0, limit = 500) {
      return {
        submissions: structuredClone(submissions.slice(offset, offset + limit)),
        resultSet: { offset, limit, count: submissions.length },
      };
    },
  };
}

const mapping = [
  { sourceQuestionId: "1", targetFieldId: "full_name" },
  { sourceQuestionId: "2", targetFieldId: "email" },
  { sourceQuestionId: "3", targetFieldId: "phone" },
  { sourceQuestionId: "4", targetFieldId: "course_interest" },
  { sourceQuestionId: "5", targetFieldId: "preferred_contact" },
  { sourceQuestionId: "6", targetFieldId: "preferred_branch" },
];

beforeEach(() => {
  idCounter = 0;
  testRepository = createMemoryNileFormsCompatibilityRepository();
  restoreRepository = setNileFormsCompatibilityRepository(testRepository);
});

afterEach(() => {
  restoreRepository?.();
  restoreRepository = undefined;
  resetDefaultNileFormsCompatibilityRepository();
});

describe("Nile Forms finite Jotform migration", () => {
  it("dry-runs, imports without promotion, replays safely, and reconciles", async () => {
    const repository = createMemoryNileFormsCompatibilityRepository();
    testRepository = repository;
    restoreRepository?.();
    restoreRepository = setNileFormsCompatibilityRepository(repository);
    const submissions = [
      sourceSubmission("90001", [
        "Legacy Applicant",
        "legacy@example.test",
        "+20 100 111 2222",
        "Arabic",
        "Email",
        "br_cairo",
      ]),
      sourceSubmission("90002", [
        "A",
        "not-an-email",
        "",
        "Unknown",
        "Email",
        "",
      ]),
    ];
    const service = createNileFormsMigrationService({
      repository: testRepository,
      getClient: () => fakeClient(submissions),
      now: () => fixedNow,
      randomId: prefix => `${prefix}_test_${++idCounter}`,
    });

    const preview = await service.preview(superAdmin, {
      sourceFormId: "1234567890123",
      targetPublicationId: "publication_form_enquiry_1",
      mapping,
      limit: 100,
    });
    expect(preview.run).toMatchObject({
      status: "previewed",
      totalRows: 2,
      validRows: 1,
      exceptionRows: 1,
    });
    expect(preview.sample).toEqual([
      expect.objectContaining({ sourceSubmissionId: "90001", valid: true }),
      expect.objectContaining({ sourceSubmissionId: "90002", valid: false }),
    ]);

    const committed = await service.commit(superAdmin, {
      runId: preview.run.id,
      previewHash: preview.run.previewHash,
    });
    const replay = await service.commit(superAdmin, {
      runId: preview.run.id,
      previewHash: preview.run.previewHash,
    });
    expect(committed.run).toMatchObject({
      status: "imported",
      importedRows: 1,
      duplicateRows: 0,
      exceptionRows: 1,
    });
    expect(replay).toEqual(committed);

    const state = await repository.read();
    expect(state.submissions).toHaveLength(1);
    expect(state.submissions[0]).toMatchObject({
      source: "legacy_import",
      status: "submitted",
      legacySource: {
        formId: "1234567890123",
        submissionId: "90001",
        reconciliationStatus: "pending",
      },
    });
    expect(state.promotions).toHaveLength(0);
    expect(state.outboxEvents).toHaveLength(0);
    expect(state.legacyImportRecords).toHaveLength(2);

    const pending = committed.records.find(
      record => record.reconciliationStatus === "pending"
    );
    expect(pending).toBeTruthy();
    const reconciled = await service.reconcile(superAdmin, pending!.id, {
      status: "matched",
      notes: "Compared with the read-only Jotform inbox.",
    });
    expect(reconciled.record.reconciliationStatus).toBe("matched");
    expect(reconciled.run?.status).toBe("reconciled");
  });

  it("blocks non-admin authority and stale previews", async () => {
    const submissions = [
      sourceSubmission("90001", [
        "Legacy Applicant",
        "legacy@example.test",
        "+20 100 111 2222",
        "Arabic",
        "Email",
        "br_cairo",
      ]),
    ];
    const service = createNileFormsMigrationService({
      repository: testRepository,
      getClient: () => fakeClient(submissions),
      now: () => fixedNow,
      randomId: prefix => `${prefix}_test_${++idCounter}`,
    });

    await expect(service.listRemoteForms(registrar)).rejects.toMatchObject({
      statusCode: 403,
      code: "migration_authority_denied",
    });

    const preview = await service.preview(superAdmin, {
      sourceFormId: "1234567890123",
      targetPublicationId: "publication_form_enquiry_1",
      mapping,
    });
    submissions[0].answers["1"] = answer("Changed after preview");

    await expect(
      service.commit(superAdmin, {
        runId: preview.run.id,
        previewHash: preview.run.previewHash,
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "migration_source_changed",
    });
  });

  it("counts an already imported source as a duplicate in a later approved run", async () => {
    const submissions = [
      sourceSubmission("90001", [
        "Legacy Applicant",
        "legacy@example.test",
        "+20 100 111 2222",
        "Arabic",
        "Email",
        "br_cairo",
      ]),
    ];
    const service = createNileFormsMigrationService({
      repository: testRepository,
      getClient: () => fakeClient(submissions),
      now: () => fixedNow,
      randomId: prefix => `${prefix}_test_${++idCounter}`,
    });
    const first = await service.preview(superAdmin, {
      sourceFormId: "1234567890123",
      targetPublicationId: "publication_form_enquiry_1",
      mapping,
    });
    await service.commit(superAdmin, {
      runId: first.run.id,
      previewHash: first.run.previewHash,
    });
    const second = await service.preview(superAdmin, {
      sourceFormId: "1234567890123",
      targetPublicationId: "publication_form_enquiry_1",
      mapping,
    });
    const committed = await service.commit(superAdmin, {
      runId: second.run.id,
      previewHash: second.run.previewHash,
    });

    expect(second.run.duplicateRows).toBe(1);
    expect(committed.run).toMatchObject({ importedRows: 0, duplicateRows: 1 });
  });
});
