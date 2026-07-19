import crypto from "node:crypto";

import type { PlatformState } from "../client/src/lib/domain/types.js";
import type { Permission, Role } from "../client/src/lib/platformData.js";
import type { FormAuditEvent, FormSubmission } from "../shared/nileForms.js";
import {
  branchIncidentRequestProfile,
  nileRequestCategories,
  nileRequestPriorities,
  type NileRequest,
  type NileRequestActivity,
  type NileRequestCommandOperation,
  type NileRequestCommandReceipt,
  type NileRequestCommandResult,
  type NileRequestComment,
  type NileRequestPriority,
  type NileRequestProcessingProfile,
  type NileRequestReassignment,
} from "../shared/nileRequests.js";
import type { ServerSession } from "./auth.js";
import {
  getNileFormsCompatibilityRepository,
  type NileFormsCompatibilityRepository,
} from "./nileFormsCompatibilityRepository.js";
import {
  actorHasBranch,
  actorHasDepartment,
  NileFormsError,
  requireSession,
  resolveActor,
  type NileFormsActor,
} from "./nileFormsService.js";
import { getPlatformStateRepository } from "./platformRepository.js";

type NileRequestsServiceDependencies = {
  repository?: NileFormsCompatibilityRepository;
  now?: () => Date;
  randomId?: (prefix: string) => string;
  readAuthorityState?: () => Promise<PlatformState>;
};

export type NileRequestListItem = {
  request: NileRequest;
  requesterName: string;
  assigneeName?: string;
  branchName: string;
  departmentName?: string;
};

export type NileRequestCapabilities = {
  canAssign: boolean;
  canReprioritize: boolean;
  canStart: boolean;
  canComment: boolean;
  canResolve: boolean;
  canCancel: boolean;
};

export type NileRequestDetail = NileRequestListItem & {
  comments: Array<NileRequestComment & { authorName: string }>;
  activities: Array<NileRequestActivity & { actorName: string }>;
  reassignments: Array<
    NileRequestReassignment & {
      actorName: string;
      previousAssigneeName?: string;
      nextAssigneeName: string;
    }
  >;
  auditEvents: FormAuditEvent[];
  assigneeOptions: Array<{ id: string; label: string; context: string }>;
  capabilities: NileRequestCapabilities;
};

export type NileRequestCreationCandidate = {
  profile: NileRequestProcessingProfile;
  submission: Pick<
    FormSubmission,
    | "id"
    | "status"
    | "revision"
    | "submittedAt"
    | "respondentUserId"
    | "branchId"
    | "departmentId"
  >;
  requesterName: string;
  branchName: string;
  departmentName?: string;
  mappedRequest: Pick<
    NileRequest,
    "location" | "category" | "priority" | "summary" | "details" | "dueAt"
  >;
  existingRequest?: NileRequest;
};

