import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = relativePath =>
  readFileSync(path.join(root, relativePath), "utf8");
const phase1Migration = read(
  "supabase/migrations/20260710053837_phase1_identity_scope_session_audit_mapping.sql"
);
const phase1Seed = read("supabase/seed.sql");
const phase6aMigration = read(
  "supabase/manual/006_phase6a_moodle_projection_authority.sql"
);
const phase6aSeed = read(
  "supabase/manual/106_phase6a_moodle_projection_authority_fake_seed.sql"
);
const migration = read(
  "supabase/manual/007_phase6b_moodle_projection_observation.sql"
);
const seed = read(
  "supabase/manual/107_phase6b_moodle_projection_observation_fake_seed.sql"
);
const assertions = read(
  "supabase/manual/207_phase6b_moodle_projection_observation_assertions.sql"
);
const rollback = read(
  "supabase/manual/907_phase6b_moodle_projection_observation_rollback.sql"
);

const rpcNames = [
  "resolve_moodle_projection_context",
  "list_moodle_course_mappings_for_connection",
  "record_moodle_projection_observation",
  "list_authorized_moodle_projection_freshness",
  "resolve_moodle_projection_reconciliation",
];

function logStep(label, startedAt, details = {}) {
  console.log(
    JSON.stringify({
      label,
      ok: true,
      elapsedMs: Date.now() - startedAt,
      ...details,
    })
  );
}

async function runSql(database, label, sql) {
  const startedAt = Date.now();
  await database.exec(sql);
  logStep(label, startedAt);
}

async function expectDenied(database, role, sql, label) {
  await database.exec(`set role ${role}`);
  try {
    await database.query(sql);
    throw new Error(`${label} unexpectedly succeeded as ${role}`);
  } catch (error) {
    if (!/permission denied|42501/i.test(String(error))) throw error;
  } finally {
    await database.exec("reset role");
  }
}

async function assertRuntimeDenials(database) {
  let denials = 0;
  for (const role of ["anon", "authenticated", "service_role"]) {
    await expectDenied(
      database,
      role,
      "select * from public.moodle_projection_observations",
      "Direct Phase 6B observation read"
    );
    denials += 1;
  }

  for (const role of ["anon", "authenticated"]) {
    for (const sql of [
      `select * from public.resolve_moodle_projection_context(
        '40000000-0000-4000-8000-000000000006'::uuid,
        '50000000-0000-4000-8000-000000000006'::uuid
      )`,
      `select * from public.list_moodle_course_mappings_for_connection(
        'ba000000-0000-4000-8000-000000000001'::uuid,
        null
      )`,
      `select * from public.list_authorized_moodle_projection_freshness(
        '40000000-0000-4000-8000-000000000006'::uuid,
        '50000000-0000-4000-8000-000000000006'::uuid,
        'ba000000-0000-4000-8000-000000000001'::uuid,
        'course_content',
        '2026-07-16T14:30:00Z'::timestamptz,
        null
      )`,
    ]) {
      await expectDenied(database, role, sql, "Phase 6B RPC");
      denials += 1;
    }
  }

  console.log(
    JSON.stringify({ label: "runtime-role-denials", ok: true, denials })
  );
  return denials;
}

