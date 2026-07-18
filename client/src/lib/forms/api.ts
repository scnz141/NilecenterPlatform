import type {
  FormAssignment,
  FormAssignmentTarget,
  FormDefinition,
  FormField,
  FormLocale,
  FormLegacyFieldMapping,
  FormManagementOptions,
  FormOfflineDevice,
  FormPromotion,
  FormPublication,
  FormReview,
  FormSyncReceipt,
  FormSubmission,
  FormVersion,
  FormVersionContent,
} from "@shared/nileForms";
import type { NileFormsTemplateKey } from "@shared/nileFormsTemplateCatalog";
import type {
  JotformForm,
  JotformQuestion,
} from "../../../../server/jotformClient";
import type {
  FormDefinitionBundle,
  FormOfflineBundle,
  FormOfflineSyncItem,
  FormOfflineSyncResult,
  FormResponderSubmissionDetail,
  FormResponderBundle,
} from "../../../../server/nileFormsService";
import type {
  JotformMigrationPreviewRow,
  JotformMigrationRunBundle,
  JotformMigrationTarget,
} from "../../../../server/nileFormsMigrationService";

export class NileFormsApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(
    message: string,
    status: number,
    code: string,
    details?: unknown
  ) {
    super(message);
    this.name = "NileFormsApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export type NileFormsApiResult<T> = {
  ok: boolean;
  data?: T;
  error?: string;
  code?: string;
  status?: number;
  details?: unknown;
  apiError?: NileFormsApiError;
};

async function formsJson<T>(
  path: string,
  init: RequestInit = {},
  draftToken?: string
): Promise<NileFormsApiResult<T>> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (init.method && !["GET", "HEAD"].includes(init.method.toUpperCase())) {
    headers.set("X-Nile-Learn-Request", "browser");
  }
  if (draftToken) headers.set("X-Nile-Forms-Draft-Token", draftToken);

  try {
    const response = await fetch(path, {
      ...init,
      credentials: "include",
      headers,
    });
    const payload = (await response.json().catch(() => null)) as
      | T
      | { error?: string; code?: string; details?: unknown }
      | null;
    if (!response.ok) {
      const errorPayload =
        payload && typeof payload === "object" ? payload : undefined;
      const message =
        errorPayload && "error" in errorPayload && errorPayload.error
          ? errorPayload.error
          : `Request failed with ${response.status}`;
      const code =
        errorPayload && "code" in errorPayload && errorPayload.code
          ? errorPayload.code
          : "http_error";
      const details =
        errorPayload && "details" in errorPayload
          ? errorPayload.details
          : undefined;
      return {
        ok: false,
        error: message,
        code,
        status: response.status,
        details,
        apiError: new NileFormsApiError(
          message,
          response.status,
          code,
          details
        ),
      };
    }
    return { ok: true, data: payload as T };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Network request failed";
    return {
      ok: false,
      error: message,
      code: "network_error",
      status: 0,
      apiError: new NileFormsApiError(message, 0, "network_error"),
    };
  }
}

export function fetchFormDefinitions() {
  return formsJson<FormDefinition[]>("/api/forms/definitions");
}

export function fetchFormManagementOptions() {
  return formsJson<FormManagementOptions>("/api/forms/management-options");
}

export function fetchFormDefinition(formId: string) {
  return formsJson<FormDefinitionBundle>(
    `/api/forms/definitions/${encodeURIComponent(formId)}`
  );
}

export function createFormDefinitionRequest(input: {
  key: string;
  titleEn: string;
  titleAr: string;
  titleTr: string;
  templateKey?: NileFormsTemplateKey;
  category: FormDefinition["category"];
  branchId?: string;
  departmentId?: string;
}) {
  return formsJson<{ definition: FormDefinition; version: FormVersion }>(
    "/api/forms/definitions",
    { method: "POST", body: JSON.stringify(input) }
  );
}

export function createFormDraftVersionRequest(formId: string) {
  return formsJson<FormVersion>(
    `/api/forms/definitions/${encodeURIComponent(formId)}/draft`,
    { method: "POST", body: "{}" }
  );
}

export function updateFormDraftVersionRequest(
  formId: string,
  versionId: string,
  input: { expectedRevision: number; content: FormVersionContent }
) {
  return formsJson<FormVersion>(
    `/api/forms/definitions/${encodeURIComponent(formId)}/versions/${encodeURIComponent(versionId)}`,
    { method: "POST", body: JSON.stringify(input) }
  );
}

export function publishFormVersionRequest(
  formId: string,
  versionId: string,
  input: {
    slug: string;
    audience: FormPublication["audience"];
    opensAt?: string;
    closesAt?: string;
    allowMultiple: boolean;
    allowDrafts: boolean;
  }
) {
  return formsJson<{
    definition: FormDefinition;
    version: FormVersion;
    publication: FormPublication;
  }>(
    `/api/forms/definitions/${encodeURIComponent(formId)}/versions/${encodeURIComponent(versionId)}/publish`,
    { method: "POST", body: JSON.stringify(input) }
  );
}

