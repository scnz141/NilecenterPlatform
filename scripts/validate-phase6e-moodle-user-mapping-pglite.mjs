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
const phase6eMigration = read(
  "supabase/manual/008_phase6e_moodle_user_mapping_authority.sql"
);
const phase6eSeed = read(
  "supabase/manual/108_phase6e_moodle_user_mapping_authority_fake_seed.sql"
);
const phase6eAssertions = read(
  "supabase/manual/208_phase6e_moodle_user_mapping_authority_assertions.sql"
);
const phase6eRollback = read(
  "supabase/manual/908_phase6e_moodle_user_mapping_authority_rollback.sql"
);

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
    if (
      error?.code !== "42501" &&
      !/permission denied|42501/i.test(String(error))
    ) {
      throw error;
    }
  } finally {
    await database.exec("reset role");
  }
}

async function assertBrowserDenials(database) {
  for (const role of ["anon", "authenticated"]) {
    await expectDenied(
      database,
      role,
      `select * from public.resolve_moodle_user_projection_authority(
        '40000000-0000-4000-8000-000000000001'::uuid,
        '50000000-0000-4000-8000-000000000001'::uuid
      )`,
      "Phase 6E authority RPC"
    );
    await expectDenied(
      database,
      role,
      `select * from public.list_moodle_user_mappings_for_connection(
        'ba000000-0000-4000-8000-000000000001'::uuid,
        array['40000000-0000-4000-8000-000000000001'::uuid]
      )`,
      "Phase 6E mapping RPC"
    );
  }
  console.log(
    JSON.stringify({ label: "browser-role-denials", ok: true, denials: 4 })
  );
}

async function assertServiceSemantics(database) {
  await database.exec("set role service_role");
  try {
    const teacher = await database.query(`
      select active_role, authorized_user_ids, observed_at
      from public.resolve_moodle_user_projection_authority(
        '40000000-0000-4000-8000-000000000002'::uuid,
        '50000000-0000-4000-8000-000000000002'::uuid
      )
    `);
    const authority = teacher.rows[0];
    if (
      teacher.rows.length !== 1 ||
      authority?.active_role !== "teacher" ||
      JSON.stringify(authority?.authorized_user_ids) !==
        JSON.stringify([
          "40000000-0000-4000-8000-000000000001",
          "40000000-0000-4000-8000-000000000002",
        ]) ||
      !authority?.observed_at
    ) {
      throw new Error(
        `Teacher authority mismatch: ${JSON.stringify(teacher.rows)}`
      );
    }

    const mappings = await database.query(`
      select internal_user_id, external_record_id, external_user_id, sync_state,
             last_seen_at, last_synced_at, source_updated_at, last_error
      from public.list_moodle_user_mappings_for_connection(
        'ba000000-0000-4000-8000-000000000001'::uuid,
        array[
          '40000000-0000-4000-8000-000000000001'::uuid,
          '40000000-0000-4000-8000-000000000002'::uuid
        ]
      )
    `);
    if (
      mappings.rows.length !== 2 ||
      mappings.rows[0]?.external_user_id !== "9101" ||
      mappings.rows[1]?.external_user_id !== "9102" ||
      Object.hasOwn(mappings.rows[0] ?? {}, "metadata") ||
      Object.hasOwn(mappings.rows[0] ?? {}, "source_hash")
    ) {
      throw new Error(
        `Exact mapping DTO mismatch: ${JSON.stringify(mappings.rows)}`
      );
    }

    for (const [label, sql] of [
      [
        "registrar authority",
        `select * from public.resolve_moodle_user_projection_authority(
          '40000000-0000-4000-8000-000000000003'::uuid,
          '50000000-0000-4000-8000-000000000003'::uuid
        )`,
      ],
      [
        "non-Moodle connection",
        `select * from public.list_moodle_user_mappings_for_connection(
          'a0000000-0000-4000-8000-000000000001'::uuid,
          array['40000000-0000-4000-8000-000000000001'::uuid]
        )`,
      ],
    ]) {
      try {
        await database.query(sql);
        throw new Error(`${label} unexpectedly succeeded`);
      } catch (error) {
        if (
          error?.code !== "42501" &&
          !/42501|insufficient privilege/i.test(String(error))
        ) {
          throw error;
        }
      }
    }
  } finally {
    await database.exec("reset role");
  }
  console.log(
    JSON.stringify({ label: "service-role-semantics", ok: true, rpcCalls: 4 })
  );
}

async function assertRollback(database) {
  const functions = await database.query(`
    select pg_catalog.count(*)::integer as count
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname in (
        'resolve_moodle_user_projection_authority',
        'list_moodle_user_mappings_for_connection'
      )
  `);
  const fixtures = await database.query(`
    select pg_catalog.count(*)::integer as count
    from public.external_records
    where id::text like 'bf000000-0000-4000-8000-00000000000%'
  `);
  if (functions.rows[0]?.count !== 0 || fixtures.rows[0]?.count !== 7) {
    throw new Error(
      `Rollback left functions=${functions.rows[0]?.count}, fixtures=${fixtures.rows[0]?.count}`
    );
  }
  console.log(
    JSON.stringify({
      label: "rollback-clean",
      ok: true,
      durableFixtureRowsRetained: 7,
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

  await runSql(database, "phase1-foundation", phase1Migration);
  await runSql(database, "phase1-fake-seed", phase1Seed);
  await runSql(database, "phase6a-foundation", phase6aMigration);
  await runSql(database, "phase6a-fake-seed", phase6aSeed);

  await runSql(database, "phase6e-forward-1", phase6eMigration);
  await runSql(database, "phase6e-seed-1", phase6eSeed);
  await runSql(database, "phase6e-assertions-1", phase6eAssertions);
  await assertBrowserDenials(database);
  await assertServiceSemantics(database);

  await runSql(database, "phase6e-rollback", phase6eRollback);
  await assertRollback(database);

  await runSql(database, "phase6e-forward-2", phase6eMigration);
  await runSql(database, "phase6e-seed-2", phase6eSeed);
  await runSql(database, "phase6e-assertions-2", phase6eAssertions);
  await assertBrowserDenials(database);
  await assertServiceSemantics(database);

  console.log(
    JSON.stringify({
      ok: true,
      engine: version.rows[0]?.version ?? "PGlite PostgreSQL",
      package: "phase6e-moodle-user-mapping-authority",
      manualOnly: true,
      forwardApplications: 2,
      assertionPasses: 2,
      rollbackReapplyPasses: 1,
      browserRoleDenials: 8,
      serviceRoleRpcCalls: 8,
    })
  );
} finally {
  await database.close();
}
