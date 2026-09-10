import crypto from "node:crypto";
import type { ServerRole, ServerSession } from "./auth.js";
import {
  createEmsStagingClient,
  extractTokens,
  mapEmsRoleToLocal,
  mapLocalRoleToEms,
  normalizeEmsBranches,
  normalizeEmsMe,
  resolveEmsStagingConfig,
  type EmsStagingClient,
  type EmsStagingMe,
  type EmsStagingTokens,
} from "./emsStagingClient.js";

const cookieName = "nilelearn_ncc_session";
const envelopePrefix = "v1.";
const associatedData = Buffer.from("nile-learn:ncc-auth-session:v1", "utf8");

type Request = { headers: { cookie?: string } };
type Response = { setHeader(name: string, value: string | string[]): void };
type RemoteResult =
  | { ok: true; data: unknown }
  | {
      ok: false;
      error: { error: string; status: number; details?: unknown };
    };

type NccSessionEnvelope = {
  session: ServerSession & {
    assignedRole: ServerRole;
    workspaceBranchId: string | null;
  };
  tokens: EmsStagingTokens;
};

export class NccAuthError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "NccAuthError";
    this.status = status;
    this.details = details;
  }
}

export function nccStaffAuthEnabled(env: NodeJS.ProcessEnv = process.env) {
  return ["1", "true"].includes(
    (env.NILE_NCC_STAFF_AUTH_ENABLED ?? "").trim().toLowerCase()
  );
}

function encryptionKey(env: NodeJS.ProcessEnv) {
  const source = env.EMS_SESSION_SEAL_KEY?.trim() ?? "";
  if (source.length < 32) {
    throw new NccAuthError(
      503,
      "NCC EMS session protection is not configured."
    );
  }
  return crypto.createHash("sha256").update(source, "utf8").digest();
}

function readCookie(request: Request) {
  const value = (request.headers.cookie ?? "")
    .split(";")
    .map(part => part.trim())
    .find(part => part.startsWith(`${cookieName}=`));
  if (!value) return null;
  try {
    return decodeURIComponent(value.slice(value.indexOf("=") + 1));
  } catch {
    return null;
  }
}

function secureAttribute(env: NodeJS.ProcessEnv) {
  return env.NODE_ENV === "production" ? "; Secure" : "";
}

export function clearNccAuthCookie(
  response: Response,
  env: NodeJS.ProcessEnv = process.env
) {
  response.setHeader(
    "Set-Cookie",
    `${cookieName}=; Path=/api; Max-Age=0; HttpOnly; SameSite=Lax${secureAttribute(env)}`
  );
}

function validRole(value: unknown): value is ServerRole {
  return [
    "student",
    "teacher",
    "registrar",
    "headofdepartment",
    "branchadmin",
    "superadmin",
  ].includes(String(value));
}

function validateEnvelope(value: NccSessionEnvelope) {
  const session = value?.session;
  const tokens = value?.tokens;
  if (
    !session ||
    !tokens ||
    typeof session.id !== "string" ||
    !session.id ||
    typeof session.userId !== "string" ||
    !session.userId ||
    typeof session.email !== "string" ||
    !session.email ||
    typeof session.name !== "string" ||
    !session.name ||
    !Array.isArray(session.roles) ||
    !session.roles.every(validRole) ||
    !validRole(session.activeRole) ||
    !session.roles.includes(session.activeRole) ||
    !validRole(session.assignedRole) ||
    session.provider !== "ncc" ||
    session.authorizationModel !== "external" ||
    !Array.isArray(session.branchIds) ||
    !session.branchIds.every(id => typeof id === "string" && id) ||
    !Array.isArray(session.departmentIds) ||
    !session.departmentIds.every(id => typeof id === "string" && id) ||
    (session.workspaceBranchId !== null &&
      typeof session.workspaceBranchId !== "string") ||
    !Number.isFinite(Date.parse(session.createdAt)) ||
    !Number.isFinite(Date.parse(session.expiresAt)) ||
    typeof tokens.accessToken !== "string" ||
    !tokens.accessToken ||
    typeof tokens.refreshToken !== "string" ||
    !tokens.refreshToken ||
    !Number.isFinite(Date.parse(tokens.accessTokenExpiresAt)) ||
    !Number.isFinite(Date.parse(tokens.refreshTokenExpiresAt)) ||
    typeof tokens.sessionId !== "string" ||
    !tokens.sessionId ||
    tokens.sessionId !== session.id
  ) {
    throw new NccAuthError(401, "NCC EMS session is invalid.");
  }
}

