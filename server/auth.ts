import crypto from "node:crypto";
import {
  getSessionRepository,
  SessionAuthorityDeniedError,
} from "./sessionRepository.js";

export class AuthenticationAuthorityError extends Error {
  constructor(
    message = "This account is not authorized for the requested role."
  ) {
    super(message);
    this.name = "AuthenticationAuthorityError";
  }
}

export class AuthenticationProviderUnavailableError extends Error {
  constructor(
    message = "The authentication provider is temporarily unavailable."
  ) {
    super(message);
    this.name = "AuthenticationProviderUnavailableError";
  }
}

export type ServerRole =
  | "student"
  | "teacher"
  | "registrar"
  | "headofdepartment"
  | "branchadmin"
  | "superadmin";

export type ServerSession = {
  id: string;
  userId: string;
  email: string;
  name: string;
  roles: ServerRole[];
  activeRole: ServerRole;
  authUserId?: string;
  activeRoleGrantId?: string;
  branchIds?: string[];
  departmentIds?: string[];
  provider: "supabase" | "demo";
  authorizationModel?: "snapshot" | "normalized";
  createdAt: string;
  expiresAt: string;
};

const COOKIE_NAME = "nilelearn_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

const demoUsers: Record<
  ServerRole,
  { id: string; email: string; name: string }
> = {
  student: {
    id: "usr_student_demo",
    email: "student.demo@nilelearn.local",
    name: "Student Demo",
  },
  teacher: {
    id: "usr_teacher_demo",
    email: "teacher.demo@nilelearn.local",
    name: "Teacher Demo",
  },
  registrar: {
    id: "usr_registrar_demo",
    email: "registrar.demo@nilelearn.local",
    name: "Registrar Demo",
  },
  headofdepartment: {
    id: "usr_hod_demo",
    email: "hod.demo@nilelearn.local",
    name: "HOD Demo",
  },
  branchadmin: {
    id: "usr_branch_demo",
    email: "branch.demo@nilelearn.local",
    name: "Branch Demo",
  },
  superadmin: {
    id: "usr_admin_demo",
    email: "admin.demo@nilelearn.local",
    name: "Admin Demo",
  },
};
const demoEmailAliases: Record<ServerRole, string> = {
  student: "s@nl.test",
  teacher: "t@nl.test",
  registrar: "r@nl.test",
  headofdepartment: "h@nl.test",
  branchadmin: "b@nl.test",
  superadmin: "a@nl.test",
};
const DEMO_RESET_TTL_MS = 1000 * 60 * 20;
const demoResetTokens = new Map<
  string,
  { email: string; role: ServerRole; expiresAt: number }
>();
const demoPasswordOverrides = new Map<string, string>();

type SessionCookieRequest = {
  headers: {
    cookie?: string;
  };
};

type SessionCookieResponse = {
  setHeader(name: string, value: string): void;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function isServerRole(value: unknown): value is ServerRole {
  return typeof value === "string" && value in demoUsers;
}

function demoAuthEnabled() {
  const explicit =
    process.env.DEMO_AUTH_ENABLED ?? process.env.VITE_DEMO_AUTH_ENABLED;
  if (explicit !== undefined) {
    if (explicit !== "true") return false;
    if (process.env.NODE_ENV === "production") {
      return clean(process.env.NILE_DEMO_PASSWORD).length >= 8;
    }
    return true;
  }
  return process.env.NODE_ENV !== "production";
}

function localOnlySessionRuntime() {
  return (
    process.env.NILE_PLATFORM_STATE_LOCAL_ONLY === "1" ||
    process.env.QA_PLATFORM_STATE_LOCAL_ONLY === "1"
  );
}

export function validateAuthConfiguration() {
  const demoEnabled =
    (process.env.DEMO_AUTH_ENABLED ?? process.env.VITE_DEMO_AUTH_ENABLED) ===
    "true";
  if (
    process.env.NODE_ENV === "production" &&
    demoEnabled &&
    clean(process.env.NILE_DEMO_PASSWORD).length < 8
  ) {
    throw new Error(
      "Production demo authentication requires an explicit NILE_DEMO_PASSWORD with at least 8 characters."
    );
  }
  if (
    process.env.NODE_ENV === "production" &&
    demoEnabled &&
    !localOnlySessionRuntime() &&
    clean(process.env.NILE_SESSION_REPOSITORY).toLowerCase() !==
      "supabase_compatibility"
  ) {
    throw new Error(
      "Production demo authentication requires NILE_SESSION_REPOSITORY=supabase_compatibility so sessions survive server restarts and multiple instances."
    );
  }
}

function demoEmailCandidates(role: ServerRole) {
  return [demoUsers[role].email, demoEmailAliases[role]].map(value =>
    value.toLowerCase()
  );
}

function findDemoRoleByEmail(email: string, requestedRole?: ServerRole) {
  const emailValue = clean(email).toLowerCase();
  const roles = requestedRole
    ? [requestedRole]
    : (Object.keys(demoUsers) as ServerRole[]);
  return roles.find(role => demoEmailCandidates(role).includes(emailValue));
}

function demoPasswordAccepted(password: string, role?: ServerRole) {
  if (role) {
    const override = demoPasswordOverrides.get(demoUsers[role].email);
    if (override && clean(password) === override) return true;
  }
  const configuredPassword = clean(process.env.NILE_DEMO_PASSWORD);
  if (configuredPassword) return clean(password) === configuredPassword;
  return clean(password).length >= 4;
}

function parseCookies(req: SessionCookieRequest) {
  return Object.fromEntries(
    (req.headers.cookie ?? "")
      .split(";")
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => {
        const [name, ...rest] = part.split("=");
        return [decodeURIComponent(name), decodeURIComponent(rest.join("="))];
      })
  );
}