async function assertServiceRoleRpcs(database) {
  await database.exec("set role service_role");
  try {
    const context = await database.query(`
      select connection_id, active_role, authorized_course_ids, observed_at
      from public.resolve_moodle_projection_context(
        '40000000-0000-4000-8000-000000000006'::uuid,
        '50000000-0000-4000-8000-000000000006'::uuid
      )
    `);
    if (
      context.rows.length !== 1 ||
      context.rows[0]?.active_role !== "superadmin" ||
      context.rows[0]?.authorized_course_ids?.length !== 3
    ) {
      throw new Error(
        `Invalid service context: ${JSON.stringify(context.rows)}`
      );
    }

    const mappings = await database.query(`
      select internal_course_id, external_course_id
      from public.list_moodle_course_mappings_for_connection(
        'ba000000-0000-4000-8000-000000000001'::uuid,
        array['b3000000-0000-4000-8000-000000000001'::uuid]
      )
    `);
    if (
      mappings.rows.length !== 1 ||
      mappings.rows[0]?.external_course_id !== "4201"
    ) {
      throw new Error(
        `Invalid scoped mapping: ${JSON.stringify(mappings.rows)}`
      );
    }

    const freshness = await database.query(`
      select internal_course_id, projection_family, freshness_state,
             sanitized_payload, successful_sync_run_id, retain_until
      from public.list_authorized_moodle_projection_freshness(
        '40000000-0000-4000-8000-000000000006'::uuid,
        '50000000-0000-4000-8000-000000000006'::uuid,
        'ba000000-0000-4000-8000-000000000001'::uuid,
        'course_content',
        '2026-07-16T14:30:00Z'::timestamptz
      )
      order by internal_course_id
    `);
    const states = freshness.rows.map(row => row.freshness_state);
    if (
      JSON.stringify(states) !==
      JSON.stringify(["stale", "fresh", "unavailable"])
    ) {
      throw new Error(
        `Invalid deterministic freshness states: ${JSON.stringify(freshness.rows)}`
      );
    }

    const exactContent = await database.query(`
      select internal_course_id, projection_family, freshness_state
      from public.list_authorized_moodle_projection_freshness(
        '40000000-0000-4000-8000-000000000006'::uuid,
        '50000000-0000-4000-8000-000000000006'::uuid,
        'ba000000-0000-4000-8000-000000000001'::uuid,
        'course_content',
        '2026-07-16T14:30:00Z'::timestamptz,
        array['b3000000-0000-4000-8000-000000000001'::uuid]
      )
    `);
    if (
      exactContent.rows.length !== 1 ||
      exactContent.rows[0]?.internal_course_id !==
        "b3000000-0000-4000-8000-000000000001" ||
      exactContent.rows[0]?.projection_family !== "course_content"
    ) {
      throw new Error(
        `Invalid exact-course projection scope: ${JSON.stringify(exactContent.rows)}`
      );
    }

    try {
      await database.query(`
        select * from public.list_authorized_moodle_projection_freshness(
          '40000000-0000-4000-8000-000000000001'::uuid,
          '50000000-0000-4000-8000-000000000001'::uuid,
          'ba000000-0000-4000-8000-000000000001'::uuid,
          'course_content',
          '2026-07-16T14:30:00Z'::timestamptz,
          array['b3000000-0000-4000-8000-000000000002'::uuid]
        )
      `);
      throw new Error("Out-of-authority projection filter unexpectedly passed");
    } catch (error) {
      if (!/42501|outside authorized context/i.test(String(error))) throw error;
    }
    if (
      freshness.rows[0]?.projection_family !== "course_content" ||
      freshness.rows[0]?.sanitized_payload?.[0]?.sourceId !== "5101" ||
      freshness.rows[0]?.sanitized_payload?.[0]?.activities?.[0]
        ?.instanceSourceId !== "7101" ||
      freshness.rows[0]?.successful_sync_run_id !==
        "bc000000-0000-4000-8000-000000000001" ||
      freshness.rows[2]?.sanitized_payload
    ) {
      throw new Error(
        "Stale retention or unavailable payload behavior is incorrect"
      );
    }

    const catalog = await database.query(`
      select projection_family, freshness_state, sanitized_payload,
             successful_sync_run_id, retain_until
      from public.list_authorized_moodle_projection_freshness(
        '40000000-0000-4000-8000-000000000006'::uuid,
        '50000000-0000-4000-8000-000000000006'::uuid,
        'ba000000-0000-4000-8000-000000000001'::uuid,
        'course_catalog',
        '2026-07-16T14:30:00Z'::timestamptz
      )
      where internal_course_id = 'b3000000-0000-4000-8000-000000000001'::uuid
    `);
    if (
      catalog.rows[0]?.projection_family !== "course_catalog" ||
      catalog.rows[0]?.freshness_state !== "fresh" ||
      catalog.rows[0]?.sanitized_payload?.[0]?.sourceId !== "4201" ||
      catalog.rows[0]?.sanitized_payload?.[0]?.shortTitle !== "Arabic 1" ||
      catalog.rows[0]?.successful_sync_run_id !==
        "bc000000-0000-4000-8000-000000000006" ||
      catalog.rows[0]?.retain_until?.toISOString() !==
        "2026-07-17T14:20:00.000Z"
    ) {
      throw new Error(
        `Invalid catalog projection: ${JSON.stringify(catalog.rows)}`
      );
    }

    const expired = await database.query(`
      select freshness_state, sanitized_payload, projection_hash,
             successful_sync_run_id, retain_until
      from public.list_authorized_moodle_projection_freshness(
        '40000000-0000-4000-8000-000000000006'::uuid,
        '50000000-0000-4000-8000-000000000006'::uuid,
        'ba000000-0000-4000-8000-000000000001'::uuid,
        'course_content',
        '2026-07-21T12:00:01Z'::timestamptz
      )
      where internal_course_id = 'b3000000-0000-4000-8000-000000000001'::uuid
    `);
    if (
      expired.rows[0]?.freshness_state !== "unavailable" ||
      expired.rows[0]?.sanitized_payload !== null ||
      expired.rows[0]?.projection_hash !== null ||
      expired.rows[0]?.successful_sync_run_id !== null ||
      expired.rows[0]?.retain_until !== null
    ) {
      throw new Error(
        `Expired projection was retained: ${JSON.stringify(expired.rows)}`
      );
    }

    const replay = await database.query(`
      select replayed
      from public.record_moodle_projection_observation(
        'phase6b.course-content.4201.success',
        'ba000000-0000-4000-8000-000000000001'::uuid,
        'b3000000-0000-4000-8000-000000000001'::uuid,
        'bb000000-0000-4000-8000-000000000001'::uuid,
        'bc000000-0000-4000-8000-000000000001'::uuid,
        'bd000000-0000-4000-8000-000000000001'::uuid,
        'course_content',
        'available',
        '[{"sourceId":"5101","position":1,"title":"Synthetic section","visible":true,"activities":[{"sourceId":"6101","instanceSourceId":"7101","type":"page","title":"Synthetic welcome","visible":true,"completionTracking":"none"}]}]'::jsonb,
        digest(convert_to('[{"sourceId":"5101","position":1,"title":"Synthetic section","visible":true,"activities":[{"sourceId":"6101","instanceSourceId":"7101","type":"page","title":"Synthetic welcome","visible":true,"completionTracking":"none"}]}]'::jsonb::text, 'UTF8'), 'sha256'),
        '2026-07-16T12:00:00Z'::timestamptz,
        '2026-07-16T13:00:00Z'::timestamptz,
        '2026-07-20T12:00:00Z'::timestamptz
      )
    `);
    if (replay.rows[0]?.replayed !== true) {
      throw new Error(
        `Observation replay was not idempotent: ${JSON.stringify(replay.rows)}`
      );
    }
  } finally {
    await database.exec("reset role");
  }

  console.log(
    JSON.stringify({ label: "service-role-rpcs", ok: true, rpcCalls: 8 })
  );
}

