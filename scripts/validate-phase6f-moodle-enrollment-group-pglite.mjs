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
  migration: read(
    "supabase/manual/009_phase6f_moodle_enrollment_group_observation.sql"
  ),
  seed: read(
    "supabase/manual/109_phase6f_moodle_enrollment_group_observation_fake_seed.sql"
  ),
  assertions: read(
    "supabase/manual/209_phase6f_moodle_enrollment_group_observation_assertions.sql"
  ),
  rollback: read(
    "supabase/manual/909_phase6f_moodle_enrollment_group_observation_rollback.sql"
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
      "select * from public.moodle_enrollment_group_observations",
      "Direct Phase 6F table read"
    );
    count += 1;
  }
  for (const role of ["anon", "authenticated"]) {
    await expectDenied(
      database,
      role,
      `select * from public.resolve_moodle_enrollment_group_context(
        '40000000-0000-4000-8000-000000000002'::uuid,
        '50000000-0000-4000-8000-000000000002'::uuid,
        'b6000000-0000-4000-8000-000000000001'::uuid
      )`,
      "Phase 6F context RPC"
    );
    count += 1;
    await expectDenied(
      database,
      role,
      `select * from public.list_authorized_moodle_enrollment_group_freshness(
        '40000000-0000-4000-8000-000000000002'::uuid,
        '50000000-0000-4000-8000-000000000002'::uuid,
        'ba000000-0000-4000-8000-000000000001'::uuid,
        'b6000000-0000-4000-8000-000000000001'::uuid,
        '2026-07-17T14:30:00Z'::timestamptz
      )`,
      "Phase 6F freshness RPC"
    );
    count += 1;
  }
  console.log(
    JSON.stringify({ label: "runtime-role-denials", ok: true, count })
  );
  return count;
}

async function assertServiceSemantics(database) {
  await database.exec("set role service_role");
  try {
    const teacher = await database.query(`
      select active_role, projection_audience, authorized_user_ids,
             course_mapping_status, group_mapping_status, user_mapping_status
      from public.resolve_moodle_enrollment_group_context(
        '40000000-0000-4000-8000-000000000002'::uuid,
        '50000000-0000-4000-8000-000000000002'::uuid,
        'b6000000-0000-4000-8000-000000000001'::uuid
      )
    `);
    if (
      teacher.rows[0]?.active_role !== "teacher" ||
      teacher.rows[0]?.projection_audience !== "person_level" ||
      teacher.rows[0]?.authorized_user_ids?.length !== 1 ||
      teacher.rows[0]?.user_mapping_status !== "exact"
    ) {
      throw new Error(
        `Invalid teacher context: ${JSON.stringify(teacher.rows)}`
      );
    }

    const teacherFreshness = await database.query(`
      select projection_audience, freshness_state, latest_outcome,
             sanitized_payload, successful_sync_run_id
      from public.list_authorized_moodle_enrollment_group_freshness(
        '40000000-0000-4000-8000-000000000002'::uuid,
        '50000000-0000-4000-8000-000000000002'::uuid,
        'ba000000-0000-4000-8000-000000000001'::uuid,
        'b6000000-0000-4000-8000-000000000001'::uuid,
        '2026-07-17T14:30:00Z'::timestamptz
      )
    `);
    const teacherRow = teacherFreshness.rows[0];
    if (
      teacherRow?.freshness_state !== "stale_retained" ||
      teacherRow?.latest_outcome !== "unavailable" ||
      teacherRow?.sanitized_payload?.learners?.length !== 1 ||
      Object.hasOwn(teacherRow?.sanitized_payload ?? {}, "email")
    ) {
      throw new Error(
        `Invalid teacher freshness: ${JSON.stringify(teacherFreshness.rows)}`
      );
    }

    const hodFreshness = await database.query(`
      select projection_audience, freshness_state, latest_outcome, sanitized_payload
      from public.list_authorized_moodle_enrollment_group_freshness(
        '40000000-0000-4000-8000-000000000004'::uuid,
        '50000000-0000-4000-8000-000000000004'::uuid,
        'ba000000-0000-4000-8000-000000000001'::uuid,
        'b6000000-0000-4000-8000-000000000001'::uuid,
        '2026-07-17T14:30:00Z'::timestamptz
      )
    `);
    const hodRow = hodFreshness.rows[0];
    if (
      hodRow?.projection_audience !== "aggregate" ||
      hodRow?.freshness_state !== "stale_retained" ||
      hodRow?.latest_outcome !== "reconciliation" ||
      Object.hasOwn(hodRow?.sanitized_payload ?? {}, "learners") ||
      hodRow?.sanitized_payload?.learnerCount !== 1
    ) {
      throw new Error(
        `Invalid HOD freshness: ${JSON.stringify(hodFreshness.rows)}`
      );
    }

    try {
      await database.query(`
        select * from public.resolve_moodle_enrollment_group_context(
          '40000000-0000-4000-8000-000000000001'::uuid,
          '50000000-0000-4000-8000-000000000001'::uuid,
          'b6000000-0000-4000-8000-000000000001'::uuid
        )
      `);
      throw new Error("Student context unexpectedly succeeded");
    } catch (error) {
      if (!denied(error)) throw error;
    }
  } finally {
    await database.exec("reset role");
  }
  console.log(
    JSON.stringify({ label: "service-semantics", ok: true, calls: 4 })
  );
}

