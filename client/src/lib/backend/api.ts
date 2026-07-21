import type { Role } from "@/lib/platformData";
import type {
  PlatformLearningAction,
  PlatformLearningActionResult,
  PlatformWorkflowAction,
  PlatformWorkflowActionResult,
} from "@/lib/domain/actions";
import type {
  CertificateVerificationResult,
  PlatformState,
} from "@/lib/domain/types";

export type AuthSessionDto = {
  userId: string;
  email: string;
  name: string;
  roles: Role[];
  activeRole: Role;
  provider: "supabase" | "demo";
  expiresAt: string;
};

type ApiResult<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

async function apiJson<T>(
  path: string,
  init: RequestInit = {}
): Promise<ApiResult<T>> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  if (init.method && init.method.toUpperCase() !== "GET")
    headers.set("X-Nile-Learn-Request", "browser");

  try {
    const response = await fetch(path, {
      ...init,
      credentials: "include",
      headers,
    });
    const data = (await response.json().catch(() => null)) as
      | T
      | { error?: string }
      | null;
    const errorMessage =
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : `Request failed with ${response.status}`;
    if (!response.ok) {
      return { ok: false, error: errorMessage };
    }
    return { ok: true, data: data as T };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Network request failed",
    };
  }
}

export function signInRequest(input: {
  email: string;
  password: string;
  role: Role;
}) {
  return apiJson<AuthSessionDto>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function requestPasswordReset(input: { email: string; role?: Role }) {
  return apiJson<{ ok: true; demoResetPath?: string; expiresAt?: string }>(
    "/api/auth/password-reset/request",
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}

export function confirmPasswordReset(input: {
  token: string;
  email: string;
  password: string;
}) {
  return apiJson<{ ok: true; role?: Role }>(
    "/api/auth/password-reset/confirm",
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}

export function changePasswordRequest(input: {
  currentPassword: string;
  newPassword: string;
}) {
  return apiJson<{
    ok: true;
    role?: Role;
    state?: PlatformState;
    persistence?: "supabase" | "local";
    syncedAt?: string;
  }>("/api/auth/password-change", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function fetchSessionRequest() {
  return apiJson<AuthSessionDto | null>("/api/auth/session");
}

export function logoutRequest() {
  return apiJson<{ ok: true }>("/api/auth/logout", { method: "POST" });
}

export type UserInvitationRole = Role;

export function createUserInvitationRequest(input: {
  fullName: string;
  email: string;
  phone?: string;
  role: UserInvitationRole;
  branchRef?: string;
  departmentRef?: string;
  title?: string;
  availabilityStatus?: string;
  subjects: string[];
  teachingLevels: string[];
  locale: string;
  idempotencyKey: string;
}) {
  return apiJson<{
    ok: true;
    delivery: "queued" | "dispatched";
    invitation: {
      invitationId: string;
      userId: string;
      roleGrantId: string;
      outboxEventId: string;
      replayed: boolean;
    };
  }>("/api/admin/user-invitations", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function acceptUserInvitationRequest(input: {
  invitationId: string;
  email?: string;
  otp?: string;
  accessToken?: string;
  password: string;
}) {
  return apiJson<{
    ok: true;
    account: {
      userId: string;
      role: Role;
      email: string;
      acceptedAt: string;
    };
  }>("/api/auth/invitations/accept", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function saveBackendRecord(
  type: "lead" | "placement" | "operational",
  payload: Record<string, unknown>,
  actorId?: string
) {
  return apiJson<{ id: string; type: string; createdAt: string }>(
    "/api/platform/records",
    {
      method: "POST",
      body: JSON.stringify({ type, payload, actorId }),
    }
  );
}

export type PlatformStateDto = {
  state: PlatformState;
  persistence: "supabase" | "local";
  syncedAt: string;
};

export type PlatformActionDto = PlatformStateDto & {
  result: PlatformLearningActionResult;
};

export type PlatformWorkflowActionDto = PlatformStateDto & {
  result: PlatformWorkflowActionResult;
};

export type PublicCertificateVerificationDto =
  | {
      valid: true;
      certificate: CertificateVerificationResult;
    }
  | {
      valid: false;
      error?: string;
    };

export type MoodleProjectionAvailability =
  | "available"
  | "empty"
  | "unavailable";

export type MoodleProjectionFreshness = "fresh" | "stale" | "unavailable";

export type MoodleProjectionOutcome =
  | "available"
  | "empty"
  | "missing_mapping"
  | "missing_provider_record"
  | "ambiguous_mapping"
  | "reconciliation"
  | "unavailable"
  | "invalid_payload";

export type MoodleCourseProjectionDto = {
  internalCourseId?: string;
  mappingState:
    | "discovered"
    | "matched"
    | "synced"
    | "stale"
    | "error"
    | "unmatched"
    | "missing";
  reconciliationReason?:
    | "missing_mapping"
    | "missing_provider_record"
    | "ambiguous_mapping";
  course?: {
    sourceId: string;
    categorySourceId?: string;
    title: string;
    shortTitle: string;
    visible?: boolean;
    startsAt?: string;
    endsAt?: string;
    completionTrackingEnabled?: boolean;
  };
};

export type MoodleCourseCatalogProjectionDto = {
  mode: "read_only";
  authority: "server_course_relationships";
  authorityObservedAt: string;
  availability: MoodleProjectionAvailability;
  freshness: MoodleProjectionFreshness;
  observations: Array<{
    internalCourseId: string;
    availability: MoodleProjectionAvailability;
    freshness: MoodleProjectionFreshness;
    latestOutcome: string;
    lastAttemptedAt?: string;
    reconciliationReason?: string;
    observation?: {
      observedAt: string;
      freshUntil: string;
      retainUntil: string;
    };
  }>;
  rows: MoodleCourseProjectionDto[];
};

export type MoodleCourseContentProjectionDto = {
  mode: "read_only";
  authority: "server_course_relationships";
  authorityObservedAt: string;
  availability: MoodleProjectionAvailability;
  freshness: MoodleProjectionFreshness;
  latestOutcome: MoodleProjectionOutcome;
  lastAttemptedAt?: string;
  reconciliationReason?: string;
  observation: {
    runId: string;
    observedAt: string;
    freshUntil: string;
    retainUntil: string;
    payloadHash: string;
  };
  projection: {
    internalCourseId: string;
    externalCourseId: string;
    mappingState: MoodleCourseProjectionDto["mappingState"];
    sections: Array<{
      sourceId: string;
      position: number;
      title?: string;
      visible?: boolean;
      activities: Array<{
        sourceId: string;
        instanceSourceId: string;
        type: string;
        title: string;
        visible?: boolean;
        completionTracking?: "none" | "manual" | "automatic";
      }>;
    }>;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isOptionalString(value: unknown) {
  return value === undefined || typeof value === "string";
}

const moodleAvailability = new Set<MoodleProjectionAvailability>([
  "available",
  "empty",
  "unavailable",
]);
const moodleFreshness = new Set<MoodleProjectionFreshness>([
  "fresh",
  "stale",
  "unavailable",
]);
const moodleMappingStates = new Set<MoodleCourseProjectionDto["mappingState"]>([
  "discovered",
  "matched",
  "synced",
  "stale",
  "error",
  "unmatched",
  "missing",
]);
const moodleReconciliationReasons = new Set<
  NonNullable<MoodleCourseProjectionDto["reconciliationReason"]>
>(["missing_mapping", "missing_provider_record", "ambiguous_mapping"]);
const moodleProjectionOutcomes = new Set<MoodleProjectionOutcome>([
  "available",
  "empty",
  "missing_mapping",
  "missing_provider_record",
  "ambiguous_mapping",
  "reconciliation",
  "unavailable",
  "invalid_payload",
]);
const moodleCompletionTracking = new Set(["none", "manual", "automatic"]);
const moodleContentCollectionLimit = 2_000;

function hasExactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = []
) {
  const keys = Object.keys(value);
  const allowed = new Set([...required, ...optional]);
  return (
    required.every(key => Object.hasOwn(value, key)) &&
    keys.every(key => allowed.has(key))
  );
}

function isProjectionText(value: unknown, maximum = 300) {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maximum &&
    !/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value) &&
    !/\b(?:(?:https?|ftp):\/\/|www\.|mailto:)/i.test(value)
  );
}

function isMoodleSourceId(value: unknown) {
  return (
    typeof value === "string" &&
    /^[1-9]\d*$/.test(value) &&
    Number.isSafeInteger(Number(value))
  );
}

function isMoodleContentActivity(value: unknown) {
  if (!isRecord(value)) return false;
  if (
    !hasExactKeys(
      value,
      ["sourceId", "instanceSourceId", "type", "title"],
      ["visible", "completionTracking"]
    )
  ) {
    return false;
  }
  return (
    isMoodleSourceId(value.sourceId) &&
    isMoodleSourceId(value.instanceSourceId) &&
    isProjectionText(value.type, 64) &&
    isProjectionText(value.title) &&
    (value.visible === undefined || typeof value.visible === "boolean") &&
    (value.completionTracking === undefined ||
      (typeof value.completionTracking === "string" &&
        moodleCompletionTracking.has(value.completionTracking)))
  );
}

function isMoodleContentSection(value: unknown) {
  if (!isRecord(value)) return false;
  if (
    !hasExactKeys(
      value,
      ["sourceId", "position", "activities"],
      ["title", "visible"]
    )
  ) {
    return false;
  }
  return (
    isMoodleSourceId(value.sourceId) &&
    Number.isSafeInteger(value.position) &&
    (value.position as number) >= 0 &&
    (value.title === undefined || isProjectionText(value.title)) &&
    (value.visible === undefined || typeof value.visible === "boolean") &&
    Array.isArray(value.activities) &&
    value.activities.length <= moodleContentCollectionLimit &&
    value.activities.every(isMoodleContentActivity)
  );
}

function isMoodleContentObservation(value: unknown) {
  if (!isRecord(value)) return false;
  if (
    !hasExactKeys(value, [
      "runId",
      "observedAt",
      "freshUntil",
      "retainUntil",
      "payloadHash",
    ])
  ) {
    return false;
  }
  return (
    isProjectionText(value.runId, 128) &&
    isIsoTimestamp(value.observedAt) &&
    isIsoTimestamp(value.freshUntil) &&
    isIsoTimestamp(value.retainUntil) &&
    Date.parse(value.observedAt as string) <=
      Date.parse(value.freshUntil as string) &&
    Date.parse(value.freshUntil as string) <=
      Date.parse(value.retainUntil as string) &&
    typeof value.payloadHash === "string" &&
    /^[0-9a-f]{64}$/i.test(value.payloadHash)
  );
}

function isMoodleCourse(value: unknown) {
  if (!isRecord(value)) return false;
  return (
    typeof value.sourceId === "string" &&
    typeof value.title === "string" &&
    typeof value.shortTitle === "string" &&
    isOptionalString(value.categorySourceId) &&
    (value.visible === undefined || typeof value.visible === "boolean") &&
    (value.startsAt === undefined || isIsoTimestamp(value.startsAt)) &&
    (value.endsAt === undefined || isIsoTimestamp(value.endsAt)) &&
    (value.completionTrackingEnabled === undefined ||
      typeof value.completionTrackingEnabled === "boolean")
  );
}

function isMoodleCourseProjection(value: unknown) {
  if (!isRecord(value)) return false;
  const mappingState = value.mappingState;
  const reconciliationReason = value.reconciliationReason;
  return (
    typeof mappingState === "string" &&
    moodleMappingStates.has(
      mappingState as MoodleCourseProjectionDto["mappingState"]
    ) &&
    isOptionalString(value.internalCourseId) &&
    (reconciliationReason === undefined ||
      (typeof reconciliationReason === "string" &&
        moodleReconciliationReasons.has(
          reconciliationReason as NonNullable<
            MoodleCourseProjectionDto["reconciliationReason"]
          >
        ))) &&
    (value.course === undefined || isMoodleCourse(value.course))
  );
}

function isMoodleObservation(value: unknown) {
  if (!isRecord(value)) return false;
  const observation = value.observation;
  return (
    typeof value.internalCourseId === "string" &&
    typeof value.availability === "string" &&
    moodleAvailability.has(
      value.availability as MoodleProjectionAvailability
    ) &&
    typeof value.freshness === "string" &&
    moodleFreshness.has(value.freshness as MoodleProjectionFreshness) &&
    typeof value.latestOutcome === "string" &&
    isOptionalString(value.lastAttemptedAt) &&
    isOptionalString(value.reconciliationReason) &&
    (observation === undefined ||
      (isRecord(observation) &&
        isIsoTimestamp(observation.observedAt) &&
        isIsoTimestamp(observation.freshUntil) &&
        isIsoTimestamp(observation.retainUntil)))
  );
}

export function parseMoodleCourseCatalogProjectionDto(
  value: unknown
): MoodleCourseCatalogProjectionDto | null {
  if (!isRecord(value)) return null;
  const rows = value.rows;
  const observations = value.observations;
  if (
    value.mode !== "read_only" ||
    value.authority !== "server_course_relationships" ||
    !isIsoTimestamp(value.authorityObservedAt) ||
    typeof value.availability !== "string" ||
    !moodleAvailability.has(
      value.availability as MoodleProjectionAvailability
    ) ||
    typeof value.freshness !== "string" ||
    !moodleFreshness.has(value.freshness as MoodleProjectionFreshness) ||
    !Array.isArray(rows) ||
    rows.length > 2_000 ||
    !rows.every(isMoodleCourseProjection) ||
    !Array.isArray(observations) ||
    observations.length > 2_000 ||
    !observations.every(isMoodleObservation)
  ) {
    return null;
  }
  if (
    (value.availability === "empty" && rows.length !== 0) ||
    (value.availability === "available" && rows.length === 0) ||
    (value.freshness === "stale" && rows.length === 0)
  ) {
    return null;
  }
  return value as MoodleCourseCatalogProjectionDto;
}

export function parseMoodleCourseContentProjectionDto(
  value: unknown,
  requestedCourseId: string
): MoodleCourseContentProjectionDto | null {
  if (!isRecord(value) || !requestedCourseId) return null;
  if (
    !hasExactKeys(
      value,
      [
        "mode",
        "authority",
        "authorityObservedAt",
        "availability",
        "freshness",
        "latestOutcome",
        "observation",
        "projection",
      ],
      ["lastAttemptedAt", "reconciliationReason"]
    ) ||
    value.mode !== "read_only" ||
    value.authority !== "server_course_relationships" ||
    !isIsoTimestamp(value.authorityObservedAt) ||
    typeof value.availability !== "string" ||
    !moodleAvailability.has(
      value.availability as MoodleProjectionAvailability
    ) ||
    typeof value.freshness !== "string" ||
    !moodleFreshness.has(value.freshness as MoodleProjectionFreshness) ||
    typeof value.latestOutcome !== "string" ||
    !moodleProjectionOutcomes.has(
      value.latestOutcome as MoodleProjectionOutcome
    ) ||
    (value.lastAttemptedAt !== undefined &&
      !isIsoTimestamp(value.lastAttemptedAt)) ||
    (value.reconciliationReason !== undefined &&
      (typeof value.reconciliationReason !== "string" ||
        !moodleReconciliationReasons.has(
          value.reconciliationReason as NonNullable<
            MoodleCourseProjectionDto["reconciliationReason"]
          >
        ))) ||
    !isMoodleContentObservation(value.observation) ||
    !isRecord(value.projection)
  ) {
    return null;
  }

  const projection = value.projection;
  if (
    !hasExactKeys(projection, [
      "internalCourseId",
      "externalCourseId",
      "mappingState",
      "sections",
    ]) ||
    projection.internalCourseId !== requestedCourseId ||
    !isMoodleSourceId(projection.externalCourseId) ||
    typeof projection.mappingState !== "string" ||
    !moodleMappingStates.has(
      projection.mappingState as MoodleCourseProjectionDto["mappingState"]
    ) ||
    !Array.isArray(projection.sections) ||
    projection.sections.length > moodleContentCollectionLimit ||
    !projection.sections.every(isMoodleContentSection)
  ) {
    return null;
  }

  const sectionCount = projection.sections.length;
  const latestSucceeded = ["available", "empty"].includes(value.latestOutcome);
  if (
    value.freshness === "unavailable" ||
    (value.latestOutcome === "available" &&
      (value.availability !== "available" || sectionCount === 0)) ||
    (value.latestOutcome === "empty" &&
      (value.availability !== "empty" || sectionCount !== 0)) ||
    (!latestSucceeded &&
      (value.availability !== "unavailable" || value.freshness !== "stale"))
  ) {
    return null;
  }

  return value as MoodleCourseContentProjectionDto;
}

export function fetchPlatformStateRequest() {
  return apiJson<PlatformStateDto>("/api/platform/state");
}

export async function fetchMoodleCourseCatalogProjectionRequest() {
  const result = await apiJson<unknown>(
    "/api/integrations/moodle/projections/courses"
  );
  if (!result.ok) return result as ApiResult<MoodleCourseCatalogProjectionDto>;
  const data = parseMoodleCourseCatalogProjectionDto(result.data);
  return data
    ? { ok: true, data }
    : { ok: false, error: "Moodle projection response was invalid." };
}

export async function fetchMoodleCourseContentProjectionRequest(
  courseId: string
) {
  const requestedCourseId = courseId.trim();
  if (!requestedCourseId) {
    return { ok: false, error: "Course ID is required." };
  }
  const result = await apiJson<unknown>(
    `/api/integrations/moodle/projections/courses/${encodeURIComponent(requestedCourseId)}/content`,
    { method: "GET" }
  );
  if (!result.ok) return result as ApiResult<MoodleCourseContentProjectionDto>;
  const data = parseMoodleCourseContentProjectionDto(
    result.data,
    requestedCourseId
  );
  return data
    ? { ok: true, data }
    : { ok: false, error: "Moodle projection response was invalid." };
}

export function runPlatformLearningActionRequest(
  action: PlatformLearningAction
) {
  return apiJson<PlatformActionDto>("/api/platform/state/actions", {
    method: "POST",
    body: JSON.stringify(action),
  });
}

export function runPlatformWorkflowActionRequest(
  action: PlatformWorkflowAction
) {
  return apiJson<PlatformWorkflowActionDto>("/api/platform/state/actions", {
    method: "POST",
    body: JSON.stringify(action),
  });
}

export function verifyPublicCertificateRequest(code: string) {
  return apiJson<PublicCertificateVerificationDto>(
    `/api/certificates/verify?code=${encodeURIComponent(code)}`
  );
}
