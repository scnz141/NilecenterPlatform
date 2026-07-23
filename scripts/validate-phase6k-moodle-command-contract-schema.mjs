import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = relative => readFileSync(path.join(root, relative), "utf8");
const migration = read(
  "supabase/manual/027_phase6k_moodle_command_contract.sql"
);
const assertions = read(
  "supabase/manual/227_phase6k_moodle_command_contract_assertions.sql"
);
const rollback = read(
  "supabase/manual/927_phase6k_moodle_command_contract_rollback.sql"
);
const manifest = JSON.parse(
  read("docs/integrations/local_nilelearn-capability-manifest.v1.json")
);

function fail(message) {
  throw new Error(message);
}

function markers(source, label, required) {
  for (const marker of required) {
    if (!source.includes(marker)) fail(`${label} is missing: ${marker}`);
  }
}

const operations = [
  "delivery_course.clone",
  "delivery_course.archive",
  "delivery_course.restore",
  "section.upsert",
  "section.reorder",
  "section.visibility",
  "page.upsert",
  "book.upsert",
  "url.upsert",
  "resource.upsert",
  "resource.archive",
  "assignment.upsert",
  "assignment.archive",
  "quiz_shell.upsert",
  "quiz.archive",
  "question.upsert",
  "question.move",
  "grade.update",
  "completion.update",
];
const launches = [
  "lesson_authoring",
  "h5p_authoring",
  "scorm_authoring",
  "video_time_authoring",
  "quiz_attempt",
  "assignment_submission",
];

if (
  manifest.component !== "local_nilelearn" ||
  manifest.protocolVersion !== "1.0" ||
  JSON.stringify(manifest.operations.map(item => item.name)) !==
    JSON.stringify(operations) ||
  JSON.stringify(manifest.nativeLaunchKinds) !== JSON.stringify(launches)
) {
  fail("Versioned local_nilelearn manifest differs from the exact allowlist");
}
if (
  manifest.operations.some(
    item =>
      !/^[a-z][a-z0-9_]+\/[a-z][a-z0-9_:.-]+$/.test(item.requiredCapability)
  )
) {
  fail("Manifest contains an invalid Moodle capability");
}

const tables = [
  ...migration.matchAll(/create table public\.([a-z][a-z0-9_]*)/g),
].map(match => match[1]);
const expectedTables = [
  "moodle_plugin_manifests",
  "moodle_command_requests",
  "moodle_command_attempts",
];
if (JSON.stringify(tables) !== JSON.stringify(expectedTables)) {
  fail(`Phase 6K must create exactly three tables; found ${tables.join(", ")}`);
}

const promoted = readdirSync(path.join(root, "supabase/migrations")).filter(
  file => /phase6k|moodle_command_contract/i.test(file)
);
if (promoted.length) fail(`Phase 6K must remain manual-only: ${promoted}`);

markers(migration, "Command schema", [
  "Manual-only and intentionally unapplied",
  "create table public.moodle_plugin_manifests",
  "create table public.moodle_command_requests",
  "create table public.moodle_command_attempts",
  "component = 'local_nilelearn'",
  "protocol_version = '1.0'",
  "command_type <> 'moodle.command.enqueue'",
  "event_type <> 'moodle.command.requested'",
  "audit.action = 'moodle.command.queued'",
  "actor_mapping.entity_type <> 'user'",
  "actor_mapping.internal_id <> command_row.actor_user_id",
  "Only delivery-course cloning may omit a target mapping",
  "Moodle command request requires atomic command, audit, and outbox evidence",
  "Moodle command outbox requires a durable command request",
  "moodle_command_requests_require_atomic_evidence",
  "deferrable initially deferred",
  "before update or delete on public.moodle_command_attempts",
]);
for (const table of expectedTables) {
  markers(migration, "RLS contract", [
    `alter table public.${table} enable row level security;`,
    `alter table public.${table} force row level security;`,
    `revoke all on public.${table} from public, anon, authenticated, service_role;`,
  ]);
}
if (/create\s+policy/i.test(migration)) {
  fail("Phase 6K forced-RLS tables must have no policies");
}
if (/grant\s+(select|insert|update|delete|execute)/i.test(migration)) {
  fail("Phase 6K must not activate a runtime database surface");
}
if (
  /\b(fetch|axios|https?:\/\/|wstoken|api[_-]?key|password)\b/i.test(migration)
) {
  fail("Phase 6K SQL contains a provider call or credential-shaped field");
}

markers(assertions, "Semantic assertions", [
  "Complete local_nilelearn manifest was rejected",
  "Incomplete local_nilelearn manifest was accepted",
  "Native Moodle launch was accepted as a command operation",
  "Phase 6K unexpectedly exposed a public Moodle command RPC",
  "rollback;",
]);
markers(rollback, "Rollback", [
  "drop table if exists public.moodle_command_attempts;",
  "drop table if exists public.moodle_command_requests;",
  "drop table if exists public.moodle_plugin_manifests;",
  "drop function if exists nile_private.require_moodle_command_atomic_evidence();",
  "drop function if exists nile_private.moodle_command_operation_is_allowed(text);",
]);
if (/\b(delete|truncate)\b/i.test(rollback)) {
  fail("Phase 6K rollback must preserve prior durable evidence");
}

console.log(
  JSON.stringify({
    ok: true,
    package: "phase6k-moodle-command-contract",
    manualOnly: true,
    runtimeActivated: false,
    tables: expectedTables.length,
    commandOperations: operations.length,
    nativeLaunchKinds: launches.length,
    publicCommandRpcs: 0,
  })
);