function sessionCookieMaxAgeSeconds(expiresAt: string) {
  const remainingMs = Date.parse(expiresAt) - Date.now();
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return 0;
  return Math.min(
    Math.floor(SESSION_TTL_MS / 1000),
    Math.floor(remainingMs / 1000)
  );
}

function writeSessionCookie(
  res: SessionCookieResponse,
  sessionId: string,
  expiresAt: string
) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(sessionId)}; Path=/; Max-Age=${sessionCookieMaxAgeSeconds(expiresAt)}; HttpOnly; SameSite=Lax${secureCookieAttribute()}`
  );
}

function secureCookieAttribute() {
  return process.env.NODE_ENV === "production" ? "; Secure" : "";
}

export function clearSessionCookie(res: SessionCookieResponse) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secureCookieAttribute()}`
  );
}

async function createSession(
  input: Omit<
    ServerSession,
    "id" | "createdAt" | "expiresAt" | "authorizationModel"
  >
) {
  const repository = getSessionRepository();
  const id = crypto.randomBytes(32).toString("base64url");
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const session: ServerSession = {
    id,
    createdAt,
    expiresAt,
    authorizationModel:
      repository.kind === "supabase" ? "normalized" : "snapshot",
    ...input,
  };
  const persistedTiming = await repository.create(session);
  return persistedTiming ? { ...session, ...persistedTiming } : session;
}

export async function getRequestSession(req: SessionCookieRequest) {
  const sessionId = parseCookies(req)[COOKIE_NAME];
  if (!sessionId) return null;
  const repository = getSessionRepository();
  const session = await repository.get(sessionId);
  if (!session) return null;
  if (Date.parse(session.expiresAt) <= Date.now()) {
    await repository.delete(sessionId);
    return null;
  }
  return session;
}

export async function endRequestSession(
  req: SessionCookieRequest,
  res: SessionCookieResponse
) {
  const sessionId = parseCookies(req)[COOKIE_NAME];
  if (sessionId) await getSessionRepository().delete(sessionId);
  clearSessionCookie(res);
}

type SupabaseAuthUser = {
  id: string;
  email?: string;
  app_metadata?: {
    role?: ServerRole;
    roles?: ServerRole[];
    full_name?: string;
    name?: string;
    demo_user_id?: string;
    branch_id?: string;
    department_id?: string;
  };
};

function getSupabaseAuthConfig() {
  const url = clean(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  ).replace(/\/+$/, "");
  const key = clean(
    process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY
  );
  return { url, key };
}

function rolesFromAppMetadata(user: SupabaseAuthUser) {
  const rawRoles = Array.isArray(user.app_metadata?.roles)
    ? user.app_metadata.roles
    : user.app_metadata?.role
      ? [user.app_metadata.role]
      : [];
  return rawRoles.filter(isServerRole);
}

