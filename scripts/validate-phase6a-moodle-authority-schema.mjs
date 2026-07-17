import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sqlDir = path.join(root, "supabase/manual");
const migrationPath = path.join(
  sqlDir,
  "006_phase6a_moodle_projection_authority.sql"
);
const seedPath = path.join(
  sqlDir,
  "106_phase6a_moodle_projection_authority_fake_seed.sql"
);
const assertionsPath = path.join(
  sqlDir,
  "206_phase6a_moodle_projection_authority_assertions.sql"
);
const rollbackPath = path.join(
  sqlDir,
  "906_phase6a_moodle_projection_authority_rollback.sql"
);
const attestationPath = path.join(
  root,
  "docs/qa-attestations/integration-phase6a-authority-repository-20260717.json"
);

const migration = readFileSync(migrationPath, "utf8");
const seed = readFileSync(seedPath, "utf8");
const assertions = readFileSync(assertionsPath, "utf8");
const rollback = readFileSync(rollbackPath, "utf8");
const attestation = JSON.parse(readFileSync(attestationPath, "utf8"));
const packageJson = JSON.parse(
  readFileSync(path.join(root, "package.json"), "utf8")
);

function fail(message) {
  throw new Error(message);
}

function unique(values) {
  return [...new Set(values)].sort();
}

function assertSameSet(label, actual, expected) {
  const normalizedActual = unique(actual);
  const normalizedExpected = unique(expected);
  if (JSON.stringify(normalizedActual) !== JSON.stringify(normalizedExpected)) {
    fail(
      `${label} mismatch\nactual: ${normalizedActual.join(", ")}\nexpected: ${normalizedExpected.join(", ")}`
    );
  }
}

function tableNamesFromBlock(source, pattern, label) {
  const match = source.match(pattern);
  if (!match) fail(`${label} block is missing`);
  return [...match[1].matchAll(/public\.([a-z][a-z0-9_]*)/g)].map(
    entry => entry[1]
  );
}

const expectedTables = [
  "programs",
  "course_levels",
  "course_templates",
  "student_profiles",
  "course_runs",
  "class_groups",
  "teacher_assignments",
  "enrollments",
  "class_memberships",
];

const createdTables = [
  ...migration.matchAll(/create table public\.([a-z][a-z0-9_]*)/g),
].map(entry => entry[1]);
const droppedTables = [
  ...rollback.matchAll(/drop table public\.([a-z][a-z0-9_]*)/g),
].map(entry => entry[1]);

assertSameSet("Phase 6A created tables", createdTables, expectedTables);
assertSameSet("Phase 6A rollback tables", droppedTables, expectedTables);

const promotedPhase6aFiles = readdirSync(
  path.join(root, "supabase/migrations")
).filter(file => file.includes("phase6a"));
if (promotedPhase6aFiles.length !== 0) {
  fail(
    `Phase 6A must remain unapplied; found migration history files: ${promotedPhase6aFiles.join(", ")}`
  );
}

for (const table of expectedTables) {
  for (const marker of [
    `alter table public.${table} enable row level security;`,
    `alter table public.${table} force row level security;`,
  ]) {
    if (!migration.includes(marker)) fail(`Missing security marker: ${marker}`);
  }
}

assertSameSet(
  "Browser revokes",
  tableNamesFromBlock(
    migration,
    /revoke all on table\s+([\s\S]*?)\s+from public, anon, authenticated;/,
    "Browser revoke"
  ),
  expectedTables
);
assertSameSet(
  "service_role grants",
  tableNamesFromBlock(
    migration,
    /grant select, insert, update, delete on table\s+([\s\S]*?)\s+to service_role;/,
    "service_role grant"
  ),
  expectedTables
);

const rpcSignatures = [
  "public.resolve_moodle_course_projection_authority(uuid, uuid)",
  "public.list_moodle_course_mappings(uuid[])",
];
for (const signature of rpcSignatures) {
  if (
    !migration.includes(
      `revoke all on function ${signature}\nfrom public, anon, authenticated;`
    )
  ) {
    fail(`Browser RPC revoke is missing for ${signature}`);
  }
  if (
    !migration.includes(
      `grant execute on function ${signature}\nto service_role;`
    )
  ) {
    fail(`service_role RPC grant is missing for ${signature}`);
  }
}

