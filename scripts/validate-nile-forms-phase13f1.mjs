import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = relativePath =>
  readFileSync(path.join(root, relativePath), "utf8");

const repository = read("server/nileFormsRepository.ts");
const authority = read("server/nileFormsAuthority.ts");
const service = read("server/nileFormsService.ts");
const environment = read(".env.example");
const forward = read(
  "supabase/manual/013_phase13f1_nile_forms_normalized_persistence.sql"
);
const assertions = read("supabase/manual/013_phase13f1_assertions.sql");
const fixture = read("supabase/manual/113_phase13f1_fake_seed.sql");
const rollback = read("supabase/manual/913_phase13f1_rollback.sql");
const dataApi = read("scripts/validate-nile-forms-phase13f1-data-api.ts");

function stringArray(source, name) {
  const match = source.match(
    new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const;`)
  );
  assert.ok(match, `Missing ${name}`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map(item => item[1]);
}

const queries = stringArray(repository, "nileFormsQueryOperations");
const commands = stringArray(repository, "nileFormsCommandOperations");
const publicQueries = stringArray(repository, "nileFormsPublicQueryOperations");
const publicCommands = stringArray(
  repository,
  "nileFormsPublicCommandOperations"
);

assert.equal(queries.length, 13, "Expected 13 protected query operations");
assert.equal(commands.length, 20, "Expected 20 protected command operations");
assert.deepEqual(publicQueries, ["forms.publications.public.get"]);
assert.deepEqual(publicCommands, [
  "forms.public.draft.save",
  "forms.public.submit",
]);

for (const operation of [...queries, ...commands]) {
  const escaped = operation.replaceAll(".", "\\.");
  assert.match(
    forward,
    new RegExp(`\\('${escaped}', '(query|command)'`),
    `SQL permission catalog is missing ${operation}`
  );
  assert.ok(
    authority.includes(`"${operation}"`),
    `Server permission map is missing ${operation}`
  );
}
for (const operation of [...publicQueries, ...publicCommands]) {
  assert.ok(
    forward.includes(`'${operation}'`),
    `SQL public operation catalog is missing ${operation}`
  );
}

const permissionPairs = [
  ["forms:read", "forms.read"],
  ["forms:write", "forms.write"],
  ["forms:publish", "forms.publish"],
  ["forms:assign", "forms.assign"],
  ["forms:respond", "forms.respond"],
  ["form_submissions:read", "form_submissions.read"],
  ["form_submissions:review", "form_submissions.review"],
  ["form_submissions:export", "form_submissions.export"],
  ["form_submissions:sensitive_read", "form_submissions.sensitive_read"],
];
for (const [applicationCode, databaseCode] of permissionPairs) {
  assert.ok(
    authority.includes(`"${applicationCode}"`) &&
      authority.includes(`"${databaseCode}"`),
    `Server permission mapping is missing ${applicationCode}`
  );
  assert.ok(
    forward.includes(`('${applicationCode}', '${databaseCode}')`),
    `SQL permission mapping is missing ${applicationCode}`
  );
}

const evidenceHash =
  "aae2c27e6dc6ecaa48162ac03937e82e37d3cfd5c533e7a11e84d0d7725a8e63";
for (const [name, source] of [
  ["repository", repository],
  ["environment", environment],
  ["forward SQL", forward],
  ["assertions", assertions],
]) {
  assert.ok(source.includes(evidenceHash), `${name} schema evidence differs`);
}

const phase13f1Tables = [
  "form_permission_mappings",
  "form_operation_permissions",
  "role_grant_permissions",
  "form_command_results",
  "form_public_commands",
  "form_public_rate_limits",
  "form_offline_bundles",
  "form_offline_bundle_items",
  "nile_forms_repository_contract",
];
for (const table of phase13f1Tables) {
  assert.ok(
    forward.includes(`create table public.${table}`),
    `Forward SQL is missing ${table}`
  );
  assert.ok(
    forward.includes(`alter table public.${table} enable row level security`) &&
      forward.includes(`alter table public.${table} force row level security`),
    `${table} does not have forced RLS`
  );
  assert.ok(
    rollback.includes(`drop table public.${table}`),
    `Rollback does not remove ${table}`
  );
  assert.ok(
    assertions.includes(`'${table}'`),
    `Assertions do not cover ${table}`
  );
}

for (const signature of [
  "public.nile_forms_query(text, text, text, jsonb)",
  "public.nile_forms_public_query(text, text)",
  "public.nile_forms_command(text, text, text, jsonb, text, text)",
  "public.nile_forms_public_command(\n  text, uuid, uuid, jsonb, text, text, text, text, text, integer, text, integer, text, integer\n)",
  "public.nile_forms_contract_status()",
]) {
  assert.ok(
    forward.includes(`grant execute on function ${signature}`),
    `Executor grant is missing ${signature}`
  );
}

for (const marker of [
  "create role nile_forms_executor nologin noinherit nobypassrls",
  "grant nile_forms_executor to authenticator",
  "from public, anon, authenticated, nile_forms_executor",
  "from nile_forms_executor;",
  "set search_path = ''",
  "form_submissions_authority_exclusive_check",
  "outbox_events_authority_exactly_one_check",
  "form_submission_index_values_reject_sensitive",
  "form_submissions.sensitive_read",
  "old.request_fingerprint is distinct from new.request_fingerprint",
  "and member_role.rolname <> 'authenticator'",
  "or datetime_field_overflow",
  "phase13f1-v1",
  "LOCAL ACCEPTANCE ONLY",
]) {
  assert.ok(
    forward.includes(marker),
    `Forward SQL marker is missing: ${marker}`
  );
}

assert.doesNotMatch(
  forward,
  /create policy/i,
  "Phase 13F1 must add no browser table policy"
);
assert.doesNotMatch(
  forward,
  /grant\s+(select|insert|update|delete)[\s\S]{0,200}\bto\s+(anon|authenticated)\b/i,
  "Browser roles must receive no table DML"
);
assert.doesNotMatch(
  forward,
  /\b(ip_address|client_ip|remote_address)\b/i,
  "Raw public addresses must not be persisted"
);
assert.ok(
  forward.includes("ip_hmac bytea") &&
    forward.includes("ip_key_version integer"),
  "Versioned public address HMAC evidence is missing"
);
assert.ok(
  dataApi.includes("form_public_rate_limits?select=ip_key_version") &&
    !dataApi.includes("form_public_rate_limits?select=id"),
  "The Data API gate must query a real limiter composite-key column"
);

for (const marker of [
  "drop role nile_forms_executor",
  "drop column public_command_id",
  "alter column command_id set not null",
  "create or replace function nile_private.preserve_form_submission_evidence()",
  "create or replace function nile_private.preserve_outbox_identity()",
  "where code = 'form_submissions.sensitive_read'",
]) {
  assert.ok(rollback.includes(marker), `Rollback marker is missing: ${marker}`);
}

assert.ok(
  fixture.includes("deterministic local-only acceptance fixture") &&
    fixture.includes("FAKE-0001") &&
    fixture.includes("phase13f1_preserved_intake"),
  "Phase 13F1 fake preservation fixture is incomplete"
);
assert.doesNotMatch(
  fixture,
  /(jotform_api_key|access_token|refresh_token|authorization_header|service_role_key)/i,
  "Phase 13F1 fixture contains a credential-shaped field"
);

assert.match(environment, /NILE_FORMS_NORMALIZED_PERSISTENCE_ENABLED="0"/);
assert.match(environment, /VITE_NILE_FORMS_CUTOVER_ENABLED="0"/);
assert.match(environment, /NILE_FORMS_REPOSITORY="memory"/);
assert.ok(
  service.includes("normalized_persistence_inactive"),
  "Normalized compatibility requests must still fail closed"
);
assert.ok(
  repository.includes("forms_promotion_persistence_inactive") &&
    repository.includes("throw new NileFormsPromotionPersistenceInactiveError"),
  "Normalized promotion must remain inactive before persistence"
);
assert.ok(
  repository.includes('headers.set("apikey", apiKey)') &&
    repository.includes(
      'headers.set("Authorization", `Bearer ${executorKey}`)'
    ) &&
    !repository.includes("SUPABASE_SERVICE_ROLE_KEY"),
  "The runtime adapter must separate its gateway key from the RPC-only executor"
);

const computedEvidenceHash = createHash("sha256")
  .update(
    forward.replaceAll(evidenceHash, "<NILE_FORMS_SCHEMA_EVIDENCE_SHA256>")
  )
  .digest("hex");
assert.equal(
  computedEvidenceHash,
  evidenceHash,
  "Phase 13F1 schema evidence must match the normalized forward SQL"
);

const migrationFiles = readdirSync(path.join(root, "supabase/migrations"));
assert.equal(
  migrationFiles.filter(file => /phase13f1/i.test(file)).length,
  0,
  "Phase 13F1 SQL must remain outside pushable migration history"
);

console.log(
  JSON.stringify({
    ok: true,
    phase: "13F1",
    protectedQueries: queries.length,
    protectedCommands: commands.length,
    publicQueries: publicQueries.length,
    publicCommands: publicCommands.length,
    permissionMappings: permissionPairs.length,
    additiveTables: phase13f1Tables.length,
    browserPolicies: 0,
    migrationHistoryEntries: 0,
    runtimeDefault: "memory",
    normalizedActivation: false,
    promotionExecution: false,
  })
);
