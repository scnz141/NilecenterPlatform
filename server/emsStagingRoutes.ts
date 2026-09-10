import { getRequestSession } from "./auth.js";
import {
  createEmsStagingClient,
  extractTokens,
  mapEmsRoleToLocal,
  normalizeEmsMe,
  resolveEmsStagingConfig,
  type EmsStagingClient,
  type EmsStagingTokens,
} from "./emsStagingClient.js";
import {
  EMS_SESSION_COOKIE_NAME,
  EmsSessionConfigurationError,
  EmsSessionInvalidError,
  isEmsSessionProtectionConfigured,
  openEmsSession,
  sealEmsSession,
} from "./emsSessionEnvelope.js";

type Request = {
  headers: { cookie?: string };
  body?: Record<string, unknown>;
  get(name: string): string | undefined;
};

type Response = {
  status(code: number): Response;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
};

type App = {
  get(
    path: string,
    handler: (request: Request, response: Response) => void | Promise<void>
  ): void;
  post(
    path: string,
    handler: (request: Request, response: Response) => void | Promise<void>
  ): void;
};

type Session = Awaited<ReturnType<typeof getRequestSession>>;

type EmsResult =
  | { ok: true; data: unknown }
  | {
      ok: false;
      error: { error: string; status: number; details?: unknown };
    };

export type EmsStagingRouteDeps = {
  env?: NodeJS.ProcessEnv;
  getSession?: (request: Request) => Promise<Session>;
  createClient?: (baseUrl: string, timeoutMs: number) => EmsStagingClient;
};

function readCredential(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  return trimmed;
}

function readCookie(request: Request, name: string) {
  const value = (request.headers.cookie ?? "")
    .split(";")
    .map(part => part.trim())
    .find(part => part.startsWith(`${encodeURIComponent(name)}=`));
  if (!value) return null;
  try {
    return decodeURIComponent(value.slice(value.indexOf("=") + 1));
  } catch {
    return null;
  }
}

function secureCookieAttribute(env: NodeJS.ProcessEnv) {
  return env.NODE_ENV === "production" ? "; Secure" : "";
}

function setPrivateNoStore(response: Response) {
  response.setHeader("Cache-Control", "private, no-store");
}

function clearEmsSessionCookie(response: Response, env: NodeJS.ProcessEnv) {
  response.setHeader(
    "Set-Cookie",
    `${EMS_SESSION_COOKIE_NAME}=; Path=/api/ems-staging; Max-Age=0; HttpOnly; SameSite=Lax${secureCookieAttribute(env)}`
  );
}

function writeEmsSessionCookie(
  response: Response,
  session: NonNullable<Session>,
  tokens: EmsStagingTokens,
  env: NodeJS.ProcessEnv
) {
  const expiresAt = Math.min(
    Date.parse(session.expiresAt),
    Date.parse(tokens.refreshTokenExpiresAt)
  );
  const maxAge = Math.floor((expiresAt - Date.now()) / 1000);
  if (!Number.isFinite(maxAge) || maxAge <= 0) {
    throw new EmsSessionInvalidError();
  }
  const envelope = sealEmsSession(
    {
      ownerSessionId: session.id,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessTokenExpiresAt: tokens.accessTokenExpiresAt,
      refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
      sessionId: tokens.sessionId,
    },
    env
  );
  response.setHeader(
    "Set-Cookie",
    `${EMS_SESSION_COOKIE_NAME}=${encodeURIComponent(envelope)}; Path=/api/ems-staging; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secureCookieAttribute(env)}`
  );
}

function readEmsSession(
  request: Request,
  session: NonNullable<Session>,
  env: NodeJS.ProcessEnv
) {
  const envelope = readCookie(request, EMS_SESSION_COOKIE_NAME);
  if (!envelope) return null;
  const payload = openEmsSession(envelope, env);
  if (
    payload.ownerSessionId !== session.id ||
    Date.parse(payload.refreshTokenExpiresAt) <= Date.now()
  ) {
    throw new EmsSessionInvalidError();
  }
  return {
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    accessTokenExpiresAt: payload.accessTokenExpiresAt,
    refreshTokenExpiresAt: payload.refreshTokenExpiresAt,
    sessionId: payload.sessionId,
  } satisfies EmsStagingTokens;
}

