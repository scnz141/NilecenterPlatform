#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  accessSync,
  chmodSync,
  constants as fsConstants,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contractPath = path.join(
  root,
  "docs/integration-phase6-staging-promotion.json"
);
const modes = ["--static-preflight", "--dry-run", "--live"];
const selectedModes = modes.filter(mode => process.argv.includes(mode));
const unknownArgs = process.argv
  .slice(2)
  .filter(
    argument => !modes.includes(argument) && !argument.startsWith("--output=")
  );

if (unknownArgs.length > 0) {
  throw new Error(`Unknown argument(s): ${unknownArgs.join(", ")}`);
}
if (selectedModes.length !== 1) {
  throw new Error(`Choose exactly one mode: ${modes.join(", ")}.`);
}

const mode = selectedModes[0].slice(2);
const outputArg = process.argv.find(argument =>
  argument.startsWith("--output=")
);
const timestamp = new Date().toISOString().replaceAll(":", "-");
const outputPath = path.resolve(
  root,
  outputArg?.slice("--output=".length) ??
    `output/phase6/phase6-staging-db-${timestamp}.json`
);
const liveAcknowledgement = "I_ACKNOWLEDGE_PHASE6_READ_ONLY_STAGING_PROMOTION";

const expectedPackageIds = [
  "phase6a",
  "phase6b",
  "phase6e",
  "phase6f",
  "phase6g",
  "phase6h1",
  "phase6h2",
  "phase6h3",
  "phase6h4",
];
const phase6Tables = [
  "programs",
  "course_levels",
  "course_templates",
  "student_profiles",
  "course_runs",
  "class_groups",
  "teacher_assignments",
  "enrollments",
  "class_memberships",
  "moodle_projection_observations",
  "moodle_enrollment_group_observations",
  "moodle_assessment_status_observations",
  "moodle_assignment_result_observations",
  "moodle_quiz_attempt_observations",
  "moodle_grade_outcome_observations",
  "moodle_activity_outcome_observations",
];
const phase6Functions = [
  "resolve_moodle_course_projection_authority",
  "list_moodle_course_mappings",
  "resolve_moodle_projection_context",
  "list_moodle_course_mappings_for_connection",
  "record_moodle_projection_observation",
  "list_authorized_moodle_projection_freshness",
  "resolve_moodle_projection_reconciliation",
  "resolve_moodle_user_projection_authority",
  "list_moodle_user_mappings_for_connection",
  "resolve_moodle_enrollment_group_context",
  "record_moodle_enrollment_group_observation",
  "list_authorized_moodle_enrollment_group_freshness",
  "resolve_moodle_assessment_status_context",
  "record_moodle_assessment_status_observation",
  "list_authorized_moodle_assessment_status_freshness",
  "purge_moodle_assessment_status_observations",
  "resolve_moodle_assignment_result_context",
  "record_moodle_assignment_result_observation",
  "list_authorized_moodle_assignment_result_freshness",
  "purge_moodle_assignment_result_observations",
  "resolve_moodle_quiz_attempt_context",
  "record_moodle_quiz_attempt_observation",
  "list_authorized_moodle_quiz_attempt_freshness",
  "purge_moodle_quiz_attempt_observations",
  "resolve_moodle_grade_outcome_context",
  "record_moodle_grade_outcome_observation",
  "list_authorized_moodle_grade_outcome_freshness",
  "purge_moodle_grade_outcome_observations",
  "resolve_moodle_activity_outcome_context",
  "record_moodle_activity_outcome_observation",
  "list_authorized_moodle_activity_outcome_freshness",
  "purge_moodle_activity_outcome_observations",
];
const requiredFoundationTables = [
  "branches",
  "app_users",
  "departments",
  "role_grants",
  "staff_profiles",
  "auth_sessions",
  "integration_connections",
  "external_records",
  "sync_runs",
  "sync_run_items",
  "reconciliation_cases",
];
const fixture = {
  authUserId: "10000000-0000-4000-8000-000000000001",
  appUserId: "40000000-0000-4000-8000-000000000001",
  roleGrantId: "50000000-0000-4000-8000-000000000001",
  teacherUserId: "40000000-0000-4000-8000-000000000002",
  teacherRoleGrantId: "50000000-0000-4000-8000-000000000002",
  classGroupId: "b6000000-0000-4000-8000-000000000001",
  assignmentProjectionId: "d1000000-0000-4000-8000-000000000001",
  quizProjectionId: "d1000000-0000-4000-8000-000000000002",
  gradeProjectionId: "d3000000-0000-4000-8000-000000000001",
  activityProjectionId: "d5000000-0000-4000-8000-000000000001",
  email: "student@nilelearn.local",
};

const secrets = new Set();
let contract;
let packages = [];
let psqlPath = "";
let databasePassword = "";
let publishableKey = "";
let secretKey = "";
let temporaryPassword = "";
let temporaryAuthUserId = "";
let authFixtureActivated = false;
let compatibilityApplied = false;
let appliedPackages = [];

