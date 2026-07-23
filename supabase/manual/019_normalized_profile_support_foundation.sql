-- Nile Learn normalized self-profile and support foundation.
-- Manual-only. Apply after Phase 1 identity/session/audit and Phase 6A student profiles.
-- Browser roles receive no direct table or function access.

begin;

do $$
declare
  dependency text;
begin
  foreach dependency in array array[
    'app_users', 'branches', 'departments', 'role_grants',
    'role_grant_branch_scopes', 'role_grant_department_scopes',
    'staff_profiles', 'staff_subjects', 'student_profiles', 'auth_sessions',
    'command_executions', 'audit_logs'
  ] loop
    if pg_catalog.to_regclass('public.' || dependency) is null then
      raise exception 'Normalized profile/support requires public.%', dependency;
    end if;
  end loop;
end;
$$;

alter table public.app_users
  add column if not exists profile_version integer not null default 1
    check (profile_version > 0);

alter table public.student_profiles
  add column if not exists country text not null default '',
  add column if not exists age_group text,
  add column if not exists guardian_name text,
  add column if not exists guardian_phone text;

create table if not exists public.user_preferences (
  user_id uuid primary key references public.app_users(id) on delete restrict,
  preferred_language text not null default 'English'
    check (preferred_language in (
      'English', 'Arabic', 'Chinese', 'Russian', 'Urdu', 'Turkish'
    )),
  timezone text not null default 'Africa/Cairo',
  notification_preferences jsonb not null default jsonb_build_object(
    'messages', true,
    'schedule', true,
    'academic', true,
    'billing', false,
    'system', false
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references public.app_users(id) on delete restrict,
  subject text not null,
  details text not null,
  category text not null,
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'resolved', 'closed')),
  source_key text,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(btrim(subject)) between 4 and 160),
  check (length(btrim(details)) between 20 and 3000),
  check (length(btrim(category)) between 2 and 80),
  check (source_key is null or length(source_key) between 8 and 256)
);

create unique index if not exists support_tickets_requester_source_uidx
  on public.support_tickets (requester_user_id, source_key)
  where source_key is not null;
create index if not exists support_tickets_requester_updated_idx
  on public.support_tickets (requester_user_id, updated_at desc);

create or replace function nile_private.notification_preferences_are_safe(payload jsonb)
returns boolean
language sql
immutable
strict
security invoker
set search_path = ''
as $$
  select pg_catalog.jsonb_typeof(payload) = 'object'
    and (
      select pg_catalog.array_agg(key order by key)
      from pg_catalog.jsonb_object_keys(payload) as key
    ) = array['academic', 'billing', 'messages', 'schedule', 'system']::text[]
    and not exists (
      select 1
      from pg_catalog.jsonb_each(payload) as item
      where pg_catalog.jsonb_typeof(item.value) <> 'boolean'
    );
$$;

alter table public.user_preferences
  drop constraint if exists user_preferences_notification_preferences_check;
alter table public.user_preferences
  add constraint user_preferences_notification_preferences_check
  check (nile_private.notification_preferences_are_safe(notification_preferences));

insert into public.user_preferences (user_id)
select app_user.id
from public.app_users as app_user
on conflict (user_id) do nothing;

drop trigger if exists user_preferences_set_updated_at on public.user_preferences;
create trigger user_preferences_set_updated_at
before update on public.user_preferences
for each row execute function nile_private.set_updated_at();

drop trigger if exists support_tickets_set_updated_at on public.support_tickets;
create trigger support_tickets_set_updated_at
before update on public.support_tickets
for each row execute function nile_private.set_updated_at();

alter table public.user_preferences enable row level security;
alter table public.user_preferences force row level security;
alter table public.support_tickets enable row level security;
alter table public.support_tickets force row level security;

revoke all on table public.user_preferences
  from public, anon, authenticated, service_role;
revoke all on table public.support_tickets
  from public, anon, authenticated, service_role;
grant select, insert, update on table public.user_preferences to service_role;
grant select, insert, update on table public.support_tickets to service_role;

