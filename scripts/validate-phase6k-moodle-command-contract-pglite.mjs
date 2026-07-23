import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

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
  migration: read("supabase/manual/027_phase6k_moodle_command_contract.sql"),
  assertions: read(
    "supabase/manual/227_phase6k_moodle_command_contract_assertions.sql"
  ),
  rollback: read(
    "supabase/manual/927_phase6k_moodle_command_contract_rollback.sql"
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

function isDenied(error) {
  return (
    error?.code === "42501" || /permission denied|42501/i.test(String(error))
  );
}

async function expectDenied(database, role, statement, label) {
  await database.exec(`set role ${role}`);
  try {
    await database.query(statement);
    throw new Error(`${label} unexpectedly succeeded as ${role}`);
  } catch (error) {
    if (!isDenied(error)) throw error;
  } finally {
    await database.exec("reset role");
  }
}

async function expectFailure(database, statement, pattern, label) {
  try {
    await database.exec(statement);
    throw new Error(`${label} unexpectedly succeeded`);
  } catch (error) {
    try {
      await database.exec("rollback");
    } catch {
      // The transaction may already have rolled back.
    }
    if (!pattern.test(String(error))) throw error;
  }
}

async function assertRoleDenials(database) {
  let count = 0;
  for (const role of ["anon", "authenticated", "service_role"]) {
    for (const table of [
      "moodle_plugin_manifests",
      "moodle_command_requests",
      "moodle_command_attempts",
    ]) {
      await expectDenied(
        database,
        role,
        `select * from public.${table}`,
        `Direct ${table} read`
      );
      count += 1;
    }
  }
  console.log(
    JSON.stringify({ label: "runtime-role-denials", ok: true, count })
  );
  return count;
}

const operationsJson = JSON.stringify(manifest.operations).replaceAll(
  "'",
  "''"
);
const launchesJson = JSON.stringify(manifest.nativeLaunchKinds).replaceAll(
  "'",
  "''"
);

async function insertVerifiedManifest(database) {
  await database.exec(`
    insert into public.moodle_plugin_manifests (
      id, connection_id, component, plugin_version, protocol_version,
      operations, native_launch_kinds, manifest_hash, status, verified_at
    ) values (
      'd6300000-0000-4000-8000-000000000001',
      'ba000000-0000-4000-8000-000000000001',
      'local_nilelearn', '0.1.0-contract', '1.0',
      '${operationsJson}'::jsonb, '${launchesJson}'::jsonb,
      public.digest('phase6k-local-nilelearn-v1', 'sha256'),
      'verified', '2026-07-23T01:00:00Z'
    );
  `);
}

async function insertValidLifecycle(database) {
  await database.exec(`
    insert into public.auth_sessions (
      id, token_hash, user_id, active_role_grant_id, provider,
      created_at, expires_at
    ) values (
      'd6000000-0000-4000-8000-000000000001',
      public.digest('phase6k-session', 'sha256'),
      '40000000-0000-4000-8000-000000000002',
      '50000000-0000-4000-8000-000000000002',
      'demo', '2026-07-23T01:00:00Z', '2026-07-24T01:00:00Z'
    );

    begin;
    insert into public.command_executions (
      id, idempotency_key, actor_user_id, actor_role_grant_id, session_id,
      command_type, target_type, target_id, request_hash, requires_outbox,
      status, started_at
    ) values (
      'd6100000-0000-4000-8000-000000000001', 'phase6k.page.synthetic.001',
      '40000000-0000-4000-8000-000000000002',
      '50000000-0000-4000-8000-000000000002',
      'd6000000-0000-4000-8000-000000000001',
      'moodle.command.enqueue', 'moodle_command',
      'd6400000-0000-4000-8000-000000000001',
      decode(repeat('41', 32), 'hex'), true, 'started', '2026-07-23T01:01:00Z'
    );
    insert into public.audit_logs (
      command_id, actor_user_id, actor_role_grant_id, session_id,
      action, entity_type, entity_id, metadata, occurred_at, retention_until
    ) values (
      'd6100000-0000-4000-8000-000000000001',
      '40000000-0000-4000-8000-000000000002',
      '50000000-0000-4000-8000-000000000002',
      'd6000000-0000-4000-8000-000000000001',
      'moodle.command.queued', 'moodle_command',
      'd6400000-0000-4000-8000-000000000001',
      '{"operation":"page.upsert","protocolVersion":"1.0"}'::jsonb,
      '2026-07-23T01:01:00Z', '2027-07-24T01:01:00Z'
    );
    insert into public.outbox_events (
      id, command_id, event_type, aggregate_type, aggregate_id, payload,
      idempotency_key, status, available_at, created_at, updated_at
    ) values (
      'd6200000-0000-4000-8000-000000000001',
      'd6100000-0000-4000-8000-000000000001',
      'moodle.command.requested', 'moodle_command',
      'd6400000-0000-4000-8000-000000000001',
      '{"moodleCommandRequestId":"d6400000-0000-4000-8000-000000000001","protocolVersion":"1.0","operation":"page.upsert","connectionId":"ba000000-0000-4000-8000-000000000001","actorMappingId":"bf000000-0000-4000-8000-000000000002","targetContextId":"b6000000-0000-4000-8000-000000000001","expectedProviderVersion":"2026071601","payloadHash":"4141414141414141414141414141414141414141414141414141414141414141"}'::jsonb,
      'phase6k.page.synthetic.001:provider', 'pending',
      '2026-07-23T01:01:00Z', '2026-07-23T01:01:00Z', '2026-07-23T01:01:00Z'
    );
    insert into public.moodle_command_requests (
      id, command_id, outbox_event_id, connection_id, plugin_manifest_id,
      actor_mapping_id, target_mapping_id, target_context_id, operation,
      request_hash, expected_provider_version, status, created_at, updated_at
    ) values (
      'd6400000-0000-4000-8000-000000000001',
      'd6100000-0000-4000-8000-000000000001',
      'd6200000-0000-4000-8000-000000000001',
      'ba000000-0000-4000-8000-000000000001',
      'd6300000-0000-4000-8000-000000000001',
      'bf000000-0000-4000-8000-000000000002',
      'bb000000-0000-4000-8000-000000000001',
      'b6000000-0000-4000-8000-000000000001',
      'page.upsert', decode(repeat('41', 32), 'hex'), '2026071601',
      'queued', '2026-07-23T01:01:00Z', '2026-07-23T01:01:00Z'
    );
    update public.command_executions
    set status = 'succeeded', completed_at = '2026-07-23T01:01:01Z'
    where id = 'd6100000-0000-4000-8000-000000000001';
    commit;
  `);

  const result = await database.query(`
    select request.status, request.operation, command.status as command_status,
           event.status as outbox_status, audit.action
    from public.moodle_command_requests as request
    join public.command_executions as command on command.id = request.command_id
    join public.outbox_events as event on event.id = request.outbox_event_id
    join public.audit_logs as audit on audit.command_id = command.id
    where request.id = 'd6400000-0000-4000-8000-000000000001'
  `);
  const row = result.rows[0];
  if (
    result.rows.length !== 1 ||
    row?.status !== "queued" ||
    row?.operation !== "page.upsert" ||
    row?.command_status !== "succeeded" ||
    row?.outbox_status !== "pending" ||
    row?.action !== "moodle.command.queued"
  ) {
    throw new Error(
      `Valid command lifecycle mismatch: ${JSON.stringify(result.rows)}`
    );
  }
}

async function assertLifecycleGuards(database) {
  await database.exec(`
    insert into public.moodle_command_attempts (
      command_request_id, attempt_number, worker_id, outcome,
      provider_request_id, started_at, finished_at
    ) values (
      'd6400000-0000-4000-8000-000000000001', 1,
      'phase6k-worker-01', 'unknown', 'provider-request-1',
      '2026-07-23T01:02:00Z', '2026-07-23T01:02:10Z'
    );
    insert into public.reconciliation_cases (
      id, connection_id, entity_type, internal_id, reason, status, created_at, updated_at
    ) values (
      'd6500000-0000-4000-8000-000000000001',
      'ba000000-0000-4000-8000-000000000001', 'moodle_command',
      'd6400000-0000-4000-8000-000000000001',
      'unknown_provider_outcome', 'open',
      '2026-07-23T01:02:11Z', '2026-07-23T01:02:11Z'
    );
    update public.moodle_command_requests
    set status = 'reconciliation_required',
        reconciliation_case_id = 'd6500000-0000-4000-8000-000000000001'
    where id = 'd6400000-0000-4000-8000-000000000001';
  `);

  await expectFailure(
    database,
    `begin; update public.moodle_command_attempts set outcome = 'failed'
     where command_request_id = 'd6400000-0000-4000-8000-000000000001'; commit;`,
    /immutable/i,
    "Attempt evidence mutation"
  );
  await expectFailure(
    database,
    `begin; update public.moodle_command_requests set status = 'queued'
     where id = 'd6400000-0000-4000-8000-000000000001'; commit;`,
    /Invalid Moodle command transition/i,
    "Terminal request replay"
  );
  await expectFailure(
    database,
    `begin;
     insert into public.command_executions (
       id, idempotency_key, actor_user_id, actor_role_grant_id, session_id,
       command_type, target_type, target_id, request_hash, requires_outbox
     ) values (
       'd6100000-0000-4000-8000-000000000002', 'phase6k.orphan.synthetic.001',
       '40000000-0000-4000-8000-000000000002',
       '50000000-0000-4000-8000-000000000002',
       'd6000000-0000-4000-8000-000000000001',
       'moodle.command.enqueue', 'moodle_command',
       'd6400000-0000-4000-8000-000000000002',
       decode(repeat('42', 32), 'hex'), true
     );
     insert into public.audit_logs (
       command_id, actor_user_id, actor_role_grant_id, session_id,
       action, entity_type, entity_id, retention_until
     ) values (
       'd6100000-0000-4000-8000-000000000002',
       '40000000-0000-4000-8000-000000000002',
       '50000000-0000-4000-8000-000000000002',
       'd6000000-0000-4000-8000-000000000001',
       'moodle.command.queued', 'moodle_command',
       'd6400000-0000-4000-8000-000000000002',
       pg_catalog.now() + interval '366 days'
     );
     insert into public.outbox_events (
       id, command_id, event_type, aggregate_type, aggregate_id, payload,
       idempotency_key
     ) values (
       'd6200000-0000-4000-8000-000000000002',
       'd6100000-0000-4000-8000-000000000002',
       'moodle.command.requested', 'moodle_command',
       'd6400000-0000-4000-8000-000000000002',
       '{"moodleCommandRequestId":"d6400000-0000-4000-8000-000000000002"}'::jsonb,
       'phase6k.orphan.synthetic.001:provider'
     );
     update public.command_executions set status = 'succeeded', completed_at = pg_catalog.now()
     where id = 'd6100000-0000-4000-8000-000000000002';
     commit;`,
    /requires a durable command request/i,
    "Orphan Moodle outbox"
  );

  const state = await database.query(`
    select request.status, attempt.outcome, reconciliation.status as reconciliation_status
    from public.moodle_command_requests as request
    join public.moodle_command_attempts as attempt on attempt.command_request_id = request.id
    join public.reconciliation_cases as reconciliation
      on reconciliation.id = request.reconciliation_case_id
    where request.id = 'd6400000-0000-4000-8000-000000000001'
  `);
  if (
    state.rows[0]?.status !== "reconciliation_required" ||
    state.rows[0]?.outcome !== "unknown" ||
    state.rows[0]?.reconciliation_status !== "open"
  ) {
    throw new Error(
      `Unknown-outcome lifecycle mismatch: ${JSON.stringify(state.rows)}`
    );
  }
}

async function assertRollback(database) {
  const tables = await database.query(`
    select pg_catalog.count(*)::integer as count
    from pg_catalog.pg_class as class
    join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
    where namespace.nspname = 'public'
      and class.relname in (
        'moodle_plugin_manifests', 'moodle_command_requests', 'moodle_command_attempts'
      )
  `);
  const evidence = await database.query(`
    select
      (select pg_catalog.count(*)::integer from public.command_executions
       where id = 'd6100000-0000-4000-8000-000000000001') as commands,
      (select pg_catalog.count(*)::integer from public.audit_logs
       where command_id = 'd6100000-0000-4000-8000-000000000001') as audits,
      (select pg_catalog.count(*)::integer from public.outbox_events
       where command_id = 'd6100000-0000-4000-8000-000000000001') as outbox;
  `);
  if (
    tables.rows[0]?.count !== 0 ||
    evidence.rows[0]?.commands !== 1 ||
    evidence.rows[0]?.audits !== 1 ||
    evidence.rows[0]?.outbox !== 1
  ) {
    throw new Error(
      `Rollback mismatch: ${JSON.stringify({ tables: tables.rows, evidence: evidence.rows })}`
    );
  }
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

  for (const [label, statement] of [
    ["phase1-foundation", sql.phase1],
    ["phase1-fake-seed", sql.phase1Seed],
    ["phase6a-foundation", sql.phase6a],
    ["phase6a-fake-seed", sql.phase6aSeed],
    ["phase6e-foundation", sql.phase6e],
    ["phase6e-fake-seed", sql.phase6eSeed],
    ["phase6k-forward-1", sql.migration],
    ["phase6k-assertions-1", sql.assertions],
  ]) {
    await run(database, label, statement);
  }
  await insertVerifiedManifest(database);
  await insertValidLifecycle(database);
  await assertLifecycleGuards(database);
  const firstDenials = await assertRoleDenials(database);

  await run(database, "phase6k-rollback", sql.rollback);
  await assertRollback(database);

  await run(database, "phase6k-forward-2", sql.migration);
  await run(database, "phase6k-assertions-2", sql.assertions);
  const secondDenials = await assertRoleDenials(database);

  console.log(
    JSON.stringify({
      ok: true,
      engine: version.rows[0]?.version ?? "PGlite PostgreSQL",
      package: "phase6k-moodle-command-contract",
      manualOnly: true,
      runtimeActivated: false,
      forwardApplications: 2,
      assertionPasses: 2,
      rollbackReapplyPasses: 1,
      roleDenials: firstDenials + secondDenials,
      durableCommandLifecycles: 1,
      unknownOutcomeReconciliations: 1,
      remoteProviderCalls: 0,
    })
  );
} finally {
  await database.close();
}
