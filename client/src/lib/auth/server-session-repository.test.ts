import crypto from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ServerSession } from "../../../../server/auth";
import {
  createSupabaseCompatibilitySessionRepository,
  createSupabaseSessionRepository,
  getSessionRepository,
  resetDefaultSessionRepository,
  SessionAuthorityDeniedError,
  SessionCommandConflictError,
  SessionRepositoryUnavailableError,
} from "../../../../server/sessionRepository";

const fixedNow = new Date("2026-07-10T06:00:00.000Z");
const appUserId = "40000000-0000-4000-8000-000000000002";
const authUserId = "10000000-0000-4000-8000-000000000002";
const roleGrantId = "50000000-0000-4000-8000-000000000002";
const branchId = "20000000-0000-4000-8000-000000000001";
const departmentId = "30000000-0000-4000-8000-000000000001";
const testEnv = {
  SUPABASE_URL: "https://phase1-test.supabase.co",
  SUPABASE_SECRET_KEY: "test-only-server-secret",
} as NodeJS.ProcessEnv;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function testSession(overrides: Partial<ServerSession> = {}): ServerSession {
  return {
    id: "opaque-session-token",
    userId: appUserId,
    authUserId,
    email: "teacher@nilelearn.local",
    name: "Local Teacher",
    roles: ["teacher"],
    activeRole: "teacher",
    activeRoleGrantId: roleGrantId,
    branchIds: [branchId],
    departmentIds: [departmentId],
    provider: "supabase",
    authorizationModel: "normalized",
    createdAt: "2026-07-10T05:00:00.000Z",
    expiresAt: "2026-07-10T17:00:00.000Z",
    ...overrides,
  };
}

function authorityRow(overrides: Record<string, unknown> = {}) {
  return {
    user_id: appUserId,
    auth_user_id: authUserId,
    email: "teacher@nilelearn.local",
    full_name: "Local Teacher",
    active_role_grant_id: roleGrantId,
    active_role: "teacher",
    branch_ids: [branchId],
    department_ids: [departmentId],
    provider: "supabase",
    created_at: "2026-07-10T05:00:00.000Z",
    expires_at: "2026-07-10T17:00:00.000Z",
    ...overrides,
  };
}

afterEach(() => {
  resetDefaultSessionRepository();
});

describe("session repository selection", () => {
  it("keeps memory as the default adapter", () => {
    expect(getSessionRepository({} as NodeJS.ProcessEnv).kind).toBe("memory");
  });

  it("fails closed for an unsupported adapter", () => {
    expect(() =>
      getSessionRepository({
        NILE_SESSION_REPOSITORY: "unknown",
      } as NodeJS.ProcessEnv)
    ).toThrow("Unsupported NILE_SESSION_REPOSITORY value");
  });

  it("fails closed when Supabase durable storage is selected without server credentials", () => {
    expect(() =>
      getSessionRepository({
        NILE_SESSION_REPOSITORY: "supabase",
      } as NodeJS.ProcessEnv)
    ).toThrow("requires SUPABASE_URL and a server-only secret key");
  });

  it("fails closed when Supabase compatibility storage is selected without server credentials", () => {
    expect(() =>
      getSessionRepository({
        NILE_SESSION_REPOSITORY: "supabase_compatibility",
      } as NodeJS.ProcessEnv)
    ).toThrow("requires SUPABASE_URL and a server-only secret key");
  });

  it("classifies repository network failures as temporary unavailability", async () => {
    const repository = createSupabaseSessionRepository({
      env: testEnv,
      adminFetch: vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
      now: () => fixedNow,
    });

    await expect(repository.get("opaque-session-token")).rejects.toBeInstanceOf(
      SessionRepositoryUnavailableError
    );
  });
});

