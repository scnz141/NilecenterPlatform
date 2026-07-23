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
const readMigration = file =>
  readFileSync(path.join(root, "supabase/manual", file), "utf8");
const phase1 = readFileSync(
  path.join(root, "supabase/migrations", phase1File),
  "utf8"
);
const intake = readMigration("020_normalized_admissions_intake_foundation.sql");
const forward = readMigration(
  "021_normalized_application_conversion_foundation.sql"
);
const rollback = readMigration(
  "921_normalized_application_conversion_foundation_rollback.sql"
);
const hash = value =>
  crypto.createHash("sha256").update(value, "utf8").digest("hex");

const ids = {
  registrarAuth: "31000000-0000-4000-8000-000000000001",
  adminAuth: "31000000-0000-4000-8000-000000000002",
  cairo: "32000000-0000-4000-8000-000000000001",
  alex: "32000000-0000-4000-8000-000000000002",
  registrar: "34000000-0000-4000-8000-000000000001",
  admin: "34000000-0000-4000-8000-000000000002",
  registrarGrant: "35000000-0000-4000-8000-000000000001",
  adminGrant: "35000000-0000-4000-8000-000000000002",
  registrarSession: "36000000-0000-4000-8000-000000000001",
  adminSession: "36000000-0000-4000-8000-000000000002",
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
  await database.exec(intake);
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
       '${ids.admin}', 'Application runtime fixture'),
      ('${ids.adminGrant}', '${ids.admin}', 'superadmin', 'active',
       '${ids.admin}', 'Application runtime fixture');
    insert into public.role_grant_branch_scopes (
      role_grant_id, branch_id, granted_by
    ) values ('${ids.registrarGrant}', '${ids.cairo}', '${ids.admin}');
    insert into public.auth_sessions (
      id, token_hash, user_id, active_role_grant_id, provider, expires_at
    ) values
      ('${ids.registrarSession}', decode('${hash("application-registrar-session")}', 'hex'),
       '${ids.registrar}', '${ids.registrarGrant}', 'supabase', now() + interval '1 hour'),
      ('${ids.adminSession}', decode('${hash("application-admin-session")}', 'hex'),
       '${ids.admin}', '${ids.adminGrant}', 'supabase', now() + interval '1 hour');
  `);

  const leadArguments = [
    hash("application-registrar-session"),
    ids.cairo,
    "Lead To Convert",
    "lead@example.test",
    "+201000000011",
    "Egypt",
    "Arabic Language",
    "manual",
    "Conversion runtime proof.",
    "application-lead-source-0001",
    "lead.create:application-proof-0001",
    hash("application-lead-request-0001"),
  ];
  const createdLead = await database.query(
    "select * from public.nile_create_admission_lead_with_evidence($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
    leadArguments
  );

  const applicationArguments = [
    hash("application-registrar-session"),
    ids.cairo,
    "Direct Applicant",
    "direct@example.test",
    "+201000000012",
    "Egypt",
    "Quran Tajweed",
    "Evenings",
    "manual",
    "Direct application runtime proof.",
    "direct-application-source-0001",
    "application.create:runtime-proof-0001",
    hash("direct-application-request-0001"),
  ];
  const direct = await database.query(
    "select * from public.nile_create_admission_application_with_evidence($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",
    applicationArguments
  );
  const directReplay = await database.query(
    "select * from public.nile_create_admission_application_with_evidence($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",
    applicationArguments
  );
  if (
    direct.rows[0]?.application_version !== 1 ||
    direct.rows[0]?.lead_version !== 1 ||
    direct.rows[0]?.replayed ||
    !directReplay.rows[0]?.replayed ||
    directReplay.rows[0]?.application_id !== direct.rows[0]?.application_id
  ) {
    throw new Error("Direct application replay evidence is incomplete.");
  }

  await expectRejected("registrar cross-branch application", () =>
    database.query(
      "select * from public.nile_create_admission_application_with_evidence($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",
      [
        hash("application-registrar-session"),
        ids.alex,
        "Out Of Scope",
        "outside@example.test",
        "+201000000013",
        "Egypt",
        "Arabic",
        "Morning",
        "manual",
        "Cross branch denial.",
        "cross-branch-application-0001",
        "application.create:cross-branch-0001",
        hash("cross-branch-application-request-0001"),
      ]
    )
  );

  await expectRejected("stale lead conversion", () =>
    database.query(
      "select * from public.nile_convert_admission_lead_with_evidence($1,$2,$3,$4,$5,$6)",
      [
        hash("application-registrar-session"),
        createdLead.rows[0]?.lead_id,
        ids.cairo,
        2,
        "lead.convert:stale-version-0001",
        hash("lead-convert-stale-request-0001"),
      ]
    )
  );

  const conversionArguments = [
    hash("application-registrar-session"),
    createdLead.rows[0]?.lead_id,
    ids.cairo,
    1,
    "lead.convert:runtime-proof-0001",
    hash("lead-convert-request-0001"),
  ];
  const conversion = await database.query(
    "select * from public.nile_convert_admission_lead_with_evidence($1,$2,$3,$4,$5,$6)",
    conversionArguments
  );
  const conversionReplay = await database.query(
    "select * from public.nile_convert_admission_lead_with_evidence($1,$2,$3,$4,$5,$6)",
    conversionArguments
  );
  if (
    conversion.rows[0]?.lead_version !== 2 ||
    conversion.rows[0]?.application_version !== 1 ||
    conversion.rows[0]?.replayed ||
    !conversionReplay.rows[0]?.replayed ||
    conversionReplay.rows[0]?.application_id !==
      conversion.rows[0]?.application_id
  ) {
    throw new Error("Lead conversion replay evidence is incomplete.");
  }

  const registrarWorkspace = await database.query(
    "select * from public.nile_read_admissions_lifecycle_workspace($1)",
    [hash("application-registrar-session")]
  );
  const adminWorkspace = await database.query(
    "select * from public.nile_read_admissions_lifecycle_workspace($1)",
    [hash("application-admin-session")]
  );
  if (
    registrarWorkspace.rows[0]?.workspace?.leads?.length !== 2 ||
    registrarWorkspace.rows[0]?.workspace?.applications?.length !== 2 ||
    adminWorkspace.rows[0]?.workspace?.applications?.length !== 2
  ) {
    throw new Error("Application workspace readback is incomplete.");
  }

  const evidence = await database.query(`
    select
      (select count(*) from public.command_executions
       where command_type in ('application.create', 'lead.convert')
         and status = 'succeeded') as commands,
      (select count(*) from public.audit_logs
       where action in ('application.created', 'lead.converted')) as audits,
      (select count(*) from public.admission_applications) as applications
  `);
  if (
    Number(evidence.rows[0]?.commands) !== 2 ||
    Number(evidence.rows[0]?.audits) !== 2 ||
    Number(evidence.rows[0]?.applications) !== 2
  ) {
    throw new Error("Application commands were not atomically evidenced.");
  }

  await expectRejected("browser role application read", () =>
    database.exec(`
      set role anon;
      select * from public.nile_read_admissions_lifecycle_workspace('${hash("application-registrar-session")}');
    `)
  );
  await database.exec("reset role;");

  await database.exec(rollback);
  const rolledBack = await database.query(
    "select to_regclass('public.admission_applications') is null as applications_removed"
  );
  if (!rolledBack.rows[0]?.applications_removed) {
    throw new Error("Application rollback did not remove owned objects.");
  }
  await database.exec(forward);

  console.log(
    JSON.stringify({
      ok: true,
      applications: 2,
      replay: "deterministic",
      versionConflict: "denied",
      branchScope: "denied",
      browserRoleAccess: "denied",
      rollback: "passed",
      reapply: "passed",
    })
  );
} finally {
  await database.close();
}
