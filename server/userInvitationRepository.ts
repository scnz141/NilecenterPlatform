import crypto from "node:crypto";
import { supabaseAdminRestFetch } from "./supabase.js";

type SupabaseAdminFetch = typeof supabaseAdminRestFetch;

export class UserInvitationRepositoryUnavailableError extends Error {
  constructor() {
    super("Account invitation persistence is temporarily unavailable.");
    this.name = "UserInvitationRepositoryUnavailableError";
  }
}

export class UserInvitationConflictError extends Error {
  constructor(
    message = "This account invitation conflicts with existing data."
  ) {
    super(message);
    this.name = "UserInvitationConflictError";
  }
}

export type UserInvitationRole =
  | "student"
  | "teacher"
  | "registrar"
  | "headofdepartment"
  | "branchadmin"
  | "superadmin";

export type CreateUserInvitationRecord = Readonly<{
  sessionToken: string;
  invitationId: string;
  authUserId: string;
  fullName: string;
  email: string;
  phone?: string;
  role: UserInvitationRole;
  branchRef?: string;
  departmentRef?: string;
  title?: string;
  availabilityStatus?: string;
  subjects: readonly string[];
  teachingLevels: readonly string[];
  locale: string;
  activationEnvelope: string;
  expiresAt: string;
  idempotencyKey: string;
}>;

export type CreatedUserInvitation = Readonly<{
  invitationId: string;
  userId: string;
  roleGrantId: string;
  outboxEventId: string;
  replayed: boolean;
}>;

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stable(item)])
    );
  }
  return value;
}

function sha256(value: string) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

async function readJson(response: Response) {
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new UserInvitationRepositoryUnavailableError();
  }
}

function assertResponse(response: Response) {
  if (response.ok) return;
  if ([400, 409, 422].includes(response.status)) {
    throw new UserInvitationConflictError();
  }
  if (response.status === 401 || response.status === 403) {
    throw new UserInvitationConflictError(
      "The current account cannot create or accept this invitation."
    );
  }
  throw new UserInvitationRepositoryUnavailableError();
}

export class SupabaseUserInvitationRepository {
  constructor(
    private readonly adminFetch: SupabaseAdminFetch = supabaseAdminRestFetch
  ) {}

  async create(input: CreateUserInvitationRecord) {
    const request = {
      fullName: input.fullName,
      email: input.email,
      phone: input.phone ?? null,
      role: input.role,
      branchRef: input.branchRef ?? null,
      departmentRef: input.departmentRef ?? null,
      title: input.title ?? null,
      availabilityStatus: input.availabilityStatus ?? null,
      subjects: input.subjects,
      teachingLevels: input.teachingLevels,
      locale: input.locale,
      expiresAt: input.expiresAt,
    };
    let response: Response;
    try {
      response = await this.adminFetch(
        "rpc/nile_create_user_invitation_with_evidence",
        {
          method: "POST",
          body: JSON.stringify({
            p_session_token_hash: sha256(input.sessionToken),
            p_invitation_id: input.invitationId,
            p_auth_user_id: input.authUserId,
            p_full_name: input.fullName,
            p_email: input.email,
            p_phone: input.phone ?? null,
            p_role: input.role,
            p_branch_ref: input.branchRef ?? null,
            p_department_ref: input.departmentRef ?? null,
            p_title: input.title ?? null,
            p_availability_status: input.availabilityStatus ?? null,
            p_subjects: input.subjects,
            p_teaching_levels: input.teachingLevels,
            p_locale: input.locale,
            p_activation_envelope: input.activationEnvelope,
            p_expires_at: input.expiresAt,
            p_idempotency_key: input.idempotencyKey,
            p_request_hash: sha256(JSON.stringify(stable(request))),
          }),
        }
      );
    } catch (error) {
      if (
        error instanceof UserInvitationConflictError ||
        error instanceof UserInvitationRepositoryUnavailableError
      ) {
        throw error;
      }
      throw new UserInvitationRepositoryUnavailableError();
    }
    assertResponse(response);
    const payload = await readJson(response);
    const row = Array.isArray(payload) ? payload[0] : payload;
    if (!row || typeof row !== "object") {
      throw new UserInvitationRepositoryUnavailableError();
    }
    const value = row as Record<string, unknown>;
    if (
      typeof value.invitation_id !== "string" ||
      typeof value.user_id !== "string" ||
      typeof value.role_grant_id !== "string" ||
      typeof value.outbox_event_id !== "string"
    ) {
      throw new UserInvitationRepositoryUnavailableError();
    }
    return {
      invitationId: value.invitation_id,
      userId: value.user_id,
      roleGrantId: value.role_grant_id,
      outboxEventId: value.outbox_event_id,
      replayed: value.replayed === true,
    } satisfies CreatedUserInvitation;
  }

  async accept(invitationId: string, authUserId: string) {
    let response: Response;
    try {
      response = await this.adminFetch("rpc/nile_accept_user_invitation", {
        method: "POST",
        body: JSON.stringify({
          p_invitation_id: invitationId,
          p_auth_user_id: authUserId,
        }),
      });
    } catch {
      throw new UserInvitationRepositoryUnavailableError();
    }
    assertResponse(response);
    const payload = await readJson(response);
    const row = Array.isArray(payload) ? payload[0] : payload;
    if (!row || typeof row !== "object") {
      throw new UserInvitationRepositoryUnavailableError();
    }
    const value = row as Record<string, unknown>;
    if (typeof value.user_id !== "string" || typeof value.role !== "string") {
      throw new UserInvitationRepositoryUnavailableError();
    }
    return {
      userId: value.user_id,
      role: value.role as UserInvitationRole,
      acceptedAt:
        typeof value.accepted_at === "string"
          ? value.accepted_at
          : new Date().toISOString(),
    };
  }
}