const evidence = {
  schemaVersion: 1,
  kind: "nile-phase6-isolated-staging-promotion",
  mode,
  startedAt: new Date().toISOString(),
  completedAt: null,
  status: "running",
  target: null,
  contract: null,
  steps: [],
  cleanup: { status: "not-required", details: [] },
  runtime: {
    normalizedProjectionRepository: "disabled",
    providerCalls: 0,
    moodleWrites: 0,
  },
  error: null,
};

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function redact(value) {
  let output = String(value ?? "");
  for (const secret of secrets) {
    if (secret) output = output.replaceAll(secret, "[REDACTED]");
  }
  return output
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(/postgres(?:ql)?:\/\/[^\s@]+@/gi, "postgresql://[REDACTED]@")
    .slice(0, 4000);
}

function writeEvidence() {
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, {
    mode: 0o600,
  });
  chmodSync(outputPath, 0o600);
}

async function step(label, callback) {
  const startedAt = Date.now();
  process.stdout.write(`==> ${label}\n`);
  try {
    const result = await callback();
    evidence.steps.push({
      label,
      status: "passed",
      durationMs: Date.now() - startedAt,
    });
    writeEvidence();
    return result;
  } catch (error) {
    evidence.steps.push({
      label,
      status: "failed",
      durationMs: Date.now() - startedAt,
      error: redact(error instanceof Error ? error.message : error),
    });
    writeEvidence();
    throw error;
  }
}