function sealEnvelope(value: NccSessionEnvelope, env: NodeJS.ProcessEnv) {
  validateEnvelope(value);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(env), iv);
  cipher.setAAD(associatedData);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  const envelope = `${envelopePrefix}${Buffer.concat([
    iv,
    cipher.getAuthTag(),
    ciphertext,
  ]).toString("base64url")}`;
  if (envelope.length > 3_800) {
    throw new NccAuthError(502, "NCC EMS session is too large.");
  }
  return envelope;
}

function openEnvelope(request: Request, env: NodeJS.ProcessEnv) {
  const envelope = readCookie(request);
  if (!envelope) return null;
  if (!envelope.startsWith(envelopePrefix)) {
    throw new NccAuthError(401, "NCC EMS session is invalid.");
  }
  try {
    const packed = Buffer.from(
      envelope.slice(envelopePrefix.length),
      "base64url"
    );
    if (packed.length < 29) {
      throw new NccAuthError(401, "NCC EMS session is invalid.");
    }
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      encryptionKey(env),
      packed.subarray(0, 12)
    );
    decipher.setAAD(associatedData);
    decipher.setAuthTag(packed.subarray(12, 28));
    const value = JSON.parse(
      Buffer.concat([
        decipher.update(packed.subarray(28)),
        decipher.final(),
      ]).toString("utf8")
    ) as NccSessionEnvelope;
    validateEnvelope(value);
    return value;
  } catch (error) {
    if (error instanceof NccAuthError && error.status === 503) throw error;
    throw new NccAuthError(401, "NCC EMS session is invalid.");
  }
}

function writeEnvelope(
  response: Response,
  value: NccSessionEnvelope,
  env: NodeJS.ProcessEnv,
  clearCompatibility = false
) {
  const maxAge = Math.floor(
    (Date.parse(value.session.expiresAt) - Date.now()) / 1000
  );
  if (!Number.isFinite(maxAge) || maxAge <= 0) {
    throw new NccAuthError(401, "NCC EMS session expired.");
  }
  const sessionCookie = `${cookieName}=${encodeURIComponent(sealEnvelope(value, env))}; Path=/api; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secureAttribute(env)}`;
  response.setHeader(
    "Set-Cookie",
    clearCompatibility
      ? [
          `nilelearn_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secureAttribute(env)}`,
          sessionCookie,
        ]
      : sessionCookie
  );
}

function client(
  env: NodeJS.ProcessEnv,
  createClient?: NccAuthDependencies["createClient"]
) {
  const config = resolveEmsStagingConfig(env);
  if (!config) throw new NccAuthError(503, "NCC EMS is not configured.");
  return (
    createClient ??
    ((baseUrl: string, timeoutMs: number) =>
      createEmsStagingClient({ baseUrl, timeoutMs }))
  )(config.baseUrl, config.timeoutMs);
}

function remoteError(result: Extract<RemoteResult, { ok: false }>): never {
  throw new NccAuthError(
    result.error.status,
    result.error.error,
    result.error.details
  );
}

function buildEnvelope(
  me: EmsStagingMe,
  tokens: EmsStagingTokens,
  createdAt = new Date().toISOString()
): NccSessionEnvelope {
  const assignedRole = mapEmsRoleToLocal(me.assignedRole);
  const activeRole = mapEmsRoleToLocal(me.activeRole);
  if (!assignedRole || !activeRole || me.sessionId !== tokens.sessionId) {
    throw new NccAuthError(
      502,
      "NCC EMS returned inconsistent session authority."
    );
  }
  const scopedBranchIds = me.scopes
    .filter(
      scope => scope.scopeType === "branch" && scope.isLive && scope.scopeId
    )
    .map(scope => scope.scopeId as string);
  const branchIds = ["branchadmin", "registrar"].includes(activeRole)
    ? me.workspaceBranchId
      ? [me.workspaceBranchId]
      : []
    : scopedBranchIds;
  return {
    session: {
      id: tokens.sessionId,
      userId: me.userId,
      email: me.email,
      name: me.name,
      roles: [activeRole],
      activeRole,
      assignedRole,
      workspaceBranchId: me.workspaceBranchId,
      branchIds,
      departmentIds: me.departmentIds,
      provider: "ncc",
      authorizationModel: "external",
      createdAt,
      expiresAt: tokens.refreshTokenExpiresAt,
    },
    tokens,
  };
}

