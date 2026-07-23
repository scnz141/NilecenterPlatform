-- Nile Learn normalized teacher class-session and attendance authority.
-- Manual-only. Requires the normalized foundation through package 024.
-- Browser roles receive no direct table or RPC access.

begin;

do $$
declare
  dependency text;
begin
  foreach dependency in array array[
    'app_users', 'branches', 'role_grants', 'role_grant_branch_scopes',
    'auth_sessions', 'command_executions', 'audit_logs', 'outbox_events',
    'staff_profiles', 'student_profiles', 'course_runs', 'class_groups',
    'teacher_assignments', 'enrollments', 'class_memberships'
  ] loop
    if pg_catalog.to_regclass('public.' || dependency) is null then
      raise exception 'Teacher attendance authority requires public.%', dependency;
    end if;
  end loop;
end;
$$;

create table if not exists public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  class_group_id uuid not null references public.class_groups(id) on delete restrict,
  event_type text not null
    check (event_type in ('class_session', 'live_session')),
  title text not null check (length(pg_catalog.btrim(title)) between 2 and 180),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'active'
    check (status in ('planned', 'active', 'completed', 'cancelled')),
  version integer not null default 1 check (version > 0),
  created_by uuid not null references public.app_users(id) on delete restrict,
  attendance_saved_at timestamptz,
  attendance_saved_by uuid references public.app_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (ends_at <= starts_at + interval '24 hours'),
  check (
    (attendance_saved_at is null and attendance_saved_by is null)
    or (attendance_saved_at is not null and attendance_saved_by is not null)
  )
);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  class_session_id uuid not null references public.class_sessions(id) on delete restrict,
  class_group_id uuid not null references public.class_groups(id) on delete restrict,
  student_profile_id uuid not null references public.student_profiles(id) on delete restrict,
  status text not null check (status in ('present', 'late', 'absent', 'excused')),
  notes text check (notes is null or length(notes) <= 500),
  version integer not null default 1 check (version > 0),
  marked_by uuid not null references public.app_users(id) on delete restrict,
  marked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_session_id, student_profile_id)
);

create index if not exists class_sessions_class_group_starts_idx
  on public.class_sessions (class_group_id, starts_at);
create index if not exists attendance_records_group_session_idx
  on public.attendance_records (class_group_id, class_session_id);
create index if not exists attendance_records_student_idx
  on public.attendance_records (student_profile_id, marked_at desc);

alter table public.class_sessions enable row level security;
alter table public.class_sessions force row level security;
alter table public.attendance_records enable row level security;
alter table public.attendance_records force row level security;

revoke all on table public.class_sessions from public, anon, authenticated;
revoke all on table public.attendance_records from public, anon, authenticated;
grant select, insert, update on table public.class_sessions to service_role;
grant select, insert, update on table public.attendance_records to service_role;

