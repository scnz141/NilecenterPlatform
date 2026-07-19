-- Nile Learn normalized account invitation lifecycle.
-- Manual-only. Requires Phase 1, Phase 6A student profiles, and email delivery.
-- No provider credential or plaintext invitation token is stored here.

begin;

do $$
declare
  dependency text;
begin
  foreach dependency in array array[
    'app_users', 'role_grants', 'role_grant_branch_scopes',
    'role_grant_department_scopes', 'staff_profiles', 'staff_subjects',
    'student_profiles', 'auth_sessions', 'command_executions', 'audit_logs',
    'outbox_events', 'email_deliveries'
  ] loop
    if pg_catalog.to_regclass('public.' || dependency) is null then
      raise exception 'Account invitations require public.%', dependency;
    end if;
  end loop;
end;
$$;

create table if not exists public.user_invitations (
  id uuid primary key,
  user_id uuid not null unique references public.app_users(id) on delete restrict,
  role_grant_id uuid not null unique references public.role_grants(id) on delete restrict,
  auth_user_id uuid not null unique references auth.users(id) on delete restrict,
  status text not null default 'queued' check (status in (
    'queued', 'sent', 'delivered', 'accepted', 'expired', 'revoked', 'failed'
  )),
  expires_at timestamptz not null,
  send_count integer not null default 1 check (send_count between 1 and 20),
  last_sent_at timestamptz,
  accepted_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references public.app_users(id) on delete restrict,
  last_email_outbox_event_id uuid unique
    references public.outbox_events(id) on delete restrict,
  created_by uuid not null references public.app_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > created_at),
  check ((status = 'accepted') = (accepted_at is not null)),
  check ((status = 'revoked') = (revoked_at is not null)),
  check (revoked_by is null or revoked_at is not null)
);

create table if not exists public.identity_lifecycle_events (
  id bigint generated always as identity primary key,
  invitation_id uuid not null references public.user_invitations(id) on delete restrict,
  user_id uuid not null references public.app_users(id) on delete restrict,
  auth_user_id uuid not null references auth.users(id) on delete restrict,
  event_type text not null check (event_type in (
    'invitation.accepted', 'invitation.expired', 'invitation.revoked'
  )),
  source text not null check (source in ('verified_auth_identity', 'administrator')),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (invitation_id, event_type),
  check (not nile_private.jsonb_has_forbidden_keys(metadata))
);

create index if not exists user_invitations_status_expiry_idx
  on public.user_invitations (status, expires_at);
create index if not exists identity_lifecycle_events_user_time_idx
  on public.identity_lifecycle_events (user_id, occurred_at desc);

drop trigger if exists user_invitations_set_updated_at on public.user_invitations;
create trigger user_invitations_set_updated_at
before update on public.user_invitations
for each row execute function nile_private.set_updated_at();

alter table public.user_invitations enable row level security;
alter table public.user_invitations force row level security;
alter table public.identity_lifecycle_events enable row level security;
alter table public.identity_lifecycle_events force row level security;

revoke all on table public.user_invitations from public, anon, authenticated, service_role;
revoke all on table public.identity_lifecycle_events from public, anon, authenticated, service_role;
revoke all on sequence public.identity_lifecycle_events_id_seq
  from public, anon, authenticated, service_role;

alter table public.email_deliveries
  drop constraint email_deliveries_template_key_check;
