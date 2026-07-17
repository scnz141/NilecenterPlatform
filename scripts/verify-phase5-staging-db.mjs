#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  accessSync,
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
const args = new Set(process.argv.slice(2));
const unknownArgs = [...args].filter(
  argument =>
    !["--static-preflight", "--dry-run", "--lint"].includes(argument) &&
    !argument.startsWith("--output=")
);
if (unknownArgs.length > 0) {
  throw new Error(`Unknown argument(s): ${unknownArgs.join(", ")}`);
}
const staticPreflight = args.has("--static-preflight");
const dryRun = args.has("--dry-run");
if (staticPreflight && dryRun) {
  throw new Error("Choose either --static-preflight or --dry-run, not both.");
}
const liveRun = !staticPreflight && !dryRun;
const runLint = args.has("--lint");

const outputArg = process.argv.find(argument =>
  argument.startsWith("--output=")
);
const timestamp = new Date().toISOString().replaceAll(":", "-");
const outputPath = path.resolve(
  root,
  outputArg?.slice("--output=".length) ??
    `output/phase5/phase5-staging-db-${timestamp}.json`
);

const assertionAuthUserId = "10000000-0000-4000-8000-000000000007";
const expectedStagingRefHash =
  "aa412ac2a6b666be6ad96683495e92778e2c70aae68891799d1f5754a050140c";
const expectedProductionRefHash =
  "7728e57c3295ac6c1d964e067911e56d922fb6ed5319d1a9b3f00a13572db70f";
const fixtureAuthUserIds = Array.from(
  { length: 7 },
  (_, index) => `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`
);
const fixtureAppUserIds = Array.from(
  { length: 6 },
  (_, index) => `40000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`
);

const phase1Tables = [
  "branches",
  "app_users",
  "departments",
  "department_branches",
  "permissions",
  "role_permissions",
  "role_grants",
  "role_grant_branch_scopes",
  "role_grant_department_scopes",
  "staff_profiles",
  "staff_subjects",
  "auth_sessions",
  "command_executions",
  "audit_logs",
  "outbox_events",
  "integration_connections",
  "integration_env_requirements",
  "external_records",
  "sync_cursors",
  "sync_runs",
  "sync_run_items",
  "reconciliation_cases",
  "migration_runs",
  "migration_run_items",
  "migration_evidence",
];

const artifacts = [
  {
    name: "phase1Migration",
    file: "supabase/migrations/20260710053837_phase1_identity_scope_session_audit_mapping.sql",
    sha256: "fc08d23a1b12534e572ebeb50e9d32874e84b8d8e89c06c24abe4aff376a49d9",
  },
  {
    name: "phase2Migration",
    file: "supabase/migrations/20260710132000_phase2b_atomic_session_lifecycle.sql",
    sha256: "4e1d37eee9c2898fad15491781812b65c3e4aad937263cd62ec740b4cd612325",
  },
  {
    name: "assertions",
    file: "docs/supabase-phase-1-identity-session-rls-assertions.sql",
    sha256: "6a57832c0568514b1f2c91ba07a208a9328728bb61e9ab1f36dc2e0033c8aa3b",
  },
  {
    name: "fakeSeed",
    file: "supabase/seed.sql",
    sha256: "e9a483ee34a5074c7da4eeecc9371c8c3666ae5d29aa8e0ca8cd56b1850608f2",
  },
  {
    name: "phase2Rollback",
    file: "supabase/manual/901_phase2b_rollback.sql",
    sha256: "ff703a00a7b91ef5c16a0a78ff8e6f40b95f234673fa19a8885e1c3c27fd72f7",
  },
  {
    name: "phase1Rollback",
    file: "supabase/manual/902_phase1_rollback.sql",
    sha256: "0bea9bd8e81f34fee8f3f253cb6520260dc0940a50fb2d5375432e7c676fa6e9",
  },
];