create or replace function public.nile_create_teacher_class_session_with_evidence(
  p_session_token_hash text,
  p_class_group_id uuid,
  p_event_type text,
  p_title text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_idempotency_key text,
  p_request_hash text
)
returns table (
  command_id uuid,
  class_session_id uuid,
  session_version integer,
  outbox_event_id uuid,
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
  teacher_profile public.staff_profiles%rowtype;
  group_row public.class_groups%rowtype;
  run_row public.course_runs%rowtype;
  command_row public.command_executions%rowtype;
  created_command_id uuid := gen_random_uuid();
  created_session_id uuid := gen_random_uuid();
  created_outbox_id uuid := gen_random_uuid();
begin
  if p_session_token_hash !~ '^[a-f0-9]{64}$'
    or p_request_hash !~ '^[a-f0-9]{64}$'
    or length(p_idempotency_key) not between 12 and 256
    or p_event_type not in ('class_session', 'live_session')
    or length(pg_catalog.btrim(coalesce(p_title, ''))) not between 2 and 180
    or p_ends_at <= p_starts_at
    or p_ends_at > p_starts_at + interval '24 hours' then
    raise exception 'Class session request is invalid' using errcode = '22023';
  end if;

  select item.* into strict actor_session
  from public.auth_sessions as item
  where item.token_hash = pg_catalog.decode(p_session_token_hash, 'hex')
    and item.provider = 'supabase'
    and item.revoked_at is null
    and item.expires_at > now()
  for update;
  select item.* into strict actor_user
  from public.app_users as item
  where item.id = actor_session.user_id and item.status = 'active';
  select item.* into strict actor_grant
  from public.role_grants as item
  where item.id = actor_session.active_role_grant_id
    and item.user_id = actor_user.id
    and item.role = 'teacher'
    and item.status = 'active'
    and item.starts_at <= now()
    and (item.ends_at is null or item.ends_at > now());
  select item.* into strict teacher_profile
  from public.staff_profiles as item
  where item.user_id = actor_user.id and item.status = 'active';

  select item.* into command_row
  from public.command_executions as item
  where item.idempotency_key = p_idempotency_key;
  if found then
    if command_row.request_hash is distinct from pg_catalog.decode(p_request_hash, 'hex')
      or command_row.command_type <> 'class.session.create'
      or command_row.actor_user_id <> actor_user.id
      or command_row.status <> 'succeeded' then
      raise exception 'Class session idempotency conflict' using errcode = '23505';
    end if;
    return query
      select command_row.id, item.id, item.version,
        outbox.id, true
      from public.class_sessions as item
      left join public.outbox_events as outbox
        on outbox.command_id = command_row.id
        and outbox.event_type = 'class.session.created'
      where item.id::text = command_row.target_id;
    return;
  end if;

  select item.* into strict group_row
  from public.class_groups as item
  where item.id = p_class_group_id and item.status = 'active';
  select item.* into strict run_row
  from public.course_runs as item
  where item.id = group_row.course_run_id
    and item.status in ('planned', 'active');
  if not exists (
    select 1
    from public.teacher_assignments as assignment
    where assignment.class_group_id = group_row.id
      and assignment.teacher_profile_id = teacher_profile.id
      and assignment.status = 'active'
      and assignment.starts_at <= p_starts_at
      and (assignment.ends_at is null or assignment.ends_at >= p_ends_at)
  ) then
    raise exception 'Teacher is not assigned to this class session'
      using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.role_grant_branch_scopes as scope
    where scope.role_grant_id = actor_grant.id
      and scope.branch_id = run_row.branch_id
      and scope.starts_at <= p_starts_at
      and (scope.ends_at is null or scope.ends_at >= p_ends_at)
  ) then
    raise exception 'Class session branch is outside the teacher scope'
      using errcode = '42501';
  end if;
  if exists (
    select 1
    from public.class_sessions as existing
    join public.teacher_assignments as assignment
      on assignment.class_group_id = existing.class_group_id
    where assignment.teacher_profile_id = teacher_profile.id
      and assignment.status = 'active'
      and existing.status <> 'cancelled'
      and pg_catalog.tstzrange(existing.starts_at, existing.ends_at, '[)')
        && pg_catalog.tstzrange(p_starts_at, p_ends_at, '[)')
  ) then
    raise exception 'Teacher already has an overlapping class session'
      using errcode = '40001';
  end if;

  insert into public.command_executions (
    id, idempotency_key, actor_user_id, actor_role_grant_id, session_id,
    command_type, target_type, target_id, request_hash, requires_outbox
  ) values (
    created_command_id, p_idempotency_key, actor_user.id, actor_grant.id,
    actor_session.id, 'class.session.create', 'ClassSession',
    created_session_id::text, pg_catalog.decode(p_request_hash, 'hex'), true
  );
  insert into public.class_sessions (
    id, class_group_id, event_type, title, starts_at, ends_at, status, created_by
  ) values (
    created_session_id, group_row.id, p_event_type, pg_catalog.btrim(p_title),
    p_starts_at, p_ends_at, 'active', actor_user.id
  );
  insert into public.audit_logs (
    command_id, actor_user_id, actor_role_grant_id, session_id,
    action, entity_type, entity_id, branch_id, after_state, metadata
  ) values (
    created_command_id, actor_user.id, actor_grant.id, actor_session.id,
    'class.session.created', 'ClassSession', created_session_id::text,
    run_row.branch_id,
    pg_catalog.jsonb_build_object(
      'classGroupId', group_row.id, 'eventType', p_event_type,
      'startsAt', p_starts_at, 'endsAt', p_ends_at, 'version', 1
    ),
    pg_catalog.jsonb_build_object(
      'summary', 'Created ' || pg_catalog.btrim(p_title) || '.',
      'courseRunId', run_row.id
    )
  );
  insert into public.outbox_events (
    id, command_id, event_type, aggregate_type, aggregate_id, payload,
    idempotency_key
  ) values (
    created_outbox_id, created_command_id, 'class.session.created',
    'ClassSession', created_session_id::text,
    pg_catalog.jsonb_build_object(
      'schemaVersion', 1, 'classSessionId', created_session_id,
      'classGroupId', group_row.id, 'courseRunId', run_row.id
    ),
    'class.session.created:' || created_session_id::text
  );
  update public.command_executions
  set status = 'succeeded', completed_at = now()
  where id = created_command_id;

  return query select created_command_id, created_session_id, 1,
    created_outbox_id, false;