async function assertRollbackClean(database) {
  const table = await database.query(`
    select pg_catalog.to_regclass('public.moodle_projection_observations') is null as absent
  `);
  const functions = await database.query(
    `
      select pg_catalog.count(*)::integer as count
      from pg_catalog.pg_proc as procedure
      join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
      where namespace.nspname in ('public', 'nile_private')
        and procedure.proname = any($1)
    `,
    [[...rpcNames, "moodle_sanitized_projection_is_safe"]]
  );
  const phase6a = await database.query(`
    select pg_catalog.to_regprocedure(
      'public.resolve_moodle_course_projection_authority(uuid,uuid)'
    ) is not null as present
  `);
  if (
    table.rows[0]?.absent !== true ||
    functions.rows[0]?.count !== 0 ||
    phase6a.rows[0]?.present !== true
  ) {
    throw new Error(
      `Phase 6B rollback was incomplete or removed Phase 6A: ${JSON.stringify({
        table: table.rows,
        functions: functions.rows,
        phase6a: phase6a.rows,
      })}`
    );
  }
  console.log(
    JSON.stringify({
      label: "phase6b-rollback-clean",
      ok: true,
      phase6aPreserved: true,
    })
  );
}

const database = new PGlite({ extensions: { btree_gist, citext, pgcrypto } });
let totalDenials = 0;

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

  await runSql(database, "phase1-foundation", phase1Migration);
  await runSql(database, "phase1-fake-seed", phase1Seed);
  await runSql(database, "phase6a-foundation", phase6aMigration);
  await runSql(database, "phase6a-fake-seed", phase6aSeed);

  await runSql(database, "phase6b-forward-1", migration);
  await runSql(database, "phase6b-seed-1", seed);
  await runSql(database, "phase6b-assertions-1", assertions);
  totalDenials += await assertRuntimeDenials(database);
  await assertServiceRoleRpcs(database);

  await runSql(database, "phase6b-rollback", rollback);
  await assertRollbackClean(database);

  await runSql(database, "phase6b-forward-2", migration);
  await runSql(database, "phase6b-seed-2", seed);
  await runSql(database, "phase6b-assertions-2", assertions);
  totalDenials += await assertRuntimeDenials(database);
  await assertServiceRoleRpcs(database);

  console.log(
    JSON.stringify({
      ok: true,
      engine: version.rows[0]?.version ?? "PGlite PostgreSQL",
      package: "phase6b-moodle-projection-observation",
      unapplied: true,
      forwardApplications: 2,
      assertionPasses: 2,
      rollbackReapplyPasses: 1,
      runtimeRoleDenials: totalDenials,
      serviceRoleRpcCalls: 16,
      remoteDatabaseContacted: false,
      dockerUsed: false,
    })
  );
} finally {
  await database.close();
}
