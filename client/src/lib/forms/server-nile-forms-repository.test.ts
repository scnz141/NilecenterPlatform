import { afterEach, describe, expect, it, vi } from "vitest";

import {
  assertFormPermissionMappingIsOneToOne,
  databaseFormPermission,
  formCommandPermissionMap,
  formPermissionDatabaseMap,
  formQueryPermissionMap,
} from "../../../../server/nileFormsAuthority";
import {
  createMemoryNileFormsRepository,
  createSupabaseNileFormsRepository,
  getNileFormsRepository,
  initializeNileFormsRepository,
  nileFormsCommandOperations,
  nileFormsQueryOperations,
  NileFormsPromotionPersistenceInactiveError,
  NileFormsRepositoryConflictError,
  NileFormsRepositoryRateLimitError,
  NileFormsRepositoryUnavailableError,
  NILE_FORMS_EXECUTOR_ROLE,
  NILE_FORMS_LOCAL_ACCEPTANCE_ACK,
  NILE_FORMS_RPC_CATALOG_VERSION,
  NILE_FORMS_SCHEMA_EVIDENCE_SHA256,
  resetDefaultNileFormsRepository,
} from "../../../../server/nileFormsRepository";
import {
  projectableNileFormFieldIds,
  projectNileFormAnswers,
} from "../../../../server/nileFormsProjection";
import type { FormVersionContent } from "@shared/nileForms";

const tokenHash = "11".repeat(32);
const requestHash = "22".repeat(32);
const publicHmac = "33".repeat(32);
const userAgentHash = "44".repeat(32);
const key = "55".repeat(32);

afterEach(async () => {
  vi.restoreAllMocks();
  await resetDefaultNileFormsRepository();
});

