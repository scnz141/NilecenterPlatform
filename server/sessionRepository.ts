import crypto from "node:crypto";

import type { ServerRole, ServerSession } from "./auth.js";
import { getSupabaseServerStatus, supabaseAdminRestFetch } from "./supabase.js";

type Awaitable<T> = T | Promise<T>;

const serverRoles = new Set<ServerRole>([
  "student",
  "teacher",
  "registrar",
  "headofdepartment",
  "branchadmin",
  "superadmin",
]);

export type ResolvedSessionIdentity = {
  userId: string;
  authUserId: string;
  email: string;
  name: string;
  activeRole: ServerRole;
  activeRoleGrantId: string;
  branchIds: string[];
  departmentIds: string[];
};

export type PersistedSessionTiming = {
  createdAt: string;
  expiresAt: string;
};

export type SessionRepository = {
  readonly kind:
    | "memory"
    | "supabase"
    | "supabase_compatibility"
    | "supabase_hybrid";
  create(session: ServerSession): Awaitable<void | PersistedSessionTiming>;
  get(sessionToken: string): Awaitable<ServerSession | null>;
  delete(sessionToken: string): Awaitable<void>;
  clear(): Awaitable<void>;
  resolveSupabaseIdentity?(
    authUserId: string,
    requestedRole: ServerRole
  ): Promise<ResolvedSessionIdentity | null>;
};

// Compatibility name for focused tests and older imports. New server code uses
// SessionRepository because the durable adapter is asynchronous.
export type SessionStore = SessionRepository;

export class SessionRepositoryUnavailableError extends Error {
  constructor(message = "Durable session storage is unavailable.") {
    super(message);
    this.name = "SessionRepositoryUnavailableError";
  }
}

export class SessionAuthorityDeniedError extends Error {
  constructor(
    message = "Session authority is not available for this account."
  ) {
    super(message);
    this.name = "SessionAuthorityDeniedError";
  }
}

export class SessionCommandConflictError extends Error {
  constructor(message = "Durable session command evidence conflicts.") {
    super(message);
    this.name = "SessionCommandConflictError";
  }
}

type SupabaseAdminFetch = typeof supabaseAdminRestFetch;

type SupabaseSessionRepositoryOptions = {
  env?: NodeJS.ProcessEnv;
  adminFetch?: SupabaseAdminFetch;
  now?: () => Date;
};

type CompatibilitySessionRow = {
  user_id: unknown;
  email: unknown;
  full_name: unknown;
  roles: unknown;
  active_role: unknown;
  provider: unknown;
  created_at: unknown;
  expires_at: unknown;
};

type AuthorityRow = {
  user_id: string;
  auth_user_id: string;
  email: string;
  full_name: string;
  active_role_grant_id: string;
  active_role: string;
  branch_ids: unknown;
  department_ids: unknown;
  provider?: string;
  created_at?: string;
  expires_at?: string;
};

type SessionCreateRow = {
  session_id: string;
  command_id: string;
  session_created_at: string;
  session_expires_at: string;
  replayed: boolean;
};

type SessionRevokeRow = {
  session_id: string;
  command_id: string;
  session_revoked_at: string;
  replayed: boolean;
};

const durableSessionTtlSeconds = 12 * 60 * 60;

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function sessionRepositoryMode(env: NodeJS.ProcessEnv) {
  return clean(env.NILE_SESSION_REPOSITORY).toLowerCase() || "memory";
}

function compatibilitySessionTable(env: NodeJS.ProcessEnv) {
  const table =
    clean(env.NILE_COMPATIBILITY_SESSION_TABLE) ||
    "compatibility_auth_sessions";
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(table)) {
    throw new SessionRepositoryUnavailableError(
      "The compatibility session table name is invalid."
    );
  }
  return table;
}

function sessionTokenHash(sessionToken: string) {
  return crypto.createHash("sha256").update(sessionToken, "utf8").digest("hex");
}

function commandRequestHash(value: Record<string, string | number>) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(value), "utf8")
    .digest("hex");
}

