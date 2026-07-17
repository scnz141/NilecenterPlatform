import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = relative => readFileSync(path.join(root, relative), "utf8");
const sql = {
  phase1: read(
    "supabase/migrations/20260710053837_phase1_identity_scope_session_audit_mapping.sql"
  ),
  phase1Seed: read("supabase/seed.sql"),
  phase6a: read("supabase/manual/006_phase6a_moodle_projection_authority.sql"),
  phase6aSeed: read(
    "supabase/manual/106_phase6a_moodle_projection_authority_fake_seed.sql"
  ),
  phase6e: read(
    "supabase/manual/008_phase6e_moodle_user_mapping_authority.sql"
  ),
  phase6eSeed: read(
    "supabase/manual/108_phase6e_moodle_user_mapping_authority_fake_seed.sql"
  ),
  phase6f: read(
    "supabase/manual/009_phase6f_moodle_enrollment_group_observation.sql"
  ),
  phase6fSeed: read(
    "supabase/manual/109_phase6f_moodle_enrollment_group_observation_fake_seed.sql"
  ),
  phase6g: read(
    "supabase/manual/010_phase6g_moodle_assessment_status_observation.sql"
  ),
  phase6gSeed: read(
    "supabase/manual/110_phase6g_moodle_assessment_status_fake_seed.sql"
  ),
  phase6h1: read(
    "supabase/manual/011_phase6h1_moodle_assignment_result_observation.sql"
  ),
  phase6h2: read(
    "supabase/manual/012_phase6h2_moodle_quiz_attempt_observation.sql"
  ),
  phase6h3: read(
    "supabase/manual/013_phase6h3_moodle_grade_outcome_observation.sql"
  ),
  migration: read(
    "supabase/manual/014_phase6h4_moodle_activity_outcome_observation.sql"
  ),
  seed: read(
    "supabase/manual/114_phase6h4_moodle_activity_outcome_fake_seed.sql"
  ),
  assertions: read(
    "supabase/manual/214_phase6h4_moodle_activity_outcome_assertions.sql"
  ),
  rollback: read(
    "supabase/manual/914_phase6h4_moodle_activity_outcome_rollback.sql"
  ),
};

function log(label, startedAt, details = {}) {
  console.log(
    JSON.stringify({
      label,
      ok: true,
      elapsedMs: Date.now() - startedAt,
      ...details,
    })
  );
}

async function run(database, label, statement) {
  const startedAt = Date.now();
  await database.exec(statement);
  log(label, startedAt);
}

function denied(error) {
  return (
    error?.code === "42501" || /permission denied|42501/i.test(String(error))
  );
}

async function expectDenied(database, role, statement, label) {
  await database.exec(`set role ${role}`);
  try {
    await database.query(statement);
    throw new Error(`${label} unexpectedly succeeded as ${role}`);
  } catch (error) {
    if (!denied(error)) throw error;
  } finally {
    await database.exec("reset role");
  }
}

async function assertRuntimeDenials(database) {
  let count = 0;
  for (const role of ["anon", "authenticated", "service_role"]) {
    await expectDenied(
      database,
      role,
      "select * from public.moodle_activity_outcome_observations",
      "Direct Phase 6H4 table read"
    );
    count += 1;
  }
  const calls = [
    `select * from public.resolve_moodle_activity_outcome_context(
      '40000000-0000-4000-8000-000000000001'::uuid,
      '50000000-0000-4000-8000-000000000001'::uuid,
      'b6000000-0000-4000-8000-000000000001'::uuid,
      'd5000000-0000-4000-8000-000000000001'::uuid)`,
    `select * from public.list_authorized_moodle_activity_outcome_freshness(
      '40000000-0000-4000-8000-000000000001'::uuid,
      '50000000-0000-4000-8000-000000000001'::uuid,
      'ba000000-0000-4000-8000-000000000001'::uuid,
      'b6000000-0000-4000-8000-000000000001'::uuid,
      'd5000000-0000-4000-8000-000000000001'::uuid,
      '2026-07-17T12:10:00Z'::timestamptz)`,
    `select * from public.record_moodle_activity_outcome_observation(
      'phase6h4.denied.record',
      'ba000000-0000-4000-8000-000000000001'::uuid,
      'b3000000-0000-4000-8000-000000000001'::uuid,
      'b6000000-0000-4000-8000-000000000001'::uuid,
      'd5000000-0000-4000-8000-000000000001'::uuid,
      'bb000000-0000-4000-8000-000000000001'::uuid,
      'c1000000-0000-4000-8000-000000000001'::uuid,
      'a2000000-0000-4000-8000-000000000005'::uuid,
      'a3000000-0000-4000-8000-000000000005'::uuid,
      'person_level', 'unavailable', null, null,
      '2026-07-17T14:00:00Z'::timestamptz, null, null, null, null)`,
    `select * from public.purge_moodle_activity_outcome_observations(
      '2026-07-17T14:30:00Z'::timestamptz, 1)`,
  ];
  for (const role of ["anon", "authenticated"]) {
    for (const [index, statement] of calls.entries()) {
      await expectDenied(
        database,
        role,
        statement,
        `Phase 6H4 RPC ${index + 1}`
      );
      count += 1;
    }
  }
  console.log(
    JSON.stringify({ label: "runtime-role-denials", ok: true, count })
  );
  return count;
}

