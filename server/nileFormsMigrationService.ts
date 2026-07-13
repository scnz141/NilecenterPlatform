import crypto from "node:crypto";

import type { ServerSession } from "./auth.js";
import {
  configuredJotformRegion,
  createJotformClientFromEnvironment,
  JotformApiError,
  type JotformClient,
  type JotformQuestion,
  type JotformSubmission,
} from "./jotformClient.js";
import {
  getNileFormsCompatibilityRepository,
  type NileFormsCompatibilityRepository,
} from "./nileFormsCompatibilityRepository.js";
import { NileFormsError } from "./nileFormsService.js";
import {
  normalizeAndValidateFormAnswers,
  type FormAuditEvent,
  type FormField,
  type FormLegacyFieldMapping,
  type FormLegacyImportRecord,
  type FormLegacyImportRun,
  type FormPublication,
  type FormSubmission,
  type FormVersion,
  type NileFormsState,
} from "../shared/nileForms.js";

type MigrationDependencies = {
  repository?: NileFormsCompatibilityRepository;
  getClient?: () => JotformClient;
  now?: () => Date;
  randomId?: (prefix: string) => string;
};

export type JotformMigrationTarget = {
  publication: FormPublication;
  version: Pick<FormVersion, "id" | "versionNumber" | "contentHash">;
  definition: { id: string; key: string; title: string };
};

export type JotformMigrationPreviewRow = {
  sourceSubmissionId: string;
  sourceCreatedAt?: string;
  payloadHash: string;
  valid: boolean;
  alreadyImported: boolean;
  errors: string[];
  mappedAnswers: Record<string, unknown>;
};

export type JotformMigrationRunBundle = {
  run: FormLegacyImportRun;
  records: FormLegacyImportRecord[];
};

type PreparedMigration = {
  sourceFormTitle: string;
  target: JotformMigrationTarget;
  mapping: FormLegacyFieldMapping[];
  questions: JotformQuestion[];
  rows: JotformMigrationPreviewRow[];
  previewHash: string;
  sourceOffset: number;
  sourceLimit: number;
};

const productionCompatibilityEnabled = () =>
  process.env.NODE_ENV !== "production" ||
  process.env.NILE_FORMS_COMPATIBILITY_ENABLED === "1";

function requireMigrationAdmin(session: ServerSession | null | undefined) {
  if (!session) {
    throw new NileFormsError("Sign in required.", 401, "sign_in_required");
  }
  if (!productionCompatibilityEnabled()) {
    throw new NileFormsError(
      "The Nile Forms compatibility runtime is disabled in production.",
      503,
      "runtime_not_enabled"
    );
  }
  if (session.authorizationModel === "normalized") {
    throw new NileFormsError(
      "Normalized Nile Forms persistence is not active.",
      503,
      "normalized_persistence_inactive"
    );
  }
  if (session.activeRole !== "superadmin") {
    throw new NileFormsError(
      "Legacy form migration requires Super Admin authority.",
      403,
      "migration_authority_denied"
    );
  }
  return session;
}

