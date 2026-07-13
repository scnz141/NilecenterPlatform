import crypto from "node:crypto";

import { seedPlatformState } from "../client/src/lib/domain/seed.js";
import type { PlatformState } from "../client/src/lib/domain/types.js";
import type { ServerSession } from "./auth.js";
import {
  getNileFormsCompatibilityRepository,
  type NileFormsCompatibilityRepository,
} from "./nileFormsCompatibilityRepository.js";
import {
  getPlatformStateRepository,
  normalizePlatformState,
} from "./platformRepository.js";
import {
  getOfflineEligibility,
  normalizeAndValidateFormAnswers,
  validateFormVersionContent,
  type FormAssignment,
  type FormAssignmentTarget,
  type FormAuditEvent,
  type FormChoice,
  type FormDefinition,
  type FormOfflineDevice,
  type FormLocale,
  type FormManagementOptions,
  type FormOwnerRole,
  type FormPermission,
  type FormPromotion,
  type FormPublication,
  type FormRespondentRole,
  type FormReview,
  type FormSubmission,
  type FormSyncReceipt,
  type FormVersion,
  type FormVersionContent,
  type NileFormsState,
} from "../shared/nileForms.js";
import { executeNileFormPromotion } from "./nileFormsPromotionAdapters.js";
import {
  projectableNileFormFieldIds,
  projectNileFormAnswers,
  projectNileFormSubmission,
} from "./nileFormsProjection.js";

export class NileFormsError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = "NileFormsError";
  }
}

export type NileFormsActor = {
  userId: string;
  role: FormRespondentRole;
  branchIds: string[];
  departmentIds: string[];
  allBranches: boolean;
  allDepartments: boolean;
  courseIds: string[];
  classIds: string[];
  platformState: PlatformState;
};

export type FormDefinitionBundle = {
  definition: FormDefinition;
  versions: FormVersion[];
  publications: FormPublication[];
  assignments: FormAssignment[];
  assignmentOptions: FormManagementOptions;
};

export type FormResponderBundle = {
  definition: FormDefinition;
  publication: FormPublication;
  version: FormVersion;
  previousSubmissions: Array<
    Pick<FormSubmission, "id" | "status" | "submittedAt" | "updatedAt">
  >;
  entityOptions: Record<string, FormChoice[]>;
};

export type FormResponderSubmissionDetail = {
  definition: FormDefinition;
  publication: FormPublication;
  version: FormVersion;
  submission: FormSubmission;
  reviews: Array<
    Pick<FormReview, "id" | "decision" | "comments" | "createdAt">
  >;
  entityOptions: Record<string, FormChoice[]>;
};

export type FormOfflineBundle = {
  device: Pick<FormOfflineDevice, "id" | "label" | "enrolledAt" | "expiresAt">;
  generatedAt: string;
  expiresAt: string;
  forms: FormResponderBundle[];
};

export type FormOfflineSyncItem = {
  publicationId: string;
  versionId: string;
  clientSubmissionId: string;
  clientSubmittedAt: string;
  answers: Record<string, unknown>;
  respondentUserId?: string;
};

export type FormOfflineSyncResult = {
  receipts: FormSyncReceipt[];
};

type PromotionResult = {
  commandId: string;
  entityType: string;
  entityId: string;
};

type NileFormsServiceDependencies = {
  repository?: NileFormsCompatibilityRepository;
  now?: () => Date;
  randomId?: (prefix: string) => string;
  draftKey?: Buffer;
  readAuthorityState?: () => Promise<PlatformState>;
  executePromotion?: (
    adapter: FormPromotion["adapter"],
    submission: FormSubmission,
    session: ServerSession
  ) => Promise<PromotionResult>;
};

const ownerRoles = new Set<FormOwnerRole>([
  "registrar",
  "headofdepartment",
  "branchadmin",
  "superadmin",
]);
const respondentRoleLabels: Record<FormRespondentRole, string> = {
  student: "Student",
  teacher: "Teacher",
  registrar: "Registrar",
  headofdepartment: "Head of Department",
  branchadmin: "Branch Admin",
  superadmin: "Super Admin",
};
const respondentRoleOrder = Object.keys(
  respondentRoleLabels
) as FormRespondentRole[];
const offlineStaffRoles = new Set<FormRespondentRole>([
  "teacher",
  "registrar",
  "headofdepartment",
  "branchadmin",
  "superadmin",
]);
const formKeyPattern = /^[a-z][a-z0-9_:-]{2,79}$/;
const slugPattern = /^[a-z0-9][a-z0-9-]{2,79}$/;
const clientSubmissionIdPattern = /^[a-zA-Z0-9][a-zA-Z0-9:_-]{7,127}$/;
const productionCompatibilityEnabled = () =>
  process.env.NODE_ENV !== "production" ||
  process.env.NILE_FORMS_COMPATIBILITY_ENABLED === "1";
const ephemeralDraftKey = crypto.randomBytes(32);

function clone<T>(value: T): T {
  return structuredClone(value);
}

