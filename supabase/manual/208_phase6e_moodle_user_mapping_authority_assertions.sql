-- Nile Learn Phase 6E user authority and exact mapping assertions.
-- All temporary mutations are enclosed by this rolled-back transaction.

begin;

do $$
begin
  if pg_catalog.to_regclass('public.moodle_user_mappings') is not null then
    raise exception 'Phase 6E created an unauthorized Moodle user mapping table';
  end if;

  if pg_catalog.has_function_privilege(
    'anon',
    'public.resolve_moodle_user_projection_authority(uuid,uuid)',
    'EXECUTE'
  ) or pg_catalog.has_function_privilege(
    'authenticated',
    'public.resolve_moodle_user_projection_authority(uuid,uuid)',
    'EXECUTE'
  ) or pg_catalog.has_function_privilege(
    'anon',
    'public.list_moodle_user_mappings_for_connection(uuid,uuid[])',
    'EXECUTE'
  ) or pg_catalog.has_function_privilege(
    'authenticated',
    'public.list_moodle_user_mappings_for_connection(uuid,uuid[])',
    'EXECUTE'
  ) then
    raise exception 'Browser role can execute a Phase 6E RPC';
  end if;

  if not pg_catalog.has_function_privilege(
    'service_role',
    'public.resolve_moodle_user_projection_authority(uuid,uuid)',
    'EXECUTE'
  ) or not pg_catalog.has_function_privilege(
    'service_role',
    'public.list_moodle_user_mappings_for_connection(uuid,uuid[])',
    'EXECUTE'
  ) then
    raise exception 'service_role Phase 6E RPC grant is incomplete';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = any(array[
        'resolve_moodle_user_projection_authority',
        'list_moodle_user_mappings_for_connection'
      ])
      and (
        not procedure.prosecdef
        or not ('search_path=""' = any(coalesce(procedure.proconfig, '{}'::text[])))
      )
  ) then
    raise exception 'Phase 6E RPC security-definer search path is unsafe';
  end if;
end;
$$;

do $$
declare
  authority record;
begin
  select * into strict authority
  from public.resolve_moodle_user_projection_authority(
    '40000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001'
  );
  if authority.active_role <> 'student'
    or authority.authorized_user_ids is distinct from array[
      '40000000-0000-4000-8000-000000000001'::uuid
    ] or authority.observed_at is null then
    raise exception 'Student Moodle user authority mismatch: %', authority;
  end if;

  select * into strict authority
  from public.resolve_moodle_user_projection_authority(
    '40000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000002'
  );
  if authority.active_role <> 'teacher'
    or authority.authorized_user_ids is distinct from array[
      '40000000-0000-4000-8000-000000000001'::uuid,
      '40000000-0000-4000-8000-000000000002'::uuid
    ] then
    raise exception 'Teacher Moodle user authority mismatch: %', authority;
  end if;

  select * into strict authority
  from public.resolve_moodle_user_projection_authority(
    '40000000-0000-4000-8000-000000000004',
    '50000000-0000-4000-8000-000000000004'
  );
  if authority.active_role <> 'headofdepartment'
    or authority.authorized_user_ids is distinct from array[
      '40000000-0000-4000-8000-000000000001'::uuid,
      '40000000-0000-4000-8000-000000000002'::uuid,
      '40000000-0000-4000-8000-000000000004'::uuid
    ] then
    raise exception 'HOD Moodle user authority mismatch: %', authority;
  end if;

  select * into strict authority
  from public.resolve_moodle_user_projection_authority(
    '40000000-0000-4000-8000-000000000006',
    '50000000-0000-4000-8000-000000000006'
  );
  if authority.active_role <> 'superadmin'
    or authority.authorized_user_ids is distinct from array[
      '40000000-0000-4000-8000-000000000001'::uuid,
      '40000000-0000-4000-8000-000000000002'::uuid,
      '40000000-0000-4000-8000-000000000003'::uuid,
      '40000000-0000-4000-8000-000000000004'::uuid,
      '40000000-0000-4000-8000-000000000005'::uuid,
      '40000000-0000-4000-8000-000000000006'::uuid
    ] then
    raise exception 'Super Admin Moodle user authority mismatch: %', authority;
  end if;
end;
$$;

