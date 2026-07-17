-- Nile Learn Phase 6F security, authority, observation, and freshness assertions.
-- Temporary authority/mapping mutations are rolled back at the end.

begin;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_class as class
    join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
    where namespace.nspname = 'public'
      and class.relname = 'moodle_enrollment_group_observations'
      and class.relrowsecurity and class.relforcerowsecurity
  ) then
    raise exception 'Phase 6F observation table is not forced-RLS';
  end if;

  if exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'moodle_enrollment_group_observations'
  ) then
    raise exception 'Phase 6F server-only observation table has a policy';
  end if;

  if pg_catalog.has_table_privilege(
    'service_role', 'public.moodle_enrollment_group_observations', 'SELECT'
  ) or pg_catalog.has_table_privilege(
    'anon', 'public.moodle_enrollment_group_observations', 'SELECT'
  ) or pg_catalog.has_table_privilege(
    'authenticated', 'public.moodle_enrollment_group_observations', 'SELECT'
  ) then
    raise exception 'A runtime role has direct Phase 6F table access';
  end if;

  if exists (
    select 1 from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = any(array[
        'resolve_moodle_enrollment_group_context',
        'record_moodle_enrollment_group_observation',
        'list_authorized_moodle_enrollment_group_freshness'
      ])
      and (
        not procedure.prosecdef
        or not ('search_path=""' = any(coalesce(procedure.proconfig, '{}'::text[])))
      )
  ) then
    raise exception 'Phase 6F RPC security-definer search path is unsafe';
  end if;

  if pg_catalog.has_function_privilege(
    'anon', 'public.resolve_moodle_enrollment_group_context(uuid,uuid,uuid)', 'EXECUTE'
  ) or pg_catalog.has_function_privilege(
    'authenticated', 'public.resolve_moodle_enrollment_group_context(uuid,uuid,uuid)', 'EXECUTE'
  ) or pg_catalog.has_function_privilege(
    'anon', 'public.list_authorized_moodle_enrollment_group_freshness(uuid,uuid,uuid,uuid,timestamp with time zone)', 'EXECUTE'
  ) or pg_catalog.has_function_privilege(
    'authenticated', 'public.list_authorized_moodle_enrollment_group_freshness(uuid,uuid,uuid,uuid,timestamp with time zone)', 'EXECUTE'
  ) then
    raise exception 'Browser role can execute a Phase 6F RPC';
  end if;
end;
$$;

do $$
declare
  context record;
begin
  select * into strict context
  from public.resolve_moodle_enrollment_group_context(
    '40000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000002',
    'b6000000-0000-4000-8000-000000000001'
  );
  if context.active_role <> 'teacher'
    or context.projection_audience <> 'person_level'
    or context.internal_course_id <> 'b3000000-0000-4000-8000-000000000001'
    or context.authorized_user_ids is distinct from array[
      '40000000-0000-4000-8000-000000000001'::uuid
    ]
    or context.course_mapping_status <> 'exact'
    or context.group_mapping_status <> 'exact'
    or context.user_mapping_status <> 'exact' then
    raise exception 'Teacher exact-class context mismatch: %', context;
  end if;

  select * into strict context
  from public.resolve_moodle_enrollment_group_context(
    '40000000-0000-4000-8000-000000000004',
    '50000000-0000-4000-8000-000000000004',
    'b6000000-0000-4000-8000-000000000001'
  );
  if context.active_role <> 'headofdepartment'
    or context.projection_audience <> 'aggregate'
    or context.authorized_user_ids <> '{}'::uuid[] then
    raise exception 'HOD aggregate-only context mismatch: %', context;
  end if;

  select * into strict context
  from public.resolve_moodle_enrollment_group_context(
    '40000000-0000-4000-8000-000000000006',
    '50000000-0000-4000-8000-000000000006',
    'b6000000-0000-4000-8000-000000000001'
  );
  if context.active_role <> 'superadmin'
    or context.projection_audience <> 'aggregate'
    or context.authorized_user_ids <> '{}'::uuid[] then
    raise exception 'Super Admin aggregate-only context mismatch: %', context;
  end if;
end;
$$;

do $$
begin
  begin
    perform * from public.resolve_moodle_enrollment_group_context(
      '40000000-0000-4000-8000-000000000001',
      '50000000-0000-4000-8000-000000000001',
      'b6000000-0000-4000-8000-000000000001'
    );
    raise exception 'Student received person-level class context';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.resolve_moodle_enrollment_group_context(
      '40000000-0000-4000-8000-000000000003',
      '50000000-0000-4000-8000-000000000003',
      'b6000000-0000-4000-8000-000000000001'
    );
    raise exception 'Registrar received enrollment/group context';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.resolve_moodle_enrollment_group_context(
      '40000000-0000-4000-8000-000000000005',
      '50000000-0000-4000-8000-000000000005',
      'b6000000-0000-4000-8000-000000000001'
    );
    raise exception 'Branch Admin received enrollment/group context';
  exception when insufficient_privilege then null;
  end;