function commandIdempotencyKey(
  command: "session.create" | "session.revoke",
  tokenHash: string
) {
  return `${command}:${tokenHash}`;
}

function authorityScopes(value: unknown) {
  if (!Array.isArray(value) || value.some(item => typeof item !== "string")) {
    throw new SessionRepositoryUnavailableError(
      "Durable session authority returned invalid scope data."
    );
  }
  return value as string[];
}

function requiredScopesPresent(
  role: ServerRole,
  branchIds: string[],
  departmentIds: string[]
) {
  if (role === "superadmin") {
    return branchIds.length === 0 && departmentIds.length === 0;
  }
  if (["student", "registrar", "branchadmin"].includes(role)) {
    return branchIds.length > 0 && departmentIds.length === 0;
  }
  if (role === "teacher") {
    return branchIds.length > 0 && departmentIds.length > 0;
  }
  return departmentIds.length > 0;
}

function identityFromAuthority(
  row: AuthorityRow
): ResolvedSessionIdentity | null {
  if (!serverRoles.has(row.active_role as ServerRole)) {
    throw new SessionRepositoryUnavailableError(
      "Durable session authority returned an invalid role."
    );
  }
  const activeRole = row.active_role as ServerRole;
  const branchIds = authorityScopes(row.branch_ids);
  const departmentIds = authorityScopes(row.department_ids);
  if (!requiredScopesPresent(activeRole, branchIds, departmentIds)) return null;
  return {
    userId: row.user_id,
    authUserId: row.auth_user_id,
    email: row.email,
    name: row.full_name,
    activeRole,
    activeRoleGrantId: row.active_role_grant_id,
    branchIds,
    departmentIds,
  };
}

function requireSingleRow<T>(
  rows: T[],
  label: string,
  ambiguity: "unavailable" | "denied" = "unavailable"
) {
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    if (ambiguity === "denied") {
      throw new SessionAuthorityDeniedError(
        `Session authority is ambiguous for ${label}.`
      );
    }
    throw new SessionRepositoryUnavailableError(
      `Durable session authority is ambiguous for ${label}.`
    );
  }
  return rows[0];
}

export function createMemorySessionRepository(): SessionRepository {
  const sessions = new Map<string, ServerSession>();
  return {
    kind: "memory",
    create(session) {
      sessions.set(session.id, session);
    },
    get(sessionToken) {
      return sessions.get(sessionToken) ?? null;
    },
    delete(sessionToken) {
      sessions.delete(sessionToken);
    },
    clear() {
      sessions.clear();
    },
  };
}

