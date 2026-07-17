-- Nile Learn Phase 6A schema, authority RPC, and mapping RPC assertions.
-- Run after the Phase 1 fixture and the Phase 6A fake fixture on a disposable
-- PostgreSQL database. This script is read-only outside its rolled-back test
-- transaction.

begin;

do $$
declare
  required_tables text[] := array[
    'programs',
    'course_levels',
    'course_templates',
    'student_profiles',
    'course_runs',
    'class_groups',
    'teacher_assignments',
    'enrollments',
    'class_memberships'
  ];
  missing_tables text[];
  rls_missing text[];
  rls_not_forced text[];
  unexpected_policies text[];
  table_name text;
begin
  select pg_catalog.array_agg(required_table)
  into missing_tables
  from pg_catalog.unnest(required_tables) as required_table
  where pg_catalog.to_regclass('public.' || required_table) is null;

  if missing_tables is not null then
    raise exception 'Missing Phase 6A tables: %', missing_tables;
  end if;

  select pg_catalog.array_agg(class.relname)
  into rls_missing
  from pg_catalog.pg_class as class
  join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
  where namespace.nspname = 'public'
    and class.relname = any (required_tables)
    and not class.relrowsecurity;

  if rls_missing is not null then
    raise exception 'RLS is not enabled on Phase 6A tables: %', rls_missing;
  end if;

  select pg_catalog.array_agg(class.relname)
  into rls_not_forced
  from pg_catalog.pg_class as class
  join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
  where namespace.nspname = 'public'
    and class.relname = any (required_tables)
    and not class.relforcerowsecurity;

  if rls_not_forced is not null then
    raise exception 'RLS is not forced on Phase 6A tables: %', rls_not_forced;
  end if;

  select pg_catalog.array_agg(policy.tablename || '.' || policy.policyname)
  into unexpected_policies
  from pg_catalog.pg_policies as policy
  where policy.schemaname = 'public'
    and policy.tablename = any (required_tables);

  if unexpected_policies is not null then
    raise exception 'Phase 6A server-only tables have policies: %', unexpected_policies;
  end if;

  foreach table_name in array required_tables loop
    if pg_catalog.has_table_privilege('anon', 'public.' || table_name, 'SELECT')
      or pg_catalog.has_table_privilege('authenticated', 'public.' || table_name, 'SELECT')
      or pg_catalog.has_table_privilege('anon', 'public.' || table_name, 'INSERT')
      or pg_catalog.has_table_privilege('authenticated', 'public.' || table_name, 'INSERT') then
      raise exception 'Browser role has direct privilege on public.%', table_name;
    end if;

    if not pg_catalog.has_table_privilege('service_role', 'public.' || table_name, 'SELECT,INSERT,UPDATE,DELETE') then
      raise exception 'service_role privilege is incomplete on public.%', table_name;
    end if;
  end loop;
end;
$$;

do $$
begin
  if pg_catalog.has_function_privilege(
    'anon',
    'public.resolve_moodle_course_projection_authority(uuid,uuid)',
    'EXECUTE'
  ) or pg_catalog.has_function_privilege(
    'authenticated',
    'public.resolve_moodle_course_projection_authority(uuid,uuid)',
    'EXECUTE'
  ) or pg_catalog.has_function_privilege(
    'anon',
    'public.list_moodle_course_mappings(uuid[])',
    'EXECUTE'
  ) or pg_catalog.has_function_privilege(
    'authenticated',
    'public.list_moodle_course_mappings(uuid[])',
    'EXECUTE'
  ) then
    raise exception 'Browser roles can execute a Phase 6A RPC';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
    cross join lateral pg_catalog.aclexplode(
      coalesce(
        procedure.proacl,
        pg_catalog.acldefault('f', procedure.proowner)
      )
    ) as privilege
    where namespace.nspname = 'public'
      and procedure.proname = any(array[
        'resolve_moodle_course_projection_authority',
        'list_moodle_course_mappings'
      ])
      and privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  ) then
    raise exception 'PUBLIC can execute a Phase 6A RPC';
  end if;

  if not pg_catalog.has_function_privilege(
    'service_role',
    'public.resolve_moodle_course_projection_authority(uuid,uuid)',
    'EXECUTE'
  ) or not pg_catalog.has_function_privilege(
    'service_role',
    'public.list_moodle_course_mappings(uuid[])',
    'EXECUTE'
  ) then
    raise exception 'service_role Phase 6A RPC grant is incomplete';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = any(array[
        'resolve_moodle_course_projection_authority',
        'list_moodle_course_mappings'
      ])
      and (
        not procedure.prosecdef
        or not ('search_path=""' = any(coalesce(procedure.proconfig, '{}'::text[])))
      )
  ) then
    raise exception 'Phase 6A RPC security-definer search path is unsafe';
  end if;
end;
$$;

do $$
declare
  authority record;
