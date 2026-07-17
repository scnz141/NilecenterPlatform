import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manual = path.join(root, "supabase/manual");
const read = file => readFileSync(path.join(manual, file), "utf8");
const migration = read("011_phase6h1_moodle_assignment_result_observation.sql");
const seed = read("111_phase6h1_moodle_assignment_result_fake_seed.sql");
const assertions = read("211_phase6h1_moodle_assignment_result_assertions.sql");
const rollback = read("911_phase6h1_moodle_assignment_result_rollback.sql");

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
  JSON.stringify(["moodle_assignment_result_observations"])
) {
  fail(`Phase 6H1 must create exactly one table; found ${tables.join(", ")}`);
}

const promoted = readdirSync(path.join(root, "supabase/migrations")).filter(
  file => file.includes("phase6h1") || file.startsWith("011_")
);
if (promoted.length) fail(`Phase 6H1 must remain manual-only: ${promoted}`);

markers(migration, "Schema contract", [
  "moodle_assessment_status_observations",
  "create table public.moodle_assignment_result_observations",
  "assignment_projection_id uuid not null references public.external_records(id)",
  "subject_user_id uuid references public.app_users(id)",
  "audience in ('learner', 'person_level', 'aggregate')",
  "check ((audience = 'learner') = (subject_user_id is not null))",
  "fresh_until = observed_at + interval '15 minutes'",
  "purge_after <= observed_at + interval '30 days'",
  "before update or delete on public.moodle_assignment_result_observations",
  "alter table public.moodle_assignment_result_observations enable row level security;",
  "alter table public.moodle_assignment_result_observations force row level security;",
  "from public, anon, authenticated, service_role;",
  "connection.provider = 'moodle'",
  "connection.mode = 'read_only'",
  "connection.status = 'ready'",
  "run_row.direction <> 'read'",
  "'assignment_results_projection'",
  "p_limit < 1 or p_limit > 1000",
  "limit p_limit",
  "Assignment result observation idempotency conflict",
  "'stale_retained'",
  "'expired'",
]);
if (/create\s+policy/i.test(migration)) {
  fail("Forced-RLS assignment result table must have no policies");
}
if (/\bp_subject_user_id\b/i.test(migration + seed + assertions)) {
  fail("Phase 6H1 authority must not accept a client-selected subject user");
}
if (
  /grant\s+(select|insert|update|delete)[\s\S]*moodle_assignment_result_observations/i.test(
    migration
  )
) {
  fail("Assignment result observations must remain RPC-only");
}

const contextColumns = `returns table (
  connection_id uuid,
  active_role text,
  projection_audience text,
  internal_course_id uuid,
  internal_course_run_id uuid,
  internal_class_group_id uuid,
  assignment_projection_id uuid,
  authorized_user_ids uuid[],
  course_mapping_status text,
  group_mapping_status text,
  user_mapping_status text,
  assignment_mapping_status text,
  observed_at timestamptz
)`;
markers(migration, "Authority result columns", [contextColumns]);

markers(migration, "Audience authority", [
  "'student', 'teacher', 'headofdepartment', 'superadmin'",
  "when 'student' then 'learner'",
  "when 'teacher' then 'person_level'",
  "else 'aggregate'",
  "authorized_user_ids := array[p_user_id]::uuid[]",
  "assignment.class_group_id = class_context.class_group_id",
  "class_context.department_id = any(effective_grant.department_ids)",
  "learner.id = any(authorized_user_ids)",
  "mapping.entity_type = 'assignment'",
  "mapping.external_parent_id = course_external_id",
  "mapping.sync_state in ('matched', 'synced')",
]);

const signatures = [
  "public.resolve_moodle_assignment_result_context(uuid, uuid, uuid, uuid)",
  "public.record_moodle_assignment_result_observation(text, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, text, jsonb, bytea, timestamptz, timestamptz, timestamptz, uuid, text)",
  "public.list_authorized_moodle_assignment_result_freshness(uuid, uuid, uuid, uuid, uuid, timestamptz)",
  "public.purge_moodle_assignment_result_observations(timestamptz, integer)",
];
for (const signature of signatures) {
  markers(migration, "RPC privilege contract", [
    `revoke all on function ${signature}\nfrom public, anon, authenticated;`,
    `grant execute on function ${signature}\nto service_role;`,
  ]);
}

