-- Nile Learn Phase 6G additive Moodle assessment status observation package.
-- Manual-only and intentionally unapplied. Stores one sanitized class snapshot.

begin;

do $$
declare
  dependency text;
begin
  foreach dependency in array array[
    'app_users', 'role_grants', 'programs', 'course_templates', 'course_runs',
    'class_groups', 'teacher_assignments', 'student_profiles', 'enrollments',
    'class_memberships', 'integration_connections', 'external_records',
    'sync_runs', 'sync_run_items', 'reconciliation_cases',
    'moodle_enrollment_group_observations'
  ] loop
    if pg_catalog.to_regclass('public.' || dependency) is null then
      raise exception 'Phase 6G requires public.%', dependency;
    end if;
  end loop;

  if pg_catalog.to_regprocedure(
    'public.resolve_moodle_user_projection_authority(uuid,uuid)'
  ) is null then
    raise exception 'Phase 6G requires the accepted Phase 6E user authority RPC';
  end if;

  if pg_catalog.to_regprocedure('nile_private.reject_immutable_change()') is null
    or pg_catalog.to_regprocedure('nile_private.jsonb_has_forbidden_keys(jsonb)') is null then
    raise exception 'Phase 6G requires Phase 1 safety helpers';
  end if;
end;
$$;

-- Payload contract:
-- {internalCourseId, internalClassGroupId, providerState, mappingStatus, items}.
-- Each item contains projectionId (the internal external_records UUID), kind,
-- title, visibility, acceptsSubmissions, and only the applicable schedule keys.
create function nile_private.moodle_assessment_status_payload_is_safe(payload jsonb)
returns boolean
language plpgsql
immutable
strict
security invoker
set search_path = ''
as $$
declare
  root_keys text[];
  item jsonb;
  item_keys text[];
  projection_ids uuid[] := '{}'::uuid[];
  projection_id uuid;
  timestamp_key text;
  timestamp_value timestamptz;
  previous_timestamp timestamptz;
  item_count integer;
  uuid_pattern constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
begin
  if pg_catalog.jsonb_typeof(payload) <> 'object'
    or pg_catalog.octet_length(payload::text) > 131072
    or nile_private.jsonb_has_forbidden_keys(payload) then
    return false;
  end if;

  select pg_catalog.array_agg(key order by key)
  into root_keys
  from pg_catalog.jsonb_object_keys(payload) as key;

  if root_keys is distinct from array[
    'internalClassGroupId', 'internalCourseId', 'items',
    'mappingStatus', 'providerState'
  ]::text[]
    or (payload->>'internalCourseId') !~ uuid_pattern
    or (payload->>'internalClassGroupId') !~ uuid_pattern
    or payload->>'providerState' not in ('available', 'empty')
    or payload->>'mappingStatus' <> 'exact'
    or pg_catalog.jsonb_typeof(payload->'items') <> 'array' then
    return false;
  end if;

  item_count := pg_catalog.jsonb_array_length(payload->'items');
  if item_count > 500
    or (payload->>'providerState' = 'available' and item_count = 0)
    or (payload->>'providerState' = 'empty' and item_count <> 0) then
    return false;
  end if;

  for item in
    select entry.value
    from pg_catalog.jsonb_array_elements(payload->'items') as entry(value)
  loop
    if pg_catalog.jsonb_typeof(item) <> 'object'
      or nile_private.jsonb_has_forbidden_keys(item) then
      return false;
    end if;

    select pg_catalog.array_agg(key order by key)
    into item_keys
    from pg_catalog.jsonb_object_keys(item) as key;

    if not (item_keys @> array[
      'acceptsSubmissions', 'kind', 'projectionId', 'title', 'visibility'
    ]::text[])
      or not (item_keys <@ array[
        'acceptsSubmissions', 'closesAt', 'cutoffAt', 'dueAt', 'kind',
        'opensAt', 'projectionId', 'title', 'visibility'
      ]::text[])
      or (item->>'projectionId') !~ uuid_pattern
      or item->>'kind' not in ('assignment', 'quiz')
      or item->>'visibility' not in ('visible', 'hidden')
      or pg_catalog.jsonb_typeof(item->'acceptsSubmissions') <> 'boolean'
      or pg_catalog.jsonb_typeof(item->'title') <> 'string'
      or pg_catalog.length(item->>'title') not between 1 and 300
      or item->>'title' ~ '[<>]'
      or item->>'title' ~* '(https?://|javascript:|data:)' then
      return false;
    end if;

    projection_id := (item->>'projectionId')::uuid;
    if projection_id = any(projection_ids) then
      return false;
    end if;
    projection_ids := pg_catalog.array_append(projection_ids, projection_id);

    previous_timestamp := null;
    foreach timestamp_key in array array['opensAt', 'dueAt', 'cutoffAt', 'closesAt']
    loop
      if item ? timestamp_key then
        if pg_catalog.jsonb_typeof(item->timestamp_key) <> 'string'
          or pg_catalog.length(item->>timestamp_key) > 40 then
          return false;
        end if;
        begin
          timestamp_value := (item->>timestamp_key)::timestamptz;
        exception when invalid_datetime_format or datetime_field_overflow then
          return false;
        end;
        if previous_timestamp is not null and timestamp_value < previous_timestamp then
          return false;
        end if;
        previous_timestamp := timestamp_value;
      end if;
    end loop;
  end loop;

  return true;