exception
  when no_data_found then
    raise exception 'Teacher class-session authority is unavailable'
      using errcode = '42501';
end;
$$;

create or replace function public.nile_save_teacher_attendance_with_evidence(
  p_session_token_hash text,
  p_class_group_id uuid,
  p_class_session_id uuid,
  p_statuses jsonb,
  p_notes jsonb,
  p_expected_version integer,
  p_idempotency_key text,
  p_request_hash text
)
returns table (
  command_id uuid,
  class_session_id uuid,
  session_version integer,
  attendance_count integer,
  outbox_event_id uuid,
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
  teacher_profile public.staff_profiles%rowtype;
  class_session public.class_sessions%rowtype;
  group_row public.class_groups%rowtype;
  run_row public.course_runs%rowtype;
  command_row public.command_executions%rowtype;
  roster_count integer;
  supplied_count integer;
  created_command_id uuid := gen_random_uuid();
  created_outbox_id uuid := gen_random_uuid();
  student_row record;
  status_value text;
  note_value text;
begin
  if p_session_token_hash !~ '^[a-f0-9]{64}$'
    or p_request_hash !~ '^[a-f0-9]{64}$'
    or length(p_idempotency_key) not between 12 and 256
    or p_expected_version < 1
    or pg_catalog.jsonb_typeof(p_statuses) <> 'object'
    or pg_catalog.jsonb_typeof(coalesce(p_notes, '{}'::jsonb)) <> 'object' then
    raise exception 'Attendance request is invalid' using errcode = '22023';
  end if;

  select item.* into strict actor_session
  from public.auth_sessions as item
  where item.token_hash = pg_catalog.decode(p_session_token_hash, 'hex')
    and item.provider = 'supabase'
    and item.revoked_at is null
    and item.expires_at > now()
  for update;
  select item.* into strict actor_user
  from public.app_users as item
  where item.id = actor_session.user_id and item.status = 'active';
  select item.* into strict actor_grant
  from public.role_grants as item
  where item.id = actor_session.active_role_grant_id
    and item.user_id = actor_user.id
    and item.role = 'teacher'
    and item.status = 'active'
    and item.starts_at <= now()
    and (item.ends_at is null or item.ends_at > now());
  select item.* into strict teacher_profile
  from public.staff_profiles as item
  where item.user_id = actor_user.id and item.status = 'active';

  select item.* into command_row
  from public.command_executions as item
  where item.idempotency_key = p_idempotency_key;
  if found then
    if command_row.request_hash is distinct from pg_catalog.decode(p_request_hash, 'hex')
      or command_row.command_type <> 'attendance.save'
      or command_row.actor_user_id <> actor_user.id
      or command_row.status <> 'succeeded' then
      raise exception 'Attendance idempotency conflict' using errcode = '23505';
    end if;
    return query
      select command_row.id, item.id, item.version,
        (select count(*)::integer from public.attendance_records as record
          where record.class_session_id = item.id),
        outbox.id, true
      from public.class_sessions as item
      left join public.outbox_events as outbox
        on outbox.command_id = command_row.id
        and outbox.event_type = 'attendance.saved'
      where item.id::text = command_row.target_id;
    return;
  end if;

  select item.* into strict class_session
  from public.class_sessions as item
  where item.id = p_class_session_id
    and item.class_group_id = p_class_group_id
    and item.status in ('active', 'completed')
  for update;
  if class_session.version <> p_expected_version then
    raise exception 'Attendance session changed before save'
      using errcode = '40001';
  end if;
  select item.* into strict group_row
  from public.class_groups as item
  where item.id = class_session.class_group_id and item.status = 'active';
  select item.* into strict run_row
  from public.course_runs as item
  where item.id = group_row.course_run_id
    and item.status in ('planned', 'active');
  if not exists (
    select 1
    from public.teacher_assignments as assignment
    where assignment.class_group_id = group_row.id
      and assignment.teacher_profile_id = teacher_profile.id
      and assignment.status = 'active'
      and assignment.starts_at <= class_session.starts_at
      and (assignment.ends_at is null or assignment.ends_at >= class_session.ends_at)
  ) then
    raise exception 'Teacher is not assigned to this attendance session'
      using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.role_grant_branch_scopes as scope
    where scope.role_grant_id = actor_grant.id
      and scope.branch_id = run_row.branch_id
      and scope.starts_at <= class_session.starts_at
      and (scope.ends_at is null or scope.ends_at >= class_session.ends_at)
  ) then
    raise exception 'Attendance class is outside the teacher branch scope'
      using errcode = '42501';
  end if;

  select count(*)::integer into roster_count
  from public.class_memberships as membership
  join public.enrollments as enrollment on enrollment.id = membership.enrollment_id
  join public.student_profiles as profile on profile.id = enrollment.student_profile_id
  join public.app_users as app_user on app_user.id = profile.user_id
  where membership.class_group_id = group_row.id
    and membership.status = 'active'
    and enrollment.status = 'active'
    and profile.status = 'active'
    and app_user.status = 'active';
  select count(*)::integer into supplied_count
  from jsonb_object_keys(p_statuses);
  if roster_count = 0 or supplied_count <> roster_count then
    raise exception 'Attendance must include the complete active class roster'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_each_text(p_statuses) as supplied(student_id, status)
    where supplied.status not in ('present', 'late', 'absent', 'excused')
      or supplied.student_id !~ '^[0-9a-fA-F-]{36}$'
      or not exists (
        select 1
        from public.class_memberships as membership
        join public.enrollments as enrollment on enrollment.id = membership.enrollment_id
        join public.student_profiles as profile on profile.id = enrollment.student_profile_id
        join public.app_users as app_user on app_user.id = profile.user_id
        where membership.class_group_id = group_row.id
          and membership.status = 'active'
          and enrollment.status = 'active'
          and profile.status = 'active'
          and app_user.status = 'active'
          and profile.id::text = supplied.student_id
      )
  ) then
    raise exception 'Attendance contains an invalid learner or status'
      using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_each_text(coalesce(p_notes, '{}'::jsonb))
      as supplied(student_id, note)
    where length(supplied.note) > 500
      or not (p_statuses ? supplied.student_id)
  ) then
    raise exception 'Attendance notes are invalid' using errcode = '22023';
  end if;

  insert into public.command_executions (
    id, idempotency_key, actor_user_id, actor_role_grant_id, session_id,
    command_type, target_type, target_id, request_hash, requires_outbox
  ) values (
    created_command_id, p_idempotency_key, actor_user.id, actor_grant.id,
    actor_session.id, 'attendance.save', 'ClassSession',
    class_session.id::text, pg_catalog.decode(p_request_hash, 'hex'), true
  );

  for student_row in
    select profile.id as student_profile_id
    from public.class_memberships as membership
    join public.enrollments as enrollment on enrollment.id = membership.enrollment_id
    join public.student_profiles as profile on profile.id = enrollment.student_profile_id
    join public.app_users as app_user on app_user.id = profile.user_id
    where membership.class_group_id = group_row.id
      and membership.status = 'active'
      and enrollment.status = 'active'
      and profile.status = 'active'
      and app_user.status = 'active'
  loop
    status_value := p_statuses ->> student_row.student_profile_id::text;
    note_value := nullif(pg_catalog.btrim(
      coalesce(p_notes ->> student_row.student_profile_id::text, '')
    ), '');
    insert into public.attendance_records as existing (
      class_session_id, class_group_id, student_profile_id, status, notes,
      marked_by
    ) values (
      class_session.id, group_row.id, student_row.student_profile_id,
      status_value, note_value, actor_user.id
    )
    on conflict on constraint attendance_records_class_session_id_student_profile_id_key do update
      set status = excluded.status,
          notes = excluded.notes,
          version = existing.version + 1,
          marked_by = excluded.marked_by,
          marked_at = now(),
          updated_at = now();
  end loop;

  update public.class_sessions
  set attendance_saved_at = now(), attendance_saved_by = actor_user.id,
      version = version + 1, updated_at = now()
  where id = class_session.id
  returning * into class_session;
  insert into public.audit_logs (
    command_id, actor_user_id, actor_role_grant_id, session_id,
    action, entity_type, entity_id, branch_id, before_state, after_state,
    metadata
  ) values (
    created_command_id, actor_user.id, actor_grant.id, actor_session.id,
    'attendance.saved', 'AttendanceRecord', group_row.id::text,
    run_row.branch_id,
    pg_catalog.jsonb_build_object('sessionVersion', p_expected_version),
    pg_catalog.jsonb_build_object(
      'sessionVersion', class_session.version,
      'attendanceCount', roster_count
    ),
    pg_catalog.jsonb_build_object(
      'summary', 'Saved attendance for ' || roster_count || ' learner(s).',
      'classSessionId', class_session.id, 'courseRunId', run_row.id
    )
  );
  insert into public.outbox_events (
    id, command_id, event_type, aggregate_type, aggregate_id, payload,
    idempotency_key
  ) values (
    created_outbox_id, created_command_id, 'attendance.saved',
    'ClassSession', class_session.id::text,
    pg_catalog.jsonb_build_object(
      'schemaVersion', 1, 'classSessionId', class_session.id,
      'classGroupId', group_row.id, 'attendanceCount', roster_count,
      'sessionVersion', class_session.version
    ),
    'attendance.saved:' || created_command_id::text
  );
  update public.command_executions
  set status = 'succeeded', completed_at = now()
  where id = created_command_id;

  return query select created_command_id, class_session.id,
    class_session.version, roster_count, created_outbox_id, false;