export function retireFormPublicationRequest(publicationId: string) {
  return formsJson<FormPublication>(
    `/api/forms/publications/${encodeURIComponent(publicationId)}/retire`,
    { method: "POST", body: "{}" }
  );
}

export function assignFormPublicationRequest(
  publicationId: string,
  target: FormAssignmentTarget,
  expiresAt?: string
) {
  return formsJson<FormAssignment>(
    `/api/forms/publications/${encodeURIComponent(publicationId)}/assignments`,
    { method: "POST", body: JSON.stringify({ target, expiresAt }) }
  );
}

export function revokeFormAssignmentRequest(assignmentId: string) {
  return formsJson<FormAssignment>(
    `/api/forms/assignments/${encodeURIComponent(assignmentId)}/revoke`,
    { method: "POST", body: "{}" }
  );
}

export function fetchAssignedForms() {
  return formsJson<FormResponderBundle[]>("/api/forms/assigned");
}

export function fetchAssignedForm(publicationId: string) {
  return formsJson<FormResponderBundle>(
    `/api/forms/assigned/${encodeURIComponent(publicationId)}`
  );
}

export type FormOfflineEnrollment = {
  device: Pick<FormOfflineDevice, "id" | "label" | "enrolledAt" | "expiresAt">;
  deviceToken: string;
};

export function enrollFormOfflineDeviceRequest(label: string) {
  return formsJson<FormOfflineEnrollment>("/api/forms/offline/devices", {
    method: "POST",
    body: JSON.stringify({ label }),
  });
}

export function revokeFormOfflineDeviceRequest(deviceId: string) {
  return formsJson<{ id: string; revokedAt: string }>(
    `/api/forms/offline/devices/${encodeURIComponent(deviceId)}/revoke`,
    { method: "POST", body: "{}" }
  );
}

export function fetchFormOfflineBundleRequest(
  deviceId: string,
  deviceToken: string
) {
  return formsJson<FormOfflineBundle>("/api/forms/offline/bundle", {
    method: "POST",
    body: JSON.stringify({ deviceId, deviceToken }),
  });
}

export function syncFormOfflineBatchRequest(
  deviceId: string,
  deviceToken: string,
  items: FormOfflineSyncItem[]
) {
  return formsJson<FormOfflineSyncResult>("/api/forms/offline/sync", {
    method: "POST",
    body: JSON.stringify({ deviceId, deviceToken, items }),
  });
}

export type FormOfflineReceipt = FormSyncReceipt;

export type JotformMigrationStatus = {
  configured: boolean;
  region: "standard" | "eu" | "hipaa";
  targets: JotformMigrationTarget[];
};

export function fetchJotformMigrationStatus() {
  return formsJson<JotformMigrationStatus>(
    "/api/forms/migration/jotform/status"
  );
}

export function fetchJotformRemoteForms() {
  return formsJson<{
    forms: JotformForm[];
    resultSet?: { offset: number; limit: number; count: number };
  }>("/api/forms/migration/jotform/forms");
}

export type JotformMigrationInspection = {
  sourceForm: JotformForm;
  questions: JotformQuestion[];
  target: JotformMigrationTarget;
  targetFields: Array<{
    id: string;
    type: string;
    label: { en: string; ar: string };
    required: boolean;
    restricted: boolean;
  }>;
};

export function inspectJotformMigrationRequest(
  sourceFormId: string,
  targetPublicationId: string
) {
  return formsJson<JotformMigrationInspection>(
    "/api/forms/migration/jotform/inspect",
    {
      method: "POST",
      body: JSON.stringify({ sourceFormId, targetPublicationId }),
    }
  );
}

export type JotformMigrationPreview = {
  run: JotformMigrationRunBundle["run"];
  questions: JotformQuestion[];
  targetFields: FormField[];
  sample: JotformMigrationPreviewRow[];
};

export function previewJotformMigrationRequest(input: {
  sourceFormId: string;
  targetPublicationId: string;
  mapping: FormLegacyFieldMapping[];
  offset?: number;
  limit?: number;
}) {
  return formsJson<JotformMigrationPreview>(
    "/api/forms/migration/jotform/preview",
    { method: "POST", body: JSON.stringify(input) }
  );
}

export function commitJotformMigrationRequest(
  runId: string,
  previewHash: string
) {
  return formsJson<JotformMigrationRunBundle>(
    "/api/forms/migration/jotform/import",
    { method: "POST", body: JSON.stringify({ runId, previewHash }) }
  );
}

export function fetchJotformMigrationRuns() {
  return formsJson<JotformMigrationRunBundle[]>(
    "/api/forms/migration/jotform/runs"
  );
}

export function reconcileJotformMigrationRecordRequest(
  recordId: string,
  status: "matched" | "exception",
  notes?: string
) {
  return formsJson<{
    record: JotformMigrationRunBundle["records"][number];
    run?: JotformMigrationRunBundle["run"];
  }>(
    `/api/forms/migration/jotform/records/${encodeURIComponent(recordId)}/reconcile`,
    { method: "POST", body: JSON.stringify({ status, notes }) }
  );
}