function requireEnv(name, aliases = []) {
  const value = [name, ...aliases]
    .map(key => clean(process.env[key]))
    .find(Boolean);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function keychainSecret(service, account) {
  if (process.platform !== "darwin") return "";
  const result = spawnSync(
    "/usr/bin/security",
    ["find-generic-password", "-s", service, "-a", account, "-w"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
  );
  return result.status === 0 ? result.stdout.trim() : "";
}

function loadSecret(envNames, service, account) {
  const value =
    envNames.map(name => clean(process.env[name])).find(Boolean) ||
    keychainSecret(service, account);
  if (!value) {
    throw new Error(
      `Missing server-only credential. Configure ${envNames[0]} or Keychain service ${service}.`
    );
  }
  secrets.add(value);
  return value;
}

function verifyContract() {
  if (!existsSync(contractPath))
    throw new Error("Phase 6 staging contract is missing.");
  contract = JSON.parse(readFileSync(contractPath, "utf8"));
  assert.equal(contract.version, 1);
  assert.equal(contract.contractId, "integration-phase6-staging-promotion");
  assert.equal(contract.phase, "6I");
  assert.equal(contract.immutable, true);
  assert.deepEqual(
    contract.packages.map(item => item.id),
    expectedPackageIds,
    "Phase 6 package order changed."
  );
  assert.equal(contract.constraints.isolatedStagingOnly, true);
  assert.equal(contract.constraints.productionTargetingAllowed, false);
  assert.equal(contract.constraints.fakeIdentitiesOnly, true);
  assert.equal(contract.constraints.moodleProviderCallsAllowed, false);
  assert.equal(contract.constraints.moodleWritesAllowed, false);
  assert.equal(contract.constraints.runtimeDefaultsChanged, false);
  assert.equal(contract.constraints.normalizedRuntimeActivated, false);

  for (const kind of ["forward", "rollback"]) {
    const artifact = contract.compatibility?.[kind];
    assert.ok(artifact, `Compatibility ${kind} artifact is missing.`);
    const absolutePath = path.resolve(root, artifact.path);
    assert.ok(
      absolutePath.startsWith(
        `${path.join(root, "supabase/manual")}${path.sep}`
      ),
      `Compatibility artifact escaped the manual SQL directory: ${artifact.path}`
    );
    assert.ok(
      existsSync(absolutePath),
      `Artifact is missing: ${artifact.path}`
    );
    assert.equal(
      sha256(readFileSync(absolutePath)),
      artifact.sha256,
      `Artifact hash changed: ${artifact.path}`
    );
  }

  packages = contract.packages.map(item => {
    for (const kind of ["forward", "seed", "assertions", "rollback"]) {
      const artifact = item[kind];
      const absolutePath = path.resolve(root, artifact.path);
      assert.ok(
        absolutePath.startsWith(
          `${path.join(root, "supabase/manual")}${path.sep}`
        ),
        `Artifact escaped the manual SQL directory: ${artifact.path}`
      );
      assert.ok(
        existsSync(absolutePath),
        `Artifact is missing: ${artifact.path}`
      );
      assert.equal(
        sha256(readFileSync(absolutePath)),
        artifact.sha256,
        `Artifact hash changed: ${artifact.path}`
      );
    }
    return item;
  });
  evidence.contract = {
    id: contract.contractId,
    packageIds: expectedPackageIds,
    artifactCount: packages.length * 4 + 2,
    targetRefHashes: contract.targetRefHashes,
  };
}

function resolveTrustedPsql() {
  for (const candidate of [
    "/opt/homebrew/bin/psql",
    "/usr/local/bin/psql",
    "/usr/bin/psql",
  ]) {
    try {
      accessSync(candidate, fsConstants.X_OK);
      const resolved = realpathSync(candidate);
      if (
        resolved.startsWith("/opt/homebrew/") ||
        resolved.startsWith("/usr/")
      ) {
        return resolved;
      }
    } catch {
      // Try the next fixed system path.
    }
  }
  throw new Error("A trusted absolute psql binary was not found.");
}

function targetConfig() {
  const stagingRef = requireEnv("NILE_PHASE6_STAGING_PROJECT_REF", [
    "NILE_PHASE5_STAGING_PROJECT_REF",
  ]);
  const productionRef = requireEnv("NILE_PHASE6_PRODUCTION_PROJECT_REF", [
    "NILE_PHASE5_PRODUCTION_PROJECT_REF",
    "NILE_PRODUCTION_PROJECT_REF",
  ]);
  const url = new URL(
    requireEnv("NILE_PHASE6_STAGING_SUPABASE_URL", [
      "NILE_PHASE5_STAGING_SUPABASE_URL",
    ])
  );
  const databaseHost = requireEnv("NILE_PHASE6_STAGING_DB_HOST", [
    "NILE_PHASE5_STAGING_DB_HOST",
  ]).toLowerCase();
  const databasePort =
    clean(process.env.NILE_PHASE6_STAGING_DB_PORT) ||
    clean(process.env.NILE_PHASE5_STAGING_DB_PORT) ||
    "5432";
  const databaseUser =
    clean(process.env.NILE_PHASE6_STAGING_DB_USER) ||
    clean(process.env.NILE_PHASE5_STAGING_DB_USER) ||
    `postgres.${stagingRef}`;

  assert.match(stagingRef, /^[a-z0-9]{20}$/);
  assert.match(productionRef, /^[a-z0-9]{20}$/);
  assert.notEqual(
    stagingRef,
    productionRef,
    "Staging and production refs match."
  );
  assert.equal(sha256(stagingRef), contract.targetRefHashes.staging);
  assert.equal(sha256(productionRef), contract.targetRefHashes.production);
  assert.equal(url.protocol, "https:");
  assert.equal(url.hostname, `${stagingRef}.supabase.co`);
  assert.match(databaseHost, /^[a-z0-9.-]+\.pooler\.supabase\.com$/);
  assert.ok(!databaseHost.includes(productionRef));
  assert.equal(databasePort, "5432");
  assert.equal(databaseUser, `postgres.${stagingRef}`);
  assert.equal(
    clean(process.env.NILE_MOODLE_PROJECTION_REPOSITORY) || "disabled",
    "disabled",
    "Normalized projection runtime must remain disabled during promotion."
  );
  assert.notEqual(
    clean(process.env.MOODLE_READ_ONLY_ENABLED),
    "1",
    "The staging database proof must not contact Moodle."
  );
  if (mode === "live") {
    assert.equal(process.env.NILE_PHASE6_ALLOW_REMOTE, "1");
    assert.equal(
      process.env.NILE_PHASE6_STAGING_ACK,
      liveAcknowledgement,
      `Live proof requires NILE_PHASE6_STAGING_ACK=${liveAcknowledgement}.`
    );
  }

  evidence.target = {
    stagingRefHash: `sha256:${sha256(stagingRef)}`,
    productionRefHash: `sha256:${sha256(productionRef)}`,
    apiHostHash: `sha256:${sha256(url.hostname).slice(0, 16)}`,
    databaseHostHash: `sha256:${sha256(databaseHost).slice(0, 16)}`,
    port: Number(databasePort),
    database: "postgres",
  };
  return {
    stagingRef,
    productionRef,
    url: url.toString().replace(/\/$/, ""),
    databaseHost,
    databasePort,
    databaseUser,
  };
}

function artifactFile(item, kind) {
  return path.resolve(root, item[kind].path);
}

function compatibilityFile(kind) {
  return path.resolve(root, contract.compatibility[kind].path);
}

function psql(config, { sql, file, tuples = false } = {}) {
  assert.ok(databasePassword, "Database password was not loaded.");
  const args = [
    "-X",
    "--no-psqlrc",
    "--no-password",
    "--host",
    config.databaseHost,
    "--port",
    config.databasePort,
    "--username",
    config.databaseUser,
    "--dbname",
    "postgres",
    "--set",
    "ON_ERROR_STOP=1",
    "--quiet",
  ];
  if (tuples) args.push("--tuples-only", "--no-align");
  const result = spawnSync(psqlPath, args, {
    cwd: root,
    input: file ? readFileSync(file) : Buffer.from(sql ?? "", "utf8"),
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    env: {
      PGPASSWORD: databasePassword,
      PGSSLMODE: "require",
      PGAPPNAME: "nile-phase6-staging-verifier",
      PSQL_HISTORY: "/dev/null",
      LANG: "C",
      LC_ALL: "C",
    },
  });
  if (result.status !== 0) {
    throw new Error(
      `psql failed (${result.status ?? "signal"}): ${redact(result.stderr || result.stdout)}`
    );
  }
  return result.stdout.trim();
}

function sqlList(values) {
  return values.map(value => `'${value.replaceAll("'", "''")}'`).join(",");
}

function parseJson(value, label) {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`${label} returned invalid JSON.`);
  }
}