async function assertServiceSemantics(database) {
  await database.exec("set role service_role");
  try {
    const contexts = [
      [
        "40000000-0000-4000-8000-000000000001",
        "50000000-0000-4000-8000-000000000001",
        "student",
        "learner",
        1,
      ],
      [
        "40000000-0000-4000-8000-000000000002",
        "50000000-0000-4000-8000-000000000002",
        "teacher",
        "person_level",
        1,
      ],
      [
        "40000000-0000-4000-8000-000000000004",
        "50000000-0000-4000-8000-000000000004",
        "headofdepartment",
        "aggregate",
        0,
      ],
      [
        "40000000-0000-4000-8000-000000000006",
        "50000000-0000-4000-8000-000000000006",
        "superadmin",
        "aggregate",
        0,
      ],
    ];
    for (const [user, grant, role, audience, authorizedCount] of contexts) {
      const result = await database.query(`
        select active_role, projection_audience, authorized_user_ids,
               activity_kind,
               course_mapping_status, group_mapping_status,
               user_mapping_status, activity_mapping_status
        from public.resolve_moodle_activity_outcome_context(
          '${user}'::uuid, '${grant}'::uuid,
          'b6000000-0000-4000-8000-000000000001'::uuid,
          'd5000000-0000-4000-8000-000000000001'::uuid)`);
      const row = result.rows[0];
      if (
        row?.active_role !== role ||
        row?.projection_audience !== audience ||
        row?.activity_kind !== "h5p" ||
        row?.authorized_user_ids?.length !== authorizedCount ||
        row?.course_mapping_status !== "exact" ||
        row?.group_mapping_status !== "exact" ||
        row?.activity_mapping_status !== "exact"
      ) {
        throw new Error(
          `Invalid ${role} context: ${JSON.stringify(result.rows)}`
        );
      }
    }

    for (const [user, grant, audience, expectedKey] of [
      [
        "40000000-0000-4000-8000-000000000001",
        "50000000-0000-4000-8000-000000000001",
        "learner",
        "learners",
      ],
      [
        "40000000-0000-4000-8000-000000000002",
        "50000000-0000-4000-8000-000000000002",
        "person_level",
        "learners",
      ],
      [
        "40000000-0000-4000-8000-000000000004",
        "50000000-0000-4000-8000-000000000004",
        "aggregate",
        "learnerCount",
      ],
    ]) {
      const result = await database.query(`
        select projection_audience, freshness_state, sanitized_payload
        from public.list_authorized_moodle_activity_outcome_freshness(
          '${user}'::uuid, '${grant}'::uuid,
          'ba000000-0000-4000-8000-000000000001'::uuid,
          'b6000000-0000-4000-8000-000000000001'::uuid,
          'd5000000-0000-4000-8000-000000000001'::uuid,
          '2026-07-17T12:10:00Z'::timestamptz)`);
      const row = result.rows[0];
      if (
        row?.projection_audience !== audience ||
        row?.freshness_state !== "fresh" ||
        !Object.hasOwn(row?.sanitized_payload ?? {}, expectedKey)
      ) {
        throw new Error(
          `Invalid ${audience} freshness: ${JSON.stringify(result.rows)}`
        );
      }
      if (
        audience === "aggregate" &&
        (Object.hasOwn(row.sanitized_payload, "learners") ||
          Object.hasOwn(row.sanitized_payload, "score"))
      ) {
        throw new Error(
          `Aggregate payload leaked person data: ${JSON.stringify(row)}`
        );
      }
    }

    const purge =
      await database.query(`select * from public.purge_moodle_activity_outcome_observations(
      '2026-07-17T14:30:00Z'::timestamptz, 1)`);
    if (purge.rows[0]?.deleted_count !== 1) {
      throw new Error(`Invalid bounded purge: ${JSON.stringify(purge.rows)}`);
    }
  } finally {
    await database.exec("reset role");
  }
  console.log(
    JSON.stringify({ label: "service-semantics", ok: true, calls: 8 })
  );
  return 8;
}

