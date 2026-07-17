-- Nile Learn Phase 6H2 additive Moodle quiz attempt observation package.
-- Manual-only and intentionally unapplied. Stores sanitized projections only.

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
    'moodle_assessment_status_observations'
  ] loop
    if pg_catalog.to_regclass('public.' || dependency) is null then
      raise exception 'Phase 6H2 requires public.%', dependency;
    end if;
  end loop;

  if pg_catalog.to_regprocedure(
    'public.resolve_moodle_user_projection_authority(uuid,uuid)'
  ) is null then
    raise exception 'Phase 6H2 requires the accepted Phase 6E user authority RPC';
  end if;

  if pg_catalog.to_regprocedure('nile_private.reject_immutable_change()') is null
    or pg_catalog.to_regprocedure('nile_private.jsonb_has_forbidden_keys(jsonb)') is null then
    raise exception 'Phase 6H2 requires Phase 1 safety helpers';
  end if;
end;
$$;

-- Payload contract:
-- learner/person_level: internalCourseId, internalClassGroupId,
-- quizProjectionId, providerState, mappingStatus, and learners[].
-- aggregate: the same root IDs/states plus learnerCount, attemptedCount,
-- finishedCount, and gradedCount. Provider IDs and all question content,
-- answers, files, comments, feedback,
-- grader identity, and contact data are rejected by the closed key sets.
create function nile_private.moodle_quiz_attempt_payload_is_safe(
  payload jsonb,
  audience text
)
returns boolean
language plpgsql
immutable
strict
security invoker
set search_path = ''
as $$
declare
  root_keys text[];
  learner jsonb;
  learner_keys text[];
  timestamp_key text;
  timestamp_value timestamptz;
  score numeric;
  maximum_score numeric;
  uuid_pattern constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