do $$
begin
  begin
    perform * from public.resolve_moodle_user_projection_authority(
      '40000000-0000-4000-8000-000000000003',
      '50000000-0000-4000-8000-000000000003'
    );
    raise exception 'Registrar was accepted as Moodle user authority';
  exception when insufficient_privilege then null;
  end;

  begin
    perform * from public.resolve_moodle_user_projection_authority(
      '40000000-0000-4000-8000-000000000005',
      '50000000-0000-4000-8000-000000000005'
    );
    raise exception 'Branch Admin was accepted as Moodle user authority';
  exception when insufficient_privilege then null;
  end;

  begin
    perform * from public.resolve_moodle_user_projection_authority(
      '40000000-0000-4000-8000-000000000001',
      '50000000-0000-4000-8000-000000000002'
    );
    raise exception 'Mismatched user and role grant was accepted';
  exception when insufficient_privilege then null;
  end;
end;
$$;

do $$
declare
  authority record;
begin
  update public.teacher_assignments
  set status = 'ended', ends_at = pg_catalog.now()
  where id = 'b7000000-0000-4000-8000-000000000001';

  select * into strict authority
  from public.resolve_moodle_user_projection_authority(
    '40000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000002'
  );
  if authority.authorized_user_ids is distinct from array[
    '40000000-0000-4000-8000-000000000002'::uuid
  ] then
    raise exception 'Ended teacher assignment retained stale learner authority: %', authority;
  end if;

  update public.role_grant_department_scopes
  set ends_at = pg_catalog.now()
  where id = '70000000-0000-4000-8000-000000000002';

  begin
    perform * from public.resolve_moodle_user_projection_authority(
      '40000000-0000-4000-8000-000000000004',
      '50000000-0000-4000-8000-000000000004'
    );
    raise exception 'Expired HOD department scope retained stale authority';
  exception when insufficient_privilege then null;
  end;
end;
$$;

do $$
declare
  mapping_count integer;
  mapping_ids text[];
begin
  select pg_catalog.count(*)::integer,
    pg_catalog.array_agg(mapping.external_user_id order by mapping.external_user_id)
  into mapping_count, mapping_ids
  from public.list_moodle_user_mappings_for_connection(
    'ba000000-0000-4000-8000-000000000001',
    array[
      '40000000-0000-4000-8000-000000000001'::uuid,
      '40000000-0000-4000-8000-000000000002'::uuid
    ]
  ) as mapping;

  if mapping_count <> 2 or mapping_ids is distinct from array['9101', '9102']::text[] then
    raise exception 'Exact Moodle user mapping result mismatch: %, %', mapping_count, mapping_ids;
  end if;

  if exists (
    select 1
    from public.list_moodle_user_mappings_for_connection(
      'ba000000-0000-4000-8000-000000000001',
      array['40000000-0000-4000-8000-000000000001'::uuid]
    ) as mapping
    where mapping.external_user_id = '9199'
  ) then
    raise exception 'Ignored Moodle user mapping leaked into exact results';
  end if;
end;
$$;

do $$
begin
  begin
    perform * from public.list_moodle_user_mappings_for_connection(
      'ba000000-0000-4000-8000-000000000001',
      '{}'::uuid[]
    );
    raise exception 'Empty mapping request was accepted';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform * from public.list_moodle_user_mappings_for_connection(
      'ba000000-0000-4000-8000-000000000001',
      array[
        '40000000-0000-4000-8000-000000000001'::uuid,
        '40000000-0000-4000-8000-000000000001'::uuid
      ]
    );
    raise exception 'Duplicate mapping request was accepted';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform * from public.list_moodle_user_mappings_for_connection(
      'a0000000-0000-4000-8000-000000000001',
      array['40000000-0000-4000-8000-000000000001'::uuid]
    );
    raise exception 'Non-Moodle connection was accepted';
  exception when insufficient_privilege then null;
  end;

  begin
    perform * from public.list_moodle_user_mappings_for_connection(
      'ba000000-0000-4000-8000-000000000001',
      array['ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid]
    );
    raise exception 'Unknown app user was accepted';
  exception when insufficient_privilege then null;
  end;

  update public.external_records
  set sync_state = 'ignored', updated_at = pg_catalog.now()
  where id = 'bf000000-0000-4000-8000-000000000001';

  if exists (
    select 1
    from public.list_moodle_user_mappings_for_connection(
      'ba000000-0000-4000-8000-000000000001',
      array['40000000-0000-4000-8000-000000000001'::uuid]
    )
  ) then
    raise exception 'Ignored exact mapping remained readable';
  end if;

  update public.app_users
  set status = 'paused', updated_at = pg_catalog.now()
  where id = '40000000-0000-4000-8000-000000000002';

  begin
    perform * from public.list_moodle_user_mappings_for_connection(
      'ba000000-0000-4000-8000-000000000001',
      array['40000000-0000-4000-8000-000000000002'::uuid]
    );
    raise exception 'Inactive app user mapping was accepted';
  exception when insufficient_privilege then null;
  end;
end;
$$;

rollback;
