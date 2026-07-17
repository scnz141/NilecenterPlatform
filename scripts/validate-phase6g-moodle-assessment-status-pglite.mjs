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
  migration: read(
    "supabase/manual/010_phase6g_moodle_assessment_status_observation.sql"
  ),
  seed: read(
    "supabase/manual/110_phase6g_moodle_assessment_status_fake_seed.sql"
  ),
  assertions: read(
    "supabase/manual/210_phase6g_moodle_assessment_status_assertions.sql"
  ),
  rollback: read(
    "supabase/manual/910_phase6g_moodle_assessment_status_rollback.sql"
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
      "select * from public.moodle_assessment_status_observations",
      "Direct Phase 6G table read"
    );
    count += 1;
  }
  const calls = [
    `select * from public.resolve_moodle_assessment_status_context(
      '40000000-0000-4000-8000-000000000001'::uuid,
      '50000000-0000-4000-8000-000000000001'::uuid,
      'b6000000-0000-4000-8000-000000000001'::uuid
    )`,
    `select * from public.list_authorized_moodle_assessment_status_freshness(
      '40000000-0000-4000-8000-000000000001'::uuid,
      '50000000-0000-4000-8000-000000000001'::uuid,
      'ba000000-0000-4000-8000-000000000001'::uuid,
      'b6000000-0000-4000-8000-000000000001'::uuid,
      '2026-07-17T12:10:00Z'::timestamptz
    )`,
    `select * from public.record_moodle_assessment_status_observation(
      'phase6g.denied.record',
      'ba000000-0000-4000-8000-000000000001'::uuid,
      'b3000000-0000-4000-8000-000000000001'::uuid,
      'b6000000-0000-4000-8000-000000000001'::uuid,
      'bb000000-0000-4000-8000-000000000001'::uuid,
      'c1000000-0000-4000-8000-000000000001'::uuid,
      'd2000000-0000-4000-8000-000000000005'::uuid,
      'd3000000-0000-4000-8000-000000000005'::uuid,
      'unavailable', null, null,
      '2026-07-17T14:00:00Z'::timestamptz, null, null, null, null
    )`,
    `select * from public.purge_moodle_assessment_status_observations(
      '2026-07-17T14:30:00Z'::timestamptz, 1
    )`,
  ];
  for (const role of ["anon", "authenticated"]) {
    for (const [index, statement] of calls.entries()) {
      await expectDenied(
        database,
        role,
        statement,
        `Phase 6G RPC ${index + 1}`
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
    const learner = await database.query(`
      select active_role, projection_audience, subject_user_id,
             user_mapping_status, assessment_mapping_status
      from public.resolve_moodle_assessment_status_context(
        '40000000-0000-4000-8000-000000000001'::uuid,
        '50000000-0000-4000-8000-000000000001'::uuid,
        'b6000000-0000-4000-8000-000000000001'::uuid
      )
    `);
    if (
      learner.rows[0]?.active_role !== "student" ||
      learner.rows[0]?.projection_audience !== "learner" ||
      learner.rows[0]?.subject_user_id !==
        "40000000-0000-4000-8000-000000000001" ||
      learner.rows[0]?.user_mapping_status !== "exact" ||
      learner.rows[0]?.assessment_mapping_status !== "exact"
    ) {
      throw new Error(
        `Invalid learner context: ${JSON.stringify(learner.rows)}`
      );
    }

    for (const [user, grant, role] of [
      [
        "40000000-0000-4000-8000-000000000002",
        "50000000-0000-4000-8000-000000000002",
        "teacher",
      ],
      [
        "40000000-0000-4000-8000-000000000004",
        "50000000-0000-4000-8000-000000000004",
        "headofdepartment",
      ],
      [
        "40000000-0000-4000-8000-000000000006",
        "50000000-0000-4000-8000-000000000006",
        "superadmin",
      ],
    ]) {
      const staff = await database.query(`
        select active_role, projection_audience, subject_user_id, user_mapping_status
        from public.resolve_moodle_assessment_status_context(
          '${user}'::uuid, '${grant}'::uuid,
          'b6000000-0000-4000-8000-000000000001'::uuid
        )
      `);
      if (
        staff.rows[0]?.active_role !== role ||
        staff.rows[0]?.projection_audience !== "class_staff" ||
        staff.rows[0]?.subject_user_id !== null ||
        staff.rows[0]?.user_mapping_status !== "not_required"
      ) {
        throw new Error(
          `Invalid ${role} context: ${JSON.stringify(staff.rows)}`
        );
      }
    }

    const fresh = await database.query(`
      select projection_audience, subject_user_id, freshness_state,
             latest_outcome, sanitized_payload, fresh_until, retain_until
      from public.list_authorized_moodle_assessment_status_freshness(
        '40000000-0000-4000-8000-000000000001'::uuid,
        '50000000-0000-4000-8000-000000000001'::uuid,
        'ba000000-0000-4000-8000-000000000001'::uuid,
        'b6000000-0000-4000-8000-000000000001'::uuid,
        '2026-07-17T12:10:00Z'::timestamptz
      )
    `);
    const freshRow = fresh.rows[0];
    const kinds = new Set(
      (freshRow?.sanitized_payload?.items ?? []).map(item => item.kind)
    );
    if (
      freshRow?.projection_audience !== "learner" ||
      freshRow?.freshness_state !== "fresh" ||
      freshRow?.latest_outcome !== "available" ||
      freshRow?.sanitized_payload?.items?.length !== 2 ||
      !kinds.has("assignment") ||
      !kinds.has("quiz") ||
      Object.hasOwn(freshRow?.sanitized_payload ?? {}, "modifiedAt")
    ) {
      throw new Error(`Invalid fresh snapshot: ${JSON.stringify(fresh.rows)}`);
    }

    const stale = await database.query(`
      select projection_audience, freshness_state, latest_outcome, sanitized_payload
      from public.list_authorized_moodle_assessment_status_freshness(
        '40000000-0000-4000-8000-000000000002'::uuid,
        '50000000-0000-4000-8000-000000000002'::uuid,
        'ba000000-0000-4000-8000-000000000001'::uuid,
        'b6000000-0000-4000-8000-000000000001'::uuid,
        '2026-07-17T14:30:00Z'::timestamptz
      )
    `);
    if (
      stale.rows[0]?.projection_audience !== "class_staff" ||
      stale.rows[0]?.freshness_state !== "stale_retained" ||
      stale.rows[0]?.latest_outcome !== "reconciliation" ||
      stale.rows[0]?.sanitized_payload?.items?.length !== 2
    ) {
      throw new Error(`Invalid stale snapshot: ${JSON.stringify(stale.rows)}`);
    }

    const purge = await database.query(`
      select * from public.purge_moodle_assessment_status_observations(
        '2026-07-17T14:30:00Z'::timestamptz, 1
      )
    `);
    if (purge.rows[0]?.deleted_count !== 1) {
      throw new Error(`Invalid bounded purge: ${JSON.stringify(purge.rows)}`);
    }
  } finally {
    await database.exec("reset role");
  }
  console.log(
    JSON.stringify({ label: "service-semantics", ok: true, calls: 7 })
  );
  return 7;
}

async function assertRollback(database) {
  const table = await database.query(`
    select pg_catalog.to_regclass('public.moodle_assessment_status_observations') as name
  `);
  const functions = await database.query(`
    select pg_catalog.count(*)::integer as count
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where (namespace.nspname = 'public' and procedure.proname in (
      'resolve_moodle_assessment_status_context',
      'record_moodle_assessment_status_observation',
      'list_authorized_moodle_assessment_status_freshness',
      'purge_moodle_assessment_status_observations'
    )) or (namespace.nspname = 'nile_private' and procedure.proname in (
      'moodle_assessment_status_payload_is_safe',
      'guard_moodle_assessment_status_immutable'
    ))
  `);
  const evidence = await database.query(`
    select
      (select pg_catalog.count(*)::integer
       from public.moodle_enrollment_group_observations) as phase6f_observations,
      (select pg_catalog.count(*)::integer from public.sync_runs
       where entity_type = 'enrollment_groups_projection') as phase6f_runs,
      (select pg_catalog.count(*)::integer from public.external_records
       where id in (
         'd1000000-0000-4000-8000-000000000001',
         'd1000000-0000-4000-8000-000000000002'
       )) as assessment_mappings,
      (select pg_catalog.count(*)::integer from public.sync_runs
       where entity_type = 'assessment_status_projection') as assessment_runs
  `);
  if (
    table.rows[0]?.name !== null ||
    functions.rows[0]?.count !== 0 ||
    evidence.rows[0]?.phase6f_observations !== 5 ||
    evidence.rows[0]?.phase6f_runs !== 5 ||
    evidence.rows[0]?.assessment_mappings !== 2 ||
    evidence.rows[0]?.assessment_runs !== 6
  ) {
    throw new Error(
      `Rollback mismatch: ${JSON.stringify({
        table: table.rows,
        functions: functions.rows,
        evidence: evidence.rows,
      })}`
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
    create table auth.users (id uuid primary key);
  `);

  await run(database, "phase1-foundation", sql.phase1);
  await run(database, "phase1-fake-seed", sql.phase1Seed);
  await run(database, "phase6a-foundation", sql.phase6a);
  await run(database, "phase6a-fake-seed", sql.phase6aSeed);
  await run(database, "phase6e-foundation", sql.phase6e);
  await run(database, "phase6e-fake-seed", sql.phase6eSeed);
  await run(database, "phase6f-foundation", sql.phase6f);
  await run(database, "phase6f-fake-seed", sql.phase6fSeed);

  let browserDenials = 0;
  let serviceCalls = 0;
  await run(database, "phase6g-forward-1", sql.migration);
  await run(database, "phase6g-seed-1", sql.seed);
  await run(database, "phase6g-assertions-1", sql.assertions);
  browserDenials += await assertRuntimeDenials(database);
  serviceCalls += await assertServiceSemantics(database);

  await run(database, "phase6g-rollback", sql.rollback);
  await assertRollback(database);

  await run(database, "phase6g-forward-2", sql.migration);
  await run(database, "phase6g-seed-2", sql.seed);
  await run(database, "phase6g-assertions-2", sql.assertions);
  browserDenials += await assertRuntimeDenials(database);
  serviceCalls += await assertServiceSemantics(database);

  console.log(
    JSON.stringify({
      ok: true,
      engine: version.rows[0]?.version ?? "PGlite PostgreSQL",
      package: "phase6g-moodle-assessment-status-observation",
      manualOnly: true,
      dependencyChain: ["phase1", "phase6a", "phase6e", "phase6f", "phase6g"],
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