exception
  when no_data_found then
    raise exception 'Teacher attendance authority is unavailable'
      using errcode = '42501';
end;
$$;

create or replace function public.nile_read_teacher_attendance_workspace(
  p_session_token_hash text
)
returns table (workspace jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_session public.auth_sessions%rowtype;
  actor_grant public.role_grants%rowtype;
  teacher_profile public.staff_profiles%rowtype;
begin
  if p_session_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Session token hash is invalid' using errcode = '22023';
  end if;
  select item.* into strict actor_session
  from public.auth_sessions as item
  where item.token_hash = pg_catalog.decode(p_session_token_hash, 'hex')
    and item.provider = 'supabase'
    and item.revoked_at is null
    and item.expires_at > now();
  select item.* into strict actor_grant
  from public.role_grants as item
  where item.id = actor_session.active_role_grant_id
    and item.user_id = actor_session.user_id
    and item.role = 'teacher'
    and item.status = 'active'
    and item.starts_at <= now()
    and (item.ends_at is null or item.ends_at > now());
  select item.* into strict teacher_profile
  from public.staff_profiles as item
  where item.user_id = actor_session.user_id and item.status = 'active';

  return query select pg_catalog.jsonb_build_object(
    'sessions', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', session.id, 'classGroupId', session.class_group_id,
        'eventType', session.event_type, 'title', session.title,
        'startsAt', session.starts_at, 'endsAt', session.ends_at,
        'status', session.status, 'attendanceSaved',
          session.attendance_saved_at is not null,
        'attendanceVersion', session.version,
        'attendanceSavedAt', session.attendance_saved_at,
        'createdBy', session.created_by, 'branchId', run.branch_id
      ) order by session.starts_at)
      from public.class_sessions as session
      join public.class_groups as class_group on class_group.id = session.class_group_id
      join public.course_runs as run on run.id = class_group.course_run_id
      where exists (
        select 1 from public.teacher_assignments as assignment
        where assignment.class_group_id = session.class_group_id
          and assignment.teacher_profile_id = teacher_profile.id
          and assignment.status = 'active'
          and assignment.starts_at <= session.starts_at
          and (assignment.ends_at is null or assignment.ends_at >= session.ends_at)
      )
    ), '[]'::jsonb),
    'attendance', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', record.id, 'classGroupId', record.class_group_id,
        'studentId', record.student_profile_id,
        'sessionId', record.class_session_id, 'status', record.status,
        'notes', record.notes, 'version', record.version,
        'markedBy', record.marked_by, 'markedAt', record.marked_at
      ) order by record.marked_at desc)
      from public.attendance_records as record
      join public.class_sessions as session on session.id = record.class_session_id
      where exists (
        select 1 from public.teacher_assignments as assignment
        where assignment.class_group_id = session.class_group_id
          and assignment.teacher_profile_id = teacher_profile.id
          and assignment.status = 'active'
          and assignment.starts_at <= session.starts_at
          and (assignment.ends_at is null or assignment.ends_at >= session.ends_at)
      )
    ), '[]'::jsonb)
  );