export function createSupabaseCompatibilitySessionRepository(
  options: SupabaseSessionRepositoryOptions = {}
): SessionRepository {
  const env = options.env ?? process.env;
  const adminFetch = options.adminFetch ?? supabaseAdminRestFetch;
  const now = options.now ?? (() => new Date());
  const table = compatibilitySessionTable(env);

  if (!getSupabaseServerStatus(env).adminAvailable) {
    throw new SessionRepositoryUnavailableError(
      "The Supabase compatibility session repository requires SUPABASE_URL and a server-only secret key."
    );
  }

  async function repositoryFetch(path: string, init: RequestInit) {
    try {
      return await adminFetch(path, init, env);
    } catch (error) {
      if (error instanceof SessionRepositoryUnavailableError) throw error;
      throw new SessionRepositoryUnavailableError();
    }
  }

  function sessionFromRow(
    sessionToken: string,
    row: CompatibilitySessionRow
  ): ServerSession {
    const activeRole = clean(row.active_role);
    const roles = Array.isArray(row.roles)
      ? row.roles.filter((role): role is ServerRole =>
          serverRoles.has(role as ServerRole)
        )
      : [];
    const provider = clean(row.provider);
    const createdAt = clean(row.created_at);
    const expiresAt = clean(row.expires_at);
    if (
      !serverRoles.has(activeRole as ServerRole) ||
      !roles.includes(activeRole as ServerRole) ||
      !Array.isArray(row.roles) ||
      roles.length !== row.roles.length ||
      (provider !== "demo" && provider !== "supabase") ||
      !clean(row.user_id) ||
      !clean(row.email) ||
      !clean(row.full_name) ||
      !Number.isFinite(Date.parse(createdAt)) ||
      !Number.isFinite(Date.parse(expiresAt))
    ) {
      throw new SessionRepositoryUnavailableError(
        "The compatibility session repository returned invalid authority data."
      );
    }
    return {
      id: sessionToken,
      userId: clean(row.user_id),
      email: clean(row.email),
      name: clean(row.full_name),
      roles,
      activeRole: activeRole as ServerRole,
      provider,
      authorizationModel: "snapshot",
      createdAt,
      expiresAt,
    };
  }

  return {
    kind: "supabase_compatibility",
    async create(session) {
      if (session.authorizationModel === "normalized") {
        throw new SessionAuthorityDeniedError(
          "Normalized sessions must use the normalized Supabase repository."
        );
      }
      const response = await repositoryFetch(table, {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          token_hash: sessionTokenHash(session.id),
          user_id: session.userId,
          email: session.email,
          full_name: session.name,
          roles: session.roles,
          active_role: session.activeRole,
          provider: session.provider,
          created_at: session.createdAt,
          expires_at: session.expiresAt,
        }),
      });
      if (!response.ok) {
        throw new SessionRepositoryUnavailableError(
          `Compatibility session creation failed with status ${response.status}.`
        );
      }
    },
    async get(sessionToken) {
      const tokenHash = sessionTokenHash(sessionToken);
      const response = await repositoryFetch(
        `${table}?token_hash=eq.${tokenHash}&revoked_at=is.null&select=user_id,email,full_name,roles,active_role,provider,created_at,expires_at&limit=1`,
        { method: "GET" }
      );
      if (!response.ok) {
        throw new SessionRepositoryUnavailableError(
          `Compatibility session lookup failed with status ${response.status}.`
        );
      }
      let rows: unknown;
      try {
        rows = await response.json();
      } catch {
        throw new SessionRepositoryUnavailableError(
          "Compatibility session lookup returned invalid JSON."
        );
      }
      if (!Array.isArray(rows)) {
        throw new SessionRepositoryUnavailableError(
          "Compatibility session lookup returned an invalid response."
        );
      }
      if (rows.length === 0) return null;
      if (rows.length !== 1) {
        throw new SessionRepositoryUnavailableError(
          "Compatibility session lookup returned ambiguous authority."
        );
      }
      const session = sessionFromRow(
        sessionToken,
        rows[0] as CompatibilitySessionRow
      );
      return Date.parse(session.expiresAt) <= now().getTime() ? null : session;
    },
    async delete(sessionToken) {
      const tokenHash = sessionTokenHash(sessionToken);
      const response = await repositoryFetch(
        `${table}?token_hash=eq.${tokenHash}&revoked_at=is.null`,
        {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ revoked_at: now().toISOString() }),
        }
      );
      if (!response.ok) {
        throw new SessionRepositoryUnavailableError(
          `Compatibility session revocation failed with status ${response.status}.`
        );
      }
    },
    clear() {
      throw new Error("Compatibility sessions cannot be cleared in bulk.");
    },
  };
}

