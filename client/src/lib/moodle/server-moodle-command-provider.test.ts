import { describe, expect, it, vi } from "vitest";
import {
  MoodleCommandProvider,
  MoodleCommandProviderError,
} from "../../../../server/moodleCommandProvider";

const request = {
  protocolVersion: "1.0" as const,
  operation: "page.upsert" as const,
  idempotencyKey: "phase6l.page.synthetic.001:provider",
  payloadHash: "a".repeat(64),
  expectedProviderVersion: "2026072301",
  actorExternalId: "21",
  targetExternalId: "42",
  targetContextExternalId: "57",
  originatingCommandId: "d6100000-0000-4000-8000-000000000001",
  payloadJson: '{"title":"Synthetic page"}',
};

const env = {
  MOODLE_COMMANDS_ENABLED: "1",
  MOODLE_COMMAND_BASE_URL: "https://moodle-sandbox.example/",
  MOODLE_COMMAND_TOKEN: "server-only-test-token",
  MOODLE_ALLOWED_HOSTS: "moodle-sandbox.example",
  SUPABASE_URL: "https://xvgsypaatibntfocvvxn.supabase.co",
} as NodeJS.ProcessEnv;

describe("Moodle command provider", () => {
  it("calls only the versioned plugin function with server-resolved IDs", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          commandUuid: request.originatingCommandId,
          operation: request.operation,
          status: "applied",
          providerVersion: "2026072302",
          resultJson: '{"id":"42"}',
          replayed: false,
        }),
        { status: 200 }
      )
    );
    const result = await new MoodleCommandProvider(env, fetchImpl).execute(
      request
    );
    expect(result.status).toBe("applied");
    const init = fetchImpl.mock.calls[0]?.[1];
    const body = init?.body as URLSearchParams;
    expect(body.get("wsfunction")).toBe("local_nilelearn_execute_command");
    expect(body.get("actoruserid")).toBe("21");
    expect(body.get("targetexternalid")).toBe("42");
    expect(body.get("targetcontextid")).toBe("57");
    expect(body.get("wstoken")).toBe("server-only-test-token");
  });

  it("rejects a production Supabase target before network use", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(
      new MoodleCommandProvider(
        {
          ...env,
          SUPABASE_URL: "https://lkvyhevoommqnpwwmqgp.supabase.co",
        },
        fetchImpl
      ).execute(request)
    ).rejects.toMatchObject<MoodleCommandProviderError>({
      code: "configuration",
      outcome: "failed",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("classifies timeouts as unknown for reconciliation", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(
      Object.assign(new Error("aborted"), { name: "AbortError" })
    );
    await expect(
      new MoodleCommandProvider(env, fetchImpl).execute(request)
    ).rejects.toMatchObject<MoodleCommandProviderError>({
      code: "timeout",
      outcome: "unknown",
    });
  });
});