for (const functionName of [
  "resolve_moodle_course_projection_authority",
  "list_moodle_course_mappings",
]) {
  const match = migration.match(
    new RegExp(
      `create function public\\.${functionName}\\([\\s\\S]*?\\n\\$\\$;`
    )
  );
  if (!match) fail(`RPC definition is missing: ${functionName}`);
  if (!match[0].includes("security definer")) {
    fail(`RPC is not SECURITY DEFINER: ${functionName}`);
  }
  if (!match[0].includes("set search_path = ''")) {
    fail(`RPC does not pin an empty search_path: ${functionName}`);
  }
}

for (const marker of [
  "active_role text",
  "authorized_course_ids uuid[]",
  "observed_at timestamptz",
  "external_record.entity_type = 'course'",
  "connection.provider = 'moodle'",
  "external_record.sync_state <> 'ignored'",
]) {
  if (!migration.includes(marker))
    fail(`RPC contract marker is missing: ${marker}`);
}

const requiredIndexes = [
  "programs_department_id_idx",
  "course_levels_program_id_idx",
  "course_templates_program_id_idx",
  "course_templates_level_id_idx",
  "student_profiles_home_branch_id_idx",
  "course_runs_course_template_id_idx",
  "course_runs_branch_id_idx",
  "class_groups_course_run_id_idx",
  "teacher_assignments_class_group_id_idx",
  "teacher_assignments_teacher_profile_id_idx",
  "enrollments_student_profile_id_idx",
  "enrollments_course_run_id_idx",
  "class_memberships_enrollment_id_idx",
  "class_memberships_course_run_id_idx",
  "class_memberships_class_group_id_idx",
];
for (const indexName of requiredIndexes) {
  if (!migration.includes(`index ${indexName}`)) {
    fail(`Required foreign-key or authority index is missing: ${indexName}`);
  }
}

for (const marker of [
  "phase6a-synthetic-read-only",
  "phase6a-fake-only",
  "phase6a-negative-control",
  "b3000000-0000-4000-8000-000000000001",
]) {
  if (!seed.includes(marker)) fail(`Fake fixture marker is missing: ${marker}`);
}

for (const marker of [
  "Student Moodle course authority mismatch",
  "Valid empty teacher authority",
  "Mismatched user and role grant",
  "Ignored Moodle mapping",
  "Cross-run class membership",
]) {
  if (!assertions.includes(marker)) {
    fail(`Semantic assertion marker is missing: ${marker}`);
  }
}

const seedWithoutComments = seed.replace(/^\s*--.*$/gm, "");
if (
  /(password|passwd|api.?key|authorization|cookie|credential)/i.test(
    seedWithoutComments
  )
) {
  fail("Phase 6A fake fixture contains a forbidden secret-like marker");
}

const expectedScripts = {
  "check:phase6a-moodle-authority":
    "node scripts/validate-phase6a-moodle-authority-schema.mjs",
  "check:phase6a-moodle-authority:runtime":
    "node scripts/validate-phase6a-moodle-authority-pglite.mjs",
};
for (const [name, command] of Object.entries(expectedScripts)) {
  if (packageJson.scripts?.[name] !== command) {
    fail(`package.json script ${name} is missing or incorrect`);
  }
}

if (
  attestation.status !==
  "repository-contract-accepted-staging-promotion-pending"
) {
  fail("Phase 6A attestation status is missing or incorrect");
}
if (
  attestation.normalizedAuthorityPackage?.manualSqlOnly !== true ||
  attestation.normalizedAuthorityPackage?.productionRuntimeActivated !== false
) {
  fail("Phase 6A attestation must preserve the unapplied runtime boundary");
}
if (
  attestation.qualityGate?.totalChecks !== 1598 ||
  attestation.qualityGate?.failedChecks !== 0 ||
  attestation.qualityGate?.interrupted !== false ||
  attestation.qualityGate?.verifyPassed !== true
) {
  fail("Phase 6A attestation does not preserve the protected QA baseline");
}

const qaArtifactPath = path.join(root, attestation.qualityGate.artifact);
if (existsSync(qaArtifactPath)) {
  const artifact = readFileSync(qaArtifactPath);
  const artifactHash = createHash("sha256").update(artifact).digest("hex");
  if (artifactHash !== attestation.qualityGate.artifactSha256) {
    fail("Phase 6A QA artifact hash does not match the tracked attestation");
  }
}

console.log(
  JSON.stringify({
    ok: true,
    package: "phase6a-moodle-projection-authority",
    unapplied: true,
    tables: expectedTables.length,
    serviceRoleOnlyRpcs: rpcSignatures.length,
    requiredIndexes: requiredIndexes.length,
    attestation: path.relative(root, attestationPath),
  })
);