export function fetchOwnFormSubmission(
  publicationId: string,
  submissionId: string
) {
  return formsJson<FormResponderSubmissionDetail>(
    `/api/forms/assigned/${encodeURIComponent(publicationId)}/submissions/${encodeURIComponent(submissionId)}`
  );
}

export function fetchPublicForm(slug: string) {
  return formsJson<FormResponderBundle>(
    `/api/forms/public/${encodeURIComponent(slug)}`
  );
}

export type FormDraftResponse = {
  draftId: string;
  revision: number;
  expiresAt: string;
  draftToken?: string;
  answers: Record<string, unknown>;
  validationErrors?: Record<string, string[]>;
};

export function saveAssignedFormDraftRequest(
  publicationId: string,
  input: {
    answers: Record<string, unknown>;
    expectedRevision?: number;
    locale?: FormLocale;
  }
) {
  return formsJson<FormDraftResponse>(
    `/api/forms/assigned/${encodeURIComponent(publicationId)}/draft`,
    { method: "POST", body: JSON.stringify(input) }
  );
}

export function loadAssignedFormDraftRequest(publicationId: string) {
  return formsJson<FormDraftResponse>(
    `/api/forms/assigned/${encodeURIComponent(publicationId)}/draft`
  );
}

export function savePublicFormDraftRequest(
  slug: string,
  input: {
    answers: Record<string, unknown>;
    expectedRevision?: number;
    locale?: FormLocale;
  },
  draftToken?: string
) {
  return formsJson<FormDraftResponse>(
    `/api/forms/public/${encodeURIComponent(slug)}/draft`,
    { method: "POST", body: JSON.stringify(input) },
    draftToken
  );
}

export function loadPublicFormDraftRequest(slug: string, draftToken: string) {
  return formsJson<FormDraftResponse>(
    `/api/forms/public/${encodeURIComponent(slug)}/draft/load`,
    { method: "POST", body: "{}" },
    draftToken
  );
}

export type FormSubmissionResponse = {
  submission: FormSubmission;
  replayed: boolean;
};

export function submitAssignedFormRequest(
  publicationId: string,
  input: {
    answers: Record<string, unknown>;
    clientSubmissionId: string;
    clientSubmittedAt: string;
    locale?: FormLocale;
  }
) {
  return formsJson<FormSubmissionResponse>(
    `/api/forms/assigned/${encodeURIComponent(publicationId)}/submit`,
    { method: "POST", body: JSON.stringify(input) }
  );
}

export function submitPublicFormRequest(
  slug: string,
  input: {
    answers: Record<string, unknown>;
    clientSubmissionId: string;
    clientSubmittedAt: string;
    locale?: FormLocale;
  },
  draftToken?: string
) {
  return formsJson<FormSubmissionResponse>(
    `/api/forms/public/${encodeURIComponent(slug)}/submit`,
    { method: "POST", body: JSON.stringify(input) },
    draftToken
  );
}

export function withdrawFormSubmissionRequest(
  submissionId: string,
  expectedRevision: number
) {
  return formsJson<FormSubmission>(
    `/api/forms/submissions/${encodeURIComponent(submissionId)}/withdraw`,
    {
      method: "POST",
      body: JSON.stringify({ expectedRevision }),
    }
  );
}

export type FormSubmissionListItem = {
  submission: FormSubmission;
  definition: FormDefinition;
  publication: FormPublication;
};

export function fetchFormSubmissions() {
  return formsJson<FormSubmissionListItem[]>("/api/forms/submissions");
}

export type FormSubmissionDetail = FormSubmissionListItem & {
  version: FormVersion;
  reviews: FormReview[];
  promotions: FormPromotion[];
  auditEvents: Array<{
    id: string;
    action: string;
    actorUserId: string;
    createdAt: string;
    metadata: Record<string, unknown>;
  }>;
};

export function fetchFormSubmission(submissionId: string) {
  return formsJson<FormSubmissionDetail>(
    `/api/forms/submissions/${encodeURIComponent(submissionId)}`
  );
}

export function reviewFormSubmissionRequest(
  submissionId: string,
  input: {
    decision: FormReview["decision"];
    expectedRevision: number;
    comments?: string;
  }
) {
  return formsJson<{ submission: FormSubmission; review: FormReview }>(
    `/api/forms/submissions/${encodeURIComponent(submissionId)}/review`,
    { method: "POST", body: JSON.stringify(input) }
  );
}

export function promoteFormSubmissionRequest(
  submissionId: string,
  input: { expectedRevision: number; idempotencyKey: string }
) {
  return formsJson<FormPromotion>(
    `/api/forms/submissions/${encodeURIComponent(submissionId)}/promote`,
    { method: "POST", body: JSON.stringify(input) }
  );
}

export function exportFormSubmissionsRequest() {
  return formsJson<{
    exportId: string;
    filename: string;
    csv: string;
    rowCount: number;
  }>("/api/forms/submissions/export");
}
