-- Nile Learn normalized admissions application boundary.
-- Manual-only. Apply after 020_normalized_admissions_intake_foundation.sql.
-- The service role calls these RPCs after resolving a durable user session;
-- browser roles receive no direct table or function access.

begin;

do $$
declare
  dependency text;
begin
  foreach dependency in array array[
    'app_users', 'branches', 'role_grants', 'role_grant_branch_scopes',
    'auth_sessions', 'command_executions', 'audit_logs', 'admission_leads'
  ] loop
    if pg_catalog.to_regclass('public.' || dependency) is null then
      raise exception 'Normalized applications require public.%', dependency;
    end if;
  end loop;
end;
$$;

create table if not exists public.admission_applications (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null unique
    references public.admission_leads(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  course_interest text not null,
  schedule_preference text not null,
  source_key text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  version integer not null default 1 check (version > 0),
  created_by uuid not null references public.app_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(btrim(course_interest)) between 2 and 160),
  check (length(btrim(schedule_preference)) between 2 and 240),
  check (source_key is null or length(source_key) between 8 and 256)
);

create unique index if not exists admission_applications_branch_source_uidx
  on public.admission_applications (branch_id, source_key)
  where source_key is not null;
create index if not exists admission_applications_branch_updated_idx
  on public.admission_applications (branch_id, updated_at desc);

drop trigger if exists admission_applications_set_updated_at
  on public.admission_applications;
create trigger admission_applications_set_updated_at
before update on public.admission_applications
for each row execute function nile_private.set_updated_at();

alter table public.admission_applications enable row level security;
alter table public.admission_applications force row level security;
revoke all on table public.admission_applications
  from public, anon, authenticated, service_role;
grant select, insert, update on table public.admission_applications
  to service_role;

create or replace function public.nile_read_admissions_lifecycle_workspace(
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
  leads jsonb;
  applications jsonb;
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
    and role_grant.role in ('registrar', 'superadmin')
    and role_grant.status = 'active'
    and role_grant.starts_at <= now()
    and (role_grant.ends_at is null or role_grant.ends_at > now());

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', lead.id,
    'branchId', lead.branch_id,
    'fullName', lead.full_name,
    'email', lead.email::text,
    'phone', lead.phone,
    'country', lead.country,
    'subject', lead.subject,
    'source', lead.source,
    'status', lead.status,
    'notes', lead.notes,
    'sourceKey', lead.source_key,
    'version', lead.version,
    'createdAt', lead.created_at
  ) order by lead.updated_at desc), '[]'::jsonb)
  into leads
  from public.admission_leads as lead
  where actor_grant.role = 'superadmin'
    or exists (
      select 1
      from public.role_grant_branch_scopes as scope
      where scope.role_grant_id = actor_grant.id
        and scope.branch_id = lead.branch_id
        and scope.starts_at <= now()
        and (scope.ends_at is null or scope.ends_at > now())
    );

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', application.id,
    'leadId', application.lead_id,
    'branchId', application.branch_id,
    'courseInterest', application.course_interest,
    'schedulePreference', application.schedule_preference,
    'sourceKey', application.source_key,
    'status', application.status,
    'version', application.version
  ) order by application.updated_at desc), '[]'::jsonb)
  into applications
  from public.admission_applications as application
  where actor_grant.role = 'superadmin'
    or exists (
      select 1
      from public.role_grant_branch_scopes as scope
      where scope.role_grant_id = actor_grant.id
        and scope.branch_id = application.branch_id
        and scope.starts_at <= now()
        and (scope.ends_at is null or scope.ends_at > now())
    );

  return query select pg_catalog.jsonb_build_object(
    'leads', leads,
    'applications', applications
  );
exception
  when no_data_found then
    raise exception 'Admissions lifecycle authority is unavailable'
      using errcode = '42501';
end;
$$;

