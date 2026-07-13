import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(root, "supabase/migrations");

function readSingleMigration(suffix) {
  const matches = readdirSync(migrationsDir).filter(file =>
    file.endsWith(suffix)
  );
  assert.equal(
    matches.length,
    1,
    `Expected one migration ending in ${suffix}, found ${matches.length}`
  );
  return readFileSync(path.join(migrationsDir, matches[0]), "utf8");
}

const sql = {
  phase1: readSingleMigration(
    "_phase1_identity_scope_session_audit_mapping.sql"
  ),
  phase2: readSingleMigration("_phase2b_atomic_session_lifecycle.sql"),
  forms: readSingleMigration("_nile_forms_foundation.sql"),
  legacy: readSingleMigration("_nile_forms_legacy_import.sql"),
  authoritySeed: readFileSync(
    path.join(root, "supabase/manual/100_fake_seed.sql"),
    "utf8"
  ),
  formsFixture: readFileSync(
    path.join(root, "supabase/manual/113_phase13f1_fake_seed.sql"),
    "utf8"
  ),
  phase13f1: readFileSync(
    path.join(
      root,
      "supabase/manual/013_phase13f1_nile_forms_normalized_persistence.sql"
    ),
    "utf8"
  ),
  assertions: readFileSync(
    path.join(root, "supabase/manual/013_phase13f1_assertions.sql"),
    "utf8"
  ),
  rollback: readFileSync(
    path.join(root, "supabase/manual/913_phase13f1_rollback.sql"),
    "utf8"
  ),
};

const tokens = {
  admin: "a".repeat(64),
  registrar: "b".repeat(64),
  student: "c".repeat(64),
  branch: "d".repeat(64),
  revokeFirst: "e".repeat(64),
  commandFirst: "f".repeat(64),
};

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

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

async function execute(database, label, statement) {
  const startedAt = Date.now();
  await database.exec(statement);
  log(label, startedAt);
}

async function withRole(database, role, callback) {
  await database.exec(`set role ${role}`);
  try {
    return await callback();
  } finally {
    await database.exec("reset role");
  }
}

async function expectSqlState(label, expectedCode, callback) {
  const startedAt = Date.now();
  let caught;
  try {
    await callback();
  } catch (error) {
    caught = error;
  }
  assert.ok(caught, `${label} should fail with SQLSTATE ${expectedCode}`);
  assert.equal(
    caught.code,
    expectedCode,
    `${label} returned ${caught.code ?? "unknown"}: ${caught.message}`
  );
  log(label, startedAt, { sqlState: expectedCode });
}

async function protectedCommand(
  database,
  { token, operation, targetId = null, input = {}, key, requestHash }
) {
  const result = await withRole(database, "nile_forms_executor", () =>
    database.query(
      `
        select *
        from public.nile_forms_command(
          $1::text,
          $2::text,
          $3::text,
          $4::jsonb,
          $5::text,
          $6::text
        )
      `,
      [
        token,
        operation,
        targetId,
        JSON.stringify(input),
        key,
        requestHash ?? hash(JSON.stringify({ operation, targetId, input })),
      ]
    )
  );
  assert.equal(result.rows.length, 1, `${operation} must return one row`);
  return result.rows[0];
}

async function protectedQuery(
  database,
  { token, operation, targetId = null, input = {} }
) {
  const result = await withRole(database, "nile_forms_executor", () =>
    database.query(
      `
        select *
        from public.nile_forms_query(
          $1::text,
          $2::text,
          $3::text,
          $4::jsonb
        )
      `,
      [token, operation, targetId, JSON.stringify(input)]
    )
  );
  assert.equal(result.rows.length, 1, `${operation} must return one row`);
  return result.rows[0].data;
}

