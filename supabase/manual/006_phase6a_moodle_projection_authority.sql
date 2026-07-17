-- Nile Learn Phase 6A normalized Moodle projection authority package.
--
-- Status: reviewed, additive, and intentionally unapplied. Run only after the
-- accepted Phase 1 identity/scope/mapping package on a disposable database.
-- Do not add this file to migration history or apply it to any Supabase project
-- without a separately approved promotion slice.

begin;

do $$
declare
  missing_dependencies text[];
begin
  select pg_catalog.array_agg(dependency order by dependency)
  into missing_dependencies
  from pg_catalog.unnest(array[
    'app_users',
    'branches',
    'departments',
    'external_records',
    'integration_connections',
    'role_grant_department_scopes',
    'role_grants',
    'staff_profiles'
  ]) as dependency
  where pg_catalog.to_regclass('public.' || dependency) is null;

  if missing_dependencies is not null then
    raise exception 'Phase 6A requires Phase 1 tables: %', missing_dependencies;
  end if;

  if pg_catalog.to_regprocedure('nile_private.set_updated_at()') is null then
    raise exception 'Phase 6A requires nile_private.set_updated_at()';
  end if;
end;
$$;

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete restrict,
  code text not null,
  title text not null,
  language text not null default 'en',
  status text not null default 'active'
    check (status in ('active', 'paused', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id, code),
  unique (id, department_id)
);

