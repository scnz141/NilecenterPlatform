import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = name =>
  readFileSync(path.join(root, "supabase/manual", name), "utf8");
const forward = read("017_account_invitation_lifecycle.sql");
const assertions = read("217_account_invitation_lifecycle_assertions.sql");
const rollback = read("917_account_invitation_lifecycle_rollback.sql");

function requireText(source, value, label) {
  if (!source.includes(value)) {
    throw new Error(`Account invitation SQL is missing ${label}.`);
  }
}

[
  ["create table if not exists public.user_invitations", "invitation records"],
  [
    "create table if not exists public.identity_lifecycle_events",
    "activation evidence",
  ],
  ["nile_create_user_invitation_with_evidence", "atomic create RPC"],
  ["nile_accept_user_invitation", "verified activation RPC"],
  ["nile_claim_email_delivery_v2", "invited-recipient delivery claim"],
  ["'user.invited'", "invitation audit action"],
  ["'email.delivery.requested'", "email outbox event"],
  ["force row level security", "forced RLS"],
].forEach(([value, label]) => requireText(forward, value, label));

[
  "RESEND_API_KEY",
  "SUPABASE_SECRET_KEY",
  "service_role secret",
  "Authorization: Bearer",
].forEach(forbidden => {
  if (forward.includes(forbidden)) {
    throw new Error(
      `Account invitation SQL contains credential material: ${forbidden}`
    );
  }
});

requireText(
  assertions,
  "Browser roles must not receive",
  "browser denial assertion"
);
requireText(
  rollback,
  "drop table if exists public.user_invitations",
  "rollback"
);

console.log(
  JSON.stringify({
    ok: true,
    package: "account-invitation-lifecycle",
    manualOnly: true,
    remoteContacted: false,
  })
);
