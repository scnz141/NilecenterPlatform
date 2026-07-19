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
const forward = readFileSync(
  path.join(root, "supabase/manual/016_transactional_email_delivery.sql"),
  "utf8"
);
const assertions = readFileSync(
  path.join(
    root,
    "supabase/manual/216_transactional_email_delivery_assertions.sql"
  ),
  "utf8"
);
const rollback = readFileSync(
  path.join(
    root,
    "supabase/manual/916_transactional_email_delivery_rollback.sql"
  ),
  "utf8"
);

const ids = {
  authUser: "10000000-0000-4000-8000-000000000001",
  branch: "15000000-0000-4000-8000-000000000001",
  appUser: "20000000-0000-4000-8000-000000000001",
  grant: "30000000-0000-4000-8000-000000000001",
  branchScope: "35000000-0000-4000-8000-000000000001",
  session: "40000000-0000-4000-8000-000000000001",
  command1: "50000000-0000-4000-8000-000000000001",
  outbox1: "60000000-0000-4000-8000-000000000001",
  command2: "50000000-0000-4000-8000-000000000002",
  outbox2: "60000000-0000-4000-8000-000000000002",
};

async function expectDenied(label, operation) {
  try {
    await operation();
  } catch {
    console.log(JSON.stringify({ label, ok: true }));
    return;
  }
  throw new Error(`${label} unexpectedly succeeded.`);
}