function inspectTarget(config) {
  const output = psql(config, {
    tuples: true,
    sql: `
select pg_catalog.json_build_object(
  'foundationTables', (
    select pg_catalog.count(*) from pg_catalog.pg_tables
    where schemaname = 'public' and tablename in (${sqlList(requiredFoundationTables)})
  ),
  'phase6Tables', (
    select pg_catalog.count(*) from pg_catalog.pg_tables
    where schemaname = 'public' and tablename in (${sqlList(phase6Tables)})
  ),
  'phase6Functions', (
    select pg_catalog.count(*) from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (${sqlList(phase6Functions)})
  ),
  'compatibilityFunctions', (
    select pg_catalog.count(*) from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'digest'
      and pg_catalog.obj_description(p.oid, 'pg_proc') =
        'nile-phase6i-pgcrypto-compatibility'
  ),
  'appUsers', (select pg_catalog.count(*) from public.app_users),
  'authUsers', (select pg_catalog.count(*) from auth.users),
  'unexpectedAppUsers', (
    select pg_catalog.count(*) from public.app_users
    where email::text not like '%@nilelearn.local'
  )
)::text;
`,
  });
  return parseJson(output, "Target inspection");
}

function assertSafeTarget(inspection) {
  assert.equal(
    Number(inspection.foundationTables),
    requiredFoundationTables.length,
    "The accepted Phase 5 foundation is incomplete."
  );
  assert.equal(
    Number(inspection.appUsers),
    6,
    "Unexpected application user count."
  );
  assert.equal(Number(inspection.authUsers), 6, "Unexpected Auth user count.");
  assert.equal(
    Number(inspection.unexpectedAppUsers),
    0,
    "Non-fixture users exist."
  );
  const tableCount = Number(inspection.phase6Tables);
  const functionCount = Number(inspection.phase6Functions);
  const compatibilityCount = Number(inspection.compatibilityFunctions);
  if (tableCount === 0 && functionCount === 0 && compatibilityCount === 0) {
    return "foundation-only";
  }
  if (
    tableCount === phase6Tables.length &&
    functionCount === phase6Functions.length &&
    compatibilityCount === 2
  ) {
    return "complete-phase6-fixture";
  }
  throw new Error(
    "The target contains a partial Phase 6 schema; refusing mutation."
  );
}

function applyCompatibility(config) {
  psql(config, { file: compatibilityFile("forward") });
  compatibilityApplied = true;
}

function applyPackages(config) {
  for (const item of packages) {
    psql(config, { file: artifactFile(item, "forward") });
    appliedPackages.push(item.id);
  }
}

function seedPackages(config) {
  for (const item of packages) {
    psql(config, { file: artifactFile(item, "seed") });
  }
}

function assertPackages(config) {
  for (const item of packages) {
    psql(config, { file: artifactFile(item, "assertions") });
  }
}

function nativePayloadContract(config) {
  const gradePayload =
    '{"internalCourseId":"b3000000-0000-4000-8000-000000000001","internalClassGroupId":"b6000000-0000-4000-8000-000000000001","gradeItemProjectionId":"d3000000-0000-4000-8000-000000000001","providerState":"available","mappingStatus":"exact","learners":[{"internalUserId":"40000000-0000-4000-8000-000000000001","internalEnrollmentId":"b8000000-0000-4000-8000-000000000001","internalMembershipId":"b9000000-0000-4000-8000-000000000001","gradingState":"released","score":87.5,"maximumScore":100,"gradedAt":"2026-07-17T10:45:00Z","releasedAt":"2026-07-17T11:00:00Z","feedback":"Clear and accurate work."}]}';
  const aggregateGradePayload =
    '{"internalCourseId":"b3000000-0000-4000-8000-000000000001","internalClassGroupId":"b6000000-0000-4000-8000-000000000001","gradeItemProjectionId":"d3000000-0000-4000-8000-000000000001","providerState":"available","mappingStatus":"exact","learnerCount":1,"gradedCount":1,"releasedCount":1,"feedbackReleasedCount":1}';
  const output = psql(config, {
    tuples: true,
    sql: `
with fixture as (
  select '${gradePayload}'::jsonb as payload,
    '${aggregateGradePayload}'::jsonb as aggregate_payload,
    '2026-07-17T12:00:00Z'::timestamptz as observed_at,
    '2026-07-17T12:15:00Z'::timestamptz as fresh_until,
    '2026-07-24T12:00:00Z'::timestamptz as retain_until
)
select pg_catalog.json_build_object(
  'gradePayloadSafe', nile_private.moodle_grade_outcome_payload_is_safe(
    payload, 'learner'
  ),
  'gradePersonPayloadSafe', nile_private.moodle_grade_outcome_payload_is_safe(
    payload, 'person_level'
  ),
  'gradeAggregatePayloadSafe', nile_private.moodle_grade_outcome_payload_is_safe(
    aggregate_payload, 'aggregate'
  ),
  'gradeUnexpectedKeyRejected', not nile_private.moodle_grade_outcome_payload_is_safe(
    aggregate_payload || '{"unexpected":true}'::jsonb, 'aggregate'
  ),
  'digestWrapperMatchesExtension', public.digest(
    pg_catalog.convert_to(payload::text, 'UTF8'), 'sha256'
  ) = extensions.digest(
    pg_catalog.convert_to(payload::text, 'UTF8'), 'sha256'
  ),
  'freshnessExact', fresh_until = observed_at + interval '15 minutes',
  'retentionOrdered', retain_until > fresh_until,
  'retentionBounded', retain_until <= observed_at + interval '30 days',
  'courseIdExact', (payload->>'internalCourseId')::uuid =
    'b3000000-0000-4000-8000-000000000001'::uuid,
  'classIdExact', (payload->>'internalClassGroupId')::uuid =
    'b6000000-0000-4000-8000-000000000001'::uuid,
  'projectionIdExact', (payload->>'gradeItemProjectionId')::uuid =
    'd3000000-0000-4000-8000-000000000001'::uuid,
  'providerStateExact', payload->>'providerState' = 'available'
)::text
from fixture;
`,
  });
  const result = parseJson(output, "Native payload contract");
  for (const [name, passed] of Object.entries(result)) {
    assert.equal(passed, true, `Native payload contract failed: ${name}`);
  }
  return result;
}