begin
  select *
  into strict authority
  from public.resolve_moodle_course_projection_authority(
    '40000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001'
  );
  if authority.active_role <> 'student'
    or authority.authorized_course_ids is distinct from array['b3000000-0000-4000-8000-000000000001'::uuid]
    or authority.observed_at is null then
    raise exception 'Student Moodle course authority mismatch: %', authority;
  end if;

  select *
  into strict authority
  from public.resolve_moodle_course_projection_authority(
    '40000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000002'
  );
  if authority.active_role <> 'teacher'
    or authority.authorized_course_ids is distinct from array['b3000000-0000-4000-8000-000000000001'::uuid]
    or authority.observed_at is null then
    raise exception 'Teacher Moodle course authority mismatch: %', authority;
  end if;

  update public.teacher_assignments
  set status = 'ended', ends_at = pg_catalog.now()
  where id = 'b7000000-0000-4000-8000-000000000001';

  select *
  into strict authority
  from public.resolve_moodle_course_projection_authority(
    '40000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000002'
  );
  if authority.active_role <> 'teacher'
    or authority.authorized_course_ids is distinct from '{}'::uuid[]
    or authority.observed_at is null then
    raise exception 'Valid empty teacher authority did not return one empty snapshot row: %', authority;
  end if;

  select *
  into strict authority
  from public.resolve_moodle_course_projection_authority(
    '40000000-0000-4000-8000-000000000004',
    '50000000-0000-4000-8000-000000000004'
  );
  if authority.active_role <> 'headofdepartment'
    or authority.authorized_course_ids is distinct from array[
    'b3000000-0000-4000-8000-000000000001'::uuid,
    'b3000000-0000-4000-8000-000000000002'::uuid
  ] or authority.observed_at is null then
    raise exception 'HOD Moodle course authority mismatch: %', authority;
  end if;

  select *
  into strict authority
  from public.resolve_moodle_course_projection_authority(
    '40000000-0000-4000-8000-000000000006',
    '50000000-0000-4000-8000-000000000006'
  );
  if authority.active_role <> 'superadmin'
    or authority.authorized_course_ids is distinct from array[
    'b3000000-0000-4000-8000-000000000001'::uuid,
    'b3000000-0000-4000-8000-000000000002'::uuid,
    'b3000000-0000-4000-8000-000000000003'::uuid
  ] or authority.observed_at is null then
    raise exception 'Super Admin Moodle course authority mismatch: %', authority;
  end if;
end;
$$;

do $$
begin
  begin
    perform *
    from public.resolve_moodle_course_projection_authority(
      '40000000-0000-4000-8000-000000000001',
      '50000000-0000-4000-8000-000000000002'
    );
    raise exception 'Mismatched user and role grant was accepted';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform *
    from public.resolve_moodle_course_projection_authority(
      '40000000-0000-4000-8000-000000000003',
      '50000000-0000-4000-8000-000000000003'
    );
    raise exception 'Registrar was accepted as Moodle course authority';
  exception
    when insufficient_privilege then null;
  end;

  update public.student_profiles
  set status = 'paused'
  where id = 'b4000000-0000-4000-8000-000000000001';

  begin
    perform *
    from public.resolve_moodle_course_projection_authority(
      '40000000-0000-4000-8000-000000000001',
      '50000000-0000-4000-8000-000000000001'
    );
    raise exception 'Inactive student profile was accepted';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

do $$
declare
  mapping_count integer;
  filtered_mapping record;
begin
  select pg_catalog.count(*)::integer
  into mapping_count
  from public.list_moodle_course_mappings();

  if mapping_count <> 3 then
    raise exception 'Moodle mapping RPC returned % rows instead of 3', mapping_count;
  end if;

  select *
  into strict filtered_mapping
  from public.list_moodle_course_mappings(
    array['b3000000-0000-4000-8000-000000000002'::uuid]
  );

  if filtered_mapping.external_course_id <> '4202'
    or filtered_mapping.sync_state <> 'stale'
    or filtered_mapping.source_updated_at <> '2026-07-15T11:00:00Z'::timestamptz
    or filtered_mapping.last_seen_at <> '2026-07-16T12:00:00Z'::timestamptz
    or filtered_mapping.last_synced_at <> '2026-07-15T12:00:00Z'::timestamptz
    or filtered_mapping.last_error is not null then
    raise exception 'Moodle mapping sync/freshness fields are incorrect';
  end if;

  select pg_catalog.count(*)::integer
  into mapping_count
  from public.list_moodle_course_mappings('{}'::uuid[]);

  if mapping_count <> 0 then
    raise exception 'Empty Moodle mapping filter returned rows';
  end if;

  update public.external_records
  set sync_state = 'ignored'
  where id = 'bb000000-0000-4000-8000-000000000002';

  select pg_catalog.count(*)::integer
  into mapping_count
  from public.list_moodle_course_mappings();

  if mapping_count <> 2 then
    raise exception 'Ignored Moodle mapping was returned by the RPC';
  end if;
end;
$$;

do $$
begin
  begin
    insert into public.class_memberships (
      enrollment_id,
      course_run_id,
      class_group_id,
      starts_at,
      ends_at,
      status
    )
    values (
      'b8000000-0000-4000-8000-000000000001',
      'b5000000-0000-4000-8000-000000000002',
      'b6000000-0000-4000-8000-000000000001',
      '2025-01-01T00:00:00Z',
      '2025-02-01T00:00:00Z',
      'ended'
    );
    raise exception 'Cross-run class membership was accepted';
  exception
    when foreign_key_violation then null;
  end;
end;
$$;

rollback;