export function registerEmsStagingRoutes(
  app: App,
  deps: EmsStagingRouteDeps = {}
) {
  const env = deps.env ?? process.env;
  const getSession = deps.getSession ?? getRequestSession;
  const createClient =
    deps.createClient ??
    ((baseUrl: string, timeoutMs: number) =>
      createEmsStagingClient({ baseUrl, timeoutMs }));

  function config() {
    return resolveEmsStagingConfig(env);
  }

  async function requireSuperAdmin(
    request: Request,
    response: Response
  ): Promise<Session> {
    const session = await getSession(request);
    if (!session) {
      response.status(401).json({ error: "Sign in required." });
      return null;
    }
    if (session.activeRole !== "superadmin") {
      response.status(403).json({ error: "Super Admin access is required." });
      return null;
    }
    return session;
  }

  async function withRefresh(
    tokens: EmsStagingTokens,
    client: EmsStagingClient,
    run: (accessToken: string) => Promise<EmsResult>
  ) {
    const first = await run(tokens.accessToken);
    if (first.ok) {
      return { ok: true as const, data: first.data, tokens, refreshed: false };
    }
    if (first.error.status !== 401) {
      return {
        ok: false as const,
        status: first.error.status,
        error: first.error.error,
        details: first.error.details,
      };
    }
    if (Date.parse(tokens.refreshTokenExpiresAt) <= Date.now()) {
      return {
        ok: false as const,
        status: 401,
        error: "Staging session expired. Sign in again.",
      };
    }
    const refreshed = await client.refresh(tokens.refreshToken);
    if (!refreshed.ok) {
      return {
        ok: false as const,
        status: refreshed.error.status,
        error:
          refreshed.error.status === 401
            ? "Staging session expired. Sign in again."
            : refreshed.error.error,
        details: refreshed.error.details,
      };
    }
    const next = extractTokens(refreshed.data);
    if (!next) {
      return {
        ok: false as const,
        status: 502,
        error: "Unexpected staging response shape.",
      };
    }
    const second = await run(next.accessToken);
    if (!second.ok) {
      return {
        ok: false as const,
        status: second.error.status,
        error: second.error.error,
        details: second.error.details,
      };
    }
    return {
      ok: true as const,
      data: second.data,
      tokens: next,
      refreshed: true,
    };
  }

  function sessionTokens(
    request: Request,
    response: Response,
    session: NonNullable<Session>
  ) {
    try {
      return readEmsSession(request, session, env);
    } catch (error) {
      clearEmsSessionCookie(response, env);
      if (error instanceof EmsSessionConfigurationError) throw error;
      return null;
    }
  }

  app.get("/api/ems-staging/status", async (request, response) => {
    setPrivateNoStore(response);
    const session = await requireSuperAdmin(request, response);
    if (!session) return;
    const resolved = config();
    const sessionProtectionConfigured = isEmsSessionProtectionConfigured(env);
    if (!resolved) {
      response.json({
        configured: false,
        reachable: false,
        linked: false,
        sessionProtectionConfigured,
      });
      return;
    }
    const client = createClient(resolved.baseUrl, resolved.timeoutMs);
    const ping = await client.ping();
    let tokens: EmsStagingTokens | null = null;
    if (sessionProtectionConfigured) {
      tokens = sessionTokens(request, response, session);
    }
    if (!tokens) {
      response.json({
        configured: true,
        reachable: ping.ok,
        linked: false,
        sessionProtectionConfigured,
      });
      return;
    }
    const linked = await withRefresh(tokens, client, accessToken =>
      client.me(accessToken)
    );
    if (!linked.ok) {
      if (linked.status === 401) clearEmsSessionCookie(response, env);
      response.json({
        configured: true,
        reachable: ping.ok,
        linked: false,
        sessionProtectionConfigured,
      });
      return;
    }
    if (!normalizeEmsMe(linked.data)) {
      clearEmsSessionCookie(response, env);
      response.json({
        configured: true,
        reachable: ping.ok,
        linked: false,
        sessionProtectionConfigured,
      });
      return;
    }
    if (linked.refreshed) {
      writeEmsSessionCookie(response, session, linked.tokens, env);
    }
    response.json({
      configured: true,
      reachable: ping.ok,
      linked: true,
      sessionProtectionConfigured,
    });
  });

  app.post("/api/ems-staging/session", async (request, response) => {
    setPrivateNoStore(response);
    const session = await requireSuperAdmin(request, response);
    if (!session) return;
    const resolved = config();
    if (!resolved) {
      response
        .status(503)
        .json({ error: "External staging is not configured." });
      return;
    }
    if (!isEmsSessionProtectionConfigured(env)) {
      response
        .status(503)
        .json({ error: "NCC EMS session protection is not configured." });
      return;
    }
    const email = readCredential(request.body?.email, 320);
    const password = readCredential(request.body?.password, 256);
    if (!email || !password) {
      response
        .status(422)
        .json({ error: "A staging email and password are required." });
      return;
    }
    const client = createClient(resolved.baseUrl, resolved.timeoutMs);
    const result = await client.login(email, password);
    if (!result.ok) {
      response
        .status(result.error.status)
        .json({ error: result.error.error, details: result.error.details });
      return;
    }
    const tokens = extractTokens(result.data);
    if (!tokens) {
      response
        .status(502)
        .json({ error: "Unexpected staging response shape." });
      return;
    }
    // Login returns tokens plus a user snapshot without the session view.
    // The shell bootstrap fields (active role, workspace) come from /auth/me.
    const meResult = await client.me(tokens.accessToken);
    if (!meResult.ok) {
      await client.logout(tokens.accessToken);
      response
        .status(meResult.error.status)
        .json({ error: meResult.error.error, details: meResult.error.details });
      return;
    }
    const me = normalizeEmsMe(meResult.data);
    if (!me) {
      await client.logout(tokens.accessToken);
      response
        .status(502)
        .json({ error: "Unexpected staging response shape." });
      return;
    }
    try {
      writeEmsSessionCookie(response, session, tokens, env);
    } catch {
      await client.logout(tokens.accessToken);
      response
        .status(502)
        .json({ error: "Staging session could not be protected." });
      return;
    }
    response.json({
      assignedRole: mapEmsRoleToLocal(me.assignedRole),
      activeRole: mapEmsRoleToLocal(me.activeRole),
      workspaceBranchId: me.workspaceBranchId,
      scopes: me.scopes.map(scope => ({
        scopeType: scope.scopeType,
        scopeId: scope.scopeId,
        isLive: scope.isLive,
      })),
    });
  });

  app.post("/api/ems-staging/logout", async (request, response) => {
    setPrivateNoStore(response);
    const session = await requireSuperAdmin(request, response);
    if (!session) return;
    let tokens: EmsStagingTokens | null;
    try {
      tokens = sessionTokens(request, response, session);
    } catch {
      clearEmsSessionCookie(response, env);
      response
        .status(503)
        .json({ error: "NCC EMS session protection is not configured." });
      return;
    }
    if (!tokens) {
      clearEmsSessionCookie(response, env);
      response.json({ ok: true });
      return;
    }
    const resolved = config();
    if (!resolved) {
      clearEmsSessionCookie(response, env);
      response
        .status(503)
        .json({ error: "External staging is not configured." });
      return;
    }
    const client = createClient(resolved.baseUrl, resolved.timeoutMs);
    const result = await withRefresh(tokens, client, accessToken =>
      client.logout(accessToken)
    );
    clearEmsSessionCookie(response, env);
    if (!result.ok && result.status !== 401) {
      const payload: Record<string, unknown> = { error: result.error };
      if (result.details !== undefined) payload.details = result.details;
      response.status(result.status).json(payload);
      return;
    }
    response.json({ ok: true });
  });
}
