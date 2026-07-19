import { describe, expect, it, vi } from "vitest";

import {
  openInvitationActivationPayload,
  sealInvitationActivationPayload,
} from "../../../../server/invitationEnvelope";
import { UserInvitationService } from "../../../../server/userInvitationService";
import { SupabaseAuthInvitationService } from "../../../../server/supabaseAuthInvitations";
import type {
  UserInvitationAuthPort,
  UserInvitationRepositoryPort,
} from "../../../../server/userInvitationService";

const env = {
  NILE_INVITATION_PAYLOAD_KEY:
    "test-only-account-invitation-envelope-key-with-adequate-entropy",
  NILE_PUBLIC_APP_URL: "https://learn.example.test",
} as NodeJS.ProcessEnv;

function authPort(
  overrides: Partial<UserInvitationAuthPort> = {}
): UserInvitationAuthPort {
  return {
    generate: vi.fn(async () => ({
      authUserId: "a1000000-0000-4000-8000-000000000001",
      actionUrl:
        "https://auth.example.test/verify?type=invite&code=private-code",
      emailOtp: "482913",
    })),
    removeGeneratedUser: vi.fn(async () => undefined),
    verifyEmailOtp: vi.fn(async () => "verified-access-token"),
    getVerifiedUser: vi.fn(async () => ({
      id: "a1000000-0000-4000-8000-000000000001",
      email: "teacher@example.test",
    })),
    setPassword: vi.fn(async () => undefined),
    ...overrides,
  };
}

function repositoryPort(
  overrides: Partial<UserInvitationRepositoryPort> = {}
): UserInvitationRepositoryPort {
  return {
    create: vi.fn(async input => ({
      invitationId: input.invitationId,
      userId: "a2000000-0000-4000-8000-000000000001",
      roleGrantId: "a3000000-0000-4000-8000-000000000001",
      outboxEventId: "a4000000-0000-4000-8000-000000000001",
      replayed: false,
    })),
    accept: vi.fn(async () => ({
      userId: "a2000000-0000-4000-8000-000000000001",
      role: "teacher",
      acceptedAt: "2026-07-19T12:00:00.000Z",
    })),
    ...overrides,
  };
}

describe("account invitation security envelope", () => {
  it("round-trips provider activation data without exposing it in the envelope", () => {
    const envelope = sealInvitationActivationPayload(
      {
        actionUrl: "https://auth.example.test/verify?code=private-code",
        emailOtp: "482913",
      },
      env
    );

    expect(envelope).toMatch(/^v1\.[A-Za-z0-9_-]+$/);
    expect(envelope).not.toContain("private-code");
    expect(envelope).not.toContain("482913");
    expect(openInvitationActivationPayload(envelope, env)).toEqual({
      actionUrl: "https://auth.example.test/verify?code=private-code",
      emailOtp: "482913",
    });
  });
});

