import crypto from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const phase1Files = readdirSync(path.join(root, "supabase/migrations")).filter(
  file => file.endsWith("_phase1_identity_scope_session_audit_mapping.sql")
);
if (phase1Files.length !== 1) {
  throw new Error("Expected exactly one promoted Phase 1 migration.");
}
const phase1 = readFileSync(
  path.join(root, "supabase/migrations", phase1Files[0]),
  "utf8"
);
const read = name =>
  readFileSync(path.join(root, "supabase/manual", name), "utf8");
const email = read("016_transactional_email_delivery.sql");
const forward = read("017_account_invitation_lifecycle.sql");
const assertions = read("217_account_invitation_lifecycle_assertions.sql");
const rollback = read("917_account_invitation_lifecycle_rollback.sql");

const ids = {
  adminAuth: "11000000-0000-4000-8000-000000000001",
  invitedAuth: "11000000-0000-4000-8000-000000000002",
  branch: "12000000-0000-4000-8000-000000000001",
  department: "13000000-0000-4000-8000-000000000001",
  adminUser: "14000000-0000-4000-8000-000000000001",
  adminGrant: "15000000-0000-4000-8000-000000000001",
  session: "16000000-0000-4000-8000-000000000001",
  invitation: "17000000-0000-4000-8000-000000000001",
};

const sha256 = value =>
  crypto.createHash("sha256").update(value, "utf8").digest("hex");

