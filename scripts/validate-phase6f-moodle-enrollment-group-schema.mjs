import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manual = path.join(root, "supabase/manual");
const read = file => readFileSync(path.join(manual, file), "utf8");
const migration = read("009_phase6f_moodle_enrollment_group_observation.sql");
const seed = read(
  "109_phase6f_moodle_enrollment_group_observation_fake_seed.sql"
);
const assertions = read(
  "209_phase6f_moodle_enrollment_group_observation_assertions.sql"
);
const rollback = read(
  "909_phase6f_moodle_enrollment_group_observation_rollback.sql"
);

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
  JSON.stringify(["moodle_enrollment_group_observations"])
) {
  fail(`Phase 6F must create exactly one table; found ${tables.join(", ")}`);
}

const promoted = readdirSync(path.join(root, "supabase/migrations")).filter(
  file => file.includes("phase6f") || file.startsWith("009_")
);
if (promoted.length) fail(`Phase 6F must remain manual-only: ${promoted}`);

markers(migration, "Schema contract", [
  "create table public.moodle_enrollment_group_observations",
  "before update or delete on public.moodle_enrollment_group_observations",
  "nile_private.reject_immutable_change()",
  "alter table public.moodle_enrollment_group_observations enable row level security;",
  "alter table public.moodle_enrollment_group_observations force row level security;",
  "from public, anon, authenticated, service_role;",
  "retain_until <= observed_at + interval '30 days'",
  "outcome in ('available', 'empty', 'unavailable', 'reconciliation')",
  "audience in ('person_level', 'aggregate')",
  "'enrollment_groups_projection'",
  "run_row.direction <> 'read'",
  "connection.provider = 'moodle'",
  "connection.mode = 'read_only'",
  "connection.status = 'ready'",
  "connection_count <> 1",
  "mapping.entity_type = 'course'",
  "mapping.entity_type = 'class_group'",
  "user_mapping.entity_type = 'user'",
  "projection_audience := case active_role",
  "when 'teacher' then 'person_level'",
  "else 'aggregate'",
  "user_authority.active_role not in ('teacher', 'headofdepartment', 'superadmin')",
  "assignment.class_group_id = class_context.class_group_id",
  "program.department_id",
  "class_context.department_id = any(effective_grant.department_ids)",
  "membership.status = 'active'",
  "enrollment.status = 'active'",
  "Enrollment/group observation idempotency conflict",
  "'stale_retained'",
  "'expired'",
  "then 'reconciliation'",
  "= any(context.authorized_user_ids)",
]);

const rpcSignatures = [
  "public.resolve_moodle_enrollment_group_context(uuid, uuid, uuid)",
  "public.record_moodle_enrollment_group_observation(text, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, text, jsonb, bytea, timestamptz, timestamptz, timestamptz, uuid, text)",
  "public.list_authorized_moodle_enrollment_group_freshness(uuid, uuid, uuid, uuid, timestamptz)",
];
for (const signature of rpcSignatures) {
  markers(migration, "RPC privilege contract", [
    `revoke all on function ${signature}\nfrom public, anon, authenticated;`,
    `grant execute on function ${signature}\nto service_role;`,
  ]);
}

for (const functionName of [
  "resolve_moodle_enrollment_group_context",
  "record_moodle_enrollment_group_observation",
  "list_authorized_moodle_enrollment_group_freshness",
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

markers(migration, "Sanitized payload contract", [
  "moodle_enrollment_group_payload_is_safe",
  "pg_catalog.octet_length(payload::text) > 65536",
  "nile_private.jsonb_has_forbidden_keys(payload)",
  "'internalClassGroupId'",
  "'internalCourseId'",
  "'internalEnrollmentId'",
  "'internalMembershipId'",
  "'internalUserId'",
  "'learnerCount'",
  "'mappedLearnerCount'",
  "'unmappedLearnerCount'",
]);
for (const forbidden of [
  "email",
  "fullName",
  "roles",
  "accessTime",
  "rawMetadata",
  "externalUserId",
]) {
  if (seed.includes(`\\"${forbidden}\\"`)) {
    fail(`Snapshot fixture leaks forbidden field: ${forbidden}`);
  }
}

if (
  /grant\s+(select|insert|update|delete)[\s\S]*moodle_enrollment_group_observations/i.test(
    migration
  )
) {
  fail("Observation table must remain RPC-only");
}
if (/\b(fetch|axios|https?:\/\/|moodleRoutes)\b/i.test(migration + seed)) {
  fail("Phase 6F SQL contains a remote-provider path");
}

markers(seed, "Fake fixture", [
  "phase6f-fake-only-v1",
  "'class_group'",
  "'enrollment_groups_projection'",
  "phase6f.person.8101.empty",
  "phase6f.person.8101.available",
  "phase6f.aggregate.8101.available",
  "phase6f.person.8101.unavailable",
  "phase6f.aggregate.8101.reconciliation",
]);

markers(assertions, "Semantic assertions", [
  "Teacher exact-class context mismatch",
  "HOD aggregate-only context mismatch",
  "Student received person-level class context",
  "Registrar received enrollment/group context",
  "Branch Admin received enrollment/group context",
  "Fresh empty person-level semantics mismatch",
  "Teacher stale-retained learner projection mismatch",
  "HOD aggregate reconciliation retention mismatch",
  "Expired aggregate projection remained retained",
  "Idempotent enrollment/group replay created a duplicate",
  "Raw email payload was accepted",
  "Observation exceeded 30 day retention",
  "Ignored user mapping retained person-level payload",
  "Ended class membership retained learner-level payload",
  "Revoked teacher assignment retained class projection access",
  "rollback;",
]);

markers(rollback, "Rollback", [
  "drop function public.list_authorized_moodle_enrollment_group_freshness",
  "drop function public.record_moodle_enrollment_group_observation",
  "drop function public.resolve_moodle_enrollment_group_context",
  "drop table public.moodle_enrollment_group_observations;",
  "drop function nile_private.moodle_enrollment_group_payload_is_safe",
]);
if (/\b(delete|truncate)\b/i.test(rollback)) {
  fail("Rollback must preserve Phase 6A/6E and durable external evidence");
}

console.log(
  JSON.stringify({
    ok: true,
    package: "phase6f-moodle-enrollment-group-observation",
    manualOnly: true,
    tables: 1,
    serviceRoleOnlyRpcs: rpcSignatures.length,
    maximumRetentionDays: 30,
    audiences: ["person_level", "aggregate"],
    freshnessStates: [
      "fresh",
      "stale_retained",
      "expired",
      "unavailable",
      "reconciliation",
    ],
  })
);
