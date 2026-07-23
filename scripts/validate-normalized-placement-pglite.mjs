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
const readManual = file =>
  readFileSync(path.join(root, "supabase/manual", file), "utf8");
const phase1 = readFileSync(
  path.join(root, "supabase/migrations", phase1File),
  "utf8"
);
const intake = readManual("020_normalized_admissions_intake_foundation.sql");
const applications = readManual(
  "021_normalized_application_conversion_foundation.sql"
);
const forward = readManual("022_normalized_placement_foundation.sql");
const rollback = readManual("922_normalized_placement_foundation_rollback.sql");
const hash = value =>
  crypto.createHash("sha256").update(value, "utf8").digest("hex");

const ids = {
  registrarAuth: "41000000-0000-4000-8000-000000000001",
  adminAuth: "41000000-0000-4000-8000-000000000002",
  cairo: "42000000-0000-4000-8000-000000000001",
  alex: "42000000-0000-4000-8000-000000000002",
  registrar: "44000000-0000-4000-8000-000000000001",
  admin: "44000000-0000-4000-8000-000000000002",
  registrarGrant: "45000000-0000-4000-8000-000000000001",
  adminGrant: "45000000-0000-4000-8000-000000000002",
  registrarSession: "46000000-0000-4000-8000-000000000001",
  adminSession: "46000000-0000-4000-8000-000000000002",
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
  await database.exec(applications);
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
       '${ids.admin}', 'Placement runtime fixture'),
      ('${ids.adminGrant}', '${ids.admin}', 'superadmin', 'active',
       '${ids.admin}', 'Placement runtime fixture');
    insert into public.role_grant_branch_scopes (
      role_grant_id, branch_id, granted_by
    ) values ('${ids.registrarGrant}', '${ids.cairo}', '${ids.admin}');
    insert into public.auth_sessions (
      id, token_hash, user_id, active_role_grant_id, provider, expires_at
    ) values
      ('${ids.registrarSession}', decode('${hash("placement-registrar-session")}', 'hex'),
       '${ids.registrar}', '${ids.registrarGrant}', 'supabase', now() + interval '1 hour'),
      ('${ids.adminSession}', decode('${hash("placement-admin-session")}', 'hex'),
       '${ids.admin}', '${ids.adminGrant}', 'supabase', now() + interval '1 hour');
  `);

  const bookingArguments = [
    hash("placement-registrar-session"),
    null,
    ids.cairo,
    "Placement Learner",
    "placement@example.test",
    "+201000000021",
    "Arabic Language",
    "2026-08-05",
    "Placement pending",
    "placement-source-runtime-0001",
    "placement.create:runtime-proof-0001",
    hash("placement-create-request-0001"),
  ];
  const booking = await database.query(
    "select * from public.nile_create_placement_booking_with_evidence($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
    bookingArguments
  );
  const bookingReplay = await database.query(
    "select * from public.nile_create_placement_booking_with_evidence($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
    bookingArguments
  );
  if (
    booking.rows[0]?.booking_version !== 1 ||
    booking.rows[0]?.lead_version !== 1 ||
    booking.rows[0]?.replayed ||
    !bookingReplay.rows[0]?.replayed ||
    bookingReplay.rows[0]?.booking_id !== booking.rows[0]?.booking_id
  ) {
    throw new Error("Placement booking replay evidence is incomplete.");
  }

  await expectRejected("registrar cross-branch placement", () =>
    database.query(
      "select * from public.nile_create_placement_booking_with_evidence($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
      [
        hash("placement-registrar-session"),
        null,
        ids.alex,
        "Outside Learner",
        "outside@example.test",
        "+201000000022",
        "Arabic",
        "2026-08-06",
        "Placement pending",
        "placement-source-runtime-0002",
        "placement.create:cross-branch-0002",
        hash("placement-cross-branch-request-0002"),
      ]
    )
  );

  await expectRejected("stale placement result", () =>
    database.query(
      "select * from public.nile_record_placement_result_with_evidence($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        hash("placement-registrar-session"),
        booking.rows[0]?.booking_id,
        "Arabic Level 2",
        86,
        "Ready for the recommended class.",
        2,
        "placement.result:stale-version-0001",
        hash("placement-result-stale-request-0001"),
      ]
    )
  );

  const resultArguments = [
    hash("placement-registrar-session"),
    booking.rows[0]?.booking_id,
    "Arabic Level 2",
    86,
    "Ready for the recommended class.",
    1,
    "placement.result:runtime-proof-0001",
    hash("placement-result-request-0001"),
  ];
  const result = await database.query(
    "select * from public.nile_record_placement_result_with_evidence($1,$2,$3,$4,$5,$6,$7,$8)",
    resultArguments
  );
  const resultReplay = await database.query(
    "select * from public.nile_record_placement_result_with_evidence($1,$2,$3,$4,$5,$6,$7,$8)",
    resultArguments
  );
  if (
    result.rows[0]?.booking_version !== 2 ||
    result.rows[0]?.lead_version !== 2 ||
    result.rows[0]?.result_version !== 1 ||
    result.rows[0]?.replayed ||
    !resultReplay.rows[0]?.replayed ||
    resultReplay.rows[0]?.result_id !== result.rows[0]?.result_id
  ) {
    throw new Error("Placement result replay evidence is incomplete.");
  }

  const registrarWorkspace = await database.query(
    "select * from public.nile_read_admissions_placement_workspace($1)",
    [hash("placement-registrar-session")]
  );
  const adminWorkspace = await database.query(
    "select * from public.nile_read_admissions_placement_workspace($1)",
    [hash("placement-admin-session")]
  );
  if (
    registrarWorkspace.rows[0]?.workspace?.leads?.length !== 1 ||
    registrarWorkspace.rows[0]?.workspace?.placementTests?.[0]?.status !==
      "completed" ||
    registrarWorkspace.rows[0]?.workspace?.placementResults?.length !== 1 ||
    adminWorkspace.rows[0]?.workspace?.placementResults?.length !== 1
  ) {
    throw new Error("Placement lifecycle readback is incomplete.");
  }

  const evidence = await database.query(`
    select
      (select count(*) from public.command_executions
       where command_type in ('placement.create', 'placement.result.record')
         and status = 'succeeded') as commands,
      (select count(*) from public.audit_logs
       where action in ('placement.created', 'placement.result_recorded')) as audits,
      (select count(*) from public.admission_placement_bookings) as bookings,
      (select count(*) from public.admission_placement_results) as results
  `);
  if (
    Number(evidence.rows[0]?.commands) !== 2 ||
    Number(evidence.rows[0]?.audits) !== 2 ||
    Number(evidence.rows[0]?.bookings) !== 1 ||
    Number(evidence.rows[0]?.results) !== 1
  ) {
    throw new Error("Placement commands were not atomically evidenced.");
  }

  await expectRejected("browser role placement read", () =>
    database.exec(`
      set role anon;
      select * from public.nile_read_admissions_placement_workspace('${hash("placement-registrar-session")}');
    `)
  );
  await database.exec("reset role;");

  await database.exec(rollback);
  const rolledBack = await database.query(`
    select
      to_regclass('public.admission_placement_bookings') is null as bookings_removed,
      to_regclass('public.admission_placement_results') is null as results_removed
  `);
  if (
    !rolledBack.rows[0]?.bookings_removed ||
    !rolledBack.rows[0]?.results_removed
  ) {
    throw new Error("Placement rollback did not remove owned objects.");
  }
  await database.exec(forward);

  console.log(
    JSON.stringify({
      ok: true,
      bookings: 1,
      results: 1,
      intakeLineage: "created",
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
