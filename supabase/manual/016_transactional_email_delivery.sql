-- Nile Learn transactional email delivery foundation.
-- Manual-only and intentionally unapplied. No provider credential is stored.
-- Requires the accepted Phase 1 identity, command, audit, and outbox schema.

begin;

do $$
declare
  dependency text;
begin
  foreach dependency in array array[
    'app_users', 'command_executions', 'audit_logs', 'outbox_events'
  ] loop
    if pg_catalog.to_regclass('public.' || dependency) is null then
      raise exception 'Transactional email delivery requires public.%', dependency;
    end if;
  end loop;

  if pg_catalog.to_regprocedure('nile_private.jsonb_has_forbidden_keys(jsonb)') is null
    or pg_catalog.to_regprocedure('nile_private.set_updated_at()') is null then
    raise exception 'Transactional email delivery requires Phase 1 safety helpers';
  end if;
end;
$$;

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

create table if not exists public.email_deliveries (
  id uuid primary key default gen_random_uuid(),
  outbox_event_id uuid not null unique
    references public.outbox_events(id) on delete restrict,
  recipient_user_id uuid not null references public.app_users(id) on delete restrict,
  recipient_address_hash bytea,
  provider text not null default 'resend' check (provider = 'resend'),
  provider_message_id text unique,
  template_key text not null check (template_key in (
    'account_recovery', 'enrollment_activated', 'placement_updated',
    'schedule_changed', 'attendance_alert', 'grading_feedback',
    'certificate_issued', 'message_notification'
  )),
  template_version integer not null check (template_version = 1),
  locale text not null check (locale in ('en', 'ar', 'zh', 'ru', 'ur', 'tr')),
  status text not null default 'queued' check (status in (
    'queued', 'processing', 'retry', 'sent', 'delivered', 'delayed',
    'bounced', 'complained', 'failed', 'suppressed', 'dead_letter'
  )),
  attempts integer not null default 0 check (attempts between 0 and 5),
  locked_at timestamptz,
  locked_by text,
  lease_until timestamptz,
  last_error_code text,
  sent_at timestamptz,
  delivered_at timestamptz,
  last_provider_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (recipient_address_hash is null or octet_length(recipient_address_hash) = 32),
  check (provider_message_id is null or (
    length(provider_message_id) between 3 and 200
    and provider_message_id ~ '^[A-Za-z0-9._:-]+$'
  )),
  check (last_error_code is null or (
    length(last_error_code) between 3 and 80
    and last_error_code ~ '^[a-z0-9._:-]+$'
  )),
  check (
    (status = 'processing' and locked_at is not null and locked_by is not null
      and lease_until is not null and lease_until > locked_at)
    or (status <> 'processing' and locked_at is null and locked_by is null
      and lease_until is null)
  ),
  check (status not in ('sent', 'delivered', 'delayed', 'bounced', 'complained')
    or provider_message_id is not null),
  check (sent_at is null or provider_message_id is not null),
  check (delivered_at is null or status = 'delivered')
);

create table if not exists public.email_suppressions (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.app_users(id) on delete restrict,
  provider text not null default 'resend' check (provider = 'resend'),
  reason text not null check (reason in ('bounced', 'complained', 'provider_suppressed')),
  status text not null default 'active' check (status in ('active', 'released')),
  source_delivery_id uuid references public.email_deliveries(id) on delete restrict,
  source_webhook_id text not null,
  suppressed_at timestamptz not null,
  released_at timestamptz,
  released_by uuid references public.app_users(id) on delete restrict,
  release_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recipient_user_id, provider),
  check (length(source_webhook_id) between 3 and 200),
  check (
    (status = 'active' and released_at is null and released_by is null
      and release_reason is null)
    or (status = 'released' and released_at is not null
      and released_by is not null and length(release_reason) between 8 and 500)
  )
);

create table if not exists public.email_webhook_events (
  webhook_id text primary key,
  provider text not null default 'resend' check (provider = 'resend'),
  provider_message_id text not null,
  event_type text not null check (event_type in (
    'email.sent', 'email.scheduled', 'email.delivered',
    'email.delivery_delayed', 'email.complained', 'email.bounced',
    'email.failed', 'email.suppressed'
  )),
  event_created_at timestamptz not null,
  payload_hash bytea not null check (octet_length(payload_hash) = 32),
  delivery_id uuid references public.email_deliveries(id) on delete restrict,
  processed_at timestamptz not null default now(),
  check (length(webhook_id) between 3 and 200),
  check (length(provider_message_id) between 3 and 200),
  check (provider_message_id ~ '^[A-Za-z0-9._:-]+$')
);

create index if not exists email_deliveries_status_time_idx
  on public.email_deliveries (status, updated_at);
create index if not exists email_deliveries_recipient_time_idx
  on public.email_deliveries (recipient_user_id, created_at desc);
