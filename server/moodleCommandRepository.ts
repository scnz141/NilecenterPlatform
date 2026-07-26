import crypto from "node:crypto";
import { supabaseAdminRestFetch } from "./supabase.js";
import {
  hashMoodlePayload,
  stableMoodleJson,
  type MoodleCommandCreateDto,
  type MoodleCommandState,
  type MoodleCommandStatusDto,
  type MoodleLaunchCreateDto,
} from "./moodleCommandRuntime.js";
import type { MoodleCommandOperation } from "./moodleCommandContract.js";

type AdminFetch = typeof supabaseAdminRestFetch;

export class MoodleCommandRepositoryUnavailableError extends Error {
  constructor(message = "Moodle command persistence is unavailable.") {
    super(message);
    this.name = "MoodleCommandRepositoryUnavailableError";
  }
}

export class MoodleCommandRepositoryDeniedError extends Error {
  constructor(message = "Moodle command access is denied.") {
    super(message);
    this.name = "MoodleCommandRepositoryDeniedError";
  }
}

export class MoodleCommandRepositoryConflictError extends Error {
  constructor(message = "Moodle command conflicts with current state.") {
    super(message);
    this.name = "MoodleCommandRepositoryConflictError";
  }
}

type TargetMapping = Readonly<{
  id: string;
  contextMappingId: string;
}>;

export type ClaimedMoodleCommand = Readonly<{
  commandRequestId: string;
  operation: MoodleCommandOperation;
  connectionId: string;
  actorExternalId: string;
  targetExternalId?: string;
  targetContextExternalId: string;
  expectedProviderVersion: string;
  payload: Readonly<Record<string, unknown>>;
  payloadHash: string;
  idempotencyKey: string;
  originatingCommandId: string;
  attemptNumber: number;
}>;

export type MoodleAdminCommandSummary = Readonly<{
  commandId: string;
  operation: MoodleCommandOperation;
  status: MoodleCommandState;
  attemptCount: number;
  errorCode?: string;
  reconciliationCaseId?: string;
  providerVersion?: string;
  createdAt: string;
  updatedAt: string;
}>;

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function readJson(response: Response) {
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new MoodleCommandRepositoryUnavailableError();
  }
}

function assertResponse(response: Response) {
  if (response.ok) return;
  if ([401, 403].includes(response.status)) {
    throw new MoodleCommandRepositoryDeniedError();
  }
  if ([400, 404, 409, 422].includes(response.status)) {
    throw new MoodleCommandRepositoryConflictError();
  }
  throw new MoodleCommandRepositoryUnavailableError();
}

function row(value: unknown): Record<string, unknown> {
  const item = Array.isArray(value) ? value[0] : value;
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    throw new MoodleCommandRepositoryUnavailableError();
  }
  return item as Record<string, unknown>;
}

export class SupabaseMoodleCommandRepository {
  constructor(
    private readonly adminFetch: AdminFetch = supabaseAdminRestFetch
  ) {}

  private async resolveTarget(
    internalId: string,
    entityType: string
  ): Promise<TargetMapping> {
    const query = new URLSearchParams({
      internal_id: `eq.${internalId}`,
      entity_type: `eq.${entityType}`,
      sync_state: "eq.synced",
      select: "id,metadata",
      limit: "2",
    });
    const response = await this.adminFetch(`external_records?${query}`);
    assertResponse(response);
    const payload = await readJson(response);
    if (!Array.isArray(payload) || payload.length !== 1) {
      throw new MoodleCommandRepositoryConflictError(
        "Moodle target mapping is missing or ambiguous."
      );
    }
    const mapping = payload[0] as Record<string, unknown>;
    const metadata =
      mapping.metadata && typeof mapping.metadata === "object"
        ? (mapping.metadata as Record<string, unknown>)
        : {};
    if (
      typeof mapping.id !== "string" ||
      typeof metadata.contextMappingId !== "string"
    ) {
      throw new MoodleCommandRepositoryConflictError(
        "Moodle target context mapping is missing."
      );
    }
    return {
      id: mapping.id,
      contextMappingId: metadata.contextMappingId,
    };
  }