describe("Phase 13F1 Nile Forms repository contract", () => {
  it("maps every application permission one-to-one to its database code", () => {
    expect(() => assertFormPermissionMappingIsOneToOne()).not.toThrow();
    expect(databaseFormPermission("forms:read")).toBe("forms.read");
    expect(databaseFormPermission("form_submissions:sensitive_read")).toBe(
      "form_submissions.sensitive_read"
    );
    expect(new Set(Object.values(formPermissionDatabaseMap)).size).toBe(
      Object.keys(formPermissionDatabaseMap).length
    );
    expect(Object.keys(formQueryPermissionMap).sort()).toEqual(
      [...nileFormsQueryOperations].sort()
    );
    expect(Object.keys(formCommandPermissionMap).sort()).toEqual(
      [...nileFormsCommandOperations].sort()
    );
  });

  it("provides deterministic protected and public replay semantics", async () => {
    const repository = createMemoryNileFormsRepository();
    const command = {
      operation: "forms.definitions.create" as const,
      input: { key: "student_feedback" },
      idempotencyKey: "definition-create-0001",
      requestHash,
    };

    const first = await repository.command(
      { sessionTokenHash: tokenHash },
      command
    );
    const replay = await repository.command(
      { sessionTokenHash: tokenHash },
      command
    );
    expect(first.replayed).toBe(false);
    expect(replay).toEqual({ ...first, replayed: true });

    await expect(
      repository.command(
        { sessionTokenHash: tokenHash },
        { ...command, input: { key: "different" } }
      )
    ).rejects.toBeInstanceOf(NileFormsRepositoryConflictError);

    const publicCommand = {
      operation: "forms.public.submit" as const,
      publicationId: "publication_1",
      versionId: "version_1",
      input: { answers: { name: "Fake Applicant" } },
      clientSubmissionId: "public-client-0001",
      idempotencyKey: "public:publication_1:public-client-0001",
      requestHmac: publicHmac,
    };
    const context = {
      ipHmac: publicHmac,
      ipKeyVersion: 1,
      userAgentHash,
      evidenceKeyVersion: 1,
    };
    const publicFirst = await repository.publicCommand(context, publicCommand);
    const publicReplay = await repository.publicCommand(context, publicCommand);
    expect(publicFirst.replayed).toBe(false);
    expect(publicReplay).toEqual({ ...publicFirst, replayed: true });

    const rotatedReplay = await repository.publicCommand(
      {
        ipHmac: "66".repeat(32),
        ipKeyVersion: 2,
        previousIpHmac: context.ipHmac,
        previousIpKeyVersion: context.ipKeyVersion,
        userAgentHash,
        evidenceKeyVersion: 2,
      },
      {
        ...publicCommand,
        requestHmac: "77".repeat(32),
      }
    );
    expect(rotatedReplay).toEqual({ ...publicFirst, replayed: true });

    const replayAfterRetirement = await repository.publicCommand(
      {
        ipHmac: "88".repeat(32),
        ipKeyVersion: 3,
        userAgentHash,
        evidenceKeyVersion: 3,
      },
      {
        ...publicCommand,
        requestHmac: "99".repeat(32),
      }
    );
    expect(replayAfterRetirement).toEqual({ ...publicFirst, replayed: true });

    await expect(
      repository.publicCommand(
        {
          ipHmac: "66".repeat(32),
          ipKeyVersion: 2,
          previousIpHmac: context.ipHmac,
          previousIpKeyVersion: context.ipKeyVersion,
          userAgentHash,
          evidenceKeyVersion: 2,
        },
        {
          ...publicCommand,
          input: { answers: { name: "Changed during rotation" } },
          requestHmac: "77".repeat(32),
        }
      )
    ).rejects.toBeInstanceOf(NileFormsRepositoryConflictError);

    await expect(
      repository.publicCommand(
        { ...context, evidenceKeyVersion: 2 },
        {
          ...publicCommand,
          idempotencyKey: "public:invalid-evidence-version",
        }
      )
    ).rejects.toBeInstanceOf(NileFormsRepositoryUnavailableError);
  });

  it("sends complete active and previous public evidence to the RPC", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const repository = createSupabaseNileFormsRepository({
      env: {},
      executorFetch: vi.fn(async (_path: string, init: RequestInit) => {
        calls.push(JSON.parse(String(init.body)) as Record<string, unknown>);
        return new Response(
          JSON.stringify([
            {
              data: { id: "submission_1" },
              replayed: false,
              command_id: "command_1",
            },
          ]),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }),
    });

    await repository.publicCommand(
      {
        ipHmac: "66".repeat(32),
        ipKeyVersion: 2,
        previousIpHmac: publicHmac,
        previousIpKeyVersion: 1,
        userAgentHash,
        evidenceKeyVersion: 2,
      },
      {
        operation: "forms.public.submit",
        publicationId: "publication_1",
        versionId: "version_1",
        input: { answers: { name: "Fake Applicant" } },
        clientSubmissionId: "public-client-rotation",
        idempotencyKey: "public:rotation:0001",
        requestHmac: "77".repeat(32),
      }
    );

    expect(calls[0]).toMatchObject({
      p_request_hmac: "77".repeat(32),
      p_request_fingerprint: expect.stringMatching(/^[0-9a-f]{64}$/),
      p_ip_hmac: "66".repeat(32),
      p_ip_key_version: 2,
      p_previous_ip_hmac: publicHmac,
      p_previous_ip_key_version: 1,
      p_evidence_key_version: 2,
    });
  });

  it("uses only bounded RPCs and never sends a database permission code", async () => {
    const calls: Array<{ path: string; body: Record<string, unknown> }> = [];
    const executorFetch = vi.fn(async (path: string, init: RequestInit) => {
      calls.push({
        path,
        body: JSON.parse(String(init.body)) as Record<string, unknown>,
      });
      return new Response(
        JSON.stringify([
          { data: { id: "form_1" }, replayed: false, command_id: "command_1" },
        ]),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });
    const repository = createSupabaseNileFormsRepository({
      env: {
        SUPABASE_URL: "http://127.0.0.1:54321",
        SUPABASE_PUBLISHABLE_KEY: "gateway-only",
        NILE_FORMS_EXECUTOR_KEY: "executor-only",
        SUPABASE_SERVICE_ROLE_KEY: "must-not-be-used",
      },
      executorFetch,
    });

    await repository.command(
      { sessionTokenHash: tokenHash },
      {
        operation: "forms.definitions.create",
        input: { key: "student_feedback" },
        idempotencyKey: "definition-create-0002",
        requestHash,
      }
    );

    expect(executorFetch).toHaveBeenCalledTimes(1);
    expect(calls[0].path).toBe("rpc/nile_forms_command");
    expect(calls[0].body).toMatchObject({
      p_token_hash: tokenHash,
      p_operation: "forms.definitions.create",
      p_idempotency_key: "definition-create-0002",
      p_request_hash: requestHash,
    });
    expect(calls[0].body).not.toHaveProperty("p_permission");
    expect(JSON.stringify(calls[0])).not.toContain("must-not-be-used");
  });

  it("keeps the gateway key separate and maps durable limiter denials", async () => {
    const fetchSpy = vi.fn(
      async (_input: string | URL | Request, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        expect(headers.get("apikey")).toBe("gateway-only");
        expect(headers.get("Authorization")).toBe("Bearer executor-only");
        return new Response(
          JSON.stringify([
            {
              data: {},
              replayed: false,
              command_id: null,
              error_code: "forms_public_rate_limited",
            },
          ]),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
    );
    vi.stubGlobal("fetch", fetchSpy);
    const repository = createSupabaseNileFormsRepository({
      env: {
        SUPABASE_URL: "http://127.0.0.1:54321",
        SUPABASE_PUBLISHABLE_KEY: "gateway-only",
        NILE_FORMS_EXECUTOR_KEY: "executor-only",
      },
    });

    await expect(
      repository.publicCommand(
        {
          ipHmac: publicHmac,
          ipKeyVersion: 1,
          userAgentHash,
          evidenceKeyVersion: 1,
        },
        {
          operation: "forms.public.submit",
          publicationId: "publication_1",
          versionId: "version_1",
          input: { answers: { name: "Rate limited" } },
          clientSubmissionId: "public-client-limited",
          idempotencyKey: "public:limited:0001",
          requestHmac: publicHmac,
        }
      )
    ).rejects.toBeInstanceOf(NileFormsRepositoryRateLimitError);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("fails normalized promotion before invoking an executor", async () => {
    const executorFetch = vi.fn();
    const repository = createSupabaseNileFormsRepository({
      env: {
        SUPABASE_URL: "http://127.0.0.1:54321",
        SUPABASE_PUBLISHABLE_KEY: "gateway-only",
        NILE_FORMS_EXECUTOR_KEY: "executor-only",
      },
      executorFetch,
    });

    await expect(repository.promote()).rejects.toBeInstanceOf(
      NileFormsPromotionPersistenceInactiveError
    );
    expect(executorFetch).not.toHaveBeenCalled();
  });

  it("keeps memory default and rejects unsafe or mismatched activation", async () => {
    await initializeNileFormsRepository({
      NODE_ENV: "production",
      NILE_FORMS_NORMALIZED_PERSISTENCE_ENABLED: "0",
      NILE_FORMS_REPOSITORY: "supabase",
    });
    expect(getNileFormsRepository().kind).toBe("memory");

    await expect(
      initializeNileFormsRepository({
        NODE_ENV: "production",
        NILE_FORMS_NORMALIZED_PERSISTENCE_ENABLED: "1",
      })
    ).rejects.toBeInstanceOf(NileFormsRepositoryUnavailableError);
    expect(getNileFormsRepository().kind).toBe("unavailable");

    await expect(
      initializeNileFormsRepository({
        NODE_ENV: "test",
        SUPABASE_URL: "https://remote-project.supabase.co",
        NILE_FORMS_NORMALIZED_PERSISTENCE_ENABLED: "1",
      })
    ).rejects.toBeInstanceOf(NileFormsRepositoryUnavailableError);
  });

  it("accepts only a matching isolated-local contract for acceptance tooling", async () => {
    const executorFetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify([
            {
              catalogVersion: NILE_FORMS_RPC_CATALOG_VERSION,
              schemaEvidenceSha256: NILE_FORMS_SCHEMA_EVIDENCE_SHA256,
              executorRole: NILE_FORMS_EXECUTOR_ROLE,
              draftKeyVersion: 1,
              publicHmacKeyVersion: 1,
              publicHmacPreviousKeyVersion: null,
              offlineMacKeyVersion: 1,
            },
          ]),
          { status: 200, headers: { "content-type": "application/json" } }
        )
    );
    const repository = await initializeNileFormsRepository(
      {
        NODE_ENV: "test",
        SUPABASE_URL: "http://127.0.0.1:54321",
        NILE_FORMS_NORMALIZED_PERSISTENCE_ENABLED: "1",
        NILE_FORMS_REPOSITORY: "supabase",
        NILE_FORMS_LOCAL_ACCEPTANCE_ACK,
        NILE_FORMS_RPC_CATALOG_VERSION,
        NILE_FORMS_SCHEMA_EVIDENCE_SHA256,
        SUPABASE_PUBLISHABLE_KEY: "gateway-only",
        NILE_FORMS_EXECUTOR_KEY: "executor-only",
        NILE_FORMS_DRAFT_KEY_VERSION: "1",
        NILE_FORMS_PUBLIC_HMAC_KEY: key,
        NILE_FORMS_PUBLIC_HMAC_KEY_VERSION: "1",
        NILE_FORMS_OFFLINE_MAC_KEY: key,
        NILE_FORMS_OFFLINE_MAC_KEY_VERSION: "1",
      },
      { executorFetch }
    );

    expect(repository.kind).toBe("supabase");
    expect(executorFetch).toHaveBeenCalledTimes(1);
  });
});

describe("Nile Forms centralized answer projection", () => {
  const content: FormVersionContent = {
    title: { en: "Sensitive form", ar: "نموذج حساس" },
    description: { en: "", ar: "" },
    defaultLanguage: "en",
    languages: ["en", "ar"],
    submitLabel: { en: "Submit", ar: "إرسال" },
    confirmationMessage: { en: "Done", ar: "تم" },
    pages: [
      {
        id: "page_1",
        title: { en: "Details", ar: "التفاصيل" },
        fields: [
          {
            id: "subject",
            type: "short_text",
            label: { en: "Subject", ar: "الموضوع" },
            searchable: true,
            reportable: true,
          },
          {
            id: "government_id",
            type: "short_text",
            label: { en: "Government ID", ar: "الهوية" },
            dataClass: "government_id",
            searchable: true,
            reportable: true,
          },
        ],
      },
    ],
    logic: [],
  };
  const answers = {
    subject: "Access",
    government_id: "FAKE-0001",
    unknown: "x",
  };

  it("redacts sensitive and unknown answers unless a scoped grant permits projection", () => {
    expect(
      projectNileFormAnswers(content, answers, {
        mode: "projection",
        canReadSensitive: false,
      })
    ).toEqual({ subject: "Access" });
    expect(
      projectNileFormAnswers(content, answers, {
        mode: "projection",
        canReadSensitive: true,
      })
    ).toEqual({ subject: "Access", government_id: "FAKE-0001" });
  });

  it("never exposes sensitive fields to indexes, audit, logs, or outbox", () => {
    for (const mode of ["index", "audit", "log", "outbox"] as const) {
      expect(
        projectNileFormAnswers(content, answers, {
          mode,
          canReadSensitive: true,
        })
      ).toEqual({ subject: "Access" });
    }
    expect(projectableNileFormFieldIds(content, "export", false)).toEqual([
      "subject",
    ]);
    expect(projectableNileFormFieldIds(content, "export", true)).toEqual([
      "subject",
      "government_id",
    ]);
  });
});
