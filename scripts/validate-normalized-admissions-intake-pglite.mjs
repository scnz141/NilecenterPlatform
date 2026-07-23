import crypto from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const phase1File = readdirSync(path.join(root, "supabase/migrations")).find(
  file => file.endsWith("_phase1_identity_scope_session_audit_mapping.sql")
);
if (!phase1File) throw new Error("Phase 1 migration is missing.");
const phase1 = readFileSync(
  path.join(root, "supabase/migrations", phase1File),
  "utf8"
);
const read = file =>
  readFileSync(path.join(root, "supabase/manual", file), "utf8");
const forward = read("020_normalized_admissions_intake_foundation.sql");
const rollback = read("920_normalized_admissions_intake_foundation_rollback.sql");
const hash = value =>
  crypto.createHash("sha256").update(value, "utf8").digest("hex");

const ids = {
  registrarAuth: "21000000-0000-4000-8000-000000000001",
  adminAuth: "21000000-0000-4000-8000-000000000002",
  cairo: "22000000-0000-4000-8000-000000000001",
  alex: "22000000-0000-4000-8000-000000000002",
  registrar: "24000000-0000-4000-8000-000000000001",
  admin: "24000000-0000-4000-8000-000000000002",
  registrarGrant: "25000000-0000-4000-8000-000000000001",
  adminGrant: "25000000-0000-4000-8000-000000000002",
  registrarSession: "26000000-0000-4000-8000-000000000001",
  adminSession: "26000000-0000-4000-8000-000000000002",
};

const database = new PGlite({ extensions: { btree_gist, citext, pgcrypto } });

async function expectRejected(label, operation) {
  try {
    await operation();
  } catch {
    return;
  }
  throw new Error(`${label} unexpectedly succeeded.`);
}

try {
  await database.waitReady;
  await database.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key);
    insert into auth.users (id) values
      ('${ids.registrarAuth}'), ('${ids.adminAuth}');
  `);
  await database.exec(phase1);
  await database.exec(forward);
  await database.exec(forward);

  await database.exec(`
    insert into public.branches (id, legacy_id, code, name) values
      ('${ids.cairo}', 'br_cairo', 'CAIRO', 'Cairo'),
      ('${ids.alex}', 'br_alex', 'ALEX', 'Alexandria');
    insert into public.app_users (
      id, auth_user_id, full_name, email, status, activated_at
    ) values
      ('${ids.registrar}', '${ids.registrarAuth}', 'Runtime Registrar',
       'registrar@example.test', 'active', now()),
      ('${ids.admin}', '${ids.adminAuth}', 'Runtime Admin',
       'admin@example.test', 'active', now());
    insert into public.role_grants (
      id, user_id, role, status, granted_by, granted_reason
    ) values
      ('${ids.registrarGrant}', '${ids.registrar}', 'registrar', 'active',
       '${ids.admin}', 'Admissions runtime fixture'),
      ('${ids.adminGrant}', '${ids.admin}', 'superadmin', 'active',
       '${ids.admin}', 'Admissions runtime fixture');
    insert into public.role_grant_branch_scopes (
      role_grant_id, branch_id, granted_by
    ) values ('${ids.registrarGrant}', '${ids.cairo}', '${ids.admin}');
    insert into public.auth_sessions (
      id, token_hash, user_id, active_role_grant_id, provider, expires_at
    ) values
      ('${ids.registrarSession}', decode('${hash("admissions-registrar-session")}', 'hex'),
       '${ids.registrar}', '${ids.registrarGrant}', 'supabase', now() + interval '1 hour'),
      ('${ids.adminSession}', decode('${hash("admissions-admin-session")}', 'hex'),
       '${ids.admin}', '${ids.adminGrant}', 'supabase', now() + interval '1 hour');
  `);

  const emptyWorkspace = await database.query(
    "select * from public.nile_read_admissions_workspace($1)",
    [hash("admissions-registrar-session")]
  );
  if (emptyWorkspace.rows[0]?.workspace?.leads?.length !== 0) {
    throw new Error("Admissions workspace did not start empty.");
  }

  const leadArguments = [
    hash("admissions-registrar-session"),
    ids.cairo,
    "Runtime Learner",
    "learner@example.test",
    "+201000000009",
    "Egypt",
    "Arabic Language",
    "manual",
    "Runtime admissions intake proof.",
    "runtime-lead-source-0001",
    "lead.create:runtime-proof-0001",
    hash("runtime-lead-request-0001"),
  ];
  const lead = await database.query(
    "select * from public.nile_create_admission_lead_with_evidence($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
    leadArguments
  );
  const replay = await database.query(
    "select * from public.nile_create_admission_lead_with_evidence($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
    leadArguments
  );
  if (
    lead.rows[0]?.branch_id !== ids.cairo ||
    lead.rows[0]?.lead_version !== 1 ||
    lead.rows[0]?.replayed ||
    !replay.rows[0]?.replayed ||
    replay.rows[0]?.lead_id !== lead.rows[0]?.lead_id
  ) {
    throw new Error("Admissions lead replay evidence is incomplete.");
  }

  await expectRejected("registrar cross-branch lead", () =>
    database.query(
      "select * from public.nile_create_admission_lead_with_evidence($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
      [
        hash("admissions-registrar-session"),
        ids.alex,
        "Out Of Scope Learner",
        "other@example.test",
        "+201000000010",
        "Egypt",
        "Arabic Language",
        "manual",
        "Cross branch denial proof.",
        "runtime-lead-source-0002",
        "lead.create:runtime-proof-0002",
        hash("runtime-lead-request-0002"),
      ]
    )
  );

  const registrarWorkspace = await database.query(
    "select * from public.nile_read_admissions_workspace($1)",
    [hash("admissions-registrar-session")]
  );
  const adminWorkspace = await database.query(
    "select * from public.nile_read_admissions_workspace($1)",
    [hash("admissions-admin-session")]
  );
  if (
    registrarWorkspace.rows[0]?.workspace?.leads?.length !== 1 ||
    adminWorkspace.rows[0]?.workspace?.leads?.length !== 1
  ) {
    throw new Error("Admissions workspace scope did not return the created lead.");
  }

  const evidence = await database.query(`
    select
      (select count(*) from public.command_executions
       where command_type = 'lead.create' and status = 'succeeded') as commands,
      (select count(*) from public.audit_logs where action = 'lead.created') as audits,
      (select count(*) from public.admission_leads) as leads
  `);
  if (
    Number(evidence.rows[0]?.commands) !== 1 ||
    Number(evidence.rows[0]?.audits) !== 1 ||
    Number(evidence.rows[0]?.leads) !== 1
  ) {
    throw new Error("Admissions lead command was not atomically evidenced.");
  }

  await expectRejected("browser role admissions read", () =>
    database.exec(`
      set role anon;
      select * from public.nile_read_admissions_workspace('${hash("admissions-registrar-session")}');
    `)
  );
  await database.exec("reset role;");

  await database.exec(rollback);
  const rolledBack = await database.query(
    "select to_regclass('public.admission_leads') is null as leads_removed"
  );
  if (!rolledBack.rows[0]?.leads_removed) {
    throw new Error("Admissions intake rollback did not remove owned objects.");
  }
  await database.exec(forward);

  console.log(
    JSON.stringify({
      ok: true,
      leads: 1,
      replay: "deterministic",
      branchScope: "denied",
      browserRoleAccess: "denied",
      rollback: "passed",
      reapply: "passed",
    })
  );
} finally {
  await database.close();
}
