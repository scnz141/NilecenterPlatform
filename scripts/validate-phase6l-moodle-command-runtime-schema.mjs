import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = relative => readFileSync(path.join(root, relative), "utf8");
const migration = read(
  "supabase/manual/028_phase6l_moodle_command_runtime.sql"
);
const assertions = read(
  "supabase/manual/228_phase6l_moodle_command_runtime_assertions.sql"
);
const rollback = read(
  "supabase/manual/928_phase6l_moodle_command_runtime_rollback.sql"
);

function requireMarkers(source, label, markers) {
  for (const marker of markers) {
    if (!source.includes(marker))
      throw new Error(`${label} is missing: ${marker}`);
  }
}

requireMarkers(migration, "Phase 6L runtime", [
  "Manual-only",
  "create table public.moodle_native_launch_tickets",
  "create or replace function public.nile_create_moodle_command",
  "create or replace function public.nile_claim_moodle_command",
  "create or replace function public.nile_complete_moodle_command_attempt",
  "create or replace function public.nile_get_moodle_command_status",
  "create or replace function public.nile_reconcile_moodle_command",
  "create or replace function public.nile_create_moodle_launch",
  "create or replace function public.nile_consume_moodle_launch",
  "write_limited",
  "for update skip locked",
  "reconciliation_required",
  "unknown_provider_outcome",
  "resolve_moodle_course_projection_authority",
  "from public, anon, authenticated",
]);
requireMarkers(assertions, "Phase 6L assertions", [
  "Browser role has direct Phase 6L table access",
  "Phase 6L role-operation matrix is unsafe",
  "integration_connections_moodle_mode_check",
]);
requireMarkers(rollback, "Phase 6L rollback", [
  "Leaves Phase 6K intact",
  "drop table if exists public.moodle_native_launch_tickets",
  "add constraint moodle_command_requests_status_check",
]);

const promoted = readdirSync(path.join(root, "supabase/migrations")).filter(
  file => /phase6l|moodle_command_runtime/i.test(file)
);
if (promoted.length) {
  throw new Error(
    `Phase 6L must remain manual until staging acceptance: ${promoted}`
  );
}
if (
  migration.includes("lkvyhevoommqnpwwmqgp") ||
  migration.includes("026_normalized_native_assignment_authority")
) {
  throw new Error(
    "Phase 6L references a forbidden production or retired target."
  );
}

console.log(
  JSON.stringify(
    {
      phase: "6L.3",
      manualOnly: true,
      runtimeRpcs: 7,
      browserTableAccess: false,
      productionTargetReferenced: false,
    },
    null,
    2
  )
);
