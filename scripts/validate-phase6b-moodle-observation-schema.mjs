import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sqlDir = path.join(root, "supabase/manual");
const migration = readFileSync(
  path.join(sqlDir, "007_phase6b_moodle_projection_observation.sql"),
  "utf8"
);
const seed = readFileSync(
  path.join(sqlDir, "107_phase6b_moodle_projection_observation_fake_seed.sql"),
  "utf8"
);
const assertions = readFileSync(
  path.join(sqlDir, "207_phase6b_moodle_projection_observation_assertions.sql"),
  "utf8"
);
const rollback = readFileSync(
  path.join(sqlDir, "907_phase6b_moodle_projection_observation_rollback.sql"),
  "utf8"
);

function fail(message) {
  throw new Error(message);
}

function assertIncludes(source, marker, label) {
  if (!source.includes(marker)) fail(`${label} is missing: ${marker}`);
}

const createdTables = [
  ...migration.matchAll(/create table public\.([a-z][a-z0-9_]*)/g),
].map(match => match[1]);
if (
  JSON.stringify(createdTables) !==
  JSON.stringify(["moodle_projection_observations"])
) {
  fail(
    `Phase 6B must create exactly one table; found: ${createdTables.join(", ")}`
  );
}

const promotedFiles = readdirSync(
  path.join(root, "supabase/migrations")
).filter(file => file.includes("phase6b"));
if (promotedFiles.length !== 0) {
  fail(`Phase 6B must remain unapplied: ${promotedFiles.join(", ")}`);
}

for (const marker of [
  "alter table public.moodle_projection_observations enable row level security;",
  "alter table public.moodle_projection_observations force row level security;",
  "before update or delete on public.moodle_projection_observations",
  "nile_private.reject_immutable_change()",
  "from public, anon, authenticated, service_role;",
  "sanitized_payload jsonb",
  "projection_hash bytea",
  "octet_length(projection_hash) = 32",
  "retain_until timestamptz",
  "successful_sync_run_id uuid",
  "retain_until > fresh_until",
  "retain_until <= observed_at + interval '30 days'",
  "projection_family in ('course_catalog', 'course_content')",
  "nile_private.jsonb_has_forbidden_keys(payload)",
  "revoke all on function nile_private.moodle_sanitized_projection_is_safe(jsonb, integer)",
  "pg_catalog.octet_length(payload::text) > 262144",
  "pg_catalog.jsonb_array_length(payload) > 500",
  "depth > 8",
  "outcome in ('available', 'empty')",
  "outcome = 'unavailable'",
  "outcome = 'reconciliation'",
  "'missing_mapping'",
  "'missing_provider_record'",
  "'ambiguous_mapping'",
]) {
  assertIncludes(migration, marker, "Phase 6B schema contract marker");
}

const acceptedReasonBlocks = migration.match(
  /'missing_mapping',\s*'missing_provider_record',\s*'ambiguous_mapping'/g
);
if (acceptedReasonBlocks?.length !== 2) {
  fail(
    "Phase 6B table and record RPC must use the same exact accepted reconciliation reason enum"
  );
}

if (
  /grant\s+(select|insert|update|delete)[\s\S]*moodle_projection_observations/i.test(
    migration
  )
) {
  fail("The immutable observation table must be RPC-only");
}

const rpcSignatures = [
  "public.resolve_moodle_projection_context(uuid, uuid)",
  "public.list_moodle_course_mappings_for_connection(uuid, uuid[])",
  "public.record_moodle_projection_observation(text, uuid, uuid, uuid, uuid, uuid, text, text, jsonb, bytea, timestamptz, timestamptz, timestamptz, uuid, text)",
  "public.list_authorized_moodle_projection_freshness(uuid, uuid, uuid, text, timestamptz, uuid[])",
  "public.resolve_moodle_projection_reconciliation(uuid, uuid, uuid, text)",
];
for (const signature of rpcSignatures) {
  assertIncludes(
    migration,
    `revoke all on function ${signature}\nfrom public, anon, authenticated;`,
    "Browser RPC revoke"
  );
  assertIncludes(
    migration,
    `grant execute on function ${signature}\nto service_role;`,
    "service_role RPC grant"
  );
}