begin
  if audience not in ('learner', 'person_level', 'aggregate')
    or pg_catalog.jsonb_typeof(payload) <> 'object'
    or pg_catalog.octet_length(payload::text) > 65536
    or nile_private.jsonb_has_forbidden_keys(payload) then
    return false;
  end if;

  select pg_catalog.array_agg(key order by key)
  into root_keys
  from pg_catalog.jsonb_object_keys(payload) as key;

  if audience in ('learner', 'person_level') then
    if root_keys is distinct from array[
      'internalClassGroupId', 'internalCourseId', 'learners', 'mappingStatus',
      'providerState', 'quizProjectionId'
    ]::text[]
      or pg_catalog.jsonb_typeof(payload->'learners') <> 'array'
      or pg_catalog.jsonb_array_length(payload->'learners') > 500 then
      return false;
    end if;
  elsif root_keys is distinct from array[
    'attemptedCount', 'finishedCount', 'gradedCount', 'internalClassGroupId',
    'internalCourseId', 'learnerCount', 'mappingStatus', 'providerState',
    'quizProjectionId'
  ]::text[] then
    return false;
  end if;

  if (payload->>'internalCourseId') !~ uuid_pattern
    or (payload->>'internalClassGroupId') !~ uuid_pattern
    or (payload->>'quizProjectionId') !~ uuid_pattern
    or payload->>'providerState' not in ('available', 'empty')
    or payload->>'mappingStatus' <> 'exact' then
    return false;
  end if;

  if audience = 'aggregate' then
    if pg_catalog.jsonb_typeof(payload->'learnerCount') <> 'number'
      or pg_catalog.jsonb_typeof(payload->'attemptedCount') <> 'number'
      or pg_catalog.jsonb_typeof(payload->'finishedCount') <> 'number'
      or pg_catalog.jsonb_typeof(payload->'gradedCount') <> 'number'
      or (payload->>'learnerCount') !~ '^[0-9]{1,6}$'
      or (payload->>'attemptedCount') !~ '^[0-9]{1,6}$'
      or (payload->>'finishedCount') !~ '^[0-9]{1,6}$'
      or (payload->>'gradedCount') !~ '^[0-9]{1,6}$'
      or (payload->>'attemptedCount')::integer > (payload->>'learnerCount')::integer
      or (payload->>'finishedCount')::integer > (payload->>'attemptedCount')::integer
      or (payload->>'gradedCount')::integer > (payload->>'finishedCount')::integer then
      return false;
    end if;
    return true;
  end if;

  for learner in
    select item.value
    from pg_catalog.jsonb_array_elements(payload->'learners') as item(value)
  loop
    if pg_catalog.jsonb_typeof(learner) <> 'object'
      or nile_private.jsonb_has_forbidden_keys(learner) then
      return false;
    end if;

    select pg_catalog.array_agg(key order by key)
    into learner_keys
    from pg_catalog.jsonb_object_keys(learner) as key;

    if not (learner_keys @> array[
      'attemptNumber', 'attemptState', 'gradingState', 'internalEnrollmentId',
      'internalMembershipId', 'internalUserId', 'latest', 'preview'
    ]::text[])
      or not (learner_keys <@ array[
        'attemptNumber', 'attemptProjectionId', 'attemptState', 'finishedAt',
        'gradingState', 'internalEnrollmentId', 'internalMembershipId',
        'internalUserId', 'latest', 'maximumScore', 'modifiedAt', 'preview',
        'score', 'startedAt'
      ]::text[])
      or (learner->>'internalUserId') !~ uuid_pattern
      or (learner->>'internalEnrollmentId') !~ uuid_pattern
      or (learner->>'internalMembershipId') !~ uuid_pattern
      or learner->>'attemptState' not in ('not_started', 'in_progress', 'finished', 'abandoned')
      or learner->>'gradingState' not in ('not_graded', 'graded', 'released')
      or pg_catalog.jsonb_typeof(learner->'attemptNumber') <> 'number'
      or (learner->>'attemptNumber') !~ '^(0|[1-9]|1[0-9]|20)$'
      or pg_catalog.jsonb_typeof(learner->'latest') <> 'boolean'
      or pg_catalog.jsonb_typeof(learner->'preview') <> 'boolean'
      or (learner->>'preview')::boolean then
      return false;
    end if;

    if (learner->>'attemptState') = 'not_started'
      and ((learner->>'attemptNumber')::integer <> 0
        or learner->>'gradingState' <> 'not_graded'
        or learner ?| array[
          'attemptProjectionId', 'startedAt', 'finishedAt', 'modifiedAt',
          'score', 'maximumScore'
        ]) then
      return false;
    elsif (learner->>'attemptState') <> 'not_started'
      and ((learner->>'attemptNumber')::integer < 1
        or not (learner ? 'attemptProjectionId')
        or (learner->>'attemptProjectionId') !~ uuid_pattern
        or not (learner ? 'startedAt')) then
      return false;
    elsif learner->>'attemptState' = 'finished' and not (learner ? 'finishedAt') then
      return false;
    elsif learner->>'attemptState' = 'in_progress'
      and (learner ?| array['finishedAt', 'score', 'maximumScore']
        or learner->>'gradingState' <> 'not_graded') then
      return false;
    end if;

    foreach timestamp_key in array array['startedAt', 'finishedAt', 'modifiedAt']
    loop
      if learner ? timestamp_key then
        if pg_catalog.jsonb_typeof(learner->timestamp_key) <> 'string'
          or pg_catalog.length(learner->>timestamp_key) > 40 then
          return false;
        end if;
        begin
          timestamp_value := (learner->>timestamp_key)::timestamptz;
        exception when invalid_datetime_format or datetime_field_overflow then
          return false;
        end;
      end if;
    end loop;

    if (learner ? 'score') <> (learner ? 'maximumScore') then
      return false;
    end if;
    if learner ? 'score' then
      if pg_catalog.jsonb_typeof(learner->'score') <> 'number'
        or pg_catalog.jsonb_typeof(learner->'maximumScore') <> 'number'
        or (learner->>'score') !~ '^[0-9]{1,6}(\.[0-9]{1,4})?$'
        or (learner->>'maximumScore') !~ '^[0-9]{1,6}(\.[0-9]{1,4})?$' then
        return false;
      end if;
      score := (learner->>'score')::numeric;
      maximum_score := (learner->>'maximumScore')::numeric;
      if maximum_score <= 0 or score < 0 or score > maximum_score
        or learner->>'gradingState' = 'not_graded'
        or learner->>'attemptState' <> 'finished' then
        return false;
      end if;
    end if;
    if learner->>'gradingState' <> 'not_graded' and not (learner ? 'score') then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