function rollbackPackages(config) {
  const rollbackIds = [...appliedPackages].reverse();
  for (const id of rollbackIds) {
    const item = packages.find(candidate => candidate.id === id);
    psql(config, { file: artifactFile(item, "rollback") });
  }
  appliedPackages = [];
}

function rollbackCompatibility(config) {
  if (!compatibilityApplied) return;
  psql(config, { file: compatibilityFile("rollback") });
  compatibilityApplied = false;
}

function assertPhase6Absent(config) {
  const inspection = inspectTarget(config);
  assert.equal(
    Number(inspection.phase6Tables),
    0,
    "Phase 6 tables survived rollback."
  );
  assert.equal(
    Number(inspection.phase6Functions),
    0,
    "Phase 6 functions survived rollback."
  );
  assert.equal(
    Number(inspection.compatibilityFunctions),
    0,
    "Phase 6 compatibility functions survived rollback."
  );
}

function postgresContract(config) {
  const output = psql(config, {
    tuples: true,
    sql: `
select pg_catalog.json_build_object(
  'tables', (
    select pg_catalog.count(*) from pg_catalog.pg_tables
    where schemaname = 'public' and tablename in (${sqlList(phase6Tables)})
  ),
  'functions', (
    select pg_catalog.count(*) from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (${sqlList(phase6Functions)})
  ),
  'rlsMissing', (
    select pg_catalog.count(*) from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname in (${sqlList(phase6Tables)})
      and (not c.relrowsecurity or not c.relforcerowsecurity)
  ),
  'policies', (
    select pg_catalog.count(*) from pg_catalog.pg_policies
    where schemaname = 'public' and tablename in (${sqlList(phase6Tables)})
  ),
  'browserTableGrants', (
    select pg_catalog.count(*) from information_schema.table_privileges
    where table_schema = 'public' and table_name in (${sqlList(phase6Tables)})
      and grantee in ('PUBLIC', 'anon', 'authenticated')
  ),
  'browserRoutineGrants', (
    select pg_catalog.count(*) from information_schema.routine_privileges
    where routine_schema = 'public' and routine_name in (${sqlList(phase6Functions)})
      and grantee in ('PUBLIC', 'anon', 'authenticated')
  ),
  'serviceAuthorityTableReads', (
    select pg_catalog.count(*) from information_schema.table_privileges
    where table_schema = 'public' and table_name in (
      'programs','course_levels','course_templates','student_profiles',
      'course_runs','class_groups','teacher_assignments','enrollments','class_memberships'
    ) and grantee = 'service_role' and privilege_type = 'SELECT'
  ),
  'serviceRoutineGrants', (
    select pg_catalog.count(*) from information_schema.routine_privileges
    where routine_schema = 'public' and routine_name in (${sqlList(phase6Functions)})
      and grantee = 'service_role' and privilege_type = 'EXECUTE'
  ),
  'compatibilityFunctions', (
    select pg_catalog.count(*) from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'digest'
      and pg_catalog.obj_description(p.oid, 'pg_proc') =
        'nile-phase6i-pgcrypto-compatibility'
  ),
  'browserCompatibilityGrants', (
    select pg_catalog.count(*) from information_schema.routine_privileges
    where routine_schema = 'public' and routine_name = 'digest'
      and grantee in ('PUBLIC', 'anon', 'authenticated')
  ),
  'serviceCompatibilityGrants', (
    select pg_catalog.count(*) from information_schema.routine_privileges
    where routine_schema = 'public' and routine_name = 'digest'
      and grantee = 'service_role' and privilege_type = 'EXECUTE'
  )
)::text;

begin;
set local role anon;
do $$ begin
  begin perform * from public.programs limit 1;
    raise exception 'anon read Phase 6 authority';
  exception when insufficient_privilege then null; end;
  begin perform * from public.resolve_moodle_projection_context(
    '${fixture.appUserId}', '${fixture.roleGrantId}'
  );
    raise exception 'anon executed Phase 6 projection RPC';
  exception when insufficient_privilege then null; end;
end $$;
rollback;

begin;
set local role authenticated;
do $$ begin
  begin perform * from public.programs limit 1;
    raise exception 'authenticated read Phase 6 authority';
  exception when insufficient_privilege then null; end;
  begin perform * from public.resolve_moodle_projection_context(
    '${fixture.appUserId}', '${fixture.roleGrantId}'
  );
    raise exception 'authenticated executed Phase 6 projection RPC';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
`,
  });
  const firstJsonLine = output
    .split("\n")
    .find(line => line.trim().startsWith("{"));
  const result = parseJson(firstJsonLine, "PostgreSQL contract");
  assert.equal(Number(result.tables), phase6Tables.length);
  assert.equal(Number(result.functions), phase6Functions.length);
  assert.equal(Number(result.rlsMissing), 0);
  assert.equal(Number(result.policies), 0);
  assert.equal(Number(result.browserTableGrants), 0);
  assert.equal(Number(result.browserRoutineGrants), 0);
  assert.equal(Number(result.serviceAuthorityTableReads), 9);
  assert.equal(Number(result.serviceRoutineGrants), phase6Functions.length);
  assert.equal(Number(result.compatibilityFunctions), 2);
  assert.equal(Number(result.browserCompatibilityGrants), 0);
  assert.equal(Number(result.serviceCompatibilityGrants), 2);
  return result;
}