exception
  when no_data_found then
    raise exception 'Teacher attendance workspace is unavailable'
      using errcode = '42501';
end;
$$;

create or replace function public.nile_read_student_attendance_workspace(
  p_session_token_hash text
)
returns table (workspace jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_session public.auth_sessions%rowtype;
  actor_grant public.role_grants%rowtype;
  student_profile public.student_profiles%rowtype;
begin
  if p_session_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Session token hash is invalid' using errcode = '22023';
  end if;
  select item.* into strict actor_session
  from public.auth_sessions as item
  where item.token_hash = pg_catalog.decode(p_session_token_hash, 'hex')
    and item.provider = 'supabase'
    and item.revoked_at is null
    and item.expires_at > now();
  select item.* into strict actor_grant
  from public.role_grants as item
  where item.id = actor_session.active_role_grant_id
    and item.user_id = actor_session.user_id
    and item.role = 'student'
    and item.status = 'active'
    and item.starts_at <= now()
    and (item.ends_at is null or item.ends_at > now());
  select item.* into strict student_profile
  from public.student_profiles as item
  where item.user_id = actor_session.user_id and item.status = 'active';

  return query select pg_catalog.jsonb_build_object(
    'sessions', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', session.id, 'classGroupId', session.class_group_id,
        'eventType', session.event_type, 'title', session.title,
        'startsAt', session.starts_at, 'endsAt', session.ends_at,
        'status', session.status, 'attendanceSaved',
          session.attendance_saved_at is not null,
        'attendanceVersion', session.version,
        'attendanceSavedAt', session.attendance_saved_at,
        'createdBy', session.created_by, 'branchId', run.branch_id
      ) order by session.starts_at)
      from public.class_sessions as session
      join public.class_groups as class_group on class_group.id = session.class_group_id
      join public.course_runs as run on run.id = class_group.course_run_id
      where exists (
        select 1
        from public.class_memberships as membership
        join public.enrollments as enrollment on enrollment.id = membership.enrollment_id
        where enrollment.student_profile_id = student_profile.id
          and enrollment.status in ('active', 'paused')
          and membership.class_group_id = session.class_group_id
          and membership.status in ('active', 'paused')
      )
    ), '[]'::jsonb),
    'attendance', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', record.id, 'classGroupId', record.class_group_id,
        'studentId', record.student_profile_id,
        'sessionId', record.class_session_id, 'status', record.status,
        'notes', record.notes, 'version', record.version,
        'markedBy', record.marked_by, 'markedAt', record.marked_at
      ) order by record.marked_at desc)
      from public.attendance_records as record
      where record.student_profile_id = student_profile.id
    ), '[]'::jsonb)
  );
exception
  when no_data_found then
    raise exception 'Student attendance workspace is unavailable'
      using errcode = '42501';
end;
$$;

revoke all on function public.nile_create_teacher_class_session_with_evidence(
  text, uuid, text, text, timestamptz, timestamptz, text, text
) from public, anon, authenticated;
revoke all on function public.nile_save_teacher_attendance_with_evidence(
  text, uuid, uuid, jsonb, jsonb, integer, text, text
) from public, anon, authenticated;
revoke all on function public.nile_read_teacher_attendance_workspace(text)
  from public, anon, authenticated;
revoke all on function public.nile_read_student_attendance_workspace(text)
  from public, anon, authenticated;

grant execute on function public.nile_create_teacher_class_session_with_evidence(
  text, uuid, text, text, timestamptz, timestamptz, text, text
) to service_role;
grant execute on function public.nile_save_teacher_attendance_with_evidence(
  text, uuid, uuid, jsonb, jsonb, integer, text, text
) to service_role;
grant execute on function public.nile_read_teacher_attendance_workspace(text)
  to service_role;
grant execute on function public.nile_read_student_attendance_workspace(text)
  to service_role;

commit;
