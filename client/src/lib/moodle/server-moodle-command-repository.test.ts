import { describe, expect, it, vi } from "vitest";

import {
  SupabaseMoodleCommandRepository,
  hashMoodleProviderResult,
} from "../../../../server/moodleCommandRepository";
import { hashMoodlePayload } from "../../../../server/moodleCommandRuntime";

const connectionId = "70000000-0000-4000-8000-000000000001";
const templateInternalId = "50000000-0000-4000-8000-000000000001";

describe("Moodle command repository provider enrichment", () => {
  it("lists only closed command evidence fields for the admin control plane", async () => {
    const adminFetch = vi.fn(async (path: string) => {
      expect(path).toContain("moodle_command_requests?");
      expect(path).toContain(
        "select=id%2Coperation%2Cstatus%2Cattempt_count%2Clast_error_code%2Creconciliation_case_id%2Cprovider_version%2Ccreated_at%2Cupdated_at"
      );
      expect(path).not.toContain("payload");
      return new Response(
        JSON.stringify([
          {
            id: "d6100000-0000-4000-8000-000000000001",
            operation: "delivery_course.clone",
            status: "reconciliation_required",
            attempt_count: 2,
            last_error_code: "provider_timeout",
            reconciliation_case_id: "d6300000-0000-4000-8000-000000000001",
            provider_version: null,
            created_at: "2026-07-24T00:00:00.000Z",
            updated_at: "2026-07-24T00:05:00.000Z",
          },
        ]),
        { status: 200 }
      );
    });
    const repository = new SupabaseMoodleCommandRepository(adminFetch as never);

    await expect(repository.listForAdmin()).resolves.toEqual([
      {
        commandId: "d6100000-0000-4000-8000-000000000001",
        operation: "delivery_course.clone",
        status: "reconciliation_required",
        attemptCount: 2,
        errorCode: "provider_timeout",
        reconciliationCaseId: "d6300000-0000-4000-8000-000000000001",
        providerVersion: undefined,
        createdAt: "2026-07-24T00:00:00.000Z",
        updatedAt: "2026-07-24T00:05:00.000Z",
      },
    ]);
  });

  it("resolves internal references and hashes only the provider payload", async () => {
    const adminFetch = vi.fn(async (path: string) => {
      if (path === "rpc/nile_claim_moodle_command") {
        return new Response(
          JSON.stringify([
            {
              command_request_id: "d6100000-0000-4000-8000-000000000001",
              operation: "delivery_course.clone",
              connection_id: connectionId,
              actor_external_id: "21",
              target_context_external_id: "1",
              expected_provider_version: "m405-7-1784800000",
              payload: {
                sourceTemplateInternalId: templateInternalId,
                fullname: "NILE-6L Synthetic delivery",
                shortname: "NILE-6L-SYNTHETIC",
              },
              payload_hash: "a".repeat(64),
              idempotency_key: "phase6l.clone.synthetic.001:provider",
              originating_command_id: "d6200000-0000-4000-8000-000000000001",
              attempt_number: 1,
            },
          ]),
          { status: 200 }
        );
      }
      if (path.startsWith("external_records?")) {
        expect(path).toContain(`internal_id=eq.${templateInternalId}`);
        expect(path).toContain("entity_type=eq.course");
        return new Response(JSON.stringify([{ external_id: "42" }]), {
          status: 200,
        });
      }
      throw new Error(`Unexpected repository path: ${path}`);
    });
    const repository = new SupabaseMoodleCommandRepository(adminFetch as never);

    const claimed = await repository.claim("phase6l-worker-001");

    expect(claimed?.payload).toEqual({
      sourceCourseExternalId: 42,
      fullname: "NILE-6L Synthetic delivery",
      shortname: "NILE-6L-SYNTHETIC",
    });
    expect(claimed?.payload).not.toHaveProperty("sourceTemplateInternalId");
    expect(claimed?.payloadHash).toBe(hashMoodlePayload(claimed!.payload));
    expect(claimed?.payloadHash).not.toBe("a".repeat(64));
  });

  it("hashes provider results canonically", () => {
    expect(hashMoodleProviderResult({ b: 2, a: 1 })).toBe(
      hashMoodleProviderResult({ a: 1, b: 2 })
    );
  });
});
