import crypto from "node:crypto";
import type { Request, Response } from "express";

export type ServerRole = "student" | "teacher" | "registrar" | "headofdepartment" | "branchadmin" | "superadmin";

export type ServerSession = {
  id: string;
  userId: string;
  email: string;
  name: string;
  roles: ServerRole[];
  activeRole: ServerRole;
  provider: "supabase" | "demo";
  createdAt: string;
  expiresAt: string;
};

const COOKIE_NAME = "nilelearn_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const sessions = new Map<string, ServerSession>();

const demoUsers: Record<ServerRole, { id: string; email: string; name: string }> = {
  student: { id: "usr_student_demo", email: "student.demo@nilelearn.local", name: "Student Demo" },
  teacher: { id: "usr_teacher_demo", email: "teacher.demo@nilelearn.local", name: "Teacher Demo" },
  registrar: { id: "usr_registrar_demo", email: "registrar.demo@nilelearn.local", name: "Registrar Demo" },
  headofdepartment: { id: "usr_hod_demo", email: "hod.demo@nilelearn.local", name: "HOD Demo" },
  branchadmin: { id: "usr_branch_demo", email: "branch.demo@nilelearn.local", name: "Branch Demo" },
  superadmin: { id: "usr_admin_demo", email: "admin.demo@nilelearn.local", name: "Admin Demo" },
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function isServerRole(value: unknown): value is ServerRole {
  return typeof value === "string" && value in demoUsers;
}

function demoAuthEnabled() {
  const explicit = process.env.DEMO_AUTH_ENABLED ?? process.env.VITE_DEMO_AUTH_ENABLED;
  if (explicit !== undefined) return explicit === "true";
  return process.env.NODE_ENV !== "production";
}

function parseCookies(req: Request) {
  return Object.fromEntries(
    (req.headers.cookie ?? "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [name, ...rest] = part.split("=");
        return [decodeURIComponent(name), decodeURIComponent(rest.join("="))];
      }),
  );
}

function writeSessionCookie(res: Response, sessionId: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(sessionId)}; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}; HttpOnly; SameSite=Lax${secure}`,
  );
}

export function clearSessionCookie(res: Response) {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
}

function createSession(input: Omit<ServerSession, "id" | "createdAt" | "expiresAt">) {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const session: ServerSession = { id, createdAt, expiresAt, ...input };
  sessions.set(id, session);
  return session;
}

export function getRequestSession(req: Request) {
  const sessionId = parseCookies(req)[COOKIE_NAME];
  if (!sessionId) return null;
  const session = sessions.get(sessionId);
  if (!session) return null;
  if (Date.parse(session.expiresAt) <= Date.now()) {
    sessions.delete(sessionId);
    return null;
  }
  return session;
}

export function endRequestSession(req: Request, res: Response) {
  const sessionId = parseCookies(req)[COOKIE_NAME];
  if (sessionId) sessions.delete(sessionId);
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
  const url = clean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL).replace(/\/+$/, "");
  const key = clean(process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);
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

async function signInWithSupabase(email: string, password: string, requestedRole: ServerRole) {
  const config = getSupabaseAuthConfig();
  if (!config.url || !config.key) return null;

  const response = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) return null;

  const payload = (await response.json()) as { user?: SupabaseAuthUser };
  const user = payload.user;
  if (!user) return null;

  const roles = rolesFromAppMetadata(user);
  if (!roles.includes(requestedRole)) {
    throw new Error("Your Supabase account is missing the requested role in app_metadata.");
  }

  return createSession({
    userId: clean(user.app_metadata?.demo_user_id) || user.id,
    email: user.email ?? email,
    name: user.app_metadata?.full_name ?? user.app_metadata?.name ?? email,
    roles,
    activeRole: requestedRole,
    provider: "supabase",
  });
}

function signInWithDemo(email: string, password: string, requestedRole: ServerRole) {
  if (!demoAuthEnabled()) return null;
  const user = demoUsers[requestedRole];
  if (clean(email).toLowerCase() !== user.email || clean(password).length < 4) return null;

  return createSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    roles: [requestedRole],
    activeRole: requestedRole,
    provider: "demo",
  });
}

export async function signIn(email: string, password: string, requestedRole: ServerRole) {
  const supabaseSession = await signInWithSupabase(email, password, requestedRole);
  if (supabaseSession) return supabaseSession;

  const demoSession = signInWithDemo(email, password, requestedRole);
  if (demoSession) return demoSession;

  throw new Error("Invalid email, password, or role.");
}

export function attachSession(res: Response, session: ServerSession) {
  writeSessionCookie(res, session.id);
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