function notifyPostgrest(config) {
  psql(config, { sql: "notify pgrst, 'reload schema';" });
}

async function responseJson(response, label) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${label} returned invalid JSON (${response.status}).`);
  }
}

function apiHeaders(key, accessToken = "") {
  const headers = new Headers({
    apikey: key,
    "Content-Type": "application/json",
  });
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  return headers;
}

async function serviceRequest(config, pathname, init = {}) {
  const headers = apiHeaders(secretKey, secretKey);
  for (const [key, value] of Object.entries(init.headers ?? {})) {
    headers.set(key, value);
  }
  return fetch(`${config.url}/${pathname.replace(/^\/+/, "")}`, {
    ...init,
    headers,
  });
}

async function waitForPostgrest(config) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await serviceRequest(
      config,
      "rest/v1/programs?select=id&limit=1"
    );
    if (response.ok) return responseJson(response, "PostgREST readiness");
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error("PostgREST did not expose the promoted Phase 6 schema.");
}

async function serviceRpc(config, name, body, expectedRole) {
  const response = await serviceRequest(config, `rest/v1/rpc/${name}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  const payload = await responseJson(response, `service RPC ${name}`);
  assert.equal(
    response.status,
    200,
    `service RPC ${name} failed: ${redact(JSON.stringify(payload))}`
  );
  assert.ok(Array.isArray(payload) && payload.length === 1);
  assert.equal(payload[0].active_role, expectedRole);
}

async function authAdmin(config, pathname, init = {}) {
  const response = await serviceRequest(
    config,
    `auth/v1/admin/${pathname}`,
    init
  );
  if (!response.ok) {
    const payload = await responseJson(response, "Auth Admin request");
    throw new Error(
      `Auth Admin request failed (${response.status}): ${redact(JSON.stringify(payload))}`
    );
  }
  return response;
}