async function runWithRefresh(
  value: NccSessionEnvelope,
  api: EmsStagingClient,
  operation: (accessToken: string) => Promise<RemoteResult>
): Promise<{
  result: { ok: true; data: unknown };
  tokens: EmsStagingTokens;
  refreshed: boolean;
}> {
  const first = await operation(value.tokens.accessToken);
  if (first.ok)
    return { result: first, tokens: value.tokens, refreshed: false };
  if (first.error.status !== 401) remoteError(first);
  const refreshed = await api.refresh(value.tokens.refreshToken);
  if (!refreshed.ok) remoteError(refreshed);
  const tokens = extractTokens(refreshed.data);
  if (!tokens) throw new NccAuthError(502, "NCC EMS returned invalid tokens.");
  const second = await operation(tokens.accessToken);
  if (!second.ok) remoteError(second);
  return { result: second, tokens, refreshed: true };
}

export type NccAuthDependencies = {
  env?: NodeJS.ProcessEnv;
  createClient?: (baseUrl: string, timeoutMs: number) => EmsStagingClient;
};

export function validateNccAuthConfiguration(
  env: NodeJS.ProcessEnv = process.env
) {
  if (!nccStaffAuthEnabled(env)) return;
  if (!resolveEmsStagingConfig(env)) {
    throw new Error(
      "NCC staff authentication requires an allowlisted HTTPS EMS_STAGING_BASE_URL."
    );
  }
  encryptionKey(env);
}

export function hasNccAuthCookie(request: Request) {
  return Boolean(readCookie(request));
}

export function getNccRequestSession(
  request: Request,
  env: NodeJS.ProcessEnv = process.env
): ServerSession | null {
  if (!nccStaffAuthEnabled(env)) return null;
  try {
    const value = openEnvelope(request, env);
    if (!value || Date.parse(value.session.expiresAt) <= Date.now())
      return null;
    return value.session;
  } catch {
    return null;
  }
}

export async function loginNccStaff(
  email: string,
  password: string,
  response: Response,
  dependencies: NccAuthDependencies = {}
) {
  const env = dependencies.env ?? process.env;
  const api = client(env, dependencies.createClient);
  const login = await api.login(email, password);
  if (!login.ok) remoteError(login);
  const tokens = extractTokens(login.data);
  if (!tokens) throw new NccAuthError(502, "NCC EMS returned invalid tokens.");
  const meResult = await api.me(tokens.accessToken);
  if (!meResult.ok) {
    await api.logout(tokens.accessToken);
    remoteError(meResult);
  }
  const me = normalizeEmsMe(meResult.data);
  if (!me) {
    await api.logout(tokens.accessToken);
    throw new NccAuthError(502, "NCC EMS returned invalid session authority.");
  }
  const value = buildEnvelope(me, tokens);
  writeEnvelope(response, value, env, true);
  return value.session;
}

export async function resolveNccAuthSession(
  request: Request,
  response: Response,
  dependencies: NccAuthDependencies = {}
) {
  const env = dependencies.env ?? process.env;
  let value: NccSessionEnvelope | null;
  try {
    value = openEnvelope(request, env);
  } catch (error) {
    clearNccAuthCookie(response, env);
    if (error instanceof NccAuthError && error.status === 503) throw error;
    return null;
  }
  if (!value) return null;
  const api = client(env, dependencies.createClient);
  let resolved;
  try {
    resolved = await runWithRefresh(value, api, token => api.me(token));
  } catch (error) {
    if (error instanceof NccAuthError && error.status === 401) {
      clearNccAuthCookie(response, env);
      return null;
    }
    throw error;
  }
  const me = normalizeEmsMe(resolved.result.data);
  if (!me)
    throw new NccAuthError(502, "NCC EMS returned invalid session authority.");
  const next = buildEnvelope(me, resolved.tokens, value.session.createdAt);
  writeEnvelope(response, next, env);
  return next.session;
}