function clean(value: unknown, max = 1_000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map(key => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function hashValue(value: unknown) {
  return crypto
    .createHash("sha256")
    .update(canonicalJson(value), "utf8")
    .digest("hex");
}

function flattenFields(version: FormVersion) {
  return version.content.pages.flatMap(page => page.fields);
}

function answerFields(version: FormVersion) {
  return flattenFields(version).filter(
    field => field.type !== "heading" && field.type !== "instructions"
  );
}

function requireTarget(state: NileFormsState, publicationIdInput: unknown) {
  const publicationId = clean(publicationIdInput, 128);
  const publication = state.publications.find(
    item => item.id === publicationId
  );
  if (!publication || publication.status === "retired") {
    throw new NileFormsError(
      "Target form publication not found.",
      404,
      "migration_target_not_found"
    );
  }
  const definition = state.definitions.find(
    item => item.id === publication.definitionId
  );
  const version = state.versions.find(
    item => item.id === publication.versionId
  );
  if (!definition || !version || version.status !== "published") {
    throw new NileFormsError(
      "Target form version is not published.",
      409,
      "migration_target_unavailable"
    );
  }
  return {
    publication,
    version,
    definition: {
      id: definition.id,
      key: definition.key,
      title: definition.title,
    },
  } satisfies JotformMigrationTarget;
}

function publicTarget(
  target: ReturnType<typeof requireTarget>
): JotformMigrationTarget {
  return {
    publication: target.publication,
    version: {
      id: target.version.id,
      versionNumber: target.version.versionNumber,
      contentHash: target.version.contentHash,
    },
    definition: target.definition,
  };
}

function parseMapping(
  value: unknown,
  questions: JotformQuestion[],
  version: FormVersion
) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
    throw new NileFormsError(
      "At least one bounded field mapping is required.",
      400,
      "migration_mapping_invalid"
    );
  }
  const questionIds = new Set(questions.map(question => question.qid));
  const fields = new Map(answerFields(version).map(field => [field.id, field]));
  const sourceIds = new Set<string>();
  const targetIds = new Set<string>();
  const mapping = value.map(item => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new NileFormsError(
        "Field mapping is invalid.",
        400,
        "migration_mapping_invalid"
      );
    }
    const input = item as Record<string, unknown>;
    const sourceQuestionId = clean(input.sourceQuestionId, 80);
    const targetFieldId = clean(input.targetFieldId, 80);
    const field = fields.get(targetFieldId);
    if (
      !questionIds.has(sourceQuestionId) ||
      !field ||
      sourceIds.has(sourceQuestionId) ||
      targetIds.has(targetFieldId) ||
      (field.dataClass && field.dataClass !== "standard")
    ) {
      throw new NileFormsError(
        "Field mapping contains an unknown, duplicate, or restricted field.",
        400,
        "migration_mapping_invalid"
      );
    }
    sourceIds.add(sourceQuestionId);
    targetIds.add(targetFieldId);
    return { sourceQuestionId, targetFieldId };
  });
  return mapping;
}

function primitiveText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value))
    return value.map(primitiveText).filter(Boolean).join(", ");
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .map(primitiveText)
      .filter(Boolean)
      .join(" ");
  }
  return "";
}

function matchChoice(field: FormField, value: unknown) {
  const input = primitiveText(value).toLowerCase();
  return field.options?.find(option =>
    [option.id, option.label.en, option.label.ar]
      .map(item => item.trim().toLowerCase())
      .includes(input)
  )?.id;
}

function coerceAnswer(field: FormField, value: unknown): unknown {
  if (field.type === "multiple_choice") {
    const values = Array.isArray(value)
      ? value
      : primitiveText(value)
          .split(",")
          .map((item: string) => item.trim())
          .filter(Boolean);
    return values
      .map((item: unknown) => matchChoice(field, item) ?? primitiveText(item))
      .filter(Boolean);
  }
  if (field.type === "single_choice") {
    return matchChoice(field, value) ?? primitiveText(value);
  }
  if (field.type === "yes_no" || field.type === "consent") {
    if (typeof value === "boolean") return value;
    const normalized = primitiveText(value).toLowerCase();
    if (["yes", "true", "1", "on", "accepted"].includes(normalized))
      return true;
    if (["no", "false", "0", "off", "declined"].includes(normalized))
      return false;
    return value;
  }
  if (field.type === "number" || field.type === "rating") {
    const number = Number(primitiveText(value));
    return Number.isFinite(number) ? number : value;
  }
  return primitiveText(value);
}

function sourceAnswer(submission: JotformSubmission, questionId: string) {
  const answer = submission.answers?.[questionId];
  if (!answer) return undefined;
  return answer.answer ?? answer.prettyFormat;
}