alter table public.email_deliveries
  add constraint email_deliveries_template_key_check check (template_key in (
    'account_invitation', 'account_recovery', 'enrollment_activated',
    'placement_updated', 'schedule_changed', 'attendance_alert',
    'grading_feedback', 'certificate_issued', 'message_notification'
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
      'account_invitation', 'account_recovery', 'enrollment_activated',
      'placement_updated', 'schedule_changed', 'attendance_alert',
      'grading_feedback', 'certificate_issued', 'message_notification'
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

create or replace function public.nile_create_user_invitation_with_evidence(
  p_session_token_hash text,
  p_invitation_id uuid,
  p_auth_user_id uuid,
  p_full_name text,
  p_email text,
  p_phone text,
  p_role text,
  p_branch_ref text,
  p_department_ref text,
  p_title text,
  p_availability_status text,
  p_subjects text[],
  p_teaching_levels text[],
  p_locale text,
  p_activation_envelope text,
  p_expires_at timestamptz,
  p_idempotency_key text,
  p_request_hash text
)
returns table (
  invitation_id uuid,
  user_id uuid,
  role_grant_id uuid,
  outbox_event_id uuid,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_session public.auth_sessions%rowtype;
  actor_grant public.role_grants%rowtype;
  actor_user public.app_users%rowtype;
  command_row public.command_executions%rowtype;
  created_user_id uuid := gen_random_uuid();
  created_grant_id uuid := gen_random_uuid();
  created_profile_id uuid := gen_random_uuid();
  created_command_id uuid := gen_random_uuid();
  created_outbox_id uuid := gen_random_uuid();
  normalized_email text;
  resolved_branch_id uuid;
  resolved_department_id uuid;
  subject_value text;
  level_value text;
begin
  normalized_email := pg_catalog.lower(pg_catalog.btrim(p_email));
  if nullif(pg_catalog.btrim(p_branch_ref), '') is not null then
    select branch.id into resolved_branch_id
    from public.branches as branch
    where branch.id::text = pg_catalog.btrim(p_branch_ref)
      or branch.legacy_id = pg_catalog.btrim(p_branch_ref)
      or branch.code::text = pg_catalog.btrim(p_branch_ref);
  end if;
  if nullif(pg_catalog.btrim(p_department_ref), '') is not null then
    select department.id into resolved_department_id
    from public.departments as department
    where department.id::text = pg_catalog.btrim(p_department_ref)
      or department.legacy_id = pg_catalog.btrim(p_department_ref)
      or department.code::text = pg_catalog.btrim(p_department_ref);
  end if;
  if p_session_token_hash !~ '^[a-f0-9]{64}$'
    or p_request_hash !~ '^[a-f0-9]{64}$'
    or length(p_idempotency_key) not between 12 and 256
    or length(pg_catalog.btrim(p_full_name)) not between 2 and 160
    or normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    or p_role not in ('student', 'teacher', 'registrar', 'headofdepartment', 'branchadmin', 'superadmin')
    or p_locale not in ('en', 'ar', 'zh', 'ru', 'ur', 'tr')
    or p_activation_envelope !~ '^v1\.[A-Za-z0-9_-]+$'
    or length(p_activation_envelope) not between 44 and 16000
    or p_expires_at not between now() + interval '15 minutes' and now() + interval '48 hours' then
    raise exception 'Account invitation request is invalid' using errcode = '22023';
  end if;

  select session.* into strict actor_session
  from public.auth_sessions as session
  where session.token_hash = pg_catalog.decode(p_session_token_hash, 'hex')
    and session.provider = 'supabase'
    and session.revoked_at is null
    and session.expires_at > now()
  for update;

  select app_user.*
  into strict actor_user
  from public.app_users as app_user
  join public.role_grants as role_grant
    on role_grant.id = actor_session.active_role_grant_id
    and role_grant.user_id = app_user.id
  where app_user.id = actor_session.user_id
    and app_user.status = 'active'
    and role_grant.role = 'superadmin'
    and role_grant.status = 'active'
    and role_grant.starts_at <= now()
    and (role_grant.ends_at is null or role_grant.ends_at > now());

  select role_grant.*
  into strict actor_grant
  from public.role_grants as role_grant
  where role_grant.id = actor_session.active_role_grant_id
    and role_grant.user_id = actor_user.id
    and role_grant.role = 'superadmin'
    and role_grant.status = 'active'
    and role_grant.starts_at <= now()
    and (role_grant.ends_at is null or role_grant.ends_at > now());

  select command.* into command_row
  from public.command_executions as command
  where command.idempotency_key = p_idempotency_key;
  if found then
    if command_row.request_hash is distinct from pg_catalog.decode(p_request_hash, 'hex')
      or command_row.command_type <> 'user.invitation.create'
      or command_row.status <> 'succeeded' then
      raise exception 'Account invitation idempotency conflict' using errcode = '23505';
    end if;
    return query
      select invitation.id, invitation.user_id, invitation.role_grant_id,
        invitation.last_email_outbox_event_id, true
      from public.user_invitations as invitation
      where invitation.id = command_row.target_id::uuid;
    return;
  end if;

  if exists (select 1 from public.app_users where email = normalized_email)
    or exists (select 1 from public.app_users where auth_user_id = p_auth_user_id) then
    raise exception 'This email or Auth identity is already registered' using errcode = '23505';
  end if;

  if p_role = 'superadmin' then
    if resolved_branch_id is not null or resolved_department_id is not null then
      raise exception 'Super Admin invitations cannot carry branch or department scope' using errcode = '22023';
    end if;
  elsif p_role in ('student', 'registrar', 'branchadmin') then
    if resolved_branch_id is null or resolved_department_id is not null then
      raise exception 'The selected role requires branch-only scope' using errcode = '22023';
    end if;
  elsif p_role = 'teacher' then
    if resolved_branch_id is null or resolved_department_id is null
      or coalesce(pg_catalog.array_length(p_subjects, 1), 0) = 0
      or coalesce(pg_catalog.array_length(p_teaching_levels, 1), 0) = 0
      or p_availability_status not in ('available', 'limited', 'unavailable') then
      raise exception 'Teacher invitations require branch, department, subjects, and levels' using errcode = '22023';
    end if;
  elsif p_role = 'headofdepartment' and resolved_department_id is null then
    raise exception 'HOD invitations require department scope' using errcode = '22023';
  end if;

  if nullif(pg_catalog.btrim(p_branch_ref), '') is not null
    and resolved_branch_id is null then
    raise exception 'Invitation branch is unavailable' using errcode = '23503';
  end if;
  if resolved_branch_id is not null and not exists (
    select 1 from public.branches where id = resolved_branch_id and status = 'active'
  ) then
    raise exception 'Invitation branch is unavailable' using errcode = '23503';
  end if;
  if nullif(pg_catalog.btrim(p_department_ref), '') is not null
    and resolved_department_id is null then
    raise exception 'Invitation department is unavailable' using errcode = '23503';
  end if;
  if resolved_department_id is not null and not exists (
    select 1 from public.departments where id = resolved_department_id and status = 'active'
  ) then
    raise exception 'Invitation department is unavailable' using errcode = '23503';
  end if;
  if resolved_branch_id is not null and resolved_department_id is not null and not exists (
    select 1 from public.department_branches
    where branch_id = resolved_branch_id and department_id = resolved_department_id
  ) then
    raise exception 'Invitation department is not available in the branch' using errcode = '23503';
  end if;

  insert into public.command_executions (
    id, idempotency_key, actor_user_id, actor_role_grant_id, session_id,
    command_type, target_type, target_id, request_hash, requires_outbox
  ) values (
    created_command_id, p_idempotency_key, actor_user.id, actor_grant.id,
    actor_session.id, 'user.invitation.create', 'UserInvitation',
    p_invitation_id::text, pg_catalog.decode(p_request_hash, 'hex'), true
  );

  insert into public.app_users (
    id, auth_user_id, full_name, email, phone, status
  ) values (
    created_user_id, p_auth_user_id, pg_catalog.btrim(p_full_name),
    normalized_email, nullif(pg_catalog.btrim(p_phone), ''), 'invited'
  );

  insert into public.role_grants (
    id, user_id, role, status, granted_by, granted_reason
  ) values (
    created_grant_id, created_user_id, p_role, 'pending', actor_user.id,
    'Account invitation awaiting verified acceptance'
  );

  if resolved_branch_id is not null then
    insert into public.role_grant_branch_scopes (
      role_grant_id, branch_id, granted_by
    ) values (created_grant_id, resolved_branch_id, actor_user.id);
  end if;
  if resolved_department_id is not null then
    insert into public.role_grant_department_scopes (
      role_grant_id, department_id, granted_by
    ) values (created_grant_id, resolved_department_id, actor_user.id);
  end if;

  if p_role = 'student' then
    insert into public.student_profiles (id, user_id, home_branch_id, status)
    values (created_profile_id, created_user_id, resolved_branch_id, 'active');
  else
    insert into public.staff_profiles (
      id, user_id, title, availability_status, status
    ) values (
      created_profile_id, created_user_id,
      nullif(pg_catalog.btrim(p_title), ''),
      case when p_role = 'teacher' then p_availability_status else 'not_applicable' end,
      'active'
    );

    if p_role = 'teacher' then
      foreach subject_value in array coalesce(p_subjects, array[]::text[]) loop
        foreach level_value in array coalesce(p_teaching_levels, array[]::text[]) loop
          insert into public.staff_subjects (staff_profile_id, subject, teaching_level)
          values (
            created_profile_id, pg_catalog.btrim(subject_value),
            pg_catalog.btrim(level_value)
          );
        end loop;
      end loop;
    end if;
  end if;

  insert into public.user_invitations (
    id, user_id, role_grant_id, auth_user_id, expires_at, created_by
  ) values (
    p_invitation_id, created_user_id, created_grant_id, p_auth_user_id,
    p_expires_at, actor_user.id
  );

  insert into public.audit_logs (
    command_id, actor_user_id, actor_role_grant_id, session_id,
    action, entity_type, entity_id, branch_id, department_id,
    after_state, metadata
  ) values (
    created_command_id, actor_user.id, actor_grant.id, actor_session.id,
    'user.invited', 'User', created_user_id::text, resolved_branch_id, resolved_department_id,
    pg_catalog.jsonb_build_object('status', 'invited', 'role', p_role),
    pg_catalog.jsonb_build_object('invitationId', p_invitation_id, 'delivery', 'queued')
  );

  insert into public.outbox_events (
    id, command_id, event_type, aggregate_type, aggregate_id, payload,
    idempotency_key
  ) values (
    created_outbox_id, created_command_id, 'email.delivery.requested',
    'UserInvitation', p_invitation_id::text,
    pg_catalog.jsonb_build_object(
      'schemaVersion', 1,
      'recipientUserId', created_user_id,
      'templateKey', 'account_invitation',
      'templateVersion', 1,
      'locale', p_locale,
      'variables', pg_catalog.jsonb_build_object(
        'displayName', pg_catalog.btrim(p_full_name),
        'roleLabel', p_role,
        'activationEnvelope', p_activation_envelope,
        'expiresInHours', pg_catalog.ceil(
          extract(epoch from (p_expires_at - now())) / 3600
        )::integer
      )
    ),
    'email.delivery:' || created_outbox_id::text
  );

  update public.user_invitations
  set last_email_outbox_event_id = created_outbox_id
  where id = p_invitation_id;

  update public.command_executions
  set status = 'succeeded', completed_at = now()
  where id = created_command_id;

  return query select p_invitation_id, created_user_id, created_grant_id,
    created_outbox_id, false;
exception
  when no_data_found then
    raise exception 'Current Super Admin session authority is unavailable'
      using errcode = '42501';
end;
$$;

create or replace function public.nile_accept_user_invitation(
  p_invitation_id uuid,
  p_auth_user_id uuid
)
returns table (user_id uuid, role text, accepted_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation public.user_invitations%rowtype;
  grant_row public.role_grants%rowtype;
  accepted_time timestamptz := now();
begin
  select item.* into strict invitation
  from public.user_invitations as item
  where item.id = p_invitation_id
  for update;

  if invitation.auth_user_id is distinct from p_auth_user_id
    or invitation.status not in ('queued', 'sent', 'delivered')
    or invitation.expires_at <= accepted_time then
    raise exception 'Invitation is invalid, expired, or already used'
      using errcode = '42501';
  end if;

  select role_grant.* into strict grant_row
  from public.role_grants as role_grant
  where role_grant.id = invitation.role_grant_id
    and role_grant.user_id = invitation.user_id
    and role_grant.status = 'pending'
  for update;

  update public.app_users
  set status = 'active', activated_at = accepted_time
  where id = invitation.user_id
    and auth_user_id = p_auth_user_id
    and status = 'invited';
  if not found then
    raise exception 'Invited identity is not available for activation'
      using errcode = '42501';
  end if;

  update public.role_grants
  set status = 'active'
  where id = invitation.role_grant_id;

  update public.user_invitations
  set status = 'accepted', accepted_at = accepted_time
  where id = invitation.id;

  insert into public.identity_lifecycle_events (
    invitation_id, user_id, auth_user_id, event_type, source
  ) values (
    invitation.id, invitation.user_id, p_auth_user_id,
    'invitation.accepted', 'verified_auth_identity'
  );

  return query select invitation.user_id, grant_row.role, accepted_time;
exception
  when no_data_found then
    raise exception 'Invitation is unavailable' using errcode = '42501';
end;
$$;

create or replace function public.nile_claim_email_delivery_v2(
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
    raise exception 'Email delivery lease request is invalid' using errcode = '22023';
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

    if not found then return; end if;

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
    where app_user.id = recipient_id
      and (
        app_user.status = 'active'
        or (
          app_user.status = 'invited'
          and event_row.payload->>'templateKey' = 'account_invitation'
        )
      );

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
        attempts = least(attempts + 1, 5), last_error = null, processed_at = null
      where id = event_row.id returning * into event_row;
      insert into public.email_deliveries (
        outbox_event_id, recipient_user_id, template_key, template_version,
        locale, status, attempts, last_error_code
      ) values (
        event_row.id, recipient_id, event_row.payload->>'templateKey', 1,
        event_row.payload->>'locale', 'suppressed', event_row.attempts,
        'recipient_suppressed'
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
      attempts = least(attempts + 1, 5), last_error = null, processed_at = null
    where id = event_row.id returning * into event_row;

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

    return query select delivery_row.id, event_row.id, recipient_id,
      user_row.email::text, delivery_row.template_key,
      delivery_row.template_version, delivery_row.locale,
      event_row.payload->'variables', event_row.idempotency_key,
      delivery_row.attempts;
    return;
  end loop;
end;
$$;

revoke all on function public.nile_create_user_invitation_with_evidence(
  text, uuid, uuid, text, text, text, text, text, text, text, text,
  text[], text[], text, text, timestamptz, text, text
) from public, anon, authenticated;
revoke all on function public.nile_accept_user_invitation(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.nile_claim_email_delivery_v2(text, integer)
  from public, anon, authenticated;

grant execute on function public.nile_create_user_invitation_with_evidence(
  text, uuid, uuid, text, text, text, text, text, text, text, text,
  text[], text[], text, text, timestamptz, text, text
) to service_role;
grant execute on function public.nile_accept_user_invitation(uuid, uuid)
  to service_role;
grant execute on function public.nile_claim_email_delivery_v2(text, integer)
  to service_role;

commit;
