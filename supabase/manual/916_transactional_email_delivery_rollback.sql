-- Rollback for the manual transactional email delivery package.
begin;

drop function if exists public.nile_record_email_webhook(
  text, text, text, timestamptz, text
);
drop function if exists public.nile_complete_email_delivery(
  uuid, text, text, text, text, text, integer
);
drop function if exists public.nile_claim_email_delivery(text, integer);
drop table if exists public.email_webhook_events;
drop table if exists public.email_suppressions;
drop table if exists public.email_deliveries;
drop function if exists nile_private.email_outbox_payload_is_safe(jsonb);

commit;
