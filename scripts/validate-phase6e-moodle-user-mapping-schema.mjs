import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manualDir = path.join(root, "supabase/manual");
const files = {
  migration: "008_phase6e_moodle_user_mapping_authority.sql",
  seed: "108_phase6e_moodle_user_mapping_authority_fake_seed.sql",
  assertions: "208_phase6e_moodle_user_mapping_authority_assertions.sql",
  rollback: "908_phase6e_moodle_user_mapping_authority_rollback.sql",
};
const sql = Object.fromEntries(
  Object.entries(files).map(([key, file]) => [
    key,
    readFileSync(path.join(manualDir, file), "utf8"),
  ])
);

function fail(message) {
  throw new Error(message);
}

function requireMarkers(source, label, markers) {
  for (const marker of markers) {
    if (!source.includes(marker)) fail(`${label} is missing: ${marker}`);
  }
}

if (/\bcreate\s+table\b/i.test(sql.migration)) {
  fail("Phase 6E must not create a table");
}

const promoted = readdirSync(path.join(root, "supabase/migrations")).filter(
  file => file.includes("phase6e") || file.startsWith("008_")
);
if (promoted.length > 0) {
  fail(`Phase 6E must remain manual-only: ${promoted.join(", ")}`);
}

requireMarkers(sql.migration, "Migration", [
  "create function public.resolve_moodle_user_projection_authority(",
  "create function public.list_moodle_user_mappings_for_connection(",
  "authorized_user_ids uuid[]",
  "security definer",
  "set search_path = ''",
  "authority.active_role not in (",
  "'student'",
  "'teacher'",
  "'headofdepartment'",
  "'superadmin'",
  "public.teacher_assignments",
  "public.class_memberships",
  "public.enrollments",
  "program.department_id = any(authority.department_ids)",
  "connection.provider = 'moodle'",
  "connection.mode = 'read_only'",
  "connection.status = 'ready'",
  "external_record.entity_type = 'user'",
  "external_record.sync_state <> 'ignored'",
  "pg_catalog.cardinality(p_internal_user_ids) = 0",
  "app_user.status = 'active'",
]);

const signatures = [
  "public.resolve_moodle_user_projection_authority(uuid, uuid)",
  "public.list_moodle_user_mappings_for_connection(uuid, uuid[])",
];
for (const signature of signatures) {
  requireMarkers(sql.migration, "RPC privilege contract", [
    `revoke all on function ${signature}\nfrom public, anon, authenticated;`,
    `grant execute on function ${signature}\nto service_role;`,
  ]);
}

for (const functionName of [
  "resolve_moodle_user_projection_authority",
  "list_moodle_user_mappings_for_connection",
]) {
  const definition = sql.migration.match(
    new RegExp(
      `create function public\\.${functionName}\\([\\s\\S]*?\\n\\$\\$;`
    )
  );
  if (!definition) fail(`Missing RPC definition: ${functionName}`);
  requireMarkers(definition[0], functionName, [
    "security definer",
    "set search_path = ''",
  ]);
}

if (
  /\b(insert|update|delete)\s+(into\s+)?public\.(?!external_records\b)/i.test(
    sql.migration
  )
) {
  fail("Phase 6E migration contains an out-of-scope normalized write");
}
if (
  /\b(fetch|axios|moodleRoutes|enrollment_projection)\b/i.test(sql.migration)
) {
  fail("Phase 6E migration crosses the read-only user-mapping boundary");
}

const returnedColumns = sql.migration.match(
  /create function public\.list_moodle_user_mappings_for_connection\([\s\S]*?returns table \(([\s\S]*?)\)\nlanguage/
)?.[1];
if (!returnedColumns) fail("Mapping DTO return shape is missing");
for (const forbidden of ["metadata", "source_hash", "source_version"]) {
  if (new RegExp(`\\b${forbidden}\\b`).test(returnedColumns)) {
    fail(`Mapping DTO leaks raw field: ${forbidden}`);
  }
}

requireMarkers(sql.seed, "Fake seed", [
  "phase6e-fake-only-v1",
  "phase6e-fake-only",
  "phase6e-negative-control",
  "'user'",
  "'ba000000-0000-4000-8000-000000000001'",
  "'bf000000-0000-4000-8000-000000000007'",
]);
const exactFixtureCount = (
  sql.seed.match(/'bf000000-0000-4000-8000-00000000000[1-6]'/g) ?? []
).length;
if (exactFixtureCount !== 6) {
  fail(`Expected six exact user fixtures, found ${exactFixtureCount}`);
}
const seedWithoutComments = sql.seed.replace(/^\s*--.*$/gm, "");
if (
  /(password|passwd|api.?key|authorization|cookie|credential)/i.test(
    seedWithoutComments
  )
) {
  fail("Phase 6E fake seed contains a secret-like marker");
}

requireMarkers(sql.assertions, "Assertions", [
  "Student Moodle user authority mismatch",
  "Teacher Moodle user authority mismatch",
  "HOD Moodle user authority mismatch",
  "Super Admin Moodle user authority mismatch",
  "Registrar was accepted",
  "Branch Admin was accepted",
  "Mismatched user and role grant",
  "Ended teacher assignment retained stale learner authority",
  "Expired HOD department scope retained stale authority",
  "Exact Moodle user mapping result mismatch",
  "Ignored Moodle user mapping leaked",
  "Empty mapping request was accepted",
  "Duplicate mapping request was accepted",
  "Non-Moodle connection was accepted",
  "Unknown app user was accepted",
  "Ignored exact mapping remained readable",
  "Inactive app user mapping was accepted",
  "rollback;",
]);

requireMarkers(sql.rollback, "Rollback", [
  "drop function public.list_moodle_user_mappings_for_connection(uuid, uuid[]);",
  "drop function public.resolve_moodle_user_projection_authority(uuid, uuid);",
]);
if (/\b(delete|truncate)\b/i.test(sql.rollback)) {
  fail("Phase 6E rollback must preserve durable external-record evidence");
}

console.log(
  JSON.stringify({
    ok: true,
    package: "phase6e-moodle-user-mapping-authority",
    manualOnly: true,
    newTables: 0,
    serviceRoleOnlyRpcs: signatures.length,
    exactFakeMappings: 6,
  })
);
