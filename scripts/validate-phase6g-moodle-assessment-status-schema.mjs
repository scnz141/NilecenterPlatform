import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manual = path.join(root, "supabase/manual");
const read = file => readFileSync(path.join(manual, file), "utf8");
const migration = read("010_phase6g_moodle_assessment_status_observation.sql");
const seed = read("110_phase6g_moodle_assessment_status_fake_seed.sql");
const assertions = read("210_phase6g_moodle_assessment_status_assertions.sql");
const rollback = read("910_phase6g_moodle_assessment_status_rollback.sql");

function fail(message) {
  throw new Error(message);
}

function markers(source, label, required) {
  for (const marker of required) {
    if (!source.includes(marker)) fail(`${label} is missing: ${marker}`);
  }
}

const tables = [
  ...migration.matchAll(/create table public\.([a-z][a-z0-9_]*)/g),
].map(match => match[1]);
if (
  JSON.stringify(tables) !==
  JSON.stringify(["moodle_assessment_status_observations"])
) {
  fail(`Phase 6G must create exactly one table; found ${tables.join(", ")}`);
}

const promoted = readdirSync(path.join(root, "supabase/migrations")).filter(
  file => file.includes("phase6g") || file.startsWith("010_")
);
if (promoted.length) fail(`Phase 6G must remain manual-only: ${promoted}`);

markers(migration, "Schema contract", [
  "create table public.moodle_assessment_status_observations",
  "before update or delete on public.moodle_assessment_status_observations",
  "alter table public.moodle_assessment_status_observations enable row level security;",
  "alter table public.moodle_assessment_status_observations force row level security;",
  "from public, anon, authenticated, service_role;",
  "outcome in ('available', 'empty', 'unavailable', 'reconciliation')",
  "fresh_until = observed_at + interval '15 minutes'",
  "purge_after <= observed_at + interval '30 days'",
  "p_limit < 1 or p_limit > 1000",
  "limit p_limit",
  "'assessment_status_projection'",
  "run_row.direction <> 'read'",
  "connection.provider = 'moodle'",
  "connection.mode = 'read_only'",
  "connection.status = 'ready'",
  "connection_count <> 1",
  "user_authority.active_role not in (",
  "'student', 'teacher', 'headofdepartment', 'superadmin'",
  "then 'learner' else 'class_staff' end",
  "when active_role <> 'student' then 'not_required'",
  "enrollment.status in ('active', 'completed')",
  "assignment.class_group_id = class_context.group_id",
  "class_context.department_id = any(effective_grant.department_ids)",
  "Assessment status observation idempotency conflict",
  "'stale_retained'",
  "'expired'",
  "then 'reconciliation'",
]);
if (/create\s+policy/i.test(migration)) {
  fail("Forced-RLS observation table must have no policies");
}
if (/\bp_assessment_kind\b/i.test(migration + seed + assertions)) {
  fail("Atomic Phase 6G RPCs must not expose an assessment-kind selector");
}

const contextColumns = `returns table (
  connection_id uuid,
  active_role text,
  projection_audience text,
  internal_course_id uuid,
  internal_course_run_id uuid,
  internal_class_group_id uuid,
  subject_user_id uuid,
  course_mapping_status text,
  group_mapping_status text,
  user_mapping_status text,
  assessment_mapping_status text,
  observed_at timestamptz
)`;
const freshnessColumns = `returns table (
  connection_id uuid,
  active_role text,
  projection_audience text,
  internal_course_id uuid,
  internal_course_run_id uuid,
  internal_class_group_id uuid,
  subject_user_id uuid,
  course_mapping_status text,
  group_mapping_status text,
  user_mapping_status text,
  assessment_mapping_status text,
  freshness_state text,
  latest_outcome text,
  reconciliation_reason text,
  sanitized_payload jsonb,
  projection_hash bytea,
  successful_sync_run_id uuid,
  successful_observed_at timestamptz,
  fresh_until timestamptz,
  retain_until timestamptz,
  latest_observed_at timestamptz,
  authority_observed_at timestamptz
)`;
markers(migration, "TypeScript result-column contract", [
  contextColumns,
  freshnessColumns,
]);

const rpcSignatures = [
  "public.resolve_moodle_assessment_status_context(uuid, uuid, uuid)",
  "public.record_moodle_assessment_status_observation(text, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, jsonb, bytea, timestamptz, timestamptz, timestamptz, uuid, text)",
  "public.list_authorized_moodle_assessment_status_freshness(uuid, uuid, uuid, uuid, timestamptz)",
  "public.purge_moodle_assessment_status_observations(timestamptz, integer)",
];
for (const signature of rpcSignatures) {
  markers(migration, "RPC privilege contract", [
    `revoke all on function ${signature}\nfrom public, anon, authenticated;`,
    `grant execute on function ${signature}\nto service_role;`,
  ]);
}

for (const functionName of [
  "resolve_moodle_assessment_status_context",
  "record_moodle_assessment_status_observation",
  "list_authorized_moodle_assessment_status_freshness",
  "purge_moodle_assessment_status_observations",
]) {
  const definition = migration.match(
    new RegExp(
      `create function public\\.${functionName}\\([\\s\\S]*?\\n\\$\\$;`
    )
  );
  if (!definition) fail(`Missing RPC: ${functionName}`);
  markers(definition[0], functionName, [
    "security definer",
    "set search_path = ''",
  ]);
}

