-- Nile Learn normalized placement booking and result boundary.
-- Manual-only. Apply after 021_normalized_application_conversion_foundation.sql.

begin;

do $$
declare
  dependency text;
begin
  foreach dependency in array array[
    'app_users', 'branches', 'role_grants', 'role_grant_branch_scopes',
    'auth_sessions', 'command_executions', 'audit_logs', 'admission_leads',
    'admission_applications'
  ] loop
    if pg_catalog.to_regclass('public.' || dependency) is null then
      raise exception 'Normalized placement requires public.%', dependency;
    end if;
  end loop;
end;
$$;

create table if not exists public.admission_placement_bookings (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.admission_leads(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  full_name text not null,
  email citext not null,
  phone text not null,
  subject text not null,
  preferred_date date not null,
  current_level text not null,
  recommended_level text,
  source_key text,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'cancelled')),
  version integer not null default 1 check (version > 0),
  created_by uuid not null references public.app_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(btrim(full_name)) between 2 and 160),
  check (email::text ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  check (length(btrim(phone)) between 7 and 40),
  check (length(btrim(subject)) between 2 and 160),
  check (length(btrim(current_level)) between 2 and 160),
  check (recommended_level is null or length(btrim(recommended_level)) between 2 and 160),
  check (source_key is null or length(source_key) between 8 and 256)
);

create unique index if not exists admission_placement_one_pending_uidx
  on public.admission_placement_bookings (lead_id)
  where status = 'pending';
create unique index if not exists admission_placement_branch_source_uidx
  on public.admission_placement_bookings (branch_id, source_key)
  where source_key is not null;
create index if not exists admission_placement_branch_date_idx
  on public.admission_placement_bookings (branch_id, preferred_date, updated_at desc);

create table if not exists public.admission_placement_results (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique
    references public.admission_placement_bookings(id) on delete restrict,
  examiner_user_id uuid not null references public.app_users(id) on delete restrict,
  score numeric(5, 2) not null check (score between 0 and 100),
  recommended_level text not null,
  notes text not null,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(btrim(recommended_level)) between 2 and 160),
  check (length(btrim(notes)) between 4 and 3000)
);

drop trigger if exists admission_placement_bookings_set_updated_at
  on public.admission_placement_bookings;
create trigger admission_placement_bookings_set_updated_at
before update on public.admission_placement_bookings
for each row execute function nile_private.set_updated_at();
drop trigger if exists admission_placement_results_set_updated_at
  on public.admission_placement_results;
create trigger admission_placement_results_set_updated_at
before update on public.admission_placement_results
for each row execute function nile_private.set_updated_at();

alter table public.admission_placement_bookings enable row level security;
alter table public.admission_placement_bookings force row level security;
alter table public.admission_placement_results enable row level security;
alter table public.admission_placement_results force row level security;
revoke all on table public.admission_placement_bookings
  from public, anon, authenticated, service_role;
revoke all on table public.admission_placement_results
  from public, anon, authenticated, service_role;
grant select, insert, update on table public.admission_placement_bookings
  to service_role;
grant select, insert, update on table public.admission_placement_results
  to service_role;

create or replace function public.nile_read_admissions_placement_workspace(
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
  base_workspace jsonb;
  bookings jsonb;
  results jsonb;
begin
  select lifecycle.workspace into strict base_workspace
  from public.nile_read_admissions_lifecycle_workspace(
    p_session_token_hash
  ) as lifecycle;

  select session.* into strict actor_session
  from public.auth_sessions as session
  where session.token_hash = pg_catalog.decode(p_session_token_hash, 'hex')
    and session.provider = 'supabase'
    and session.revoked_at is null
    and session.expires_at > now();
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

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', booking.id,
    'leadId', booking.lead_id,
    'fullName', booking.full_name,
    'email', booking.email::text,
    'phone', booking.phone,
    'branchId', booking.branch_id,
    'subject', booking.subject,
    'preferredDate', booking.preferred_date,
    'currentLevel', booking.current_level,
    'sourceKey', booking.source_key,
    'status', booking.status,
    'recommendedLevel', booking.recommended_level,
    'version', booking.version
  ) order by booking.preferred_date, booking.updated_at desc), '[]'::jsonb)
  into bookings
  from public.admission_placement_bookings as booking
  where actor_grant.role = 'superadmin'
    or exists (
      select 1 from public.role_grant_branch_scopes as scope
      where scope.role_grant_id = actor_grant.id
        and scope.branch_id = booking.branch_id
        and scope.starts_at <= now()
        and (scope.ends_at is null or scope.ends_at > now())
    );

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', result.id,
    'bookingId', result.booking_id,
    'examinerId', result.examiner_user_id,
    'score', result.score,
    'recommendedLevel', result.recommended_level,
    'notes', result.notes,
    'createdAt', result.created_at,
    'version', result.version
  ) order by result.created_at desc), '[]'::jsonb)
  into results
  from public.admission_placement_results as result
  join public.admission_placement_bookings as booking
    on booking.id = result.booking_id
  where actor_grant.role = 'superadmin'
    or exists (
      select 1 from public.role_grant_branch_scopes as scope
      where scope.role_grant_id = actor_grant.id
        and scope.branch_id = booking.branch_id
        and scope.starts_at <= now()
        and (scope.ends_at is null or scope.ends_at > now())
    );

  return query select base_workspace || pg_catalog.jsonb_build_object(
    'placementTests', bookings,
    'placementResults', results
  );
