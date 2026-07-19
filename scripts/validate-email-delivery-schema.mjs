import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const forwardPath = path.join(
  root,
  "supabase/manual/016_transactional_email_delivery.sql"
);
const assertionsPath = path.join(
  root,
  "supabase/manual/216_transactional_email_delivery_assertions.sql"
);
const rollbackPath = path.join(
  root,
  "supabase/manual/916_transactional_email_delivery_rollback.sql"
);
const forward = readFileSync(forwardPath, "utf8");
const assertions = readFileSync(assertionsPath, "utf8");
const rollback = readFileSync(rollbackPath, "utf8");

function requireText(source, value, label) {
  if (!source.includes(value)) {
    throw new Error(`Transactional email SQL is missing ${label}.`);
  }
}

[
  ["create table if not exists public.email_deliveries", "delivery records"],
  [
    "create table if not exists public.email_suppressions",
    "suppression records",
  ],
  [
    "create table if not exists public.email_webhook_events",
    "webhook deduplication",
  ],
  ["create or replace function public.nile_claim_email_delivery", "lease RPC"],
  ["for update of event skip locked", "non-blocking lease claim"],
  [
    "create or replace function public.nile_complete_email_delivery",
    "completion RPC",
  ],
  [
    "create or replace function public.nile_record_email_webhook",
    "webhook RPC",
  ],
  ["email.delivery.requested", "transactional outbox contract"],
  [
    "alter table public.email_deliveries force row level security",
    "delivery forced RLS",
  ],
  [
    "alter table public.email_suppressions force row level security",
    "suppression forced RLS",
  ],
  [
    "alter table public.email_webhook_events force row level security",
    "webhook forced RLS",
  ],
  [
    "grant execute on function public.nile_claim_email_delivery",
    "service claim grant",
  ],
].forEach(([value, label]) => requireText(forward, value, label));

[
  "RESEND_API_KEY",
  "RESEND_WEBHOOK_SECRET",
  "re_",
  "Authorization: Bearer",
].forEach(forbidden => {
  if (forward.includes(forbidden)) {
    throw new Error(
      `Transactional email SQL must not contain credential material: ${forbidden}`
    );
  }
});

requireText(assertions, "forced RLS", "forced-RLS assertions");
requireText(
  assertions,
  "Browser roles must not receive",
  "browser denial assertion"
);
requireText(
  rollback,
  "drop table if exists public.email_deliveries",
  "delivery rollback"
);
requireText(
  rollback,
  "drop function if exists nile_private.email_outbox_payload_is_safe",
  "helper rollback"
);

console.log(
  JSON.stringify({
    ok: true,
    package: "transactional-email-delivery",
    manualOnly: true,
    remoteContacted: false,
  })
);