async function assertRollback(database) {
  const table = await database.query(`
    select pg_catalog.to_regclass('public.moodle_enrollment_group_observations') as name
  `);
  const functions = await database.query(`
    select pg_catalog.count(*)::integer as count
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where (namespace.nspname = 'public' and procedure.proname in (
      'resolve_moodle_enrollment_group_context',
      'record_moodle_enrollment_group_observation',
      'list_authorized_moodle_enrollment_group_freshness'
    )) or (namespace.nspname = 'nile_private'
      and procedure.proname = 'moodle_enrollment_group_payload_is_safe')
  `);
  const evidence = await database.query(`
    select
      (select pg_catalog.count(*)::integer from public.external_records
       where id = 'c1000000-0000-4000-8000-000000000001') as mappings,
      (select pg_catalog.count(*)::integer from public.sync_runs
       where entity_type = 'enrollment_groups_projection') as runs
  `);
  if (
    table.rows[0]?.name !== null ||
    functions.rows[0]?.count !== 0 ||
    evidence.rows[0]?.mappings !== 1 ||
    evidence.rows[0]?.runs !== 5
  ) {
    throw new Error(
      `Rollback mismatch: ${JSON.stringify({ table: table.rows, functions: functions.rows, evidence: evidence.rows })}`
    );
  }
  console.log(
    JSON.stringify({
      label: "rollback-clean",
      ok: true,
      durableEvidenceRetained: true,
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

  let browserDenials = 0;
  let serviceCalls = 0;
  await run(database, "phase6f-forward-1", sql.migration);
  await run(database, "phase6f-seed-1", sql.seed);
  await run(database, "phase6f-assertions-1", sql.assertions);
  browserDenials += await assertRuntimeDenials(database);
  await assertServiceSemantics(database);
  serviceCalls += 4;

  await run(database, "phase6f-rollback", sql.rollback);
  await assertRollback(database);

  await run(database, "phase6f-forward-2", sql.migration);
  await run(database, "phase6f-seed-2", sql.seed);
  await run(database, "phase6f-assertions-2", sql.assertions);
  browserDenials += await assertRuntimeDenials(database);
  await assertServiceSemantics(database);
  serviceCalls += 4;

  console.log(
    JSON.stringify({
      ok: true,
      engine: version.rows[0]?.version ?? "PGlite PostgreSQL",
      package: "phase6f-moodle-enrollment-group-observation",
      manualOnly: true,
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
