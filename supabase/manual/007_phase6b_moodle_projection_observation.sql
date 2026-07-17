-- Nile Learn Phase 6B Moodle projection observation package.
--
-- Status: additive, manual, and intentionally unapplied. Run only after the
-- accepted Phase 1 and Phase 6A packages on a disposable database. This file
-- stores sanitized projection snapshots, never raw Moodle responses.

begin;

do $$
declare
  missing_dependencies text[];
begin
  select pg_catalog.array_agg(dependency order by dependency)
  into missing_dependencies
  from pg_catalog.unnest(array[
    'app_users',
    'course_templates',
    'external_records',
    'integration_connections',
    'reconciliation_cases',
    'role_grants',
    'sync_run_items',
    'sync_runs'
  ]) as dependency
  where pg_catalog.to_regclass('public.' || dependency) is null;

  if missing_dependencies is not null then
    raise exception 'Phase 6B requires Phase 1 and Phase 6A tables: %', missing_dependencies;
  end if;

  if pg_catalog.to_regprocedure(
    'public.resolve_moodle_course_projection_authority(uuid,uuid)'
  ) is null then
    raise exception 'Phase 6B requires the Phase 6A authority RPC';
  end if;

  if pg_catalog.to_regprocedure('nile_private.reject_immutable_change()') is null
    or pg_catalog.to_regprocedure('nile_private.jsonb_has_forbidden_keys(jsonb)') is null then
    raise exception 'Phase 6B requires Phase 1 immutable and JSON safety helpers';
  end if;
end;
$$;

create function nile_private.moodle_sanitized_projection_is_safe(
  payload jsonb,
  depth integer default 0
)
returns boolean
language plpgsql
immutable
strict
security invoker
set search_path = ''
as $$
declare
  pair record;
  element jsonb;