const idempotencyKeyPattern = /^[a-zA-Z0-9][a-zA-Z0-9:_-]{7,159}$/;
const staffRequestRoles = new Set<Role>([
  "branchadmin",
  "headofdepartment",
  "superadmin",
]);
const terminalStatuses = new Set<NileRequest["status"]>([
  "resolved",
  "cancelled",
]);
const dueHoursByPriority: Record<NileRequestPriority, number> = {
  low: 24 * 7,
  normal: 24 * 5,
  high: 48,
  urgent: 24,
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function clean(value: unknown, maximum = 4_000) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function fingerprint(value: unknown) {
  return crypto.createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function requireIdempotencyKey(value: unknown) {
  const result = clean(value, 160);
  if (!idempotencyKeyPattern.test(result)) {
    throw new NileFormsError(
      "A valid request idempotency key is required.",
      400,
      "request_idempotency_invalid"
    );
  }
  return result;
}

function requireExpectedVersion(value: unknown) {
  const version = Number(value);
  if (!Number.isInteger(version) || version < 1) {
    throw new NileFormsError(
      "A valid expected request version is required.",
      400,
      "request_version_invalid"
    );
  }
  return version;
}

function requirePermission(
  state: PlatformState,
  session: ServerSession,
  permission: Permission
) {
  if (!(state.permissions[session.activeRole] ?? []).includes(permission)) {
    throw new NileFormsError(
      `This action requires ${permission}.`,
      403,
      "permission_denied"
    );
  }
}

async function readPlatformState(): Promise<PlatformState> {
  const snapshot = await getPlatformStateRepository().readSnapshot();
  return snapshot.state;
}

function userName(state: PlatformState, userId: string | undefined) {
  if (!userId) return undefined;
  return state.users.find(user => user.id === userId)?.name;
}

function branchName(state: PlatformState, branchId: string) {
  return (
    state.branches.find(branch => branch.id === branchId)?.name ?? branchId
  );
}

function departmentName(
  state: PlatformState,
  departmentId: string | undefined
) {
  if (!departmentId) return undefined;
  return (
    state.departments.find(department => department.id === departmentId)
      ?.name ?? departmentId
  );
}

function managerHasScope(actor: NileFormsActor, request: NileRequest) {
  if (actor.role === "superadmin") return true;
  if (actor.role === "branchadmin") {
    return actorHasBranch(actor, request.branchId);
  }
  if (actor.role === "headofdepartment") {
    return Boolean(
      request.departmentId &&
        actorHasBranch(actor, request.branchId) &&
        actorHasDepartment(actor, request.departmentId)
    );
  }
  return false;
}

function canReadRequest(actor: NileFormsActor, request: NileRequest) {
  return (
    actor.userId === request.requesterUserId ||
    actor.userId === request.assigneeUserId ||
    managerHasScope(actor, request)
  );
}

function requireReadableRequest(actor: NileFormsActor, request: NileRequest) {
  if (!canReadRequest(actor, request)) {
    throw new NileFormsError(
      "Request scope denied.",
      403,
      "request_scope_denied"
    );
  }
}

function requireManager(actor: NileFormsActor, request: NileRequest) {
  if (!staffRequestRoles.has(actor.role) || !managerHasScope(actor, request)) {
    throw new NileFormsError(
      "Request management scope denied.",
      403,
      "request_scope_denied"
    );
  }
}

function eligibleAssignees(state: PlatformState, request: NileRequest) {
  return state.users
    .filter(user => user.status === "active")
    .filter(user =>
      user.roles.some(role => staffRequestRoles.has(role as Role))
    )
    .filter(user => {
      if (user.roles.includes("superadmin")) return true;
      return state.staffProfiles.some(profile => {
        if (profile.userId !== user.id || profile.status !== "active") {
          return false;
        }
        const branchAllowed =
          profile.branchIds.includes("br_global") ||
          profile.branchIds.includes(request.branchId);
        if (!branchAllowed) return false;
        if (profile.role === "branchadmin") return true;
        return Boolean(
          profile.role === "headofdepartment" &&
            request.departmentId &&
            (profile.departmentIds.includes("dep_platform") ||
              profile.departmentIds.includes(request.departmentId))
        );
      });
    })
    .map(user => ({
      id: user.id,
      label: user.name,
      context: user.roles
        .filter(role => staffRequestRoles.has(role as Role))
        .map(role => role.replace("headofdepartment", "HOD"))
        .join(", "),
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

function assigneeIsEligible(
  state: PlatformState,
  request: NileRequest,
  assigneeUserId: string
) {
  return eligibleAssignees(state, request).some(
    item => item.id === assigneeUserId
  );
}

function requestCapabilities(
  actor: NileFormsActor,
  request: NileRequest
): NileRequestCapabilities {
  const terminal = terminalStatuses.has(request.status);
  const manager = managerHasScope(actor, request);
  const assignee = actor.userId === request.assigneeUserId;
  const requester = actor.userId === request.requesterUserId;
  return {
    canAssign: !terminal && manager,
    canReprioritize: !terminal && manager,
    canStart: request.status === "assigned" && (manager || assignee),
    canComment: !terminal && (manager || assignee || requester),
    canResolve: request.status === "in_progress" && (manager || assignee),
    canCancel:
      !terminal &&
      (manager || (requester && ["open", "assigned"].includes(request.status))),
  };
}

function listItem(
  state: PlatformState,
  request: NileRequest
): NileRequestListItem {
  return {
    request: clone(request),
    requesterName: userName(state, request.requesterUserId) ?? "Unknown user",
    assigneeName: userName(state, request.assigneeUserId),
    branchName: branchName(state, request.branchId),
    departmentName: departmentName(state, request.departmentId),
  };
}

function detailFor(
  state: PlatformState,
  actor: NileFormsActor,
  request: NileRequest,
  formState: Awaited<ReturnType<NileFormsCompatibilityRepository["read"]>>
): NileRequestDetail {
  const withNames = <T extends { actorUserId: string }>(item: T) => ({
    ...clone(item),
    actorName: userName(state, item.actorUserId) ?? "Unknown user",
  });
  return {
    ...listItem(state, request),
    comments: formState.requests.comments
      .filter(item => item.requestId === request.id)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map(item => ({
        ...clone(item),
        authorName: userName(state, item.authorUserId) ?? "Unknown user",
      })),
    activities: formState.requests.activities
      .filter(item => item.requestId === request.id)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map(withNames),
    reassignments: formState.requests.reassignments
      .filter(item => item.requestId === request.id)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map(item => ({
        ...withNames(item),
        previousAssigneeName: userName(state, item.previousAssigneeUserId),
        nextAssigneeName:
          userName(state, item.nextAssigneeUserId) ?? "Unknown user",
      })),
    auditEvents: formState.auditEvents
      .filter(
        event =>
          event.entityType === "NileRequest" && event.entityId === request.id
      )
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    assigneeOptions: eligibleAssignees(state, request),
    capabilities: requestCapabilities(actor, request),
  };
}

function mappedCategory(value: unknown): NileRequest["category"] {
  const category = clean(value, 40) as NileRequest["category"];
  if (!nileRequestCategories.includes(category)) {
    throw new NileFormsError(
      "The incident category is not supported by this request profile.",
      409,
      "request_profile_invalid"
    );
  }
  return category;
}

function mappedPriority(value: unknown): NileRequestPriority {
  const severity = Number(value);
  if (!Number.isFinite(severity) || severity < 1 || severity > 5) {
    throw new NileFormsError(
      "The incident severity is not supported by this request profile.",
      409,
      "request_profile_invalid"
    );
  }
  if (severity >= 4) return "urgent";
  if (severity === 3) return "high";
  if (severity === 2) return "normal";
  return "low";
}

function dueAt(priority: NileRequestPriority, now: Date) {
  return new Date(
    now.getTime() + dueHoursByPriority[priority] * 60 * 60 * 1_000
  ).toISOString();
}

function mapSubmission(
  submission: FormSubmission,
  now: Date,
  profile = branchIncidentRequestProfile
) {
  const location = clean(submission.answers[profile.fieldMap.location], 160);
  const details = clean(submission.answers[profile.fieldMap.details], 3_000);
  const category = mappedCategory(
    submission.answers[profile.fieldMap.category]
  );
  const priority = mappedPriority(
    submission.answers[profile.fieldMap.severity]
  );
  if (!location || details.length < 20) {
    throw new NileFormsError(
      "The reviewed submission does not satisfy the registered request profile.",
      409,
      "request_profile_invalid"
    );
  }
  return {
    location,
    category,
    priority,
    summary: `${category.replaceAll("_", " ")} at ${location}`,
    details,
    dueAt: dueAt(priority, now),
  };
}

function requireEligibleSubmission(
  state: Awaited<ReturnType<NileFormsCompatibilityRepository["read"]>>,
  submissionId: string
) {
  const submission = state.submissions.find(item => item.id === submissionId);
  if (!submission) {
    throw new NileFormsError(
      "Submission not found.",
      404,
      "submission_not_found"
    );
  }
  const definition = state.definitions.find(
    item => item.id === submission.definitionId
  );
  if (
    !definition ||
    definition.id !== branchIncidentRequestProfile.sourceDefinitionId ||
    definition.key !== branchIncidentRequestProfile.sourceDefinitionKey ||
    submission.versionId !== branchIncidentRequestProfile.sourceVersionId
  ) {
    throw new NileFormsError(
      "This submission has no registered request processing profile.",
      409,
      "request_profile_not_found"
    );
  }
  if (
    submission.status !== "accepted" ||
    !state.reviews.some(
      review =>
        review.submissionId === submission.id && review.decision === "accepted"
    )
  ) {
    throw new NileFormsError(
      "Only an accepted reviewed submission can create a request.",
      409,
      "request_source_not_reviewed"
    );
  }
  if (!submission.respondentUserId || !submission.branchId) {
    throw new NileFormsError(
      "The reviewed submission is missing requester or branch authority.",
      409,
      "request_source_invalid"
    );
  }
  return submission;
}

function appendAudit(
  state: Awaited<ReturnType<NileFormsCompatibilityRepository["read"]>>,
  request: NileRequest,
  actor: NileFormsActor,
  action: string,
  metadata: Record<string, unknown>,
  id: string,
  createdAt: string
) {
  state.auditEvents.unshift({
    id,
    actorUserId: actor.userId,
    actorRole: actor.role,
    action,
    entityType: "NileRequest",
    entityId: request.id,
    metadata: {
      requestNumber: request.requestNumber,
      requestVersion: request.version,
      branchId: request.branchId,
      departmentId: request.departmentId,
      ...metadata,
    },
    createdAt,
  });
}

function createActivity(
  id: string,
  request: NileRequest,
  actor: NileFormsActor,
  type: NileRequestActivity["type"],
  summary: string,
  metadata: Record<string, unknown>,
  createdAt: string
): NileRequestActivity {
  return {
    id,
    requestId: request.id,
    actorUserId: actor.userId,
    type,
    summary,
    metadata,
    createdAt,
  };
}

function replayOrConflict(
  receipts: NileRequestCommandReceipt[],
  idempotencyKey: string,
  commandFingerprint: string
) {
  const receipt = receipts.find(item => item.idempotencyKey === idempotencyKey);
  if (!receipt) return undefined;
  if (receipt.fingerprint !== commandFingerprint) {
    throw new NileFormsError(
      "This idempotency key is already bound to another request command.",
      409,
      "request_idempotency_conflict"
    );
  }
  return clone(receipt.result);
}

function requireMutable(request: NileRequest) {
  if (terminalStatuses.has(request.status)) {
    throw new NileFormsError(
      "A terminal request cannot be changed.",
      409,
      "request_terminal"
    );
  }
}

function requestSequence(requests: NileRequest[], now: Date) {
  const year = now.getUTCFullYear();
  const sequence =
    requests.filter(item => item.requestNumber.startsWith(`REQ-${year}-`))
      .length + 1;
  return `REQ-${year}-${String(sequence).padStart(4, "0")}`;
}

export function createNileRequestsService(
  dependencies: NileRequestsServiceDependencies = {}
) {
  const repository =
    dependencies.repository ?? getNileFormsCompatibilityRepository();
  const nowDate = dependencies.now ?? (() => new Date());
  const createId =
    dependencies.randomId ??
    ((prefix: string) =>
      `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`);
  const readAuthorityState =
    dependencies.readAuthorityState ?? readPlatformState;

  const authorize = async (
    sessionInput: ServerSession | null | undefined,
    permission: Permission
  ) => {
    const session = requireSession(sessionInput);
    const platformState = await readAuthorityState();
    requirePermission(platformState, session, permission);
    return {
      session,
      actor: resolveActor(platformState, session),
      platformState,
    };
  };

  const executeCommand = async (
    sessionInput: ServerSession | null | undefined,
    requestId: string,
    operation: Exclude<NileRequestCommandOperation, "create_from_submission">,
    input: Record<string, unknown>
  ) => {
    const authority = await authorize(sessionInput, "forms:read");
    const idempotencyKey = requireIdempotencyKey(input.idempotencyKey);
    const commandFingerprint = fingerprint({
      operation,
      requestId,
      actorUserId: authority.actor.userId,
      input,
    });
    return repository.transaction(state => {
      const replay = replayOrConflict(
        state.requests.commandReceipts,
        idempotencyKey,
        commandFingerprint
      );
      if (replay) return { ...replay, replayed: true };
      const request = state.requests.requests.find(
        item => item.id === requestId
      );
      if (!request) {
        throw new NileFormsError(
          "Request not found.",
          404,
          "request_not_found"
        );
      }
      requireReadableRequest(authority.actor, request);
      requireMutable(request);
      const expectedVersion = requireExpectedVersion(input.expectedVersion);
      if (request.version !== expectedVersion) {
        throw new NileFormsError(
          "The request changed in another session.",
          409,
          "request_version_conflict",
          { currentVersion: request.version }
        );
      }

      const timestamp = nowDate().toISOString();
      let activity: NileRequestActivity;
      let comment: NileRequestComment | undefined;
      let reassignment: NileRequestReassignment | undefined;
      let auditMetadata: Record<string, unknown> = {};

      if (operation === "assign") {
        requirePermission(
          authority.platformState,
          authority.session,
          "form_submissions:review"
        );
        requireManager(authority.actor, request);
        const assigneeUserId = clean(input.assigneeUserId, 120);
        const reason = clean(input.reason, 500);
        if (!assigneeUserId || reason.length < 5) {
          throw new NileFormsError(
            "Choose an eligible assignee and provide an assignment reason.",
            400,
            "request_assignment_invalid"
          );
        }
        if (
          !assigneeIsEligible(authority.platformState, request, assigneeUserId)
        ) {
          throw new NileFormsError(
            "The selected assignee is outside this request scope.",
            403,
            "request_assignee_denied"
          );
        }
        if (request.assigneeUserId === assigneeUserId) {
          throw new NileFormsError(
            "The request is already assigned to this user.",
            409,
            "request_transition_invalid"
          );
        }
        const previousAssigneeUserId = request.assigneeUserId;
        request.assigneeUserId = assigneeUserId;
        if (request.status === "open") request.status = "assigned";
        reassignment = {
          id: createId("request_reassignment"),
          requestId: request.id,
          previousAssigneeUserId,
          nextAssigneeUserId: assigneeUserId,
          actorUserId: authority.actor.userId,
          reason,
          createdAt: timestamp,
        };
        state.requests.reassignments.push(reassignment);
        activity = createActivity(
          createId("request_activity"),
          request,
          authority.actor,
          "assigned",
          `Assigned to ${userName(authority.platformState, assigneeUserId) ?? assigneeUserId}.`,
          {
            previousAssigneeUserId,
            nextAssigneeUserId: assigneeUserId,
            reason,
          },
          timestamp
        );
        auditMetadata = { previousAssigneeUserId, assigneeUserId, reason };
      } else if (operation === "reprioritize") {
        requirePermission(
          authority.platformState,
          authority.session,
          "form_submissions:review"
        );
        requireManager(authority.actor, request);
        const priority = clean(input.priority, 40) as NileRequestPriority;
        const reason = clean(input.reason, 500);
        if (!nileRequestPriorities.includes(priority) || reason.length < 5) {
          throw new NileFormsError(
            "Choose a valid priority and provide a reason.",
            400,
            "request_priority_invalid"
          );
        }
        if (priority === request.priority) {
          throw new NileFormsError(
            "Choose a different priority.",
            409,
            "request_transition_invalid"
          );
        }
        const previousPriority = request.priority;
        const previousDueAt = request.dueAt;
        request.priority = priority;
        request.dueAt = dueAt(priority, nowDate());
        activity = createActivity(
          createId("request_activity"),
          request,
          authority.actor,
          "reprioritized",
          `Priority changed from ${previousPriority} to ${priority}.`,
          {
            previousPriority,
            priority,
            previousDueAt,
            dueAt: request.dueAt,
            reason,
          },
          timestamp
        );
        auditMetadata = { previousPriority, priority, reason };
      } else if (operation === "start") {
        if (!requestCapabilities(authority.actor, request).canStart) {
          throw new NileFormsError(
            "Only the scoped manager or assignee can start an assigned request.",
            403,
            "request_transition_denied"
          );
        }
        request.status = "in_progress";
        request.startedAt = timestamp;
        activity = createActivity(
          createId("request_activity"),
          request,
          authority.actor,
          "started",
          "Work started.",
          {},
          timestamp
        );
      } else if (operation === "comment") {
        if (!requestCapabilities(authority.actor, request).canComment) {
          throw new NileFormsError(
            "Commenting is not available for this request.",
            403,
            "request_comment_denied"
          );
        }
        const body = clean(input.body, 4_000);
        if (body.length < 2) {
          throw new NileFormsError(
            "Enter a comment of at least two characters.",
            400,
            "request_comment_invalid"
          );
        }
        comment = {
          id: createId("request_comment"),
          requestId: request.id,
          authorUserId: authority.actor.userId,
          body,
          createdAt: timestamp,
        };
        state.requests.comments.push(comment);
        activity = createActivity(
          createId("request_activity"),
          request,
          authority.actor,
          "commented",
          "Comment added.",
          { commentId: comment.id },
          timestamp
        );
        auditMetadata = { commentId: comment.id };
      } else if (operation === "resolve") {
        if (!requestCapabilities(authority.actor, request).canResolve) {
          throw new NileFormsError(
            "Only the scoped manager or assignee can resolve an active request.",
            403,
            "request_transition_denied"
          );
        }
        const resolution = clean(input.resolution, 4_000);
        if (resolution.length < 5) {
          throw new NileFormsError(
            "Provide a resolution of at least five characters.",
            400,
            "request_resolution_invalid"
          );
        }
        request.status = "resolved";
        request.resolution = resolution;
        request.resolvedAt = timestamp;
        activity = createActivity(
          createId("request_activity"),
          request,
          authority.actor,
          "resolved",
          "Request resolved.",
          { resolution },
          timestamp
        );
        auditMetadata = { resolution };
      } else {
        const capabilities = requestCapabilities(authority.actor, request);
        if (!capabilities.canCancel) {
          throw new NileFormsError(
            "Cancelling is not available for this request.",
            403,
            "request_cancel_denied"
          );
        }
        const reason = clean(input.reason, 4_000);
        if (reason.length < 5) {
          throw new NileFormsError(
            "Provide a cancellation reason of at least five characters.",
            400,
            "request_cancel_invalid"
          );
        }
        request.status = "cancelled";
        request.cancellationReason = reason;
        request.cancelledAt = timestamp;
        activity = createActivity(
          createId("request_activity"),
          request,
          authority.actor,
          "cancelled",
          "Request cancelled.",
          { reason },
          timestamp
        );
        auditMetadata = { reason };
      }

      request.version += 1;
      request.updatedAt = timestamp;
      state.requests.activities.push(activity);
      appendAudit(
        state,
        request,
        authority.actor,
        `request.${operation}`,
        auditMetadata,
        createId("form_audit"),
        timestamp
      );
      const result: NileRequestCommandResult = {
        request: clone(request),
        comment: comment ? clone(comment) : undefined,
        activity: clone(activity),
        reassignment: reassignment ? clone(reassignment) : undefined,
      };
      state.requests.commandReceipts.push({
        id: createId("request_command"),
        idempotencyKey,
        fingerprint: commandFingerprint,
        operation,
        requestId: request.id,
        actorUserId: authority.actor.userId,
        result: clone(result),
        createdAt: timestamp,
      });
      return { ...result, replayed: false };
    });
  };

  return {
    async listRequests(sessionInput: ServerSession | null | undefined) {
      const { actor, platformState } = await authorize(
        sessionInput,
        "forms:read"
      );
      const state = await repository.read();
      return state.requests.requests
        .filter(request => canReadRequest(actor, request))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .map(request => listItem(platformState, request));
    },

    async getRequest(
      sessionInput: ServerSession | null | undefined,
      requestId: string
    ) {
      const { actor, platformState } = await authorize(
        sessionInput,
        "forms:read"
      );
      const state = await repository.read();
      const request = state.requests.requests.find(
        item => item.id === requestId
      );
      if (!request) {
        throw new NileFormsError(
          "Request not found.",
          404,
          "request_not_found"
        );
      }
      requireReadableRequest(actor, request);
      return detailFor(platformState, actor, request, state);
    },

    async getCreationCandidate(
      sessionInput: ServerSession | null | undefined,
      submissionId: string
    ): Promise<NileRequestCreationCandidate> {
      const { actor, platformState } = await authorize(
        sessionInput,
        "form_submissions:review"
      );
      const state = await repository.read();
      const submission = requireEligibleSubmission(state, submissionId);
      if (
        actor.role !== "superadmin" &&
        (actor.role !== "branchadmin" ||
          !actorHasBranch(actor, submission.branchId!))
      ) {
        throw new NileFormsError(
          "Request creation scope denied.",
          403,
          "request_scope_denied"
        );
      }
      const mappedRequest = mapSubmission(submission, nowDate());
      return {
        profile: branchIncidentRequestProfile,
        submission: {
          id: submission.id,
          status: submission.status,
          revision: submission.revision,
          submittedAt: submission.submittedAt,
          respondentUserId: submission.respondentUserId,
          branchId: submission.branchId,
          departmentId: submission.departmentId,
        },
        requesterName:
          userName(platformState, submission.respondentUserId) ??
          "Unknown user",
        branchName: branchName(platformState, submission.branchId!),
        departmentName: departmentName(platformState, submission.departmentId),
        mappedRequest,
        existingRequest: state.requests.requests.find(
          item => item.sourceSubmissionId === submission.id
        ),
      };
    },

    async createFromReviewedSubmission(
      sessionInput: ServerSession | null | undefined,
      submissionId: string,
      input: Record<string, unknown>
    ) {
      const authority = await authorize(
        sessionInput,
        "form_submissions:review"
      );
      const expectedSubmissionRevision = requireExpectedVersion(
        input.expectedSubmissionRevision
      );
      const idempotencyKey = requireIdempotencyKey(input.idempotencyKey);
      const commandFingerprint = fingerprint({
        operation: "create_from_submission",
        submissionId,
        actorUserId: authority.actor.userId,
        expectedSubmissionRevision,
      });
      return repository.transaction(state => {
        const replay = replayOrConflict(
          state.requests.commandReceipts,
          idempotencyKey,
          commandFingerprint
        );
        if (replay) return { ...replay, replayed: true };
        const submission = requireEligibleSubmission(state, submissionId);
        if (
          authority.actor.role !== "superadmin" &&
          (authority.actor.role !== "branchadmin" ||
            !actorHasBranch(authority.actor, submission.branchId!))
        ) {
          throw new NileFormsError(
            "Request creation scope denied.",
            403,
            "request_scope_denied"
          );
        }
        if (submission.revision !== expectedSubmissionRevision) {
          throw new NileFormsError(
            "The reviewed submission changed before request creation.",
            409,
            "request_source_version_conflict",
            { currentRevision: submission.revision }
          );
        }
        const existing = state.requests.requests.find(
          item => item.sourceSubmissionId === submission.id
        );
        if (existing) {
          throw new NileFormsError(
            "This reviewed submission already created a request.",
            409,
            "request_source_already_used"
          );
        }
        const timestampDate = nowDate();
        const timestamp = timestampDate.toISOString();
        const mapped = mapSubmission(submission, timestampDate);
        const request: NileRequest = {
          id: createId("request"),
          requestNumber: requestSequence(
            state.requests.requests,
            timestampDate
          ),
          requesterUserId: submission.respondentUserId!,
          sourceSubmissionId: submission.id,
          sourceDefinitionId: submission.definitionId,
          sourcePublicationId: submission.publicationId,
          sourceVersionId: submission.versionId,
          branchId: submission.branchId!,
          departmentId: submission.departmentId,
          ...mapped,
          status: "open",
          version: 1,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        state.requests.requests.unshift(request);
        const activity = createActivity(
          createId("request_activity"),
          request,
          authority.actor,
          "created",
          `Created from reviewed submission ${submission.id}.`,
          {
            sourceSubmissionId: submission.id,
            processingProfileId: branchIncidentRequestProfile.id,
          },
          timestamp
        );
        state.requests.activities.push(activity);
        appendAudit(
          state,
          request,
          authority.actor,
          "request.created",
          {
            sourceSubmissionId: submission.id,
            sourceVersionId: submission.versionId,
            processingProfileId: branchIncidentRequestProfile.id,
          },
          createId("form_audit"),
          timestamp
        );
        const result: NileRequestCommandResult = {
          request: clone(request),
          activity: clone(activity),
        };
        state.requests.commandReceipts.push({
          id: createId("request_command"),
          idempotencyKey,
          fingerprint: commandFingerprint,
          operation: "create_from_submission",
          requestId: request.id,
          actorUserId: authority.actor.userId,
          result: clone(result),
          createdAt: timestamp,
        });
        return { ...result, replayed: false };
      });
    },

    assign: (
      session: ServerSession | null | undefined,
      requestId: string,
      input: Record<string, unknown>
    ) => executeCommand(session, requestId, "assign", input),
    reprioritize: (
      session: ServerSession | null | undefined,
      requestId: string,
      input: Record<string, unknown>
    ) => executeCommand(session, requestId, "reprioritize", input),
    start: (
      session: ServerSession | null | undefined,
      requestId: string,
      input: Record<string, unknown>
    ) => executeCommand(session, requestId, "start", input),
    comment: (
      session: ServerSession | null | undefined,
      requestId: string,
      input: Record<string, unknown>
    ) => executeCommand(session, requestId, "comment", input),
    resolve: (
      session: ServerSession | null | undefined,
      requestId: string,
      input: Record<string, unknown>
    ) => executeCommand(session, requestId, "resolve", input),
    cancel: (
      session: ServerSession | null | undefined,
      requestId: string,
      input: Record<string, unknown>
    ) => executeCommand(session, requestId, "cancel", input),
  };
}

export type NileRequestsService = ReturnType<typeof createNileRequestsService>;