  private async resolveSystemContextMappingId() {
    const query = new URLSearchParams({
      entity_type: "eq.context",
      sync_state: "eq.synced",
      select: "id,metadata",
      limit: "20",
    });
    const response = await this.adminFetch(`external_records?${query}`);
    assertResponse(response);
    const payload = await readJson(response);
    if (!Array.isArray(payload)) {
      throw new MoodleCommandRepositoryUnavailableError();
    }
    const matches = payload.filter(item => {
      const metadata =
        item && typeof item === "object"
          ? (item as Record<string, unknown>).metadata
          : undefined;
      return (
        metadata &&
        typeof metadata === "object" &&
        (metadata as Record<string, unknown>).contextKind === "system"
      );
    });
    if (
      matches.length !== 1 ||
      typeof (matches[0] as Record<string, unknown>).id !== "string"
    ) {
      throw new MoodleCommandRepositoryConflictError(
        "Moodle system context mapping is missing or ambiguous."
      );
    }
    return (matches[0] as Record<string, unknown>).id as string;
  }

  private async resolveExternalReference(
    connectionId: string,
    internalId: string,
    entityType: string
  ) {
    const query = new URLSearchParams({
      connection_id: `eq.${connectionId}`,
      internal_id: `eq.${internalId}`,
      entity_type: `eq.${entityType}`,
      sync_state: "eq.synced",
      select: "external_id",
      limit: "2",
    });
    const response = await this.adminFetch(`external_records?${query}`);
    assertResponse(response);
    const payload = await readJson(response);
    if (
      !Array.isArray(payload) ||
      payload.length !== 1 ||
      typeof (payload[0] as Record<string, unknown>).external_id !== "string"
    ) {
      throw new MoodleCommandRepositoryConflictError(
        `Moodle ${entityType} mapping is missing or ambiguous.`
      );
    }
    const externalId = clean(
      (payload[0] as Record<string, unknown>).external_id
    );
    if (!/^[1-9][0-9]{0,15}$/.test(externalId)) {
      throw new MoodleCommandRepositoryConflictError(
        `Moodle ${entityType} mapping is invalid.`
      );
    }
    return Number(externalId);
  }

  private async providerPayload(
    command: Readonly<{
      connectionId: string;
      operation: MoodleCommandOperation;
      payload: Readonly<Record<string, unknown>>;
    }>
  ) {
    const payload = { ...command.payload };
    const replaceReference = async (
      internalKey: string,
      externalKey: string,
      entityType: string
    ) => {
      const internalId = payload[internalKey];
      if (internalId === undefined) return;
      if (typeof internalId !== "string") {
        throw new MoodleCommandRepositoryConflictError();
      }
      payload[externalKey] = await this.resolveExternalReference(
        command.connectionId,
        internalId,
        entityType
      );
      delete payload[internalKey];
    };
    await replaceReference(
      "sourceTemplateInternalId",
      "sourceCourseExternalId",
      "course"
    );
    await replaceReference(
      "questionCategoryInternalId",
      "categoryExternalId",
      "question_category"
    );
    await replaceReference(
      "destinationQuestionCategoryInternalId",
      "destinationCategoryExternalId",
      "question_category"
    );
    await replaceReference("userInternalId", "userExternalId", "user");
    await replaceReference(
      "uploadInternalId",
      "draftItemId",
      "moodle_draft_file"
    );
    return payload;
  }

  async listForAdmin(limit = 50): Promise<MoodleAdminCommandSummary[]> {
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
    const query = new URLSearchParams({
      select:
        "id,operation,status,attempt_count,last_error_code,reconciliation_case_id,provider_version,created_at,updated_at",
      order: "created_at.desc",
      limit: String(safeLimit),
    });
    const response = await this.adminFetch(`moodle_command_requests?${query}`);
    assertResponse(response);
    const payload = await readJson(response);
    if (!Array.isArray(payload)) {
      throw new MoodleCommandRepositoryUnavailableError();
    }
    return payload.map(item => {
      const value = row(item);
      if (
        typeof value.id !== "string" ||
        typeof value.operation !== "string" ||
        typeof value.status !== "string" ||
        typeof value.attempt_count !== "number" ||
        typeof value.created_at !== "string" ||
        typeof value.updated_at !== "string"
      ) {
        throw new MoodleCommandRepositoryUnavailableError();
      }
      return {
        commandId: value.id,
        operation: value.operation as MoodleCommandOperation,
        status: value.status as MoodleCommandState,
        attemptCount: value.attempt_count,
        errorCode: clean(value.last_error_code) || undefined,
        reconciliationCaseId: clean(value.reconciliation_case_id) || undefined,
        providerVersion: clean(value.provider_version) || undefined,
        createdAt: value.created_at,
        updatedAt: value.updated_at,
      };
    });
  }