end;
$$;

do $$
declare
  freshness record;
begin
  select * into strict freshness
  from public.list_authorized_moodle_enrollment_group_freshness(
    '40000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000002',
    'ba000000-0000-4000-8000-000000000001',
    'b6000000-0000-4000-8000-000000000001',
    '2026-07-17T10:15:00Z'
  );
  if freshness.freshness_state <> 'fresh'
    or freshness.latest_outcome <> 'empty'
    or pg_catalog.jsonb_array_length(freshness.sanitized_payload->'learners') <> 0 then
    raise exception 'Fresh empty person-level semantics mismatch: %', freshness;
  end if;

  select * into strict freshness
  from public.list_authorized_moodle_enrollment_group_freshness(
    '40000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000002',
    'ba000000-0000-4000-8000-000000000001',
    'b6000000-0000-4000-8000-000000000001',
    '2026-07-17T14:30:00Z'
  );
  if freshness.freshness_state <> 'stale_retained'
    or freshness.latest_outcome <> 'unavailable'
    or pg_catalog.jsonb_array_length(freshness.sanitized_payload->'learners') <> 1
    or freshness.sanitized_payload->'learners'->0->>'internalUserId'
      <> '40000000-0000-4000-8000-000000000001' then
    raise exception 'Teacher stale-retained learner projection mismatch: %', freshness;
  end if;

  select * into strict freshness
  from public.list_authorized_moodle_enrollment_group_freshness(
    '40000000-0000-4000-8000-000000000004',
    '50000000-0000-4000-8000-000000000004',
    'ba000000-0000-4000-8000-000000000001',
    'b6000000-0000-4000-8000-000000000001',
    '2026-07-17T14:30:00Z'
  );
  if freshness.projection_audience <> 'aggregate'
    or freshness.freshness_state <> 'stale_retained'
    or freshness.latest_outcome <> 'reconciliation'
    or freshness.sanitized_payload ? 'learners'
    or (freshness.sanitized_payload->>'learnerCount')::integer <> 1 then
    raise exception 'HOD aggregate reconciliation retention mismatch: %', freshness;
  end if;

  select * into strict freshness
  from public.list_authorized_moodle_enrollment_group_freshness(
    '40000000-0000-4000-8000-000000000006',
    '50000000-0000-4000-8000-000000000006',
    'ba000000-0000-4000-8000-000000000001',
    'b6000000-0000-4000-8000-000000000001',
    '2026-07-21T12:01:01Z'
  );
  if freshness.freshness_state <> 'expired'
    or freshness.sanitized_payload is not null
    or freshness.projection_hash is not null
    or freshness.successful_sync_run_id is not null then
    raise exception 'Expired aggregate projection remained retained: %', freshness;
  end if;
end;
$$;

do $$
declare
  replay record;
begin
  select * into strict replay
  from public.record_moodle_enrollment_group_observation(
    'phase6f.person.8101.available',
    'ba000000-0000-4000-8000-000000000001',
    'b3000000-0000-4000-8000-000000000001',
    'b6000000-0000-4000-8000-000000000001',
    'bb000000-0000-4000-8000-000000000001',
    'c1000000-0000-4000-8000-000000000001',
    'c2000000-0000-4000-8000-000000000002',
    'c3000000-0000-4000-8000-000000000002',
    'person_level', 'available',
    '{"internalCourseId":"b3000000-0000-4000-8000-000000000001","internalClassGroupId":"b6000000-0000-4000-8000-000000000001","providerState":"available","mappingStatus":"exact","learners":[{"internalUserId":"40000000-0000-4000-8000-000000000001","internalEnrollmentId":"b8000000-0000-4000-8000-000000000001","internalMembershipId":"b9000000-0000-4000-8000-000000000001","providerState":"enrolled","mappingStatus":"exact"}]}'::jsonb,
    public.digest(pg_catalog.convert_to('{"internalCourseId":"b3000000-0000-4000-8000-000000000001","internalClassGroupId":"b6000000-0000-4000-8000-000000000001","providerState":"available","mappingStatus":"exact","learners":[{"internalUserId":"40000000-0000-4000-8000-000000000001","internalEnrollmentId":"b8000000-0000-4000-8000-000000000001","internalMembershipId":"b9000000-0000-4000-8000-000000000001","providerState":"enrolled","mappingStatus":"exact"}]}'::jsonb::text, 'UTF8'), 'sha256'),
    '2026-07-17T12:00:00Z', '2026-07-17T13:00:00Z', '2026-07-20T12:00:00Z'
  );
  if not replay.replayed then
    raise exception 'Idempotent enrollment/group replay created a duplicate';
  end if;

  begin
    update public.moodle_enrollment_group_observations
    set outcome = 'unavailable'
    where idempotency_key = 'phase6f.person.8101.available';
    raise exception 'Immutable observation was updated';
  exception when sqlstate '55000' then null;
  end;