exception
  when no_data_found then
    raise exception 'Placement workspace authority is unavailable'
      using errcode = '42501';
end;
$$;

create or replace function public.nile_create_placement_booking_with_evidence(
  p_session_token_hash text,
  p_lead_id uuid,
  p_branch_ref text,
  p_full_name text,
  p_email text,
  p_phone text,
  p_subject text,
  p_preferred_date text,
  p_current_level text,
  p_source_key text,
  p_idempotency_key text,
  p_request_hash text
)
returns table (
  command_id uuid,
  booking_id uuid,
  lead_id uuid,
  branch_id uuid,
  booking_version integer,
  lead_version integer,
  result_id uuid,
  result_version integer,
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
  source_lead public.admission_leads%rowtype;
  command_uuid uuid := gen_random_uuid();
  booking_uuid uuid := gen_random_uuid();
  created_lead_id uuid := gen_random_uuid();
  resolved_branch_id uuid;
  normalized_email text := pg_catalog.lower(pg_catalog.btrim(p_email));
  resulting_lead_version integer;
begin
  if p_session_token_hash !~ '^[a-f0-9]{64}$'
    or p_request_hash !~ '^[a-f0-9]{64}$'
    or length(p_idempotency_key) not between 12 and 256
    or p_preferred_date !~ '^\d{4}-\d{2}-\d{2}$'
    or length(pg_catalog.btrim(coalesce(p_current_level, ''))) not between 2 and 160
    or length(coalesce(p_source_key, '')) > 256 then
    raise exception 'Placement booking request is invalid' using errcode = '22023';
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
      or existing_command.command_type <> 'placement.create'
      or existing_command.actor_user_id <> actor_user.id
      or existing_command.status <> 'succeeded' then
      raise exception 'Placement booking idempotency conflict' using errcode = '23505';
    end if;
    return query
      select existing_command.id, booking.id, booking.lead_id,
        booking.branch_id, booking.version, lead.version, null::uuid,
        null::integer, true
      from public.admission_placement_bookings as booking
      join public.admission_leads as lead on lead.id = booking.lead_id
      where booking.id = existing_command.target_id::uuid;
    return;
  end if;

  if p_lead_id is not null then
    select lead.* into strict source_lead
    from public.admission_leads as lead
    where lead.id = p_lead_id
    for update;
    resolved_branch_id := source_lead.branch_id;
    if source_lead.status in ('enrolled', 'active', 'cancelled') then
      raise exception 'Lead cannot book placement from its current status'
        using errcode = '22023';
    end if;
    if nullif(pg_catalog.btrim(p_branch_ref), '') is not null
      and not exists (
        select 1 from public.branches as branch
        where branch.id = source_lead.branch_id
          and (branch.id::text = pg_catalog.btrim(p_branch_ref)
            or branch.legacy_id = pg_catalog.btrim(p_branch_ref)
            or branch.code::text = pg_catalog.btrim(p_branch_ref))
      ) then
      raise exception 'Placement branch must match the linked lead'
        using errcode = '22023';
    end if;
  else
    if length(pg_catalog.btrim(coalesce(p_full_name, ''))) not between 2 and 160
      or normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
      or length(pg_catalog.btrim(coalesce(p_phone, ''))) not between 7 and 40
      or length(pg_catalog.btrim(coalesce(p_subject, ''))) not between 2 and 160 then
      raise exception 'Placement learner details are invalid' using errcode = '22023';
    end if;
    select branch.id into resolved_branch_id
    from public.branches as branch
    where (branch.id::text = pg_catalog.btrim(p_branch_ref)
        or branch.legacy_id = pg_catalog.btrim(p_branch_ref)
        or branch.code::text = pg_catalog.btrim(p_branch_ref))
      and branch.status = 'active';
    if resolved_branch_id is null then
      raise exception 'Placement branch is unavailable' using errcode = '23503';
    end if;
    if exists (
      select 1 from public.admission_leads as lead
      where lead.branch_id = resolved_branch_id
        and lead.email = normalized_email
        and lead.status <> 'cancelled'
    ) then
      raise exception 'An active admissions record already exists for this email'
        using errcode = '23505';
    end if;
  end if;

  if actor_grant.role = 'registrar' and not exists (
    select 1 from public.role_grant_branch_scopes as scope
    where scope.role_grant_id = actor_grant.id
      and scope.branch_id = resolved_branch_id
      and scope.starts_at <= now()
      and (scope.ends_at is null or scope.ends_at > now())
  ) then
    raise exception 'Placement branch is outside the current scope'
      using errcode = '42501';
  end if;

  if p_lead_id is null then
    insert into public.admission_leads (
      id, branch_id, full_name, email, phone, subject, source, status,
      source_key, created_by
    ) values (
      created_lead_id, resolved_branch_id, pg_catalog.btrim(p_full_name),
      normalized_email, pg_catalog.btrim(p_phone), pg_catalog.btrim(p_subject),
      'placement_form', 'placement_booked',
      nullif(pg_catalog.btrim(p_source_key), ''), actor_user.id
    );
    source_lead.id := created_lead_id;
    source_lead.full_name := pg_catalog.btrim(p_full_name);
    source_lead.email := normalized_email;
    source_lead.phone := pg_catalog.btrim(p_phone);
    source_lead.subject := pg_catalog.btrim(p_subject);
    resulting_lead_version := 1;
  else
    update public.admission_leads
    set status = 'placement_booked', version = version + 1
    where id = source_lead.id;
    resulting_lead_version := source_lead.version + 1;
  end if;

  insert into public.command_executions (
    id, idempotency_key, actor_user_id, actor_role_grant_id, session_id,
    command_type, target_type, target_id, request_hash, requires_outbox
  ) values (
    command_uuid, p_idempotency_key, actor_user.id, actor_grant.id,
    actor_session.id, 'placement.create', 'PlacementTestBooking',
    booking_uuid::text, pg_catalog.decode(p_request_hash, 'hex'), false
  );
  insert into public.admission_placement_bookings (
    id, lead_id, branch_id, full_name, email, phone, subject,
    preferred_date, current_level, source_key, created_by
  ) values (
    booking_uuid, source_lead.id, resolved_branch_id, source_lead.full_name,
    source_lead.email, source_lead.phone, source_lead.subject,
    p_preferred_date::date, pg_catalog.btrim(p_current_level),
    nullif(pg_catalog.btrim(p_source_key), ''), actor_user.id
  );
  insert into public.audit_logs (
    command_id, actor_user_id, actor_role_grant_id, session_id,
    action, entity_type, entity_id, branch_id, after_state, metadata
  ) values (
    command_uuid, actor_user.id, actor_grant.id, actor_session.id,
    'placement.created', 'PlacementTestBooking', booking_uuid::text,
    resolved_branch_id,
    pg_catalog.jsonb_build_object(
      'status', 'pending', 'version', 1, 'leadVersion', resulting_lead_version
    ),
    pg_catalog.jsonb_build_object(
      'summary', 'Booked placement for ' || source_lead.full_name || '.'
    )
  );
  update public.command_executions
  set status = 'succeeded', completed_at = now()
  where id = command_uuid;

  return query select command_uuid, booking_uuid, source_lead.id,
    resolved_branch_id, 1, resulting_lead_version, null::uuid,
    null::integer, false;
exception
  when no_data_found then
    raise exception 'Placement booking authority is unavailable'
      using errcode = '42501';
end;
$$;

create or replace function public.nile_record_placement_result_with_evidence(
  p_session_token_hash text,
  p_booking_id uuid,
  p_recommended_level text,
  p_score numeric,
  p_notes text,
  p_expected_version integer,
  p_idempotency_key text,
  p_request_hash text
)
returns table (
  command_id uuid,
  booking_id uuid,
  lead_id uuid,
  branch_id uuid,
  booking_version integer,
  lead_version integer,
  result_id uuid,
  result_version integer,
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
  booking public.admission_placement_bookings%rowtype;
  lead public.admission_leads%rowtype;
  existing_command public.command_executions%rowtype;
  command_uuid uuid := gen_random_uuid();
  result_uuid uuid := gen_random_uuid();
begin
  if p_session_token_hash !~ '^[a-f0-9]{64}$'
    or p_request_hash !~ '^[a-f0-9]{64}$'
    or p_expected_version < 1
    or p_score not between 0 and 100
    or length(pg_catalog.btrim(coalesce(p_recommended_level, ''))) not between 2 and 160
    or length(pg_catalog.btrim(coalesce(p_notes, ''))) not between 4 and 3000
    or length(p_idempotency_key) not between 12 and 256 then
    raise exception 'Placement result request is invalid' using errcode = '22023';
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
      or existing_command.command_type <> 'placement.result.record'
      or existing_command.actor_user_id <> actor_user.id
      or existing_command.status <> 'succeeded' then
      raise exception 'Placement result idempotency conflict' using errcode = '23505';
    end if;
    return query
      select existing_command.id, source_booking.id, source_booking.lead_id,
        source_booking.branch_id, source_booking.version, source_lead.version,
        result.id, result.version, true
      from public.admission_placement_results as result
      join public.admission_placement_bookings as source_booking
        on source_booking.id = result.booking_id
      join public.admission_leads as source_lead
        on source_lead.id = source_booking.lead_id
      where result.id = existing_command.target_id::uuid;
    return;
  end if;

  select item.* into strict booking
  from public.admission_placement_bookings as item
  where item.id = p_booking_id
  for update;
  select item.* into strict lead
  from public.admission_leads as item
  where item.id = booking.lead_id
  for update;
  if actor_grant.role = 'registrar' and not exists (
    select 1 from public.role_grant_branch_scopes as scope
    where scope.role_grant_id = actor_grant.id
      and scope.branch_id = booking.branch_id
      and scope.starts_at <= now()
      and (scope.ends_at is null or scope.ends_at > now())
  ) then
    raise exception 'Placement booking is outside the current scope'
      using errcode = '42501';
  end if;
  if booking.version <> p_expected_version then
    raise exception 'Placement booking version conflict' using errcode = '40001';
  end if;
  if booking.status <> 'pending' then
    raise exception 'Placement result can only be recorded once'
      using errcode = '22023';
  end if;

  insert into public.command_executions (
    id, idempotency_key, actor_user_id, actor_role_grant_id, session_id,
    command_type, target_type, target_id, request_hash, requires_outbox
  ) values (
    command_uuid, p_idempotency_key, actor_user.id, actor_grant.id,
    actor_session.id, 'placement.result.record', 'PlacementTestResult',
    result_uuid::text, pg_catalog.decode(p_request_hash, 'hex'), false
  );
  insert into public.admission_placement_results (
    id, booking_id, examiner_user_id, score, recommended_level, notes
  ) values (
    result_uuid, booking.id, actor_user.id, p_score,
    pg_catalog.btrim(p_recommended_level), pg_catalog.btrim(p_notes)
  );
  update public.admission_placement_bookings
  set status = 'completed',
      recommended_level = pg_catalog.btrim(p_recommended_level),
      version = version + 1
  where id = booking.id;
  update public.admission_leads
  set status = 'placement_completed', version = version + 1
  where id = lead.id;
  insert into public.audit_logs (
    command_id, actor_user_id, actor_role_grant_id, session_id,
    action, entity_type, entity_id, branch_id, before_state, after_state, metadata
  ) values (
    command_uuid, actor_user.id, actor_grant.id, actor_session.id,
    'placement.result_recorded', 'PlacementTestResult', result_uuid::text,
    booking.branch_id,
    pg_catalog.jsonb_build_object(
      'bookingStatus', booking.status, 'bookingVersion', booking.version
    ),
    pg_catalog.jsonb_build_object(
      'bookingStatus', 'completed', 'bookingVersion', booking.version + 1,
      'leadStatus', 'placement_completed', 'leadVersion', lead.version + 1,
      'resultVersion', 1
    ),
    pg_catalog.jsonb_build_object(
      'summary', 'Recorded placement result for ' || booking.full_name || '.'
    )
  );
  update public.command_executions
  set status = 'succeeded', completed_at = now()
  where id = command_uuid;

  return query select command_uuid, booking.id, booking.lead_id,
    booking.branch_id, booking.version + 1, lead.version + 1,
    result_uuid, 1, false;
exception
  when no_data_found then
    raise exception 'Placement result authority is unavailable'
      using errcode = '42501';
end;
$$;

revoke all on function public.nile_read_admissions_placement_workspace(text)
  from public, anon, authenticated;
revoke all on function public.nile_create_placement_booking_with_evidence(
  text, uuid, text, text, text, text, text, text, text, text, text, text
) from public, anon, authenticated;
revoke all on function public.nile_record_placement_result_with_evidence(
  text, uuid, text, numeric, text, integer, text, text
) from public, anon, authenticated;
grant execute on function public.nile_read_admissions_placement_workspace(text)
  to service_role;
grant execute on function public.nile_create_placement_booking_with_evidence(
  text, uuid, text, text, text, text, text, text, text, text, text, text
) to service_role;
grant execute on function public.nile_record_placement_result_with_evidence(
  text, uuid, text, numeric, text, integer, text, text
) to service_role;

commit;