async function expectDenied(label, operation) {
  try {
    await operation();
  } catch {
    console.log(JSON.stringify({ label, ok: true }));
    return;
  }
  throw new Error(`${label} unexpectedly succeeded.`);
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
    insert into auth.users (id) values ('${ids.adminAuth}'), ('${ids.invitedAuth}');
  `);
  await database.exec(phase1);
  await database.exec(`
    create table public.student_profiles (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null unique references public.app_users(id) on delete restrict,
      home_branch_id uuid references public.branches(id) on delete restrict,
      status text not null default 'active' check (status in ('active','paused','archived')),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);
  await database.exec(email);
  await database.exec(forward);
  await database.exec(assertions);

  await database.exec(`
    insert into public.branches (id, legacy_id, code, name)
    values ('${ids.branch}', 'br_online', 'online', 'Online');
    insert into public.departments (id, legacy_id, code, name)
    values ('${ids.department}', 'dep_arabic', 'arabic', 'Arabic');
    insert into public.department_branches (department_id, branch_id)
    values ('${ids.department}', '${ids.branch}');
    insert into public.app_users (
      id, auth_user_id, full_name, email, status, activated_at
    ) values (
      '${ids.adminUser}', '${ids.adminAuth}', 'Admin Test',
      'admin@example.test', 'active', now()
    );
    insert into public.role_grants (
      id, user_id, role, status, granted_by, granted_reason
    ) values (
      '${ids.adminGrant}', '${ids.adminUser}', 'superadmin', 'active',
      '${ids.adminUser}', 'Invitation runtime fixture'
    );
    insert into public.auth_sessions (
      id, token_hash, user_id, active_role_grant_id, provider, expires_at
    ) values (
      '${ids.session}', decode('${sha256("normalized-admin-session")}', 'hex'),
      '${ids.adminUser}', '${ids.adminGrant}', 'supabase', now() + interval '1 hour'
    );
  `);

  const created = await database.query(
    `select * from public.nile_create_user_invitation_with_evidence(
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18
    )`,
    [
      sha256("normalized-admin-session"),
      ids.invitation,
      ids.invitedAuth,
      "Teacher Invite",
      "teacher@example.test",
      "+20 100 000 0000",
      "teacher",
      "br_online",
      "dep_arabic",
      "Teacher",
      "available",
      ["Arabic grammar"],
      ["Level 3"],
      "en",
      `v1.${"a".repeat(80)}`,
      new Date(Date.now() + 24 * 60 * 60 * 1_000).toISOString(),
      "user-invite:runtime-proof",
      sha256("teacher-invitation-request"),
    ]
  );
  if (created.rows.length !== 1 || created.rows[0]?.replayed !== false) {
    throw new Error("Invitation command was not created exactly once.");
  }

  const state = await database.query(`
    select app_user.status as user_status, role_grant.status as grant_status,
      invitation.status as invitation_status,
      (select count(*) from public.audit_logs where action = 'user.invited') as audits,
      (select count(*) from public.outbox_events where event_type = 'email.delivery.requested') as outbox_rows
    from public.user_invitations as invitation
    join public.app_users as app_user on app_user.id = invitation.user_id
    join public.role_grants as role_grant on role_grant.id = invitation.role_grant_id
    where invitation.id = '${ids.invitation}'
  `);
  const pending = state.rows[0];
  if (
    pending?.user_status !== "invited" ||
    pending?.grant_status !== "pending" ||
    pending?.invitation_status !== "queued" ||
    Number(pending?.audits) !== 1 ||
    Number(pending?.outbox_rows) !== 1
  ) {
    throw new Error(
      "Invitation did not atomically persist pending authority and evidence."
    );
  }

  const claim = await database.query(
    "select * from public.nile_claim_email_delivery_v2($1,$2)",
    ["invitation-worker", 90]
  );
  if (
    claim.rows.length !== 1 ||
    claim.rows[0]?.template_key !== "account_invitation" ||
    claim.rows[0]?.recipient_email !== "teacher@example.test"
  ) {
    throw new Error("Pending invitation email was not claimable exactly once.");
  }

  const accepted = await database.query(
    "select * from public.nile_accept_user_invitation($1,$2)",
    [ids.invitation, ids.invitedAuth]
  );
  if (accepted.rows[0]?.role !== "teacher") {
    throw new Error("Verified invitation did not activate the teacher role.");
  }
  const active = await database.query(`
    select app_user.status as user_status, role_grant.status as grant_status,
      invitation.status as invitation_status,
      (select count(*) from public.identity_lifecycle_events
        where invitation_id = '${ids.invitation}') as identity_events
    from public.user_invitations as invitation
    join public.app_users as app_user on app_user.id = invitation.user_id
    join public.role_grants as role_grant on role_grant.id = invitation.role_grant_id
    where invitation.id = '${ids.invitation}'
  `);
  if (
    active.rows[0]?.user_status !== "active" ||
    active.rows[0]?.grant_status !== "active" ||
    active.rows[0]?.invitation_status !== "accepted" ||
    Number(active.rows[0]?.identity_events) !== 1
  ) {
    throw new Error("Verified activation did not persist authoritative state.");
  }

  await expectDenied("authenticated-invitation-table-denial", async () => {
    await database.exec(
      "set role authenticated; select * from public.user_invitations; reset role;"
    );
  });
  await database.exec("reset role;");
  await expectDenied("authenticated-invitation-rpc-denial", async () => {
    await database.exec(
      `set role authenticated; select * from public.nile_accept_user_invitation('${ids.invitation}','${ids.invitedAuth}'); reset role;`
    );
  });
  await database.exec("reset role;");

  await database.exec(`
    delete from public.email_deliveries
    where outbox_event_id = '${created.rows[0].outbox_event_id}';
  `);
  await database.exec(rollback);
  const removed = await database.query(`
    select to_regclass('public.user_invitations') is null as table_removed,
      to_regprocedure('public.nile_accept_user_invitation(uuid,uuid)') is null as rpc_removed
  `);
  if (!removed.rows[0]?.table_removed || !removed.rows[0]?.rpc_removed) {
    throw new Error("Account invitation rollback was incomplete.");
  }
  await database.exec(forward);
  await database.exec(assertions);

  console.log(
    JSON.stringify({
      ok: true,
      package: "account-invitation-lifecycle",
      forwardApplications: 2,
      assertionPasses: 2,
      rollbackPasses: 1,
      atomicEvidence: true,
      verifiedActivation: true,
      browserDenials: 2,
      remoteContacted: false,
    })
  );
} finally {
  await database.close();
}