async function activateAuthFixture(config) {
  temporaryPassword = crypto.randomBytes(24).toString("base64url");
  secrets.add(temporaryPassword);
  const activation = await authAdmin(config, "users", {
    method: "POST",
    body: JSON.stringify({
      email: fixture.email,
      password: temporaryPassword,
      email_confirm: true,
      ban_duration: "none",
      app_metadata: {
        role: "student",
        roles: ["student"],
        fixture: "nile-phase6-staging-proof",
      },
      user_metadata: { name: "Phase 6 Staging Student" },
    }),
  });
  const activatedUser = await responseJson(
    activation,
    "Auth Admin temporary fixture creation"
  );
  temporaryAuthUserId = clean(activatedUser?.id || activatedUser?.user?.id);
  assert.match(
    temporaryAuthUserId,
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    "Auth Admin did not return a valid temporary identity."
  );
  authFixtureActivated = true;
  const response = await fetch(
    `${config.url}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: apiHeaders(publishableKey, publishableKey),
      body: JSON.stringify({
        email: fixture.email,
        password: temporaryPassword,
      }),
    }
  );
  const payload = await responseJson(response, "Staging fixture login");
  assert.equal(response.status, 200, "Staging fixture login failed.");
  assert.ok(clean(payload?.access_token));
  secrets.add(payload.access_token);
  return payload.access_token;
}

async function invalidateAuthFixture(config) {
  if (!authFixtureActivated) return;
  await authAdmin(config, `users/${temporaryAuthUserId}`, {
    method: "DELETE",
    body: JSON.stringify({ should_soft_delete: false }),
  });
  authFixtureActivated = false;
  temporaryAuthUserId = "";
}

async function expectBrowserDenial(config, label, pathname, accessToken = "") {
  const response = await fetch(`${config.url}/rest/v1/${pathname}`, {
    method: pathname.startsWith("rpc/") ? "POST" : "GET",
    headers: apiHeaders(publishableKey, accessToken),
    body: pathname.startsWith("rpc/")
      ? JSON.stringify({
          p_user_id: fixture.appUserId,
          p_active_role_grant_id: fixture.roleGrantId,
        })
      : undefined,
  });
  const payload = await responseJson(response, label);
  assert.ok(
    [401, 403, 404].includes(response.status),
    `${label} was not denied (${response.status}).`
  );
  assert.ok(
    ["42501", "PGRST202"].includes(clean(payload?.code)),
    `${label} did not fail at the PostgREST/PostgreSQL boundary.`
  );
}

async function postgrestContract(config) {
  notifyPostgrest(config);
  const programs = await waitForPostgrest(config);
  assert.ok(Array.isArray(programs) && programs.length === 1);

  const serviceCalls = [
    [
      "resolve_moodle_course_projection_authority",
      {
        p_user_id: fixture.appUserId,
        p_active_role_grant_id: fixture.roleGrantId,
      },
      "student",
    ],
    [
      "resolve_moodle_projection_context",
      {
        p_user_id: fixture.appUserId,
        p_active_role_grant_id: fixture.roleGrantId,
      },
      "student",
    ],
    [
      "resolve_moodle_user_projection_authority",
      {
        p_user_id: fixture.appUserId,
        p_active_role_grant_id: fixture.roleGrantId,
      },
      "student",
    ],
    [
      "resolve_moodle_enrollment_group_context",
      {
        p_user_id: fixture.teacherUserId,
        p_active_role_grant_id: fixture.teacherRoleGrantId,
        p_internal_class_group_id: fixture.classGroupId,
      },
      "teacher",
    ],
    [
      "resolve_moodle_assessment_status_context",
      {
        p_user_id: fixture.appUserId,
        p_active_role_grant_id: fixture.roleGrantId,
        p_internal_class_group_id: fixture.classGroupId,
      },
      "student",
    ],
    [
      "resolve_moodle_assignment_result_context",
      {
        p_user_id: fixture.appUserId,
        p_active_role_grant_id: fixture.roleGrantId,
        p_internal_class_group_id: fixture.classGroupId,
        p_assignment_projection_id: fixture.assignmentProjectionId,
      },
      "student",
    ],
    [
      "resolve_moodle_quiz_attempt_context",
      {
        p_user_id: fixture.appUserId,
        p_active_role_grant_id: fixture.roleGrantId,
        p_internal_class_group_id: fixture.classGroupId,
        p_quiz_projection_id: fixture.quizProjectionId,
      },
      "student",
    ],
    [
      "resolve_moodle_grade_outcome_context",
      {
        p_user_id: fixture.appUserId,
        p_active_role_grant_id: fixture.roleGrantId,
        p_internal_class_group_id: fixture.classGroupId,
        p_grade_item_projection_id: fixture.gradeProjectionId,
      },
      "student",
    ],
    [
      "resolve_moodle_activity_outcome_context",
      {
        p_user_id: fixture.appUserId,
        p_active_role_grant_id: fixture.roleGrantId,
        p_internal_class_group_id: fixture.classGroupId,
        p_activity_projection_id: fixture.activityProjectionId,
      },
      "student",
    ],
  ];
  for (const [name, body, role] of serviceCalls) {
    await serviceRpc(config, name, body, role);
  }

  const accessToken = await activateAuthFixture(config);
  try {
    await expectBrowserDenial(
      config,
      "anonymous Phase 6 table read",
      "programs?select=id&limit=1"
    );
    await expectBrowserDenial(
      config,
      "authenticated Phase 6 table read",
      "programs?select=id&limit=1",
      accessToken
    );
    await expectBrowserDenial(
      config,
      "anonymous Phase 6 RPC",
      "rpc/resolve_moodle_projection_context"
    );
    await expectBrowserDenial(
      config,
      "authenticated Phase 6 RPC",
      "rpc/resolve_moodle_projection_context",
      accessToken
    );
  } finally {
    await invalidateAuthFixture(config);
  }
  return {
    serviceRpcChecks: serviceCalls.length,
    browserDenialChecks: 4,
    schemaReload: "observed",
  };
}

async function main() {
  await step(
    "verify immutable Phase 6 staging contract and artifact hashes",
    () => verifyContract()
  );
  await step("verify trusted local commands", () => {
    psqlPath = resolveTrustedPsql();
    assert.equal(typeof fetch, "function");
  });

  if (mode === "static-preflight") {
    evidence.status = "passed";
    evidence.completedAt = new Date().toISOString();
    writeEvidence();
    process.stdout.write(
      `Phase 6 staging static preflight passed. Evidence: ${path.relative(root, outputPath)}\n`
    );
    return;
  }

  const config = await step("validate isolated staging target guards", () =>
    targetConfig()
  );
  if (mode === "dry-run") {
    evidence.status = "passed";
    evidence.completedAt = new Date().toISOString();
    writeEvidence();
    process.stdout.write(
      `Phase 6 staging dry run passed without network contact. Evidence: ${path.relative(root, outputPath)}\n`
    );
    return;
  }

  databasePassword = await step(
    "load staging database credential from server-only storage",
    () =>
      loadSecret(
        ["NILE_PHASE6_STAGING_DB_PASSWORD", "NILE_PHASE5_STAGING_DB_PASSWORD"],
        "nile-learn-phase5-staging-db",
        "nile-learn-phase5-staging"
      )
  );
  publishableKey = await step("load staging publishable credential", () =>
    loadSecret(
      [
        "NILE_PHASE6_STAGING_PUBLISHABLE_KEY",
        "NILE_PHASE5_STAGING_PUBLISHABLE_KEY",
      ],
      "nile-learn-phase5-staging-publishable",
      config.stagingRef
    )
  );
  secretKey = await step("load staging server credential", () =>
    loadSecret(
      ["NILE_PHASE6_STAGING_SECRET_KEY", "NILE_PHASE5_STAGING_SECRET_KEY"],
      "nile-learn-phase5-staging-service-role",
      config.stagingRef
    )
  );
  assert.notEqual(publishableKey, secretKey);

  const inspection = await step(
    "inspect staging foundation and Phase 6 state",
    () => inspectTarget(config)
  );
  const initialState = await step("prove fake-only isolated target", () =>
    assertSafeTarget(inspection)
  );
  evidence.initialState = initialState;

  if (initialState === "complete-phase6-fixture") {
    appliedPackages = expectedPackageIds.slice();
    compatibilityApplied = true;
    await step(
      "verify existing complete Phase 6 fixture before normalization",
      () => assertPackages(config)
    );
    await step("normalize existing complete Phase 6 fixture", () =>
      rollbackPackages(config)
    );
    await step("remove existing Phase 6 compatibility wrappers", () =>
      rollbackCompatibility(config)
    );
    await step(
      "verify normalized target retains only the Phase 5 foundation",
      () => assertPhase6Absent(config)
    );
  }

  await step("apply Phase 6 pgcrypto schema compatibility", () =>
    applyCompatibility(config)
  );
  await step("apply all reviewed Phase 6 SQL packages", () =>
    applyPackages(config)
  );
  const firstNativePayload = await step(
    "prove native PostgreSQL payload and pgcrypto compatibility",
    () => nativePayloadContract(config)
  );
  await step("apply deterministic fake Phase 6 fixtures", () =>
    seedPackages(config)
  );
  await step("run first semantic assertion pass", () => assertPackages(config));
  const firstPostgres = await step(
    "prove first PostgreSQL and forced-RLS contract",
    () => postgresContract(config)
  );
  const firstPostgrest = await step(
    "prove first PostgREST service and browser-role contract",
    () => postgrestContract(config)
  );

  await step("rollback Phase 6 packages in reverse dependency order", () =>
    rollbackPackages(config)
  );
  await step("rollback Phase 6 pgcrypto schema compatibility", () =>
    rollbackCompatibility(config)
  );
  await step("prove Phase 6 rollback retained the accepted foundation", () =>
    assertPhase6Absent(config)
  );

  await step("reapply Phase 6 pgcrypto schema compatibility", () =>
    applyCompatibility(config)
  );
  await step("reapply all reviewed Phase 6 SQL packages", () =>
    applyPackages(config)
  );
  const secondNativePayload = await step(
    "reprove native PostgreSQL payload and pgcrypto compatibility",
    () => nativePayloadContract(config)
  );
  await step("reapply deterministic fake Phase 6 fixtures", () =>
    seedPackages(config)
  );
  await step("run second semantic assertion pass", () =>
    assertPackages(config)
  );
  const secondPostgres = await step(
    "prove reapplied PostgreSQL and forced-RLS contract",
    () => postgresContract(config)
  );
  const secondPostgrest = await step(
    "prove reapplied PostgREST service and browser-role contract",
    () => postgrestContract(config)
  );

  evidence.acceptance = {
    applyPasses: 2,
    seedPasses: 2,
    assertionPasses: 2,
    rollbackPasses: 1,
    postgres: [firstPostgres, secondPostgres],
    postgrest: [firstPostgrest, secondPostgrest],
    nativePayload: [firstNativePayload, secondNativePayload],
    finalState: "phase6-read-only-staging-promoted",
    productionTouched: false,
    providerCalls: 0,
    moodleWrites: 0,
    runtimeActivated: false,
  };
  evidence.status = "passed";
  evidence.completedAt = new Date().toISOString();
  databasePassword = "";
  publishableKey = "";
  secretKey = "";
  temporaryPassword = "";
  temporaryAuthUserId = "";
  writeEvidence();
  process.stdout.write(
    `Phase 6 isolated staging promotion passed. Evidence: ${path.relative(root, outputPath)}\n`
  );
}

main().catch(async error => {
  const cleanupErrors = [];
  let config = null;
  try {
    if (contract && mode === "live") config = targetConfig();
  } catch (targetError) {
    cleanupErrors.push(
      redact(targetError instanceof Error ? targetError.message : targetError)
    );
  }
  if (config && secretKey && authFixtureActivated) {
    try {
      await invalidateAuthFixture(config);
    } catch (cleanupError) {
      cleanupErrors.push(
        redact(
          cleanupError instanceof Error ? cleanupError.message : cleanupError
        )
      );
    }
  }
  if (config && databasePassword && appliedPackages.length > 0) {
    try {
      rollbackPackages(config);
    } catch (cleanupError) {
      cleanupErrors.push(
        redact(
          cleanupError instanceof Error ? cleanupError.message : cleanupError
        )
      );
    }
  }
  if (config && databasePassword && compatibilityApplied) {
    try {
      rollbackCompatibility(config);
    } catch (cleanupError) {
      cleanupErrors.push(
        redact(
          cleanupError instanceof Error ? cleanupError.message : cleanupError
        )
      );
    }
  }
  evidence.status = "failed";
  evidence.completedAt = new Date().toISOString();
  evidence.error = redact(error instanceof Error ? error.message : error);
  evidence.cleanup = {
    status: cleanupErrors.length === 0 ? "passed" : "failed",
    details: cleanupErrors,
  };
  databasePassword = "";
  publishableKey = "";
  secretKey = "";
  temporaryPassword = "";
  temporaryAuthUserId = "";
  writeEvidence();
  process.stderr.write(`Phase 6 staging promotion failed: ${evidence.error}\n`);
  process.stderr.write(`Evidence: ${path.relative(root, outputPath)}\n`);
  if (cleanupErrors.length > 0) {
    process.stderr.write(`Cleanup issues: ${cleanupErrors.join(" | ")}\n`);
  }
  process.exitCode = 1;
});