create or replace function public.nile_read_self_workspace(
  p_session_token_hash text
)
returns table (workspace jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_session public.auth_sessions%rowtype;
  actor_user public.app_users%rowtype;
  actor_grant public.role_grants%rowtype;
  preference public.user_preferences%rowtype;
  student jsonb;
  staff jsonb;
  branches jsonb;
  departments jsonb;
  tickets jsonb;
  audits jsonb;
begin
  if p_session_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Session token hash is invalid' using errcode = '22023';
  end if;

  select session.* into strict actor_session
  from public.auth_sessions as session
  where session.token_hash = pg_catalog.decode(p_session_token_hash, 'hex')
    and session.provider = 'supabase'
    and session.revoked_at is null
    and session.expires_at > now();

  select app_user.* into strict actor_user
  from public.app_users as app_user
  where app_user.id = actor_session.user_id
    and app_user.status = 'active';

  select role_grant.* into strict actor_grant
  from public.role_grants as role_grant
  where role_grant.id = actor_session.active_role_grant_id
    and role_grant.user_id = actor_user.id
    and role_grant.status = 'active'
    and role_grant.starts_at <= now()
    and (role_grant.ends_at is null or role_grant.ends_at > now());

  insert into public.user_preferences (user_id)
  values (actor_user.id)
  on conflict (user_id) do nothing;

  select item.* into strict preference
  from public.user_preferences as item
  where item.user_id = actor_user.id;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', branch.id,
    'name', branch.name,
    'code', branch.code::text,
    'timezone', branch.timezone,
    'address', coalesce(branch.address->>'display', ''),
    'status', branch.status
  ) order by branch.name), '[]'::jsonb)
  into branches
  from public.role_grant_branch_scopes as scope
  join public.branches as branch on branch.id = scope.branch_id
  where scope.role_grant_id = actor_grant.id
    and scope.starts_at <= now()
    and (scope.ends_at is null or scope.ends_at > now());

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', department.id,
    'name', department.name,
    'status', department.status
  ) order by department.name), '[]'::jsonb)
  into departments
  from public.role_grant_department_scopes as scope
  join public.departments as department on department.id = scope.department_id
  where scope.role_grant_id = actor_grant.id
    and scope.starts_at <= now()
    and (scope.ends_at is null or scope.ends_at > now());

  if actor_grant.role = 'student' then
    select pg_catalog.jsonb_build_object(
      'id', profile.id,
      'status', profile.status,
      'country', profile.country,
      'ageGroup', profile.age_group,
      'guardianName', profile.guardian_name,
      'guardianPhone', profile.guardian_phone
    ) into student
    from public.student_profiles as profile
    where profile.user_id = actor_user.id;
  else
    select pg_catalog.jsonb_build_object(
      'id', profile.id,
      'title', profile.title,
      'availabilityStatus', profile.availability_status,
      'status', profile.status,
      'subjects', coalesce((
        select pg_catalog.jsonb_agg(distinct subject.subject order by subject.subject)
        from public.staff_subjects as subject
        where subject.staff_profile_id = profile.id
      ), '[]'::jsonb),
      'teachingLevels', coalesce((
        select pg_catalog.jsonb_agg(distinct subject.teaching_level order by subject.teaching_level)
        from public.staff_subjects as subject
        where subject.staff_profile_id = profile.id
          and subject.teaching_level is not null
      ), '[]'::jsonb)
    ) into staff
    from public.staff_profiles as profile
    where profile.user_id = actor_user.id;
  end if;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', ticket.id,
    'subject', ticket.subject,
    'details', ticket.details,
    'category', ticket.category,
    'priority', ticket.priority,
    'status', ticket.status,
    'sourceKey', ticket.source_key,
    'version', ticket.version,
    'updatedAt', ticket.updated_at
  ) order by ticket.updated_at desc), '[]'::jsonb)
  into tickets
  from (
    select item.*
    from public.support_tickets as item
    where item.requester_user_id = actor_user.id
    order by item.updated_at desc
    limit 100
  ) as ticket;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', audit.id::text,
    'action', audit.action,
    'entityType', audit.entity_type,
    'entityId', audit.entity_id,
    'summary', audit.metadata->>'summary',
    'occurredAt', audit.occurred_at
  ) order by audit.occurred_at desc), '[]'::jsonb)
  into audits
  from (
    select item.*
    from public.audit_logs as item
    where item.actor_user_id = actor_user.id
    order by item.occurred_at desc
    limit 30
  ) as audit;

  return query select pg_catalog.jsonb_build_object(
    'user', pg_catalog.jsonb_build_object(
      'id', actor_user.id,
      'fullName', actor_user.full_name,
      'email', actor_user.email::text,
      'phone', actor_user.phone,
      'status', actor_user.status,
      'profileVersion', actor_user.profile_version,
      'preferredLanguage', preference.preferred_language,
      'timezone', preference.timezone,
      'notificationPreferences', preference.notification_preferences
    ),
    'branches', branches,
    'departments', departments,
    'student', student,
    'staff', staff,
    'supportTickets', tickets,
    'auditLogs', audits
  );