describe("Supabase compatibility session repository", () => {
  function compatibilityRow(overrides: Record<string, unknown> = {}) {
    return {
      user_id: "usr_teacher_demo",
      email: "teacher.demo@nilelearn.local",
      full_name: "Teacher Demo",
      roles: ["teacher"],
      active_role: "teacher",
      provider: "demo",
      created_at: "2026-07-10T05:00:00.000Z",
      expires_at: "2026-07-10T17:00:00.000Z",
      ...overrides,
    };
  }

  function compatibilitySession(): ServerSession {
    return {
      id: "opaque-compatibility-token",
      userId: "usr_teacher_demo",
      email: "teacher.demo@nilelearn.local",
      name: "Teacher Demo",
      roles: ["teacher"],
      activeRole: "teacher",
      provider: "demo",
      authorizationModel: "snapshot",
      createdAt: "2026-07-10T05:00:00.000Z",
      expiresAt: "2026-07-10T17:00:00.000Z",
    };
  }

  it("persists a hash-only session that another server instance can resolve", async () => {
    let storedRow: Record<string, unknown> | undefined;
    const adminFetch = vi.fn(async (_path: string, init: RequestInit) => {
      if (init.method === "POST") {
        storedRow = JSON.parse(String(init.body)) as Record<string, unknown>;
        return new Response(null, { status: 201 });
      }
      return jsonResponse([
        compatibilityRow({
          user_id: storedRow?.user_id,
          email: storedRow?.email,
          full_name: storedRow?.full_name,
          roles: storedRow?.roles,
          active_role: storedRow?.active_role,
          provider: storedRow?.provider,
          created_at: storedRow?.created_at,
          expires_at: storedRow?.expires_at,
        }),
      ]);
    });
    const firstInstance = createSupabaseCompatibilitySessionRepository({
      env: testEnv,
      adminFetch,
      now: () => fixedNow,
    });
    const secondInstance = createSupabaseCompatibilitySessionRepository({
      env: testEnv,
      adminFetch,
      now: () => fixedNow,
    });

    await firstInstance.create(compatibilitySession());
    await expect(
      secondInstance.get("opaque-compatibility-token")
    ).resolves.toEqual(compatibilitySession());

    expect(storedRow?.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(storedRow)).not.toContain(
      "opaque-compatibility-token"
    );
    expect(adminFetch.mock.calls[1][0]).not.toContain(
      "opaque-compatibility-token"
    );
  });

  it("rejects expired or malformed compatibility authority", async () => {
    const expired = createSupabaseCompatibilitySessionRepository({
      env: testEnv,
      adminFetch: vi.fn(async () =>
        jsonResponse([
          compatibilityRow({ expires_at: "2026-07-10T05:59:59.000Z" }),
        ])
      ),
      now: () => fixedNow,
    });
    await expect(expired.get("expired-token")).resolves.toBeNull();

    const malformed = createSupabaseCompatibilitySessionRepository({
      env: testEnv,
      adminFetch: vi.fn(async () =>
        jsonResponse([compatibilityRow({ roles: ["teacher", "unknown"] })])
      ),
      now: () => fixedNow,
    });
    await expect(malformed.get("malformed-token")).rejects.toBeInstanceOf(
      SessionRepositoryUnavailableError
    );
  });

  it("revokes compatibility sessions by hash without exposing the token", async () => {
    const adminFetch = vi.fn(async () => new Response(null, { status: 204 }));
    const repository = createSupabaseCompatibilitySessionRepository({
      env: testEnv,
      adminFetch,
      now: () => fixedNow,
    });

    await repository.delete("opaque-compatibility-token");

    const [path, init] = adminFetch.mock.calls[0];
    expect(path).toContain("compatibility_auth_sessions?token_hash=eq.");
    expect(path).not.toContain("opaque-compatibility-token");
    expect(init?.method).toBe("PATCH");
    expect(JSON.parse(String(init?.body))).toEqual({
      revoked_at: fixedNow.toISOString(),
    });
  });

  it("does not accept normalized sessions in the compatibility repository", async () => {
    const repository = createSupabaseCompatibilitySessionRepository({
      env: testEnv,
      adminFetch: vi.fn(),
      now: () => fixedNow,
    });

    await expect(repository.create(testSession())).rejects.toBeInstanceOf(
      SessionAuthorityDeniedError
    );
  });
});