create or replace function public.nile_create_admission_application_with_evidence(
  p_session_token_hash text,
  p_branch_ref text,
  p_full_name text,
  p_email text,
  p_phone text,
  p_country text,
  p_course_interest text,
  p_schedule_preference text,
  p_source text,
  p_notes text,
  p_source_key text,
  p_idempotency_key text,
  p_request_hash text
)
returns table (
  command_id uuid,
  application_id uuid,
  lead_id uuid,
  branch_id uuid,
  application_version integer,
  lead_version integer,
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
  lead_uuid uuid := gen_random_uuid();
  application_uuid uuid := gen_random_uuid();
  resolved_branch_id uuid;
  normalized_email text := pg_catalog.lower(pg_catalog.btrim(p_email));
begin
  if p_session_token_hash !~ '^[a-f0-9]{64}$'
    or p_request_hash !~ '^[a-f0-9]{64}$'
    or length(p_idempotency_key) not between 12 and 256
    or length(pg_catalog.btrim(coalesce(p_full_name, ''))) not between 2 and 160
    or normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    or length(pg_catalog.btrim(coalesce(p_phone, ''))) not between 7 and 40
    or length(pg_catalog.btrim(coalesce(p_course_interest, ''))) not between 2 and 160
    or length(pg_catalog.btrim(coalesce(p_schedule_preference, ''))) not between 2 and 240
    or length(pg_catalog.btrim(coalesce(p_country, ''))) > 80
    or length(coalesce(p_notes, '')) > 3000
    or length(coalesce(p_source_key, '')) > 256
    or p_source not in ('website', 'trial_form', 'placement_form', 'whatsapp', 'manual') then
    raise exception 'Admissions application request is invalid'
      using errcode = '22023';
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
    and role_grant.role in ('registrar', 'superadmin')
    and role_grant.status = 'active'
    and role_grant.starts_at <= now()
    and (role_grant.ends_at is null or role_grant.ends_at > now());

  select command.* into existing_command
  from public.command_executions as command
  where command.idempotency_key = p_idempotency_key;
  if found then
    if existing_command.request_hash is distinct from pg_catalog.decode(p_request_hash, 'hex')
      or existing_command.command_type <> 'application.create'
      or existing_command.actor_user_id <> actor_user.id
      or existing_command.status <> 'succeeded' then
      raise exception 'Application idempotency conflict' using errcode = '23505';
    end if;
    return query
      select existing_command.id, application.id, application.lead_id,
        application.branch_id, application.version, lead.version, true
      from public.admission_applications as application
      join public.admission_leads as lead on lead.id = application.lead_id
      where application.id = existing_command.target_id::uuid;
    return;
  end if;

  select branch.id into resolved_branch_id
  from public.branches as branch
  where (branch.id::text = pg_catalog.btrim(p_branch_ref)
      or branch.legacy_id = pg_catalog.btrim(p_branch_ref)
      or branch.code::text = pg_catalog.btrim(p_branch_ref))
    and branch.status = 'active';
  if resolved_branch_id is null then
    raise exception 'Admissions branch is unavailable' using errcode = '23503';
  end if;
  if actor_grant.role = 'registrar' and not exists (
    select 1 from public.role_grant_branch_scopes as scope
    where scope.role_grant_id = actor_grant.id
      and scope.branch_id = resolved_branch_id
      and scope.starts_at <= now()
      and (scope.ends_at is null or scope.ends_at > now())
  ) then
    raise exception 'Admissions branch is outside the current scope'
      using errcode = '42501';
  end if;
  if exists (
    select 1
    from public.admission_leads as lead
    where lead.branch_id = resolved_branch_id
      and lead.email = normalized_email
      and lead.status <> 'cancelled'
  ) then
    raise exception 'An active admissions record already exists for this email'
      using errcode = '23505';
  end if;

  insert into public.command_executions (
    id, idempotency_key, actor_user_id, actor_role_grant_id, session_id,
    command_type, target_type, target_id, request_hash, requires_outbox
  ) values (
    command_uuid, p_idempotency_key, actor_user.id, actor_grant.id,
    actor_session.id, 'application.create', 'Application',
    application_uuid::text, pg_catalog.decode(p_request_hash, 'hex'), false
  );

  insert into public.admission_leads (
    id, branch_id, full_name, email, phone, country, subject, source,
    status, notes, source_key, created_by
  ) values (
    lead_uuid, resolved_branch_id, pg_catalog.btrim(p_full_name),
    normalized_email, pg_catalog.btrim(p_phone),
    nullif(pg_catalog.btrim(p_country), ''),
    pg_catalog.btrim(p_course_interest), p_source, 'ready_to_enroll',
    nullif(pg_catalog.btrim(p_notes), ''),
    nullif(pg_catalog.btrim(p_source_key), ''), actor_user.id
  );

  insert into public.admission_applications (
    id, lead_id, branch_id, course_interest, schedule_preference,
    source_key, created_by
  ) values (
    application_uuid, lead_uuid, resolved_branch_id,
    pg_catalog.btrim(p_course_interest),
    pg_catalog.btrim(p_schedule_preference),
    nullif(pg_catalog.btrim(p_source_key), ''), actor_user.id
  );

  insert into public.audit_logs (
    command_id, actor_user_id, actor_role_grant_id, session_id,
    action, entity_type, entity_id, branch_id, after_state, metadata
  ) values
  (
    command_uuid, actor_user.id, actor_grant.id, actor_session.id,
    'lead.created', 'Lead', lead_uuid::text, resolved_branch_id,
    pg_catalog.jsonb_build_object('status', 'ready_to_enroll', 'version', 1),
    pg_catalog.jsonb_build_object('source', p_source)
  ),
  (
    command_uuid, actor_user.id, actor_grant.id, actor_session.id,
    'application.created', 'Application', application_uuid::text,
    resolved_branch_id,
    pg_catalog.jsonb_build_object('status', 'pending', 'version', 1),
    pg_catalog.jsonb_build_object(
      'summary', 'Created application for ' || pg_catalog.btrim(p_full_name) || '.'
    )
  );

  update public.command_executions
  set status = 'succeeded', completed_at = now()
  where id = command_uuid;

  return query select command_uuid, application_uuid, lead_uuid,
    resolved_branch_id, 1, 1, false;
exception
  when no_data_found then
    raise exception 'Admissions application authority is unavailable'
      using errcode = '42501';
end;
$$;

create or replace function public.nile_convert_admission_lead_with_evidence(
  p_session_token_hash text,
  p_lead_id uuid,
  p_branch_ref text,
  p_expected_version integer,
  p_idempotency_key text,
  p_request_hash text
)
returns table (
  command_id uuid,
  application_id uuid,
  lead_id uuid,
  branch_id uuid,
  application_version integer,
  lead_version integer,
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
  lead public.admission_leads%rowtype;
  existing_command public.command_executions%rowtype;
  command_uuid uuid := gen_random_uuid();
  application_uuid uuid := gen_random_uuid();
  requested_branch_id uuid;
begin
  if p_session_token_hash !~ '^[a-f0-9]{64}$'
    or p_request_hash !~ '^[a-f0-9]{64}$'
    or p_expected_version < 1
    or length(p_idempotency_key) not between 12 and 256 then
    raise exception 'Lead conversion request is invalid' using errcode = '22023';
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
  where app_user.id = actor_session.user_id and app_user.status = 'active';
  select role_grant.* into strict actor_grant
  from public.role_grants as role_grant
  where role_grant.id = actor_session.active_role_grant_id
    and role_grant.user_id = actor_user.id
    and role_grant.role in ('registrar', 'superadmin')
    and role_grant.status = 'active'
    and role_grant.starts_at <= now()
    and (role_grant.ends_at is null or role_grant.ends_at > now());

  select command.* into existing_command
  from public.command_executions as command
  where command.idempotency_key = p_idempotency_key;
  if found then
    if existing_command.request_hash is distinct from pg_catalog.decode(p_request_hash, 'hex')
      or existing_command.command_type <> 'lead.convert'
      or existing_command.actor_user_id <> actor_user.id
      or existing_command.status <> 'succeeded' then
      raise exception 'Lead conversion idempotency conflict' using errcode = '23505';
    end if;
    return query
      select existing_command.id, application.id, application.lead_id,
        application.branch_id, application.version, source_lead.version, true
      from public.admission_applications as application
      join public.admission_leads as source_lead
        on source_lead.id = application.lead_id
      where application.id = existing_command.target_id::uuid;
    return;
  end if;

  select item.* into strict lead
  from public.admission_leads as item
  where item.id = p_lead_id
  for update;

  if actor_grant.role = 'registrar' and not exists (
    select 1 from public.role_grant_branch_scopes as scope
    where scope.role_grant_id = actor_grant.id
      and scope.branch_id = lead.branch_id
      and scope.starts_at <= now()
      and (scope.ends_at is null or scope.ends_at > now())
  ) then
    raise exception 'Lead is outside the current admissions scope'
      using errcode = '42501';
  end if;
  if nullif(pg_catalog.btrim(p_branch_ref), '') is not null then
    select branch.id into requested_branch_id
    from public.branches as branch
    where branch.id::text = pg_catalog.btrim(p_branch_ref)
      or branch.legacy_id = pg_catalog.btrim(p_branch_ref)
      or branch.code::text = pg_catalog.btrim(p_branch_ref);
    if requested_branch_id is distinct from lead.branch_id then
      raise exception 'Lead branch changes require an explicit transfer'
        using errcode = '22023';
    end if;
  end if;
  if lead.version <> p_expected_version then
    raise exception 'Lead version conflict' using errcode = '40001';
  end if;
  if lead.status in ('enrolled', 'active', 'cancelled') then
    raise exception 'Lead cannot be converted from its current status'
      using errcode = '22023';
  end if;
  if exists (
    select 1 from public.admission_applications as application
    where application.lead_id = lead.id
  ) then
    raise exception 'Lead already has an application' using errcode = '23505';
  end if;

  insert into public.command_executions (
    id, idempotency_key, actor_user_id, actor_role_grant_id, session_id,
    command_type, target_type, target_id, request_hash, requires_outbox
  ) values (
    command_uuid, p_idempotency_key, actor_user.id, actor_grant.id,
    actor_session.id, 'lead.convert', 'Application', application_uuid::text,
    pg_catalog.decode(p_request_hash, 'hex'), false
  );

  insert into public.admission_applications (
    id, lead_id, branch_id, course_interest, schedule_preference, created_by
  ) values (
    application_uuid, lead.id, lead.branch_id, lead.subject, 'To confirm',
    actor_user.id
  );
  update public.admission_leads
  set status = 'ready_to_enroll', version = version + 1
  where id = lead.id;

  insert into public.audit_logs (
    command_id, actor_user_id, actor_role_grant_id, session_id,
    action, entity_type, entity_id, branch_id, before_state, after_state, metadata
  ) values (
    command_uuid, actor_user.id, actor_grant.id, actor_session.id,
    'lead.converted', 'Application', application_uuid::text, lead.branch_id,
    pg_catalog.jsonb_build_object(
      'leadStatus', lead.status,
      'leadVersion', lead.version
    ),
    pg_catalog.jsonb_build_object(
      'applicationStatus', 'pending',
      'applicationVersion', 1,
      'leadStatus', 'ready_to_enroll',
      'leadVersion', lead.version + 1
    ),
    pg_catalog.jsonb_build_object(
      'summary', 'Converted admissions lead to application.'
    )
  );

  update public.command_executions
  set status = 'succeeded', completed_at = now()
  where id = command_uuid;
  return query select command_uuid, application_uuid, lead.id, lead.branch_id,
    1, lead.version + 1, false;
exception
  when no_data_found then
    raise exception 'Lead conversion authority is unavailable'
      using errcode = '42501';
end;
$$;

revoke all on function public.nile_read_admissions_lifecycle_workspace(text)
  from public, anon, authenticated;
revoke all on function public.nile_create_admission_application_with_evidence(
  text, text, text, text, text, text, text, text, text, text, text, text, text
) from public, anon, authenticated;
revoke all on function public.nile_convert_admission_lead_with_evidence(
  text, uuid, text, integer, text, text
) from public, anon, authenticated;
grant execute on function public.nile_read_admissions_lifecycle_workspace(text)
  to service_role;
grant execute on function public.nile_create_admission_application_with_evidence(
  text, text, text, text, text, text, text, text, text, text, text, text, text
) to service_role;
grant execute on function public.nile_convert_admission_lead_with_evidence(
  text, uuid, text, integer, text, text
) to service_role;

commit;