exception
  when no_data_found then
    raise exception 'Current normalized session authority is unavailable'
      using errcode = '42501';
end;
$$;

create or replace function public.nile_update_self_profile_with_evidence(
  p_session_token_hash text,
  p_full_name text,
  p_phone text,
  p_preferred_language text,
  p_timezone text,
  p_notification_preferences jsonb,
  p_country text,
  p_guardian_name text,
  p_guardian_phone text,
  p_title text,
  p_availability_status text,
  p_expected_version integer,
  p_idempotency_key text,
  p_request_hash text
)
returns table (
  command_id uuid,
  user_id uuid,
  profile_version integer,
  changed_fields jsonb,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_session public.auth_sessions%rowtype;
  actor_user public.app_users%rowtype;
  actor_grant public.role_grants%rowtype;
  existing_command public.command_executions%rowtype;
  command_uuid uuid := gen_random_uuid();
  fields text[] := array[]::text[];
  next_version integer;
  student_row public.student_profiles%rowtype;
  staff_row public.staff_profiles%rowtype;
begin
  if p_session_token_hash !~ '^[a-f0-9]{64}$'
    or p_request_hash !~ '^[a-f0-9]{64}$'
    or length(p_idempotency_key) not between 12 and 256
    or p_expected_version < 1
    or length(btrim(coalesce(p_full_name, ''))) not between 2 and 160
    or length(btrim(coalesce(p_phone, ''))) > 40
    or p_preferred_language not in (
      'English', 'Arabic', 'Chinese', 'Russian', 'Urdu', 'Turkish'
    )
    or length(btrim(coalesce(p_timezone, ''))) not between 1 and 80
    or not nile_private.notification_preferences_are_safe(p_notification_preferences)
    or length(btrim(coalesce(p_country, ''))) > 80
    or length(btrim(coalesce(p_guardian_name, ''))) > 120
    or length(btrim(coalesce(p_guardian_phone, ''))) > 40
    or length(btrim(coalesce(p_title, ''))) > 80 then
    raise exception 'Profile update request is invalid' using errcode = '22023';
  end if;

  select session.* into strict actor_session
  from public.auth_sessions as session
  where session.token_hash = pg_catalog.decode(p_session_token_hash, 'hex')
    and session.provider = 'supabase'
    and session.revoked_at is null
    and session.expires_at > now()
  for update;

  select app_user.* into strict actor_user
  from public.app_users as app_user
  where app_user.id = actor_session.user_id
    and app_user.status = 'active'
  for update;

  select role_grant.* into strict actor_grant
  from public.role_grants as role_grant
  where role_grant.id = actor_session.active_role_grant_id
    and role_grant.user_id = actor_user.id
    and role_grant.status = 'active'
    and role_grant.starts_at <= now()
    and (role_grant.ends_at is null or role_grant.ends_at > now());

  select command.* into existing_command
  from public.command_executions as command
  where command.idempotency_key = p_idempotency_key;
  if found then
    if existing_command.request_hash is distinct from pg_catalog.decode(p_request_hash, 'hex')
      or existing_command.command_type <> 'profile.update'
      or existing_command.actor_user_id <> actor_user.id
      or existing_command.status <> 'succeeded' then
      raise exception 'Profile update idempotency conflict' using errcode = '23505';
    end if;
    return query
      select existing_command.id, actor_user.id, actor_user.profile_version,
        coalesce(audit.metadata->'changedFields', '[]'::jsonb), true
      from public.audit_logs as audit
      where audit.command_id = existing_command.id
        and audit.action = 'profile.updated';
    return;
  end if;

  if actor_user.profile_version <> p_expected_version then
    raise exception 'Profile version conflict' using errcode = '40001';
  end if;

  insert into public.command_executions (
    id, idempotency_key, actor_user_id, actor_role_grant_id, session_id,
    command_type, target_type, target_id, request_hash, requires_outbox
  ) values (
    command_uuid, p_idempotency_key, actor_user.id, actor_grant.id,
    actor_session.id, 'profile.update', 'User', actor_user.id::text,
    pg_catalog.decode(p_request_hash, 'hex'), false
  );

  if actor_user.full_name is distinct from btrim(p_full_name) then
    fields := pg_catalog.array_append(fields, 'name');
  end if;
  if actor_user.phone is distinct from nullif(btrim(p_phone), '') then
    fields := pg_catalog.array_append(fields, 'phone');
  end if;

  insert into public.user_preferences (
    user_id, preferred_language, timezone, notification_preferences
  ) values (
    actor_user.id, p_preferred_language, btrim(p_timezone),
    p_notification_preferences
  ) on conflict on constraint user_preferences_pkey do update set
    preferred_language = excluded.preferred_language,
    timezone = excluded.timezone,
    notification_preferences = excluded.notification_preferences;

  if actor_grant.role = 'student' then
    select profile.* into strict student_row
    from public.student_profiles as profile
    where profile.user_id = actor_user.id
    for update;
    if btrim(coalesce(student_row.age_group, '')) ~* '^(child|minor|teen)' and
      (nullif(btrim(p_guardian_name), '') is null or
       nullif(btrim(p_guardian_phone), '') is null) then
      raise exception 'Guardian name and phone are required for a minor student'
        using errcode = '22023';
    end if;
    update public.student_profiles set
      country = btrim(p_country),
      guardian_name = nullif(btrim(p_guardian_name), ''),
      guardian_phone = nullif(btrim(p_guardian_phone), '')
    where id = student_row.id;
  else
    select profile.* into strict staff_row
    from public.staff_profiles as profile
    where profile.user_id = actor_user.id
    for update;
    if nullif(btrim(p_title), '') is null then
      raise exception 'Staff profile title is required' using errcode = '22023';
    end if;
    if actor_grant.role = 'teacher' then
      if p_availability_status not in ('available', 'limited', 'unavailable') then
        raise exception 'Teacher availability is invalid' using errcode = '22023';
      end if;
    elsif p_availability_status is not null and
      p_availability_status <> 'not_applicable' then
      raise exception 'Availability can only be updated by teachers'
        using errcode = '22023';
    end if;
    update public.staff_profiles set
      title = btrim(p_title),
      availability_status = case
        when actor_grant.role = 'teacher' then p_availability_status
        else 'not_applicable'
      end
    where id = staff_row.id;
  end if;

  if fields = array[]::text[] then
    fields := array['preferences'];
  else
    fields := pg_catalog.array_append(fields, 'preferences');
  end if;
  next_version := actor_user.profile_version + 1;
  update public.app_users set
    full_name = btrim(p_full_name),
    phone = nullif(btrim(p_phone), ''),
    profile_version = next_version
  where id = actor_user.id;

  insert into public.audit_logs (
    command_id, actor_user_id, actor_role_grant_id, session_id,
    action, entity_type, entity_id, before_state, after_state, metadata
  ) values (
    command_uuid, actor_user.id, actor_grant.id, actor_session.id,
    'profile.updated', 'User', actor_user.id::text,
    pg_catalog.jsonb_build_object('version', actor_user.profile_version),
    pg_catalog.jsonb_build_object('version', next_version),
    pg_catalog.jsonb_build_object(
      'changedFields', pg_catalog.to_jsonb(fields),
      'summary', 'Updated own profile.'
    )
  );

  update public.command_executions
  set status = 'succeeded', completed_at = now()
  where id = command_uuid;

  return query select command_uuid, actor_user.id, next_version,
    pg_catalog.to_jsonb(fields), false;
exception
  when no_data_found then
    raise exception 'Current normalized profile authority is unavailable'
      using errcode = '42501';
end;
$$;

create or replace function public.nile_create_support_ticket_with_evidence(
  p_session_token_hash text,
  p_subject text,
  p_details text,
  p_category text,
  p_priority text,
  p_source_key text,
  p_idempotency_key text,
  p_request_hash text
)
returns table (
  command_id uuid,
  ticket_id uuid,
  ticket_version integer,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_session public.auth_sessions%rowtype;
  actor_user public.app_users%rowtype;
  actor_grant public.role_grants%rowtype;
  existing_command public.command_executions%rowtype;
  command_uuid uuid := gen_random_uuid();
  ticket_uuid uuid := gen_random_uuid();
begin
  if p_session_token_hash !~ '^[a-f0-9]{64}$'
    or p_request_hash !~ '^[a-f0-9]{64}$'
    or length(p_idempotency_key) not between 12 and 256
    or length(btrim(coalesce(p_subject, ''))) not between 4 and 160
    or length(btrim(coalesce(p_details, ''))) not between 20 and 3000
    or length(btrim(coalesce(p_category, ''))) not between 2 and 80
    or p_priority not in ('low', 'normal', 'high', 'urgent')
    or length(coalesce(p_source_key, '')) > 256 then
    raise exception 'Support ticket request is invalid' using errcode = '22023';
  end if;

  select session.* into strict actor_session
  from public.auth_sessions as session
  where session.token_hash = pg_catalog.decode(p_session_token_hash, 'hex')
    and session.provider = 'supabase'
    and session.revoked_at is null
    and session.expires_at > now()
  for update;

  select app_user.* into strict actor_user
  from public.app_users as app_user
  where app_user.id = actor_session.user_id
    and app_user.status = 'active';

  select role_grant.* into strict actor_grant
  from public.role_grants as role_grant
  where role_grant.id = actor_session.active_role_grant_id
    and role_grant.user_id = actor_user.id
    and role_grant.role = 'student'
    and role_grant.status = 'active'
    and role_grant.starts_at <= now()
    and (role_grant.ends_at is null or role_grant.ends_at > now());

  select command.* into existing_command
  from public.command_executions as command
  where command.idempotency_key = p_idempotency_key;
  if found then
    if existing_command.request_hash is distinct from pg_catalog.decode(p_request_hash, 'hex')
      or existing_command.command_type <> 'support.ticket.create'
      or existing_command.actor_user_id <> actor_user.id
      or existing_command.status <> 'succeeded' then
      raise exception 'Support ticket idempotency conflict' using errcode = '23505';
    end if;
    return query
      select existing_command.id, ticket.id, ticket.version, true
      from public.support_tickets as ticket
      where ticket.id = existing_command.target_id::uuid;
    return;
  end if;

  insert into public.command_executions (
    id, idempotency_key, actor_user_id, actor_role_grant_id, session_id,
    command_type, target_type, target_id, request_hash, requires_outbox
  ) values (
    command_uuid, p_idempotency_key, actor_user.id, actor_grant.id,
    actor_session.id, 'support.ticket.create', 'SupportTicket',
    ticket_uuid::text, pg_catalog.decode(p_request_hash, 'hex'), false
  );

  insert into public.support_tickets (
    id, requester_user_id, subject, details, category, priority, source_key
  ) values (
    ticket_uuid, actor_user.id, btrim(p_subject), btrim(p_details),
    btrim(p_category), p_priority, nullif(btrim(p_source_key), '')
  );

  insert into public.audit_logs (
    command_id, actor_user_id, actor_role_grant_id, session_id,
    action, entity_type, entity_id, after_state, metadata
  ) values (
    command_uuid, actor_user.id, actor_grant.id, actor_session.id,
    'support.ticket_created', 'SupportTicket', ticket_uuid::text,
    pg_catalog.jsonb_build_object('status', 'pending', 'version', 1),
    pg_catalog.jsonb_build_object(
      'category', btrim(p_category),
      'priority', p_priority,
      'summary', 'Created support ticket: ' || btrim(p_subject) || '.'
    )
  );

  update public.command_executions
  set status = 'succeeded', completed_at = now()
  where id = command_uuid;

  return query select command_uuid, ticket_uuid, 1, false;
exception
  when no_data_found then
    raise exception 'Student support authority is unavailable'
      using errcode = '42501';
end;
$$;

revoke all on function public.nile_read_self_workspace(text)
  from public, anon, authenticated;
revoke all on function public.nile_update_self_profile_with_evidence(
  text, text, text, text, text, jsonb, text, text, text, text, text,
  integer, text, text
) from public, anon, authenticated;
revoke all on function public.nile_create_support_ticket_with_evidence(
  text, text, text, text, text, text, text, text
) from public, anon, authenticated;

grant execute on function public.nile_read_self_workspace(text)
  to service_role;
grant execute on function public.nile_update_self_profile_with_evidence(
  text, text, text, text, text, jsonb, text, text, text, text, text,
  integer, text, text
) to service_role;
grant execute on function public.nile_create_support_ticket_with_evidence(
  text, text, text, text, text, text, text, text
) to service_role;

commit;