end;
$$;

create table public.moodle_assessment_status_observations (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  request_hash bytea not null check (pg_catalog.octet_length(request_hash) = 32),
  connection_id uuid not null references public.integration_connections(id) on delete restrict,
  internal_course_id uuid not null references public.course_templates(id) on delete restrict,
  internal_class_group_id uuid not null references public.class_groups(id) on delete restrict,
  external_course_record_id uuid references public.external_records(id) on delete restrict,
  external_group_record_id uuid references public.external_records(id) on delete restrict,
  sync_run_id uuid not null references public.sync_runs(id) on delete restrict,
  sync_run_item_id uuid not null references public.sync_run_items(id) on delete restrict,
  reconciliation_case_id uuid references public.reconciliation_cases(id) on delete restrict,
  outcome text not null check (outcome in ('available', 'empty', 'unavailable', 'reconciliation')),
  reconciliation_reason text check (
    reconciliation_reason in (
      'missing_course_mapping', 'missing_group_mapping', 'missing_user_mapping',
      'missing_assessment_mapping', 'provider_schedule_drift', 'ambiguous_mapping'
    )
  ),
  sanitized_payload jsonb,
  projection_hash bytea check (
    projection_hash is null or pg_catalog.octet_length(projection_hash) = 32
  ),
  observed_at timestamptz not null,
  fresh_until timestamptz,
  retain_until timestamptz,
  purge_after timestamptz not null,
  created_at timestamptz not null default pg_catalog.now(),
  check (idempotency_key ~ '^[a-z0-9][a-z0-9._:-]{7,127}$'),
  check (
    sanitized_payload is null
    or nile_private.moodle_assessment_status_payload_is_safe(sanitized_payload)
  ),
  check (purge_after > observed_at and purge_after <= observed_at + interval '30 days'),
  check (
    (
      outcome in ('available', 'empty')
      and external_course_record_id is not null
      and external_group_record_id is not null
      and sanitized_payload is not null
      and projection_hash is not null
      and fresh_until = observed_at + interval '15 minutes'
      and retain_until > fresh_until
      and retain_until <= purge_after
      and reconciliation_case_id is null
      and reconciliation_reason is null
    ) or (
      outcome = 'unavailable'
      and sanitized_payload is null and projection_hash is null
      and fresh_until is null and retain_until is null
      and reconciliation_case_id is null and reconciliation_reason is null
    ) or (
      outcome = 'reconciliation'
      and sanitized_payload is null and projection_hash is null
      and fresh_until is null and retain_until is null
      and reconciliation_case_id is not null and reconciliation_reason is not null
    )
  )
);

create index moodle_assessment_status_observations_scope_time_idx
  on public.moodle_assessment_status_observations (
    connection_id, internal_course_id, internal_class_group_id,
    observed_at desc, id desc
  );
create index moodle_assessment_status_observations_retained_idx
  on public.moodle_assessment_status_observations (
    connection_id, internal_class_group_id, retain_until desc
  ) where outcome in ('available', 'empty');