function prepareRows(
  submissions: JotformSubmission[],
  mapping: FormLegacyFieldMapping[],
  version: FormVersion,
  alreadyImported: Set<string>
) {
  const fields = new Map(answerFields(version).map(field => [field.id, field]));
  return submissions.map(submission => {
    const mappedAnswers: Record<string, unknown> = {};
    mapping.forEach(item => {
      const field = fields.get(item.targetFieldId);
      if (!field) return;
      const value = sourceAnswer(submission, item.sourceQuestionId);
      if (value !== undefined) {
        mappedAnswers[item.targetFieldId] = coerceAnswer(field, value);
      }
    });
    const normalized = normalizeAndValidateFormAnswers(
      version.content,
      mappedAnswers
    );
    const payloadHash = hashValue(submission);
    const sourceSubmissionId = clean(submission.id, 128);
    return {
      sourceSubmissionId:
        sourceSubmissionId || `missing:${payloadHash.slice(0, 24)}`,
      sourceCreatedAt: clean(submission.created_at, 80) || undefined,
      payloadHash,
      valid: normalized.ok && Boolean(sourceSubmissionId),
      alreadyImported: alreadyImported.has(submission.id),
      errors: Object.entries(normalized.errors).flatMap(([fieldId, messages]) =>
        messages.map(message => `${fieldId}: ${message}`)
      ),
      mappedAnswers: normalized.answers,
    } satisfies JotformMigrationPreviewRow;
  });
}

function appendAudit(
  state: NileFormsState,
  event: Omit<FormAuditEvent, "id" | "createdAt">,
  id: string,
  createdAt: string
) {
  state.auditEvents.unshift({ id, createdAt, ...event });
}

function recordsForRun(state: NileFormsState, runId: string) {
  return state.legacyImportRecords
    .filter(record => record.runId === runId)
    .sort((left, right) =>
      left.sourceSubmissionId.localeCompare(right.sourceSubmissionId)
    );
}

function asNileFormsError(error: unknown) {
  if (error instanceof NileFormsError) return error;
  if (error instanceof JotformApiError) {
    return new NileFormsError(
      error.message,
      error.statusCode,
      error.code === "configuration"
        ? "jotform_not_configured"
        : "jotform_remote_error"
    );
  }
  return new NileFormsError(
    error instanceof Error ? error.message : "Jotform migration failed.",
    502,
    "jotform_remote_error"
  );
}