end;
$$;

do $$
declare
  unsafe_payload jsonb := '{"internalCourseId":"b3000000-0000-4000-8000-000000000001","internalClassGroupId":"b6000000-0000-4000-8000-000000000001","providerState":"available","mappingStatus":"exact","learners":[],"email":"leak@example.invalid"}'::jsonb;
  valid_empty jsonb := '{"internalCourseId":"b3000000-0000-4000-8000-000000000001","internalClassGroupId":"b6000000-0000-4000-8000-000000000001","providerState":"empty","mappingStatus":"exact","learners":[]}'::jsonb;
begin
  begin
    perform * from public.record_moodle_enrollment_group_observation(
      'phase6f.reject.raw-payload',
      'ba000000-0000-4000-8000-000000000001',
      'b3000000-0000-4000-8000-000000000001',
      'b6000000-0000-4000-8000-000000000001',
      'bb000000-0000-4000-8000-000000000001',
      'c1000000-0000-4000-8000-000000000001',
      'c2000000-0000-4000-8000-000000000002',
      'c3000000-0000-4000-8000-000000000002',
      'person_level', 'available', unsafe_payload,
      public.digest(pg_catalog.convert_to(unsafe_payload::text, 'UTF8'), 'sha256'),
      '2026-07-17T12:00:00Z', '2026-07-17T13:00:00Z', '2026-07-20T12:00:00Z'
    );
    raise exception 'Raw email payload was accepted';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform * from public.record_moodle_enrollment_group_observation(
      'phase6f.reject.retention',
      'ba000000-0000-4000-8000-000000000001',
      'b3000000-0000-4000-8000-000000000001',
      'b6000000-0000-4000-8000-000000000001',
      'bb000000-0000-4000-8000-000000000001',
      'c1000000-0000-4000-8000-000000000001',
      'c2000000-0000-4000-8000-000000000001',
      'c3000000-0000-4000-8000-000000000001',
      'person_level', 'empty', valid_empty,
      public.digest(pg_catalog.convert_to(valid_empty::text, 'UTF8'), 'sha256'),
      '2026-07-17T10:00:00Z', '2026-07-17T11:00:00Z', '2026-08-17T10:00:01Z'
    );
    raise exception 'Observation exceeded 30 day retention';
  exception when invalid_parameter_value then null;
  end;
end;
$$;

do $$
declare
  freshness record;
begin
  update public.class_memberships
  set status = 'ended', ends_at = pg_catalog.now()
  where id = 'b9000000-0000-4000-8000-000000000001';

  select * into strict freshness
  from public.list_authorized_moodle_enrollment_group_freshness(
    '40000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000002',
    'ba000000-0000-4000-8000-000000000001',
    'b6000000-0000-4000-8000-000000000001',
    '2026-07-17T14:30:00Z'
  );
  if freshness.sanitized_payload is not null
    and pg_catalog.jsonb_array_length(freshness.sanitized_payload->'learners') > 0 then
    raise exception 'Ended class membership retained learner-level payload: %', freshness;
  end if;

  update public.class_memberships
  set status = 'active', ends_at = null
  where id = 'b9000000-0000-4000-8000-000000000001';

  update public.external_records
  set sync_state = 'ignored'
  where id = 'bf000000-0000-4000-8000-000000000001';

  select * into strict freshness
  from public.list_authorized_moodle_enrollment_group_freshness(
    '40000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000002',
    'ba000000-0000-4000-8000-000000000001',
    'b6000000-0000-4000-8000-000000000001',
    '2026-07-17T14:30:00Z'
  );
  if freshness.user_mapping_status <> 'missing'
    or freshness.freshness_state <> 'reconciliation'
    or freshness.sanitized_payload is not null then
    raise exception 'Ignored user mapping retained person-level payload: %', freshness;
  end if;

  update public.teacher_assignments
  set status = 'ended', ends_at = pg_catalog.now()
  where id = 'b7000000-0000-4000-8000-000000000001';
  begin
    perform * from public.list_authorized_moodle_enrollment_group_freshness(
      '40000000-0000-4000-8000-000000000002',
      '50000000-0000-4000-8000-000000000002',
      'ba000000-0000-4000-8000-000000000001',
      'b6000000-0000-4000-8000-000000000001',
      '2026-07-17T14:30:00Z'
    );
    raise exception 'Revoked teacher assignment retained class projection access';
  exception when insufficient_privilege then null;
  end;
end;
$$;

rollback;