const evidence = {
  schemaVersion: 1,
  kind: "nile-phase5-isolated-staging-database-verification",
  mode: staticPreflight ? "static-preflight" : dryRun ? "dry-run" : "live",
  startedAt: new Date().toISOString(),
  completedAt: null,
  status: "running",
  target: null,
  artifacts: [],
  steps: [],
  lintRequested: runLint,
  secretSource: null,
  error: null,
};

let databasePassword = "";
let psqlPath = "";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function redactIdentifier(value) {
  return value ? `sha256:${sha256(value).slice(0, 16)}` : null;
}

function sanitize(value) {
  let output = String(value ?? "");
  for (const secret of [
    databasePassword,
    process.env.NILE_PHASE5_STAGING_DB_PASSWORD,
  ]) {
    if (secret) output = output.replaceAll(secret, "[REDACTED]");
  }
  return output
    .replace(/postgres(?:ql)?:\/\/[^\s@]+@/gi, "postgresql://[REDACTED]@")
    .slice(0, 4000);
}

function writeEvidence() {
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, {
    mode: 0o600,
  });
}

function fail(message) {
  throw new Error(message);
}

function recordStep(label, callback) {
  const startedAt = Date.now();
  process.stdout.write(`==> ${label}\n`);
  try {
    const result = callback();
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
      error: sanitize(error instanceof Error ? error.message : error),
    });
    throw error;
  }
}

function resolveTrustedPsql() {
  const candidates = [
    "/opt/homebrew/bin/psql",
    "/usr/local/bin/psql",
    "/usr/bin/psql",
  ];
  for (const candidate of candidates) {
    try {
      accessSync(candidate, fsConstants.X_OK);
      const resolved = realpathSync(candidate);
      if (
        !resolved.startsWith("/opt/homebrew/") &&
        !resolved.startsWith("/usr/")
      ) {
        continue;
      }
      return resolved;
    } catch {
      // Try the next fixed system location.
    }
  }
  fail("A trusted absolute psql binary was not found.");
}

function artifact(name) {
  const item = artifacts.find(candidate => candidate.name === name);
  if (!item) fail(`Unknown reviewed artifact: ${name}`);
  return path.join(root, item.file);
}

function verifyArtifacts() {
  evidence.artifacts = artifacts.map(item => {
    const absolutePath = path.join(root, item.file);
    if (!existsSync(absolutePath))
      fail(`Reviewed artifact is missing: ${item.file}`);
    const actual = sha256(readFileSync(absolutePath));
    if (actual !== item.sha256) {
      fail(`Reviewed artifact hash changed; refusing remote use: ${item.file}`);
    }
    return { file: item.file, sha256: actual, verified: true };
  });

  const seed = readFileSync(artifact("fakeSeed"));
  const manualSeed = readFileSync(
    path.join(root, "supabase/manual/100_fake_seed.sql")
  );
  if (!seed.equals(manualSeed))
    fail("Promoted seed differs from the reviewed manual fake seed.");
}

function requireValue(name, aliases = []) {
  const value = [name, ...aliases]
    .map(key => process.env[key]?.trim())
    .find(Boolean);
  if (!value) fail(`Missing required environment variable: ${name}`);
  return value;
}