describe("Supabase session repository", () => {
  it("resolves one active application user and effective role grant", async () => {
    const adminFetch = vi.fn(async () => jsonResponse([authorityRow()]));
    const repository = createSupabaseSessionRepository({
      env: testEnv,
      adminFetch,
      now: () => fixedNow,
    });

    await expect(
      repository.resolveSupabaseIdentity?.(authUserId, "teacher")
    ).resolves.toEqual({
      userId: appUserId,
      authUserId,
      email: "teacher@nilelearn.local",
      name: "Local Teacher",
      activeRole: "teacher",
      activeRoleGrantId: roleGrantId,
      branchIds: [branchId],
      departmentIds: [departmentId],
    });
    expect(adminFetch.mock.calls[0][0]).toBe("rpc/resolve_login_authority");
    expect(JSON.parse(String(adminFetch.mock.calls[0][1]?.body))).toEqual({
      p_auth_user_id: authUserId,
      p_requested_role: "teacher",
    });
  });

  it("stores only the SHA-256 token hash", async () => {
    const adminFetch = vi.fn(async () =>
      jsonResponse([
        {
          session_id: "60000000-0000-4000-8000-000000000001",
          command_id: "70000000-0000-4000-8000-000000000001",
          session_created_at: "2026-07-10T06:00:00.000Z",
          session_expires_at: "2026-07-10T18:00:00.000Z",
          replayed: false,
        },
      ])
    );
    const repository = createSupabaseSessionRepository({
      env: testEnv,
      adminFetch,
      now: () => fixedNow,
    });

    await expect(repository.create(testSession())).resolves.toEqual({
      createdAt: "2026-07-10T06:00:00.000Z",
      expiresAt: "2026-07-10T18:00:00.000Z",
    });

    const [path, init] = adminFetch.mock.calls[0];
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    const expectedHash = crypto
      .createHash("sha256")
      .update("opaque-session-token", "utf8")
      .digest("hex");
    expect(path).toBe("rpc/create_auth_session_with_evidence");
    expect(body.p_token_hash).toBe(expectedHash);
    expect(JSON.stringify(body)).not.toContain("opaque-session-token");
    expect(body).toMatchObject({
      p_user_id: appUserId,
      p_auth_user_id: authUserId,
      p_active_role_grant_id: roleGrantId,
      p_ttl_seconds: 43200,
      p_idempotency_key: `session.create:${expectedHash}`,
    });
    expect(body.p_request_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("revalidates user and role-grant authority on every lookup", async () => {
    const adminFetch = vi.fn(async () => jsonResponse([authorityRow()]));
    const repository = createSupabaseSessionRepository({
      env: testEnv,
      adminFetch,
      now: () => fixedNow,
    });

    await expect(repository.get("opaque-session-token")).resolves.toEqual(
      testSession()
    );
    expect(adminFetch).toHaveBeenCalledTimes(1);
    expect(adminFetch.mock.calls[0][0]).toBe(
      "rpc/resolve_auth_session_authority"
    );
    expect(adminFetch.mock.calls[0][0]).not.toContain("opaque-session-token");
    expect(JSON.stringify(adminFetch.mock.calls[0][1]?.body)).not.toContain(
      "opaque-session-token"
    );
  });

  it("rejects expired durable sessions before loading authority rows", async () => {
    const adminFetch = vi.fn(async () => jsonResponse([]));
    const repository = createSupabaseSessionRepository({
      env: testEnv,
      adminFetch,
      now: () => fixedNow,
    });

    await expect(repository.get("opaque-session-token")).resolves.toBeNull();
    expect(adminFetch).toHaveBeenCalledTimes(1);
  });

  it("rejects ambiguous application identity mappings", async () => {
    const adminFetch = vi.fn(async () =>
      jsonResponse([
        authorityRow(),
        authorityRow({ user_id: "40000000-0000-4000-8000-000000000099" }),
      ])
    );
    const repository = createSupabaseSessionRepository({
      env: testEnv,
      adminFetch,
      now: () => fixedNow,
    });

    await expect(
      repository.resolveSupabaseIdentity?.(authUserId, "teacher")
    ).rejects.toBeInstanceOf(SessionAuthorityDeniedError);
  });

  it("returns no session when atomic authority resolution rejects the grant", async () => {
    const adminFetch = vi.fn(async () => jsonResponse([]));
    const repository = createSupabaseSessionRepository({
      env: testEnv,
      adminFetch,
      now: () => fixedNow,
    });

    await expect(repository.get("opaque-session-token")).resolves.toBeNull();
  });

  it("rejects malformed authority JSON and timestamps as repository failures", async () => {
    const invalidJsonRepository = createSupabaseSessionRepository({
      env: testEnv,
      adminFetch: vi.fn(
        async () =>
          new Response("not-json", {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
      ),
      now: () => fixedNow,
    });
    await expect(
      invalidJsonRepository.get("opaque-session-token")
    ).rejects.toBeInstanceOf(SessionRepositoryUnavailableError);

    const invalidTimestampRepository = createSupabaseSessionRepository({
      env: testEnv,
      adminFetch: vi.fn(async () =>
        jsonResponse([authorityRow({ expires_at: "not-a-timestamp" })])
      ),
      now: () => fixedNow,
    });
    await expect(
      invalidTimestampRepository.get("opaque-session-token")
    ).rejects.toThrow("invalid timestamps");
  });

  it("rejects a role when required effective scopes are missing", async () => {
    const adminFetch = vi.fn(async () =>
      jsonResponse([authorityRow({ department_ids: [] })])
    );
    const repository = createSupabaseSessionRepository({
      env: testEnv,
      adminFetch,
      now: () => fixedNow,
    });

    await expect(
      repository.resolveSupabaseIdentity?.(authUserId, "teacher")
    ).resolves.toBeNull();
  });

  it("revokes durable sessions instead of deleting them", async () => {
    const adminFetch = vi.fn(async () =>
      jsonResponse([
        {
          session_id: "60000000-0000-4000-8000-000000000001",
          command_id: "70000000-0000-4000-8000-000000000002",
          session_revoked_at: fixedNow.toISOString(),
          replayed: false,
        },
      ])
    );
    const repository = createSupabaseSessionRepository({
      env: testEnv,
      adminFetch,
      now: () => fixedNow,
    });

    await repository.delete("opaque-session-token");

    const [path, init] = adminFetch.mock.calls[0];
    expect(init?.method).toBe("POST");
    expect(path).toBe("rpc/revoke_auth_session_with_evidence");
    expect(path).not.toContain("opaque-session-token");
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    const expectedHash = crypto
      .createHash("sha256")
      .update("opaque-session-token", "utf8")
      .digest("hex");
    expect(body).toMatchObject({
      p_token_hash: expectedHash,
      p_idempotency_key: `session.revoke:${expectedHash}`,
    });
    expect(body.p_request_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(body)).not.toContain("opaque-session-token");
  });

  it("classifies command conflicts and authority denials separately from outages", async () => {
    const conflictRepository = createSupabaseSessionRepository({
      env: testEnv,
      adminFetch: vi.fn(async () => jsonResponse({}, 409)),
      now: () => fixedNow,
    });
    await expect(
      conflictRepository.create(testSession())
    ).rejects.toBeInstanceOf(SessionCommandConflictError);

    const deniedRepository = createSupabaseSessionRepository({
      env: testEnv,
      adminFetch: vi.fn(async () => jsonResponse({}, 403)),
      now: () => fixedNow,
    });
    await expect(deniedRepository.create(testSession())).rejects.toBeInstanceOf(
      SessionAuthorityDeniedError
    );
  });
});