export function createNileFormsMigrationService(
  dependencies: MigrationDependencies = {}
) {
  const repository =
    dependencies.repository ?? getNileFormsCompatibilityRepository();
  const getClient =
    dependencies.getClient ?? (() => createJotformClientFromEnvironment());
  const nowDate = dependencies.now ?? (() => new Date());
  const createId =
    dependencies.randomId ??
    ((prefix: string) =>
      `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`);

  const prepare = async (input: {
    sourceFormId?: unknown;
    targetPublicationId?: unknown;
    mapping?: unknown;
    offset?: unknown;
    limit?: unknown;
  }): Promise<PreparedMigration> => {
    const sourceFormId = clean(input.sourceFormId, 40);
    const offset = Math.max(0, Math.trunc(Number(input.offset) || 0));
    const limit = Math.min(
      1_000,
      Math.max(1, Math.trunc(Number(input.limit) || 500))
    );
    const state = await repository.read();
    const target = requireTarget(state, input.targetPublicationId);
    const client = getClient();
    try {
      const [form, questions, submissionResult] = await Promise.all([
        client.getForm(sourceFormId),
        client.getQuestions(sourceFormId),
        client.getSubmissions(sourceFormId, offset, limit),
      ]);
      const mapping = parseMapping(
        input.mapping,
        questions,
        target.version as FormVersion
      );
      const alreadyImported = new Set(
        state.legacyImportRecords
          .filter(
            record =>
              record.provider === "jotform" &&
              record.sourceFormId === sourceFormId &&
              Boolean(record.submissionId)
          )
          .map(record => record.sourceSubmissionId)
      );
      const rows = prepareRows(
        submissionResult.submissions,
        mapping,
        target.version as FormVersion,
        alreadyImported
      );
      const previewHash = hashValue({
        provider: "jotform",
        sourceFormId,
        targetPublicationId: target.publication.id,
        targetVersionId: target.version.id,
        targetContentHash: target.version.contentHash,
        mapping,
        rows: rows.map(row => ({
          sourceSubmissionId: row.sourceSubmissionId,
          payloadHash: row.payloadHash,
          mappedAnswers: row.mappedAnswers,
          valid: row.valid,
        })),
      });
      return {
        sourceFormTitle: clean(form.title, 240) || `Jotform ${sourceFormId}`,
        target,
        mapping,
        questions,
        rows,
        previewHash,
        sourceOffset: offset,
        sourceLimit: limit,
      };
    } catch (error) {
      throw asNileFormsError(error);
    }
  };

  return {
    async getStatus(sessionInput: ServerSession | null | undefined) {
      requireMigrationAdmin(sessionInput);
      const state = await repository.read();
      const targets = state.publications.flatMap(publication => {
        try {
          return [publicTarget(requireTarget(state, publication.id))];
        } catch {
          return [];
        }
      });
      return {
        configured: Boolean(process.env.JOTFORM_API_KEY?.trim()),
        region: configuredJotformRegion(),
        targets,
      };
    },

    async listRemoteForms(sessionInput: ServerSession | null | undefined) {
      requireMigrationAdmin(sessionInput);
      try {
        return await getClient().listForms(0, 1_000);
      } catch (error) {
        throw asNileFormsError(error);
      }
    },

    async inspect(
      sessionInput: ServerSession | null | undefined,
      input: { sourceFormId?: unknown; targetPublicationId?: unknown }
    ) {
      requireMigrationAdmin(sessionInput);
      const sourceFormId = clean(input.sourceFormId, 40);
      const state = await repository.read();
      const target = requireTarget(state, input.targetPublicationId);
      try {
        const [form, questions] = await Promise.all([
          getClient().getForm(sourceFormId),
          getClient().getQuestions(sourceFormId),
        ]);
        return {
          sourceForm: form,
          questions,
          target: publicTarget(target),
          targetFields: answerFields(target.version as FormVersion).map(
            field => ({
              id: field.id,
              type: field.type,
              label: field.label,
              required: Boolean(field.required),
              restricted: Boolean(
                field.dataClass && field.dataClass !== "standard"
              ),
            })
          ),
        };
      } catch (error) {
        throw asNileFormsError(error);
      }
    },

    async preview(
      sessionInput: ServerSession | null | undefined,
      input: Record<string, unknown>
    ) {
      const session = requireMigrationAdmin(sessionInput);
      const prepared = await prepare(input);
      const now = nowDate().toISOString();
      const run = await repository.transaction(state => {
        const row: FormLegacyImportRun = {
          id: createId("form_import_run"),
          provider: "jotform",
          sourceFormId: clean(input.sourceFormId, 40),
          sourceFormTitle: prepared.sourceFormTitle,
          targetPublicationId: prepared.target.publication.id,
          targetVersionId: prepared.target.version.id,
          mapping: prepared.mapping,
          sourceOffset: prepared.sourceOffset,
          sourceLimit: prepared.sourceLimit,
          previewHash: prepared.previewHash,
          status: "previewed",
          totalRows: prepared.rows.length,
          validRows: prepared.rows.filter(row => row.valid).length,
          importedRows: 0,
          duplicateRows: prepared.rows.filter(row => row.alreadyImported)
            .length,
          exceptionRows: prepared.rows.filter(row => !row.valid).length,
          createdBy: session.userId,
          createdAt: now,
        };
        state.legacyImportRuns.unshift(row);
        appendAudit(
          state,
          {
            actorUserId: session.userId,
            actorRole: session.activeRole,
            action: "form.legacy_import_previewed",
            entityType: "FormLegacyImportRun",
            entityId: row.id,
            metadata: {
              provider: "jotform",
              sourceFormId: row.sourceFormId,
              targetPublicationId: row.targetPublicationId,
              totalRows: row.totalRows,
              validRows: row.validRows,
              previewHash: row.previewHash,
            },
          },
          createId("form_audit"),
          now
        );
        return row;
      });
      return {
        run,
        questions: prepared.questions,
        targetFields: answerFields(prepared.target.version as FormVersion),
        sample: prepared.rows.slice(0, 20),
      };
    },

    async commit(
      sessionInput: ServerSession | null | undefined,
      input: { runId?: unknown; previewHash?: unknown }
    ): Promise<JotformMigrationRunBundle> {
      const session = requireMigrationAdmin(sessionInput);
      const runId = clean(input.runId, 128);
      const suppliedHash = clean(input.previewHash, 128);
      const initialState = await repository.read();
      const initialRun = initialState.legacyImportRuns.find(
        item => item.id === runId
      );
      if (!initialRun) {
        throw new NileFormsError(
          "Migration preview not found.",
          404,
          "migration_run_not_found"
        );
      }
      if (initialRun.previewHash !== suppliedHash) {
        throw new NileFormsError(
          "Migration preview confirmation does not match.",
          409,
          "migration_preview_mismatch"
        );
      }
      if (initialRun.status !== "previewed") {
        return {
          run: initialRun,
          records: recordsForRun(initialState, initialRun.id),
        };
      }
      const prepared = await prepare({
        sourceFormId: initialRun.sourceFormId,
        targetPublicationId: initialRun.targetPublicationId,
        mapping: initialRun.mapping,
        offset: initialRun.sourceOffset,
        limit: initialRun.sourceLimit,
      });
      if (prepared.previewHash !== initialRun.previewHash) {
        throw new NileFormsError(
          "Jotform data or the target version changed after preview. Run a new dry run.",
          409,
          "migration_source_changed"
        );
      }
      const now = nowDate().toISOString();
      return repository.transaction(state => {
        const run = state.legacyImportRuns.find(item => item.id === runId);
        if (!run) {
          throw new NileFormsError(
            "Migration preview not found.",
            404,
            "migration_run_not_found"
          );
        }
        if (run.status !== "previewed") {
          return {
            run,
            records: recordsForRun(state, run.id),
          };
        }
        const target = requireTarget(state, run.targetPublicationId);
        if (target.version.id !== run.targetVersionId) {
          throw new NileFormsError(
            "The target publication version changed after preview.",
            409,
            "migration_target_changed"
          );
        }
        let importedRows = 0;
        let duplicateRows = 0;
        let exceptionRows = 0;
        const records: FormLegacyImportRecord[] = [];
        for (const row of prepared.rows) {
          const existing = state.legacyImportRecords.find(
            record =>
              record.provider === "jotform" &&
              record.sourceFormId === run.sourceFormId &&
              record.sourceSubmissionId === row.sourceSubmissionId &&
              Boolean(record.submissionId)
          );
          if (existing) {
            duplicateRows += 1;
            continue;
          }
          if (!row.valid) {
            const record: FormLegacyImportRecord = {
              id: createId("form_import_record"),
              runId: run.id,
              provider: "jotform",
              sourceFormId: run.sourceFormId,
              sourceSubmissionId: row.sourceSubmissionId,
              payloadHash: row.payloadHash,
              reconciliationStatus: "exception",
              errors: row.errors.length
                ? row.errors
                : ["Source submission ID is missing."],
              createdAt: now,
            };
            state.legacyImportRecords.unshift(record);
            records.push(record);
            exceptionRows += 1;
            continue;
          }
          const submission: FormSubmission = {
            id: createId("form_submission"),
            definitionId: target.definition.id,
            publicationId: target.publication.id,
            versionId: target.version.id,
            source: "legacy_import",
            answers: row.mappedAnswers,
            status: "submitted",
            revision: 1,
            clientSubmissionId: `jotform:${run.sourceFormId}:${row.sourceSubmissionId}`,
            clientSubmittedAt: row.sourceCreatedAt,
            submittedAt: now,
            updatedAt: now,
            legacySource: {
              formId: run.sourceFormId,
              submissionId: row.sourceSubmissionId,
              payloadHash: row.payloadHash,
              importRunId: run.id,
              reconciliationStatus: "pending",
            },
          };
          const record: FormLegacyImportRecord = {
            id: createId("form_import_record"),
            runId: run.id,
            provider: "jotform",
            sourceFormId: run.sourceFormId,
            sourceSubmissionId: row.sourceSubmissionId,
            payloadHash: row.payloadHash,
            submissionId: submission.id,
            reconciliationStatus: "pending",
            errors: [],
            createdAt: now,
          };
          state.submissions.unshift(submission);
          state.legacyImportRecords.unshift(record);
          records.push(record);
          importedRows += 1;
        }
        run.status = "imported";
        run.importedRows = importedRows;
        run.duplicateRows = duplicateRows;
        run.exceptionRows = exceptionRows;
        run.completedAt = now;
        appendAudit(
          state,
          {
            actorUserId: session.userId,
            actorRole: session.activeRole,
            action: "form.legacy_import_committed",
            entityType: "FormLegacyImportRun",
            entityId: run.id,
            metadata: {
              provider: "jotform",
              sourceFormId: run.sourceFormId,
              targetPublicationId: run.targetPublicationId,
              importedRows,
              duplicateRows,
              exceptionRows,
              automaticPromotion: false,
            },
          },
          createId("form_audit"),
          now
        );
        return {
          run,
          records: records.sort((left, right) =>
            left.sourceSubmissionId.localeCompare(right.sourceSubmissionId)
          ),
        };
      });
    },

    async listRuns(
      sessionInput: ServerSession | null | undefined
    ): Promise<JotformMigrationRunBundle[]> {
      requireMigrationAdmin(sessionInput);
      const state = await repository.read();
      return state.legacyImportRuns.map(run => ({
        run,
        records: recordsForRun(state, run.id),
      }));
    },

    async reconcile(
      sessionInput: ServerSession | null | undefined,
      recordIdInput: unknown,
      input: { status?: unknown; notes?: unknown }
    ) {
      const session = requireMigrationAdmin(sessionInput);
      const recordId = clean(recordIdInput, 128);
      const status = clean(input.status, 40);
      if (status !== "matched" && status !== "exception") {
        throw new NileFormsError(
          "Reconciliation status must be matched or exception.",
          400,
          "reconciliation_status_invalid"
        );
      }
      const notes = clean(input.notes, 1_000) || undefined;
      const now = nowDate().toISOString();
      return repository.transaction(state => {
        const record = state.legacyImportRecords.find(
          item => item.id === recordId
        );
        if (!record) {
          throw new NileFormsError(
            "Migration record not found.",
            404,
            "migration_record_not_found"
          );
        }
        if (status === "matched" && !record.submissionId) {
          throw new NileFormsError(
            "A validation exception cannot be marked as an imported match.",
            409,
            "reconciliation_match_unavailable"
          );
        }
        record.reconciliationStatus = status;
        record.notes = notes;
        record.reconciledBy = session.userId;
        record.reconciledAt = now;
        const run = state.legacyImportRuns.find(
          item => item.id === record.runId
        );
        if (run) {
          const runRecords = state.legacyImportRecords.filter(
            item => item.runId === run.id
          );
          if (
            run.status === "imported" &&
            runRecords.length > 0 &&
            runRecords.every(item => item.reconciliationStatus !== "pending")
          ) {
            run.status = "reconciled";
          }
        }
        appendAudit(
          state,
          {
            actorUserId: session.userId,
            actorRole: session.activeRole,
            action: "form.legacy_import_reconciled",
            entityType: "FormLegacyImportRecord",
            entityId: record.id,
            metadata: {
              runId: record.runId,
              sourceFormId: record.sourceFormId,
              sourceSubmissionId: record.sourceSubmissionId,
              status,
            },
          },
          createId("form_audit"),
          now
        );
        return { record, run };
      });
    },
  };
}

export type NileFormsMigrationService = ReturnType<
  typeof createNileFormsMigrationService
>;
