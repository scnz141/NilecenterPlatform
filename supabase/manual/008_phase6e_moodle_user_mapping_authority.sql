-- Nile Learn Phase 6E additive Moodle user-mapping authority.
--
-- This package adds service-only read RPCs over accepted normalized tables.
-- It creates no table and performs no Moodle or normalized workflow writes.

begin;

do $$
declare
  required_relation text;
begin
  foreach required_relation in array array[
    'app_users',
    'role_grants',
    'role_grant_department_scopes',
    'departments',
    'staff_profiles',
    'programs',
    'course_templates',
    'course_runs',
    'class_groups',
    'teacher_assignments',
    'student_profiles',
    'enrollments',
    'class_memberships',
    'integration_connections',
    'external_records'
  ] loop
    if pg_catalog.to_regclass('public.' || required_relation) is null then
      raise exception 'Phase 6E requires public.%', required_relation;
    end if;
  end loop;

  if pg_catalog.to_regprocedure(
    'nile_private.resolve_effective_role_grant(uuid,uuid,timestamp with time zone)'
  ) is null then
    raise exception 'Phase 6E requires nile_private.resolve_effective_role_grant(uuid, uuid, timestamptz)';
  end if;
end;
$$;

create function public.resolve_moodle_user_projection_authority(
  p_user_id uuid,
  p_active_role_grant_id uuid
)
returns table (
  active_role text,
  authorized_user_ids uuid[],
  observed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  authority_at timestamptz := pg_catalog.now();
  authority record;
begin
  if p_user_id is null or p_active_role_grant_id is null then
    raise exception using
      errcode = '42501',
      message = 'A current user and role grant are required';
  end if;

  select effective.active_role, effective.department_ids
  into authority
  from nile_private.resolve_effective_role_grant(
    p_user_id,
    p_active_role_grant_id,
    authority_at
  ) as effective
  join public.app_users as actor
    on actor.id = p_user_id
   and actor.status = 'active';

  if authority.active_role is null then
    raise exception using
      errcode = '42501',
      message = 'The user and role grant do not resolve to current authority';
  end if;

  if authority.active_role not in (
    'student',
    'teacher',
    'headofdepartment',
    'superadmin'
  ) then
    raise exception using
      errcode = '42501',
      message = 'The active role cannot read Moodle user projections';
  end if;

  active_role := authority.active_role;
  observed_at := authority_at;

  if active_role = 'student' then
    authorized_user_ids := array[p_user_id];

  elsif active_role = 'teacher' then
    select coalesce(
      pg_catalog.array_agg(candidate.user_id order by candidate.user_id),
      '{}'::uuid[]
    )
    into authorized_user_ids
    from (
      select p_user_id as user_id
      union
      select learner.id
      from public.staff_profiles as teacher_profile
      join public.teacher_assignments as assignment
        on assignment.teacher_profile_id = teacher_profile.id
       and assignment.status = 'active'
       and assignment.starts_at <= authority_at
       and (assignment.ends_at is null or assignment.ends_at > authority_at)
      join public.class_groups as class_group
        on class_group.id = assignment.class_group_id
       and class_group.status = 'active'
      join public.course_runs as course_run
        on course_run.id = class_group.course_run_id
       and course_run.status = 'active'
       and course_run.starts_on <= authority_at::date
       and course_run.ends_on >= authority_at::date
      join public.class_memberships as membership
        on membership.class_group_id = class_group.id
       and membership.course_run_id = course_run.id
       and membership.status = 'active'
       and membership.starts_at <= authority_at
       and (membership.ends_at is null or membership.ends_at > authority_at)
      join public.enrollments as enrollment
        on enrollment.id = membership.enrollment_id
       and enrollment.course_run_id = course_run.id
       and enrollment.status = 'active'
       and enrollment.starts_at <= authority_at
       and (enrollment.ends_at is null or enrollment.ends_at > authority_at)
      join public.student_profiles as student_profile
        on student_profile.id = enrollment.student_profile_id
       and student_profile.status = 'active'
      join public.app_users as learner
        on learner.id = student_profile.user_id
       and learner.status = 'active'
      where teacher_profile.user_id = p_user_id
        and teacher_profile.status = 'active'
    ) as candidate;

  elsif active_role = 'headofdepartment' then
    select coalesce(
      pg_catalog.array_agg(candidate.user_id order by candidate.user_id),
      '{}'::uuid[]
    )
    into authorized_user_ids
    from (
      select p_user_id as user_id
      union
      select staff_user.id
      from public.role_grants as staff_grant
      join public.role_grant_department_scopes as staff_scope
        on staff_scope.role_grant_id = staff_grant.id
       and staff_scope.department_id = any(authority.department_ids)
       and staff_scope.starts_at <= authority_at
       and (staff_scope.ends_at is null or staff_scope.ends_at > authority_at)
      join public.departments as department
        on department.id = staff_scope.department_id
       and department.status = 'active'
      join public.app_users as staff_user
        on staff_user.id = staff_grant.user_id
       and staff_user.status = 'active'
      join public.staff_profiles as staff_profile
        on staff_profile.user_id = staff_user.id
       and staff_profile.status = 'active'
      where staff_grant.status = 'active'
        and staff_grant.starts_at <= authority_at
        and (staff_grant.ends_at is null or staff_grant.ends_at > authority_at)
      union
      select learner.id
      from public.programs as program
      join public.course_templates as course_template
        on course_template.program_id = program.id
       and course_template.status = 'active'
      join public.course_runs as course_run
        on course_run.course_template_id = course_template.id
       and course_run.status = 'active'
       and course_run.starts_on <= authority_at::date
       and course_run.ends_on >= authority_at::date
      join public.enrollments as enrollment
        on enrollment.course_run_id = course_run.id
       and enrollment.status = 'active'
       and enrollment.starts_at <= authority_at
       and (enrollment.ends_at is null or enrollment.ends_at > authority_at)
      join public.student_profiles as student_profile
        on student_profile.id = enrollment.student_profile_id
       and student_profile.status = 'active'
      join public.app_users as learner
        on learner.id = student_profile.user_id
       and learner.status = 'active'
      where program.department_id = any(authority.department_ids)
        and program.status = 'active'
    ) as candidate;

  else
    select coalesce(
      pg_catalog.array_agg(app_user.id order by app_user.id),
      '{}'::uuid[]
    )
    into authorized_user_ids
    from public.app_users as app_user
    where app_user.status = 'active';
  end if;

  return next;
end;
$$;

create function public.list_moodle_user_mappings_for_connection(
  p_connection_id uuid,
  p_internal_user_ids uuid[]
)
returns table (
  internal_user_id uuid,
  external_record_id uuid,
  external_user_id text,
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
declare
  requested_count integer;
begin
  if p_connection_id is null
    or p_internal_user_ids is null
    or pg_catalog.cardinality(p_internal_user_ids) = 0
    or pg_catalog.array_position(p_internal_user_ids, null) is not null then
    raise exception using
      errcode = '22023',
      message = 'A connection and nonempty user ID array without nulls are required';
  end if;

  select pg_catalog.count(*)::integer
  into requested_count
  from (
    select distinct requested.user_id
    from pg_catalog.unnest(p_internal_user_ids) as requested(user_id)
  ) as unique_requested;

  if requested_count <> pg_catalog.cardinality(p_internal_user_ids) then
    raise exception using
      errcode = '22023',
      message = 'Duplicate internal user IDs are not accepted';
  end if;

  if not exists (
    select 1
    from public.integration_connections as connection
    where connection.id = p_connection_id
      and connection.provider = 'moodle'
      and connection.mode = 'read_only'
      and connection.status = 'ready'
  ) then
    raise exception using
      errcode = '42501',
      message = 'The connection is not an active read-only Moodle authority';
  end if;

  if exists (
    select 1
    from pg_catalog.unnest(p_internal_user_ids) as requested(user_id)
    left join public.app_users as app_user
      on app_user.id = requested.user_id
     and app_user.status = 'active'
    where app_user.id is null
  ) then
    raise exception using
      errcode = '42501',
      message = 'Every requested mapping must target an active app user';
  end if;

  if exists (
    select 1
    from public.external_records as external_record
    where external_record.connection_id = p_connection_id
      and external_record.entity_type = 'user'
      and external_record.internal_id = any(p_internal_user_ids)
      and external_record.sync_state <> 'ignored'
      and (
        external_record.external_id !~ '^[1-9][0-9]{0,15}$'
        or external_record.external_id::numeric > 9007199254740991
      )
  ) then
    raise exception using
      errcode = '23514',
      message = 'A requested Moodle user mapping has an invalid exact external ID';
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
  join public.app_users as app_user
    on app_user.id = external_record.internal_id
   and app_user.status = 'active'
  where external_record.connection_id = p_connection_id
    and external_record.entity_type = 'user'
    and external_record.internal_id = any(p_internal_user_ids)
    and external_record.sync_state <> 'ignored'
  order by external_record.internal_id;
end;
$$;

revoke all on function public.resolve_moodle_user_projection_authority(uuid, uuid)
from public, anon, authenticated;
revoke all on function public.list_moodle_user_mappings_for_connection(uuid, uuid[])
from public, anon, authenticated;

grant execute on function public.resolve_moodle_user_projection_authority(uuid, uuid)
to service_role;
grant execute on function public.list_moodle_user_mappings_for_connection(uuid, uuid[])
to service_role;

commit;
