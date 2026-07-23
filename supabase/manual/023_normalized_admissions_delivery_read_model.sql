-- Nile Learn normalized Registrar course-run and class selection read model.
-- Manual-only. This exposes only branch-scoped operational choices through a
-- service-role RPC; it does not make Moodle or browser state authoritative.

begin;

do $$
declare
  dependency text;
begin
  foreach dependency in array array[
    'app_users', 'branches', 'role_grants', 'role_grant_branch_scopes',
    'auth_sessions', 'programs', 'course_levels', 'course_templates',
    'course_runs', 'class_groups', 'teacher_assignments', 'staff_profiles',
    'student_profiles', 'enrollments', 'class_memberships',
    'admission_placement_bookings', 'admission_placement_results'
  ] loop
    if pg_catalog.to_regclass('public.' || dependency) is null then
      raise exception 'Admissions delivery read model requires public.%', dependency;
    end if;
  end loop;
end;
$$;

create or replace function public.nile_read_admissions_operational_workspace(
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
  programs jsonb;
  levels jsonb;
  courses jsonb;
  runs jsonb;
  groups jsonb;
begin
  select placement.workspace into strict base_workspace
  from public.nile_read_admissions_placement_workspace(
    p_session_token_hash
  ) as placement;

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
    'id', program.id,
    'title', program.title,
    'category', program.code::text,
    'departmentId', program.department_id,
    'language', program.language,
    'status', program.status
  ) order by program.title), '[]'::jsonb)
  into programs
  from public.programs as program
  where exists (
    select 1
    from public.course_templates as course
    join public.course_runs as run on run.course_template_id = course.id
    where course.program_id = program.id
      and (
        actor_grant.role = 'superadmin'
        or exists (
          select 1 from public.role_grant_branch_scopes as scope
          where scope.role_grant_id = actor_grant.id
            and scope.branch_id = run.branch_id
            and scope.starts_at <= now()
            and (scope.ends_at is null or scope.ends_at > now())
        )
      )
  );

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', level.id,
    'programId', level.program_id,
    'title', level.title,
    'order', level.sort_order
  ) order by level.program_id, level.sort_order), '[]'::jsonb)
  into levels
  from public.course_levels as level
  where exists (
    select 1
    from public.course_templates as course
    join public.course_runs as run on run.course_template_id = course.id
    where course.level_id = level.id
      and (
        actor_grant.role = 'superadmin'
        or exists (
          select 1 from public.role_grant_branch_scopes as scope
          where scope.role_grant_id = actor_grant.id
            and scope.branch_id = run.branch_id
            and scope.starts_at <= now()
            and (scope.ends_at is null or scope.ends_at > now())
        )
      )
  );

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', course.id,
    'programId', course.program_id,
    'levelId', course.level_id,
    'slug', course.slug,
    'title', course.title,
    'description', course.description,
    'status', course.status
  ) order by course.title), '[]'::jsonb)
  into courses
  from public.course_templates as course
  where exists (
    select 1 from public.course_runs as run
    where run.course_template_id = course.id
      and (
        actor_grant.role = 'superadmin'
        or exists (
          select 1 from public.role_grant_branch_scopes as scope
          where scope.role_grant_id = actor_grant.id
            and scope.branch_id = run.branch_id
            and scope.starts_at <= now()
            and (scope.ends_at is null or scope.ends_at > now())
        )
      )
  );

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', run.id,
    'courseId', run.course_template_id,
    'branchId', run.branch_id,
    'teacherId', (
      select staff.user_id
      from public.class_groups as assigned_group
      join public.teacher_assignments as assignment
        on assignment.class_group_id = assigned_group.id
      join public.staff_profiles as staff
        on staff.id = assignment.teacher_profile_id
      where assigned_group.course_run_id = run.id
        and assigned_group.status = 'active'
        and assignment.status = 'active'
        and assignment.starts_at <= now()
        and (assignment.ends_at is null or assignment.ends_at > now())
      order by
        case assignment.assignment_type
          when 'primary' then 1 when 'substitute' then 2 else 3
        end,
        assignment.starts_at desc
      limit 1
    ),
    'term', run.term,
    'startsOn', run.starts_on,
    'endsOn', run.ends_on,
    'status', run.status
  ) order by run.starts_on desc, run.code), '[]'::jsonb)
  into runs
  from public.course_runs as run
  where actor_grant.role = 'superadmin'
    or exists (
      select 1 from public.role_grant_branch_scopes as scope
      where scope.role_grant_id = actor_grant.id
        and scope.branch_id = run.branch_id
        and scope.starts_at <= now()
        and (scope.ends_at is null or scope.ends_at > now())
    );

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', class_group.id,
    'courseRunId', class_group.course_run_id,
    'name', class_group.name,
    'capacity', class_group.capacity,
    'schedule', 'Schedule not configured',
    'studentIds', coalesce((
      select pg_catalog.jsonb_agg(
        enrollment.student_profile_id order by enrollment.student_profile_id
      )
      from public.class_memberships as membership
      join public.enrollments as enrollment
        on enrollment.id = membership.enrollment_id
      where membership.class_group_id = class_group.id
        and membership.status in ('active', 'paused')
        and enrollment.status in ('pending', 'active', 'paused')
    ), '[]'::jsonb),
    'status', class_group.status
  ) order by class_group.name), '[]'::jsonb)
  into groups
  from public.class_groups as class_group
  join public.course_runs as run on run.id = class_group.course_run_id
  where actor_grant.role = 'superadmin'
    or exists (
      select 1 from public.role_grant_branch_scopes as scope
      where scope.role_grant_id = actor_grant.id
        and scope.branch_id = run.branch_id
        and scope.starts_at <= now()
        and (scope.ends_at is null or scope.ends_at > now())
    );

  return query select base_workspace || pg_catalog.jsonb_build_object(
    'programs', programs,
    'levels', levels,
    'courses', courses,
    'courseRuns', runs,
    'classGroups', groups
  );
exception
  when no_data_found then
    raise exception 'Admissions delivery authority is unavailable'
      using errcode = '42501';
end;
$$;

revoke all on function public.nile_read_admissions_operational_workspace(text)
  from public, anon, authenticated;
grant execute on function public.nile_read_admissions_operational_workspace(text)
  to service_role;

commit;
