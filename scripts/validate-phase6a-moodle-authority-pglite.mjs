import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const phase1Migration = readFileSync(
  path.join(
    root,
    "supabase/migrations/20260710053837_phase1_identity_scope_session_audit_mapping.sql"
  ),
  "utf8"
);
const phase1Seed = readFileSync(path.join(root, "supabase/seed.sql"), "utf8");
const phase6aMigration = readFileSync(
  path.join(
    root,
    "supabase/manual/006_phase6a_moodle_projection_authority.sql"
  ),
  "utf8"
);
const phase6aSeed = readFileSync(
  path.join(
    root,
    "supabase/manual/106_phase6a_moodle_projection_authority_fake_seed.sql"
  ),
  "utf8"
);
const phase6aAssertions = readFileSync(
  path.join(
    root,
    "supabase/manual/206_phase6a_moodle_projection_authority_assertions.sql"
  ),
  "utf8"
);
const phase6aRollback = readFileSync(
  path.join(
    root,
    "supabase/manual/906_phase6a_moodle_projection_authority_rollback.sql"
  ),
  "utf8"
);

const phase6aTables = [
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

async function expectRoleDenied(database, role, sql, label) {
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

async function assertBrowserDenials(database) {
  for (const role of ["anon", "authenticated"]) {
    await expectRoleDenied(
      database,
      role,
      "select * from public.course_templates",
      "Direct Phase 6A table read"
    );
    await expectRoleDenied(
      database,
      role,
      `select * from public.resolve_moodle_course_projection_authority(
        '40000000-0000-4000-8000-000000000001'::uuid,
        '50000000-0000-4000-8000-000000000001'::uuid
      )`,
      "Phase 6A authority RPC"
    );
    await expectRoleDenied(
      database,
      role,
      "select * from public.list_moodle_course_mappings()",
      "Phase 6A mapping RPC"
    );
  }
  console.log(
    JSON.stringify({ label: "browser-role-denials", ok: true, denials: 6 })
  );
}

async function assertServiceRoleRpcs(database) {
  await database.exec("set role service_role");
  try {
    const authorityResult = await database.query(`
      select active_role, authorized_course_ids, observed_at
      from public.resolve_moodle_course_projection_authority(
        '40000000-0000-4000-8000-000000000001'::uuid,
        '50000000-0000-4000-8000-000000000001'::uuid
      )
    `);
    if (
      authorityResult.rows.length !== 1 ||
      authorityResult.rows[0]?.active_role !== "student" ||
      authorityResult.rows[0]?.authorized_course_ids?.length !== 1 ||
      !authorityResult.rows[0]?.observed_at
    ) {
      throw new Error(
        `service_role authority RPC returned an invalid snapshot: ${JSON.stringify(authorityResult.rows)}`
      );
    }

    const mappingResult = await database.query(`
      select internal_course_id, external_course_id, sync_state,
             last_seen_at, last_synced_at, source_updated_at, last_error
      from public.list_moodle_course_mappings(
        array['b3000000-0000-4000-8000-000000000001'::uuid]
      )
    `);
    if (
      mappingResult.rows.length !== 1 ||
      mappingResult.rows[0]?.external_course_id !== "4201" ||
      mappingResult.rows[0]?.sync_state !== "synced"
    ) {
      throw new Error(
        `service_role mapping RPC returned an invalid row: ${JSON.stringify(mappingResult.rows)}`
      );
    }
  } finally {
    await database.exec("reset role");
  }
  console.log(
    JSON.stringify({ label: "service-role-rpcs", ok: true, rpcCalls: 2 })
  );
}

async function assertRollbackClean(database) {
  const placeholders = phase6aTables
    .map((_, index) => `$${index + 1}`)
    .join(", ");
  const tableResult = await database.query(
    `
      select count(*)::integer as count
      from pg_catalog.pg_tables
      where schemaname = 'public'
        and tablename in (${placeholders})
    `,
    phase6aTables
  );
  const functionResult = await database.query(`
    select count(*)::integer as count
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname in (
        'resolve_moodle_course_projection_authority',
        'list_moodle_course_mappings'
      )
  `);
  const tableCount = tableResult.rows[0]?.count ?? 0;
  const functionCount = functionResult.rows[0]?.count ?? 0;
  if (tableCount !== 0 || functionCount !== 0) {
    throw new Error(
      `Phase 6A rollback left ${tableCount} table(s) and ${functionCount} RPC(s)`
    );
  }
  console.log(
    JSON.stringify({
      label: "rollback-clean",
      ok: true,
      tableCount,
      functionCount,
    })
  );
}

const database = new PGlite({
  extensions: { btree_gist, citext, pgcrypto },
});

try {
  await database.waitReady;
  const versionResult = await database.query("select version() as version");

  await database.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key);
  `);

  await runSql(database, "phase1-foundation", phase1Migration);
  await runSql(database, "phase1-fake-seed", phase1Seed);

  await runSql(database, "phase6a-forward-1", phase6aMigration);
  await runSql(database, "phase6a-seed-1", phase6aSeed);
  await runSql(database, "phase6a-assertions-1", phase6aAssertions);
  await assertBrowserDenials(database);
  await assertServiceRoleRpcs(database);

  await runSql(database, "phase6a-rollback", phase6aRollback);
  await assertRollbackClean(database);

  await runSql(database, "phase6a-forward-2", phase6aMigration);
  await runSql(database, "phase6a-seed-2", phase6aSeed);
  await runSql(database, "phase6a-assertions-2", phase6aAssertions);
  await assertBrowserDenials(database);
  await assertServiceRoleRpcs(database);

  console.log(
    JSON.stringify({
      ok: true,
      engine: versionResult.rows[0]?.version ?? "PGlite PostgreSQL",
      package: "phase6a-moodle-projection-authority",
      unapplied: true,
      forwardApplications: 2,
      assertionPasses: 2,
      rollbackReapplyPasses: 1,
      browserRoleDenials: 12,
      serviceRoleRpcCalls: 4,
    })
  );
} finally {
  await database.close();
}
