/**
 * Server-only adapter for the external NCC EMS staging API.
 *
 * Boundary (AGENTS.md): the external backend team owns the staging API. This
 * module is a read-favoring proxy, not a competing backend. Tokens stay in
 * server memory keyed by our own session id and are never sent to the browser
 * beyond the normalized `me` snapshot. Nothing here logs credentials.
 */

export const EMS_STAGING_DEFAULT_TIMEOUT_MS = 15000;

// Browser-like UA: the sibling Moodle host sits behind Cloudflare bot rules
// that reject default server UAs (error 1010). The EMS host is plain nginx,
// but the same UA keeps the whole staging chain consistent.
export const EMS_STAGING_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 NileLearnEmsStaging/1.0";

export type EmsStagingRole =
  | "super_admin"
  | "branch_admin"
  | "hod"
  | "registrar"
  | "teacher";

export type EmsStagingLocalRole =
  | "superadmin"
  | "branchadmin"
  | "headofdepartment"
  | "registrar"
  | "teacher";

const EMS_TO_LOCAL_ROLE: Record<EmsStagingRole, EmsStagingLocalRole> = {
  super_admin: "superadmin",
  branch_admin: "branchadmin",
  hod: "headofdepartment",
  registrar: "registrar",
  teacher: "teacher",
};

const LOCAL_TO_EMS_ROLE: Record<EmsStagingLocalRole, EmsStagingRole> = {
  superadmin: "super_admin",
  branchadmin: "branch_admin",
  headofdepartment: "hod",
  registrar: "registrar",
  teacher: "teacher",
};

export function mapEmsRoleToLocal(role: string): EmsStagingLocalRole | null {
  if (role === "super_admin") return "superadmin";
  if (role === "branch_admin") return "branchadmin";
  if (role === "hod") return "headofdepartment";
  if (role === "registrar") return "registrar";
  if (role === "teacher") return "teacher";
  return null;
}

export function mapLocalRoleToEms(role: string): EmsStagingRole | null {
  const mapped = LOCAL_TO_EMS_ROLE[role as EmsStagingLocalRole] ?? null;
  return mapped;
}

export function isEmsStagingRole(role: string): role is EmsStagingRole {
  return role in EMS_TO_LOCAL_ROLE;
}

export type EmsStagingConfig = {
  baseUrl: string;
  timeoutMs: number;
};

export function resolveEmsStagingConfig(
  env: {
    EMS_STAGING_BASE_URL?: unknown;
    EMS_STAGING_ALLOWED_HOSTS?: unknown;
    EMS_STAGING_TIMEOUT_MS?: unknown;
  } & Record<string, unknown>
): EmsStagingConfig | null {
  const rawBaseUrl =
    typeof env.EMS_STAGING_BASE_URL === "string"
      ? env.EMS_STAGING_BASE_URL
      : "";
  const rawAllowedHosts =
    typeof env.EMS_STAGING_ALLOWED_HOSTS === "string"
      ? env.EMS_STAGING_ALLOWED_HOSTS
      : "";
  const allowedHosts = new Set(
    rawAllowedHosts
      .split(",")
      .map(host => host.trim().toLowerCase())
      .filter(Boolean)
  );
  let parsedBaseUrl: URL;
  try {
    parsedBaseUrl = new URL(rawBaseUrl.trim().replace(/\/+$/, ""));
  } catch {
    return null;
  }
  if (
    parsedBaseUrl.protocol !== "https:" ||
    parsedBaseUrl.username ||
    parsedBaseUrl.password ||
    !allowedHosts.has(parsedBaseUrl.hostname.toLowerCase())
  ) {
    return null;
  }
  const parsedTimeout = Number(env.EMS_STAGING_TIMEOUT_MS);
  const timeoutMs =
    Number.isFinite(parsedTimeout) && parsedTimeout > 0
      ? Math.min(Math.floor(parsedTimeout), 60000)
      : EMS_STAGING_DEFAULT_TIMEOUT_MS;
  return {
    baseUrl: parsedBaseUrl.toString().replace(/\/$/, ""),
    timeoutMs,
  };
}

export type EmsStagingTokens = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  sessionId: string;
};

type EmsAuthPayload = {
  access_token?: unknown;
  refresh_token?: unknown;
  access_token_expires_at?: unknown;
  refresh_token_expires_at?: unknown;
  session_id?: unknown;
  user?: unknown;
};