create table public.course_levels (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete restrict,
  code text not null,
  title text not null,
  sort_order integer not null check (sort_order > 0),
  status text not null default 'active'
    check (status in ('active', 'paused', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, code),
  unique (program_id, sort_order),
  unique (id, program_id)
);

create table public.course_templates (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete restrict,
  level_id uuid not null,
  code text not null,
  slug text not null unique,
  title text not null,
  description text,
  status text not null default 'active'
    check (status in ('active', 'paused', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (level_id, program_id)
    references public.course_levels(id, program_id) on delete restrict,
  unique (program_id, code)
);

create table public.student_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.app_users(id) on delete restrict,
  home_branch_id uuid references public.branches(id) on delete restrict,
  status text not null default 'active'
    check (status in ('active', 'paused', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.course_runs (
  id uuid primary key default gen_random_uuid(),
  course_template_id uuid not null references public.course_templates(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  code text not null,
  term text not null,
  starts_on date not null,
  ends_on date not null,
  status text not null default 'planned'
    check (status in ('planned', 'active', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on),
  unique (branch_id, code),
  unique (id, course_template_id)
);

create table public.class_groups (
  id uuid primary key default gen_random_uuid(),
  course_run_id uuid not null references public.course_runs(id) on delete restrict,
  code text not null,
  name text not null,
  capacity integer not null check (capacity > 0),
  status text not null default 'active'
    check (status in ('active', 'paused', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_run_id, code),
  unique (id, course_run_id)
);

create table public.teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  class_group_id uuid not null references public.class_groups(id) on delete restrict,
  teacher_profile_id uuid not null references public.staff_profiles(id) on delete restrict,
  assignment_type text not null default 'primary'
    check (assignment_type in ('primary', 'substitute', 'assistant')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  status text not null default 'active'
    check (status in ('active', 'ended', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at),
  check (status = 'active' or ends_at is not null),
  exclude using gist (
    class_group_id with =,
    teacher_profile_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status = 'active')
);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_profile_id uuid not null references public.student_profiles(id) on delete restrict,
  course_run_id uuid not null references public.course_runs(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'paused', 'completed', 'cancelled')),
  source text not null default 'nile_learn'
    check (source in ('nile_learn', 'legacy_ems')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at),
  check (
    (status in ('pending', 'active', 'paused') and ends_at is null)
    or (status in ('completed', 'cancelled') and ends_at is not null)
  ),
  unique (id, course_run_id),
  exclude using gist (
    student_profile_id with =,
    course_run_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('pending', 'active', 'paused'))
);

create table public.class_memberships (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null,
  course_run_id uuid not null,
  class_group_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  status text not null default 'active'
    check (status in ('active', 'paused', 'ended', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (enrollment_id, course_run_id)
    references public.enrollments(id, course_run_id) on delete restrict,
  foreign key (class_group_id, course_run_id)
    references public.class_groups(id, course_run_id) on delete restrict,
  check (ends_at is null or ends_at > starts_at),
  check (
    (status in ('active', 'paused') and ends_at is null)
    or (status in ('ended', 'cancelled') and ends_at is not null)
  ),
  exclude using gist (
    enrollment_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('active', 'paused'))
);

create index programs_department_id_idx on public.programs (department_id);
create index course_levels_program_id_idx on public.course_levels (program_id);
create index course_templates_program_id_idx on public.course_templates (program_id);
create index course_templates_level_id_idx on public.course_templates (level_id);
create index student_profiles_home_branch_id_idx on public.student_profiles (home_branch_id);
create index course_runs_course_template_id_idx on public.course_runs (course_template_id);
create index course_runs_branch_id_idx on public.course_runs (branch_id);
create index class_groups_course_run_id_idx on public.class_groups (course_run_id);
create index teacher_assignments_class_group_id_idx on public.teacher_assignments (class_group_id);
create index teacher_assignments_teacher_profile_id_idx on public.teacher_assignments (teacher_profile_id);
create index enrollments_student_profile_id_idx on public.enrollments (student_profile_id);
create index enrollments_course_run_id_idx on public.enrollments (course_run_id);
create index class_memberships_enrollment_id_idx on public.class_memberships (enrollment_id);
create index class_memberships_course_run_id_idx on public.class_memberships (course_run_id);
create index class_memberships_class_group_id_idx on public.class_memberships (class_group_id);

create function public.resolve_moodle_course_projection_authority(
  p_user_id uuid,
  p_active_role_grant_id uuid
)
returns table (
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
  resolved_role text;
  resolved_student_profile_id uuid;
  resolved_staff_profile_id uuid;
begin
  select role_grant.role
  into resolved_role
  from public.app_users as app_user
  join public.role_grants as role_grant
    on role_grant.user_id = app_user.id
  where app_user.id = p_user_id
    and app_user.status = 'active'
    and role_grant.id = p_active_role_grant_id
    and role_grant.status = 'active'
    and role_grant.starts_at <= pg_catalog.now()
    and (role_grant.ends_at is null or role_grant.ends_at > pg_catalog.now());

  if resolved_role is null
    or resolved_role not in ('student', 'teacher', 'headofdepartment', 'superadmin') then
    raise exception 'Moodle course projection authority is not active'
      using errcode = '42501';
  end if;

  if resolved_role = 'student' then
    select profile.id
    into resolved_student_profile_id
    from public.student_profiles as profile
    where profile.user_id = p_user_id
      and profile.status = 'active';

    if resolved_student_profile_id is null then
      raise exception 'Active student profile is required'
        using errcode = '42501';
    end if;

    return query
    select
      resolved_role,
      coalesce(
        pg_catalog.array_agg(authority.internal_course_id order by authority.internal_course_id),
        '{}'::uuid[]
      ),
      pg_catalog.now()
    from (
      select distinct course_run.course_template_id as internal_course_id
      from public.enrollments as enrollment
      join public.course_runs as course_run on course_run.id = enrollment.course_run_id
      join public.course_templates as course_template on course_template.id = course_run.course_template_id
      where enrollment.student_profile_id = resolved_student_profile_id
        and enrollment.status in ('active', 'completed')
        and course_run.status in ('active', 'completed')
        and course_template.status = 'active'
    ) as authority;
    return;
  end if;

  select profile.id
  into resolved_staff_profile_id
  from public.staff_profiles as profile
  where profile.user_id = p_user_id
    and profile.status = 'active';

  if resolved_staff_profile_id is null then
    raise exception 'Active staff profile is required'
      using errcode = '42501';
  end if;

  if resolved_role = 'teacher' then
    return query
    select
      resolved_role,
      coalesce(
        pg_catalog.array_agg(authority.internal_course_id order by authority.internal_course_id),
        '{}'::uuid[]
      ),
      pg_catalog.now()
    from (
      select distinct course_run.course_template_id as internal_course_id
      from public.teacher_assignments as assignment
      join public.class_groups as class_group on class_group.id = assignment.class_group_id
      join public.course_runs as course_run on course_run.id = class_group.course_run_id
      join public.course_templates as course_template on course_template.id = course_run.course_template_id
      where assignment.teacher_profile_id = resolved_staff_profile_id
        and assignment.status = 'active'
        and assignment.starts_at <= pg_catalog.now()
        and (assignment.ends_at is null or assignment.ends_at > pg_catalog.now())
        and class_group.status = 'active'
        and course_run.status = 'active'
        and course_template.status = 'active'
    ) as authority;
    return;
  end if;

  if resolved_role = 'headofdepartment' then
    return query
    select
      resolved_role,
      coalesce(
        pg_catalog.array_agg(authority.internal_course_id order by authority.internal_course_id),
        '{}'::uuid[]
      ),
      pg_catalog.now()
    from (
      select distinct course_template.id as internal_course_id
      from public.role_grant_department_scopes as scope
      join public.programs as program on program.department_id = scope.department_id
      join public.course_templates as course_template on course_template.program_id = program.id
      where scope.role_grant_id = p_active_role_grant_id
        and scope.starts_at <= pg_catalog.now()
        and (scope.ends_at is null or scope.ends_at > pg_catalog.now())
        and program.status = 'active'
        and course_template.status = 'active'
    ) as authority;
    return;
  end if;

  return query
  select
    resolved_role,
    coalesce(
      pg_catalog.array_agg(course_template.id order by course_template.id),
      '{}'::uuid[]
    ),
    pg_catalog.now()
  from public.course_templates as course_template
  where course_template.status = 'active';
end;
$$;

create function public.list_moodle_course_mappings(
  p_internal_course_ids uuid[] default null
)
returns table (
  internal_course_id uuid,
  external_course_id text,
  sync_state text,
  last_seen_at timestamptz,
  last_synced_at timestamptz,
  source_updated_at timestamptz,
  last_error text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    external_record.internal_id,
    external_record.external_id,
    external_record.sync_state,
    external_record.last_seen_at,
    external_record.last_synced_at,
    external_record.source_updated_at,
    external_record.last_error
  from public.integration_connections as connection
  join public.external_records as external_record
    on external_record.connection_id = connection.id
  join public.course_templates as course_template
    on course_template.id = external_record.internal_id
  where connection.provider = 'moodle'
    and external_record.entity_type = 'course'
    and external_record.sync_state <> 'ignored'
    and (
      p_internal_course_ids is null
      or external_record.internal_id = any (p_internal_course_ids)
    )
  order by external_record.internal_id, connection.id;
$$;

revoke all on function public.resolve_moodle_course_projection_authority(uuid, uuid)
from public, anon, authenticated;
revoke all on function public.list_moodle_course_mappings(uuid[])
from public, anon, authenticated;

grant execute on function public.resolve_moodle_course_projection_authority(uuid, uuid)
to service_role;
grant execute on function public.list_moodle_course_mappings(uuid[])
to service_role;

create trigger programs_set_updated_at
before update on public.programs
for each row execute function nile_private.set_updated_at();
create trigger course_levels_set_updated_at
before update on public.course_levels
for each row execute function nile_private.set_updated_at();
create trigger course_templates_set_updated_at
before update on public.course_templates
for each row execute function nile_private.set_updated_at();
create trigger student_profiles_set_updated_at
before update on public.student_profiles
for each row execute function nile_private.set_updated_at();
create trigger course_runs_set_updated_at
before update on public.course_runs
for each row execute function nile_private.set_updated_at();
create trigger class_groups_set_updated_at
before update on public.class_groups
for each row execute function nile_private.set_updated_at();
create trigger teacher_assignments_set_updated_at
before update on public.teacher_assignments
for each row execute function nile_private.set_updated_at();
create trigger enrollments_set_updated_at
before update on public.enrollments
for each row execute function nile_private.set_updated_at();
create trigger class_memberships_set_updated_at
before update on public.class_memberships
for each row execute function nile_private.set_updated_at();

alter table public.programs enable row level security;
alter table public.programs force row level security;
alter table public.course_levels enable row level security;
alter table public.course_levels force row level security;
alter table public.course_templates enable row level security;
alter table public.course_templates force row level security;
alter table public.student_profiles enable row level security;
alter table public.student_profiles force row level security;
alter table public.course_runs enable row level security;
alter table public.course_runs force row level security;
alter table public.class_groups enable row level security;
alter table public.class_groups force row level security;
alter table public.teacher_assignments enable row level security;
alter table public.teacher_assignments force row level security;
alter table public.enrollments enable row level security;
alter table public.enrollments force row level security;
alter table public.class_memberships enable row level security;
alter table public.class_memberships force row level security;

revoke all on table
  public.programs,
  public.course_levels,
  public.course_templates,
  public.student_profiles,
  public.course_runs,
  public.class_groups,
  public.teacher_assignments,
  public.enrollments,
  public.class_memberships
from public, anon, authenticated;

grant select, insert, update, delete on table
  public.programs,
  public.course_levels,
  public.course_templates,
  public.student_profiles,
  public.course_runs,
  public.class_groups,
  public.teacher_assignments,
  public.enrollments,
  public.class_memberships
to service_role;

commit;