  async create(sessionId: string, input: MoodleCommandCreateDto) {
    const target =
      input.targetInternalId && input.targetEntityType
        ? await this.resolveTarget(
            input.targetInternalId,
            input.targetEntityType
          )
        : undefined;
    const requestId = crypto.randomUUID();
    const payloadHash = hashMoodlePayload(input.payload);
    const targetContextId =
      target?.contextMappingId ?? (await this.resolveSystemContextMappingId());
    const response = await this.adminFetch("rpc/nile_create_moodle_command", {
      method: "POST",
      body: JSON.stringify({
        p_session_id: sessionId,
        p_request_id: requestId,
        p_operation: input.operation,
        p_target_mapping_id: target?.id ?? null,
        p_target_context_id: targetContextId,
        p_expected_provider_version: input.expectedProviderVersion,
        p_payload: input.payload,
        p_idempotency_key: input.idempotencyKey,
        p_request_hash: payloadHash,
      }),
    });
    assertResponse(response);
    const value = row(await readJson(response));
    if (
      typeof value.command_request_id !== "string" ||
      typeof value.audit_id !== "number" ||
      typeof value.status !== "string"
    ) {
      throw new MoodleCommandRepositoryUnavailableError();
    }
    return {
      commandId: value.command_request_id,
      status: value.status as MoodleCommandState,
      auditId: value.audit_id,
      replayed: value.replayed === true,
    };
  }

  async status(
    sessionId: string,
    commandRequestId: string
  ): Promise<MoodleCommandStatusDto> {
    const response = await this.adminFetch(
      "rpc/nile_get_moodle_command_status",
      {
        method: "POST",
        body: JSON.stringify({
          p_session_id: sessionId,
          p_command_request_id: commandRequestId,
        }),
      }
    );
    assertResponse(response);
    const value = row(await readJson(response));
    if (
      typeof value.command_request_id !== "string" ||
      typeof value.operation !== "string" ||
      typeof value.status !== "string" ||
      typeof value.attempt_count !== "number" ||
      typeof value.created_at !== "string" ||
      typeof value.updated_at !== "string"
    ) {
      throw new MoodleCommandRepositoryUnavailableError();
    }
    return {
      commandId: value.command_request_id,
      operation: value.operation as MoodleCommandOperation,
      status: value.status as MoodleCommandState,
      providerVersion: clean(value.provider_version) || undefined,
      reconciliationCaseId: clean(value.reconciliation_case_id) || undefined,
      attemptCount: value.attempt_count,
      errorCode: clean(value.last_error_code) || undefined,
      createdAt: value.created_at,
      updatedAt: value.updated_at,
      allowedActions:
        value.status === "reconciliation_required"
          ? ["refresh", "reconcile"]
          : ["refresh"],
    };
  }

  async claim(workerId: string): Promise<ClaimedMoodleCommand | null> {
    const response = await this.adminFetch("rpc/nile_claim_moodle_command", {
      method: "POST",
      body: JSON.stringify({
        p_worker_id: workerId,
        p_lease_seconds: 60,
      }),
    });
    assertResponse(response);
    const payload = await readJson(response);
    if (Array.isArray(payload) && payload.length === 0) return null;
    const value = row(payload);
    if (
      typeof value.command_request_id !== "string" ||
      typeof value.operation !== "string" ||
      typeof value.connection_id !== "string" ||
      typeof value.actor_external_id !== "string" ||
      typeof value.target_context_external_id !== "string" ||
      typeof value.expected_provider_version !== "string" ||
      !value.payload ||
      typeof value.payload !== "object" ||
      typeof value.payload_hash !== "string" ||
      typeof value.idempotency_key !== "string" ||
      typeof value.originating_command_id !== "string" ||
      typeof value.attempt_number !== "number"
    ) {
      throw new MoodleCommandRepositoryUnavailableError();
    }
    const command = {
      commandRequestId: value.command_request_id,
      operation: value.operation as MoodleCommandOperation,
      connectionId: value.connection_id,
      actorExternalId: value.actor_external_id,
      targetExternalId: clean(value.target_external_id) || undefined,
      targetContextExternalId: value.target_context_external_id,
      expectedProviderVersion: value.expected_provider_version,
      payload: value.payload as Record<string, unknown>,
      idempotencyKey: value.idempotency_key,
      originatingCommandId: value.originating_command_id,
      attemptNumber: value.attempt_number,
    };
    const providerPayload = await this.providerPayload(command);
    return {
      ...command,
      payload: providerPayload,
      payloadHash: hashMoodlePayload(providerPayload),
    };
  }

