import assert from "node:assert/strict";
import crypto from "node:crypto";

import {
  createSupabaseNileFormsRepository,
  initializeNileFormsRepository,
  NileFormsPromotionPersistenceInactiveError,
  NileFormsRepositoryAuthorityError,
  NileFormsRepositoryConflictError,
  NileFormsRepositoryRateLimitError,
  NILE_FORMS_EXECUTOR_ROLE,
  NILE_FORMS_LOCAL_ACCEPTANCE_ACK,
  NILE_FORMS_RPC_CATALOG_VERSION,
  NILE_FORMS_SCHEMA_EVIDENCE_SHA256,
  resetDefaultNileFormsRepository,
  type NileFormsPublicRepositoryContext,
  type NileFormsRepository,
} from "../server/nileFormsRepository.js";

const localHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const localUrl = clean(process.env.SUPABASE_URL).replace(/\/+$/, "");
const anonKey = clean(process.env.NILE_LOCAL_SUPABASE_ANON_KEY);
const serviceKey = clean(
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);
const jwtSecret = clean(process.env.NILE_LOCAL_SUPABASE_JWT_SECRET);
const mode =
  process.argv.find(value => value.startsWith("--mode="))?.slice(7) ?? "core";

assert.equal(
  process.env.NILE_FORMS_PHASE13F1_DISPOSABLE_LOCAL,
  "1",
  "Phase 13F1 Data API validation requires disposable-local acknowledgement."
);
assert.ok(localUrl, "A local Supabase URL is required.");
const parsedUrl = new URL(localUrl);
assert.equal(
  parsedUrl.protocol,
  "http:",
  "Phase 13F1 Data API validation is HTTP-local only."
);
assert.ok(
  localHosts.has(parsedUrl.hostname),
  "Phase 13F1 Data API validation is local-only."
);
assert.ok(
  parsedUrl.port,
  "Phase 13F1 Data API validation requires an explicit local port."
);
assert.ok(
  anonKey && serviceKey && jwtSecret,
  "Local Supabase acceptance keys are required."
);
assert.ok(
  ["core", "contract-only", "revoke-first", "command-first"].includes(mode),
  `Unsupported Phase 13F1 Data API mode: ${mode}`
);

const tokens = {
  admin: "a".repeat(64),
  registrar: "b".repeat(64),
  revokeFirst: "e".repeat(64),
  commandFirst: "f".repeat(64),
};