function clean(value: unknown, max = 4_000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function unique(values: Array<string | undefined>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value)))
  );
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map(key => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashValue(value: unknown) {
  return crypto
    .createHash("sha256")
    .update(canonicalJson(value), "utf8")
    .digest("hex");
}

function decodeConfiguredDraftKey(value: string) {
  const trimmed = value.trim();
  if (/^[0-9a-f]{64}$/i.test(trimmed)) return Buffer.from(trimmed, "hex");
  try {
    const decoded = Buffer.from(trimmed, "base64");
    return decoded.length === 32 ? decoded : null;
  } catch {
    return null;
  }
}

function resolveDraftKey(override?: Buffer) {
  if (override?.length === 32) return override;
  const configured = clean(process.env.NILE_FORMS_DRAFT_KEY, 1_000);
  if (configured) {
    const decoded = decodeConfiguredDraftKey(configured);
    if (!decoded) {
      throw new NileFormsError(
        "NILE_FORMS_DRAFT_KEY must contain exactly 32 bytes in base64 or 64 hexadecimal characters.",
        503,
        "draft_key_invalid"
      );
    }
    return decoded;
  }
  if (process.env.NODE_ENV === "production") {
    throw new NileFormsError(
      "Secure form drafts are not configured.",
      503,
      "draft_key_missing"
    );
  }
  return ephemeralDraftKey;
}

function encryptDraft(answers: Record<string, unknown>, key: Buffer) {
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, nonce);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(answers), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `v1.${nonce.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

function decryptDraft(payload: string, key: Buffer) {
  const [version, nonceValue, tagValue, ciphertextValue] = payload.split(".");
  if (version !== "v1" || !nonceValue || !tagValue || !ciphertextValue) {
    throw new NileFormsError(
      "The saved draft is corrupted.",
      409,
      "draft_corrupted"
    );
  }
  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(nonceValue, "base64url")
    );
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    const answers = JSON.parse(plaintext) as unknown;
    if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
      throw new Error("Draft payload is not an object");
    }
    return answers as Record<string, unknown>;
  } catch (error) {
    if (error instanceof NileFormsError) throw error;
    throw new NileFormsError(
      "The saved draft is corrupted.",
      409,
      "draft_corrupted"
    );
  }
}

function hashDraftToken(token: string) {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

function tokenMatches(token: string, expectedHash: string) {
  const actual = Buffer.from(hashDraftToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return (
    actual.length === expected.length &&
    crypto.timingSafeEqual(actual, expected)
  );
}

function requireCompatibilityRuntime(session?: ServerSession | null) {
  if (!productionCompatibilityEnabled()) {
    throw new NileFormsError(
      "Nile Forms compatibility runtime is not enabled in production.",
      503,
      "runtime_not_enabled"
    );
  }
  if (session?.authorizationModel === "normalized") {
    throw new NileFormsError(
      "Normalized Nile Forms persistence is not active.",
      503,
      "normalized_persistence_inactive"
    );
  }
}

function requireSession(session: ServerSession | null | undefined) {
  if (!session) {
    throw new NileFormsError("Sign in required.", 401, "sign_in_required");
  }
  requireCompatibilityRuntime(session);
  return session;
}

async function readPlatformState(): Promise<PlatformState> {
  const snapshot = await getPlatformStateRepository().readSnapshot();
  return normalizePlatformState(snapshot.state);
}

function requirePermission(
  state: PlatformState,
  session: ServerSession,
  permission: FormPermission
) {
  if (!(state.permissions[session.activeRole] ?? []).includes(permission)) {
    throw new NileFormsError(
      `This action requires ${permission}.`,
      403,
      "permission_denied"
    );
  }
}

function narrowedScope(
  configured: string[],
  sessionScope: string[] | undefined,
  globalMarker: string
) {
  const configuredAll = configured.includes(globalMarker);
  const configuredIds = unique(configured.filter(id => id !== globalMarker));
  if (sessionScope === undefined) {
    return { ids: configuredIds, all: configuredAll };
  }

  const sessionAll = sessionScope.includes(globalMarker);
  const sessionIds = unique(sessionScope.filter(id => id !== globalMarker));
  if (configuredAll && sessionAll) return { ids: [], all: true };
  if (configuredAll) return { ids: sessionIds, all: false };
  if (sessionAll) return { ids: configuredIds, all: false };

  const requested = new Set(sessionIds);
  return {
    ids: configuredIds.filter(id => requested.has(id)),
    all: false,
  };
}

function actorHasBranch(actor: NileFormsActor, branchId: string) {
  return (
    actor.role === "superadmin" ||
    actor.allBranches ||
    actor.branchIds.includes(branchId)
  );
}

function actorHasDepartment(actor: NileFormsActor, departmentId: string) {
  return (
    actor.role === "superadmin" ||
    actor.allDepartments ||
    actor.departmentIds.includes(departmentId)
  );
}

function resolveActor(
  state: PlatformState,
  session: ServerSession
): NileFormsActor {
  const user = state.users.find(item => item.id === session.userId);
  if (
    !user ||
    user.status !== "active" ||
    !user.roles.includes(session.activeRole)
  ) {
    throw new NileFormsError(
      "The active session no longer has an eligible user or role grant.",
      403,
      "session_authority_denied"
    );
  }

  let configuredBranchIds = unique([user.branchId]);
  let configuredDepartmentIds = unique([user.departmentId]);
  let classIds: string[] = [];
  let courseIds: string[] = [];

  if (session.activeRole === "teacher") {
    const profile = state.teachers.find(
      item => item.userId === user.id && item.status === "active"
    );
    if (!profile) {
      throw new NileFormsError(
        "The teacher profile is not active.",
        403,
        "session_authority_denied"
      );
    }
    configuredBranchIds = [profile.branchId];
    configuredDepartmentIds = [profile.departmentId];
    classIds = unique(profile.assignedClassIds);
    courseIds = unique(
      classIds.map(classId => {
        const group = state.classGroups.find(item => item.id === classId);
        const run = group
          ? state.courseRuns.find(item => item.id === group.courseRunId)
          : undefined;
        return run?.courseId;
      })
    );
  } else if (session.activeRole === "student") {
    const student = state.students.find(item => item.userId === user.id);
    if (!student) {
      throw new NileFormsError(
        "The student profile is not active.",
        403,
        "session_authority_denied"
      );
    }
    const enrollments = state.enrollments.filter(
      item =>
        item.studentId === student.id &&
        !["cancelled", "completed"].includes(item.status)
    );
    classIds = unique(enrollments.map(item => item.classGroupId));
    courseIds = unique(
      enrollments.map(
        item =>
          state.courseRuns.find(run => run.id === item.courseRunId)?.courseId
      )
    );
  } else if (session.activeRole !== "superadmin") {
    const profile = state.staffProfiles.find(
      item =>
        item.userId === user.id &&
        item.role === session.activeRole &&
        item.status === "active"
    );
    if (!profile) {
      throw new NileFormsError(
        "The active staff scope is unavailable.",
        403,
        "session_authority_denied"
      );
    }
    configuredBranchIds = profile.branchIds;
    configuredDepartmentIds = profile.departmentIds;
  }

  const branchScope = narrowedScope(
    configuredBranchIds,
    session.branchIds,
    "br_global"
  );
  const departmentScope = narrowedScope(
    configuredDepartmentIds,
    session.departmentIds,
    "dep_platform"
  );
  if (
    session.activeRole !== "superadmin" &&
    ((!branchScope.all && branchScope.ids.length === 0) ||
      (!departmentScope.all && departmentScope.ids.length === 0))
  ) {
    throw new NileFormsError(
      "The active session scope no longer overlaps the assigned role scope.",
      403,
      "session_scope_denied"
    );
  }
  return {
    userId: session.userId,
    role: session.activeRole,
    branchIds: branchScope.ids,
    departmentIds: departmentScope.ids,
    allBranches: session.activeRole === "superadmin" || branchScope.all,
    allDepartments: session.activeRole === "superadmin" || departmentScope.all,
    courseIds,
    classIds,
    platformState: state,
  };
}

function canAccessDefinition(
  actor: NileFormsActor,
  definition: FormDefinition
) {
  if (actor.role === "superadmin") return true;
  if (definition.ownerRole !== actor.role) return false;
  if (definition.branchId && !actorHasBranch(actor, definition.branchId))
    return false;
  if (
    definition.departmentId &&
    !actorHasDepartment(actor, definition.departmentId)
  ) {
    return false;
  }
  return true;
}

function canReviewDefinition(
  actor: NileFormsActor,
  definition: FormDefinition
) {
  if (actor.role === "superadmin") return true;
  if (definition.branchId && !actorHasBranch(actor, definition.branchId))
    return false;
  if (
    definition.departmentId &&
    !actorHasDepartment(actor, definition.departmentId)
  ) {
    return false;
  }
  if (actor.role === "registrar") return definition.category === "admissions";
  if (actor.role === "branchadmin") {
    return [
      "student_support",
      "attendance",
      "branch_operations",
      "consent",
    ].includes(definition.category);
  }
  if (actor.role === "headofdepartment") {
    return ["consent", "attendance"].includes(definition.category);
  }
  return false;
}

function canReviewSubmission(
  actor: NileFormsActor,
  definition: FormDefinition,
  submission: FormSubmission
) {
  if (!canReviewDefinition(actor, definition)) return false;
  if (actor.role === "superadmin") return true;

  if (!actor.allBranches) {
    if (
      !submission.branchId ||
      !actor.branchIds.includes(submission.branchId)
    ) {
      return false;
    }
  }
  if (actor.role === "headofdepartment" && !actor.allDepartments) {
    if (
      !submission.departmentId ||
      !actor.departmentIds.includes(submission.departmentId)
    ) {
      return false;
    }
  }
  return true;
}

function publicationIsOpen(publication: FormPublication, now: Date) {
  if (publication.status === "closed" || publication.status === "retired") {
    return false;
  }
  const time = now.getTime();
  if (publication.opensAt && new Date(publication.opensAt).getTime() > time)
    return false;
  if (publication.closesAt && new Date(publication.closesAt).getTime() <= time)
    return false;
  return true;
}

function assignmentMatches(
  assignment: FormAssignment,
  actor: NileFormsActor,
  now: Date
) {
  if (assignment.revokedAt) return false;
  if (
    assignment.expiresAt &&
    new Date(assignment.expiresAt).getTime() <= now.getTime()
  ) {
    return false;
  }
  switch (assignment.target.type) {
    case "user":
      return assignment.target.userId === actor.userId;
    case "role":
      return assignment.target.role === actor.role;
    case "branch":
      return actorHasBranch(actor, assignment.target.branchId);
    case "department":
      return actorHasDepartment(actor, assignment.target.departmentId);
    case "course":
      return actor.courseIds.includes(assignment.target.courseId);
    case "class":
      return actor.classIds.includes(assignment.target.classId);
  }
}

function matchingAssignment(
  state: NileFormsState,
  publicationId: string,
  actor: NileFormsActor,
  now: Date
) {
  return state.assignments.find(
    item =>
      item.publicationId === publicationId &&
      assignmentMatches(item, actor, now)
  );
}

function publicationAvailableToActor(
  state: NileFormsState,
  publication: FormPublication,
  actor: NileFormsActor,
  now: Date
) {
  if (!publicationIsOpen(publication, now)) return false;
  const definition = state.definitions.find(
    item => item.id === publication.definitionId
  );
  if (!definition) return false;
  if (
    actor.role !== "superadmin" &&
    definition.branchId &&
    !actorHasBranch(actor, definition.branchId)
  ) {
    return false;
  }
  if (
    actor.role !== "superadmin" &&
    definition.departmentId &&
    !actorHasDepartment(actor, definition.departmentId)
  ) {
    return false;
  }
  if (publication.audience === "authenticated") return true;
  if (publication.audience === "public") return false;
  return Boolean(matchingAssignment(state, publication.id, actor, now));
}

function requireOfflineStaff(state: PlatformState, session: ServerSession) {
  requirePermission(state, session, "forms:respond");
  const actor = resolveActor(state, session);
  if (!offlineStaffRoles.has(actor.role)) {
    throw new NileFormsError(
      "Offline form capture is restricted to staff.",
      403,
      "offline_staff_only"
    );
  }
  return actor;
}

function requireOfflineDevice(
  state: NileFormsState,
  actor: NileFormsActor,
  deviceId: string,
  deviceToken: string,
  now: Date
) {
  const device = state.offlineDevices.find(item => item.id === deviceId);
  if (
    !device ||
    device.userId !== actor.userId ||
    !deviceToken ||
    !tokenMatches(deviceToken, device.publicKey)
  ) {
    throw new NileFormsError(
      "Offline device authorization failed.",
      403,
      "offline_device_denied"
    );
  }
  if (device.revokedAt) {
    throw new NileFormsError(
      "This offline device was revoked.",
      409,
      "offline_device_revoked"
    );
  }
  if (new Date(device.expiresAt).getTime() <= now.getTime()) {
    throw new NileFormsError(
      "This offline device enrollment expired.",
      409,
      "offline_device_expired"
    );
  }
  return device;
}

function previousSubmissionsFor(
  state: NileFormsState,
  publicationId: string,
  respondentUserId: string
): FormResponderBundle["previousSubmissions"] {
  return state.submissions
    .filter(
      item =>
        item.publicationId === publicationId &&
        item.respondentUserId === respondentUserId
    )
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map(item => ({
      id: item.id,
      status: item.status,
      submittedAt: item.submittedAt,
      updatedAt: item.updatedAt,
    }));
}

function entityOptionsForContent(
  content: FormVersionContent,
  actor: NileFormsActor | null,
  definition?: FormDefinition,
  authorityState: PlatformState = actor?.platformState ?? seedPlatformState
) {
  const result: Record<string, FormChoice[]> = {};
  const fields = content.pages
    .flatMap(page => page.fields)
    .filter(field => field.type === "entity_reference" && field.entityType);
  for (const field of fields) {
    if (field.entityType === "branch") {
      result[field.id] = authorityState.branches
        .filter(branch => branch.status === "active")
        .filter(
          branch => !definition?.branchId || branch.id === definition.branchId
        )
        .filter(
          branch =>
            !actor ||
            actor.role === "superadmin" ||
            actorHasBranch(actor, branch.id)
        )
        .map(branch => ({
          id: branch.id,
          label: { en: branch.name, ar: branch.name },
        }));
      continue;
    }
    if (field.entityType === "department") {
      result[field.id] = authorityState.departments
        .filter(department => department.status === "active")
        .filter(
          department =>
            !definition?.departmentId ||
            department.id === definition.departmentId
        )
        .filter(
          department =>
            !actor ||
            actor.role === "superadmin" ||
            actorHasDepartment(actor, department.id)
        )
        .map(department => ({
          id: department.id,
          label: { en: department.name, ar: department.name },
        }));
      continue;
    }
    if (field.entityType === "course") {
      result[field.id] = authorityState.courses
        .filter(course => course.status === "active")
        .map(course => ({
          id: course.id,
          label: { en: course.title, ar: course.title },
        }));
      continue;
    }
    if (field.entityType === "class" && actor) {
      result[field.id] = authorityState.classGroups
        .filter(group => {
          const run = authorityState.courseRuns.find(
            item => item.id === group.courseRunId
          );
          return (
            group.status === "active" &&
            (actor.role === "superadmin" ||
              (run ? actorHasBranch(actor, run.branchId) : false))
          );
        })
        .map(group => ({
          id: group.id,
          label: { en: group.name, ar: group.name },
        }));
      continue;
    }
    if (field.entityType === "attendance_record" && actor) {
      const student = authorityState.students.find(
        item => item.userId === actor.userId
      );
      result[field.id] = authorityState.attendance
        .filter(
          record =>
            record.studentId === student?.id &&
            (record.status === "absent" || record.status === "late")
        )
        .map(record => {
          const group = authorityState.classGroups.find(
            item => item.id === record.classGroupId
          );
          const session = authorityState.classSessions.find(
            item => item.id === record.sessionId
          );
          const label = `${group?.name ?? "Class"} - ${session?.title ?? record.sessionId} - ${record.status}`;
          return { id: record.id, label: { en: label, ar: label } };
        });
      continue;
    }
    result[field.id] = [];
  }
  return result;
}

function entityReferenceErrors(
  content: FormVersionContent,
  answers: Record<string, unknown>,
  options: Record<string, FormChoice[]>
) {
  return content.pages.flatMap(page =>
    page.fields.flatMap(field => {
      if (field.type !== "entity_reference") return [];
      const value = answers[field.id];
      if (value === undefined || value === null || value === "") return [];
      if (
        typeof value !== "string" ||
        !(options[field.id] ?? []).some(option => option.id === value)
      ) {
        return [
          { fieldId: field.id, message: `${field.label.en} is not available.` },
        ];
      }
      return [];
    })
  );
}

function mergeAnswerValidationErrors(
  schemaErrors: Record<string, string[]>,
  entityErrors: Array<{ fieldId: string; message: string }>
) {
  const errors = structuredClone(schemaErrors);
  entityErrors.forEach(error => {
    errors[error.fieldId] = [...(errors[error.fieldId] ?? []), error.message];
  });
  return errors;
}

function submissionScopeFromAnswers(
  definition: FormDefinition,
  content: FormVersionContent,
  answers: Record<string, unknown>,
  actor: NileFormsActor | null
) {
  const fields = content.pages.flatMap(page => page.fields);
  const branchField = fields.find(
    field => field.type === "entity_reference" && field.entityType === "branch"
  );
  const departmentField = fields.find(
    field =>
      field.type === "entity_reference" && field.entityType === "department"
  );
  const answerBranch = branchField ? answers[branchField.id] : undefined;
  const answerDepartment = departmentField
    ? answers[departmentField.id]
    : undefined;
  return {
    branchId:
      definition.branchId ??
      (typeof answerBranch === "string" ? answerBranch : actor?.branchIds[0]),
    departmentId:
      definition.departmentId ??
      (typeof answerDepartment === "string"
        ? answerDepartment
        : actor?.departmentIds[0]),
  };
}

function requireDefinition(
  state: NileFormsState,
  definitionId: string
): FormDefinition {
  const definition = state.definitions.find(item => item.id === definitionId);
  if (!definition) {
    throw new NileFormsError(
      "Form definition not found.",
      404,
      "form_not_found"
    );
  }
  return definition;
}

function requireVersion(state: NileFormsState, versionId: string) {
  const version = state.versions.find(item => item.id === versionId);
  if (!version) {
    throw new NileFormsError(
      "Form version not found.",
      404,
      "version_not_found"
    );
  }
  return version;
}

function requirePublication(state: NileFormsState, publicationId: string) {
  const publication = state.publications.find(
    item => item.id === publicationId
  );
  if (!publication) {
    throw new NileFormsError(
      "Form publication not found.",
      404,
      "publication_not_found"
    );
  }
  return publication;
}

function projectSubmissionForCompatibilityReader(
  state: NileFormsState,
  submission: FormSubmission
) {
  const version = requireVersion(state, submission.versionId);
  return projectNileFormSubmission(submission, version.content, false);
}

function appendAudit(
  state: NileFormsState,
  input: Omit<FormAuditEvent, "id" | "createdAt">,
  createId: (prefix: string) => string,
  now: string
) {
  const event: FormAuditEvent = {
    id: createId("form_audit"),
    createdAt: now,
    ...input,
  };
  state.auditEvents = [event, ...state.auditEvents].slice(0, 2_000);
  return event;
}

function appendOutbox(
  state: NileFormsState,
  eventType: "form.submitted" | "form.reviewed" | "form.promoted",
  aggregateId: string,
  payload: Record<string, unknown>,
  createId: (prefix: string) => string,
  now: string
) {
  const idempotencyKey = `${eventType}:${aggregateId}:${hashValue(payload).slice(0, 16)}`;
  if (state.outboxEvents.some(item => item.idempotencyKey === idempotencyKey))
    return;
  state.outboxEvents.unshift({
    id: createId("form_event"),
    eventType,
    aggregateId,
    idempotencyKey,
    payload,
    createdAt: now,
  });
}

function defaultContent(titleEn: string, titleAr: string): FormVersionContent {
  return {
    title: { en: titleEn, ar: titleAr },
    description: { en: "", ar: "" },
    defaultLanguage: "en",
    languages: ["en", "ar"],
    submitLabel: { en: "Submit", ar: "إرسال" },
    confirmationMessage: {
      en: "Your response has been received.",
      ar: "تم استلام ردك.",
    },
    pages: [
      {
        id: "page_1",
        title: { en: "Page 1", ar: "الصفحة 1" },
        fields: [],
      },
    ],
    logic: [],
  };
}

function validateScopeForNewDefinition(
  actor: NileFormsActor,
  input: { branchId?: unknown; departmentId?: unknown }
) {
  const branchId = clean(input.branchId, 120) || undefined;
  const departmentId = clean(input.departmentId, 120) || undefined;
  if (actor.role === "superadmin") return {};
  if (actor.role === "registrar" || actor.role === "branchadmin") {
    if (!branchId || !actorHasBranch(actor, branchId)) {
      throw new NileFormsError(
        "Choose a branch inside the active role scope.",
        403,
        "branch_scope_denied"
      );
    }
    return { branchId };
  }
  if (actor.role === "headofdepartment") {
    if (!departmentId || !actorHasDepartment(actor, departmentId)) {
      throw new NileFormsError(
        "Choose a department inside the active role scope.",
        403,
        "department_scope_denied"
      );
    }
    if (branchId && !actorHasBranch(actor, branchId)) {
      throw new NileFormsError(
        "Choose a branch inside the active role scope.",
        403,
        "branch_scope_denied"
      );
    }
    return { departmentId, branchId };
  }
  throw new NileFormsError(
    "This role cannot create form definitions.",
    403,
    "owner_role_denied"
  );
}

function validateAssignmentTarget(
  actor: NileFormsActor,
  target: FormAssignmentTarget,
  state: PlatformState,
  definition?: FormDefinition
) {
  const definitionAllowsTarget = () => {
    if (!definition?.branchId && !definition?.departmentId) return true;
    if (target.type === "role") return true;

    if (target.type === "user") {
      const user = state.users.find(item => item.id === target.userId);
      return Boolean(
        user &&
          (!definition.branchId || user.branchId === definition.branchId) &&
          (!definition.departmentId ||
            user.departmentId === definition.departmentId)
      );
    }
    if (target.type === "branch") {
      return !definition.branchId || target.branchId === definition.branchId;
    }
    if (target.type === "department") {
      const department = state.departments.find(
        item => item.id === target.departmentId
      );
      return Boolean(
        department &&
          (!definition.departmentId ||
            department.id === definition.departmentId) &&
          (!definition.branchId ||
            department.branchIds.includes(definition.branchId))
      );
    }
    if (target.type === "course") {
      const course = state.courses.find(item => item.id === target.courseId);
      const program = course
        ? state.programs.find(item => item.id === course.programId)
        : undefined;
      return Boolean(
        course &&
          (!definition.departmentId ||
            program?.departmentId === definition.departmentId) &&
          (!definition.branchId ||
            state.courseRuns.some(
              run =>
                run.courseId === course.id &&
                run.branchId === definition.branchId &&
                run.status === "active"
            ))
      );
    }
    const group = state.classGroups.find(item => item.id === target.classId);
    const run = group
      ? state.courseRuns.find(item => item.id === group.courseRunId)
      : undefined;
    const course = run
      ? state.courses.find(item => item.id === run.courseId)
      : undefined;
    const program = course
      ? state.programs.find(item => item.id === course.programId)
      : undefined;
    return Boolean(
      group &&
        run &&
        (!definition.branchId || run.branchId === definition.branchId) &&
        (!definition.departmentId ||
          program?.departmentId === definition.departmentId)
    );
  };

  if (!definitionAllowsTarget()) {
    throw new NileFormsError(
      "The assignment target is outside the form scope.",
      403,
      "assignment_scope_denied"
    );
  }

  if (target.type === "user") {
    const user = state.users.find(
      item => item.id === target.userId && item.status === "active"
    );
    if (!user) {
      throw new NileFormsError(
        "The assignment user is not active.",
        400,
        "assignment_target_invalid"
      );
    }
    if (
      actor.role !== "superadmin" &&
      ((user.branchId && !actorHasBranch(actor, user.branchId)) ||
        (actor.role === "headofdepartment" &&
          user.departmentId &&
          !actorHasDepartment(actor, user.departmentId)))
    ) {
      throw new NileFormsError(
        "The assignment user is outside the active scope.",
        403,
        "assignment_scope_denied"
      );
    }
    return;
  }
  if (target.type === "branch") {
    const branch = state.branches.find(
      item => item.id === target.branchId && item.status === "active"
    );
    if (!branch) {
      throw new NileFormsError(
        "The assignment branch is not active.",
        400,
        "assignment_target_invalid"
      );
    }
  }
  if (target.type === "department") {
    const department = state.departments.find(
      item => item.id === target.departmentId && item.status === "active"
    );
    if (!department) {
      throw new NileFormsError(
        "The assignment department is not active.",
        400,
        "assignment_target_invalid"
      );
    }
  }
  if (target.type === "course") {
    const course = state.courses.find(
      item => item.id === target.courseId && item.status === "active"
    );
    if (!course) {
      throw new NileFormsError(
        "The assignment course is not active.",
        400,
        "assignment_target_invalid"
      );
    }
    if (actor.role !== "superadmin") {
      const program = state.programs.find(item => item.id === course.programId);
      const branchAllowed = state.courseRuns.some(
        run =>
          run.courseId === course.id &&
          run.status === "active" &&
          actorHasBranch(actor, run.branchId)
      );
      const departmentAllowed = Boolean(
        program && actorHasDepartment(actor, program.departmentId)
      );
      if (!branchAllowed && !departmentAllowed) {
        throw new NileFormsError(
          "The assignment course is outside the active scope.",
          403,
          "assignment_scope_denied"
        );
      }
    }
    return;
  }
  if (target.type === "class") {
    const group = state.classGroups.find(
      item => item.id === target.classId && item.status === "active"
    );
    const run = group
      ? state.courseRuns.find(
          item => item.id === group.courseRunId && item.status === "active"
        )
      : undefined;
    if (!group || !run) {
      throw new NileFormsError(
        "The assignment class is not active.",
        400,
        "assignment_target_invalid"
      );
    }
    if (
      actor.role !== "superadmin" &&
      !actorHasBranch(actor, run.branchId) &&
      !actor.classIds.includes(group.id)
    ) {
      throw new NileFormsError(
        "The assignment class is outside the active scope.",
        403,
        "assignment_scope_denied"
      );
    }
    return;
  }
  if (actor.role === "superadmin") return;
  if (target.type === "branch" && !actorHasBranch(actor, target.branchId)) {
    throw new NileFormsError(
      "The assignment branch is outside the active scope.",
      403,
      "assignment_scope_denied"
    );
  }
  if (
    target.type === "department" &&
    !actorHasDepartment(actor, target.departmentId)
  ) {
    throw new NileFormsError(
      "The assignment department is outside the active scope.",
      403,
      "assignment_scope_denied"
    );
  }
  if (target.type === "role" && target.role === "superadmin") {
    throw new NileFormsError(
      "Delegated owners cannot assign forms to Super Admin.",
      403,
      "assignment_scope_denied"
    );
  }
}

function managementOptionsForActor(
  actor: NileFormsActor,
  definition?: FormDefinition
): FormManagementOptions {
  const state = actor.platformState;
  const allowed = (target: FormAssignmentTarget) => {
    try {
      validateAssignmentTarget(actor, target, state, definition);
      return true;
    } catch (error) {
      if (error instanceof NileFormsError) return false;
      throw error;
    }
  };

  return {
    roles: respondentRoleOrder
      .filter(role => allowed({ type: "role", role }))
      .map(role => ({ id: role, label: respondentRoleLabels[role] })),
    users: state.users
      .filter(user => user.status === "active")
      .filter(user => allowed({ type: "user", userId: user.id }))
      .map(user => ({
        id: user.id,
        label: user.name,
        context: `${user.email} / ${user.activeRole}`,
      })),
    branches: state.branches
      .filter(branch => branch.status === "active")
      .filter(branch => allowed({ type: "branch", branchId: branch.id }))
      .map(branch => ({
        id: branch.id,
        label: branch.name,
        context: branch.code,
      })),
    departments: state.departments
      .filter(department => department.status === "active")
      .filter(department =>
        allowed({ type: "department", departmentId: department.id })
      )
      .map(department => ({
        id: department.id,
        label: department.name,
        context: department.branchIds
          .map(
            branchId =>
              state.branches.find(branch => branch.id === branchId)?.name
          )
          .filter(Boolean)
          .join(" / "),
      })),
    courses: state.courses
      .filter(course => course.status === "active")
      .filter(course => allowed({ type: "course", courseId: course.id }))
      .map(course => ({
        id: course.id,
        label: course.title,
        context: state.programs.find(program => program.id === course.programId)
          ?.title,
      })),
    classes: state.classGroups
      .filter(group => group.status === "active")
      .filter(group => allowed({ type: "class", classId: group.id }))
      .map(group => {
        const run = state.courseRuns.find(
          item => item.id === group.courseRunId
        );
        const course = run
          ? state.courses.find(item => item.id === run.courseId)
          : undefined;
        const branch = run
          ? state.branches.find(item => item.id === run.branchId)
          : undefined;
        return {
          id: group.id,
          label: group.name,
          context: [course?.title, branch?.name].filter(Boolean).join(" / "),
        };
      }),
  };
}

function csvCell(value: unknown) {
  const raw = value === undefined || value === null ? "" : String(value);
  const text = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${text.replaceAll('"', '""')}"`;
}