function loadTargetConfig() {
  const stagingRef = requireValue("NILE_PHASE5_STAGING_PROJECT_REF");
  const productionRef = requireValue("NILE_PHASE5_PRODUCTION_PROJECT_REF", [
    "NILE_PRODUCTION_PROJECT_REF",
  ]);
  const apiUrl = new URL(requireValue("NILE_PHASE5_STAGING_SUPABASE_URL"));
  const host = requireValue("NILE_PHASE5_STAGING_DB_HOST").toLowerCase();
  const port = process.env.NILE_PHASE5_STAGING_DB_PORT?.trim() || "5432";
  const user =
    process.env.NILE_PHASE5_STAGING_DB_USER?.trim() || `postgres.${stagingRef}`;
  const database =
    process.env.NILE_PHASE5_STAGING_DB_NAME?.trim() || "postgres";

  if (
    !/^[a-z0-9]{20}$/.test(stagingRef) ||
    !/^[a-z0-9]{20}$/.test(productionRef)
  ) {
    fail(
      "Supabase staging and production refs must be exact 20-character project refs."
    );
  }
  if (stagingRef === productionRef)
    fail("Staging ref equals production ref; refusing contact.");
  if (sha256(stagingRef) !== expectedStagingRefHash) {
    fail("Staging ref does not match the immutable Phase 5 target contract.");
  }
  if (sha256(productionRef) !== expectedProductionRefHash) {
    fail(
      "Production ref does not match the immutable Phase 5 target contract."
    );
  }
  if (
    apiUrl.protocol !== "https:" ||
    apiUrl.hostname !== `${stagingRef}.supabase.co`
  ) {
    fail(
      "Staging Supabase URL does not exactly match the declared staging ref."
    );
  }
  if (!/^[a-z0-9.-]+\.pooler\.supabase\.com$/.test(host)) {
    fail("Phase 5 requires an explicit Supabase pooler host.");
  }
  if (host.includes(productionRef) || apiUrl.hostname.includes(productionRef)) {
    fail("A target endpoint contains the production ref; refusing contact.");
  }
  if (port !== "5432")
    fail("Phase 5 migrations require the transaction pooler on port 5432.");
  if (user !== `postgres.${stagingRef}`) {
    fail(
      "Database user does not bind the connection to the declared staging ref."
    );
  }
  if (database !== "postgres")
    fail("Phase 5 verification is restricted to the postgres database.");

  if (liveRun) {
    const expectedAck = `APPLY_PHASE5_TO_${stagingRef}`;
    if (process.env.NILE_PHASE5_ALLOW_REMOTE !== "1") {
      fail("Live staging verification requires NILE_PHASE5_ALLOW_REMOTE=1.");
    }
    if (process.env.NILE_PHASE5_STAGING_ACK !== expectedAck) {
      fail(
        `Live staging verification requires NILE_PHASE5_STAGING_ACK=${expectedAck}.`
      );
    }
  }

  evidence.target = {
    projectRef: redactIdentifier(stagingRef),
    productionRef: redactIdentifier(productionRef),
    apiHost: redactIdentifier(apiUrl.hostname),
    databaseHost: redactIdentifier(host),
    databaseUser: redactIdentifier(user),
    database,
    port: Number(port),
    ssl: "required",
  };

  return { stagingRef, productionRef, apiUrl, host, port, user, database };
}