async function publicCommand(
  database,
  {
    operation = "forms.public.submit",
    publicationId,
    versionId,
    input,
    clientSubmissionId,
    key,
    requestHmac,
    requestFingerprint,
    ipHmac = "8".repeat(64),
    ipKeyVersion = 1,
    previousIpHmac = null,
    previousIpKeyVersion = null,
    evidenceKeyVersion = ipKeyVersion,
  }
) {
  const result = await withRole(database, "nile_forms_executor", () =>
    database.query(
      `
        select *
        from public.nile_forms_public_command(
          $1::text,
          $2::uuid,
          $3::uuid,
          $4::jsonb,
          $5::text,
          $6::text,
          $7::text,
          $8::text,
          $9::text,
          $10::integer,
          $11::text,
          $12::integer,
          $13::text,
          $14::integer
        )
      `,
      [
        operation,
        publicationId,
        versionId,
        JSON.stringify(input),
        clientSubmissionId,
        key,
        requestHmac ??
          hash(
            JSON.stringify({
              operation,
              publicationId,
              versionId,
              clientSubmissionId,
              input,
            })
          ),
        requestFingerprint ??
          hash(
            JSON.stringify({
              operation,
              publicationId,
              versionId,
              clientSubmissionId,
              input,
            })
          ),
        ipHmac,
        ipKeyVersion,
        previousIpHmac,
        previousIpKeyVersion,
        "9".repeat(64),
        evidenceKeyVersion,
      ]
    )
  );
  assert.equal(result.rows.length, 1, `${operation} must return one row`);
  return result.rows[0];
}

function definitionInput(key, title, fields) {
  return {
    key,
    title,
    category: "admissions",
    schema: { fields },
    logic: [],
    translations: {
      en: { title },
      ar: { title: `AR ${title}` },
    },
    contentHash: hash(`${key}:${title}`),
  };
}