export function createSupabaseSessionRepository(
  options: SupabaseSessionRepositoryOptions = {}
): SessionRepository {
  const env = options.env ?? process.env;
  const adminFetch = options.adminFetch ?? supabaseAdminRestFetch;
  const now = options.now ?? (() => new Date());

  if (!getSupabaseServerStatus(env).adminAvailable) {
    throw new SessionRepositoryUnavailableError(
      "The Supabase session repository requires SUPABASE_URL and a server-only secret key."
    );
  }

  async function repositoryFetch(path: string, init: RequestInit) {
    try {
      return await adminFetch(path, init, env);
    } catch (error) {
      if (error instanceof SessionRepositoryUnavailableError) throw error;
      throw new SessionRepositoryUnavailableError();
    }
  }

  async function rpcRows<T>(
    functionName: string,
    body: Record<string, unknown>,
    operation: string
  ) {
    const response = await repositoryFetch(`rpc/${functionName}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      let databaseCode = "";
      try {
        const payload = (await response.json()) as { code?: unknown };
        databaseCode = clean(payload.code);
      } catch {
        databaseCode = "";
      }
      const codeSuffix = databaseCode ? ` (${databaseCode})` : "";
      if (response.status === 409) {
        throw new SessionCommandConflictError(
          `Durable session ${operation} conflicts with existing evidence${codeSuffix}.`
        );
      }
      if (response.status === 403) {
        throw new SessionAuthorityDeniedError(
          `Durable session ${operation} was denied by current authority${codeSuffix}.`
        );
      }
      throw new SessionRepositoryUnavailableError(
        `Durable session ${operation} failed with status ${response.status}${codeSuffix}.`
      );
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new SessionRepositoryUnavailableError(
        `Durable session ${operation} returned invalid JSON.`
      );
    }
    if (!Array.isArray(payload)) {
      throw new SessionRepositoryUnavailableError(
        `Durable session ${operation} returned an invalid response.`
      );
    }
    return payload as T[];
  }

  return {
    kind: "supabase",
    async resolveSupabaseIdentity(authUserId, requestedRole) {
      const rows = await rpcRows<AuthorityRow>(
        "resolve_login_authority",
        {
          p_auth_user_id: authUserId,
          p_requested_role: requestedRole,
        },
        "login authority lookup"
      );
      const row = requireSingleRow(
        rows,
        "Supabase Auth user and role grant",
        "denied"
      );
      return row ? identityFromAuthority(row) : null;
    },
    async create(session) {
      if (
        session.provider !== "supabase" ||
        !session.activeRoleGrantId ||
        !session.authUserId
      ) {
        throw new Error(
          "Durable sessions require a mapped Supabase identity and active role grant."
        );
      }
      const tokenHash = sessionTokenHash(session.id);
      const request = {
        command: "session.create",
        tokenHash,
        userId: session.userId,
        authUserId: session.authUserId,
        activeRoleGrantId: session.activeRoleGrantId,
        ttlSeconds: durableSessionTtlSeconds,
      };
      const rows = await rpcRows<SessionCreateRow>(
        "create_auth_session_with_evidence",
        {
          p_token_hash: tokenHash,
          p_user_id: session.userId,
          p_auth_user_id: session.authUserId,
          p_active_role_grant_id: session.activeRoleGrantId,
          p_ttl_seconds: durableSessionTtlSeconds,
          p_idempotency_key: commandIdempotencyKey("session.create", tokenHash),
          p_request_hash: commandRequestHash(request),
        },
        "creation"
      );
      const row = requireSingleRow(rows, "session create command");
      if (!row) {
        throw new SessionRepositoryUnavailableError(
          "Durable session creation returned no evidence."
        );
      }
      const createdAt = Date.parse(row.session_created_at);
      const expiresAt = Date.parse(row.session_expires_at);
      if (!Number.isFinite(createdAt) || !Number.isFinite(expiresAt)) {
        throw new SessionRepositoryUnavailableError(
          "Durable session creation returned invalid timestamps."
        );
      }
      return {
        createdAt: row.session_created_at,
        expiresAt: row.session_expires_at,
      };
    },
    async get(sessionToken) {
      const rows = await rpcRows<AuthorityRow>(
        "resolve_auth_session_authority",
        { p_token_hash: sessionTokenHash(sessionToken) },
        "lookup"
      );
      const row = requireSingleRow(rows, "session token");
      if (!row) return null;
      const identity = identityFromAuthority(row);
      if (
        !identity ||
        row.provider !== "supabase" ||
        !row.created_at ||
        !row.expires_at
      ) {
        return null;
      }
      const createdAt = Date.parse(row.created_at);
      const expiresAt = Date.parse(row.expires_at);
      if (!Number.isFinite(createdAt) || !Number.isFinite(expiresAt)) {
        throw new SessionRepositoryUnavailableError(
          "Durable session lookup returned invalid timestamps."
        );
      }
      if (expiresAt <= now().getTime()) return null;
      return {
        id: sessionToken,
        ...identity,
        roles: [identity.activeRole],
        provider: "supabase",
        authorizationModel: "normalized",
        createdAt: row.created_at,
        expiresAt: row.expires_at,
      };
    },
    async delete(sessionToken) {
      const tokenHash = sessionTokenHash(sessionToken);
      const rows = await rpcRows<SessionRevokeRow>(
        "revoke_auth_session_with_evidence",
        {
          p_token_hash: tokenHash,
          p_idempotency_key: commandIdempotencyKey("session.revoke", tokenHash),
          p_request_hash: commandRequestHash({
            command: "session.revoke",
            tokenHash,
          }),
        },
        "revocation"
      );
      requireSingleRow(rows, "session revoke command");
    },
    clear() {
      throw new Error("Durable sessions cannot be cleared in bulk.");
    },
  };
}

export function createSupabaseHybridSessionRepository(
  options: SupabaseSessionRepositoryOptions = {}
): SessionRepository {
  const normalized = createSupabaseSessionRepository(options);
  const compatibility = createSupabaseCompatibilitySessionRepository(options);

  return {
    kind: "supabase_hybrid",
    resolveSupabaseIdentity(authUserId, requestedRole) {
      return normalized.resolveSupabaseIdentity!(authUserId, requestedRole);
    },
    create(session) {
      return session.authorizationModel === "normalized"
        ? normalized.create(session)
        : compatibility.create(session);
    },
    async get(sessionToken) {
      const normalizedSession = await normalized.get(sessionToken);
      return normalizedSession ?? compatibility.get(sessionToken);
    },
    async delete(sessionToken) {
      const session = await this.get(sessionToken);
      if (!session) return;
      await (session.authorizationModel === "normalized"
        ? normalized.delete(sessionToken)
        : compatibility.delete(sessionToken));
    },
    clear() {
      throw new Error("Hybrid sessions cannot be cleared in bulk.");
    },
  };
}

const defaultMemoryRepository = createMemorySessionRepository();
let repositoryOverride: SessionRepository | null = null;
let defaultSupabaseRepository: SessionRepository | null = null;
let defaultSupabaseCompatibilityRepository: SessionRepository | null = null;
let defaultSupabaseHybridRepository: SessionRepository | null = null;

export function getSessionRepository(env: NodeJS.ProcessEnv = process.env) {
  if (repositoryOverride) return repositoryOverride;
  const mode = sessionRepositoryMode(env);
  if (mode === "memory") return defaultMemoryRepository;
  if (mode === "supabase") {
    defaultSupabaseRepository ??= createSupabaseSessionRepository({ env });
    return defaultSupabaseRepository;
  }
  if (mode === "supabase_compatibility") {
    defaultSupabaseCompatibilityRepository ??=
      createSupabaseCompatibilitySessionRepository({ env });
    return defaultSupabaseCompatibilityRepository;
  }
  if (mode === "supabase_hybrid") {
    defaultSupabaseHybridRepository ??=
      createSupabaseHybridSessionRepository({ env });
    return defaultSupabaseHybridRepository;
  }
  throw new SessionRepositoryUnavailableError(
    `Unsupported NILE_SESSION_REPOSITORY value: ${mode}. Use memory, supabase_compatibility, supabase_hybrid, or supabase.`
  );
}

export function initializeSessionRepository(
  env: NodeJS.ProcessEnv = process.env
) {
  return getSessionRepository(env);
}

export function setSessionRepository(repository: SessionRepository) {
  const previous = repositoryOverride;
  repositoryOverride = repository;
  return () => {
    repositoryOverride = previous;
  };
}

export function resetDefaultSessionRepository() {
  defaultMemoryRepository.clear();
  defaultSupabaseRepository = null;
  defaultSupabaseCompatibilityRepository = null;
  defaultSupabaseHybridRepository = null;
  repositoryOverride = null;
}

export const getSessionStore = getSessionRepository;
export const setSessionStore = setSessionRepository;
export const resetDefaultSessionStore = resetDefaultSessionRepository;