begin
  if depth > 8
    or pg_catalog.octet_length(payload::text) > 262144
    or nile_private.jsonb_has_forbidden_keys(payload) then
    return false;
  end if;

  case pg_catalog.jsonb_typeof(payload)
    when 'object' then
      if (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(payload)) > 128 then
        return false;
      end if;

      for pair in
        select entry.key, entry.value
        from pg_catalog.jsonb_each(payload) as entry
      loop
        if pg_catalog.length(pair.key) > 80
          or pg_catalog.lower(pair.key) ~
            '(^|_)(raw|response|error|errors|exception|debuginfo|contact|contacts|email|phone|address|username|password|passwd|secret|api.?key|token|authorization|cookie|credential|private.?key|service.?role)($|_)'
          or not nile_private.moodle_sanitized_projection_is_safe(pair.value, depth + 1) then
          return false;
        end if;
      end loop;
    when 'array' then
      if pg_catalog.jsonb_array_length(payload) > 500 then
        return false;
      end if;

      for element in
        select item.value
        from pg_catalog.jsonb_array_elements(payload) as item
      loop
        if not nile_private.moodle_sanitized_projection_is_safe(element, depth + 1) then
          return false;
        end if;
      end loop;
    when 'string' then
      if pg_catalog.length(payload #>> '{}') > 4096
        or (payload #>> '{}') ~* '(bearer[[:space:]]+|wstoken|moodlewsrestformat|password=|token=|authorization:)' then
        return false;
      end if;
    else
      return true;
  end case;

  return true;
end;
$$;

create table public.moodle_projection_observations (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  request_hash bytea not null check (octet_length(request_hash) = 32),
  connection_id uuid not null references public.integration_connections(id) on delete restrict,
  internal_course_id uuid not null references public.course_templates(id) on delete restrict,
  external_record_id uuid references public.external_records(id) on delete restrict,
  sync_run_id uuid not null references public.sync_runs(id) on delete restrict,
  sync_run_item_id uuid not null references public.sync_run_items(id) on delete restrict,
  reconciliation_case_id uuid references public.reconciliation_cases(id) on delete restrict,
  projection_family text not null
    check (projection_family in ('course_catalog', 'course_content')),
  outcome text not null check (outcome in ('available', 'empty', 'unavailable', 'reconciliation')),
  reconciliation_reason text check (
    reconciliation_reason in (
      'missing_mapping',
      'missing_provider_record',
      'ambiguous_mapping'
    )
  ),
  sanitized_payload jsonb,
  projection_hash bytea check (projection_hash is null or octet_length(projection_hash) = 32),
  observed_at timestamptz not null,
  fresh_until timestamptz,
  retain_until timestamptz,
  created_at timestamptz not null default now(),
  check (idempotency_key ~ '^[a-z0-9][a-z0-9._:-]{7,127}$'),
  check (
    sanitized_payload is null
    or (
      pg_catalog.jsonb_typeof(sanitized_payload) in ('object', 'array')
      and nile_private.moodle_sanitized_projection_is_safe(sanitized_payload)
    )
  ),
  check (
    (
      outcome in ('available', 'empty')
      and external_record_id is not null
      and sanitized_payload is not null
      and projection_hash is not null
      and fresh_until is not null
      and fresh_until > observed_at
      and retain_until is not null
      and retain_until > fresh_until
      and retain_until <= observed_at + interval '30 days'
      and reconciliation_case_id is null
      and reconciliation_reason is null
    )
    or (
      outcome = 'unavailable'
      and sanitized_payload is null
      and projection_hash is null
      and fresh_until is null
      and retain_until is null
      and reconciliation_case_id is null
      and reconciliation_reason is null
    )
    or (
      outcome = 'reconciliation'
      and sanitized_payload is null
      and projection_hash is null
      and fresh_until is null
      and retain_until is null
      and reconciliation_case_id is not null
      and reconciliation_reason is not null
    )
  )
);

create index moodle_projection_observations_course_time_idx
  on public.moodle_projection_observations (
    connection_id,
    internal_course_id,
    projection_family,
    observed_at desc,
    id desc
  );

create index moodle_projection_observations_success_idx
  on public.moodle_projection_observations (
    connection_id,
    internal_course_id,
    projection_family,
    observed_at desc,
    id desc
  )
  where outcome in ('available', 'empty');

create index moodle_projection_observations_sync_run_idx
  on public.moodle_projection_observations (sync_run_id, sync_run_item_id);

create index moodle_projection_observations_reconciliation_idx
  on public.moodle_projection_observations (reconciliation_case_id)
  where reconciliation_case_id is not null;

create function public.resolve_moodle_projection_context(
  p_user_id uuid,
  p_active_role_grant_id uuid
)
returns table (
  connection_id uuid,
  active_role text,
  authorized_course_ids uuid[],
  observed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  resolved_connection_id uuid;
  connection_count integer;
begin
  select
    pg_catalog.count(*)::integer,
    (pg_catalog.array_agg(connection.id order by connection.id))[1]
  into connection_count, resolved_connection_id
  from public.integration_connections as connection
  where connection.provider = 'moodle'
    and connection.mode = 'read_only'
    and connection.status = 'ready';

  if connection_count <> 1 then
    raise exception 'Moodle projection requires exactly one ready read-only connection'
      using errcode = '42501';
  end if;

  return query
  select
    resolved_connection_id,
    authority.active_role,
    authority.authorized_course_ids,
    authority.observed_at
  from public.resolve_moodle_course_projection_authority(
    p_user_id,
    p_active_role_grant_id
  ) as authority;
end;
$$;

create function public.list_moodle_course_mappings_for_connection(
  p_connection_id uuid,
  p_internal_course_ids uuid[] default null
)
returns table (
  internal_course_id uuid,
  external_record_id uuid,
  external_course_id text,
  sync_state text,
  last_seen_at timestamptz,
  last_synced_at timestamptz,
  source_updated_at timestamptz,
  last_error text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.integration_connections as connection
    where connection.id = p_connection_id
      and connection.provider = 'moodle'
      and connection.mode = 'read_only'
      and connection.status = 'ready'
  ) then
    raise exception 'Moodle projection connection is not ready and read-only'
      using errcode = '42501';
  end if;

  return query
  select
    external_record.internal_id,
    external_record.id,
    external_record.external_id,
    external_record.sync_state,
    external_record.last_seen_at,
    external_record.last_synced_at,
    external_record.source_updated_at,
    external_record.last_error
  from public.external_records as external_record
  join public.course_templates as course_template
    on course_template.id = external_record.internal_id
  where external_record.connection_id = p_connection_id
    and external_record.entity_type = 'course'
    and external_record.sync_state <> 'ignored'
    and (
      p_internal_course_ids is null
      or external_record.internal_id = any (p_internal_course_ids)
    )
  order by external_record.internal_id;
end;
$$;

create function public.record_moodle_projection_observation(
  p_idempotency_key text,
  p_connection_id uuid,
  p_internal_course_id uuid,
  p_external_record_id uuid,
  p_sync_run_id uuid,
  p_sync_run_item_id uuid,
  p_projection_family text,
  p_outcome text,
  p_sanitized_payload jsonb,
  p_projection_hash bytea,
  p_observed_at timestamptz,
  p_fresh_until timestamptz,
  p_retain_until timestamptz,
  p_reconciliation_case_id uuid default null,
  p_reconciliation_reason text default null
)
returns table (
  observation_id uuid,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  calculated_request_hash bytea;
  inserted_id uuid;
  existing_observation record;
  mapped_internal_course_id uuid;
  mapped_connection_id uuid;
  mapped_external_id text;
  run_connection_id uuid;
  run_entity_type text;
  run_direction text;
  run_status text;
  item_sync_run_id uuid;
  item_external_record_id uuid;
  item_external_id text;
  item_status text;
  case_connection_id uuid;
  case_internal_id uuid;
  case_external_id text;
  case_reason text;
  case_status text;
begin
  if p_idempotency_key is null
    or p_idempotency_key !~ '^[a-z0-9][a-z0-9._:-]{7,127}$'
    or p_projection_family not in ('course_catalog', 'course_content')
    or p_outcome not in ('available', 'empty', 'unavailable', 'reconciliation')
    or p_observed_at is null then
    raise exception 'Invalid Moodle observation command metadata'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.integration_connections as connection
    where connection.id = p_connection_id
      and connection.provider = 'moodle'
      and connection.mode = 'read_only'
      and connection.status = 'ready'
  ) then
    raise exception 'Moodle observation connection is not ready and read-only'
      using errcode = '42501';
  end if;

  if p_outcome in ('available', 'empty') then
    if p_sanitized_payload is null
      or pg_catalog.jsonb_typeof(p_sanitized_payload) not in ('object', 'array')
      or not nile_private.moodle_sanitized_projection_is_safe(p_sanitized_payload)
      or p_projection_hash is null
      or pg_catalog.octet_length(p_projection_hash) <> 32
      or p_projection_hash is distinct from public.digest(
        pg_catalog.convert_to(p_sanitized_payload::text, 'UTF8'),
        'sha256'
      )
      or p_fresh_until is null
      or p_fresh_until <= p_observed_at
      or p_retain_until is null
      or p_retain_until <= p_fresh_until
      or p_retain_until > p_observed_at + interval '30 days'
      or p_reconciliation_case_id is not null
      or p_reconciliation_reason is not null then
      raise exception 'Successful observation requires one safe hashed projection and freshness bound'
        using errcode = '22023';
    end if;
  elsif p_sanitized_payload is not null
    or p_projection_hash is not null
    or p_fresh_until is not null
    or p_retain_until is not null then
    raise exception 'Unavailable and reconciliation observations cannot retain a projection'
      using errcode = '22023';
  end if;

  if p_outcome = 'reconciliation' then
    if p_reconciliation_case_id is null
      or p_reconciliation_reason not in (
        'missing_mapping',
        'missing_provider_record',
        'ambiguous_mapping'
      ) then
      raise exception 'Reconciliation observation requires one bounded reason and case'
        using errcode = '22023';
    end if;
  elsif p_reconciliation_case_id is not null or p_reconciliation_reason is not null then
    raise exception 'Only reconciliation observations can reference a case'
      using errcode = '22023';
  end if;

  if p_external_record_id is not null then
    select
      external_record.internal_id,
      external_record.connection_id,
      external_record.external_id
    into strict mapped_internal_course_id, mapped_connection_id, mapped_external_id
    from public.external_records as external_record
    where external_record.id = p_external_record_id
      and external_record.entity_type = 'course'
      and external_record.sync_state <> 'ignored';

    if mapped_connection_id is distinct from p_connection_id
      or mapped_internal_course_id is distinct from p_internal_course_id then
      raise exception 'Observation mapping is outside the exact connection and course context'
        using errcode = '23514';
    end if;
  elsif p_outcome in ('available', 'empty') then
    raise exception 'Successful observation requires an exact Moodle course mapping'
      using errcode = '23514';
  end if;

  select sync_run.connection_id, sync_run.entity_type, sync_run.direction, sync_run.status
  into strict run_connection_id, run_entity_type, run_direction, run_status
  from public.sync_runs as sync_run
  where sync_run.id = p_sync_run_id;

  select
    sync_item.sync_run_id,
    sync_item.external_record_id,
    sync_item.external_id,
    sync_item.status
  into strict item_sync_run_id, item_external_record_id, item_external_id, item_status
  from public.sync_run_items as sync_item
  where sync_item.id = p_sync_run_item_id;

  if run_connection_id is distinct from p_connection_id
    or run_entity_type <> (case p_projection_family
      when 'course_catalog' then 'course'
      when 'course_content' then 'course_content'
    end)
    or run_direction <> 'read'
    or run_status not in ('succeeded', 'partial', 'failed')
    or item_sync_run_id is distinct from p_sync_run_id
    or item_external_record_id is distinct from p_external_record_id
    or (p_external_record_id is not null and item_external_id is distinct from mapped_external_id) then
    raise exception 'Observation run item is outside the exact connection and mapping context'
      using errcode = '23514';
  end if;

  if (p_outcome in ('available', 'empty') and item_status <> 'succeeded')
    or (p_outcome = 'unavailable' and item_status <> 'failed')
    or (p_outcome = 'reconciliation' and item_status <> 'needs_review') then
    raise exception 'Observation outcome does not match the immutable sync item result'
      using errcode = '23514';
  end if;

  if p_outcome = 'reconciliation' then
    select
      reconciliation.connection_id,
      reconciliation.internal_id,
      reconciliation.external_id,
      reconciliation.reason,
      reconciliation.status
    into strict
      case_connection_id,
      case_internal_id,
      case_external_id,
      case_reason,
      case_status
    from public.reconciliation_cases as reconciliation
    where reconciliation.id = p_reconciliation_case_id;

    if case_connection_id is distinct from p_connection_id
      or case_internal_id is distinct from p_internal_course_id
      or case_external_id is distinct from item_external_id
      or case_reason is distinct from p_reconciliation_reason
      or case_status <> 'open' then
      raise exception 'Reconciliation case is outside the observation context'
        using errcode = '23514';
    end if;
  end if;

  calculated_request_hash := public.digest(
    pg_catalog.convert_to(
      pg_catalog.jsonb_build_array(
        p_connection_id::text,
        p_internal_course_id::text,
        p_external_record_id::text,
        p_sync_run_id::text,
        p_sync_run_item_id::text,
        p_projection_family,
        p_outcome,
        p_sanitized_payload,
        pg_catalog.encode(p_projection_hash, 'hex'),
        p_observed_at::text,
        p_fresh_until::text,
        p_retain_until::text,
        p_reconciliation_case_id::text,
        p_reconciliation_reason
      )::text,
      'UTF8'
    ),
    'sha256'
  );

  insert into public.moodle_projection_observations (
    idempotency_key,
    request_hash,
    connection_id,
    internal_course_id,
    external_record_id,
    sync_run_id,
    sync_run_item_id,
    reconciliation_case_id,
    projection_family,
    outcome,
    reconciliation_reason,
    sanitized_payload,
    projection_hash,
    observed_at,
    fresh_until,
    retain_until
  )
  values (
    p_idempotency_key,
    calculated_request_hash,
    p_connection_id,
    p_internal_course_id,
    p_external_record_id,
    p_sync_run_id,
    p_sync_run_item_id,
    p_reconciliation_case_id,
    p_projection_family,
    p_outcome,
    p_reconciliation_reason,
    p_sanitized_payload,
    p_projection_hash,
    p_observed_at,
    p_fresh_until,
    p_retain_until
  )
  on conflict (idempotency_key) do nothing
  returning id into inserted_id;

  if inserted_id is not null then
    return query select inserted_id, false;
    return;
  end if;

  select observation.id, observation.request_hash
  into strict existing_observation
  from public.moodle_projection_observations as observation
  where observation.idempotency_key = p_idempotency_key;

  if existing_observation.request_hash is distinct from calculated_request_hash then
    raise exception 'Moodle observation idempotency conflict'
      using errcode = '23505';
  end if;

  return query select existing_observation.id, true;
end;
$$;

create function public.list_authorized_moodle_projection_freshness(
  p_user_id uuid,
  p_active_role_grant_id uuid,
  p_connection_id uuid,
  p_projection_family text,
  p_as_of timestamptz,
  p_internal_course_ids uuid[] default null
)
returns table (
  connection_id uuid,
  active_role text,
  internal_course_id uuid,
  external_course_id text,
  projection_family text,
  freshness_state text,
  latest_outcome text,
  reconciliation_reason text,
  sanitized_payload jsonb,
  projection_hash bytea,
  successful_sync_run_id uuid,
  successful_observed_at timestamptz,
  fresh_until timestamptz,
  retain_until timestamptz,
  latest_observed_at timestamptz,
  observed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  context record;
begin
  if p_as_of is null
    or p_projection_family not in ('course_catalog', 'course_content') then
    raise exception 'Freshness evaluation requires an explicit timestamp'
      using errcode = '22023';
  end if;

  select *
  into strict context
  from public.resolve_moodle_projection_context(
    p_user_id,
    p_active_role_grant_id
  );

  if context.connection_id is distinct from p_connection_id then
    raise exception 'Moodle projection connection does not match the authorized context'
      using errcode = '42501';
  end if;

  if p_internal_course_ids is not null and exists (
    select 1
    from pg_catalog.unnest(p_internal_course_ids) as requested(internal_course_id)
    where requested.internal_course_id is null
      or not (requested.internal_course_id = any (context.authorized_course_ids))
  ) then
    raise exception 'Moodle projection course filter is outside authorized context'
      using errcode = '42501';
  end if;

  return query
  select
    context.connection_id,
    context.active_role,
    authorized_course.internal_course_id,
    mapping.external_id,
    p_projection_family,
    case
      when retained_success.id is null then 'unavailable'
      when latest_observation.id = retained_success.id
        and p_as_of <= retained_success.fresh_until then 'fresh'
      else 'stale'
    end,
    latest_observation.outcome,
    latest_observation.reconciliation_reason,
    retained_success.sanitized_payload,
    retained_success.projection_hash,
    retained_success.sync_run_id,
    retained_success.observed_at,
    retained_success.fresh_until,
    retained_success.retain_until,
    latest_observation.observed_at,
    context.observed_at
  from pg_catalog.unnest(context.authorized_course_ids) as authorized_course(internal_course_id)
  left join public.external_records as mapping
    on mapping.connection_id = context.connection_id
   and mapping.entity_type = 'course'
   and mapping.internal_id = authorized_course.internal_course_id
   and mapping.sync_state <> 'ignored'
  left join lateral (
    select observation.*
    from public.moodle_projection_observations as observation
    where observation.connection_id = context.connection_id
      and observation.internal_course_id = authorized_course.internal_course_id
      and observation.projection_family = p_projection_family
      and observation.observed_at <= p_as_of
    order by observation.observed_at desc, observation.id desc
    limit 1
  ) as latest_observation on true
  left join lateral (
    select observation.*
    from public.moodle_projection_observations as observation
    where observation.connection_id = context.connection_id
      and observation.internal_course_id = authorized_course.internal_course_id
      and observation.projection_family = p_projection_family
      and observation.external_record_id = mapping.id
      and observation.outcome in ('available', 'empty')
      and observation.observed_at <= p_as_of
      and p_as_of <= observation.retain_until
    order by observation.observed_at desc, observation.id desc
    limit 1
  ) as retained_success on true
  where p_internal_course_ids is null
    or authorized_course.internal_course_id = any (p_internal_course_ids)
  order by authorized_course.internal_course_id;
end;
$$;

create function public.resolve_moodle_projection_reconciliation(
  p_user_id uuid,
  p_active_role_grant_id uuid,
  p_observation_id uuid,
  p_resolution text
)
returns table (
  reconciliation_case_id uuid,
  status text,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  context record;
  observation record;
  existing_case record;
  target_status text;
begin
  if p_resolution not in (
    'mapping_confirmed',
    'provider_record_ignored',
    'source_rechecked',
    'no_match_confirmed'
  ) then
    raise exception 'Unsupported Moodle reconciliation resolution'
      using errcode = '22023';
  end if;

  select *
  into strict context
  from public.resolve_moodle_projection_context(
    p_user_id,
    p_active_role_grant_id
  );

  if context.active_role <> 'superadmin' then
    raise exception 'Moodle reconciliation requires Super Admin authority'
      using errcode = '42501';
  end if;

  select
    projection.connection_id,
    projection.reconciliation_case_id
  into strict observation
  from public.moodle_projection_observations as projection
  where projection.id = p_observation_id
    and projection.outcome = 'reconciliation';

  if observation.connection_id is distinct from context.connection_id then
    raise exception 'Reconciliation observation is outside the authorized connection'
      using errcode = '42501';
  end if;

  target_status := case p_resolution
    when 'mapping_confirmed' then 'matched'
    when 'provider_record_ignored' then 'ignored'
    else 'resolved'
  end;

  select case_row.status, case_row.resolution, case_row.resolved_by
  into strict existing_case
  from public.reconciliation_cases as case_row
  where case_row.id = observation.reconciliation_case_id
  for update;

  if existing_case.status = 'open' then
    update public.reconciliation_cases
    set
      status = target_status,
      resolution = p_resolution,
      resolved_by = p_user_id,
      resolved_at = pg_catalog.now()
    where id = observation.reconciliation_case_id;

    return query
    select observation.reconciliation_case_id, target_status, false;
    return;
  end if;

  if existing_case.status = target_status
    and existing_case.resolution = p_resolution
    and existing_case.resolved_by = p_user_id then
    return query
    select observation.reconciliation_case_id, target_status, true;
    return;
  end if;

  raise exception 'Moodle reconciliation resolution conflict'
    using errcode = '23505';
end;
$$;

create trigger moodle_projection_observations_immutable
before update or delete on public.moodle_projection_observations
for each row execute function nile_private.reject_immutable_change();

alter table public.moodle_projection_observations enable row level security;
alter table public.moodle_projection_observations force row level security;

revoke all on table public.moodle_projection_observations
from public, anon, authenticated, service_role;

revoke all on function nile_private.moodle_sanitized_projection_is_safe(jsonb, integer)
from public, anon, authenticated, service_role;

revoke all on function public.resolve_moodle_projection_context(uuid, uuid)
from public, anon, authenticated;
revoke all on function public.list_moodle_course_mappings_for_connection(uuid, uuid[])
from public, anon, authenticated;
revoke all on function public.record_moodle_projection_observation(text, uuid, uuid, uuid, uuid, uuid, text, text, jsonb, bytea, timestamptz, timestamptz, timestamptz, uuid, text)
from public, anon, authenticated;
revoke all on function public.list_authorized_moodle_projection_freshness(uuid, uuid, uuid, text, timestamptz, uuid[])
from public, anon, authenticated;
revoke all on function public.resolve_moodle_projection_reconciliation(uuid, uuid, uuid, text)
from public, anon, authenticated;

grant execute on function public.resolve_moodle_projection_context(uuid, uuid)
to service_role;
grant execute on function public.list_moodle_course_mappings_for_connection(uuid, uuid[])
to service_role;
grant execute on function public.record_moodle_projection_observation(text, uuid, uuid, uuid, uuid, uuid, text, text, jsonb, bytea, timestamptz, timestamptz, timestamptz, uuid, text)
to service_role;
grant execute on function public.list_authorized_moodle_projection_freshness(uuid, uuid, uuid, text, timestamptz, uuid[])
to service_role;
grant execute on function public.resolve_moodle_projection_reconciliation(uuid, uuid, uuid, text)
to service_role;

commit;