for (const functionName of [
  "resolve_moodle_projection_context",
  "list_moodle_course_mappings_for_connection",
  "record_moodle_projection_observation",
  "list_authorized_moodle_projection_freshness",
  "resolve_moodle_projection_reconciliation",
]) {
  const definition = migration.match(
    new RegExp(
      `create function public\\.${functionName}\\([\\s\\S]*?\\n\\$\\$;`
    )
  );
  if (!definition) fail(`Missing Phase 6B RPC: ${functionName}`);
  assertIncludes(definition[0], "security definer", `${functionName} security`);
  assertIncludes(
    definition[0],
    "set search_path = ''",
    `${functionName} search_path`
  );
}

for (const marker of [
  "connection_count <> 1",
  "connection.provider = 'moodle'",
  "connection.mode = 'read_only'",
  "connection.status = 'ready'",
  "external_record.connection_id = p_connection_id",
  "Moodle observation idempotency conflict",
  "when 'course_catalog' then 'course'",
  "when 'course_content' then 'course_content'",
  "latest_observation.id = retained_success.id",
  "p_as_of <= observation.retain_until",
  "retained_success.sync_run_id",
  "when retained_success.id is null then 'unavailable'",
  "else 'stale'",
  "Moodle projection course filter is outside authorized context",
  "authorized_course.internal_course_id = any (p_internal_course_ids)",
  "context.active_role <> 'superadmin'",
]) {
  assertIncludes(migration, marker, "Phase 6B behavior marker");
}

for (const marker of [
  "phase6b.course-content.4201.success",
  "phase6b.course-content.4201.unavailable",
  "phase6b.course-content.4202.empty",
  "phase6b.course-content.4203.reconciliation",
  "phase6b.course-catalog.4201.success",
  '"sourceId":"4201","title":"Synthetic Arabic Course","shortTitle":"Arabic 1","visible":true',
  '"sourceId":"5101","position":1,"title":"Synthetic section","visible":true,"activities"',
  '"instanceSourceId":"7101","type":"page","title":"Synthetic welcome"',
  "'[]'::jsonb",
]) {
  assertIncludes(seed, marker, "Phase 6B fake fixture marker");
}

for (const forbiddenLegacyShape of [
  '"courseId"',
  '"modules"',
  '"kind"',
  '"name"',
]) {
  if (seed.includes(forbiddenLegacyShape)) {
    fail(
      `Phase 6B seed contains legacy read-model shape: ${forbiddenLegacyShape}`
    );
  }
}

for (const marker of [
  "Failed run replaced or hid the last sanitized success",
  "Fresh empty projection semantics mismatch",
  "Unavailable reconciliation semantics mismatch",
  "Expired retained content projection remained available",
  "Expired retained catalog projection remained available",
  "Course catalog read-model projection mismatch",
  "Malformed projection family was accepted by record RPC",
  "Malformed projection family was accepted by freshness RPC",
  "Exact-course freshness filter returned % rows instead of 1",
  "Out-of-authority freshness filter was accepted",
  "Projection family was not matched to sync-run entity type",
  "Observation exceeded the bounded retention window",
  "Idempotent observation replay created a duplicate",
  "Unsafe raw/error/contact/credential payload marker was accepted",
  "Multiple ready Moodle connections did not fail closed",
  "Teacher resolved a Moodle reconciliation case",
]) {
  assertIncludes(assertions, marker, "Phase 6B semantic assertion marker");
}

for (const marker of [
  "drop function public.resolve_moodle_projection_context(uuid, uuid);",
  "drop function public.list_moodle_course_mappings_for_connection(uuid, uuid[]);",
  "drop function public.record_moodle_projection_observation(text, uuid, uuid, uuid, uuid, uuid, text, text, jsonb, bytea, timestamptz, timestamptz, timestamptz, uuid, text);",
  "drop function public.list_authorized_moodle_projection_freshness(uuid, uuid, uuid, text, timestamptz, uuid[]);",
  "drop function public.resolve_moodle_projection_reconciliation(uuid, uuid, uuid, text);",
  "drop table public.moodle_projection_observations;",
  "drop function nile_private.moodle_sanitized_projection_is_safe(jsonb, integer);",
]) {
  assertIncludes(rollback, marker, "Phase 6B rollback marker");
}

console.log(
  JSON.stringify({
    ok: true,
    package: "phase6b-moodle-projection-observation",
    unapplied: true,
    tables: createdTables.length,
    serviceRoleOnlyRpcs: rpcSignatures.length,
    sanitizedProjectionRetention: true,
    projectionFamilies: ["course_catalog", "course_content"],
    maximumRetentionDays: 30,
    deterministicFreshnessStates: ["fresh", "stale", "unavailable"],
  })
);