export type EmsStagingError = {
  error: string;
  status: number;
  details?: unknown;
};

/**
 * Translate EMS error payloads into our `{ error, details }` shape.
 * EMS uses `{ detail: string }`, except 422 which is `{ detail: [...] }`.
 */
export function translateEmsError(
  status: number,
  payload: unknown
): Omit<EmsStagingError, "status"> {
  if (payload && typeof payload === "object" && "detail" in payload) {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === "string" && detail.trim()) {
      return { error: detail };
    }
    if (Array.isArray(detail)) {
      const first = detail.find(
        (entry): entry is { loc?: unknown; msg?: unknown } =>
          Boolean(entry) && typeof entry === "object"
      );
      const field =
        first && Array.isArray(first.loc) && first.loc.length > 0
          ? String(first.loc[first.loc.length - 1])
          : null;
      const message =
        first && typeof first.msg === "string" && first.msg.trim()
          ? first.msg.trim()
          : "Validation failed.";
      return {
        error: field ? `Validation failed: ${field} ${message}` : message,
        details: detail,
      };
    }
  }
  return { error: `Request failed with ${status}` };
}

type FetchImpl = (input: string, init?: RequestInit) => Promise<Response>;

export type EmsStagingClientOptions = {
  baseUrl: string;
  timeoutMs?: number;
  userAgent?: string;
  fetchImpl?: FetchImpl;
};

export type EmsStagingMe = {
  sessionId: string;
  userId: string;
  email: string;
  name: string;
  assignedRole: EmsStagingRole;
  activeRole: EmsStagingRole;
  workspaceBranchId: string | null;
  departmentIds: string[];
  scopes: Array<{
    scopeType: "global" | "branch";
    scopeId: string | null;
    isLive: boolean;
  }>;
};

export type EmsStagingBranch = {
  id: string;
  name: string;
  status: "active" | "disabled";
  timezone: string;
};

function normalizeMe(payload: unknown): EmsStagingMe | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const user =
    record.user && typeof record.user === "object"
      ? (record.user as Record<string, unknown>)
      : null;
  const profile =
    user?.profile && typeof user.profile === "object"
      ? (user.profile as Record<string, unknown>)
      : null;
  const assignedRole =
    typeof record.assigned_role === "string" ? record.assigned_role : "";
  const activeRole =
    typeof record.active_role === "string" ? record.active_role : "";
  const sessionId =
    typeof record.session_id === "string" ? record.session_id : "";
  const userId = typeof user?.id === "string" ? user.id : "";
  const email = typeof user?.email === "string" ? user.email : "";
  if (
    !isEmsStagingRole(assignedRole) ||
    !isEmsStagingRole(activeRole) ||
    !sessionId ||
    !userId ||
    !email ||
    !Array.isArray(record.scopes)
  ) {
    return null;
  }
  const scopes = record.scopes.map(scope => {
    if (!scope || typeof scope !== "object") return null;
    const entry = scope as Record<string, unknown>;
    const scopeType = entry.scope_type;
    const scopeId = entry.scope_id;
    if (
      (scopeType !== "global" && scopeType !== "branch") ||
      (scopeId !== null && scopeId !== undefined && typeof scopeId !== "string")
    ) {
      return null;
    }
    return {
      scopeType,
      scopeId: typeof scopeId === "string" ? scopeId : null,
      isLive: entry.is_live !== false,
    };
  });
  if (scopes.some(scope => scope === null)) return null;
  const departments = Array.isArray(user?.departments) ? user.departments : [];
  const departmentIds = departments.map(department => {
    if (!department || typeof department !== "object") return null;
    const id = (department as Record<string, unknown>).department_id;
    return typeof id === "string" && id ? id : null;
  });
  if (departmentIds.some(id => id === null)) return null;
  const firstName =
    typeof profile?.first_name === "string" ? profile.first_name.trim() : "";
  const lastName =
    typeof profile?.last_name === "string" ? profile.last_name.trim() : "";
  return {
    sessionId,
    userId,
    email,
    name: [firstName, lastName].filter(Boolean).join(" ") || email,
    assignedRole,
    activeRole,
    workspaceBranchId:
      typeof record.workspace_branch_id === "string"
        ? record.workspace_branch_id
        : null,
    departmentIds: departmentIds as string[],
    scopes: scopes as EmsStagingMe["scopes"],
  };
}

