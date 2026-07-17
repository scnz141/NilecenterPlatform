import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = relativePath =>
  readFileSync(path.join(root, relativePath), "utf8");
const forward = read(
  "supabase/manual/015_phase6i_pgcrypto_schema_compatibility.sql"
);
const rollback = read(
  "supabase/manual/915_phase6i_pgcrypto_schema_compatibility_rollback.sql"
);

async function inspect(database) {
  const result = await database.query(`
    select pg_catalog.json_build_object(
      'publicFunctions', (
        select pg_catalog.count(*)
        from pg_catalog.pg_proc p
        join pg_catalog.pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname = 'digest'
          and pg_catalog.obj_description(p.oid, 'pg_proc') =
            'nile-phase6i-pgcrypto-compatibility'
      ),
      'extensionFunctions', (
        select pg_catalog.count(*)
        from pg_catalog.pg_proc p
        join pg_catalog.pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'extensions' and p.proname = 'digest'
      ),
      'browserGrants', (
        select pg_catalog.count(*)
        from information_schema.routine_privileges
        where routine_schema = 'public'
          and routine_name = 'digest'
          and grantee in ('PUBLIC', 'anon', 'authenticated')
      ),
      'serviceGrants', (
        select pg_catalog.count(*)
        from information_schema.routine_privileges
        where routine_schema = 'public'
          and routine_name = 'digest'
          and grantee = 'service_role'
          and privilege_type = 'EXECUTE'
      )
    ) as contract;
  `);
  return result.rows[0]?.contract;
}

const database = new PGlite({ extensions: { pgcrypto } });

try {
  await database.waitReady;
  await database.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create extension pgcrypto;
    create schema extensions;
    alter extension pgcrypto set schema extensions;
  `);

  assert.equal(
    (await inspect(database)).publicFunctions,
    0,
    "The fixture must begin with Supabase-style extension placement."
  );

  await database.exec(forward);
  await database.exec(forward);
  const applied = await inspect(database);
  assert.equal(applied.publicFunctions, 2);
  assert.equal(applied.extensionFunctions, 2);
  assert.equal(applied.browserGrants, 0);
  assert.equal(applied.serviceGrants, 2);

  const digest = await database.query(`
    select
      pg_catalog.encode(public.digest('phase6i'::text, 'sha256'), 'hex') =
        pg_catalog.encode(extensions.digest('phase6i'::text, 'sha256'), 'hex')
        as text_matches,
      pg_catalog.encode(
        public.digest(pg_catalog.convert_to('phase6i', 'UTF8'), 'sha256'),
        'hex'
      ) = pg_catalog.encode(
        extensions.digest(pg_catalog.convert_to('phase6i', 'UTF8'), 'sha256'),
        'hex'
      ) as bytea_matches;
  `);
  assert.equal(digest.rows[0]?.text_matches, true);
  assert.equal(digest.rows[0]?.bytea_matches, true);

  await database.exec(rollback);
  const rolledBack = await inspect(database);
  assert.equal(rolledBack.publicFunctions, 0);
  assert.equal(rolledBack.extensionFunctions, 2);

  await database.exec(forward);
  const reapplied = await inspect(database);
  assert.equal(reapplied.publicFunctions, 2);
  assert.equal(reapplied.browserGrants, 0);
  assert.equal(reapplied.serviceGrants, 2);

  console.log(
    JSON.stringify({
      ok: true,
      package: "phase6i-pgcrypto-schema-compatibility",
      applications: 3,
      rollbackPasses: 1,
      browserDenials: 4,
      serviceGrants: 2,
    })
  );
} finally {
  await database.close();
}