export function createNileFormsService(
  dependencies: NileFormsServiceDependencies = {}
) {
  const repository =
    dependencies.repository ?? getNileFormsCompatibilityRepository();
  const nowDate = dependencies.now ?? (() => new Date());
  const createId =
    dependencies.randomId ??
    ((prefix: string) =>
      `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`);
  const promotionExecutor =
    dependencies.executePromotion ?? executeNileFormPromotion;
  const readAuthorityState =
    dependencies.readAuthorityState ?? readPlatformState;

  const authorize = async (
    session: ServerSession,
    permission: FormPermission
  ) => {
    const authorityState = await readAuthorityState();
    requirePermission(authorityState, session, permission);
    return resolveActor(authorityState, session);
  };

  const authorizeOffline = async (session: ServerSession) =>
    requireOfflineStaff(await readAuthorityState(), session);

  const currentIso = () => nowDate().toISOString();

  return {
    async listDefinitions(sessionInput: ServerSession | null | undefined) {
      const session = requireSession(sessionInput);
      const actor = await authorize(session, "forms:read");
      const state = await repository.read();
      return state.definitions
        .filter(item => canAccessDefinition(actor, item))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    },

    async getManagementOptions(
      sessionInput: ServerSession | null | undefined
    ): Promise<FormManagementOptions> {
      const session = requireSession(sessionInput);
      const actor = await authorize(session, "forms:write");
      return managementOptionsForActor(actor);
    },

    async getDefinition(
      sessionInput: ServerSession | null | undefined,
      definitionId: string
    ): Promise<FormDefinitionBundle> {
      const session = requireSession(sessionInput);
      const actor = await authorize(session, "forms:read");
      const state = await repository.read();
      const definition = requireDefinition(state, definitionId);
      if (!canAccessDefinition(actor, definition)) {
        throw new NileFormsError(
          "Form scope denied.",
          403,
          "form_scope_denied"
        );
      }
      const publications = state.publications.filter(
        item => item.definitionId === definition.id
      );
      const publicationIds = new Set(publications.map(item => item.id));
      return {
        definition,
        versions: state.versions
          .filter(item => item.definitionId === definition.id)
          .sort((left, right) => right.versionNumber - left.versionNumber),
        publications,
        assignments: state.assignments.filter(item =>
          publicationIds.has(item.publicationId)
        ),
        assignmentOptions: managementOptionsForActor(actor, definition),
      };
    },

    async createDefinition(
      sessionInput: ServerSession | null | undefined,
      input: Record<string, unknown>
    ) {
      const session = requireSession(sessionInput);
      const actor = await authorize(session, "forms:write");
      if (!ownerRoles.has(actor.role as FormOwnerRole)) {
        throw new NileFormsError(
          "This role cannot create form definitions.",
          403,
          "owner_role_denied"
        );
      }
      const key = clean(input.key, 80).toLowerCase();
      const titleEn = clean(input.titleEn, 200);
      const titleAr = clean(input.titleAr, 200);
      const category = clean(input.category, 80) as FormDefinition["category"];
      if (!formKeyPattern.test(key) || !titleEn || !titleAr) {
        throw new NileFormsError(
          "A valid key and English/Arabic titles are required.",
          400,
          "definition_invalid"
        );
      }
      if (
        ![
          "admissions",
          "student_support",
          "attendance",
          "consent",
          "branch_operations",
        ].includes(category)
      ) {
        throw new NileFormsError(
          "Choose a supported form category.",
          400,
          "definition_invalid"
        );
      }
      if (actor.role === "registrar" && category !== "admissions") {
        throw new NileFormsError(
          "Registrar form ownership is limited to admissions.",
          403,
          "category_scope_denied"
        );
      }
      if (
        actor.role === "branchadmin" &&
        !["attendance", "consent", "branch_operations"].includes(category)
      ) {
        throw new NileFormsError(
          "Branch Admin form ownership is limited to branch operations.",
          403,
          "category_scope_denied"
        );
      }
      if (
        actor.role === "headofdepartment" &&
        !["attendance", "consent"].includes(category)
      ) {
        throw new NileFormsError(
          "HOD form ownership is limited to academic administration.",
          403,
          "category_scope_denied"
        );
      }
      const scope = validateScopeForNewDefinition(actor, input);

      return repository.transaction(state => {
        if (state.definitions.some(item => item.key === key)) {
          throw new NileFormsError(
            "That form key already exists.",
            409,
            "definition_conflict"
          );
        }
        const now = currentIso();
        const definitionId = createId("form");
        const versionId = createId("form_version");
        const versionContent = defaultContent(titleEn, titleAr);
        const definition: FormDefinition = {
          id: definitionId,
          key,
          title: titleEn,
          category,
          ownerUserId: actor.userId,
          ownerRole: actor.role as FormOwnerRole,
          ...scope,
          status: "draft",
          currentDraftVersionId: versionId,
          createdAt: now,
          updatedAt: now,
        };
        const version: FormVersion = {
          id: versionId,
          definitionId,
          versionNumber: 1,
          status: "draft",
          revision: 1,
          content: versionContent,
          contentHash: hashValue(versionContent),
          authoredBy: actor.userId,
          createdAt: now,
          updatedAt: now,
        };
        state.definitions.unshift(definition);
        state.versions.unshift(version);
        appendAudit(
          state,
          {
            actorUserId: actor.userId,
            actorRole: actor.role,
            action: "form.definition_created",
            entityType: "FormDefinition",
            entityId: definition.id,
            metadata: {
              category,
              branchId: scope.branchId,
              departmentId: scope.departmentId,
            },
          },
          createId,
          now
        );
        return { definition, version };
      });
    },

    async createDraftVersion(
      sessionInput: ServerSession | null | undefined,
      definitionId: string
    ) {
      const session = requireSession(sessionInput);
      const actor = await authorize(session, "forms:write");
      return repository.transaction(state => {
        const definition = requireDefinition(state, definitionId);
        if (!canAccessDefinition(actor, definition)) {
          throw new NileFormsError(
            "Form scope denied.",
            403,
            "form_scope_denied"
          );
        }
        if (definition.currentDraftVersionId) {
          return requireVersion(state, definition.currentDraftVersionId);
        }
        const source = definition.currentPublishedVersionId
          ? requireVersion(state, definition.currentPublishedVersionId)
          : state.versions
              .filter(item => item.definitionId === definition.id)
              .sort(
                (left, right) => right.versionNumber - left.versionNumber
              )[0];
        if (!source) {
          throw new NileFormsError(
            "No source version exists.",
            409,
            "version_missing"
          );
        }
        const now = currentIso();
        const version: FormVersion = {
          id: createId("form_version"),
          definitionId: definition.id,
          versionNumber:
            Math.max(
              0,
              ...state.versions
                .filter(item => item.definitionId === definition.id)
                .map(item => item.versionNumber)
            ) + 1,
          status: "draft",
          revision: 1,
          content: clone(source.content),
          contentHash: source.contentHash,
          authoredBy: actor.userId,
          createdAt: now,
          updatedAt: now,
        };
        state.versions.unshift(version);
        definition.currentDraftVersionId = version.id;
        definition.updatedAt = now;
        return version;
      });
    },

    async updateDraftVersion(
      sessionInput: ServerSession | null | undefined,
      definitionId: string,
      versionId: string,
      input: { expectedRevision: unknown; content: unknown }
    ) {
      const session = requireSession(sessionInput);
      const actor = await authorize(session, "forms:write");
      const expectedRevision = Number(input.expectedRevision);
      const validation = validateFormVersionContent(input.content);
      if (!validation.ok || !validation.content) {
        throw new NileFormsError(
          "The draft contains invalid form fields or logic.",
          400,
          "schema_invalid",
          validation.issues
        );
      }
      const validatedContent = validation.content;

      return repository.transaction(state => {
        const definition = requireDefinition(state, definitionId);
        if (!canAccessDefinition(actor, definition)) {
          throw new NileFormsError(
            "Form scope denied.",
            403,
            "form_scope_denied"
          );
        }
        const version = requireVersion(state, versionId);
        if (
          version.definitionId !== definition.id ||
          version.status !== "draft" ||
          definition.currentDraftVersionId !== version.id
        ) {
          throw new NileFormsError(
            "Only the current draft version can be edited.",
            409,
            "version_immutable"
          );
        }
        if (version.revision !== expectedRevision) {
          throw new NileFormsError(
            "The draft changed in another session. Reload before saving.",
            409,
            "revision_conflict",
            { currentRevision: version.revision }
          );
        }
        const now = currentIso();
        version.content = validatedContent;
        version.contentHash = hashValue(validatedContent);
        version.revision += 1;
        version.updatedAt = now;
        definition.title = validatedContent.title.en;
        definition.updatedAt = now;
        return version;
      });
    },

    async publishVersion(
      sessionInput: ServerSession | null | undefined,
      definitionId: string,
      versionId: string,
      input: Record<string, unknown>
    ) {
      const session = requireSession(sessionInput);
      const actor = await authorize(session, "forms:publish");
      const slug = clean(input.slug, 80).toLowerCase();
      const audience = clean(input.audience, 40) as FormPublication["audience"];
      const opensAt = clean(input.opensAt, 80) || undefined;
      const closesAt = clean(input.closesAt, 80) || undefined;
      const allowMultiple = input.allowMultiple === true;
      const allowDrafts = input.allowDrafts !== false;
      const offlineEligible = input.offlineEligible === true;
      if (
        !slugPattern.test(slug) ||
        !["public", "authenticated", "assigned"].includes(audience)
      ) {
        throw new NileFormsError(
          "A valid slug and audience are required.",
          400,
          "publication_invalid"
        );
      }
      if (opensAt && Number.isNaN(new Date(opensAt).getTime())) {
        throw new NileFormsError(
          "Opening time is invalid.",
          400,
          "publication_invalid"
        );
      }
      if (closesAt && Number.isNaN(new Date(closesAt).getTime())) {
        throw new NileFormsError(
          "Closing time is invalid.",
          400,
          "publication_invalid"
        );
      }
      if (closesAt && new Date(closesAt).getTime() <= nowDate().getTime()) {
        throw new NileFormsError(
          "Closing time must be in the future.",
          400,
          "publication_invalid"
        );
      }
      if (opensAt && closesAt && new Date(closesAt) <= new Date(opensAt)) {
        throw new NileFormsError(
          "Closing time must follow opening time.",
          400,
          "publication_invalid"
        );
      }
      if (offlineEligible && audience !== "assigned") {
        throw new NileFormsError(
          "Offline capture is available only for assigned staff forms.",
          400,
          "offline_not_eligible"
        );
      }

      return repository.transaction(state => {
        const definition = requireDefinition(state, definitionId);
        if (!canAccessDefinition(actor, definition)) {
          throw new NileFormsError(
            "Form scope denied.",
            403,
            "form_scope_denied"
          );
        }
        const version = requireVersion(state, versionId);
        if (
          version.definitionId !== definition.id ||
          version.status !== "draft" ||
          definition.currentDraftVersionId !== version.id
        ) {
          throw new NileFormsError(
            "Only the current draft can be published.",
            409,
            "version_immutable"
          );
        }
        const validation = validateFormVersionContent(version.content);
        if (!validation.ok) {
          throw new NileFormsError(
            "The draft cannot be published until validation issues are fixed.",
            400,
            "schema_invalid",
            validation.issues
          );
        }
        const offline = getOfflineEligibility(version.content);
        if (offlineEligible && !offline.eligible) {
          throw new NileFormsError(
            "Restricted fields make this form ineligible for offline capture.",
            400,
            "offline_not_eligible",
            offline
          );
        }
        const activeSlugPublications = state.publications.filter(
          item => item.slug === slug && item.status !== "retired"
        );
        if (
          activeSlugPublications.some(
            item => item.definitionId !== definition.id
          )
        ) {
          throw new NileFormsError(
            "That publication slug is already in use.",
            409,
            "slug_conflict"
          );
        }
        if (
          activeSlugPublications.length > 0 &&
          opensAt &&
          new Date(opensAt).getTime() > nowDate().getTime()
        ) {
          throw new NileFormsError(
            "A stable slug replacement must open immediately.",
            409,
            "replacement_schedule_invalid"
          );
        }
        const now = currentIso();
        const replacedPublicationIds = activeSlugPublications.map(
          item => item.id
        );
        const carriedAssignments =
          audience === "assigned"
            ? state.assignments.filter(
                assignment =>
                  replacedPublicationIds.includes(assignment.publicationId) &&
                  !assignment.revokedAt &&
                  (!assignment.expiresAt ||
                    new Date(assignment.expiresAt).getTime() >
                      nowDate().getTime())
              )
            : [];
        for (const replaced of activeSlugPublications) {
          replaced.status = "retired";
          replaced.retiredAt = now;
        }
        version.status = "published";
        version.publishedBy = actor.userId;
        version.publishedAt = now;
        version.updatedAt = now;
        definition.currentPublishedVersionId = version.id;
        delete definition.currentDraftVersionId;
        definition.status = "active";
        definition.updatedAt = now;
        const publication: FormPublication = {
          id: createId("form_publication"),
          definitionId: definition.id,
          versionId: version.id,
          slug,
          audience,
          status:
            opensAt && new Date(opensAt).getTime() > nowDate().getTime()
              ? "scheduled"
              : "open",
          opensAt,
          closesAt,
          allowMultiple,
          allowDrafts,
          offlineEligible,
          createdBy: actor.userId,
          createdAt: now,
        };
        state.publications.unshift(publication);
        for (const assignment of carriedAssignments) {
          state.assignments.unshift({
            id: createId("form_assignment"),
            publicationId: publication.id,
            target: clone(assignment.target),
            assignedBy: actor.userId,
            assignedAt: now,
            expiresAt: assignment.expiresAt,
          });
        }
        appendAudit(
          state,
          {
            actorUserId: actor.userId,
            actorRole: actor.role,
            action: "form.published",
            entityType: "FormPublication",
            entityId: publication.id,
            metadata: {
              definitionId,
              versionId,
              audience,
              offlineEligible,
              replacedPublicationIds,
              carriedAssignmentCount: carriedAssignments.length,
            },
          },
          createId,
          now
        );
        return { definition, version, publication };
      });
    },

    async retirePublication(
      sessionInput: ServerSession | null | undefined,
      publicationId: string
    ) {
      const session = requireSession(sessionInput);
      const actor = await authorize(session, "forms:publish");
      return repository.transaction(state => {
        const publication = requirePublication(state, publicationId);
        const definition = requireDefinition(state, publication.definitionId);
        if (!canAccessDefinition(actor, definition)) {
          throw new NileFormsError(
            "Form scope denied.",
            403,
            "form_scope_denied"
          );
        }
        if (publication.status === "retired") return publication;
        const now = currentIso();
        publication.status = "retired";
        publication.retiredAt = now;
        appendAudit(
          state,
          {
            actorUserId: actor.userId,
            actorRole: actor.role,
            action: "form.publication_retired",
            entityType: "FormPublication",
            entityId: publication.id,
            metadata: { definitionId: definition.id },
          },
          createId,
          now
        );
        return publication;
      });
    },

    async assignPublication(
      sessionInput: ServerSession | null | undefined,
      publicationId: string,
      target: FormAssignmentTarget,
      expiresAt?: string
    ) {
      const session = requireSession(sessionInput);
      const actor = await authorize(session, "forms:assign");
      if (
        expiresAt &&
        (Number.isNaN(new Date(expiresAt).getTime()) ||
          new Date(expiresAt).getTime() <= nowDate().getTime())
      ) {
        throw new NileFormsError(
          "Assignment expiry is invalid.",
          400,
          "assignment_invalid"
        );
      }
      return repository.transaction(state => {
        const publication = requirePublication(state, publicationId);
        const definition = requireDefinition(state, publication.definitionId);
        if (!canAccessDefinition(actor, definition)) {
          throw new NileFormsError(
            "Form scope denied.",
            403,
            "form_scope_denied"
          );
        }
        validateAssignmentTarget(
          actor,
          target,
          actor.platformState,
          definition
        );
        if (publication.audience !== "assigned") {
          throw new NileFormsError(
            "Only assigned publications accept assignments.",
            409,
            "assignment_invalid"
          );
        }
        if (
          publication.status === "closed" ||
          publication.status === "retired" ||
          (publication.closesAt &&
            new Date(publication.closesAt).getTime() <= nowDate().getTime())
        ) {
          throw new NileFormsError(
            "This publication no longer accepts assignments.",
            409,
            "publication_unavailable"
          );
        }
        const duplicate = state.assignments.find(
          item =>
            item.publicationId === publicationId &&
            !item.revokedAt &&
            (!item.expiresAt ||
              new Date(item.expiresAt).getTime() > nowDate().getTime()) &&
            canonicalJson(item.target) === canonicalJson(target)
        );
        if (duplicate) return duplicate;
        const now = currentIso();
        const assignment: FormAssignment = {
          id: createId("form_assignment"),
          publicationId,
          target,
          assignedBy: actor.userId,
          assignedAt: now,
          expiresAt,
        };
        state.assignments.unshift(assignment);
        appendAudit(
          state,
          {
            actorUserId: actor.userId,
            actorRole: actor.role,
            action: "form.assigned",
            entityType: "FormAssignment",
            entityId: assignment.id,
            metadata: { publicationId, targetType: target.type },
          },
          createId,
          now
        );
        return assignment;
      });
    },

    async revokeAssignment(
      sessionInput: ServerSession | null | undefined,
      assignmentId: string
    ) {
      const session = requireSession(sessionInput);
      const actor = await authorize(session, "forms:assign");
      return repository.transaction(state => {
        const assignment = state.assignments.find(
          item => item.id === assignmentId
        );
        if (!assignment) {
          throw new NileFormsError(
            "Form assignment not found.",
            404,
            "assignment_not_found"
          );
        }
        const publication = requirePublication(state, assignment.publicationId);
        const definition = requireDefinition(state, publication.definitionId);
        if (!canAccessDefinition(actor, definition)) {
          throw new NileFormsError(
            "Form scope denied.",
            403,
            "form_scope_denied"
          );
        }
        if (assignment.revokedAt) return assignment;
        const now = currentIso();
        assignment.revokedAt = now;
        appendAudit(
          state,
          {
            actorUserId: actor.userId,
            actorRole: actor.role,
            action: "form.assignment_revoked",
            entityType: "FormAssignment",
            entityId: assignment.id,
            metadata: { publicationId: publication.id },
          },
          createId,
          now
        );
        return assignment;
      });
    },

    async listAssigned(sessionInput: ServerSession | null | undefined) {
      const session = requireSession(sessionInput);
      const actor = await authorize(session, "forms:read");
      const state = await repository.read();
      const now = nowDate();
      return state.publications
        .filter(item => publicationAvailableToActor(state, item, actor, now))
        .flatMap(publication => {
          const definition = state.definitions.find(
            item => item.id === publication.definitionId
          );
          const version = state.versions.find(
            item => item.id === publication.versionId
          );
          if (!definition || !version) return [];
          const previousSubmissions = previousSubmissionsFor(
            state,
            publication.id,
            actor.userId
          );
          return [
            {
              definition,
              publication,
              version,
              previousSubmissions,
              entityOptions: entityOptionsForContent(
                version.content,
                actor,
                definition
              ),
            },
          ];
        });
    },

    async getAssignedForm(
      sessionInput: ServerSession | null | undefined,
      publicationId: string
    ): Promise<FormResponderBundle> {
      const session = requireSession(sessionInput);
      const actor = await authorize(session, "forms:read");
      const state = await repository.read();
      const publication = requirePublication(state, publicationId);
      if (!publicationAvailableToActor(state, publication, actor, nowDate())) {
        throw new NileFormsError(
          "This form is not assigned to the active session.",
          403,
          "assignment_denied"
        );
      }
      const definition = requireDefinition(state, publication.definitionId);
      const version = requireVersion(state, publication.versionId);
      const previousSubmissions = previousSubmissionsFor(
        state,
        publication.id,
        actor.userId
      );
      const activeSubmission = previousSubmissions.find(
        item => item.status !== "withdrawn"
      );
      if (!publication.allowMultiple && activeSubmission) {
        throw new NileFormsError(
          "A response has already been submitted for this form.",
          409,
          "response_limit_reached",
          { submissionId: activeSubmission.id }
        );
      }
      return {
        definition,
        publication,
        version,
        previousSubmissions,
        entityOptions: entityOptionsForContent(
          version.content,
          actor,
          definition
        ),
      };
    },

    async enrollOfflineDevice(
      sessionInput: ServerSession | null | undefined,
      labelInput: unknown
    ) {
      const session = requireSession(sessionInput);
      const actor = await authorizeOffline(session);
      const label = clean(labelInput, 80);
      if (label.length < 2) {
        throw new NileFormsError(
          "A device label is required.",
          400,
          "offline_device_label_invalid"
        );
      }
      const deviceToken = crypto.randomBytes(32).toString("base64url");
      const now = currentIso();
      const expiresAt = new Date(
        nowDate().getTime() + 72 * 60 * 60 * 1_000
      ).toISOString();
      const device = await repository.transaction(state => {
        const row: FormOfflineDevice = {
          id: createId("form_offline_device"),
          userId: actor.userId,
          label,
          publicKey: hashDraftToken(deviceToken),
          enrolledAt: now,
          expiresAt,
        };
        state.offlineDevices.unshift(row);
        appendAudit(
          state,
          {
            actorUserId: actor.userId,
            actorRole: actor.role,
            action: "form.offline_device_enrolled",
            entityType: "FormOfflineDevice",
            entityId: row.id,
            metadata: { expiresAt },
          },
          createId,
          now
        );
        return row;
      });
      return {
        device: {
          id: device.id,
          label: device.label,
          enrolledAt: device.enrolledAt,
          expiresAt: device.expiresAt,
        },
        deviceToken,
      };
    },

    async revokeOfflineDevice(
      sessionInput: ServerSession | null | undefined,
      deviceIdInput: unknown
    ) {
      const session = requireSession(sessionInput);
      const actor = await authorizeOffline(session);
      const deviceId = clean(deviceIdInput, 128);
      return repository.transaction(state => {
        const device = state.offlineDevices.find(item => item.id === deviceId);
        if (!device || device.userId !== actor.userId) {
          throw new NileFormsError(
            "Offline device not found.",
            404,
            "offline_device_not_found"
          );
        }
        if (!device.revokedAt) {
          const now = currentIso();
          device.revokedAt = now;
          appendAudit(
            state,
            {
              actorUserId: actor.userId,
              actorRole: actor.role,
              action: "form.offline_device_revoked",
              entityType: "FormOfflineDevice",
              entityId: device.id,
              metadata: {},
            },
            createId,
            now
          );
        }
        return {
          id: device.id,
          revokedAt: device.revokedAt,
        };
      });
    },

    async getOfflineBundle(
      sessionInput: ServerSession | null | undefined,
      deviceIdInput: unknown,
      deviceTokenInput: unknown
    ): Promise<FormOfflineBundle> {
      const session = requireSession(sessionInput);
      const actor = await authorizeOffline(session);
      const deviceId = clean(deviceIdInput, 128);
      const deviceToken = clean(deviceTokenInput, 256);
      return repository.transaction(state => {
        const nowDateValue = nowDate();
        const device = requireOfflineDevice(
          state,
          actor,
          deviceId,
          deviceToken,
          nowDateValue
        );
        const forms = state.publications.flatMap(publication => {
          if (
            publication.audience !== "assigned" ||
            !publication.offlineEligible ||
            !publicationAvailableToActor(
              state,
              publication,
              actor,
              nowDateValue
            )
          ) {
            return [];
          }
          const definition = state.definitions.find(
            item => item.id === publication.definitionId
          );
          const version = state.versions.find(
            item => item.id === publication.versionId
          );
          if (!definition || !version || version.status !== "published") {
            return [];
          }
          if (!getOfflineEligibility(version.content).eligible) return [];
          return [
            {
              definition,
              publication,
              version,
              previousSubmissions: previousSubmissionsFor(
                state,
                publication.id,
                actor.userId
              ),
              entityOptions: entityOptionsForContent(
                version.content,
                actor,
                definition
              ),
            },
          ];
        });
        const generatedAt = nowDateValue.toISOString();
        const expiresAt = new Date(
          Math.min(
            new Date(device.expiresAt).getTime(),
            nowDateValue.getTime() + 72 * 60 * 60 * 1_000
          )
        ).toISOString();
        appendAudit(
          state,
          {
            actorUserId: actor.userId,
            actorRole: actor.role,
            action: "form.offline_bundle_downloaded",
            entityType: "FormOfflineDevice",
            entityId: device.id,
            metadata: {
              publicationIds: forms.map(item => item.publication.id),
              expiresAt,
            },
          },
          createId,
          generatedAt
        );
        return {
          device: {
            id: device.id,
            label: device.label,
            enrolledAt: device.enrolledAt,
            expiresAt: device.expiresAt,
          },
          generatedAt,
          expiresAt,
          forms,
        };
      });
    },

    async syncOfflineBatch(
      sessionInput: ServerSession | null | undefined,
      deviceIdInput: unknown,
      deviceTokenInput: unknown,
      itemsInput: unknown
    ): Promise<FormOfflineSyncResult> {
      const session = requireSession(sessionInput);
      const actor = await authorizeOffline(session);
      const deviceId = clean(deviceIdInput, 128);
      const deviceToken = clean(deviceTokenInput, 256);
      if (!Array.isArray(itemsInput) || itemsInput.length > 50) {
        throw new NileFormsError(
          "Offline sync accepts up to 50 submissions per batch.",
          400,
          "offline_sync_invalid"
        );
      }

      return repository.transaction(state => {
        const nowDateValue = nowDate();
        const now = nowDateValue.toISOString();
        const device = requireOfflineDevice(
          state,
          actor,
          deviceId,
          deviceToken,
          nowDateValue
        );
        const receipts: FormSyncReceipt[] = [];

        const recordReceipt = (
          clientSubmissionId: string,
          status: FormSyncReceipt["status"],
          reason?: string,
          submissionId?: string
        ) => {
          const receipt: FormSyncReceipt = {
            id: createId("form_sync_receipt"),
            deviceId: device.id,
            clientSubmissionId,
            submissionId,
            status,
            reason,
            receivedAt: now,
          };
          state.syncReceipts.unshift(receipt);
          appendAudit(
            state,
            {
              actorUserId: actor.userId,
              actorRole: actor.role,
              action: `form.offline_sync_${status}`,
              entityType: "FormSyncReceipt",
              entityId: receipt.id,
              metadata: { clientSubmissionId, submissionId, reason },
            },
            createId,
            now
          );
          receipts.push(receipt);
          return receipt;
        };

        itemsInput.forEach((rawItem, index) => {
          if (
            !rawItem ||
            typeof rawItem !== "object" ||
            Array.isArray(rawItem)
          ) {
            recordReceipt(
              `invalid-${index + 1}`,
              "rejected",
              "payload_invalid"
            );
            return;
          }
          const item = rawItem as Partial<FormOfflineSyncItem>;
          const publicationId = clean(item.publicationId, 128);
          const versionId = clean(item.versionId, 128);
          const clientSubmissionId = clean(item.clientSubmissionId, 128);
          const clientSubmittedAt = clean(item.clientSubmittedAt, 80);
          if (!clientSubmissionIdPattern.test(clientSubmissionId)) {
            recordReceipt(
              clientSubmissionId || `invalid-${index + 1}`,
              "rejected",
              "client_submission_id_invalid"
            );
            return;
          }
          const priorReceipt = state.syncReceipts.find(
            receipt =>
              receipt.deviceId === device.id &&
              receipt.clientSubmissionId === clientSubmissionId
          );
          if (priorReceipt) {
            receipts.push(priorReceipt);
            return;
          }
          if (
            !clientSubmittedAt ||
            Number.isNaN(new Date(clientSubmittedAt).getTime())
          ) {
            recordReceipt(
              clientSubmissionId,
              "rejected",
              "client_time_invalid"
            );
            return;
          }
          const publication = state.publications.find(
            value => value.id === publicationId
          );
          const version = state.versions.find(value => value.id === versionId);
          const definition = publication
            ? state.definitions.find(
                value => value.id === publication.definitionId
              )
            : undefined;
          if (!publication || !version || !definition) {
            recordReceipt(
              clientSubmissionId,
              "rejected",
              "form_version_unknown"
            );
            return;
          }
          const replay = state.submissions.find(
            value =>
              value.publicationId === publication.id &&
              value.clientSubmissionId === clientSubmissionId
          );
          if (replay) {
            if (replay.respondentUserId !== actor.userId) {
              recordReceipt(
                clientSubmissionId,
                "rejected",
                "idempotency_conflict"
              );
              return;
            }
            recordReceipt(
              clientSubmissionId,
              "duplicate",
              "already_synced",
              replay.id
            );
            return;
          }
          const normalized = normalizeAndValidateFormAnswers(
            version.content,
            item.answers
          );
          const entityErrors = entityReferenceErrors(
            version.content,
            normalized.answers,
            entityOptionsForContent(version.content, actor, definition)
          );
          if (!normalized.ok || entityErrors.length) {
            recordReceipt(clientSubmissionId, "rejected", "answers_invalid");
            return;
          }

          let quarantineReason = "";
          if (
            item.respondentUserId &&
            clean(item.respondentUserId, 128) !== actor.userId
          ) {
            quarantineReason = "respondent_identity_changed";
          } else if (
            publication.versionId !== version.id ||
            version.status !== "published"
          ) {
            quarantineReason = "form_version_expired";
          } else if (!publication.offlineEligible) {
            quarantineReason = "offline_capture_disabled";
          } else if (!getOfflineEligibility(version.content).eligible) {
            quarantineReason = "restricted_fields_present";
          } else if (
            !publicationAvailableToActor(
              state,
              publication,
              actor,
              nowDateValue
            )
          ) {
            quarantineReason = "assignment_or_scope_changed";
          } else if (
            !publication.allowMultiple &&
            state.submissions.some(
              value =>
                value.publicationId === publication.id &&
                value.respondentUserId === actor.userId &&
                value.status !== "withdrawn"
            )
          ) {
            quarantineReason = "assignment_already_completed";
          }

          const assignment = matchingAssignment(
            state,
            publication.id,
            actor,
            nowDateValue
          );
          const scope = submissionScopeFromAnswers(
            definition,
            version.content,
            normalized.answers,
            actor
          );
          const submission: FormSubmission = {
            id: createId("form_submission"),
            definitionId: definition.id,
            publicationId: publication.id,
            versionId: version.id,
            assignmentId: quarantineReason ? undefined : assignment?.id,
            respondentUserId: actor.userId,
            respondentRole: actor.role,
            branchId: scope.branchId,
            departmentId: scope.departmentId,
            source: "offline",
            answers: normalized.answers,
            status: quarantineReason ? "quarantined" : "submitted",
            revision: 1,
            clientSubmissionId,
            clientSubmittedAt,
            submittedAt: now,
            updatedAt: now,
          };
          state.submissions.unshift(submission);
          appendAudit(
            state,
            {
              actorUserId: actor.userId,
              actorRole: actor.role,
              action: quarantineReason
                ? "form.offline_quarantined"
                : "form.submitted",
              entityType: "FormSubmission",
              entityId: submission.id,
              metadata: {
                definitionId: definition.id,
                publicationId: publication.id,
                versionId: version.id,
                source: "offline",
                reason: quarantineReason || undefined,
              },
            },
            createId,
            now
          );
          if (!quarantineReason) {
            appendOutbox(
              state,
              "form.submitted",
              submission.id,
              {
                definitionId: definition.id,
                publicationId: publication.id,
                versionId: version.id,
                status: submission.status,
                source: "offline",
              },
              createId,
              now
            );
          }
          recordReceipt(
            clientSubmissionId,
            quarantineReason ? "quarantined" : "accepted",
            quarantineReason || undefined,
            submission.id
          );
        });

        return { receipts };
      });
    },

    async getOwnSubmission(
      sessionInput: ServerSession | null | undefined,
      publicationId: string,
      submissionId: string
    ): Promise<FormResponderSubmissionDetail> {
      const session = requireSession(sessionInput);
      const actor = await authorize(session, "forms:read");
      const state = await repository.read();
      const publication = requirePublication(state, publicationId);
      const submission = state.submissions.find(
        item => item.id === submissionId
      );
      if (!submission || submission.publicationId !== publication.id) {
        throw new NileFormsError(
          "Response not found.",
          404,
          "submission_not_found"
        );
      }
      if (submission.respondentUserId !== actor.userId) {
        throw new NileFormsError(
          "Response ownership denied.",
          403,
          "ownership_denied"
        );
      }
      const definition = requireDefinition(state, publication.definitionId);
      const version = requireVersion(state, submission.versionId);
      return {
        definition,
        publication,
        version,
        submission: projectSubmissionForCompatibilityReader(state, submission),
        reviews: state.reviews
          .filter(item => item.submissionId === submission.id)
          .map(({ id, decision, comments, createdAt }) => ({
            id,
            decision,
            comments,
            createdAt,
          })),
        entityOptions: entityOptionsForContent(
          version.content,
          actor,
          definition
        ),
      };
    },

    async getPublicForm(slug: string): Promise<FormResponderBundle> {
      requireCompatibilityRuntime();
      const state = await repository.read();
      const authorityState = await readAuthorityState();
      const publication = state.publications.find(
        item => item.slug === slug.toLowerCase() && item.audience === "public"
      );
      if (!publication || !publicationIsOpen(publication, nowDate())) {
        throw new NileFormsError(
          "Public form not found.",
          404,
          "public_form_not_found"
        );
      }
      const definition = requireDefinition(state, publication.definitionId);
      const version = requireVersion(state, publication.versionId);
      return {
        definition,
        publication,
        version,
        previousSubmissions: [],
        entityOptions: entityOptionsForContent(
          version.content,
          null,
          definition,
          authorityState
        ),
      };
    },

    async saveDraft(input: {
      publicationId: string;
      answers: unknown;
      expectedRevision?: unknown;
      draftToken?: string;
      session?: ServerSession | null;
    }) {
      requireCompatibilityRuntime(input.session);
      const session = input.session ?? null;
      const actor = session ? await authorize(session, "forms:respond") : null;
      const authorityState =
        actor?.platformState ?? (await readAuthorityState());
      const draftKey = resolveDraftKey(dependencies.draftKey);
      return repository.transaction(state => {
        const publication = requirePublication(state, input.publicationId);
        if (
          !publication.allowDrafts ||
          !publicationIsOpen(publication, nowDate())
        ) {
          throw new NileFormsError(
            "Draft saving is not available for this publication.",
            409,
            "draft_not_available"
          );
        }
        if (!session && publication.audience !== "public") {
          throw new NileFormsError(
            "Sign in required.",
            401,
            "sign_in_required"
          );
        }
        if (
          actor &&
          publication.audience !== "public" &&
          !publicationAvailableToActor(state, publication, actor, nowDate())
        ) {
          throw new NileFormsError(
            "This form is not assigned to the active session.",
            403,
            "assignment_denied"
          );
        }
        const assignment =
          actor && publication.audience === "assigned"
            ? matchingAssignment(state, publication.id, actor, nowDate())
            : undefined;
        const definition = requireDefinition(state, publication.definitionId);
        const version = requireVersion(state, publication.versionId);
        const sanitized = normalizeAndValidateFormAnswers(
          version.content,
          input.answers
        );
        const entityErrors = entityReferenceErrors(
          version.content,
          sanitized.answers,
          entityOptionsForContent(
            version.content,
            publication.audience === "public" ? null : actor,
            definition,
            authorityState
          )
        );
        const expectedRevision =
          input.expectedRevision === undefined
            ? undefined
            : Number(input.expectedRevision);
        const suppliedHash = input.draftToken
          ? hashDraftToken(input.draftToken)
          : undefined;
        let draft = state.drafts.find(item => {
          if (item.publicationId !== publication.id) return false;
          if (actor) return item.respondentUserId === actor.userId;
          return suppliedHash && item.guestTokenHash === suppliedHash;
        });
        if (input.draftToken && !draft) {
          throw new NileFormsError(
            "Draft token is invalid or expired.",
            403,
            "draft_denied"
          );
        }
        if (draft?.assignmentId && draft.assignmentId !== assignment?.id) {
          throw new NileFormsError(
            "The assignment used by this draft is no longer active.",
            403,
            "assignment_denied"
          );
        }
        if (draft && expectedRevision === undefined) {
          throw new NileFormsError(
            "Reload the saved draft before updating it.",
            409,
            "revision_required",
            { currentRevision: draft.revision }
          );
        }
        if (
          draft &&
          expectedRevision !== undefined &&
          draft.revision !== expectedRevision
        ) {
          throw new NileFormsError(
            "The draft changed in another session. Reload before saving.",
            409,
            "revision_conflict",
            { currentRevision: draft.revision }
          );
        }
        const now = currentIso();
        const defaultExpiry = new Date(
          nowDate().getTime() + 30 * 24 * 60 * 60 * 1000
        );
        const publicationExpiry = publication.closesAt
          ? new Date(publication.closesAt)
          : null;
        const expiresAt =
          publicationExpiry && publicationExpiry < defaultExpiry
            ? publicationExpiry.toISOString()
            : defaultExpiry.toISOString();
        let draftToken: string | undefined;
        if (!draft) {
          draftToken = actor
            ? undefined
            : crypto.randomBytes(32).toString("base64url");
          draft = {
            id: createId("form_draft"),
            publicationId: publication.id,
            versionId: version.id,
            assignmentId: assignment?.id,
            respondentUserId: actor?.userId,
            guestTokenHash: draftToken ? hashDraftToken(draftToken) : undefined,
            encryptedPayload: encryptDraft(sanitized.answers, draftKey),
            revision: 1,
            expiresAt,
            updatedAt: now,
          };
          state.drafts.unshift(draft);
        } else {
          draft.encryptedPayload = encryptDraft(sanitized.answers, draftKey);
          draft.revision += 1;
          draft.expiresAt = expiresAt;
          draft.updatedAt = now;
        }
        return {
          draftId: draft.id,
          revision: draft.revision,
          expiresAt: draft.expiresAt,
          draftToken,
          answers: sanitized.answers,
          validationErrors: mergeAnswerValidationErrors(
            sanitized.errors,
            entityErrors
          ),
        };
      });
    },

    async loadDraft(input: {
      publicationId: string;
      draftToken?: string;
      session?: ServerSession | null;
    }) {
      requireCompatibilityRuntime(input.session);
      const session = input.session ?? null;
      const actor = session ? await authorize(session, "forms:respond") : null;
      const state = await repository.read();
      const publication = requirePublication(state, input.publicationId);
      if (!session) {
        if (publication.audience !== "public") {
          throw new NileFormsError(
            "Sign in required.",
            401,
            "sign_in_required"
          );
        }
        if (!publicationIsOpen(publication, nowDate())) {
          throw new NileFormsError(
            "This form is not accepting responses.",
            409,
            "form_closed"
          );
        }
      } else if (
        publication.audience !== "public" &&
        !publicationAvailableToActor(state, publication, actor!, nowDate())
      ) {
        throw new NileFormsError(
          "This form is not assigned to the active session.",
          403,
          "assignment_denied"
        );
      }
      const tokenHash = input.draftToken
        ? hashDraftToken(input.draftToken)
        : undefined;
      const draft = state.drafts.find(item => {
        if (item.publicationId !== publication.id) return false;
        return actor
          ? item.respondentUserId === actor.userId
          : tokenHash !== undefined && item.guestTokenHash === tokenHash;
      });
      if (
        !draft ||
        new Date(draft.expiresAt).getTime() <= nowDate().getTime()
      ) {
        throw new NileFormsError(
          "Draft not found or expired.",
          404,
          "draft_not_found"
        );
      }
      if (draft.assignmentId && actor) {
        const assignment = state.assignments.find(
          item => item.id === draft.assignmentId
        );
        if (!assignment || !assignmentMatches(assignment, actor, nowDate())) {
          throw new NileFormsError(
            "The assignment used by this draft is no longer active.",
            403,
            "assignment_denied"
          );
        }
      }
      return {
        draftId: draft.id,
        revision: draft.revision,
        expiresAt: draft.expiresAt,
        answers: decryptDraft(
          draft.encryptedPayload,
          resolveDraftKey(dependencies.draftKey)
        ),
      };
    },

    async submit(input: {
      publicationId: string;
      answers: unknown;
      clientSubmissionId: unknown;
      clientSubmittedAt?: unknown;
      draftToken?: string;
      session?: ServerSession | null;
    }) {
      requireCompatibilityRuntime(input.session);
      const session = input.session ?? null;
      const actor = session ? await authorize(session, "forms:respond") : null;
      const authorityState =
        actor?.platformState ?? (await readAuthorityState());
      const clientSubmissionId = clean(input.clientSubmissionId, 128);
      if (!clientSubmissionIdPattern.test(clientSubmissionId)) {
        throw new NileFormsError(
          "A valid client submission ID is required.",
          400,
          "submission_id_invalid"
        );
      }
      const clientSubmittedAt = clean(input.clientSubmittedAt, 80) || undefined;
      if (
        clientSubmittedAt &&
        Number.isNaN(new Date(clientSubmittedAt).getTime())
      ) {
        throw new NileFormsError(
          "Client submission time is invalid.",
          400,
          "submission_invalid"
        );
      }

      return repository.transaction(state => {
        const publication = requirePublication(state, input.publicationId);
        const definition = requireDefinition(state, publication.definitionId);
        const version = requireVersion(state, publication.versionId);
        const normalized = normalizeAndValidateFormAnswers(
          version.content,
          input.answers
        );
        const entityErrors = entityReferenceErrors(
          version.content,
          normalized.answers,
          entityOptionsForContent(
            version.content,
            publication.audience === "public" ? null : actor,
            definition,
            authorityState
          )
        );
        if (!normalized.ok || entityErrors.length) {
          throw new NileFormsError(
            "Please correct the highlighted fields.",
            400,
            "answers_invalid",
            mergeAnswerValidationErrors(normalized.errors, entityErrors)
          );
        }
        const replay = state.submissions.find(
          item =>
            item.publicationId === publication.id &&
            item.clientSubmissionId === clientSubmissionId
        );
        if (replay) {
          const samePrincipal = actor
            ? replay.respondentUserId === actor.userId
            : !replay.respondentUserId;
          if (
            !samePrincipal ||
            hashValue(replay.answers) !== hashValue(normalized.answers)
          ) {
            throw new NileFormsError(
              "That client submission ID is already bound to another request.",
              409,
              "idempotency_conflict"
            );
          }
          return { submission: replay, replayed: true };
        }
        if (!publicationIsOpen(publication, nowDate())) {
          throw new NileFormsError(
            "This form is not accepting responses.",
            409,
            "form_closed"
          );
        }
        if (!actor && publication.audience !== "public") {
          throw new NileFormsError(
            "Sign in required.",
            401,
            "sign_in_required"
          );
        }
        if (
          actor &&
          publication.audience !== "public" &&
          !publicationAvailableToActor(state, publication, actor, nowDate())
        ) {
          throw new NileFormsError(
            "This form is not assigned to the active session.",
            403,
            "assignment_denied"
          );
        }
        if (
          actor &&
          !publication.allowMultiple &&
          state.submissions.some(
            item =>
              item.publicationId === publication.id &&
              item.respondentUserId === actor.userId &&
              item.status !== "withdrawn"
          )
        ) {
          throw new NileFormsError(
            "A response has already been submitted for this form.",
            409,
            "response_limit_reached"
          );
        }
        const assignment =
          actor && publication.audience === "assigned"
            ? matchingAssignment(state, publication.id, actor, nowDate())
            : undefined;
        const scope = submissionScopeFromAnswers(
          definition,
          version.content,
          normalized.answers,
          actor
        );
        const now = currentIso();
        const submission: FormSubmission = {
          id: createId("form_submission"),
          definitionId: definition.id,
          publicationId: publication.id,
          versionId: version.id,
          assignmentId: assignment?.id,
          respondentUserId: actor?.userId,
          respondentRole: actor?.role,
          branchId: scope.branchId,
          departmentId: scope.departmentId,
          source: "web",
          answers: normalized.answers,
          status: "submitted",
          revision: 1,
          clientSubmissionId,
          clientSubmittedAt,
          submittedAt: now,
          updatedAt: now,
        };
        state.submissions.unshift(submission);
        if (actor) {
          state.drafts = state.drafts.filter(
            item =>
              !(
                item.publicationId === publication.id &&
                item.respondentUserId === actor.userId
              )
          );
        } else if (input.draftToken) {
          const tokenHash = hashDraftToken(input.draftToken);
          state.drafts = state.drafts.filter(
            item =>
              !(
                item.publicationId === publication.id &&
                item.guestTokenHash === tokenHash
              )
          );
        }
        appendAudit(
          state,
          {
            actorUserId: actor?.userId ?? "public",
            actorRole: actor?.role ?? "public",
            action: "form.submitted",
            entityType: "FormSubmission",
            entityId: submission.id,
            metadata: {
              definitionId: definition.id,
              publicationId: publication.id,
              versionId: version.id,
              source: submission.source,
            },
          },
          createId,
          now
        );
        appendOutbox(
          state,
          "form.submitted",
          submission.id,
          {
            definitionId: definition.id,
            publicationId: publication.id,
            versionId: version.id,
            status: submission.status,
          },
          createId,
          now
        );
        return { submission, replayed: false };
      });
    },

    async withdrawSubmission(
      sessionInput: ServerSession | null | undefined,
      submissionId: string,
      expectedRevision: unknown
    ) {
      const session = requireSession(sessionInput);
      const actor = await authorize(session, "forms:respond");
      return repository.transaction(state => {
        const submission = state.submissions.find(
          item => item.id === submissionId
        );
        if (!submission) {
          throw new NileFormsError(
            "Submission not found.",
            404,
            "submission_not_found"
          );
        }
        if (submission.respondentUserId !== actor.userId) {
          throw new NileFormsError(
            "Submission ownership denied.",
            403,
            "ownership_denied"
          );
        }
        if (submission.status !== "submitted") {
          throw new NileFormsError(
            "A submission can be withdrawn only before review starts.",
            409,
            "withdrawal_not_allowed"
          );
        }
        if (submission.revision !== Number(expectedRevision)) {
          throw new NileFormsError(
            "The submission changed. Reload before withdrawing.",
            409,
            "revision_conflict"
          );
        }
        const now = currentIso();
        submission.status = "withdrawn";
        submission.revision += 1;
        submission.updatedAt = now;
        appendAudit(
          state,
          {
            actorUserId: actor.userId,
            actorRole: actor.role,
            action: "form.submission_withdrawn",
            entityType: "FormSubmission",
            entityId: submission.id,
            metadata: { publicationId: submission.publicationId },
          },
          createId,
          now
        );
        return submission;
      });
    },

    async listSubmissions(sessionInput: ServerSession | null | undefined) {
      const session = requireSession(sessionInput);
      const actor = await authorize(session, "form_submissions:read");
      const state = await repository.read();
      return state.submissions
        .filter(submission => {
          const definition = state.definitions.find(
            item => item.id === submission.definitionId
          );
          return definition
            ? canReviewSubmission(actor, definition, submission)
            : false;
        })
        .map(submission => ({
          submission: projectSubmissionForCompatibilityReader(
            state,
            submission
          ),
          definition: requireDefinition(state, submission.definitionId),
          publication: requirePublication(state, submission.publicationId),
        }))
        .sort((left, right) =>
          right.submission.submittedAt.localeCompare(
            left.submission.submittedAt
          )
        );
    },

    async getSubmission(
      sessionInput: ServerSession | null | undefined,
      submissionId: string
    ) {
      const session = requireSession(sessionInput);
      const actor = await authorize(session, "form_submissions:read");
      const state = await repository.read();
      const submission = state.submissions.find(
        item => item.id === submissionId
      );
      if (!submission) {
        throw new NileFormsError(
          "Submission not found.",
          404,
          "submission_not_found"
        );
      }
      const definition = requireDefinition(state, submission.definitionId);
      if (!canReviewSubmission(actor, definition, submission)) {
        throw new NileFormsError(
          "Submission scope denied.",
          403,
          "submission_scope_denied"
        );
      }
      return {
        submission: projectSubmissionForCompatibilityReader(state, submission),
        definition,
        publication: requirePublication(state, submission.publicationId),
        version: requireVersion(state, submission.versionId),
        reviews: state.reviews.filter(
          item => item.submissionId === submission.id
        ),
        promotions: state.promotions.filter(
          item => item.submissionId === submission.id
        ),
        auditEvents: state.auditEvents.filter(
          item =>
            item.entityId === submission.id ||
            item.metadata.submissionId === submission.id
        ),
      };
    },

    async reviewSubmission(
      sessionInput: ServerSession | null | undefined,
      submissionId: string,
      input: Record<string, unknown>
    ) {
      const session = requireSession(sessionInput);
      const actor = await authorize(session, "form_submissions:review");
      const decision = clean(input.decision, 40) as FormReview["decision"];
      const comments = clean(input.comments, 4_000) || undefined;
      const expectedRevision = Number(input.expectedRevision);
      if (!["under_review", "accepted", "rejected"].includes(decision)) {
        throw new NileFormsError(
          "Choose a valid review decision.",
          400,
          "review_invalid"
        );
      }
      if (decision === "rejected" && (!comments || comments.length < 5)) {
        throw new NileFormsError(
          "A rejection reason of at least five characters is required.",
          400,
          "review_invalid"
        );
      }
      return repository.transaction(state => {
        const submission = state.submissions.find(
          item => item.id === submissionId
        );
        if (!submission) {
          throw new NileFormsError(
            "Submission not found.",
            404,
            "submission_not_found"
          );
        }
        const definition = requireDefinition(state, submission.definitionId);
        if (!canReviewSubmission(actor, definition, submission)) {
          throw new NileFormsError(
            "Submission scope denied.",
            403,
            "submission_scope_denied"
          );
        }
        const replay = state.reviews.find(
          item =>
            item.submissionId === submission.id &&
            item.reviewerUserId === actor.userId &&
            item.decision === decision &&
            item.expectedSubmissionRevision === expectedRevision &&
            (item.comments ?? "") === (comments ?? "")
        );
        if (replay) return { submission, review: replay, replayed: true };
        if (submission.revision !== expectedRevision) {
          throw new NileFormsError(
            "The submission changed in another review session.",
            409,
            "revision_conflict",
            { currentRevision: submission.revision }
          );
        }
        if (
          (decision === "under_review" && submission.status !== "submitted") ||
          (["accepted", "rejected"].includes(decision) &&
            submission.status !== "under_review")
        ) {
          throw new NileFormsError(
            "The review decision is not valid for the current submission state.",
            409,
            "review_transition_invalid"
          );
        }
        const now = currentIso();
        const review: FormReview = {
          id: createId("form_review"),
          submissionId: submission.id,
          reviewerUserId: actor.userId,
          decision,
          comments,
          expectedSubmissionRevision: expectedRevision,
          createdAt: now,
        };
        state.reviews.unshift(review);
        submission.status = decision;
        submission.revision += 1;
        submission.updatedAt = now;
        appendAudit(
          state,
          {
            actorUserId: actor.userId,
            actorRole: actor.role,
            action: `form.${decision}`,
            entityType: "FormSubmission",
            entityId: submission.id,
            metadata: { reviewId: review.id, definitionId: definition.id },
          },
          createId,
          now
        );
        appendOutbox(
          state,
          "form.reviewed",
          submission.id,
          {
            definitionId: definition.id,
            status: submission.status,
            reviewId: review.id,
          },
          createId,
          now
        );
        return { submission, review, replayed: false };
      });
    },

    async exportSubmissions(sessionInput: ServerSession | null | undefined) {
      const session = requireSession(sessionInput);
      const actor = await authorize(session, "form_submissions:export");
      return repository.transaction(state => {
        const rows = state.submissions.filter(submission => {
          const definition = state.definitions.find(
            item => item.id === submission.definitionId
          );
          return definition
            ? canReviewSubmission(actor, definition, submission)
            : false;
        });
        const reportableByVersion = new Map(
          rows.map(submission => {
            const version = requireVersion(state, submission.versionId);
            return [
              version.id,
              new Set(
                projectableNileFormFieldIds(version.content, "export", false)
              ),
            ] as const;
          })
        );
        const reportableFieldIds = new Set(
          Array.from(reportableByVersion.values()).flatMap(fieldIds =>
            Array.from(fieldIds)
          )
        );
        const fieldIds = Array.from(reportableFieldIds).sort();
        const header = [
          "submission_id",
          "form_key",
          "status",
          "source",
          "submitted_at",
          ...fieldIds,
        ];
        const body = rows.map(submission => {
          const definition = requireDefinition(state, submission.definitionId);
          const version = requireVersion(state, submission.versionId);
          const projectedAnswers = projectNileFormAnswers(
            version.content,
            submission.answers,
            { mode: "export", canReadSensitive: false }
          );
          return [
            submission.id,
            definition.key,
            submission.status,
            submission.source,
            submission.submittedAt,
            ...fieldIds.map(fieldId =>
              reportableByVersion.get(submission.versionId)?.has(fieldId)
                ? projectedAnswers[fieldId]
                : ""
            ),
          ];
        });
        const now = currentIso();
        const exportId = createId("form_export");
        const csv = [header, ...body]
          .map(row => row.map(csvCell).join(","))
          .join("\n");
        const digest = crypto.createHash("sha256").update(csv).digest("hex");
        appendAudit(
          state,
          {
            actorUserId: actor.userId,
            actorRole: actor.role,
            action: "form.submissions_exported",
            entityType: "FormExport",
            entityId: exportId,
            metadata: {
              rowCount: rows.length,
              fieldCount: fieldIds.length,
              submissionIds: rows.map(item => item.id),
              versionIds: unique(rows.map(item => item.versionId)),
              branchIds: actor.branchIds,
              departmentIds: actor.departmentIds,
              sha256: digest,
            },
          },
          createId,
          now
        );
        return {
          exportId,
          filename: `nile-forms-${now.slice(0, 10)}.csv`,
          csv,
          sha256: digest,
          rowCount: rows.length,
        };
      });
    },

    async promoteSubmission(
      sessionInput: ServerSession | null | undefined,
      submissionId: string,
      input: Record<string, unknown>
    ) {
      const session = requireSession(sessionInput);
      const actor = await authorize(session, "form_submissions:review");
      const expectedRevision = Number(input.expectedRevision);
      const idempotencyKey = clean(input.idempotencyKey, 160);
      if (!clientSubmissionIdPattern.test(idempotencyKey)) {
        throw new NileFormsError(
          "A valid promotion idempotency key is required.",
          400,
          "promotion_invalid"
        );
      }

      return repository.transaction(async state => {
        const submission = state.submissions.find(
          item => item.id === submissionId
        );
        if (!submission) {
          throw new NileFormsError(
            "Submission not found.",
            404,
            "submission_not_found"
          );
        }
        const definition = requireDefinition(state, submission.definitionId);
        if (!canReviewSubmission(actor, definition, submission)) {
          throw new NileFormsError(
            "Submission scope denied.",
            403,
            "submission_scope_denied"
          );
        }
        const adapterByKey: Partial<Record<string, FormPromotion["adapter"]>> =
          {
            public_enquiry: "lead.create",
            application_intake: "application.create",
            placement_request: "placement.create",
            student_support: "support_ticket.create",
            attendance_exception: "attendance_exception.create",
          };
        const adapter = adapterByKey[definition.key];
        if (!adapter) {
          throw new NileFormsError(
            "This form is retained as evidence and has no promotion adapter.",
            409,
            "promotion_not_supported"
          );
        }

        let promotion = state.promotions.find(
          item =>
            item.submissionId === submission.id && item.adapter === adapter
        );
        if (promotion?.status === "succeeded") return promotion;
        if (promotion && promotion.idempotencyKey === idempotencyKey) {
          return promotion;
        }
        if (submission.status !== "accepted") {
          throw new NileFormsError(
            "Only accepted submissions can be promoted.",
            409,
            "promotion_transition_invalid"
          );
        }
        if (submission.revision !== expectedRevision) {
          throw new NileFormsError(
            "The submission changed before promotion.",
            409,
            "revision_conflict",
            { currentRevision: submission.revision }
          );
        }

        const startedAt = currentIso();
        if (promotion) {
          promotion.status = "pending";
          promotion.commandId = createId("form_command");
          promotion.idempotencyKey = idempotencyKey;
          promotion.createdAt = startedAt;
          delete promotion.completedAt;
          delete promotion.error;
          delete promotion.resultingEntityType;
          delete promotion.resultingEntityId;
        } else {
          promotion = {
            id: createId("form_promotion"),
            submissionId,
            adapter,
            commandId: createId("form_command"),
            status: "pending",
            idempotencyKey,
            createdAt: startedAt,
          };
          state.promotions.unshift(promotion);
        }

        let result: PromotionResult;
        try {
          result = await promotionExecutor(adapter, clone(submission), session);
        } catch (error) {
          const completedAt = currentIso();
          promotion.status = "failed";
          promotion.error =
            error instanceof Error ? error.message : "Promotion failed.";
          promotion.completedAt = completedAt;
          appendAudit(
            state,
            {
              actorUserId: actor.userId,
              actorRole: actor.role,
              action: "form.promotion_failed",
              entityType: "FormSubmission",
              entityId: submissionId,
              metadata: {
                adapter,
                promotionId: promotion.id,
                commandId: promotion.commandId,
                idempotencyKey: promotion.idempotencyKey,
                error: promotion.error,
              },
            },
            createId,
            completedAt
          );
          return promotion;
        }

        const completedAt = currentIso();
        promotion.commandId = result.commandId;
        promotion.status = "succeeded";
        promotion.resultingEntityType = result.entityType;
        promotion.resultingEntityId = result.entityId;
        promotion.completedAt = completedAt;
        submission.status = "promoted";
        submission.revision += 1;
        submission.updatedAt = completedAt;
        appendAudit(
          state,
          {
            actorUserId: actor.userId,
            actorRole: actor.role,
            action: "form.promoted",
            entityType: "FormSubmission",
            entityId: submissionId,
            metadata: {
              adapter,
              promotionId: promotion.id,
              commandId: promotion.commandId,
              idempotencyKey: promotion.idempotencyKey,
              resultingEntityType: result.entityType,
              resultingEntityId: result.entityId,
            },
          },
          createId,
          completedAt
        );
        appendOutbox(
          state,
          "form.promoted",
          submissionId,
          {
            adapter,
            resultingEntityType: result.entityType,
            resultingEntityId: result.entityId,
          },
          createId,
          completedAt
        );
        return promotion;
      });
    },
  };
}

export type NileFormsService = ReturnType<typeof createNileFormsService>;
