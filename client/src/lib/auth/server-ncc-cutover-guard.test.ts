import { afterEach, describe, expect, it, vi } from "vitest";

import { registerApiRoutes } from "../../../../server/routes";

type Handler = (request: any, response: any, next?: () => void) => unknown;

function configureNcc() {
  vi.stubEnv("NILE_NCC_STAFF_AUTH_ENABLED", "1");
  vi.stubEnv("EMS_STAGING_BASE_URL", "https://staging.example/api");
  vi.stubEnv("EMS_STAGING_ALLOWED_HOSTS", "staging.example");
  vi.stubEnv(
    "EMS_SESSION_SEAL_KEY",
    "test-only-ncc-auth-session-key-32-characters"
  );
}

function captureRoutes() {
  const posts = new Map<string, Handler>();
  const middlewares: Array<{ path?: string; handler: Handler }> = [];
  const app = {
    use(pathOrHandler: string | Handler, maybeHandler?: Handler) {
      middlewares.push(
        typeof pathOrHandler === "string"
          ? { path: pathOrHandler, handler: maybeHandler! }
          : { handler: pathOrHandler }
      );
    },
    get() {},
    post(path: string, handler: Handler) {
      posts.set(path, handler);
    },
    patch() {},
  };
  registerApiRoutes(app as never);
  return { posts, middlewares };
}

function responseRecorder() {
  const headers = new Map<string, string | string[]>();
  const result: { status: number; body?: unknown } = { status: 200 };
  const response = {
    setHeader(name: string, value: string | string[]) {
      headers.set(name, value);
    },
    status(code: number) {
      result.status = code;
      return response;
    },
    json(body: unknown) {
      result.body = body;
    },
    send() {},
  };
  return { headers, result, response };
}

function request(path: string, body: Record<string, unknown> = {}) {
  return {
    method: "POST",
    path,
    body,
    query: {},
    headers: { cookie: "nilelearn_ncc_session=sealed" },
    get(name: string) {
      return name === "X-Nile-Learn-Request" ? "browser" : undefined;
    },
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("NCC cutover routing", () => {
  it("allows NCC family writes while compatibility mutations remain blocked", async () => {
    configureNcc();
    const { middlewares } = captureRoutes();
    const boundary = middlewares.filter(item => item.path === "/api")[1];
    const nextNcc = vi.fn();
    const nextPlatform = vi.fn();
    const nccResponse = responseRecorder();
    const platformResponse = responseRecorder();

    await boundary.handler(
      request("/ncc/directory/users"),
      nccResponse.response,
      nextNcc
    );
    await boundary.handler(
      request("/platform/state/actions"),
      platformResponse.response,
      nextPlatform
    );

    expect(nextNcc).toHaveBeenCalledOnce();
    expect(nextPlatform).not.toHaveBeenCalled();
    expect(platformResponse.result).toEqual({
      status: 503,
      body: { error: "NCC workflow cutover is not active." },
    });
  });

  it("validates and accepts public NCC invitations without exposing tokens", async () => {
    configureNcc();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            email: "staff@example.test",
            expires_at: "2099-01-01T00:00:00Z",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "access-token",
            refresh_token: "refresh-token",
            access_token_expires_at: "2099-01-01T00:15:00Z",
            refresh_token_expires_at: "2099-02-01T00:00:00Z",
            session_id: "ncc-session-1",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            session_id: "ncc-session-1",
            user: {
              id: "ncc-user-1",
              email: "staff@example.test",
              profile: { first_name: "NCC", last_name: "Staff" },
              departments: null,
            },
            assigned_role: "teacher",
            active_role: "teacher",
            workspace_branch_id: null,
            scopes: [
              { scope_type: "branch", scope_id: "branch-1", is_live: true },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    vi.stubGlobal("fetch", fetcher);
    const { posts } = captureRoutes();
    const validation = responseRecorder();
    const acceptance = responseRecorder();

    await posts.get("/api/ncc/invitations/validate")?.(
      request("/ncc/invitations/validate", { token: "invitation-token" }),
      validation.response
    );
    await posts.get("/api/ncc/invitations/accept")?.(
      request("/ncc/invitations/accept", {
        token: "invitation-token",
        password: "new-password",
      }),
      acceptance.response
    );

    expect(validation.result.body).toEqual({
      email: "staff@example.test",
      expiresAt: "2099-01-01T00:00:00Z",
    });
    expect(acceptance.result).toMatchObject({
      status: 200,
      body: {
        userId: "ncc-user-1",
        provider: "ncc",
        activeRole: "teacher",
      },
    });
    expect(JSON.stringify(acceptance.result.body)).not.toMatch(
      /access-token|refresh-token/
    );
    expect(acceptance.headers.get("Set-Cookie")).toEqual([
      expect.stringContaining("nilelearn_session=;"),
      expect.stringContaining("nilelearn_ncc_session="),
    ]);
  });
});