export async function switchNccRole(
  request: Request,
  response: Response,
  role: ServerRole,
  dependencies: NccAuthDependencies = {}
) {
  const env = dependencies.env ?? process.env;
  const value = openEnvelope(request, env);
  const targetRole = mapLocalRoleToEms(role);
  if (!value || !targetRole)
    throw new NccAuthError(403, "Role switch is not allowed.");
  const api = client(env, dependencies.createClient);
  const switched = await runWithRefresh(value, api, token =>
    api.switchRole(token, targetRole)
  );
  const tokens = extractTokens(switched.result.data);
  if (!tokens) throw new NccAuthError(502, "NCC EMS returned invalid tokens.");
  const meResult = await api.me(tokens.accessToken);
  if (!meResult.ok) remoteError(meResult);
  const me = normalizeEmsMe(meResult.data);
  if (!me || mapEmsRoleToLocal(me.activeRole) !== role) {
    throw new NccAuthError(
      502,
      "NCC EMS returned inconsistent role authority."
    );
  }
  const next = buildEnvelope(me, tokens, value.session.createdAt);
  writeEnvelope(response, next, env);
  return next.session;
}

export async function listNccWorkspaces(
  request: Request,
  response: Response,
  dependencies: NccAuthDependencies = {}
) {
  const env = dependencies.env ?? process.env;
  const value = openEnvelope(request, env);
  if (!value) throw new NccAuthError(401, "Sign in required.");
  const api = client(env, dependencies.createClient);
  const result = await runWithRefresh(value, api, token => api.branches(token));
  const branches = normalizeEmsBranches(result.result.data);
  if (!branches)
    throw new NccAuthError(502, "NCC EMS returned invalid branches.");
  if (result.refreshed) {
    const meResult = await api.me(result.tokens.accessToken);
    if (!meResult.ok) remoteError(meResult);
    const me = normalizeEmsMe(meResult.data);
    if (!me)
      throw new NccAuthError(
        502,
        "NCC EMS returned invalid session authority."
      );
    writeEnvelope(
      response,
      buildEnvelope(me, result.tokens, value.session.createdAt),
      env
    );
  }
  return branches
    .filter(branch => branch.status === "active")
    .map(({ id, name, timezone }) => ({ id, name, timezone }));
}

export async function switchNccWorkspace(
  request: Request,
  response: Response,
  branchId: string | null,
  dependencies: NccAuthDependencies = {}
) {
  const env = dependencies.env ?? process.env;
  const value = openEnvelope(request, env);
  if (!value) throw new NccAuthError(401, "Sign in required.");
  const api = client(env, dependencies.createClient);
  const result = await runWithRefresh(value, api, token =>
    api.switchWorkspace(token, branchId)
  );
  const me = normalizeEmsMe(result.result.data);
  if (!me || me.workspaceBranchId !== branchId) {
    throw new NccAuthError(
      502,
      "NCC EMS returned inconsistent workspace authority."
    );
  }
  const next = buildEnvelope(me, result.tokens, value.session.createdAt);
  writeEnvelope(response, next, env);
  return next.session;
}

export async function logoutNccSession(
  request: Request,
  response: Response,
  dependencies: NccAuthDependencies = {}
) {
  const env = dependencies.env ?? process.env;
  let value: NccSessionEnvelope | null;
  try {
    value = openEnvelope(request, env);
  } catch {
    clearNccAuthCookie(response, env);
    return;
  }
  if (!value) {
    clearNccAuthCookie(response, env);
    return;
  }
  const api = client(env, dependencies.createClient);
  try {
    await runWithRefresh(value, api, token => api.logout(token));
  } catch (error) {
    if (!(error instanceof NccAuthError) || error.status !== 401) throw error;
  }
  clearNccAuthCookie(response, env);
}