create index if not exists email_suppressions_active_recipient_idx
  on public.email_suppressions (recipient_user_id)
  where status = 'active';
create index if not exists email_webhook_events_message_time_idx
  on public.email_webhook_events (provider_message_id, event_created_at desc);

drop trigger if exists email_deliveries_set_updated_at on public.email_deliveries;
create trigger email_deliveries_set_updated_at
before update on public.email_deliveries
for each row execute function nile_private.set_updated_at();

drop trigger if exists email_suppressions_set_updated_at on public.email_suppressions;
create trigger email_suppressions_set_updated_at
before update on public.email_suppressions
for each row execute function nile_private.set_updated_at();

alter table public.email_deliveries enable row level security;
alter table public.email_deliveries force row level security;
alter table public.email_suppressions enable row level security;
alter table public.email_suppressions force row level security;
alter table public.email_webhook_events enable row level security;
alter table public.email_webhook_events force row level security;

revoke all on table public.email_deliveries from public, anon, authenticated;
revoke all on table public.email_suppressions from public, anon, authenticated;
revoke all on table public.email_webhook_events from public, anon, authenticated;
revoke all on table public.email_deliveries from service_role;
revoke all on table public.email_suppressions from service_role;
revoke all on table public.email_webhook_events from service_role;

create or replace function public.nile_claim_email_delivery(
  p_worker_id text,
  p_lease_seconds integer
)
returns table (
  delivery_id uuid,
  outbox_event_id uuid,
  recipient_user_id uuid,
  recipient_email text,
  template_key text,
  template_version integer,
  locale text,
  variables jsonb,
  idempotency_key text,
  attempt_number integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.outbox_events%rowtype;
  user_row public.app_users%rowtype;
  delivery_row public.email_deliveries%rowtype;
  recipient_id uuid;
begin
  if p_worker_id is null or length(p_worker_id) not between 8 and 120
    or p_worker_id !~ '^[A-Za-z0-9._:-]+$'
    or p_lease_seconds not between 30 and 300 then
    raise exception 'Email delivery lease request is invalid'
      using errcode = '22023';
  end if;

  loop
    select event.* into event_row
    from public.outbox_events as event
    left join public.email_deliveries as delivery
      on delivery.outbox_event_id = event.id
    where event.event_type = 'email.delivery.requested'
      and event.available_at <= now()
      and (
        event.status in ('pending', 'failed')
        or (event.status = 'processing' and delivery.lease_until <= now())
      )
    order by event.available_at, event.created_at
    for update of event skip locked
    limit 1;

    if not found then
      return;
    end if;

    if not nile_private.email_outbox_payload_is_safe(event_row.payload)
      or length(event_row.idempotency_key) > 256 then
      update public.outbox_events
      set status = 'dead_letter', locked_at = null, locked_by = null,
        attempts = least(attempts + 1, 5), last_error = 'invalid_email_payload',
        processed_at = null
      where id = event_row.id;
      continue;
    end if;

    recipient_id := (event_row.payload->>'recipientUserId')::uuid;
    select app_user.* into user_row
    from public.app_users as app_user
    where app_user.id = recipient_id and app_user.status = 'active';

    if not found then
      update public.outbox_events
      set status = 'dead_letter', locked_at = null, locked_by = null,
        attempts = least(attempts + 1, 5), last_error = 'recipient_unavailable',
        processed_at = null
      where id = event_row.id;
      continue;
    end if;

    if exists (
      select 1 from public.email_suppressions as suppression
      where suppression.recipient_user_id = recipient_id
        and suppression.provider = 'resend' and suppression.status = 'active'
    ) then
      update public.outbox_events
      set status = 'processing', locked_at = now(), locked_by = p_worker_id,
        attempts = least(attempts + 1, 5), last_error = null,
        processed_at = null
      where id = event_row.id
      returning * into event_row;

      insert into public.email_deliveries (
        outbox_event_id, recipient_user_id, template_key, template_version,
        locale, status, attempts, last_error_code
      ) values (
        event_row.id, recipient_id, event_row.payload->>'templateKey', 1,
        event_row.payload->>'locale', 'suppressed',
        event_row.attempts, 'recipient_suppressed'
      ) on conflict on constraint email_deliveries_outbox_event_id_key do update set
        status = 'suppressed', attempts = least(public.email_deliveries.attempts + 1, 5),
        locked_at = null, locked_by = null, lease_until = null,
        last_error_code = 'recipient_suppressed';

      update public.outbox_events
      set status = 'succeeded', locked_at = null, locked_by = null,
        last_error = null, processed_at = now()
      where id = event_row.id;
      continue;
    end if;

    update public.outbox_events
    set status = 'processing', locked_at = now(), locked_by = p_worker_id,
      attempts = least(attempts + 1, 5), last_error = null,
      processed_at = null
    where id = event_row.id
    returning * into event_row;

    insert into public.email_deliveries (
      outbox_event_id, recipient_user_id, template_key, template_version,
      locale, status, attempts, locked_at, locked_by, lease_until,
      last_error_code
    ) values (
      event_row.id, recipient_id, event_row.payload->>'templateKey', 1,
      event_row.payload->>'locale', 'processing', event_row.attempts,
      event_row.locked_at, p_worker_id,
      event_row.locked_at + pg_catalog.make_interval(secs => p_lease_seconds), null
    ) on conflict on constraint email_deliveries_outbox_event_id_key do update set
      status = 'processing', attempts = excluded.attempts,
      locked_at = excluded.locked_at, locked_by = excluded.locked_by,
      lease_until = excluded.lease_until, last_error_code = null
    returning * into delivery_row;

    return query select
      delivery_row.id, event_row.id, recipient_id, user_row.email::text,
      delivery_row.template_key, delivery_row.template_version,
      delivery_row.locale, event_row.payload->'variables',
      event_row.idempotency_key, delivery_row.attempts;
    return;
  end loop;
end;
$$;

create or replace function public.nile_complete_email_delivery(
  p_delivery_id uuid,
  p_worker_id text,
  p_outcome text,
  p_provider_message_id text default null,
  p_recipient_hash text default null,
  p_error_code text default null,
  p_retry_after_seconds integer default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  delivery_row public.email_deliveries%rowtype;
begin
  select delivery.* into strict delivery_row
  from public.email_deliveries as delivery
  where delivery.id = p_delivery_id
  for update;

  if delivery_row.status <> 'processing'
    or delivery_row.locked_by is distinct from p_worker_id
    or delivery_row.lease_until < now() then
    raise exception 'Email delivery lease is not current'
      using errcode = '40001';
  end if;

  if p_outcome = 'sent' then
    if p_provider_message_id is null
      or p_provider_message_id !~ '^[A-Za-z0-9._:-]{3,200}$'
      or p_recipient_hash !~ '^[a-f0-9]{64}$'
      or p_error_code is not null or p_retry_after_seconds is not null then
      raise exception 'Sent email completion evidence is invalid'
        using errcode = '22023';
    end if;

    update public.email_deliveries set
      status = 'sent', provider_message_id = p_provider_message_id,
      recipient_address_hash = pg_catalog.decode(p_recipient_hash, 'hex'),
      sent_at = now(), locked_at = null, locked_by = null, lease_until = null,
      last_error_code = null
    where id = p_delivery_id;

    update public.outbox_events set
      status = 'succeeded', locked_at = null, locked_by = null,
      processed_at = now(), last_error = null
    where id = delivery_row.outbox_event_id;
    return;
  end if;

  if p_error_code is null or p_error_code !~ '^[a-z0-9._:-]{3,80}$'
    or p_provider_message_id is not null or p_recipient_hash is not null then
    raise exception 'Failed email completion evidence is invalid'
      using errcode = '22023';
  end if;

  if p_outcome = 'retry' then
    if p_retry_after_seconds not between 30 and 3600
      or delivery_row.attempts >= 5 then
      raise exception 'Email retry request is invalid'
        using errcode = '22023';
    end if;
    update public.email_deliveries set
      status = 'retry', locked_at = null, locked_by = null, lease_until = null,
      last_error_code = p_error_code
    where id = p_delivery_id;
    update public.outbox_events set
      status = 'failed', locked_at = null, locked_by = null,
      available_at = now() + pg_catalog.make_interval(secs => p_retry_after_seconds),
      last_error = p_error_code, processed_at = null
    where id = delivery_row.outbox_event_id;
    return;
  elsif p_outcome = 'dead_letter' then
    if p_retry_after_seconds is not null then
      raise exception 'Dead-letter completion cannot schedule a retry'
        using errcode = '22023';
    end if;
    update public.email_deliveries set
      status = 'dead_letter', locked_at = null, locked_by = null,
      lease_until = null, last_error_code = p_error_code
    where id = p_delivery_id;
    update public.outbox_events set
      status = 'dead_letter', locked_at = null, locked_by = null,
      last_error = p_error_code, processed_at = null
    where id = delivery_row.outbox_event_id;
    return;
  end if;

  raise exception 'Unsupported email completion outcome'
    using errcode = '22023';
exception
  when no_data_found then
    raise exception 'Email delivery does not exist'
      using errcode = 'P0002';
end;
$$;

create or replace function public.nile_record_email_webhook(
  p_webhook_id text,
  p_provider_message_id text,
  p_event_type text,
  p_event_created_at timestamptz,
  p_payload_hash text
)
returns table (
  duplicate boolean,
  delivery_updated boolean,
  suppression_created boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  delivery_row public.email_deliveries%rowtype;
  existing_webhook public.email_webhook_events%rowtype;
  inserted_webhook_id text;
  next_status text;
  created_suppression boolean := false;
begin
  if p_webhook_id is null or length(p_webhook_id) not between 3 and 200
    or p_provider_message_id !~ '^[A-Za-z0-9._:-]{3,200}$'
    or p_event_type not in (
      'email.sent', 'email.scheduled', 'email.delivered',
      'email.delivery_delayed', 'email.complained', 'email.bounced',
      'email.failed', 'email.suppressed'
    )
    or p_event_created_at is null
    or p_event_created_at > now() + interval '5 minutes'
    or p_payload_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Email webhook evidence is invalid'
      using errcode = '22023';
  end if;

  insert into public.email_webhook_events (
    webhook_id, provider_message_id, event_type, event_created_at, payload_hash
  ) values (
    p_webhook_id, p_provider_message_id, p_event_type, p_event_created_at,
    pg_catalog.decode(p_payload_hash, 'hex')
  ) on conflict (webhook_id) do nothing
  returning webhook_id into inserted_webhook_id;

  if inserted_webhook_id is null then
    select webhook.* into strict existing_webhook
    from public.email_webhook_events as webhook
    where webhook.webhook_id = p_webhook_id;
    if existing_webhook.provider_message_id <> p_provider_message_id
      or existing_webhook.event_type <> p_event_type
      or existing_webhook.event_created_at <> p_event_created_at
      or existing_webhook.payload_hash is distinct from pg_catalog.decode(p_payload_hash, 'hex') then
      raise exception 'Email webhook idempotency conflict'
        using errcode = '23505';
    end if;
    return query select true, false, false;
    return;
  end if;

  select delivery.* into delivery_row
  from public.email_deliveries as delivery
  where delivery.provider_message_id = p_provider_message_id
  for update;

  if not found then
    return query select false, false, false;
    return;
  end if;

  update public.email_webhook_events
  set delivery_id = delivery_row.id
  where webhook_id = p_webhook_id;

  next_status := case p_event_type
    when 'email.delivered' then 'delivered'
    when 'email.delivery_delayed' then 'delayed'
    when 'email.complained' then 'complained'
    when 'email.bounced' then 'bounced'
    when 'email.failed' then 'failed'
    when 'email.suppressed' then 'suppressed'
    else delivery_row.status
  end;

  if p_event_type in ('email.complained', 'email.bounced', 'email.suppressed') then
    insert into public.email_suppressions (
      recipient_user_id, reason, source_delivery_id, source_webhook_id,
      suppressed_at
    ) values (
      delivery_row.recipient_user_id,
      case p_event_type
        when 'email.complained' then 'complained'
        when 'email.bounced' then 'bounced'
        else 'provider_suppressed'
      end,
      delivery_row.id, p_webhook_id, p_event_created_at
    ) on conflict (recipient_user_id, provider) do update set
      reason = excluded.reason, status = 'active',
      source_delivery_id = excluded.source_delivery_id,
      source_webhook_id = excluded.source_webhook_id,
      suppressed_at = excluded.suppressed_at,
      released_at = null, released_by = null, release_reason = null;
    created_suppression := true;
  end if;

  if delivery_row.last_provider_event_at is null
    or p_event_created_at > delivery_row.last_provider_event_at
    or p_event_type in ('email.complained', 'email.bounced', 'email.suppressed') then
    update public.email_deliveries set
      status = next_status,
      delivered_at = case when next_status = 'delivered'
        then p_event_created_at else null end,
      last_provider_event_at = greatest(
        coalesce(last_provider_event_at, p_event_created_at), p_event_created_at
      ),
      last_error_code = case next_status
        when 'delayed' then 'provider_delayed'
        when 'failed' then 'provider_failed'
        when 'bounced' then 'provider_bounced'
        when 'complained' then 'provider_complained'
        when 'suppressed' then 'provider_suppressed'
        else null
      end
    where id = delivery_row.id;
    return query select false, true, created_suppression;
    return;
  end if;

  return query select false, false, created_suppression;
end;
$$;

revoke all on function public.nile_claim_email_delivery(text, integer)
  from public, anon, authenticated;
revoke all on function public.nile_complete_email_delivery(
  uuid, text, text, text, text, text, integer
) from public, anon, authenticated;
revoke all on function public.nile_record_email_webhook(
  text, text, text, timestamptz, text
) from public, anon, authenticated;

grant execute on function public.nile_claim_email_delivery(text, integer)
  to service_role;
grant execute on function public.nile_complete_email_delivery(
  uuid, text, text, text, text, text, integer
) to service_role;
grant execute on function public.nile_record_email_webhook(
  text, text, text, timestamptz, text
) to service_role;

commit;