markers(migration, "Atomic sanitized payload contract", [
  "moodle_assessment_status_payload_is_safe",
  "pg_catalog.octet_length(payload::text) > 131072",
  "nile_private.jsonb_has_forbidden_keys(payload)",
  "'internalClassGroupId', 'internalCourseId', 'items'",
  "'acceptsSubmissions', 'closesAt', 'cutoffAt', 'dueAt', 'kind'",
  "'opensAt', 'projectionId', 'title', 'visibility'",
  "item->>'kind' not in ('assignment', 'quiz')",
  "mapping.id = (payload_item->>'projectionId')::uuid",
  "mapping.entity_type in ('assignment', 'quiz')",
]);

const payloadLiterals = [
  ...seed.matchAll(/'(\{"internalCourseId"[\s\S]*?\})'::jsonb/g),
].map(match => JSON.parse(match[1]));
if (payloadLiterals.length !== 2) {
  fail(`Expected two atomic payload fixtures; found ${payloadLiterals.length}`);
}
const rootKeys = [
  "internalClassGroupId",
  "internalCourseId",
  "items",
  "mappingStatus",
  "providerState",
];
const requiredItemKeys = [
  "acceptsSubmissions",
  "kind",
  "projectionId",
  "title",
  "visibility",
];
const allowedItemKeys = new Set([
  ...requiredItemKeys,
  "opensAt",
  "dueAt",
  "cutoffAt",
  "closesAt",
]);
for (const payload of payloadLiterals) {
  const keys = Object.keys(payload).sort();
  if (JSON.stringify(keys) !== JSON.stringify(rootKeys)) {
    fail(`Unexpected root payload keys: ${keys}`);
  }
  for (const item of payload.items) {
    if (!requiredItemKeys.every(key => Object.hasOwn(item, key))) {
      fail(
        `Assessment item is missing a required key: ${JSON.stringify(item)}`
      );
    }
    if (Object.keys(item).some(key => !allowedItemKeys.has(key))) {
      fail(
        `Assessment item contains an unapproved key: ${JSON.stringify(item)}`
      );
    }
    if (!/^[0-9a-f-]{36}$/.test(item.projectionId)) {
      fail(
        `Assessment item does not use an internal projection UUID: ${item.projectionId}`
      );
    }
  }
}

for (const forbidden of [
  "modifiedAt",
  "submission",
  "attempt",
  "grade",
  "feedback",
  "question",
  "answer",
  "completion",
  "contact",
  "url",
  "html",
  "providerMetadata",
  "moodleId",
]) {
  if (
    payloadLiterals.some(payload =>
      JSON.stringify(payload).includes(`\"${forbidden}\"`)
    )
  ) {
    fail(`Snapshot fixture leaks forbidden field: ${forbidden}`);
  }
}

if (
  /grant\s+(select|insert|update|delete)[\s\S]*moodle_assessment_status_observations/i.test(
    migration
  )
) {
  fail("Observation table must remain RPC-only");
}
if (/\b(fetch|axios|https?:\/\/|moodleRoutes)\b/i.test(migration + seed)) {
  fail("Phase 6G SQL contains a remote-provider path");
}

markers(seed, "Fake fixture", [
  "phase6g-fake-only-v1",
  "'assignment'",
  "'quiz'",
  "phase6g.class.8101.empty",
  "phase6g.class.8101.available",
  "phase6g.class.8101.unavailable",
  "phase6g.class.8101.reconciliation",
  "'2026-07-17T12:15:00Z'",
  "'2026-07-24T12:00:00Z'",
]);
markers(assertions, "Semantic assertions", [
  "Student exact-class context mismatch",
  "Teacher exact current-class context mismatch",
  "HOD department context mismatch",
  "Registrar received assessment status context",
  "Branch Admin received assessment status context",
  "Fresh learner assessment snapshot mismatch",
  "Teacher stale-retained snapshot mismatch",
  "Expired snapshot remained retained",
  "Unavailable snapshot semantics mismatch",
  "Reconciliation snapshot semantics mismatch",
  "Idempotent assessment status replay created a duplicate",
  "Conflicting assessment status replay was accepted",
  "Learner without exact user mapping retained payload",
  "Revoked teacher assignment retained exact-class access",
  "Bounded purge did not delete exactly one eligible row",
  "rollback;",
]);
markers(rollback, "Rollback", [
  "drop function public.purge_moodle_assessment_status_observations",
  "drop function public.list_authorized_moodle_assessment_status_freshness",
  "drop function public.record_moodle_assessment_status_observation",
  "drop function public.resolve_moodle_assessment_status_context",
  "drop table public.moodle_assessment_status_observations;",
  "drop function nile_private.guard_moodle_assessment_status_immutable",
  "drop function nile_private.moodle_assessment_status_payload_is_safe",
]);
if (/\b(delete|truncate)\b/i.test(rollback)) {
  fail(
    "Rollback must preserve Phase 6A/6E/6F and durable integration evidence"
  );
}

console.log(
  JSON.stringify({
    ok: true,
    package: "phase6g-moodle-assessment-status-observation",
    manualOnly: true,
    tables: 1,
    serviceRoleOnlyRpcs: rpcSignatures.length,
    snapshot: "atomic-assignment-and-quiz",
    freshMinutes: 15,
    fixtureRetentionDays: 7,
    maximumRetentionDays: 30,
    audiences: ["learner", "class_staff"],
    freshnessStates: [
      "fresh",
      "stale_retained",
      "expired",
      "unavailable",
      "reconciliation",
    ],
  })
);