const publicContext = {
  ipHmac: "8".repeat(64),
  ipKeyVersion: 1,
  userAgentHash: "9".repeat(64),
  evidenceKeyVersion: 1,
};
const replayPublicContext: NileFormsPublicRepositoryContext = {
  ipHmac: "a".repeat(64),
  ipKeyVersion: 1,
  userAgentHash: publicContext.userAgentHash,
  evidenceKeyVersion: 1,
};
const conflictPublicContext: NileFormsPublicRepositoryContext = {
  ipHmac: "b".repeat(64),
  ipKeyVersion: 1,
  userAgentHash: publicContext.userAgentHash,
  evidenceKeyVersion: 1,
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function hash(value: string) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function signedJwt(role: string, subject?: string) {
  const now = Math.floor(Date.now() / 1_000);
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({
      aud: "authenticated",
      role,
      ...(subject ? { sub: subject } : {}),
      iss: "supabase",
      iat: now,
      exp: now + 600,
    })
  );
  const signature = crypto
    .createHmac("sha256", jwtSecret)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

const executorJwt = signedJwt(NILE_FORMS_EXECUTOR_ROLE);
const authenticatedJwt = signedJwt(
  "authenticated",
  "10000000-0000-4000-8000-000000000003"
);
const repositoryEnv: NodeJS.ProcessEnv = {
  ...process.env,
  NODE_ENV: "test",
  SUPABASE_URL: localUrl,
  SUPABASE_PUBLISHABLE_KEY: anonKey,
  NILE_FORMS_EXECUTOR_KEY: executorJwt,
  NILE_FORMS_NORMALIZED_PERSISTENCE_ENABLED: "1",
  NILE_FORMS_REPOSITORY: "supabase",
  NILE_FORMS_LOCAL_ACCEPTANCE_ACK,
  NILE_FORMS_RPC_CATALOG_VERSION,
  NILE_FORMS_SCHEMA_EVIDENCE_SHA256,
  NILE_FORMS_DRAFT_KEY_VERSION: "1",
  NILE_FORMS_PUBLIC_HMAC_KEY: "1".repeat(64),
  NILE_FORMS_PUBLIC_HMAC_KEY_VERSION: "1",
  NILE_FORMS_OFFLINE_MAC_KEY: "2".repeat(64),
  NILE_FORMS_OFFLINE_MAC_KEY_VERSION: "1",
};

async function apiRequest(
  path: string,
  authorization: string,
  apiKey: string,
  init: RequestInit = {}
) {
  const headers = new Headers(init.headers);
  headers.set("apikey", apiKey);
  headers.set("Authorization", `Bearer ${authorization}`);
  headers.set("Content-Type", "application/json");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  timeout.unref?.();
  try {
    return await fetch(`${localUrl}/rest/v1/${path.replace(/^\/+/, "")}`, {
      ...init,
      headers,
      signal: init.signal ?? controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function responsePayload(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function adminJson<T>(path: string, init: RequestInit = {}) {
  const response = await apiRequest(path, serviceKey, serviceKey, init);
  const payload = await responsePayload(response);
  assert.ok(
    response.ok,
    `Local service request failed: ${init.method ?? "GET"} ${path} (${response.status}) ${JSON.stringify(payload)}`
  );
  return payload as T;
}

async function expectPostgresDenial(
  label: string,
  authorization: string,
  apiKey: string,
  path: string,
  init: RequestInit = {}
) {
  const response = await apiRequest(path, authorization, apiKey, init);
  const payload = (await responsePayload(response)) as {
    code?: unknown;
  } | null;
  assert.ok(
    response.status === 401 || response.status === 403,
    `${label} should be denied, received ${response.status}: ${JSON.stringify(payload)}`
  );
  assert.equal(
    payload?.code,
    "42501",
    `${label} missed the PostgreSQL permission boundary.`
  );
}

async function assertDataApiRoleBoundary() {
  await expectPostgresDenial(
    "anonymous Forms RPC",
    anonKey,
    anonKey,
    "rpc/nile_forms_contract_status",
    { method: "POST", body: "{}" }
  );
  await expectPostgresDenial(
    "authenticated Forms RPC",
    authenticatedJwt,
    anonKey,
    "rpc/nile_forms_contract_status",
    { method: "POST", body: "{}" }
  );
  await expectPostgresDenial(
    "service-role Forms RPC",
    serviceKey,
    serviceKey,
    "rpc/nile_forms_contract_status",
    { method: "POST", body: "{}" }
  );
  await expectPostgresDenial(
    "executor base-table DML",
    executorJwt,
    anonKey,
    "form_definitions",
    {
      method: "POST",
      body: JSON.stringify({ form_key: "must_not_write" }),
    }
  );
}

async function assertFreshFixture() {
  const marker = await adminJson<
    Array<{
      provider: string;
      label: string;
      environment: string;
      mode: string;
    }>
  >(
    "integration_connections?id=eq.a0000000-0000-4000-8000-000000000001&select=provider,label,environment,mode"
  );
  assert.deepEqual(marker, [
    {
      provider: "nile_phase2_test_fixture",
      label: "phase2b-disposable-local-v1",
      environment: "local",
      mode: "disabled",
    },
  ]);

  const contract = await adminJson<
    Array<{
      catalog_version: string;
      schema_evidence_sha256: string;
      executor_role: string;
    }>
  >(
    "nile_forms_repository_contract?select=catalog_version,schema_evidence_sha256,executor_role"
  );
  assert.deepEqual(contract, [
    {
      catalog_version: NILE_FORMS_RPC_CATALOG_VERSION,
      schema_evidence_sha256: NILE_FORMS_SCHEMA_EVIDENCE_SHA256,
      executor_role: NILE_FORMS_EXECUTOR_ROLE,
    },
  ]);

  const preserved = await adminJson<
    Array<{ answer_json: Record<string, unknown> }>
  >(
    "form_submissions?id=eq.f6000000-0000-4000-8000-000000000001&select=answer_json"
  );
  assert.equal(preserved.length, 1);
  assert.equal(preserved[0].answer_json.national_id, "FAKE-0001");

  const [protectedCommands, publicCommands, limiterRows] = await Promise.all([
    adminJson<Array<{ id: string }>>(
      "command_executions?command_type=like.forms.%2A&select=id"
    ),
    adminJson<Array<{ id: string }>>("form_public_commands?select=id"),
    adminJson<Array<{ ip_key_version: number }>>(
      "form_public_rate_limits?select=ip_key_version"
    ),
  ]);
  assert.deepEqual(
    protectedCommands,
    [],
    "Phase 13F1 Data API gate requires fresh Forms commands."
  );
  assert.deepEqual(
    publicCommands,
    [],
    "Phase 13F1 Data API gate requires fresh public commands."
  );
  assert.deepEqual(
    limiterRows,
    [],
    "Phase 13F1 Data API gate requires a fresh limiter window."
  );
}

function definitionInput() {
  const fields = [
    {
      id: "full_name",
      type: "short_text",
      searchable: true,
      reportable: true,
      dataClass: "standard",
    },
    {
      id: "national_id",
      type: "short_text",
      searchable: false,
      reportable: true,
      dataClass: "government_id",
    },
  ];
  return {
    key: "phase13f1_data_api_runtime",
    title: "Phase 13F1 Data API runtime",
    category: "admissions",
    schema: { fields },
    logic: [],
    translations: {
      en: { title: "Phase 13F1 Data API runtime" },
      ar: { title: "AR Phase 13F1 Data API runtime" },
    },
    contentHash: hash("phase13f1:data-api:definition"),
  };
}

function requestHash(
  operation: string,
  targetId: string | undefined,
  input: object
) {
  return hash(JSON.stringify({ operation, targetId: targetId ?? null, input }));
}

async function command<T>(
  repository: NileFormsRepository,
  token: string,
  operation: Parameters<NileFormsRepository["command"]>[1]["operation"],
  input: Record<string, unknown>,
  idempotencyKey: string,
  targetId?: string
) {
  return repository.command<T>(
    { sessionTokenHash: token },
    {
      operation,
      targetId,
      input,
      idempotencyKey,
      requestHash: requestHash(operation, targetId, input),
    }
  );
}

function publicRequestHmac(
  publicationId: string,
  versionId: string,
  clientSubmissionId: string,
  input: object
) {
  return hash(
    JSON.stringify({
      operation: "forms.public.submit",
      publicationId,
      versionId,
      clientSubmissionId,
      input,
    })
  );
}

async function publicSubmit<T>(
  repository: NileFormsRepository,
  publicationId: string,
  versionId: string,
  clientSubmissionId: string,
  input: Record<string, unknown>,
  idempotencyKey: string,
  hmac = publicRequestHmac(publicationId, versionId, clientSubmissionId, input),
  context: NileFormsPublicRepositoryContext = publicContext
) {
  return repository.publicCommand<T>(context, {
    operation: "forms.public.submit",
    publicationId,
    versionId,
    input,
    clientSubmissionId,
    idempotencyKey,
    requestHmac: hmac,
  });
}

async function avoidRateWindowBoundary() {
  const now = new Date();
  if (now.getUTCSeconds() < 55) return;
  await sleep((60 - now.getUTCSeconds()) * 1_000 + 250);
}

async function repositoryForAcceptance() {
  return initializeNileFormsRepository(repositoryEnv);
}

async function formsEvidenceIds() {
  const [commands, audits, outbox] = await Promise.all([
    adminJson<Array<{ id: string }>>(
      "command_executions?command_type=like.forms.%2A&select=id&order=id.asc"
    ),
    adminJson<Array<{ id: string }>>(
      "audit_logs?action=like.forms.%2A&select=id&order=id.asc"
    ),
    adminJson<Array<{ id: string }>>(
      "outbox_events?event_type=like.form.%2A&select=id&order=id.asc"
    ),
  ]);
  return { commands, audits, outbox };
}

async function runContractOnly() {
  await assertDataApiRoleBoundary();
  const repository = await repositoryForAcceptance();
  assert.deepEqual(await repository.contractStatus(), {
    catalogVersion: NILE_FORMS_RPC_CATALOG_VERSION,
    schemaEvidenceSha256: NILE_FORMS_SCHEMA_EVIDENCE_SHA256,
    executorRole: NILE_FORMS_EXECUTOR_ROLE,
    draftKeyVersion: 1,
    publicHmacKeyVersion: 1,
    publicHmacPreviousKeyVersion: null,
    offlineMacKeyVersion: 1,
  });
  console.log(
    JSON.stringify({
      ok: true,
      mode,
      adapter: repository.kind,
      dataApiRoleDenials: 4,
    })
  );
}

async function runCore() {
  await assertFreshFixture();
  await assertDataApiRoleBoundary();
  const repository = await repositoryForAcceptance();

  const createInput = definitionInput();
  const created = await command<{
    definition: { id: string };
    version: { id: string };
  }>(
    repository,
    tokens.admin,
    "forms.definitions.create",
    createInput,
    "phase13f1:data-api:create"
  );
  assert.equal(created.replayed, false);
  const replay = await command(
    repository,
    tokens.admin,
    "forms.definitions.create",
    createInput,
    "phase13f1:data-api:create"
  );
  assert.equal(replay.replayed, true);
  assert.equal(replay.commandId, created.commandId);
  await assert.rejects(
    command(
      repository,
      tokens.admin,
      "forms.definitions.create",
      { ...createInput, key: "phase13f1_data_api_conflict" },
      "phase13f1:data-api:create"
    ),
    NileFormsRepositoryConflictError
  );

  const publishInput = {
    versionId: created.data.version.id,
    slug: "phase13f1-data-api-runtime",
    audience: "public",
    allowMultiple: true,
    allowDrafts: true,
    offlineEligible: false,
  };
  const published = await command<{ publication: { id: string } }>(
    repository,
    tokens.admin,
    "forms.versions.publish",
    publishInput,
    "phase13f1:data-api:publish",
    created.data.definition.id
  );
  const publicationId = published.data.publication.id;
  const versionId = created.data.version.id;
  const publicProjection = await repository.publicQuery<{
    publication: { id: string };
  }>({
    operation: "forms.publications.public.get",
    targetId: "phase13f1-data-api-runtime",
  });
  assert.equal(publicProjection.publication.id, publicationId);

  const firstInput = {
    answers: {
      full_name: "Fake Data API applicant 1",
      national_id: "DATA-API-SECRET-1",
    },
  };
  await avoidRateWindowBoundary();
  const first = await publicSubmit<{
    submission: { id: string; answer_json: Record<string, unknown> };
  }>(
    repository,
    publicationId,
    versionId,
    "data-api-public-0001",
    firstInput,
    "phase13f1:data-api:public:0001"
  );
  assert.equal(first.replayed, false);
  assert.equal(first.data.submission.answer_json.national_id, undefined);
  const publicReplay = await publicSubmit(
    repository,
    publicationId,
    versionId,
    "data-api-public-0001",
    firstInput,
    "phase13f1:data-api:public:0001",
    "6".repeat(64),
    replayPublicContext
  );
  assert.equal(publicReplay.replayed, true);
  assert.equal(publicReplay.commandId, first.commandId);
  await assert.rejects(
    publicSubmit(
      repository,
      publicationId,
      versionId,
      "data-api-public-0001",
      firstInput,
      "phase13f1:data-api:public:0001",
      "7".repeat(64),
      conflictPublicContext
    ),
    NileFormsRepositoryConflictError
  );

  const concurrentLimiterResults = await Promise.allSettled(
    Array.from({ length: 10 }, (_, offset) => {
      const sequence = offset + 2;
      const suffix = String(sequence).padStart(4, "0");
      return publicSubmit(
        repository,
        publicationId,
        versionId,
        `data-api-public-${suffix}`,
        { answers: { full_name: `Fake Data API applicant ${sequence}` } },
        `phase13f1:data-api:public:${suffix}`
      );
    })
  );
  const accepted = concurrentLimiterResults.filter(
    result => result.status === "fulfilled"
  );
  const limited = concurrentLimiterResults.filter(
    result => result.status === "rejected"
  );
  assert.equal(
    accepted.length,
    9,
    "Concurrent durable limiter must accept only nine remaining slots."
  );
  assert.equal(
    limited.length,
    1,
    "Concurrent durable limiter must reject exactly the eleventh attempt."
  );
  assert.ok(
    limited[0].status === "rejected" &&
      limited[0].reason instanceof NileFormsRepositoryRateLimitError
  );

  const limiterRows = await adminJson<Array<{ attempts: number }>>(
    `form_public_rate_limits?operation=eq.forms.public.submit&ip_hmac=eq.%5Cx${publicContext.ipHmac}&select=attempts`
  );
  assert.deepEqual(limiterRows, [{ attempts: 11 }]);
  const replayLimiterRows = await adminJson<Array<{ attempts: number }>>(
    `form_public_rate_limits?operation=eq.forms.public.submit&ip_hmac=eq.%5Cx${replayPublicContext.ipHmac}&select=attempts`
  );
  const conflictLimiterRows = await adminJson<Array<{ attempts: number }>>(
    `form_public_rate_limits?operation=eq.forms.public.submit&ip_hmac=eq.%5Cx${conflictPublicContext.ipHmac}&select=attempts`
  );
  assert.deepEqual(replayLimiterRows, [{ attempts: 1 }]);
  assert.deepEqual(conflictLimiterRows, [{ attempts: 1 }]);
  const publicCommands = await adminJson<Array<{ id: string }>>(
    `form_public_commands?publication_id=eq.${publicationId}&select=id`
  );
  assert.equal(publicCommands.length, 10);

  const preservedSubmissionId = "f6000000-0000-4000-8000-000000000001";
  const registrarGrantId = "50000000-0000-4000-8000-000000000003";
  const beforeGrant = await repository.query<{
    submission: { answer_json: Record<string, unknown> };
  }>(
    { sessionTokenHash: tokens.registrar },
    { operation: "forms.submissions.get", targetId: preservedSubmissionId }
  );
  assert.equal(beforeGrant.submission.answer_json.national_id, undefined);
  await command(
    repository,
    tokens.admin,
    "forms.permissions.sensitive.grant",
    { reason: "Local Phase 13F1 Data API projection acceptance" },
    "phase13f1:data-api:sensitive:grant",
    registrarGrantId
  );
  const afterGrant = await repository.query<{
    submission: { answer_json: Record<string, unknown> };
  }>(
    { sessionTokenHash: tokens.registrar },
    { operation: "forms.submissions.get", targetId: preservedSubmissionId }
  );
  assert.equal(afterGrant.submission.answer_json.national_id, "FAKE-0001");
  await command(
    repository,
    tokens.admin,
    "forms.permissions.sensitive.revoke",
    {},
    "phase13f1:data-api:sensitive:revoke",
    registrarGrantId
  );
  const afterRevoke = await repository.query<{
    submission: { answer_json: Record<string, unknown> };
  }>(
    { sessionTokenHash: tokens.registrar },
    { operation: "forms.submissions.get", targetId: preservedSubmissionId }
  );
  assert.equal(afterRevoke.submission.answer_json.national_id, undefined);

  const evidenceBeforePromotion = await formsEvidenceIds();
  await assert.rejects(
    repository.promote(),
    NileFormsPromotionPersistenceInactiveError
  );
  const evidenceAfterPromotion = await formsEvidenceIds();
  assert.deepEqual(evidenceAfterPromotion, evidenceBeforePromotion);

  console.log(
    JSON.stringify({
      ok: true,
      mode,
      adapter: repository.kind,
      protectedReplayConflict: true,
      publicReplayConflict: true,
      concurrentLimiter: { accepted: 10, rejected: 1, durableAttempts: 11 },
      sensitiveGrantCycle: true,
      dataApiRoleDenials: 4,
      promotionInactive: true,
    })
  );
}

async function revokeSession(tokenHash: string, label: string) {
  const response = await apiRequest(
    "rpc/revoke_auth_session_with_evidence",
    serviceKey,
    serviceKey,
    {
      method: "POST",
      body: JSON.stringify({
        p_token_hash: tokenHash,
        p_idempotency_key: `phase13f1:race:${label}:revoke`,
        p_request_hash: hash(`phase13f1:race:${label}:revoke`),
      }),
    }
  );
  const payload = await responsePayload(response);
  assert.ok(
    response.ok,
    `Race revocation failed with ${response.status}: ${JSON.stringify(payload)}`
  );
  assert.ok(
    Array.isArray(payload) && payload.length === 1,
    "Race revocation returned no evidence."
  );
  return payload;
}

async function sleep(milliseconds: number) {
  await new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function runRace(raceMode: "revoke-first" | "command-first") {
  assert.equal(
    process.env.NILE_FORMS_PHASE13F1_RACE_LOCKED,
    "1",
    "Race mode requires the local PostgreSQL row-lock orchestrator."
  );
  const repository = createSupabaseNileFormsRepository({ env: repositoryEnv });
  const token =
    raceMode === "revoke-first" ? tokens.revokeFirst : tokens.commandFirst;
  const label = raceMode;
  const deviceInput = {
    label: `Phase 13F1 ${label} device`,
    deviceTokenHash: hash(`phase13f1:${label}:device`),
    publicKey: `FAKE-PUBLIC-KEY-${label.toUpperCase()}-0000000000000000000000`,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1_000).toISOString(),
  };
  const commandPromise = () =>
    command(
      repository,
      token,
      "forms.offline.devices.enroll",
      deviceInput,
      `phase13f1:race:${label}:command`
    );
  const revokePromise = () => revokeSession(token, label);
  const startedAt = Date.now();

  const first =
    raceMode === "revoke-first" ? revokePromise() : commandPromise();
  await sleep(150);
  const second =
    raceMode === "revoke-first" ? commandPromise() : revokePromise();
  const [firstResult, secondResult] = await Promise.allSettled([first, second]);
  assert.ok(
    Date.now() - startedAt >= 1_000,
    "Race requests did not wait behind the required PostgreSQL session-row lock."
  );

  const commandResult =
    raceMode === "revoke-first" ? secondResult : firstResult;
  const revokeResult = raceMode === "revoke-first" ? firstResult : secondResult;
  assert.equal(
    revokeResult.status,
    "fulfilled",
    `${label} revocation must commit.`
  );
  if (raceMode === "revoke-first") {
    assert.ok(
      commandResult.status === "rejected" &&
        commandResult.reason instanceof NileFormsRepositoryAuthorityError,
      "Revoke-first must deny the queued Forms command."
    );
  } else {
    assert.equal(
      commandResult.status,
      "fulfilled",
      "Command-first must commit before revocation."
    );
  }

  const [sessions, formCommands, revokeCommands] = await Promise.all([
    adminJson<Array<{ revoked_at: string | null }>>(
      `auth_sessions?token_hash=eq.%5Cx${token}&select=revoked_at`
    ),
    adminJson<Array<{ id: string }>>(
      `command_executions?idempotency_key=eq.phase13f1%3Arace%3A${label}%3Acommand&select=id`
    ),
    adminJson<Array<{ id: string }>>(
      `command_executions?idempotency_key=eq.phase13f1%3Arace%3A${label}%3Arevoke&select=id`
    ),
  ]);
  assert.equal(sessions.length, 1);
  assert.ok(sessions[0].revoked_at);
  assert.equal(formCommands.length, raceMode === "command-first" ? 1 : 0);
  assert.equal(revokeCommands.length, 1);

  console.log(
    JSON.stringify({
      ok: true,
      mode: raceMode,
      concurrent: true,
      winner: raceMode === "command-first" ? "command" : "revocation",
      formCommandRows: formCommands.length,
      revokeRows: revokeCommands.length,
    })
  );
}

try {
  if (mode === "core") await runCore();
  else if (mode === "contract-only") await runContractOnly();
  else await runRace(mode);
} finally {
  await resetDefaultNileFormsRepository();
}
