import { describe, expect, it, vi } from "vitest";
import type { ServerSession } from "../../../../server/auth";
import {
  buildIntegrationHealth,
  registerIntegrationHealthRoutes,
} from "../../../../server/integrationHealthRoutes";

type Handler = (
  request: {
    headers: { cookie?: string };
    get(name: string): string | undefined;
  },
  response: ReturnType<typeof recorder>["response"]
) => Promise<void> | void;

function recorder() {
  const result: { status: number; body?: unknown } = { status: 200 };
  const response = {
    status(code: number) {
      result.status = code;
      return response;
    },
    json(body: unknown) {
      result.body = body;
    },
  };
  return { response, result };
}

const superAdmin: ServerSession = {
  id: "session-admin",
  userId: "user-admin",
  email: "admin@example.test",
  name: "Synthetic Admin",
  roles: ["superadmin"],
  activeRole: "superadmin",
  provider: "supabase",
  authorizationModel: "normalized",
  createdAt: "2026-07-24T00:00:00.000Z",
  expiresAt: "2026-07-25T00:00:00.000Z",
};

function route(session: ServerSession | null) {
  let handler: Handler | undefined;
  registerIntegrationHealthRoutes(
    {
      get(_path, registered) {
        handler = registered as Handler;
      },
    },
    {},
    vi.fn(async () => session) as never,
    vi.fn(async () => ({
      ok: true,
      checkedAt: "2026-07-24T01:00:00.000Z",
    }))
  );
  return handler!;
}

describe("integration health routes", () => {
  it("reports live verification without returning configured secrets", async () => {
    const probe = vi.fn(async () => ({
      ok: true,
      checkedAt: "2026-07-24T01:00:00.000Z",
    }));
    const health = await buildIntegrationHealth(
      {
        MOODLE_BASE_URL: "https://moodle.example.test",
        MOODLE_TOKEN: "moodle-secret",
        NILE_MOODLE_COMMAND_RUNTIME_ENABLED: "1",
        NILE_MOODLE_PLUGIN_ACCEPTED: "1",
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_SECRET_KEY: "supabase-secret",
        EMAIL_PROVIDER: "resend",
        RESEND_API_KEY: "resend-secret",
        RESEND_FROM_EMAIL: "onboarding@resend.dev",
      } as NodeJS.ProcessEnv,
      probe
    );

    expect(health.authority).toBe("server");
    expect(health.providers.find(item => item.id === "moodle")?.state).toBe(
      "verified"
    );
    expect(health.providers.find(item => item.id === "email")?.state).toBe(
      "verified"
    );
    expect(probe).toHaveBeenCalledTimes(3);
    const serialized = JSON.stringify(health);
    expect(serialized).not.toContain("moodle-secret");
    expect(serialized).not.toContain("supabase-secret");
    expect(serialized).not.toContain("resend-secret");
    expect(serialized).not.toContain("moodle.example.test");
  });

  it("does not claim configured providers are live when their probe fails", async () => {
    const health = await buildIntegrationHealth(
      {
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_SECRET_KEY: "supabase-secret",
      } as NodeJS.ProcessEnv,
      vi.fn(async () => ({
        ok: false,
        checkedAt: "2026-07-24T01:00:00.000Z",
      }))
    );

    expect(health.providers.find(item => item.id === "storage")?.state).toBe(
      "unavailable"
    );
    expect(health.providers.find(item => item.id === "moodle")?.state).toBe(
      "disabled"
    );
  });

  it("allows only authenticated Super Admin reads", async () => {
    const request = { headers: {}, get: () => undefined };

    const anonymous = recorder();
    await route(null)(request, anonymous.response);
    expect(anonymous.result.status).toBe(401);

    const teacher = recorder();
    await route({ ...superAdmin, activeRole: "teacher", roles: ["teacher"] })(
      request,
      teacher.response
    );
    expect(teacher.result.status).toBe(403);

    const allowed = recorder();
    await route(superAdmin)(request, allowed.response);
    expect(allowed.result.status).toBe(200);
    expect(allowed.result.body).toEqual(
      expect.objectContaining({ authority: "server" })
    );
  });
});