create index moodle_assessment_status_observations_purge_idx
  on public.moodle_assessment_status_observations (purge_after, id);

create function public.resolve_moodle_assessment_status_context(
  p_user_id uuid,
  p_active_role_grant_id uuid,
  p_internal_class_group_id uuid
)
returns table (
  connection_id uuid,
  active_role text,
  projection_audience text,
  internal_course_id uuid,
  internal_course_run_id uuid,
  internal_class_group_id uuid,
  subject_user_id uuid,
  course_mapping_status text,
  group_mapping_status text,
  user_mapping_status text,
  assessment_mapping_status text,
  observed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  authority_at timestamptz := pg_catalog.now();
  user_authority record;
  effective_grant record;
  class_context record;
  ready_connection_id uuid;
  connection_count integer;
  course_external_id text;
begin
  if p_user_id is null or p_active_role_grant_id is null
    or p_internal_class_group_id is null then
    raise exception 'Current actor, grant, and class group are required'
      using errcode = '42501';
  end if;

  select * into strict user_authority
  from public.resolve_moodle_user_projection_authority(
    p_user_id, p_active_role_grant_id
  );
  if user_authority.active_role not in (
    'student', 'teacher', 'headofdepartment', 'superadmin'
  ) then
    raise exception 'Role cannot read assessment status projections'
      using errcode = '42501';
  end if;

  select * into strict effective_grant
  from nile_private.resolve_effective_role_grant(
    p_user_id, p_active_role_grant_id, authority_at
  );

  select class_group.id as group_id, class_group.status as group_status,
    course_run.id as run_id, course_run.status as run_status,
    course_run.starts_on, course_run.ends_on,
    course_template.id as course_id, program.department_id
  into strict class_context
  from public.class_groups as class_group
  join public.course_runs as course_run
    on course_run.id = class_group.course_run_id
   and course_run.status in ('active', 'completed')
  join public.course_templates as course_template
    on course_template.id = course_run.course_template_id
   and course_template.status = 'active'
  join public.programs as program
    on program.id = course_template.program_id and program.status = 'active'
  where class_group.id = p_internal_class_group_id
    and class_group.status in ('active', 'completed');

  if user_authority.active_role = 'student' then
    if not exists (
      select 1
      from public.student_profiles as student_profile
      join public.enrollments as enrollment
        on enrollment.student_profile_id = student_profile.id
       and enrollment.course_run_id = class_context.run_id
       and enrollment.status in ('active', 'completed')
      join public.class_memberships as membership
        on membership.enrollment_id = enrollment.id
       and membership.course_run_id = class_context.run_id
       and membership.class_group_id = class_context.group_id
       and (
         (enrollment.status = 'active' and membership.status = 'active'
          and enrollment.starts_at <= authority_at
          and (enrollment.ends_at is null or enrollment.ends_at > authority_at)
          and membership.starts_at <= authority_at
          and (membership.ends_at is null or membership.ends_at > authority_at))
         or (enrollment.status = 'completed' and membership.status = 'ended')
       )
      where student_profile.user_id = p_user_id
        and student_profile.status = 'active'
    ) then
      raise exception 'Student does not own an exact active or completed class enrollment'
        using errcode = '42501';
    end if;
  elsif user_authority.active_role = 'teacher' then
    if class_context.run_status <> 'active'
      or class_context.group_status <> 'active'
      or authority_at::date not between class_context.starts_on and class_context.ends_on
      or not exists (
        select 1
        from public.staff_profiles as teacher_profile
        join public.teacher_assignments as assignment
          on assignment.teacher_profile_id = teacher_profile.id
         and assignment.class_group_id = class_context.group_id
         and assignment.status = 'active'
         and assignment.starts_at <= authority_at
         and (assignment.ends_at is null or assignment.ends_at > authority_at)
        where teacher_profile.user_id = p_user_id
          and teacher_profile.status = 'active'
      ) then
      raise exception 'Teacher is not currently assigned to the exact class'
        using errcode = '42501';
    end if;
  elsif user_authority.active_role = 'headofdepartment'
    and not (class_context.department_id = any(effective_grant.department_ids)) then
    raise exception 'Class is outside the active HOD department scope'
      using errcode = '42501';
  end if;

  select pg_catalog.count(*)::integer,
    (pg_catalog.array_agg(connection.id order by connection.id))[1]
  into connection_count, ready_connection_id
  from public.integration_connections as connection
  where connection.provider = 'moodle'
    and connection.mode = 'read_only'
    and connection.status = 'ready';
  if connection_count <> 1 then
    raise exception 'Assessment status requires exactly one ready read-only Moodle connection'
      using errcode = '42501';
  end if;

  connection_id := ready_connection_id;
  active_role := user_authority.active_role;
  projection_audience := case when active_role = 'student'
    then 'learner' else 'class_staff' end;
  internal_course_id := class_context.course_id;
  internal_course_run_id := class_context.run_id;
  internal_class_group_id := class_context.group_id;
  subject_user_id := case when active_role = 'student' then p_user_id else null end;
  observed_at := authority_at;

  select mapping.external_id into course_external_id
  from public.external_records as mapping
  where mapping.connection_id = ready_connection_id
    and mapping.entity_type = 'course'
    and mapping.internal_id = class_context.course_id
    and mapping.sync_state <> 'ignored';
  course_mapping_status := case when course_external_id is null then 'missing' else 'exact' end;
  group_mapping_status := case when exists (
    select 1 from public.external_records as mapping
    where mapping.connection_id = ready_connection_id
      and mapping.entity_type = 'class_group'
      and mapping.internal_id = class_context.group_id
      and mapping.sync_state <> 'ignored'
  ) then 'exact' else 'missing' end;
  user_mapping_status := case
    when active_role <> 'student' then 'not_required'
    when exists (
      select 1 from public.external_records as mapping
      where mapping.connection_id = ready_connection_id
        and mapping.entity_type = 'user'
        and mapping.internal_id = p_user_id
        and mapping.sync_state <> 'ignored'
    ) then 'exact' else 'missing' end;

  assessment_mapping_status := case
    when course_external_id is null then 'missing'
    when exists (
      select 1 from public.external_records as mapping
      where mapping.connection_id = ready_connection_id
        and mapping.entity_type in ('assignment', 'quiz')
        and mapping.external_parent_id = course_external_id
        and mapping.sync_state in ('discovered', 'stale', 'error')
    ) then 'reconciliation'
    when exists (
      select 1 from public.external_records as mapping
      where mapping.connection_id = ready_connection_id
        and mapping.entity_type in ('assignment', 'quiz')
        and mapping.external_parent_id = course_external_id
        and mapping.sync_state in ('matched', 'synced')
    ) or exists (
      select 1 from public.moodle_assessment_status_observations as observation
      where observation.connection_id = ready_connection_id
        and observation.internal_class_group_id = class_context.group_id
        and observation.outcome = 'empty'
    ) then 'exact'
    else 'missing'
  end;

  return next;
exception
  when no_data_found then
    raise exception 'Class context does not resolve to normalized authority'
      using errcode = '42501';
end;
$$;

create function public.record_moodle_assessment_status_observation(
  p_idempotency_key text,
  p_connection_id uuid,
  p_internal_course_id uuid,
  p_internal_class_group_id uuid,
  p_external_course_record_id uuid,
  p_external_group_record_id uuid,
  p_sync_run_id uuid,
  p_sync_run_item_id uuid,
  p_outcome text,
  p_sanitized_payload jsonb,
  p_projection_hash bytea,
  p_observed_at timestamptz,
  p_fresh_until timestamptz,
  p_retain_until timestamptz,
  p_reconciliation_case_id uuid default null,
  p_reconciliation_reason text default null
)
returns table (observation_id uuid, replayed boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  calculated_request_hash bytea;
  inserted_id uuid;
  existing_observation record;
  class_context record;
  course_mapping record;
  group_mapping record;
  run_row record;
  item_row record;
  case_row record;
  payload_item jsonb;
  mapped_kind text;
  item_count integer;
begin
  if p_idempotency_key is null
    or p_idempotency_key !~ '^[a-z0-9][a-z0-9._:-]{7,127}$'
    or p_outcome not in ('available', 'empty', 'unavailable', 'reconciliation')
    or p_observed_at is null then
    raise exception 'Invalid assessment status observation metadata'
      using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.integration_connections as connection
    where connection.id = p_connection_id
      and connection.provider = 'moodle'
      and connection.mode = 'read_only'
      and connection.status = 'ready'
  ) then
    raise exception 'Observation connection is not ready read-only Moodle'
      using errcode = '42501';
  end if;

  select course_template.id as course_id, course_run.id as run_id,
    class_group.id as group_id
  into strict class_context
  from public.class_groups as class_group
  join public.course_runs as course_run
    on course_run.id = class_group.course_run_id
   and course_run.status in ('active', 'completed')
  join public.course_templates as course_template
    on course_template.id = course_run.course_template_id
   and course_template.status = 'active'
  where class_group.id = p_internal_class_group_id
    and class_group.status in ('active', 'completed');
  if class_context.course_id <> p_internal_course_id then
    raise exception 'Observation course and class context do not match'
      using errcode = '23514';
  end if;

  if p_outcome in ('available', 'empty') then
    if p_sanitized_payload is null
      or not nile_private.moodle_assessment_status_payload_is_safe(p_sanitized_payload)
      or p_projection_hash is null
      or p_projection_hash is distinct from public.digest(
        pg_catalog.convert_to(p_sanitized_payload::text, 'UTF8'), 'sha256'
      )
      or p_fresh_until is distinct from p_observed_at + interval '15 minutes'
      or p_retain_until is null or p_retain_until <= p_fresh_until
      or p_retain_until > p_observed_at + interval '30 days'
      or p_reconciliation_case_id is not null
      or p_reconciliation_reason is not null
      or (p_sanitized_payload->>'internalCourseId')::uuid <> p_internal_course_id
      or (p_sanitized_payload->>'internalClassGroupId')::uuid <> p_internal_class_group_id
      or p_sanitized_payload->>'providerState' <> p_outcome then
      raise exception 'Successful observation requires one exact safe atomic 15 minute projection'
        using errcode = '22023';
    end if;
  elsif p_sanitized_payload is not null or p_projection_hash is not null
    or p_fresh_until is not null or p_retain_until is not null then
    raise exception 'Unavailable and reconciliation outcomes cannot retain payloads'
      using errcode = '22023';
  end if;

  if p_outcome = 'reconciliation' then
    if p_reconciliation_case_id is null or p_reconciliation_reason not in (
      'missing_course_mapping', 'missing_group_mapping', 'missing_user_mapping',
      'missing_assessment_mapping', 'provider_schedule_drift', 'ambiguous_mapping'
    ) then
      raise exception 'Reconciliation requires one bounded case and reason'
        using errcode = '22023';
    end if;
  elsif p_reconciliation_case_id is not null or p_reconciliation_reason is not null then
    raise exception 'Only reconciliation outcomes can reference a case'
      using errcode = '22023';
  end if;

  if p_external_course_record_id is not null then
    select mapping.connection_id, mapping.internal_id, mapping.external_id
    into strict course_mapping
    from public.external_records as mapping
    where mapping.id = p_external_course_record_id
      and mapping.entity_type = 'course' and mapping.sync_state <> 'ignored';
    if course_mapping.connection_id <> p_connection_id
      or course_mapping.internal_id <> p_internal_course_id then
      raise exception 'Course mapping is outside the exact observation context'
        using errcode = '23514';
    end if;
  elsif p_outcome in ('available', 'empty') then
    raise exception 'Successful observation requires an exact course mapping'
      using errcode = '23514';
  end if;

  if p_external_group_record_id is not null then
    select mapping.connection_id, mapping.internal_id, mapping.external_id
    into strict group_mapping
    from public.external_records as mapping
    where mapping.id = p_external_group_record_id
      and mapping.entity_type = 'class_group' and mapping.sync_state <> 'ignored';
    if group_mapping.connection_id <> p_connection_id
      or group_mapping.internal_id <> p_internal_class_group_id then
      raise exception 'Group mapping is outside the exact observation context'
        using errcode = '23514';
    end if;
  elsif p_outcome in ('available', 'empty') then
    raise exception 'Successful observation requires an exact group mapping'
      using errcode = '23514';
  end if;

  if p_outcome = 'available' then
    item_count := 0;
    for payload_item in
      select entry.value
      from pg_catalog.jsonb_array_elements(p_sanitized_payload->'items') as entry(value)
    loop
      select mapping.entity_type into strict mapped_kind
      from public.external_records as mapping
      where mapping.id = (payload_item->>'projectionId')::uuid
        and mapping.connection_id = p_connection_id
        and mapping.entity_type in ('assignment', 'quiz')
        and mapping.external_parent_id = course_mapping.external_id
        and mapping.sync_state in ('matched', 'synced');
      if mapped_kind <> payload_item->>'kind' then
        raise exception 'Assessment projection ID kind does not match exact mapping'
          using errcode = '23514';
      end if;
      item_count := item_count + 1;
    end loop;
    if item_count <> pg_catalog.jsonb_array_length(p_sanitized_payload->'items') then
      raise exception 'Atomic assessment snapshot item count mismatch'
        using errcode = '23514';
    end if;
  end if;

  select sync_run.connection_id, sync_run.entity_type,
    sync_run.direction, sync_run.status
  into strict run_row
  from public.sync_runs as sync_run where sync_run.id = p_sync_run_id;
  select item.sync_run_id, item.external_record_id,
    item.external_id, item.status
  into strict item_row
  from public.sync_run_items as item where item.id = p_sync_run_item_id;
  if run_row.connection_id <> p_connection_id
    or run_row.entity_type <> 'assessment_status_projection'
    or run_row.direction <> 'read'
    or run_row.status not in ('succeeded', 'partial', 'failed')
    or item_row.sync_run_id <> p_sync_run_id
    or item_row.external_record_id is distinct from p_external_group_record_id
    or (p_external_group_record_id is not null
      and item_row.external_id is distinct from group_mapping.external_id)
    or (p_outcome in ('available', 'empty') and item_row.status <> 'succeeded')
    or (p_outcome = 'unavailable' and item_row.status <> 'failed')
    or (p_outcome = 'reconciliation' and item_row.status <> 'needs_review') then
    raise exception 'Observation sync evidence is outside the exact atomic read context'
      using errcode = '23514';
  end if;

  if p_outcome = 'reconciliation' then
    select reconciliation.connection_id, reconciliation.entity_type,
      reconciliation.internal_id, reconciliation.external_id,
      reconciliation.reason, reconciliation.status
    into strict case_row
    from public.reconciliation_cases as reconciliation
    where reconciliation.id = p_reconciliation_case_id;
    if case_row.connection_id <> p_connection_id
      or case_row.entity_type <> 'assessment_status_projection'
      or case_row.internal_id <> p_internal_class_group_id
      or case_row.external_id is distinct from item_row.external_id
      or case_row.reason <> p_reconciliation_reason
      or case_row.status <> 'open' then
      raise exception 'Reconciliation case is outside the exact class context'
        using errcode = '23514';
    end if;
  end if;

  calculated_request_hash := public.digest(
    pg_catalog.convert_to(pg_catalog.jsonb_build_array(
      p_connection_id::text, p_internal_course_id::text,
      p_internal_class_group_id::text, p_external_course_record_id::text,
      p_external_group_record_id::text, p_sync_run_id::text,
      p_sync_run_item_id::text, p_outcome, p_sanitized_payload,
      pg_catalog.encode(p_projection_hash, 'hex'), p_observed_at::text,
      p_fresh_until::text, p_retain_until::text,
      p_reconciliation_case_id::text, p_reconciliation_reason
    )::text, 'UTF8'), 'sha256'
  );

  insert into public.moodle_assessment_status_observations (
    idempotency_key, request_hash, connection_id, internal_course_id,
    internal_class_group_id, external_course_record_id,
    external_group_record_id, sync_run_id, sync_run_item_id,
    reconciliation_case_id, outcome, reconciliation_reason,
    sanitized_payload, projection_hash, observed_at, fresh_until,
    retain_until, purge_after
  ) values (
    p_idempotency_key, calculated_request_hash, p_connection_id,
    p_internal_course_id, p_internal_class_group_id,
    p_external_course_record_id, p_external_group_record_id,
    p_sync_run_id, p_sync_run_item_id, p_reconciliation_case_id,
    p_outcome, p_reconciliation_reason, p_sanitized_payload,
    p_projection_hash, p_observed_at, p_fresh_until, p_retain_until,
    p_observed_at + interval '30 days'
  ) on conflict (idempotency_key) do nothing returning id into inserted_id;

  if inserted_id is not null then
    return query select inserted_id, false;
    return;
  end if;
  select observation.id, observation.request_hash into strict existing_observation
  from public.moodle_assessment_status_observations as observation
  where observation.idempotency_key = p_idempotency_key;
  if existing_observation.request_hash is distinct from calculated_request_hash then
    raise exception 'Assessment status observation idempotency conflict'
      using errcode = '23505';
  end if;
  return query select existing_observation.id, true;
exception
  when no_data_found then
    raise exception 'Observation references missing or inactive exact evidence'
      using errcode = '23514';
end;
$$;

create function public.list_authorized_moodle_assessment_status_freshness(
  p_user_id uuid,
  p_active_role_grant_id uuid,
  p_connection_id uuid,
  p_internal_class_group_id uuid,
  p_as_of timestamptz
)
returns table (
  connection_id uuid,
  active_role text,
  projection_audience text,
  internal_course_id uuid,
  internal_course_run_id uuid,
  internal_class_group_id uuid,
  subject_user_id uuid,
  course_mapping_status text,
  group_mapping_status text,
  user_mapping_status text,
  assessment_mapping_status text,
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
  authority_observed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  context record;
begin
  if p_as_of is null then
    raise exception 'Freshness evaluation requires an explicit timestamp'
      using errcode = '22023';
  end if;
  select * into strict context
  from public.resolve_moodle_assessment_status_context(
    p_user_id, p_active_role_grant_id, p_internal_class_group_id
  );
  if context.connection_id <> p_connection_id then
    raise exception 'Connection is outside the live class authority context'
      using errcode = '42501';
  end if;

  return query
  select context.connection_id, context.active_role, context.projection_audience,
    context.internal_course_id, context.internal_course_run_id,
    context.internal_class_group_id, context.subject_user_id,
    context.course_mapping_status, context.group_mapping_status,
    context.user_mapping_status, context.assessment_mapping_status,
    case
      when context.course_mapping_status <> 'exact'
        or context.group_mapping_status <> 'exact'
        or context.user_mapping_status = 'missing'
        or context.assessment_mapping_status in ('missing', 'reconciliation')
        then 'reconciliation'
      when retained_success.id is not null
        and latest_observation.id = retained_success.id
        and p_as_of <= retained_success.fresh_until then 'fresh'
      when retained_success.id is not null then 'stale_retained'
      when prior_success.id is not null then 'expired'
      when latest_observation.outcome = 'reconciliation' then 'reconciliation'
      else 'unavailable'
    end,
    latest_observation.outcome, latest_observation.reconciliation_reason,
    retained_success.sanitized_payload, retained_success.projection_hash,
    retained_success.sync_run_id, retained_success.observed_at,
    retained_success.fresh_until, retained_success.retain_until,
    latest_observation.observed_at, context.observed_at
  from (select 1) as singleton
  left join lateral (
    select observation.*
    from public.moodle_assessment_status_observations as observation
    where observation.connection_id = context.connection_id
      and observation.internal_course_id = context.internal_course_id
      and observation.internal_class_group_id = context.internal_class_group_id
      and observation.observed_at <= p_as_of
    order by observation.observed_at desc, observation.id desc limit 1
  ) as latest_observation on true
  left join lateral (
    select observation.*
    from public.moodle_assessment_status_observations as observation
    where observation.connection_id = context.connection_id
      and observation.internal_course_id = context.internal_course_id
      and observation.internal_class_group_id = context.internal_class_group_id
      and observation.outcome in ('available', 'empty')
      and context.course_mapping_status = 'exact'
      and context.group_mapping_status = 'exact'
      and context.user_mapping_status <> 'missing'
      and context.assessment_mapping_status = 'exact'
      and not exists (
        select 1
        from pg_catalog.jsonb_array_elements(observation.sanitized_payload->'items') as payload_item(value)
        where not exists (
          select 1
          from public.external_records as mapping
          join public.external_records as course_mapping
            on course_mapping.connection_id = context.connection_id
           and course_mapping.entity_type = 'course'
           and course_mapping.internal_id = context.internal_course_id
           and course_mapping.sync_state <> 'ignored'
           and mapping.external_parent_id = course_mapping.external_id
          where mapping.id = (payload_item.value->>'projectionId')::uuid
            and mapping.connection_id = context.connection_id
            and mapping.entity_type = payload_item.value->>'kind'
            and mapping.sync_state in ('matched', 'synced')
        )
      )
      and observation.observed_at <= p_as_of
      and p_as_of <= observation.retain_until
    order by observation.observed_at desc, observation.id desc limit 1
  ) as retained_success on true
  left join lateral (
    select observation.id
    from public.moodle_assessment_status_observations as observation
    where observation.connection_id = context.connection_id
      and observation.internal_course_id = context.internal_course_id
      and observation.internal_class_group_id = context.internal_class_group_id
      and observation.outcome in ('available', 'empty')
      and observation.observed_at <= p_as_of
    order by observation.observed_at desc, observation.id desc limit 1
  ) as prior_success on true;
end;
$$;

create function nile_private.guard_moodle_assessment_status_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  purge_cutoff timestamptz;
begin
  if tg_op = 'DELETE'
    and pg_catalog.current_setting('nile.phase6g_purge', true) = 'bounded' then
    purge_cutoff := pg_catalog.current_setting(
      'nile.phase6g_purge_cutoff', true
    )::timestamptz;
    if old.purge_after <= purge_cutoff then
      return old;
    end if;
  end if;
  raise exception 'Moodle assessment status observations are immutable'
    using errcode = '55000';
end;
$$;

create function public.purge_moodle_assessment_status_observations(
  p_as_of timestamptz,
  p_limit integer default 500
)
returns table (deleted_count integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_as_of is null or p_limit is null or p_limit < 1 or p_limit > 1000 then
    raise exception 'Bounded purge requires a timestamp and limit from 1 through 1000'
      using errcode = '22023';
  end if;
  perform pg_catalog.set_config('nile.phase6g_purge', 'bounded', true);
  perform pg_catalog.set_config('nile.phase6g_purge_cutoff', p_as_of::text, true);
  return query
  with candidates as (
    select observation.id
    from public.moodle_assessment_status_observations as observation
    where observation.purge_after <= p_as_of
    order by observation.purge_after, observation.id
    limit p_limit
    for update
  ), deleted as (
    delete from public.moodle_assessment_status_observations as observation
    using candidates
    where observation.id = candidates.id
    returning observation.id
  )
  select pg_catalog.count(*)::integer from deleted;
end;
$$;

create trigger moodle_assessment_status_observations_immutable
before update or delete on public.moodle_assessment_status_observations
for each row execute function nile_private.guard_moodle_assessment_status_immutable();

alter table public.moodle_assessment_status_observations enable row level security;
alter table public.moodle_assessment_status_observations force row level security;

revoke all on table public.moodle_assessment_status_observations
from public, anon, authenticated, service_role;
revoke all on function nile_private.moodle_assessment_status_payload_is_safe(jsonb)
from public, anon, authenticated, service_role;
revoke all on function nile_private.guard_moodle_assessment_status_immutable()
from public, anon, authenticated, service_role;

revoke all on function public.resolve_moodle_assessment_status_context(uuid, uuid, uuid)
from public, anon, authenticated;
revoke all on function public.record_moodle_assessment_status_observation(text, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, jsonb, bytea, timestamptz, timestamptz, timestamptz, uuid, text)
from public, anon, authenticated;
revoke all on function public.list_authorized_moodle_assessment_status_freshness(uuid, uuid, uuid, uuid, timestamptz)
from public, anon, authenticated;
revoke all on function public.purge_moodle_assessment_status_observations(timestamptz, integer)
from public, anon, authenticated;

grant execute on function public.resolve_moodle_assessment_status_context(uuid, uuid, uuid)
to service_role;
grant execute on function public.record_moodle_assessment_status_observation(text, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, jsonb, bytea, timestamptz, timestamptz, timestamptz, uuid, text)
to service_role;
grant execute on function public.list_authorized_moodle_assessment_status_freshness(uuid, uuid, uuid, uuid, timestamptz)
to service_role;
grant execute on function public.purge_moodle_assessment_status_observations(timestamptz, integer)
to service_role;

commit;