describe("normalized account invitation lifecycle", () => {
  it("queues a scoped pending account without accepting an admin password", async () => {
    const repository = repositoryPort();
    const auth = authPort();
    const service = new UserInvitationService(repository, auth, env);

    await expect(
      service.create({
        sessionToken: "server-session-token",
        fullName: "Teacher Example",
        email: "teacher@example.test",
        role: "teacher",
        branchRef: "br_online",
        departmentRef: "dep_arabic",
        availabilityStatus: "available",
        subjects: ["Arabic grammar"],
        teachingLevels: ["Level 3"],
        locale: "en",
        idempotencyKey: "user-invite:test-teacher",
      })
    ).resolves.toMatchObject({ replayed: false });

    expect(auth.generate).toHaveBeenCalledWith(
      "teacher@example.test",
      expect.stringMatching(
        /^https:\/\/learn\.example\.test\/auth\/accept-invitation\?invitation=/
      )
    );
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "teacher",
        branchRef: "br_online",
        departmentRef: "dep_arabic",
        activationEnvelope: expect.stringMatching(/^v1\./),
      })
    );
    expect(
      JSON.stringify(vi.mocked(repository.create).mock.calls)
    ).not.toContain("private-code");
  });

  it("compensates the generated Auth identity when atomic persistence fails", async () => {
    const repository = repositoryPort({
      create: vi.fn(async () => {
        throw new Error("database unavailable");
      }),
    });
    const auth = authPort();
    const service = new UserInvitationService(repository, auth, env);

    await expect(
      service.create({
        sessionToken: "server-session-token",
        fullName: "Registrar Example",
        email: "registrar@example.test",
        role: "registrar",
        branchRef: "br_cairo",
        subjects: [],
        teachingLevels: [],
      })
    ).rejects.toThrow("database unavailable");
    expect(auth.removeGeneratedUser).toHaveBeenCalledWith(
      "a1000000-0000-4000-8000-000000000001"
    );
  });

  it("compensates the generated Auth identity when the activation envelope cannot be sealed", async () => {
    const repository = repositoryPort();
    const auth = authPort();
    const service = new UserInvitationService(repository, auth, {
      NILE_PUBLIC_APP_URL: "https://learn.example.test",
    } as NodeJS.ProcessEnv);

    await expect(
      service.create({
        sessionToken: "server-session-token",
        fullName: "Registrar Example",
        email: "registrar@example.test",
        role: "registrar",
        branchRef: "br_cairo",
      })
    ).rejects.toThrow();
    expect(repository.create).not.toHaveBeenCalled();
    expect(auth.removeGeneratedUser).toHaveBeenCalledWith(
      "a1000000-0000-4000-8000-000000000001"
    );
  });

  it("uses a verified Supabase identity before setting the owner password", async () => {
    const repository = repositoryPort();
    const auth = authPort();
    const service = new UserInvitationService(repository, auth, env);

    await expect(
      service.accept({
        invitationId: "a5000000-0000-4000-8000-000000000001",
        email: "teacher@example.test",
        otp: "482913",
        password: "Strong testing password 2026",
      })
    ).resolves.toMatchObject({ role: "teacher" });

    expect(auth.verifyEmailOtp).toHaveBeenCalledWith(
      "teacher@example.test",
      "482913"
    );
    expect(auth.setPassword).toHaveBeenCalledWith(
      "verified-access-token",
      "Strong testing password 2026"
    );
    expect(repository.accept).toHaveBeenCalledWith(
      "a5000000-0000-4000-8000-000000000001",
      "a1000000-0000-4000-8000-000000000001"
    );
  });
});

describe("Supabase Auth invitation adapter", () => {
  const providerEnv = {
    SUPABASE_URL: "https://project.example.test",
    SUPABASE_PUBLISHABLE_KEY: "publishable-test-key",
    SUPABASE_SECRET_KEY: "server-secret-test-key",
  } as NodeJS.ProcessEnv;

  it("generates a server-side invitation link without placing credentials in the request body", async () => {
    const fetcher = vi.fn(
      async (_url: string | URL | Request, init?: RequestInit) =>
        new Response(
          JSON.stringify({
            user: { id: "a1000000-0000-4000-8000-000000000001" },
            properties: {
              action_link:
                "https://project.example.test/auth/v1/verify?token=private",
              email_otp: "482913",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
    );
    const adapter = new SupabaseAuthInvitationService(
      providerEnv,
      fetcher as typeof fetch
    );

    await expect(
      adapter.generate(
        "teacher@example.test",
        "https://learn.example.test/auth/accept-invitation"
      )
    ).resolves.toMatchObject({
      authUserId: "a1000000-0000-4000-8000-000000000001",
      emailOtp: "482913",
    });

    const [, request] = fetcher.mock.calls[0];
    expect(String(request?.body)).toContain("teacher@example.test");
    expect(String(request?.body)).not.toContain("server-secret-test-key");
    expect(new Headers(request?.headers).get("Authorization")).toBe(
      "Bearer server-secret-test-key"
    );
  });

  it("verifies the invite OTP before allowing the recipient password update", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ access_token: "recipient-access-token" }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      )
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    const adapter = new SupabaseAuthInvitationService(
      providerEnv,
      fetcher as typeof fetch
    );

    await expect(
      adapter.verifyEmailOtp("teacher@example.test", "482913")
    ).resolves.toBe("recipient-access-token");
    await expect(
      adapter.setPassword("recipient-access-token", "Strong password 2026")
    ).resolves.toBeUndefined();

    const verifyBody = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body));
    expect(verifyBody).toEqual({
      email: "teacher@example.test",
      token: "482913",
      type: "invite",
    });
    expect(
      new Headers(fetcher.mock.calls[1]?.[1]?.headers).get("Authorization")
    ).toBe("Bearer recipient-access-token");
  });
});