export function normalizeEmsBranches(
  payload: unknown
): EmsStagingBranch[] | null {
  if (!Array.isArray(payload)) return null;
  const branches = payload.map(value => {
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    if (
      typeof record.id !== "string" ||
      !record.id ||
      typeof record.name !== "string" ||
      !record.name ||
      (record.status !== "active" && record.status !== "disabled") ||
      typeof record.timezone !== "string" ||
      !record.timezone
    ) {
      return null;
    }
    return {
      id: record.id,
      name: record.name,
      status: record.status,
      timezone: record.timezone,
    };
  });
  return branches.some(branch => branch === null)
    ? null
    : (branches as EmsStagingBranch[]);
}

export function createEmsStagingClient(options: EmsStagingClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const timeoutMs = options.timeoutMs ?? EMS_STAGING_DEFAULT_TIMEOUT_MS;
  const userAgent = options.userAgent ?? EMS_STAGING_USER_AGENT;
  const fetchImpl: FetchImpl =
    options.fetchImpl ?? ((input, init) => fetch(input, init));

  async function request<T>(
    path: string,
    init: {
      method?: string;
      token?: string;
      body?: Record<string, unknown>;
    } = {}
  ): Promise<{ ok: true; data: T } | { ok: false; error: EmsStagingError }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers: Record<string, string> = {
        "User-Agent": userAgent,
        Accept: "application/json",
      };
      if (init.token) headers.Authorization = `Bearer ${init.token}`;
      if (init.body !== undefined) headers["Content-Type"] = "application/json";
      const response = await fetchImpl(`${baseUrl}${path}`, {
        method: init.method ?? "GET",
        headers,
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        redirect: "error",
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) {
        return {
          ok: false,
          error: {
            ...translateEmsError(response.status, payload),
            status: response.status,
          },
        };
      }
      return { ok: true, data: payload as T };
    } catch {
      return {
        ok: false,
        error: { error: "The staging service is unavailable.", status: 503 },
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    ping() {
      return request<{ pong?: boolean }>("/ping");
    },
    login(email: string, password: string) {
      return request<EmsAuthPayload>("/auth/login", {
        method: "POST",
        body: { email, password },
      });
    },
    refresh(refreshToken: string) {
      return request<EmsAuthPayload>("/auth/refresh", {
        method: "POST",
        body: { refresh_token: refreshToken },
      });
    },
    logout(token: string) {
      return request<null>("/auth/logout", { method: "POST", token });
    },
    me(token: string) {
      return request<unknown>("/auth/me", { token });
    },
    switchRole(token: string, targetRole: EmsStagingRole) {
      return request<EmsAuthPayload>("/auth/switch-role", {
        method: "POST",
        token,
        body: { target_role: targetRole },
      });
    },
    switchWorkspace(token: string, branchId: string | null) {
      return request<unknown>("/auth/switch-workspace", {
        method: "POST",
        token,
        body: { branch_id: branchId },
      });
    },
    branches(token: string) {
      return request<unknown>("/branches", { token });
    },
  };
}

export type EmsStagingClient = ReturnType<typeof createEmsStagingClient>;

export function extractTokens(payload: unknown): EmsStagingTokens | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (
    typeof record.access_token !== "string" ||
    typeof record.refresh_token !== "string" ||
    typeof record.access_token_expires_at !== "string" ||
    typeof record.refresh_token_expires_at !== "string" ||
    typeof record.session_id !== "string" ||
    !record.access_token ||
    !record.refresh_token ||
    !record.session_id ||
    !Number.isFinite(Date.parse(record.access_token_expires_at)) ||
    !Number.isFinite(Date.parse(record.refresh_token_expires_at))
  ) {
    return null;
  }
  return {
    accessToken: record.access_token,
    refreshToken: record.refresh_token,
    accessTokenExpiresAt: record.access_token_expires_at,
    refreshTokenExpiresAt: record.refresh_token_expires_at,
    sessionId: record.session_id,
  };
}

export function normalizeEmsMe(payload: unknown): EmsStagingMe | null {
  return normalizeMe(payload);
}