create table public.moodle_quiz_attempt_observations (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  request_hash bytea not null check (pg_catalog.octet_length(request_hash) = 32),
  connection_id uuid not null references public.integration_connections(id) on delete restrict,
  internal_course_id uuid not null references public.course_templates(id) on delete restrict,
  internal_class_group_id uuid not null references public.class_groups(id) on delete restrict,
  quiz_projection_id uuid not null references public.external_records(id) on delete restrict,
  subject_user_id uuid references public.app_users(id) on delete restrict,
  external_course_record_id uuid references public.external_records(id) on delete restrict,
  external_group_record_id uuid references public.external_records(id) on delete restrict,
  sync_run_id uuid not null references public.sync_runs(id) on delete restrict,
  sync_run_item_id uuid not null references public.sync_run_items(id) on delete restrict,
  reconciliation_case_id uuid references public.reconciliation_cases(id) on delete restrict,
  audience text not null check (audience in ('learner', 'person_level', 'aggregate')),
  outcome text not null check (outcome in ('available', 'empty', 'unavailable', 'reconciliation')),
  reconciliation_reason text check (
    reconciliation_reason in (
      'missing_course_mapping', 'missing_group_mapping',
      'missing_user_mapping', 'missing_quiz_mapping',
      'provider_result_drift', 'ambiguous_mapping'
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
  check ((audience = 'learner') = (subject_user_id is not null)),
  check (
    sanitized_payload is null
    or nile_private.moodle_quiz_attempt_payload_is_safe(sanitized_payload, audience)
  ),
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
  ),
  check (purge_after > observed_at and purge_after <= observed_at + interval '30 days')
);

create index moodle_quiz_attempt_observations_scope_time_idx
  on public.moodle_quiz_attempt_observations (
    connection_id, internal_course_id, internal_class_group_id,
    quiz_projection_id, audience, subject_user_id,
    observed_at desc, id desc
  );
create index moodle_quiz_attempt_observations_retained_idx
  on public.moodle_quiz_attempt_observations (
    connection_id, internal_class_group_id, quiz_projection_id,
    audience, subject_user_id, retain_until desc
  ) where outcome in ('available', 'empty');
create index moodle_quiz_attempt_observations_purge_idx
  on public.moodle_quiz_attempt_observations (purge_after, id);

create function public.resolve_moodle_quiz_attempt_context(
  p_user_id uuid,
  p_active_role_grant_id uuid,
  p_internal_class_group_id uuid,
  p_quiz_projection_id uuid
)
returns table (
  connection_id uuid,
  active_role text,
  projection_audience text,
  internal_course_id uuid,
  internal_course_run_id uuid,
  internal_class_group_id uuid,
  quiz_projection_id uuid,
  authorized_user_ids uuid[],
  course_mapping_status text,
  group_mapping_status text,
  user_mapping_status text,
  quiz_mapping_status text,
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
    or p_internal_class_group_id is null or p_quiz_projection_id is null then
    raise exception 'Current actor, grant, class group, and quiz projection are required'
      using errcode = '42501';
  end if;

  select * into strict user_authority
  from public.resolve_moodle_user_projection_authority(
    p_user_id, p_active_role_grant_id
  );

  if user_authority.active_role not in (
    'student', 'teacher', 'headofdepartment', 'superadmin'
  ) then
    raise exception 'Role cannot read quiz attempt observations'
      using errcode = '42501';
  end if;

  select * into strict effective_grant
  from nile_private.resolve_effective_role_grant(
    p_user_id, p_active_role_grant_id, authority_at
  );

  select
    class_group.id as class_group_id, class_group.status as group_status,
    course_run.id as course_run_id, course_run.status as run_status,
    course_run.starts_on, course_run.ends_on, course_template.id as course_id,
    program.department_id
  into strict class_context
  from public.class_groups as class_group
  join public.course_runs as course_run
    on course_run.id = class_group.course_run_id
   and course_run.status in ('active', 'completed')
  join public.course_templates as course_template
    on course_template.id = course_run.course_template_id
   and course_template.status = 'active'
  join public.programs as program
    on program.id = course_template.program_id
   and program.status = 'active'
  where class_group.id = p_internal_class_group_id
    and class_group.status in ('active', 'completed');

  if user_authority.active_role = 'student' then
    if not exists (
      select 1
      from public.student_profiles as student_profile
      join public.enrollments as enrollment
        on enrollment.student_profile_id = student_profile.id
       and enrollment.course_run_id = class_context.course_run_id
       and enrollment.status in ('active', 'completed')
      join public.class_memberships as membership
        on membership.enrollment_id = enrollment.id
       and membership.course_run_id = class_context.course_run_id
       and membership.class_group_id = class_context.class_group_id
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
  end if;

  if user_authority.active_role = 'teacher' and (
    class_context.run_status <> 'active'
    or class_context.group_status <> 'active'
    or authority_at::date not between class_context.starts_on and class_context.ends_on
    or not exists (
    select 1
    from public.staff_profiles as teacher_profile
    join public.teacher_assignments as assignment
      on assignment.teacher_profile_id = teacher_profile.id
     and assignment.class_group_id = class_context.class_group_id
     and assignment.status = 'active'
     and assignment.starts_at <= authority_at
     and (assignment.ends_at is null or assignment.ends_at > authority_at)
    where teacher_profile.user_id = p_user_id
      and teacher_profile.status = 'active'
    )
  ) then
    raise exception 'Teacher is not currently assigned to the exact class'
      using errcode = '42501';
  end if;

  if user_authority.active_role = 'headofdepartment'
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
    raise exception 'Quiz attempt projection requires exactly one ready read-only Moodle connection'
      using errcode = '42501';
  end if;

  connection_id := ready_connection_id;
  active_role := user_authority.active_role;
  projection_audience := case active_role
    when 'student' then 'learner'
    when 'teacher' then 'person_level'
    else 'aggregate'
  end;
  internal_course_id := class_context.course_id;
  internal_course_run_id := class_context.course_run_id;
  internal_class_group_id := class_context.class_group_id;
  quiz_projection_id := p_quiz_projection_id;
  observed_at := authority_at;

  if active_role = 'student' then
    authorized_user_ids := array[p_user_id]::uuid[];
  elsif active_role = 'teacher' then
    select coalesce(pg_catalog.array_agg(learner.id order by learner.id), '{}'::uuid[])
    into authorized_user_ids
    from public.class_memberships as membership
    join public.enrollments as enrollment
      on enrollment.id = membership.enrollment_id
     and enrollment.course_run_id = class_context.course_run_id
     and enrollment.status = 'active'
     and enrollment.starts_at <= authority_at
     and (enrollment.ends_at is null or enrollment.ends_at > authority_at)
    join public.student_profiles as student_profile
      on student_profile.id = enrollment.student_profile_id
     and student_profile.status = 'active'
    join public.app_users as learner
      on learner.id = student_profile.user_id and learner.status = 'active'
    where membership.class_group_id = class_context.class_group_id
      and membership.course_run_id = class_context.course_run_id
      and membership.status = 'active'
      and membership.starts_at <= authority_at
      and (membership.ends_at is null or membership.ends_at > authority_at);
  else
    authorized_user_ids := '{}'::uuid[];
  end if;

  select mapping.external_id into course_external_id
  from public.external_records as mapping
  where mapping.connection_id = ready_connection_id
    and mapping.entity_type = 'course'
    and mapping.internal_id = class_context.course_id
    and mapping.sync_state <> 'ignored';
  course_mapping_status := case when course_external_id is not null
    then 'exact' else 'missing' end;
  group_mapping_status := case when exists (
    select 1 from public.external_records as mapping
    where mapping.connection_id = ready_connection_id
      and mapping.entity_type = 'class_group'
      and mapping.internal_id = class_context.class_group_id
      and mapping.sync_state <> 'ignored'
  ) then 'exact' else 'missing' end;
  user_mapping_status := case
    when active_role = 'student' and exists (
      select 1 from public.external_records as mapping
      where mapping.connection_id = ready_connection_id
        and mapping.entity_type = 'user'
        and mapping.internal_id = p_user_id
        and mapping.sync_state <> 'ignored'
    ) then 'exact'
    when active_role = 'student' then 'missing'
    when not exists (
    select 1
    from public.class_memberships as membership
    join public.enrollments as enrollment
      on enrollment.id = membership.enrollment_id
     and enrollment.course_run_id = class_context.course_run_id
     and enrollment.status = 'active'
     and enrollment.starts_at <= authority_at
     and (enrollment.ends_at is null or enrollment.ends_at > authority_at)
    join public.student_profiles as student_profile
      on student_profile.id = enrollment.student_profile_id
     and student_profile.status = 'active'
    join public.app_users as learner
      on learner.id = student_profile.user_id and learner.status = 'active'
    left join public.external_records as mapping
      on mapping.connection_id = ready_connection_id
     and mapping.entity_type = 'user'
     and mapping.internal_id = learner.id
     and mapping.sync_state <> 'ignored'
    where (active_role <> 'teacher' or learner.id = any(authorized_user_ids))
      and membership.class_group_id = class_context.class_group_id
      and membership.course_run_id = class_context.course_run_id
      and membership.status = 'active'
      and membership.starts_at <= authority_at
      and (membership.ends_at is null or membership.ends_at > authority_at)
      and mapping.id is null
  ) then 'exact' else 'missing' end;
  quiz_mapping_status := case when course_external_id is not null and exists (
    select 1 from public.external_records as mapping
    where mapping.id = p_quiz_projection_id
      and mapping.connection_id = ready_connection_id
      and mapping.entity_type = 'quiz'
      and mapping.external_parent_id = course_external_id
      and mapping.sync_state in ('matched', 'synced')
  ) then 'exact' else 'missing' end;

  return next;
exception
  when no_data_found then
    raise exception 'Class context does not resolve to current normalized authority'
      using errcode = '42501';
end;
$$;

create function public.record_moodle_quiz_attempt_observation(
  p_idempotency_key text,
  p_connection_id uuid,
  p_internal_course_id uuid,
  p_internal_class_group_id uuid,
  p_quiz_projection_id uuid,
  p_external_course_record_id uuid,
  p_external_group_record_id uuid,
  p_sync_run_id uuid,
  p_sync_run_item_id uuid,
  p_audience text,
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
  quiz_mapping record;
  run_row record;
  item_row record;
  case_row record;
  payload_learner jsonb;
  derived_subject_user_id uuid;
  roster_count integer;
  mapped_count integer;
begin
  if p_idempotency_key is null
    or p_idempotency_key !~ '^[a-z0-9][a-z0-9._:-]{7,127}$'
    or p_audience not in ('learner', 'person_level', 'aggregate')
    or p_outcome not in ('available', 'empty', 'unavailable', 'reconciliation')
    or (p_audience = 'learner' and p_outcome <> 'available')
    or p_observed_at is null then
    raise exception 'Invalid quiz attempt observation metadata'
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

  select course_template.id as course_id, course_run.id as run_id, class_group.id as group_id
  into strict class_context
  from public.class_groups as class_group
  join public.course_runs as course_run
    on course_run.id = class_group.course_run_id
   and course_run.status = 'active'
   and course_run.starts_on <= p_observed_at::date
   and course_run.ends_on >= p_observed_at::date
  join public.course_templates as course_template
    on course_template.id = course_run.course_template_id
   and course_template.status = 'active'
  where class_group.id = p_internal_class_group_id
    and class_group.status = 'active';

  if class_context.course_id is distinct from p_internal_course_id then
    raise exception 'Observation course and class context do not match'
      using errcode = '23514';
  end if;

  if p_outcome in ('available', 'empty') then
    if p_sanitized_payload is null
      or not nile_private.moodle_quiz_attempt_payload_is_safe(
        p_sanitized_payload, p_audience
      )
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
      or (p_sanitized_payload->>'quizProjectionId')::uuid <> p_quiz_projection_id
      or p_sanitized_payload->>'providerState' <> p_outcome
      or (p_outcome = 'empty' and p_sanitized_payload->>'mappingStatus' <> 'exact') then
      raise exception 'Successful observation requires an exact safe bounded projection'
        using errcode = '22023';
    end if;
  elsif p_sanitized_payload is not null or p_projection_hash is not null
    or p_fresh_until is not null or p_retain_until is not null then
    raise exception 'Unavailable and reconciliation outcomes cannot retain payloads'
      using errcode = '22023';
  end if;

  if p_outcome = 'reconciliation' then
    if p_reconciliation_case_id is null or p_reconciliation_reason not in (
      'missing_course_mapping', 'missing_group_mapping',
      'missing_user_mapping', 'missing_quiz_mapping',
      'provider_result_drift', 'ambiguous_mapping'
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

  select mapping.connection_id, mapping.external_parent_id, mapping.external_id
  into strict quiz_mapping
  from public.external_records as mapping
  where mapping.id = p_quiz_projection_id
    and mapping.entity_type = 'quiz'
    and mapping.sync_state in ('matched', 'synced');
  if quiz_mapping.connection_id <> p_connection_id
    or quiz_mapping.external_parent_id <> course_mapping.external_id then
    raise exception 'Quiz mapping is outside the exact course context'
      using errcode = '23514';
  end if;

  if p_outcome = 'available' and p_audience in ('learner', 'person_level') then
    for payload_learner in
      select item.value from pg_catalog.jsonb_array_elements(
        p_sanitized_payload->'learners'
      ) as item(value)
    loop
      if not exists (
        select 1
        from public.class_memberships as membership
        join public.enrollments as enrollment
          on enrollment.id = membership.enrollment_id
         and enrollment.course_run_id = class_context.run_id
         and enrollment.status = 'active'
         and enrollment.starts_at <= p_observed_at
         and (enrollment.ends_at is null or enrollment.ends_at > p_observed_at)
        join public.student_profiles as student_profile
          on student_profile.id = enrollment.student_profile_id
         and student_profile.status = 'active'
        join public.app_users as learner
          on learner.id = student_profile.user_id and learner.status = 'active'
        where membership.id = (payload_learner->>'internalMembershipId')::uuid
          and enrollment.id = (payload_learner->>'internalEnrollmentId')::uuid
          and learner.id = (payload_learner->>'internalUserId')::uuid
          and membership.class_group_id = p_internal_class_group_id
          and membership.course_run_id = class_context.run_id
          and membership.status = 'active'
          and membership.starts_at <= p_observed_at
          and (membership.ends_at is null or membership.ends_at > p_observed_at)
      ) then
        raise exception 'Person-level payload contains a noncurrent learner tuple'
          using errcode = '23514';
      end if;

      if not exists (
        select 1 from public.external_records as user_mapping
        where user_mapping.connection_id = p_connection_id
          and user_mapping.entity_type = 'user'
          and user_mapping.internal_id = (payload_learner->>'internalUserId')::uuid
          and user_mapping.sync_state <> 'ignored'
      ) then
        raise exception 'Person-level result lacks an exact user mapping'
          using errcode = '23514';
      end if;

      if payload_learner->>'attemptState' <> 'not_started' and not exists (
        select 1
        from public.external_records as attempt_mapping
        where attempt_mapping.id = (payload_learner->>'attemptProjectionId')::uuid
          and attempt_mapping.connection_id = p_connection_id
          and attempt_mapping.entity_type = 'quiz_attempt'
          and attempt_mapping.external_parent_id = quiz_mapping.external_id
          and attempt_mapping.sync_state in ('matched', 'synced')
      ) then
        raise exception 'Quiz result lacks an exact attempt mapping'
          using errcode = '23514';
      end if;
    end loop;

    select pg_catalog.count(*)::integer into roster_count
    from public.class_memberships as membership
    join public.enrollments as enrollment
      on enrollment.id = membership.enrollment_id
     and enrollment.course_run_id = class_context.run_id
     and enrollment.status = 'active'
     and enrollment.starts_at <= p_observed_at
     and (enrollment.ends_at is null or enrollment.ends_at > p_observed_at)
    join public.student_profiles as student_profile
      on student_profile.id = enrollment.student_profile_id and student_profile.status = 'active'
    join public.app_users as learner
      on learner.id = student_profile.user_id and learner.status = 'active'
    where membership.class_group_id = p_internal_class_group_id
      and membership.course_run_id = class_context.run_id
      and membership.status = 'active'
      and membership.starts_at <= p_observed_at
      and (membership.ends_at is null or membership.ends_at > p_observed_at);

    if p_audience = 'learner' then
      if pg_catalog.jsonb_array_length(p_sanitized_payload->'learners') <> 1 then
        raise exception 'Learner result must contain exactly one learner tuple'
          using errcode = '23514';
      end if;
      derived_subject_user_id := (p_sanitized_payload->'learners'->0->>'internalUserId')::uuid;
    elsif roster_count <> pg_catalog.jsonb_array_length(p_sanitized_payload->'learners')
      or roster_count <> (
        select pg_catalog.count(distinct item.value->>'internalUserId')
        from pg_catalog.jsonb_array_elements(p_sanitized_payload->'learners') as item(value)
      ) then
      raise exception 'Person-level payload is not the exact current class roster'
        using errcode = '23514';
    end if;

    if (
      select pg_catalog.count(item.value->>'attemptProjectionId')
      from pg_catalog.jsonb_array_elements(p_sanitized_payload->'learners') as item(value)
      where item.value ? 'attemptProjectionId'
    ) <> (
      select pg_catalog.count(distinct item.value->>'attemptProjectionId')
      from pg_catalog.jsonb_array_elements(p_sanitized_payload->'learners') as item(value)
      where item.value ? 'attemptProjectionId'
    ) then
      raise exception 'Quiz attempt mappings must be unique per projection'
        using errcode = '23514';
    end if;
  elsif p_outcome = 'empty' and p_audience in ('learner', 'person_level')
    and pg_catalog.jsonb_array_length(p_sanitized_payload->'learners') <> 0 then
    raise exception 'Empty person-level projection must contain no learners'
      using errcode = '23514';
  elsif p_outcome = 'available' and p_audience = 'aggregate' then
    select pg_catalog.count(*)::integer, pg_catalog.count(user_mapping.id)::integer
    into roster_count, mapped_count
    from public.class_memberships as membership
    join public.enrollments as enrollment
      on enrollment.id = membership.enrollment_id
     and enrollment.course_run_id = class_context.run_id
     and enrollment.status = 'active'
     and enrollment.starts_at <= p_observed_at
     and (enrollment.ends_at is null or enrollment.ends_at > p_observed_at)
    join public.student_profiles as student_profile
      on student_profile.id = enrollment.student_profile_id and student_profile.status = 'active'
    join public.app_users as learner
      on learner.id = student_profile.user_id and learner.status = 'active'
    left join public.external_records as user_mapping
      on user_mapping.connection_id = p_connection_id
     and user_mapping.entity_type = 'user'
     and user_mapping.internal_id = learner.id
     and user_mapping.sync_state <> 'ignored'
    where membership.class_group_id = p_internal_class_group_id
      and membership.course_run_id = class_context.run_id
      and membership.status = 'active'
      and membership.starts_at <= p_observed_at
      and (membership.ends_at is null or membership.ends_at > p_observed_at);

    if (p_sanitized_payload->>'learnerCount')::integer <> roster_count
      or mapped_count <> roster_count
      then
      raise exception 'Aggregate counts require the exact fully mapped current class'
        using errcode = '23514';
    end if;
  elsif p_outcome = 'empty' and p_audience = 'aggregate'
    and (
      (p_sanitized_payload->>'learnerCount')::integer <> 0
      or (p_sanitized_payload->>'attemptedCount')::integer <> 0
      or (p_sanitized_payload->>'finishedCount')::integer <> 0
      or (p_sanitized_payload->>'gradedCount')::integer <> 0
    ) then
    raise exception 'Empty aggregate projection must contain zero counts'
      using errcode = '23514';
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
    or run_row.entity_type <> 'quiz_attempts_projection'
    or run_row.direction <> 'read'
    or run_row.status not in ('succeeded', 'partial', 'failed')
    or item_row.sync_run_id <> p_sync_run_id
    or item_row.external_record_id is distinct from p_quiz_projection_id
    or item_row.external_id is distinct from quiz_mapping.external_id
    or (p_outcome in ('available', 'empty') and item_row.status <> 'succeeded')
    or (p_outcome = 'unavailable' and item_row.status <> 'failed')
    or (p_outcome = 'reconciliation' and item_row.status <> 'needs_review') then
    raise exception 'Observation sync evidence is outside the exact read context'
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
      or case_row.entity_type <> 'quiz_attempts_projection'
      or case_row.internal_id <> p_quiz_projection_id
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
      p_internal_class_group_id::text, p_quiz_projection_id::text,
      p_external_course_record_id::text,
      p_external_group_record_id::text, p_sync_run_id::text,
      p_sync_run_item_id::text, p_audience, p_outcome, p_sanitized_payload,
      pg_catalog.encode(p_projection_hash, 'hex'), p_observed_at::text,
      p_fresh_until::text, p_retain_until::text,
      p_reconciliation_case_id::text, p_reconciliation_reason
    )::text, 'UTF8'), 'sha256'
  );

  insert into public.moodle_quiz_attempt_observations (
    idempotency_key, request_hash, connection_id, internal_course_id,
    internal_class_group_id, quiz_projection_id, subject_user_id,
    external_course_record_id,
    external_group_record_id, sync_run_id, sync_run_item_id,
    reconciliation_case_id, audience, outcome, reconciliation_reason,
    sanitized_payload, projection_hash, observed_at, fresh_until, retain_until,
    purge_after
  ) values (
    p_idempotency_key, calculated_request_hash, p_connection_id,
    p_internal_course_id, p_internal_class_group_id, p_quiz_projection_id,
    derived_subject_user_id,
    p_external_course_record_id, p_external_group_record_id,
    p_sync_run_id, p_sync_run_item_id, p_reconciliation_case_id,
    p_audience, p_outcome, p_reconciliation_reason, p_sanitized_payload,
    p_projection_hash, p_observed_at, p_fresh_until, p_retain_until,
    p_observed_at + interval '30 days'
  ) on conflict (idempotency_key) do nothing returning id into inserted_id;

  if inserted_id is not null then
    return query select inserted_id, false;
    return;
  end if;

  select observation.id, observation.request_hash into strict existing_observation
  from public.moodle_quiz_attempt_observations as observation
  where observation.idempotency_key = p_idempotency_key;
  if existing_observation.request_hash is distinct from calculated_request_hash then
    raise exception 'Quiz attempt observation idempotency conflict'
      using errcode = '23505';
  end if;
  return query select existing_observation.id, true;
exception
  when no_data_found then
    raise exception 'Observation references missing or inactive exact evidence'
      using errcode = '23514';
end;
$$;

create function public.list_authorized_moodle_quiz_attempt_freshness(
  p_user_id uuid,
  p_active_role_grant_id uuid,
  p_connection_id uuid,
  p_internal_class_group_id uuid,
  p_quiz_projection_id uuid,
  p_as_of timestamptz
)
returns table (
  connection_id uuid,
  active_role text,
  projection_audience text,
  internal_course_id uuid,
  internal_class_group_id uuid,
  quiz_projection_id uuid,
  authorized_user_ids uuid[],
  course_mapping_status text,
  group_mapping_status text,
  user_mapping_status text,
  quiz_mapping_status text,
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
  from public.resolve_moodle_quiz_attempt_context(
    p_user_id, p_active_role_grant_id, p_internal_class_group_id,
    p_quiz_projection_id
  );
  if context.connection_id <> p_connection_id then
    raise exception 'Connection is outside the live class authority context'
      using errcode = '42501';
  end if;

  return query
  select
    context.connection_id, context.active_role, context.projection_audience,
    context.internal_course_id, context.internal_class_group_id,
    context.quiz_projection_id, context.authorized_user_ids,
    context.course_mapping_status, context.group_mapping_status,
    context.user_mapping_status, context.quiz_mapping_status,
    case
      when context.course_mapping_status <> 'exact'
        or context.group_mapping_status <> 'exact'
        or context.quiz_mapping_status <> 'exact'
        or context.user_mapping_status = 'missing' then 'reconciliation'
      when retained_success.id is not null
        and latest_observation.id = retained_success.id
        and p_as_of <= retained_success.fresh_until then 'fresh'
      when retained_success.id is not null then 'stale_retained'
      when prior_success.id is not null then 'expired'
      when latest_observation.outcome = 'reconciliation' then 'reconciliation'
      else 'unavailable'
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
  from (select 1) as singleton
  left join lateral (
    select observation.*
    from public.moodle_quiz_attempt_observations as observation
    where observation.connection_id = context.connection_id
      and observation.internal_course_id = context.internal_course_id
      and observation.internal_class_group_id = context.internal_class_group_id
      and observation.quiz_projection_id = context.quiz_projection_id
      and observation.audience = context.projection_audience
      and (context.projection_audience <> 'learner'
        or observation.subject_user_id = context.authorized_user_ids[1])
      and observation.observed_at <= p_as_of
    order by observation.observed_at desc, observation.id desc limit 1
  ) as latest_observation on true
  left join lateral (
    select observation.*
    from public.moodle_quiz_attempt_observations as observation
    where observation.connection_id = context.connection_id
      and observation.internal_course_id = context.internal_course_id
      and observation.internal_class_group_id = context.internal_class_group_id
      and observation.quiz_projection_id = context.quiz_projection_id
      and observation.audience = context.projection_audience
      and (context.projection_audience <> 'learner'
        or observation.subject_user_id = context.authorized_user_ids[1])
      and observation.outcome in ('available', 'empty')
      and context.course_mapping_status = 'exact'
      and context.group_mapping_status = 'exact'
      and context.user_mapping_status <> 'missing'
      and context.quiz_mapping_status = 'exact'
      and (
        context.projection_audience = 'aggregate'
        or not exists (
          select 1
          from pg_catalog.jsonb_array_elements(
            observation.sanitized_payload->'learners'
          ) as retained_learner(value)
          where not (
            (retained_learner.value->>'internalUserId')::uuid
              = any(context.authorized_user_ids)
          )
        )
      )
      and observation.observed_at <= p_as_of
      and p_as_of <= observation.retain_until
    order by observation.observed_at desc, observation.id desc limit 1
  ) as retained_success on true
  left join lateral (
    select observation.id
    from public.moodle_quiz_attempt_observations as observation
    where observation.connection_id = context.connection_id
      and observation.internal_course_id = context.internal_course_id
      and observation.internal_class_group_id = context.internal_class_group_id
      and observation.quiz_projection_id = context.quiz_projection_id
      and observation.audience = context.projection_audience
      and (context.projection_audience <> 'learner'
        or observation.subject_user_id = context.authorized_user_ids[1])
      and observation.outcome in ('available', 'empty')
      and observation.observed_at <= p_as_of
    order by observation.observed_at desc, observation.id desc limit 1
  ) as prior_success on true;
end;
$$;

create function nile_private.guard_moodle_quiz_attempt_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  purge_cutoff timestamptz;
begin
  if tg_op = 'DELETE'
    and pg_catalog.current_setting('nile.phase6h2_purge', true) = 'bounded' then
    purge_cutoff := pg_catalog.current_setting(
      'nile.phase6h2_purge_cutoff', true
    )::timestamptz;
    if old.purge_after <= purge_cutoff then
      return old;
    end if;
  end if;
  raise exception 'Moodle quiz attempt observations are immutable'
    using errcode = '55000';
end;
$$;

create function public.purge_moodle_quiz_attempt_observations(
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
  perform pg_catalog.set_config('nile.phase6h2_purge', 'bounded', true);
  perform pg_catalog.set_config('nile.phase6h2_purge_cutoff', p_as_of::text, true);
  return query
  with candidates as (
    select observation.id
    from public.moodle_quiz_attempt_observations as observation
    where observation.purge_after <= p_as_of
    order by observation.purge_after, observation.id
    limit p_limit
    for update
  ), deleted as (
    delete from public.moodle_quiz_attempt_observations as observation
    using candidates
    where observation.id = candidates.id
    returning observation.id
  )
  select pg_catalog.count(*)::integer from deleted;
end;
$$;

create trigger moodle_quiz_attempt_observations_immutable
before update or delete on public.moodle_quiz_attempt_observations
for each row execute function nile_private.guard_moodle_quiz_attempt_immutable();

alter table public.moodle_quiz_attempt_observations enable row level security;
alter table public.moodle_quiz_attempt_observations force row level security;

revoke all on table public.moodle_quiz_attempt_observations
from public, anon, authenticated, service_role;
revoke all on function nile_private.moodle_quiz_attempt_payload_is_safe(jsonb, text)
from public, anon, authenticated, service_role;
revoke all on function nile_private.guard_moodle_quiz_attempt_immutable()
from public, anon, authenticated, service_role;

revoke all on function public.resolve_moodle_quiz_attempt_context(uuid, uuid, uuid, uuid)
from public, anon, authenticated;
revoke all on function public.record_moodle_quiz_attempt_observation(text, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, text, jsonb, bytea, timestamptz, timestamptz, timestamptz, uuid, text)
from public, anon, authenticated;
revoke all on function public.list_authorized_moodle_quiz_attempt_freshness(uuid, uuid, uuid, uuid, uuid, timestamptz)
from public, anon, authenticated;
revoke all on function public.purge_moodle_quiz_attempt_observations(timestamptz, integer)
from public, anon, authenticated;

grant execute on function public.resolve_moodle_quiz_attempt_context(uuid, uuid, uuid, uuid)
to service_role;
grant execute on function public.record_moodle_quiz_attempt_observation(text, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, text, jsonb, bytea, timestamptz, timestamptz, timestamptz, uuid, text)
to service_role;
grant execute on function public.list_authorized_moodle_quiz_attempt_freshness(uuid, uuid, uuid, uuid, uuid, timestamptz)
to service_role;
grant execute on function public.purge_moodle_quiz_attempt_observations(timestamptz, integer)
to service_role;

commit;
