import {
  getDemoUser,
  roleMeta,
  type DemoUser,
  type Role,
} from "@/lib/platformData";
import {
  fetchSessionRequest,
  logoutRequest,
  signInRequest,
  type AuthSessionDto,
} from "@/lib/backend/api";

const ACTIVE_ROLE_KEY = "nilelearn.activeRole";
const AUTH_SESSION_KEY = "nilelearn.auth.session";

function isRole(value: string | null): value is Role {
  return Boolean(value && value in roleMeta);
}

export function getStoredRole(): Role | null {
  if (typeof window === "undefined") return null;
  const session = getStoredAuthSession();
  return session?.activeRole ?? null;
}

export function setStoredRole(role: Role) {
  if (typeof window === "undefined") return;
  const session = getStoredAuthSession();
  if (!session || !session.roles.includes(role)) {
    window.localStorage.removeItem(ACTIVE_ROLE_KEY);
    window.dispatchEvent(
      new CustomEvent("nilelearn:session", { detail: null })
    );
    return;
  }
  window.localStorage.setItem(
    AUTH_SESSION_KEY,
    JSON.stringify({ ...session, activeRole: role })
  );
  window.localStorage.setItem(ACTIVE_ROLE_KEY, role);
  window.dispatchEvent(new CustomEvent("nilelearn:session", { detail: role }));
}

export function getStoredAuthSession(): AuthSessionDto | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(AUTH_SESSION_KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as AuthSessionDto;
    if (
      !isRole(session.activeRole) ||
      Date.parse(session.expiresAt) <= Date.now()
    ) {
      window.localStorage.removeItem(AUTH_SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    window.localStorage.removeItem(AUTH_SESSION_KEY);
    return null;
  }
}

function setStoredAuthSession(session: AuthSessionDto) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
  window.localStorage.setItem(ACTIVE_ROLE_KEY, session.activeRole);
  window.dispatchEvent(
    new CustomEvent("nilelearn:session", { detail: session.activeRole })
  );
}

function clearStoredSessionLocal() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_SESSION_KEY);
  window.localStorage.removeItem(ACTIVE_ROLE_KEY);
  window.dispatchEvent(new CustomEvent("nilelearn:session", { detail: null }));
}

export async function clearStoredSession() {
  const result = await logoutRequest();
  if (!result.ok) {
    return {
      ok: false as const,
      error: result.error ?? "Sign out could not be confirmed.",
    };
  }
  clearStoredSessionLocal();
  return { ok: true as const };
}

export async function signInWithPassword(
  email: string,
  password: string,
  role: Role
) {
  const result = await signInRequest({ email, password, role });
  if (result.ok && result.data) {
    setStoredAuthSession(result.data);
    return { ok: true as const, session: result.data };
  }
  return { ok: false as const, error: result.error ?? "Sign in failed." };
}

export async function refreshServerSession() {
  const result = await fetchSessionRequest();
  if (result.ok && result.data) {
    setStoredAuthSession(result.data);
    return result.data;
  }
  if (result.ok && result.data === null && typeof window !== "undefined") {
    clearStoredSessionLocal();
  }
  return null;
}

export function getActiveUser(): DemoUser | null {
  const session = getStoredAuthSession();
  if (!session) return null;
  const role = session.activeRole;
  const demoMetadata = getDemoUser(role);
  const initials = session.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join("");
  const compatibilityIdentity =
    session.provider === "demo" || session.authorizationModel === "snapshot";
  const branchIds = session.branchIds ?? [];
  const departmentIds = session.departmentIds ?? [];

  return {
    id: session.userId,
    email: session.email,
    name: session.name,
    roles: session.roles,
    activeRole: role,
    branch: compatibilityIdentity
      ? demoMetadata.branch
      : branchIds.length
        ? "Assigned branch"
        : role === "superadmin"
          ? "Global"
          : "No branch access",
    department: compatibilityIdentity
      ? demoMetadata.department
      : departmentIds.length
        ? "Assigned department"
        : role === "superadmin"
          ? "Platform"
          : "No department access",
    avatar: initials || demoMetadata.avatar,
  };
}

export function requireActiveUser(role?: Role): DemoUser {
  const user = getActiveUser();
  if (!user || (role && user.activeRole !== role)) {
    throw new Error("An authenticated portal identity is required.");
  }
  return user;
}

export function canAccessRole(requiredRole: Role) {
  const activeRole = getStoredRole();
  if (!activeRole)
    return { ok: false, reason: "not_authenticated" as const, activeRole };
  if (activeRole !== requiredRole)
    return { ok: false, reason: "wrong_role" as const, activeRole };
  return { ok: true, reason: "allowed" as const, activeRole };
}