async function bootstrap(database) {
  await database.waitReady;
  await database.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create role authenticator nologin noinherit;
    create role nile_forms_inherited_role nologin;
    create role nile_forms_rogue_member nologin;
    create role nile_forms_executor login inherit createrole;
    grant nile_forms_inherited_role to nile_forms_executor;
    grant nile_forms_executor to nile_forms_rogue_member;
    create schema auth;
    create table auth.users (id uuid primary key);
  `);
  await execute(database, "phase1", sql.phase1);
  await execute(database, "phase2", sql.phase2);
  await execute(database, "forms-foundation", sql.forms);
  await execute(database, "forms-legacy", sql.legacy);
  await execute(database, "authority-seed", sql.authoritySeed);
  await execute(database, "forms-preservation-fixture", sql.formsFixture);
}

async function count(database, statement, parameters = []) {
  const result = await database.query(statement, parameters);
  return Number(result.rows[0]?.count ?? 0);
}

async function assertRuntimeContract(database) {
  const startedAt = Date.now();
  const contract = await withRole(database, "nile_forms_executor", () =>
    database.query("select * from public.nile_forms_contract_status()")
  );
  assert.deepEqual(contract.rows, [
    {
      catalogVersion: "phase13f1-v1",
      schemaEvidenceSha256:
        "aae2c27e6dc6ecaa48162ac03937e82e37d3cfd5c533e7a11e84d0d7725a8e63",
      executorRole: "nile_forms_executor",
      draftKeyVersion: 1,
      publicHmacKeyVersion: 1,
      publicHmacPreviousKeyVersion: null,
      offlineMacKeyVersion: 1,
    },
  ]);

  for (const role of ["anon", "authenticated"]) {
    await expectSqlState(`${role}-rpc-denied`, "42501", () =>
      withRole(database, role, () =>
        database.query("select * from public.nile_forms_contract_status()")
      )
    );
  }
  await expectSqlState("executor-table-dml-denied", "42501", () =>
    withRole(database, "nile_forms_executor", () =>
      database.query(
        `update public.nile_forms_repository_contract
         set catalog_version = catalog_version`
      )
    )
  );
  log("runtime-contract-and-role-denials", startedAt);
}

async function runProtectedAndPublicFlows(database) {
  const standardFields = [
    {
      id: "full_name",
      type: "short_text",
      searchable: true,
      reportable: true,
      dataClass: "standard",
    },
  ];
  const publicFields = [
    ...standardFields,
    {
      id: "national_id",
      type: "short_text",
      searchable: false,
      reportable: true,
      dataClass: "government_id",
    },
  ];

  const createPublic = await protectedCommand(database, {
    token: tokens.admin,
    operation: "forms.definitions.create",
    input: definitionInput(
      "phase13f1_public_runtime",
      "Phase 13F1 public runtime",
      publicFields
    ),
    key: "phase13f1:create-public",
  });
  assert.equal(createPublic.replayed, false);
  const createPublicReplay = await protectedCommand(database, {
    token: tokens.admin,
    operation: "forms.definitions.create",
    input: definitionInput(
      "phase13f1_public_runtime",
      "Phase 13F1 public runtime",
      publicFields
    ),
    key: "phase13f1:create-public",
  });
  assert.equal(createPublicReplay.replayed, true);
  assert.equal(createPublicReplay.command_id, createPublic.command_id);
  await expectSqlState("protected-idempotency-conflict", "23505", () =>
    protectedCommand(database, {
      token: tokens.admin,
      operation: "forms.definitions.create",
      input: definitionInput(
        "phase13f1_public_runtime_changed",
        "Changed",
        publicFields
      ),
      key: "phase13f1:create-public",
    })
  );

  const publicDefinition = createPublic.data.definition;
  const publicVersion = createPublic.data.version;
  const publishedPublic = await protectedCommand(database, {
    token: tokens.admin,
    operation: "forms.versions.publish",
    targetId: publicDefinition.id,
    input: {
      versionId: publicVersion.id,
      slug: "phase13f1-public-runtime",
      audience: "public",
      allowMultiple: true,
      allowDrafts: true,
      offlineEligible: false,
    },
    key: "phase13f1:publish-public",
  });
  const publicPublication = publishedPublic.data.publication;
  await expectSqlState("public-request-fingerprint-immutable", "55000", () =>
    database.exec(`
      do $$
      declare
        v_command_id uuid;
      begin
        insert into public.form_public_commands (
          operation,
          publication_id,
          version_id,
          idempotency_key,
          client_submission_id,
          request_hmac,
          request_fingerprint,
          evidence_key_version,
          ip_hmac,
          ip_key_version,
          user_agent_hash
        )
        values (
          'forms.public.submit',
          '${publicPublication.id}'::uuid,
          '${publicVersion.id}'::uuid,
          'phase13f1:immutable-probe',
          'public-client-immutable-probe',
          pg_catalog.decode(pg_catalog.repeat('1', 64), 'hex'),
          pg_catalog.decode(pg_catalog.repeat('2', 64), 'hex'),
          1,
          pg_catalog.decode(pg_catalog.repeat('3', 64), 'hex'),
          1,
          pg_catalog.decode(pg_catalog.repeat('4', 64), 'hex')
        )
        returning id into v_command_id;

        update public.form_public_commands
        set request_fingerprint = pg_catalog.decode(pg_catalog.repeat('5', 64), 'hex')
        where id = v_command_id;
      end;
      $$;
    `)
  );
  const firstPublicInput = {
    answers: {
      full_name: "Fake public applicant 1",
      national_id: "PUBLIC-SECRET-1",
    },
  };
  const firstPublic = await publicCommand(database, {
    publicationId: publicPublication.id,
    versionId: publicVersion.id,
    input: firstPublicInput,
    clientSubmissionId: "public-client-0001",
    key: "phase13f1:public-submit-0001",
  });
  assert.equal(firstPublic.replayed, false);
  assert.equal(
    firstPublic.data.submission.answer_json.national_id,
    undefined,
    "public response must redact sensitive answers"
  );
  await database.exec(`
    alter table public.nile_forms_repository_contract
      disable trigger nile_forms_repository_contract_immutable;
    update public.nile_forms_repository_contract
    set
      public_hmac_key_version = 2,
      public_hmac_previous_key_version = 1;
    alter table public.nile_forms_repository_contract
      enable trigger nile_forms_repository_contract_immutable;
  `);
  const firstPublicReplay = await publicCommand(database, {
    publicationId: publicPublication.id,
    versionId: publicVersion.id,
    input: firstPublicInput,
    clientSubmissionId: "public-client-0001",
    key: "phase13f1:public-submit-0001",
    requestHmac: "6".repeat(64),
    ipHmac: "a".repeat(64),
    ipKeyVersion: 2,
    previousIpHmac: "8".repeat(64),
    previousIpKeyVersion: 1,
  });
  assert.equal(firstPublicReplay.replayed, true);
  assert.equal(firstPublicReplay.command_id, firstPublic.command_id);
  await expectSqlState("public-evidence-version-mismatch", "22023", () =>
    publicCommand(database, {
      publicationId: publicPublication.id,
      versionId: publicVersion.id,
      input: { answers: { full_name: "Invalid evidence version" } },
      clientSubmissionId: "public-client-invalid-version",
      key: "phase13f1:public-invalid-version",
      ipHmac: "b".repeat(64),
      ipKeyVersion: 2,
      evidenceKeyVersion: 1,
    })
  );
  const conflict = await publicCommand(database, {
    publicationId: publicPublication.id,
    versionId: publicVersion.id,
    input: { answers: { full_name: "Changed" } },
    clientSubmissionId: "public-client-0001",
    key: "phase13f1:public-submit-0001",
    requestHmac: "7".repeat(64),
    ipHmac: "b".repeat(64),
    ipKeyVersion: 2,
    previousIpHmac: "c".repeat(64),
    previousIpKeyVersion: 1,
  });
  assert.equal(conflict.error_code, "forms_public_conflict");
  const invalid = await publicCommand(database, {
    publicationId: publicPublication.id,
    versionId: publicVersion.id,
    input: { answers: "not-an-object" },
    clientSubmissionId: "public-client-invalid-input",
    key: "phase13f1:public-invalid-input",
    ipHmac: "d".repeat(64),
    ipKeyVersion: 2,
    previousIpHmac: "e".repeat(64),
    previousIpKeyVersion: 1,
  });
  assert.equal(invalid.error_code, "forms_public_invalid");
  const invalidTimestamp = await publicCommand(database, {
    publicationId: publicPublication.id,
    versionId: publicVersion.id,
    input: {
      answers: { full_name: "Invalid timestamp" },
      clientSubmittedAt: "294277-01-01T00:00:00Z",
    },
    clientSubmissionId: "public-client-invalid-timestamp",
    key: "phase13f1:public-invalid-timestamp",
    ipHmac: "1".repeat(64),
    ipKeyVersion: 2,
    previousIpHmac: "2".repeat(64),
    previousIpKeyVersion: 1,
  });
  assert.equal(invalidTimestamp.error_code, "forms_public_invalid");
  assert.equal(
    await count(
      database,
      `select count(*) from public.form_public_rate_limits where attempts = 1`
    ),
    6,
    "conflicting and invalid requests must retain both key-version limiter rows"
  );

  const rotatedLimiterEvidence = {
    ipHmac: "a".repeat(64),
    ipKeyVersion: 2,
    previousIpHmac: "8".repeat(64),
    previousIpKeyVersion: 1,
  };
  for (let index = 2; index <= 9; index += 1) {
    const response = await publicCommand(database, {
      publicationId: publicPublication.id,
      versionId: publicVersion.id,
      input: { answers: { full_name: `Fake public applicant ${index}` } },
      clientSubmissionId: `public-client-${String(index).padStart(4, "0")}`,
      key: `phase13f1:public-submit-${String(index).padStart(4, "0")}`,
      ...rotatedLimiterEvidence,
    });
    assert.equal(response.error_code, null);
  }
  const limited = await publicCommand(database, {
    publicationId: publicPublication.id,
    versionId: publicVersion.id,
    input: { answers: { full_name: "Must be rate limited" } },
    clientSubmissionId: "public-client-0010",
    key: "phase13f1:public-submit-0010",
    ...rotatedLimiterEvidence,
  });
  assert.equal(limited.error_code, "forms_public_rate_limited");
  assert.equal(limited.command_id, null);
  assert.equal(
    await count(
      database,
      `select count(*) from public.form_public_rate_limits where attempts = 11`
    ),
    2,
    "durable public limiter must preserve one budget across both key versions"
  );
  await database.exec(`
    alter table public.nile_forms_repository_contract
      disable trigger nile_forms_repository_contract_immutable;
    update public.nile_forms_repository_contract
    set
      public_hmac_key_version = 3,
      public_hmac_previous_key_version = null;
    alter table public.nile_forms_repository_contract
      enable trigger nile_forms_repository_contract_immutable;
  `);
  const replayAfterKeyRetirement = await publicCommand(database, {
    publicationId: publicPublication.id,
    versionId: publicVersion.id,
    input: firstPublicInput,
    clientSubmissionId: "public-client-0001",
    key: "phase13f1:public-submit-0001",
    requestHmac: "f".repeat(64),
    ipHmac: "f".repeat(64),
    ipKeyVersion: 3,
  });
  assert.equal(replayAfterKeyRetirement.replayed, true);
  assert.equal(replayAfterKeyRetirement.command_id, firstPublic.command_id);

  const beforeGrant = await protectedQuery(database, {
    token: tokens.registrar,
    operation: "forms.submissions.get",
    targetId: "f6000000-0000-4000-8000-000000000001",
  });
  assert.equal(beforeGrant.submission.answer_json.national_id, undefined);
  await protectedCommand(database, {
    token: tokens.admin,
    operation: "forms.permissions.sensitive.grant",
    targetId: "50000000-0000-4000-8000-000000000003",
    input: { reason: "Local Phase 13F1 projection acceptance" },
    key: "phase13f1:sensitive-grant",
  });
  const afterGrant = await protectedQuery(database, {
    token: tokens.registrar,
    operation: "forms.submissions.get",
    targetId: "f6000000-0000-4000-8000-000000000001",
  });
  assert.equal(afterGrant.submission.answer_json.national_id, "FAKE-0001");
  await protectedCommand(database, {
    token: tokens.admin,
    operation: "forms.permissions.sensitive.revoke",
    targetId: "50000000-0000-4000-8000-000000000003",
    input: {},
    key: "phase13f1:sensitive-revoke",
  });
  const afterRevoke = await protectedQuery(database, {
    token: tokens.registrar,
    operation: "forms.submissions.get",
    targetId: "f6000000-0000-4000-8000-000000000001",
  });
  assert.equal(afterRevoke.submission.answer_json.national_id, undefined);

  return { standardFields };
}

async function runOfflineFlow(database, standardFields) {
  const create = await protectedCommand(database, {
    token: tokens.admin,
    operation: "forms.definitions.create",
    input: {
      ...definitionInput(
        "phase13f1_offline_runtime",
        "Phase 13F1 offline runtime",
        standardFields
      ),
      category: "branch_operations",
    },
    key: "phase13f1:create-offline",
  });
  const definition = create.data.definition;
  const version = create.data.version;
  const publish = await protectedCommand(database, {
    token: tokens.admin,
    operation: "forms.versions.publish",
    targetId: definition.id,
    input: {
      versionId: version.id,
      slug: "phase13f1-offline-runtime",
      audience: "assigned",
      allowMultiple: true,
      allowDrafts: true,
      offlineEligible: true,
    },
    key: "phase13f1:publish-offline",
  });
  const publication = publish.data.publication;
  const assignmentResult = await protectedCommand(database, {
    token: tokens.admin,
    operation: "forms.assignments.create",
    targetId: publication.id,
    input: {
      targetType: "branch",
      targetValue: "20000000-0000-4000-8000-000000000002",
    },
    key: "phase13f1:assign-offline",
  });
  const assignment = assignmentResult.data;
  const deviceResult = await protectedCommand(database, {
    token: tokens.branch,
    operation: "forms.offline.devices.enroll",
    input: {
      label: "Fake Phase 13F1 tablet",
      deviceTokenHash: hash("phase13f1-device-token"),
      publicKey: "FAKE-PUBLIC-KEY-PHASE13F1-0000000000000000",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
    key: "phase13f1:device-enroll",
  });
  const device = deviceResult.data;
  const bundleMac = hash("phase13f1-bundle-mac");
  const itemMac = hash("phase13f1-item-mac");
  const safeOptionDigest = hash("phase13f1-safe-options");
  const bundleResult = await protectedCommand(database, {
    token: tokens.branch,
    operation: "forms.offline.bundle.issue",
    targetId: device.id,
    input: {
      assignmentId: assignment.id,
      versionId: version.id,
      bundleMac,
      itemMac,
      safeOptionDigest,
      macKeyVersion: 1,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
    key: "phase13f1:bundle-issue",
  });
  const bundle = bundleResult.data.bundle;
  const item = bundleResult.data.item;

  const accepted = await protectedCommand(database, {
    token: tokens.branch,
    operation: "forms.offline.sync.item",
    input: {
      assignmentId: assignment.id,
      deviceId: device.id,
      bundleId: bundle.id,
      bundleItemId: item.id,
      bundleMac,
      itemMac,
      safeOptionDigest,
      answers: { full_name: "Fake accepted offline response" },
      clientSubmissionId: "offline-client-accepted",
      clientSubmittedAt: new Date().toISOString(),
      payloadHash: hash("offline-client-accepted"),
    },
    key: "phase13f1:offline-accepted",
  });
  assert.equal(accepted.data.receipt.status, "accepted");
  const acceptedSubmissionId = accepted.data.submission.id;
  assert.equal(
    await count(
      database,
      `select count(*) from public.outbox_events
       where event_type = 'form.submitted' and aggregate_id = $1`,
      [acceptedSubmissionId]
    ),
    1
  );

  const reviewStart = await protectedCommand(database, {
    token: tokens.admin,
    operation: "forms.submissions.review",
    targetId: acceptedSubmissionId,
    input: { decision: "under_review", expectedRevision: 1 },
    key: "phase13f1:review-start",
  });
  assert.equal(reviewStart.data.submission.status, "under_review");
  const reviewAccept = await protectedCommand(database, {
    token: tokens.admin,
    operation: "forms.submissions.review",
    targetId: acceptedSubmissionId,
    input: { decision: "accepted", expectedRevision: 2 },
    key: "phase13f1:review-accept",
  });
  assert.equal(reviewAccept.data.submission.status, "accepted");
  assert.equal(
    await count(
      database,
      `select count(*) from public.outbox_events
       where event_type = 'form.reviewed' and aggregate_id = $1`,
      [acceptedSubmissionId]
    ),
    2
  );

  await protectedCommand(database, {
    token: tokens.admin,
    operation: "forms.assignments.revoke",
    targetId: assignment.id,
    input: {},
    key: "phase13f1:assignment-revoke",
  });
  const quarantined = await protectedCommand(database, {
    token: tokens.branch,
    operation: "forms.offline.sync.item",
    input: {
      assignmentId: assignment.id,
      deviceId: device.id,
      bundleId: bundle.id,
      bundleItemId: item.id,
      bundleMac,
      itemMac,
      safeOptionDigest,
      answers: { full_name: "Fake quarantined offline response" },
      clientSubmissionId: "offline-client-quarantine",
      clientSubmittedAt: new Date().toISOString(),
      payloadHash: hash("offline-client-quarantine"),
    },
    key: "phase13f1:offline-quarantine",
  });
  assert.equal(quarantined.data.receipt.status, "quarantined");
  assert.equal(
    await count(
      database,
      `select count(*) from public.outbox_events where aggregate_id = $1`,
      [quarantined.data.submission.id]
    ),
    0,
    "quarantined offline item must emit no outbox event"
  );

  await expectSqlState("offline-item-mac-tamper", "42501", () =>
    protectedCommand(database, {
      token: tokens.branch,
      operation: "forms.offline.sync.item",
      input: {
        assignmentId: assignment.id,
        deviceId: device.id,
        bundleId: bundle.id,
        bundleItemId: item.id,
        bundleMac,
        itemMac: "0".repeat(64),
        safeOptionDigest,
        answers: { full_name: "Must not persist" },
        clientSubmissionId: "offline-client-tampered",
        payloadHash: hash("offline-client-tampered"),
      },
      key: "phase13f1:offline-tampered",
    })
  );
  assert.equal(
    await count(
      database,
      `select count(*) from public.command_executions
       where idempotency_key = 'phase13f1:offline-tampered'`
    ),
    0,
    "tampered offline item must leave no command evidence"
  );
  assert.equal(
    await count(
      database,
      `select count(*) from public.form_sync_receipts
       where client_submission_id = 'offline-client-tampered'`
    ),
    0,
    "tampered offline item must leave no receipt"
  );
}

async function runRevocationOrderProof(database) {
  const startedAt = Date.now();
  await database.query(
    `update public.auth_sessions
     set revoked_at = now(), revoked_by = $1::uuid
     where token_hash = decode($2::text, 'hex')`,
    ["40000000-0000-4000-8000-000000000006", tokens.revokeFirst]
  );
  await expectSqlState("revoke-wins-command-denied", "42501", () =>
    protectedCommand(database, {
      token: tokens.revokeFirst,
      operation: "forms.offline.devices.enroll",
      input: {
        label: "Must not enroll",
        deviceTokenHash: hash("revoke-first-device"),
        publicKey: "FAKE-PUBLIC-KEY-REVOKE-FIRST-000000000000",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      },
      key: "phase13f1:revoke-first",
    })
  );
  assert.equal(
    await count(
      database,
      `select count(*) from public.command_executions
       where idempotency_key = 'phase13f1:revoke-first'`
    ),
    0
  );

  await protectedCommand(database, {
    token: tokens.commandFirst,
    operation: "forms.offline.devices.enroll",
    input: {
      label: "Command winner device",
      deviceTokenHash: hash("command-first-device"),
      publicKey: "FAKE-PUBLIC-KEY-COMMAND-FIRST-00000000000",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
    key: "phase13f1:command-first",
  });
  await database.query(
    `update public.auth_sessions
     set revoked_at = now(), revoked_by = $1::uuid
     where token_hash = decode($2::text, 'hex')`,
    ["40000000-0000-4000-8000-000000000006", tokens.commandFirst]
  );
  await expectSqlState("command-wins-later-replay-denied", "42501", () =>
    protectedCommand(database, {
      token: tokens.commandFirst,
      operation: "forms.offline.devices.enroll",
      input: {
        label: "Command winner device",
        deviceTokenHash: hash("command-first-device"),
        publicKey: "FAKE-PUBLIC-KEY-COMMAND-FIRST-00000000000",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      },
      key: "phase13f1:command-first",
    })
  );
  assert.equal(
    await count(
      database,
      `select count(*) from public.command_executions
       where idempotency_key = 'phase13f1:command-first'
         and status = 'succeeded'`
    ),
    1
  );
  log("sequentialized-revoke-command-outcomes", startedAt, { outcomes: 2 });
}

async function assertRollback(database) {
  const startedAt = Date.now();
  assert.equal(
    await count(
      database,
      `select count(*) from pg_catalog.pg_tables
       where schemaname = 'public'
         and tablename in (
           'form_permission_mappings',
           'form_operation_permissions',
           'role_grant_permissions',
           'form_command_results',
           'form_public_commands',
           'form_public_rate_limits',
           'form_offline_bundles',
           'form_offline_bundle_items',
           'nile_forms_repository_contract'
         )`
    ),
    0
  );
  assert.equal(
    await count(
      database,
      `select count(*) from public.form_submissions
       where id in (
         'f6000000-0000-4000-8000-000000000001',
         'f6000000-0000-4000-8000-000000000002',
         'f6000000-0000-4000-8000-000000000003'
       )`
    ),
    3
  );
  assert.equal(
    await count(
      database,
      `select count(*) from public.form_reviews
       where id = 'f8000000-0000-4000-8000-000000000001'`
    ),
    1
  );
  assert.equal(
    await count(
      database,
      `select count(*) from public.form_sync_receipts
       where id = 'fa000000-0000-4000-8000-000000000001'`
    ),
    1
  );
  assert.equal(
    await count(
      database,
      `select count(*) from public.form_legacy_import_records
       where id = 'fd000000-0000-4000-8000-000000000001'`
    ),
    1
  );
  assert.equal(
    await count(
      database,
      `select count(*) from pg_catalog.pg_roles
       where rolname = 'nile_forms_executor'`
    ),
    0
  );
  log("phase13f1-rollback-preserves-phase13a-e", startedAt);
}

const database = new PGlite({ extensions: { btree_gist, citext, pgcrypto } });

try {
  await bootstrap(database);
  await execute(database, "phase13f1-forward-1", sql.phase13f1);
  await execute(database, "phase13f1-assertions-1", sql.assertions);
  await assertRuntimeContract(database);
  const { standardFields } = await runProtectedAndPublicFlows(database);
  await runOfflineFlow(database, standardFields);
  await runRevocationOrderProof(database);
  await execute(database, "phase13f1-assertions-after-runtime", sql.assertions);
  await execute(database, "phase13f1-rollback", sql.rollback);
  await assertRollback(database);
  await execute(database, "phase13f1-forward-2", sql.phase13f1);
  await execute(database, "phase13f1-assertions-2", sql.assertions);

  console.log(
    JSON.stringify({
      ok: true,
      engine: "PGlite PostgreSQL",
      forwardApplications: 2,
      semanticAssertionPasses: 3,
      rollbackPasses: 1,
      protectedReplayConflict: true,
      publicReplayConflictAndLimiter: true,
      sensitiveProjectionGrantCycle: true,
      offlineAcceptedQuarantinedTamper: true,
      revokeCommandOutcomes: 2,
      directRoleDenials: 3,
    })
  );
} finally {
  await database.close();
}