async function insertEmailOutbox(database, commandId, outboxId, suffix) {
  await database.exec(`
    insert into public.command_executions (
      id, idempotency_key, actor_user_id, actor_role_grant_id, session_id,
      command_type, target_type, target_id, request_hash, requires_outbox
    ) values (
      '${commandId}', 'email-origin-${suffix}', '${ids.appUser}', '${ids.grant}',
      '${ids.session}', 'test.email.origin', 'User', '${ids.appUser}',
      digest(convert_to('email-origin-${suffix}', 'UTF8'), 'sha256'), true
    );
    insert into public.audit_logs (
      command_id, actor_user_id, actor_role_grant_id, session_id,
      action, entity_type, entity_id, after_state
    ) values (
      '${commandId}', '${ids.appUser}', '${ids.grant}', '${ids.session}',
      'email.delivery.requested', 'User', '${ids.appUser}',
      '{"delivery":"queued"}'::jsonb
    );
    insert into public.outbox_events (
      id, command_id, event_type, aggregate_type, aggregate_id, payload,
      idempotency_key
    ) values (
      '${outboxId}', '${commandId}', 'email.delivery.requested', 'User',
      '${ids.appUser}',
      '{"schemaVersion":1,"recipientUserId":"${ids.appUser}","templateKey":"enrollment_activated","templateVersion":1,"locale":"en","variables":{"displayName":"Test Student","courseName":"Arabic Level 3","portalUrl":"https://learn.example.test/app/student/courses"}}'::jsonb,
      'email.delivery:${outboxId}'
    );
    update public.command_executions
    set status = 'succeeded', completed_at = now()
    where id = '${commandId}';
  `);
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
    insert into auth.users (id) values ('${ids.authUser}');
  `);
  await database.exec(phase1);
  await database.exec(forward);
  await database.exec(assertions);

  await database.exec(`
    insert into public.branches (id, code, name)
    values ('${ids.branch}', 'email-test', 'Email Test Branch');
    insert into public.app_users (
      id, auth_user_id, full_name, email, status, activated_at
    ) values (
      '${ids.appUser}', '${ids.authUser}', 'Email Test Student',
      'student@example.test', 'active', now()
    );
    insert into public.role_grants (
      id, user_id, role, status, granted_by, granted_reason
    ) values (
      '${ids.grant}', '${ids.appUser}', 'student', 'active',
      '${ids.appUser}', 'Transactional email test fixture'
    );
    insert into public.role_grant_branch_scopes (
      id, role_grant_id, branch_id, granted_by
    ) values (
      '${ids.branchScope}', '${ids.grant}', '${ids.branch}', '${ids.appUser}'
    );
    insert into public.auth_sessions (
      id, token_hash, user_id, active_role_grant_id, provider, expires_at
    ) values (
      '${ids.session}', digest(convert_to('email-test-session', 'UTF8'), 'sha256'),
      '${ids.appUser}', '${ids.grant}', 'supabase', now() + interval '1 hour'
    );
  `);

  await insertEmailOutbox(database, ids.command1, ids.outbox1, "one");
  const firstClaim = await database.query(
    "select * from public.nile_claim_email_delivery($1, $2)",
    ["email-worker-1", 90]
  );
  if (
    firstClaim.rows.length !== 1 ||
    firstClaim.rows[0]?.attempt_number !== 1
  ) {
    throw new Error("First email lease was not created exactly once.");
  }
  const deliveryId = firstClaim.rows[0].delivery_id;

  await database.query(
    "select public.nile_complete_email_delivery($1,$2,$3,$4,$5,$6,$7)",
    [
      deliveryId,
      "email-worker-1",
      "retry",
      null,
      null,
      "rate_limit_exceeded",
      30,
    ]
  );
  await database.exec(`
    update public.outbox_events set available_at = now() - interval '1 second'
    where id = '${ids.outbox1}';
  `);
  const replayClaim = await database.query(
    "select * from public.nile_claim_email_delivery($1, $2)",
    ["email-worker-2", 90]
  );
  if (
    replayClaim.rows[0]?.delivery_id !== deliveryId ||
    replayClaim.rows[0]?.attempt_number !== 2
  ) {
    throw new Error("Email retry did not preserve delivery identity.");
  }

  await database.query(
    "select public.nile_complete_email_delivery($1,$2,$3,$4,$5,$6,$7)",
    [
      deliveryId,
      "email-worker-2",
      "sent",
      "email_provider_123",
      "a".repeat(64),
      null,
      null,
    ]
  );
  const deliveredAt = new Date(Date.now() - 120_000).toISOString();
  const bouncedAt = new Date(Date.now() - 60_000).toISOString();
  const delivered = await database.query(
    "select * from public.nile_record_email_webhook($1,$2,$3,$4,$5)",
    [
      "webhook-delivered-1",
      "email_provider_123",
      "email.delivered",
      deliveredAt,
      "b".repeat(64),
    ]
  );
  if (!delivered.rows[0]?.delivery_updated || delivered.rows[0]?.duplicate) {
    throw new Error("Delivered webhook did not update the delivery.");
  }
  const duplicate = await database.query(
    "select * from public.nile_record_email_webhook($1,$2,$3,$4,$5)",
    [
      "webhook-delivered-1",
      "email_provider_123",
      "email.delivered",
      deliveredAt,
      "b".repeat(64),
    ]
  );
  if (!duplicate.rows[0]?.duplicate) {
    throw new Error("Webhook replay was not deduplicated.");
  }

  const bounced = await database.query(
    "select * from public.nile_record_email_webhook($1,$2,$3,$4,$5)",
    [
      "webhook-bounced-1",
      "email_provider_123",
      "email.bounced",
      bouncedAt,
      "c".repeat(64),
    ]
  );
  if (!bounced.rows[0]?.suppression_created) {
    throw new Error("Bounce did not create recipient suppression.");
  }

  await insertEmailOutbox(database, ids.command2, ids.outbox2, "two");
  const suppressedClaim = await database.query(
    "select * from public.nile_claim_email_delivery($1, $2)",
    ["email-worker-3", 90]
  );
  if (suppressedClaim.rows.length !== 0) {
    throw new Error(
      "Suppressed recipient was returned to the provider worker."
    );
  }
  const suppressionState = await database.query(`
    select delivery.status as delivery_status, event.status as event_status
    from public.email_deliveries as delivery
    join public.outbox_events as event on event.id = delivery.outbox_event_id
    where delivery.outbox_event_id = '${ids.outbox2}'
  `);
  if (
    suppressionState.rows[0]?.delivery_status !== "suppressed" ||
    suppressionState.rows[0]?.event_status !== "succeeded"
  ) {
    throw new Error(
      "Suppression was not persisted as a completed outbox decision."
    );
  }

  await expectDenied("authenticated-table-denial", async () => {
    await database.exec(
      "set role authenticated; select * from public.email_deliveries; reset role;"
    );
  });
  await database.exec("reset role;");
  await expectDenied("authenticated-rpc-denial", async () => {
    await database.exec(
      "set role authenticated; select * from public.nile_claim_email_delivery('email-worker-browser', 90); reset role;"
    );
  });
  await database.exec("reset role;");

  await database.exec(rollback);
  const removed = await database.query(`
    select
      to_regclass('public.email_deliveries') is null as deliveries_removed,
      to_regprocedure('public.nile_claim_email_delivery(text,integer)') is null as rpc_removed
  `);
  if (!removed.rows[0]?.deliveries_removed || !removed.rows[0]?.rpc_removed) {
    throw new Error("Transactional email rollback was incomplete.");
  }
  await database.exec(forward);
  await database.exec(assertions);

  console.log(
    JSON.stringify({
      ok: true,
      package: "transactional-email-delivery",
      forwardApplications: 2,
      assertionPasses: 2,
      rollbackPasses: 1,
      retryReplay: true,
      webhookReplay: true,
      suppression: true,
      browserDenials: 2,
      remoteContacted: false,
    })
  );
} finally {
  await database.close();
}