  async complete(
    command: ClaimedMoodleCommand,
    workerId: string,
    result: Readonly<{
      outcome: "applied" | "failed" | "unknown" | "denied";
      providerRequestId?: string;
      responseHash?: string;
      providerVersion?: string;
      errorCode?: string;
    }>
  ) {
    const response = await this.adminFetch(
      "rpc/nile_complete_moodle_command_attempt",
      {
        method: "POST",
        body: JSON.stringify({
          p_command_request_id: command.commandRequestId,
          p_worker_id: workerId,
          p_attempt_number: command.attemptNumber,
          p_outcome: result.outcome,
          p_provider_request_id: result.providerRequestId ?? null,
          p_response_hash: result.responseHash ?? null,
          p_provider_version: result.providerVersion ?? null,
          p_error_code: result.errorCode ?? null,
        }),
      }
    );
    assertResponse(response);
    return row(await readJson(response));
  }

  async reconcile(
    sessionId: string,
    commandRequestId: string,
    resolution: "confirmed_applied" | "confirmed_not_applied" | "cancelled",
    providerResultHash?: string,
    providerVersion?: string
  ) {
    const response = await this.adminFetch(
      "rpc/nile_reconcile_moodle_command",
      {
        method: "POST",
        body: JSON.stringify({
          p_session_id: sessionId,
          p_command_request_id: commandRequestId,
          p_resolution: resolution,
          p_provider_result_hash: providerResultHash ?? null,
          p_provider_version: providerVersion ?? null,
        }),
      }
    );
    assertResponse(response);
    return row(await readJson(response));
  }

  async createLaunch(
    sessionId: string,
    actorUserId: string,
    input: MoodleLaunchCreateDto
  ) {
    const target = await this.resolveTarget(
      input.targetInternalId,
      input.targetEntityType
    );
    const actorQuery = new URLSearchParams({
      internal_id: `eq.${actorUserId}`,
      entity_type: "eq.user",
      sync_state: "eq.synced",
      select: "id",
      limit: "2",
    });
    const actorResponse = await this.adminFetch(
      `external_records?${actorQuery}`
    );
    assertResponse(actorResponse);
    const actors = await readJson(actorResponse);
    if (
      !Array.isArray(actors) ||
      actors.length !== 1 ||
      typeof (actors[0] as Record<string, unknown>).id !== "string"
    ) {
      throw new MoodleCommandRepositoryConflictError(
        "Moodle actor mapping is missing or ambiguous."
      );
    }
    const rawTicket = crypto.randomBytes(32).toString("base64url");
    const ticketHash = crypto
      .createHash("sha256")
      .update(rawTicket, "utf8")
      .digest("hex");
    const response = await this.adminFetch("rpc/nile_create_moodle_launch", {
      method: "POST",
      body: JSON.stringify({
        p_session_id: sessionId,
        p_actor_mapping_id: (actors[0] as Record<string, unknown>).id,
        p_target_mapping_id: target.id,
        p_launch_kind: input.kind,
        p_return_path: input.returnPath,
        p_ticket_hash: ticketHash,
      }),
    });
    assertResponse(response);
    const value = row(await readJson(response));
    if (
      typeof value.launch_id !== "string" ||
      typeof value.expires_at !== "string"
    ) {
      throw new MoodleCommandRepositoryUnavailableError();
    }
    return {
      launchId: value.launch_id,
      ticket: rawTicket,
      expiresAt: value.expires_at,
    };
  }

  async consumeLaunch(ticket: string) {
    const ticketHash = crypto
      .createHash("sha256")
      .update(ticket, "utf8")
      .digest("hex");
    const response = await this.adminFetch("rpc/nile_consume_moodle_launch", {
      method: "POST",
      body: JSON.stringify({ p_ticket_hash: ticketHash }),
    });
    assertResponse(response);
    const value = row(await readJson(response));
    if (
      typeof value.launch_id !== "string" ||
      typeof value.actor_external_id !== "string" ||
      typeof value.target_external_id !== "string" ||
      typeof value.launch_kind !== "string" ||
      typeof value.return_path !== "string"
    ) {
      throw new MoodleCommandRepositoryUnavailableError();
    }
    return {
      launchId: value.launch_id,
      actorExternalId: value.actor_external_id,
      targetExternalId: value.target_external_id,
      kind: value.launch_kind,
      returnPath: value.return_path,
    };
  }
}

export function hashMoodleProviderResult(value: unknown) {
  return crypto
    .createHash("sha256")
    .update(stableMoodleJson(value), "utf8")
    .digest("hex");
}
