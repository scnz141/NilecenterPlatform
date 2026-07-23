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
const read = file =>
  readFileSync(path.join(root, "supabase/manual", file), "utf8");
const phase1 = readFileSync(
  path.join(root, "supabase/migrations", phase1File),
  "utf8"
);
const forward = read("019_normalized_profile_support_foundation.sql");
const rollback = read("919_normalized_profile_support_foundation_rollback.sql");
const hash = value =>
  crypto.createHash("sha256").update(value, "utf8").digest("hex");

const ids = {
  auth: "11000000-0000-4000-8000-000000000001",
  branch: "12000000-0000-4000-8000-000000000001",
  user: "14000000-0000-4000-8000-000000000001",
  grant: "15000000-0000-4000-8000-000000000001",
  session: "16000000-0000-4000-8000-000000000001",
  student: "17000000-0000-4000-8000-000000000001",
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
    insert into auth.users (id) values ('${ids.auth}');
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
  await database.exec(forward);
  await database.exec(forward);

  await database.exec(`
    insert into public.branches (id, legacy_id, code, name)
    values ('${ids.branch}', 'br_online', 'ONLINE', 'Online');
    insert into public.app_users (
      id, auth_user_id, full_name, email, status, activated_at
    ) values (
      '${ids.user}', '${ids.auth}', 'Profile Student',
      'profile.student@example.test', 'active', now()
    );
    insert into public.role_grants (
      id, user_id, role, status, granted_by, granted_reason
    ) values (
      '${ids.grant}', '${ids.user}', 'student', 'active',
      '${ids.user}', 'Profile support runtime fixture'
    );
    insert into public.role_grant_branch_scopes (
      role_grant_id, branch_id, granted_by
    ) values ('${ids.grant}', '${ids.branch}', '${ids.user}');
    insert into public.student_profiles (
      id, user_id, home_branch_id, status, country, age_group
    ) values (
      '${ids.student}', '${ids.user}', '${ids.branch}', 'active', 'Egypt', 'Adult'
    );
    insert into public.auth_sessions (
      id, token_hash, user_id, active_role_grant_id, provider, expires_at
    ) values (
      '${ids.session}', decode('${hash("profile-support-session")}', 'hex'),
      '${ids.user}', '${ids.grant}', 'supabase', now() + interval '1 hour'
    );
  `);

  const readResult = await database.query(
    "select * from public.nile_read_self_workspace($1)",
    [hash("profile-support-session")]
  );
  if (
    readResult.rows[0]?.workspace?.user?.id !== ids.user ||
    readResult.rows[0]?.workspace?.student?.id !== ids.student
  ) {
    throw new Error("Normalized self workspace did not resolve its own identity.");
  }

  const profileArguments = [
    hash("profile-support-session"),
    "Updated Profile Student",
    "+201000000001",
    "Arabic",
    "Africa/Cairo",
    {
      messages: true,
      schedule: true,
      academic: true,
      billing: false,
      system: false,
    },
    "Egypt",
    "",
    "",
    null,
    null,
    1,
    "profile.update:runtime-proof",
    hash("profile-update-request"),
  ];
  const profile = await database.query(
    "select * from public.nile_update_self_profile_with_evidence($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)",
    profileArguments
  );
  if (profile.rows[0]?.profile_version !== 2 || profile.rows[0]?.replayed) {
    throw new Error("Profile command did not create versioned evidence.");
  }
  const replay = await database.query(
    "select * from public.nile_update_self_profile_with_evidence($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)",
    profileArguments
  );
  if (!replay.rows[0]?.replayed || replay.rows[0]?.profile_version !== 2) {
    throw new Error("Profile replay was not deterministic.");
  }
  await expectRejected("stale profile version", () =>
    database.query(
      "select * from public.nile_update_self_profile_with_evidence($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)",
      [
        ...profileArguments.slice(0, 11),
        1,
        "profile.update:stale-proof",
        hash("stale-profile-update"),
      ]
    )
  );

  const ticketArguments = [
    hash("profile-support-session"),
    "Learning support",
    "Please help me open the assigned lesson material.",
    "learning",
    "normal",
    "support-runtime-proof",
    "support.ticket.create:runtime-proof",
    hash("support-ticket-request"),
  ];
  const ticket = await database.query(
    "select * from public.nile_create_support_ticket_with_evidence($1,$2,$3,$4,$5,$6,$7,$8)",
    ticketArguments
  );
  const ticketReplay = await database.query(
    "select * from public.nile_create_support_ticket_with_evidence($1,$2,$3,$4,$5,$6,$7,$8)",
    ticketArguments
  );
  if (ticket.rows[0]?.ticket_version !== 1 || !ticketReplay.rows[0]?.replayed) {
    throw new Error("Support ticket lifecycle evidence is incomplete.");
  }

  const evidence = await database.query(`
    select
      (select count(*) from public.command_executions where status = 'succeeded') as commands,
      (select count(*) from public.audit_logs where actor_user_id = '${ids.user}') as audits,
      (select count(*) from public.support_tickets where requester_user_id = '${ids.user}') as tickets
  `);
  if (
    Number(evidence.rows[0]?.commands) !== 2 ||
    Number(evidence.rows[0]?.audits) !== 2 ||
    Number(evidence.rows[0]?.tickets) !== 1
  ) {
    throw new Error("Profile/support commands were not atomically evidenced.");
  }

  await expectRejected("browser role workspace read", () =>
    database.exec(`
      set role anon;
      select * from public.nile_read_self_workspace('${hash("profile-support-session")}');
    `)
  );
  await database.exec("reset role;");

  await database.exec(rollback);
  const rolledBack = await database.query(`
    select
      to_regclass('public.user_preferences') is null as preferences_removed,
      to_regclass('public.support_tickets') is null as tickets_removed
  `);
  if (
    !rolledBack.rows[0]?.preferences_removed ||
    !rolledBack.rows[0]?.tickets_removed
  ) {
    throw new Error("Profile/support rollback did not remove owned objects.");
  }
  await database.exec(forward);

  console.log(
    JSON.stringify({
      ok: true,
      profileVersion: 2,
      supportTickets: 1,
      replay: "deterministic",
      browserRoleAccess: "denied",
      rollback: "passed",
      reapply: "passed",
    })
  );
} finally {
  await database.close();
}