async function assertRollback(database) {
  const table = await database.query(
    "select pg_catalog.to_regclass('public.moodle_activity_outcome_observations') as name"
  );
  const functions = await database.query(`
    select pg_catalog.count(*)::integer as count
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where (namespace.nspname = 'public' and procedure.proname in (
      'resolve_moodle_activity_outcome_context',
      'record_moodle_activity_outcome_observation',
      'list_authorized_moodle_activity_outcome_freshness',
      'purge_moodle_activity_outcome_observations'
    )) or (namespace.nspname = 'nile_private' and procedure.proname in (
      'moodle_activity_outcome_payload_is_safe',
      'guard_moodle_activity_outcome_immutable'
    ))`);
  const evidence = await database.query(`
    select
      (select pg_catalog.count(*)::integer from public.moodle_assessment_status_observations) as phase6g_observations,
      (select pg_catalog.count(*)::integer from public.sync_runs where entity_type = 'assessment_status_projection') as phase6g_runs,
      (select pg_catalog.count(*)::integer from public.sync_runs where entity_type = 'activity_outcomes_projection') as phase6h4_runs`);
  if (
    table.rows[0]?.name !== null ||
    functions.rows[0]?.count !== 0 ||
    evidence.rows[0]?.phase6g_observations !== 6 ||
    evidence.rows[0]?.phase6g_runs !== 6 ||
    evidence.rows[0]?.phase6h4_runs !== 6
  ) {
    throw new Error(
      `Rollback mismatch: ${JSON.stringify({ table: table.rows, functions: functions.rows, evidence: evidence.rows })}`
    );
  }
  console.log(
    JSON.stringify({
      label: "rollback-clean",
      ok: true,
      priorPhaseEvidenceRetained: true,
      durableIntegrationEvidenceRetained: true,
    })
  );
}

const database = new PGlite({ extensions: { btree_gist, citext, pgcrypto } });

try {
  await database.waitReady;
  const version = await database.query("select version() as version");
  await database.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key);`);

  for (const [label, statement] of [
    ["phase1-foundation", sql.phase1],
    ["phase1-fake-seed", sql.phase1Seed],
    ["phase6a-foundation", sql.phase6a],
    ["phase6a-fake-seed", sql.phase6aSeed],
    ["phase6e-foundation", sql.phase6e],
    ["phase6e-fake-seed", sql.phase6eSeed],
    ["phase6f-foundation", sql.phase6f],
    ["phase6f-fake-seed", sql.phase6fSeed],
    ["phase6g-foundation", sql.phase6g],
    ["phase6g-fake-seed", sql.phase6gSeed],
    ["phase6h1-foundation", sql.phase6h1],
    ["phase6h2-foundation", sql.phase6h2],
    ["phase6h3-foundation", sql.phase6h3],
  ])
    await run(database, label, statement);

  let browserDenials = 0;
  let serviceCalls = 0;
  await run(database, "phase6h4-forward-1", sql.migration);
  await run(database, "phase6h4-seed-1", sql.seed);
  await run(database, "phase6h4-assertions-1", sql.assertions);
  browserDenials += await assertRuntimeDenials(database);
  serviceCalls += await assertServiceSemantics(database);

  await run(database, "phase6h4-rollback", sql.rollback);
  await assertRollback(database);

  await run(database, "phase6h4-forward-2", sql.migration);
  await run(database, "phase6h4-seed-2", sql.seed);
  await run(database, "phase6h4-assertions-2", sql.assertions);
  browserDenials += await assertRuntimeDenials(database);
  serviceCalls += await assertServiceSemantics(database);

  console.log(
    JSON.stringify({
      ok: true,
      engine: version.rows[0]?.version ?? "PGlite PostgreSQL",
      package: "phase6h4-moodle-activity-outcome-observation",
      manualOnly: true,
      dependencyChain: [
        "phase1",
        "phase6a",
        "phase6e",
        "phase6f",
        "phase6g",
        "phase6h1",
        "phase6h2",
        "phase6h3",
        "phase6h4",
      ],
      forwardApplications: 2,
      assertionPasses: 2,
      rollbackReapplyPasses: 1,
      browserRoleDenials: browserDenials,
      serviceRoleCalls: serviceCalls,
      remoteCalls: 0,
    })
  );
} finally {
  await database.close();
}