async function signInWithSupabase(
  email: string,
  password: string,
  requestedRole: ServerRole
) {
  const config = getSupabaseAuthConfig();
  if (!config.url || !config.key) return null;

  let response: Response;
  try {
    response = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new AuthenticationProviderUnavailableError();
  }
  if (!response.ok) {
    if (response.status >= 500 || response.status === 429) {
      throw new AuthenticationProviderUnavailableError();
    }
    return null;
  }

  let payload: { user?: SupabaseAuthUser };
  try {
    payload = (await response.json()) as { user?: SupabaseAuthUser };
  } catch {
    throw new AuthenticationProviderUnavailableError();
  }
  const user = payload.user;
  if (!user) throw new AuthenticationProviderUnavailableError();

  const repository = getSessionRepository();
  if (repository.kind === "supabase") {
    let identity;
    try {
      identity = await repository.resolveSupabaseIdentity?.(
        user.id,
        requestedRole
      );
    } catch (error) {
      if (error instanceof SessionAuthorityDeniedError) {
        throw new AuthenticationAuthorityError();
      }
      throw error;
    }
    if (!identity) {
      throw new AuthenticationAuthorityError();
    }
    return createSession({
      userId: identity.userId,
      authUserId: identity.authUserId,
      email: identity.email,
      name: identity.name,
      roles: [identity.activeRole],
      activeRole: identity.activeRole,
      activeRoleGrantId: identity.activeRoleGrantId,
      branchIds: identity.branchIds,
      departmentIds: identity.departmentIds,
      provider: "supabase",
    });
  }

  const roles = rolesFromAppMetadata(user);
  if (!roles.includes(requestedRole)) {
    throw new AuthenticationAuthorityError();
  }

  const compatibilityUserId = clean(user.app_metadata?.demo_user_id);
  if (!compatibilityUserId) throw new AuthenticationAuthorityError();

  return createSession({
    userId: compatibilityUserId,
    email: user.email ?? email,
    name: user.app_metadata?.full_name ?? user.app_metadata?.name ?? email,
    roles,
    activeRole: requestedRole,
    provider: "supabase",
  });
}

async function signInWithDemo(
  email: string,
  password: string,
  requestedRole: ServerRole
) {
  if (!demoAuthEnabled()) return null;
  const user = demoUsers[requestedRole];
  const emailValue = clean(email).toLowerCase();
  if (
    !demoEmailCandidates(requestedRole).includes(emailValue) ||
    !demoPasswordAccepted(password, requestedRole)
  )
    return null;

  return createSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    roles: [requestedRole],
    activeRole: requestedRole,
    provider: "demo",
  });
}

export function requestDemoPasswordReset(
  email: string,
  requestedRole?: ServerRole
) {
  const role = demoAuthEnabled()
    ? findDemoRoleByEmail(email, requestedRole)
    : undefined;
  const expiresAt = Date.now() + DEMO_RESET_TTL_MS;
  if (!role) {
    return { ok: true as const };
  }
  const token = crypto.randomUUID();
  demoResetTokens.set(token, { email: demoUsers[role].email, role, expiresAt });
  const params = new URLSearchParams({ token, email: demoUsers[role].email });
  return {
    ok: true as const,
    expiresAt: new Date(expiresAt).toISOString(),
    demoResetPath: `/auth/reset-password?${params.toString()}`,
  };
}

export function confirmDemoPasswordReset(input: {
  token: string;
  email: string;
  password: string;
}) {
  if (!demoAuthEnabled()) throw new Error("Password reset is not available.");
  const token = clean(input.token);
  const email = clean(input.email).toLowerCase();
  const password = clean(input.password);
  const reset = demoResetTokens.get(token);
  if (
    !reset ||
    reset.expiresAt <= Date.now() ||
    reset.email.toLowerCase() !== email
  ) {
    throw new Error("Reset link is invalid or expired.");
  }
  if (password.length < 8) {
    throw new Error("Use at least 8 characters.");
  }
  demoPasswordOverrides.set(reset.email, password);
  demoResetTokens.delete(token);
  return { ok: true as const, role: reset.role };
}

export function changeDemoPasswordForSession(
  session: ServerSession,
  input: { currentPassword: string; newPassword: string }
) {
  if (session.provider !== "demo") {
    throw new Error("Password changes are managed by your sign-in provider.");
  }
  if (!demoAuthEnabled()) throw new Error("Password change is not available.");
  const currentPassword = clean(input.currentPassword);
  const newPassword = clean(input.newPassword);
  if (!demoPasswordAccepted(currentPassword, session.activeRole)) {
    throw new Error("Current password is incorrect.");
  }
  if (newPassword.length < 8) {
    throw new Error("Use at least 8 characters.");
  }
  demoPasswordOverrides.set(demoUsers[session.activeRole].email, newPassword);
  return { ok: true as const, role: session.activeRole };
}

export function resetDemoPasswordResetState() {
  demoResetTokens.clear();
  demoPasswordOverrides.clear();
}

export async function signIn(
  email: string,
  password: string,
  requestedRole: ServerRole
) {
  const supabaseSession = await signInWithSupabase(
    email,
    password,
    requestedRole
  );
  if (supabaseSession) return supabaseSession;

  const demoSession = await signInWithDemo(email, password, requestedRole);
  if (demoSession) return demoSession;

  throw new Error("Invalid email, password, or role.");
}

export function attachSession(
  res: SessionCookieResponse,
  session: ServerSession
) {
  writeSessionCookie(res, session.id, session.expiresAt);
  return {
    userId: session.userId,
    email: session.email,
    name: session.name,
    roles: session.roles,
    activeRole: session.activeRole,
    provider: session.provider,
    expiresAt: session.expiresAt,
  };
}
