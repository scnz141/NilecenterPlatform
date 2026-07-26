import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
  phase6k: read("supabase/manual/027_phase6k_moodle_command_contract.sql"),
  phase6l: read("supabase/manual/028_phase6l_moodle_command_runtime.sql"),
  assertions: read(
    "supabase/manual/228_phase6l_moodle_command_runtime_assertions.sql"
  ),
  rollback: read(
    "supabase/manual/928_phase6l_moodle_command_runtime_rollback.sql"
  ),
};
const manifest = JSON.parse(
  read("docs/integrations/local_nilelearn-capability-manifest.v1.json")
);

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

async function expectDenied(database, role, statement) {
  await database.exec(`set role ${role}`);
  try {
    await database.query(statement);
    throw new Error(`${statement} unexpectedly succeeded as ${role}`);
  } catch (error) {
    if (!/permission denied|42501/i.test(String(error))) throw error;
  } finally {
    await database.exec("reset role");
  }
}

const database = new PGlite({
  extensions: { btree_gist, citext, pgcrypto },
});

try {
  await database.waitReady;
  await database.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key);
  `);
  await run(database, "phase1", sql.phase1);
  await run(database, "phase1-seed", sql.phase1Seed);
  await run(database, "phase6a", sql.phase6a);
  await run(database, "phase6a-seed", sql.phase6aSeed);
  await run(database, "phase6e", sql.phase6e);
  await run(database, "phase6e-seed", sql.phase6eSeed);
  await run(database, "phase6k", sql.phase6k);

  const operations = JSON.stringify(manifest.operations).replaceAll("'", "''");
  const launches = JSON.stringify(manifest.nativeLaunchKinds).replaceAll(
    "'",
    "''"
  );
  await database.exec(`
    update public.integration_connections
    set status = 'disabled', mode = 'disabled'
    where id = 'ba000000-0000-4000-8000-000000000001';
    insert into public.moodle_plugin_manifests (
      id, connection_id, component, plugin_version, protocol_version,
      operations, native_launch_kinds, manifest_hash, status, verified_at
    ) values (
      'd6300000-0000-4000-8000-000000000001',
      'ba000000-0000-4000-8000-000000000001',
      'local_nilelearn', '${manifest.pluginVersion}', '1.0',
      '${operations}'::jsonb, '${launches}'::jsonb,
      public.digest('phase6l-manifest', 'sha256'),
      'verified', pg_catalog.now()
    );
  `);
  await run(database, "phase6l-apply", sql.phase6l);
  await run(database, "phase6l-assertions", sql.assertions);

  for (const role of ["anon", "authenticated"]) {
    for (const table of [
      "moodle_command_requests",
      "moodle_command_attempts",
      "moodle_native_launch_tickets",
    ]) {
      await expectDenied(database, role, `select * from public.${table}`);
    }
    await expectDenied(
      database,
      role,
      "select * from public.nile_claim_moodle_command('browser-worker', 30)"
    );
  }
  log("browser-denials", Date.now(), { count: 8 });

  await run(database, "phase6l-rollback", sql.rollback);
  const absent = await database.query(
    "select pg_catalog.to_regclass('public.moodle_native_launch_tickets') as value"
  );
  if (absent.rows[0]?.value !== null) {
    throw new Error("Phase 6L rollback left launch tickets behind.");
  }
  await run(database, "phase6l-reapply", sql.phase6l);
  await run(database, "phase6l-reassert", sql.assertions);
  log("phase6l-runtime-complete", Date.now(), {
    applyCount: 2,
    assertionCount: 2,
    rollbackCount: 1,
  });
} finally {
  await database.close();
}
