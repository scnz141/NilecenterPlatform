-- Roll back only the account invitation extension and restore SQL 016 behavior.
begin;

drop function if exists public.nile_claim_email_delivery_v2(text, integer);
drop function if exists public.nile_accept_user_invitation(uuid, uuid);
drop function if exists public.nile_create_user_invitation_with_evidence(
  text, uuid, uuid, text, text, text, text, text, text, text, text,
  text[], text[], text, text, timestamptz, text, text
);
drop table if exists public.identity_lifecycle_events;
drop table if exists public.user_invitations;

alter table public.email_deliveries
  drop constraint email_deliveries_template_key_check;
alter table public.email_deliveries
  add constraint email_deliveries_template_key_check check (template_key in (
    'account_recovery', 'enrollment_activated', 'placement_updated',
    'schedule_changed', 'attendance_alert', 'grading_feedback',
    'certificate_issued', 'message_notification'
  ));

create or replace function nile_private.email_outbox_payload_is_safe(payload jsonb)
returns boolean
language plpgsql
immutable
strict
security invoker
set search_path = ''
as $$
declare
  root_keys text[];
begin
  if pg_catalog.jsonb_typeof(payload) <> 'object'
    or pg_catalog.octet_length(payload::text) > 32768
    or nile_private.jsonb_has_forbidden_keys(payload) then
    return false;
  end if;
  select pg_catalog.array_agg(key order by key)
  into root_keys
  from pg_catalog.jsonb_object_keys(payload) as key;
  if root_keys is distinct from array[
    'locale', 'recipientUserId', 'schemaVersion', 'templateKey',
    'templateVersion', 'variables'
  ]::text[]
    or payload->>'schemaVersion' <> '1'
    or payload->>'templateKey' not in (
      'account_recovery', 'enrollment_activated', 'placement_updated',
      'schedule_changed', 'attendance_alert', 'grading_feedback',
      'certificate_issued', 'message_notification'
    )
    or payload->>'templateVersion' <> '1'
    or payload->>'locale' not in ('en', 'ar', 'zh', 'ru', 'ur', 'tr')
    or (payload->>'recipientUserId') !~
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or pg_catalog.jsonb_typeof(payload->'variables') <> 'object'
    or (
      select pg_catalog.count(*)
      from pg_catalog.jsonb_object_keys(payload->'variables')
    ) > 24 then
    return false;
  end if;
  return true;
end;
$$;

commit;