function loadPassword(config) {
  if (process.env.NILE_PHASE5_STAGING_DB_PASSWORD) {
    evidence.secretSource = "environment";
    return process.env.NILE_PHASE5_STAGING_DB_PASSWORD;
  }
  if (process.platform !== "darwin") {
    fail(
      "Set NILE_PHASE5_STAGING_DB_PASSWORD; Keychain lookup is available only on macOS."
    );
  }
  if (!existsSync("/usr/bin/security"))
    fail("macOS Keychain command is unavailable.");

  const service =
    process.env.NILE_PHASE5_STAGING_KEYCHAIN_SERVICE ||
    "nile-learn-phase5-staging-db";
  const account =
    process.env.NILE_PHASE5_STAGING_KEYCHAIN_ACCOUNT ||
    "nile-learn-phase5-staging";
  const result = spawnSync(
    "/usr/bin/security",
    ["find-generic-password", "-a", account, "-s", service, "-w"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  );
  if (result.status !== 0 || !result.stdout.trim()) {
    fail(
      "Database password was not found in the configured macOS Keychain item."
    );
  }
  evidence.secretSource = "macos-keychain";
  return result.stdout.trim();
}

function psql(config, { sql, file, variables = {}, tuples = false }) {
  if (!databasePassword) fail("Database password was not loaded.");
  const commandArgs = [
    "-X",
    "--no-psqlrc",
    "--no-password",
    "--host",
    config.host,
    "--port",
    config.port,
    "--username",
    config.user,
    "--dbname",
    config.database,
    "--set",
    "ON_ERROR_STOP=1",
    "--quiet",
  ];
  if (tuples) commandArgs.push("--tuples-only", "--no-align");
  for (const [name, value] of Object.entries(variables)) {
    commandArgs.push("--set", `${name}=${value}`);
  }

  const input = file ? readFileSync(file) : Buffer.from(sql ?? "", "utf8");
  const result = spawnSync(psqlPath, commandArgs, {
    cwd: root,
    input,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    env: {
      PGPASSWORD: databasePassword,
      PGSSLMODE: "require",
      PGAPPNAME: "nile-phase5-staging-verifier",
      PSQL_HISTORY: "/dev/null",
      LANG: "C",
      LC_ALL: "C",
    },
  });
  if (result.status !== 0) {
    fail(
      `psql failed (${result.status ?? "signal"}): ${sanitize(result.stderr || result.stdout)}`
    );
  }
  return result.stdout.trim();
}

function parseJsonOutput(output, label) {
  try {
    return JSON.parse(output);
  } catch {
    fail(`${label} returned invalid JSON.`);
  }
}

const phase1TableValues = phase1Tables.map(name => `('${name}')`).join(",");
const fixtureAuthValues = fixtureAuthUserIds
  .map(id => `('${id}'::uuid)`)
  .join(",");
const fixtureAppValues = fixtureAppUserIds
  .map(id => `('${id}'::uuid)`)
  .join(",");

function inspectTarget(config) {
  const output = psql(config, {
    tuples: true,
    sql: `
with expected_tables(name) as (values ${phase1TableValues}),
existing_phase1 as (
  select count(*)::integer as count
  from expected_tables
  where to_regclass('public.' || name) is not null
),
unknown_public as (
  select count(*)::integer as count
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and c.relname not in (select name from expected_tables)
    and not exists (
      select 1 from pg_catalog.pg_depend d
      where d.classid = 'pg_class'::regclass and d.objid = c.oid and d.deptype = 'e'
    )
),
fixture_auth(id) as (values ${fixtureAuthValues})
select json_build_object(
  'database', current_database(),
  'user', current_user,
  'serverVersionNum', current_setting('server_version_num'),
  'phase1Tables', (select count from existing_phase1),
  'privateSchemas', (select count(*) from pg_namespace where nspname = 'nile_private'),
  'phase2Functions', (
    select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('create_auth_session_with_evidence', 'revoke_auth_session_with_evidence')
  ),
  'unknownPublicTables', (select count from unknown_public),
  'unknownSchemas', (
    select count(*) from pg_namespace
    where nspname not in (
      'auth', 'extensions', 'graphql', 'graphql_public', 'information_schema',
      'nile_private', 'pg_catalog', 'pg_toast', 'pgbouncer', 'public',
      'realtime', 'storage', 'vault'
    )
      and nspname not like 'pg_temp_%'
      and nspname not like 'pg_toast_temp_%'
  ),
  'authUsers', (select count(*) from auth.users),
  'unexpectedAuthUsers', (
    select count(*) from auth.users where id not in (select id from fixture_auth)
  )
)::text;
`,
  });
  return parseJsonOutput(output, "Target inspection");
}

function fixtureState(config) {
  const output = psql(config, {
    tuples: true,
    sql: `
with fixture_users(id) as (values ${fixtureAppValues}),
counts as (
  select json_build_object(
    'branches', (select count(*) from public.branches),
    'app_users', (select count(*) from public.app_users),
    'departments', (select count(*) from public.departments),
    'department_branches', (select count(*) from public.department_branches),
    'permissions', (select count(*) from public.permissions),
    'role_permissions', (select count(*) from public.role_permissions),
    'role_grants', (select count(*) from public.role_grants),
    'role_grant_branch_scopes', (select count(*) from public.role_grant_branch_scopes),
    'role_grant_department_scopes', (select count(*) from public.role_grant_department_scopes),
    'staff_profiles', (select count(*) from public.staff_profiles),
    'staff_subjects', (select count(*) from public.staff_subjects),
    'auth_sessions', (select count(*) from public.auth_sessions),
    'command_executions', (select count(*) from public.command_executions),
    'audit_logs', (select count(*) from public.audit_logs),
    'outbox_events', (select count(*) from public.outbox_events),
    'integration_connections', (select count(*) from public.integration_connections),
    'integration_env_requirements', (select count(*) from public.integration_env_requirements),
    'external_records', (select count(*) from public.external_records),
    'sync_cursors', (select count(*) from public.sync_cursors),
    'sync_runs', (select count(*) from public.sync_runs),
    'sync_run_items', (select count(*) from public.sync_run_items),
    'reconciliation_cases', (select count(*) from public.reconciliation_cases),
    'migration_runs', (select count(*) from public.migration_runs),
    'migration_run_items', (select count(*) from public.migration_run_items),
    'migration_evidence', (select count(*) from public.migration_evidence)
  ) as value
)
select json_build_object(
  'counts', (select value from counts),
  'unexpectedUsers', (
    select count(*) from public.app_users
    where id not in (select id from fixture_users) or email::text not like '%@nilelearn.local'
  ),
  'unexpectedIntegrationRows', (
    select count(*) from public.integration_connections
    where id <> 'a0000000-0000-4000-8000-000000000001'::uuid
      or provider <> 'nile_phase2_test_fixture'
  ),
  'unexpectedFixtureRows',
    (select count(*) from public.branches where id not in (
      '20000000-0000-4000-8000-000000000001'::uuid,
      '20000000-0000-4000-8000-000000000002'::uuid,
      '20000000-0000-4000-8000-000000000003'::uuid
    )) +
    (select count(*) from public.departments where id not in (
      '30000000-0000-4000-8000-000000000001'::uuid,
      '30000000-0000-4000-8000-000000000002'::uuid
    )) +
    (select count(*) from public.permissions where code not in (
      'dashboard.read', 'profile.read', 'classes.read', 'attendance.write',
      'reports.read', 'users.manage'
    )) +
    (select count(*) from public.role_grants where id not in (
      '50000000-0000-4000-8000-000000000001'::uuid,
      '50000000-0000-4000-8000-000000000002'::uuid,
      '50000000-0000-4000-8000-000000000003'::uuid,
      '50000000-0000-4000-8000-000000000004'::uuid,
      '50000000-0000-4000-8000-000000000005'::uuid,
      '50000000-0000-4000-8000-000000000006'::uuid
    )) +
    (select count(*) from public.role_grant_branch_scopes where id not in (
      '60000000-0000-4000-8000-000000000001'::uuid,
      '60000000-0000-4000-8000-000000000002'::uuid,
      '60000000-0000-4000-8000-000000000003'::uuid,
      '60000000-0000-4000-8000-000000000004'::uuid,
      '60000000-0000-4000-8000-000000000005'::uuid
    )) +
    (select count(*) from public.role_grant_department_scopes where id not in (
      '70000000-0000-4000-8000-000000000001'::uuid,
      '70000000-0000-4000-8000-000000000002'::uuid
    )) +
    (select count(*) from public.staff_profiles where id not in (
      '80000000-0000-4000-8000-000000000002'::uuid,
      '80000000-0000-4000-8000-000000000003'::uuid,
      '80000000-0000-4000-8000-000000000004'::uuid,
      '80000000-0000-4000-8000-000000000005'::uuid,
      '80000000-0000-4000-8000-000000000006'::uuid
    )) +
    (select count(*) from public.staff_subjects where id not in (
      '90000000-0000-4000-8000-000000000001'::uuid,
      '90000000-0000-4000-8000-000000000002'::uuid
    ))
)::text;
`,
  });
  return parseJsonOutput(output, "Fixture inspection");
}

const expectedSeedCounts = {
  branches: 3,
  app_users: 6,
  departments: 2,
  department_branches: 5,
  permissions: 6,
  role_permissions: 16,
  role_grants: 6,
  role_grant_branch_scopes: 5,
  role_grant_department_scopes: 2,
  staff_profiles: 5,
  staff_subjects: 2,
  auth_sessions: 0,
  command_executions: 0,
  audit_logs: 0,
  outbox_events: 0,
  integration_connections: 1,
  integration_env_requirements: 0,
  external_records: 0,
  sync_cursors: 0,
  sync_runs: 0,
  sync_run_items: 0,
  reconciliation_cases: 0,
  migration_runs: 0,
  migration_run_items: 0,
  migration_evidence: 0,
};

function assertSafeInitialTarget(config, inspection) {
  // Supabase Supavisor binds the tenant through postgres.<project-ref>, then
  // maps the effective PostgreSQL role to postgres after authentication.
  if (
    inspection.database !== config.database ||
    inspection.user !== "postgres"
  ) {
    fail(
      "Connected PostgreSQL identity does not match the declared staging target."
    );
  }
  if (inspection.unknownPublicTables !== 0) {
    fail("Target contains unknown non-extension public tables.");
  }
  if (inspection.unknownSchemas !== 0) {
    fail("Target contains an unknown non-system schema.");
  }
  if (inspection.unexpectedAuthUsers !== 0) {
    fail("Target contains Auth users outside the deterministic fake fixture.");
  }
  if (![0, phase1Tables.length].includes(inspection.phase1Tables)) {
    fail(
      "Target contains a partial Phase 1 schema; manual review is required."
    );
  }
  if (inspection.phase1Tables === 0) {
    if (inspection.privateSchemas !== 0 || inspection.phase2Functions !== 0) {
      fail(
        "Target is not clean: orphaned private schema or Phase 2 functions exist."
      );
    }
    return "clean";
  }

  const state = fixtureState(config);
  const counts = state.counts;
  const emptySchema = Object.values(counts).every(count => Number(count) === 0);
  const exactFixture = Object.entries(expectedSeedCounts).every(
    ([table, expected]) => Number(counts[table]) === expected
  );
  if (
    state.unexpectedUsers !== 0 ||
    state.unexpectedIntegrationRows !== 0 ||
    state.unexpectedFixtureRows !== 0
  ) {
    fail("Target contains non-fixture application data.");
  }
  if (!emptySchema && !exactFixture) {
    fail(
      "Existing Phase 1 schema is neither empty nor the exact deterministic fake fixture."
    );
  }
  return emptySchema ? "empty-schema" : "exact-fake-fixture";
}

function insertAssertionAuthUser(config) {
  psql(config, {
    variables: { nile_test_auth_user_id: assertionAuthUserId },
    sql: `
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '00000000-0000-0000-0000-000000000000', :'nile_test_auth_user_id',
  'authenticated', 'authenticated', 'phase5.assertion@nilelearn.local', '', now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"name":"Phase 5 Assertion User"}'::jsonb, now(), now()
)
on conflict (id) do nothing;
`,
  });
}

function removeAssertionAuthUser(config) {
  psql(config, {
    variables: { nile_test_auth_user_id: assertionAuthUserId },
    sql: "delete from auth.users where id = :'nile_test_auth_user_id';",
  });
}

function runAssertions(config) {
  insertAssertionAuthUser(config);
  try {
    psql(config, {
      file: artifact("assertions"),
      variables: { nile_test_auth_user_id: assertionAuthUserId },
    });
  } finally {
    removeAssertionAuthUser(config);
  }
}

function applyFoundation(config) {
  psql(config, { file: artifact("phase1Migration") });
  psql(config, { file: artifact("phase2Migration") });
}

function applyFakeSeed(config) {
  psql(config, { file: artifact("fakeSeed") });
}

function rollbackFoundation(config, inspection = inspectTarget(config)) {
  if (inspection.phase2Functions === 2) {
    psql(config, { file: artifact("phase2Rollback") });
  } else if (inspection.phase2Functions !== 0) {
    fail("Target contains a partial Phase 2 function set.");
  }
  if (inspection.phase1Tables === phase1Tables.length) {
    psql(config, { file: artifact("phase1Rollback") });
  }
  psql(config, {
    sql: `delete from auth.users where id in (${fixtureAuthUserIds
      .map(id => `'${id}'::uuid`)
      .join(",")});`,
  });
}

function assertClean(config) {
  const inspection = inspectTarget(config);
  if (
    inspection.phase1Tables !== 0 ||
    inspection.privateSchemas !== 0 ||
    inspection.phase2Functions !== 0 ||
    inspection.unknownPublicTables !== 0 ||
    inspection.authUsers !== 0
  ) {
    fail("Rollback did not restore a clean isolated staging target.");
  }
}

function assertPostgresContract(config) {
  const state = fixtureState(config);
  for (const [table, expected] of Object.entries(expectedSeedCounts)) {
    if (Number(state.counts[table]) !== expected) {
      fail(`Unexpected deterministic seed count for ${table}.`);
    }
  }
  if (
    state.unexpectedUsers !== 0 ||
    state.unexpectedIntegrationRows !== 0 ||
    state.unexpectedFixtureRows !== 0
  ) {
    fail("Post-apply data is not the exact deterministic fake fixture.");
  }

  const output = psql(config, {
    tuples: true,
    sql: `
with expected_tables(name) as (values ${phase1TableValues})
select json_build_object(
  'rlsMissing', (
    select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname in (select name from expected_tables)
      and (not c.relrowsecurity or not c.relforcerowsecurity)
  ),
  'policies', (
    select count(*) from pg_policies
    where schemaname = 'public' and tablename in (select name from expected_tables)
  ),
  'phase2Functions', (
    select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('create_auth_session_with_evidence', 'revoke_auth_session_with_evidence')
  ),
  'browserRpcGrants', (
    select count(*) from information_schema.routine_privileges
    where routine_schema = 'public'
      and routine_name in ('create_auth_session_with_evidence', 'revoke_auth_session_with_evidence')
      and grantee in ('PUBLIC', 'anon', 'authenticated')
      and privilege_type = 'EXECUTE'
  ),
  'invalidConstraints', (
    select count(*) from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname in ('public', 'nile_private') and not c.convalidated
  ),
  'invalidIndexes', (
    select count(*) from pg_index i join pg_class c on c.oid = i.indexrelid
      join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public', 'nile_private') and (not i.indisvalid or not i.indisready)
  )
)::text;

begin;
set local role anon;
do $$ begin
  begin perform * from public.app_users limit 1;
    raise exception 'anon read a server-only table';
  exception when insufficient_privilege then null; end;
  begin perform * from public.resolve_auth_session_authority(repeat('0', 64));
    raise exception 'anon executed a server-only authority RPC';
  exception when insufficient_privilege then null; end;
end $$;
rollback;

begin;
set local role authenticated;
do $$ begin
  begin perform * from public.app_users limit 1;
    raise exception 'authenticated read a server-only table';
  exception when insufficient_privilege then null; end;
  begin perform * from public.resolve_auth_session_authority(repeat('0', 64));
    raise exception 'authenticated executed a server-only authority RPC';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
`,
  });
  const firstLine = output
    .split("\n")
    .find(line => line.trim().startsWith("{"));
  const contract = parseJsonOutput(firstLine, "PostgreSQL contract inspection");
  if (
    contract.rlsMissing !== 0 ||
    contract.policies !== 0 ||
    contract.phase2Functions !== 2 ||
    contract.browserRpcGrants !== 0
  ) {
    fail("RLS or server-only function privilege contract failed.");
  }
  if (
    runLint &&
    (contract.invalidConstraints !== 0 || contract.invalidIndexes !== 0)
  ) {
    fail(
      "Optional PostgreSQL catalog lint found invalid constraints or indexes."
    );
  }
  return contract;
}

async function main() {
  recordStep("verify reviewed artifact hashes", verifyArtifacts);
  recordStep("verify required local commands", () => {
    psqlPath = resolveTrustedPsql();
  });

  if (staticPreflight) {
    evidence.status = "passed";
    evidence.completedAt = new Date().toISOString();
    writeEvidence();
    process.stdout.write(
      `Static preflight passed. Evidence: ${path.relative(root, outputPath)}\n`
    );
    return;
  }

  const config = recordStep(
    "validate isolated staging target",
    loadTargetConfig
  );
  if (dryRun) {
    evidence.status = "passed";
    evidence.completedAt = new Date().toISOString();
    writeEvidence();
    process.stdout.write(
      `Dry run passed without secret lookup or network contact. Evidence: ${path.relative(root, outputPath)}\n`
    );
    return;
  }

  databasePassword = recordStep("load database secret without disclosure", () =>
    loadPassword(config)
  );
  const inspection = recordStep(
    "inspect target identity and data boundary",
    () => inspectTarget(config)
  );
  const initialState = recordStep("prove clean or exact fake-only target", () =>
    assertSafeInitialTarget(config, inspection)
  );
  evidence.initialState = initialState;

  if (initialState !== "clean") {
    recordStep("normalize prior fake-only run to clean", () =>
      rollbackFoundation(config, inspection)
    );
    recordStep("verify normalized target is clean", () => assertClean(config));
  }

  recordStep("apply reviewed Phase 1 and Phase 2 SQL", () =>
    applyFoundation(config)
  );
  recordStep("run first semantic assertion pass", () => runAssertions(config));
  recordStep("apply deterministic fake seed", () => applyFakeSeed(config));
  const firstContract = recordStep(
    "verify first PostgreSQL and RLS contract",
    () => assertPostgresContract(config)
  );

  recordStep("rollback Phase 2 then Phase 1", () => rollbackFoundation(config));
  recordStep("verify rollback is clean", () => assertClean(config));

  recordStep("reapply reviewed Phase 1 and Phase 2 SQL", () =>
    applyFoundation(config)
  );
  recordStep("run second semantic assertion pass", () => runAssertions(config));
  recordStep("reapply deterministic fake seed", () => applyFakeSeed(config));
  const secondContract = recordStep(
    "verify reapplied PostgreSQL and RLS contract",
    () => assertPostgresContract(config)
  );

  evidence.contract = {
    assertionPasses: 2,
    applyPasses: 2,
    rollbackPasses: 1,
    fakeSeedPasses: 2,
    rls: "forced-server-only",
    browserRoles: "denied",
    firstCatalog: firstContract,
    secondCatalog: secondContract,
  };
  evidence.status = "passed";
  evidence.completedAt = new Date().toISOString();
  databasePassword = "";
  writeEvidence();
  process.stdout.write(
    `Phase 5 staging database verification passed. Evidence: ${path.relative(root, outputPath)}\n`
  );
}

main().catch(error => {
  evidence.status = "failed";
  evidence.completedAt = new Date().toISOString();
  evidence.error = sanitize(error instanceof Error ? error.message : error);
  databasePassword = "";
  writeEvidence();
  process.stderr.write(
    `Phase 5 staging database verification failed: ${evidence.error}\n`
  );
  process.stderr.write(`Evidence: ${path.relative(root, outputPath)}\n`);
  process.exitCode = 1;
});