for (const functionName of [
  "resolve_moodle_assignment_result_context",
  "record_moodle_assignment_result_observation",
  "list_authorized_moodle_assignment_result_freshness",
  "purge_moodle_assignment_result_observations",
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

markers(migration, "Closed payload contract", [
  "moodle_assignment_result_payload_is_safe",
  "audience not in ('learner', 'person_level', 'aggregate')",
  "'assignmentProjectionId', 'internalClassGroupId', 'internalCourseId'",
  "'attemptNumber', 'gradingState', 'internalEnrollmentId'",
  "'internalMembershipId', 'internalUserId', 'latest', 'submissionState'",
  "'attemptNumber', 'gradedAt', 'gradingState', 'internalEnrollmentId'",
  "'internalMembershipId', 'internalUserId', 'latest', 'maximumScore'",
  "'modifiedAt', 'score', 'submissionState', 'submittedAt'",
  "learner->>'submissionState' not in ('not_submitted', 'draft', 'submitted', 'reopened')",
  "learner->>'gradingState' not in ('not_graded', 'graded', 'released')",
  "'^(0|[1-9]|1[0-9]|20)$'",
  "'assignmentProjectionId', 'gradedCount', 'internalClassGroupId'",
  "'internalCourseId', 'learnerCount', 'mappingStatus', 'providerState'",
  "'submittedCount'",
]);

const payloads = [
  ...seed.matchAll(/'(\{"internalCourseId"[\s\S]*?\})'::jsonb/g),
].map(match => JSON.parse(match[1]));
if (payloads.length !== 3) {
  fail(
    `Expected learner, person, and aggregate fixtures; found ${payloads.length}`
  );
}
const personPayloads = payloads.filter(payload =>
  Array.isArray(payload.learners)
);
const aggregatePayloads = payloads.filter(payload => "learnerCount" in payload);
if (personPayloads.length !== 2 || aggregatePayloads.length !== 1) {
  fail(
    "Fixture audiences do not contain two person variants and one aggregate variant"
  );
}
for (const payload of payloads) {
  if (!/^[0-9a-f-]{36}$/.test(payload.assignmentProjectionId)) {
    fail("Payload assignment reference is not an internal UUID");
  }
}
for (const forbidden of [
  "providerId",
  "moodleId",
  "file",
  "text",
  "comment",
  "answer",
  "feedback",
  "grader",
  "email",
  "phone",
  "contact",
]) {
  if (
    payloads.some(payload =>
      JSON.stringify(payload).toLowerCase().includes(`\"${forbidden}`)
    )
  ) {
    fail(`Fixture leaks forbidden assignment result field: ${forbidden}`);
  }
}
if (
  Object.keys(aggregatePayloads[0]).some(key =>
    ["learners", "internalUserId", "score", "maximumScore"].includes(key)
  )
) {
  fail("Aggregate fixture leaks person-level identifiers or scores");
}
if (/\b(fetch|axios|https?:\/\/|moodleRoutes)\b/i.test(migration + seed)) {
  fail("Phase 6H1 SQL contains a remote-provider path");
}

markers(seed, "Fake fixture", [
  "phase6h1.fake.assignment.learner",
  "phase6h1.fake.assignment.person",
  "phase6h1.fake.assignment.aggregate",
  "'2026-07-17T12:15:00Z'",
  "provider_result_drift",
]);
markers(assertions, "Semantic assertions", [
  "Student own-result context mismatch",
  "Teacher exact-class person scope mismatch",
  "HOD aggregate scope mismatch",
  "Registrar received assignment result context",
  "Branch Admin received assignment result context",
  "Fresh own-learner result mismatch",
  "HOD aggregate-only result mismatch",
  "Idempotent assignment result replay created a duplicate",
  "Conflicting assignment result replay was accepted",
  "Attempt number above 20 was accepted",
  "Feedback was accepted in H1",
  "Missing assignment mapping retained result payload",
  "Revoked teacher retained exact-class result access",
  "Bounded assignment result purge mismatch",
  "rollback;",
]);
markers(rollback, "Rollback", [
  "drop function public.purge_moodle_assignment_result_observations",
  "drop function public.list_authorized_moodle_assignment_result_freshness",
  "drop function public.record_moodle_assignment_result_observation",
  "drop function public.resolve_moodle_assignment_result_context",
  "drop table public.moodle_assignment_result_observations;",
  "drop function nile_private.guard_moodle_assignment_result_immutable",
  "drop function nile_private.moodle_assignment_result_payload_is_safe",
]);
if (/\b(delete|truncate)\b/i.test(rollback)) {
  fail("Rollback must preserve prior phases and durable integration evidence");
}

console.log(
  JSON.stringify({
    ok: true,
    package: "phase6h1-moodle-assignment-result-observation",
    manualOnly: true,
    tables: 1,
    serviceRoleOnlyRpcs: signatures.length,
    audiences: ["learner", "person_level", "aggregate"],
    freshMinutes: 15,
    maximumRetentionDays: 30,
    remoteCalls: 0,
  })
);
