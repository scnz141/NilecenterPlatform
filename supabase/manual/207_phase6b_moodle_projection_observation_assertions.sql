-- Nile Learn Phase 6B observation, freshness, and reconciliation assertions.
-- Run after the Phase 1, Phase 6A, and Phase 6B fake fixtures on a disposable
-- PostgreSQL database. All mutations are rolled back.

begin;

do $$
declare
  unexpected_policies text[];
begin
  if pg_catalog.to_regclass('public.moodle_projection_observations') is null then
    raise exception 'Missing Phase 6B observation table';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_class as class
    join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
    where namespace.nspname = 'public'
      and class.relname = 'moodle_projection_observations'
      and class.relrowsecurity
      and class.relforcerowsecurity
  ) then
    raise exception 'Phase 6B observation RLS is not enabled and forced';
  end if;

  select pg_catalog.array_agg(policy.policyname)
  into unexpected_policies
  from pg_catalog.pg_policies as policy
  where policy.schemaname = 'public'
    and policy.tablename = 'moodle_projection_observations';

  if unexpected_policies is not null then
    raise exception 'Phase 6B observation table has policies: %', unexpected_policies;
  end if;

  if pg_catalog.has_table_privilege('anon', 'public.moodle_projection_observations', 'SELECT,INSERT,UPDATE,DELETE')
    or pg_catalog.has_table_privilege('authenticated', 'public.moodle_projection_observations', 'SELECT,INSERT,UPDATE,DELETE')
    or pg_catalog.has_table_privilege('service_role', 'public.moodle_projection_observations', 'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'A runtime role has direct Phase 6B observation table access';
  end if;

  if pg_catalog.has_function_privilege(
    'service_role',
    'nile_private.moodle_sanitized_projection_is_safe(jsonb,integer)',
    'EXECUTE'
  ) then
    raise exception 'service_role can execute the private sanitized projection helper';
  end if;
end;
$$;

do $$
declare
  function_name text;
begin
  foreach function_name in array array[
    'resolve_moodle_projection_context',
    'list_moodle_course_mappings_for_connection',
    'record_moodle_projection_observation',
    'list_authorized_moodle_projection_freshness',
    'resolve_moodle_projection_reconciliation'
  ] loop
    if exists (
      select 1
      from pg_catalog.pg_proc as procedure
      join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
      cross join lateral pg_catalog.aclexplode(
        coalesce(procedure.proacl, pg_catalog.acldefault('f', procedure.proowner))
      ) as privilege
      where namespace.nspname = 'public'
        and procedure.proname = function_name
        and privilege.grantee = 0
        and privilege.privilege_type = 'EXECUTE'
    ) then
      raise exception 'PUBLIC can execute Phase 6B RPC %', function_name;
    end if;

    if exists (
      select 1
      from pg_catalog.pg_proc as procedure
      join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
      where namespace.nspname = 'public'
        and procedure.proname = function_name
        and (
          not procedure.prosecdef
          or not ('search_path=""' = any(coalesce(procedure.proconfig, '{}'::text[])))
        )
    ) then
      raise exception 'Phase 6B RPC % has unsafe execution configuration', function_name;
    end if;
  end loop;

  if pg_catalog.has_function_privilege('anon', 'public.resolve_moodle_projection_context(uuid,uuid)', 'EXECUTE')
    or pg_catalog.has_function_privilege('authenticated', 'public.resolve_moodle_projection_context(uuid,uuid)', 'EXECUTE')
    or not pg_catalog.has_function_privilege('service_role', 'public.resolve_moodle_projection_context(uuid,uuid)', 'EXECUTE')
    or not pg_catalog.has_function_privilege('service_role', 'public.list_moodle_course_mappings_for_connection(uuid,uuid[])', 'EXECUTE')
    or not pg_catalog.has_function_privilege('service_role', 'public.record_moodle_projection_observation(text,uuid,uuid,uuid,uuid,uuid,text,text,jsonb,bytea,timestamptz,timestamptz,timestamptz,uuid,text)', 'EXECUTE')
    or not pg_catalog.has_function_privilege('service_role', 'public.list_authorized_moodle_projection_freshness(uuid,uuid,uuid,text,timestamptz,uuid[])', 'EXECUTE')
    or not pg_catalog.has_function_privilege('service_role', 'public.resolve_moodle_projection_reconciliation(uuid,uuid,uuid,text)', 'EXECUTE') then
    raise exception 'Phase 6B RPC grants are incomplete or browser-visible';
  end if;
end;
$$;

do $$
declare
  context record;
  mapping record;
begin
  select *
  into strict context
  from public.resolve_moodle_projection_context(
    '40000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001'
  );

  if context.connection_id <> 'ba000000-0000-4000-8000-000000000001'
    or context.active_role <> 'student'
    or context.authorized_course_ids is distinct from array['b3000000-0000-4000-8000-000000000001'::uuid]
    or context.observed_at is null then
    raise exception 'Connection-scoped student projection context mismatch: %', context;
  end if;

  select *
  into strict mapping
  from public.list_moodle_course_mappings_for_connection(
    'ba000000-0000-4000-8000-000000000001',
    array['b3000000-0000-4000-8000-000000000001'::uuid]
  );

  if mapping.external_record_id <> 'bb000000-0000-4000-8000-000000000001'
    or mapping.external_course_id <> '4201'
    or mapping.sync_state <> 'synced' then
    raise exception 'Connection-scoped Moodle mapping mismatch: %', mapping;
  end if;

  begin
    perform *
    from public.list_moodle_course_mappings_for_connection(
      'a0000000-0000-4000-8000-000000000001',
      null
    );
    raise exception 'Non-Moodle connection was accepted by scoped mapping RPC';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

do $$
declare
  stale_row record;
  fresh_row record;
  unavailable_row record;
  catalog_row record;
  expired_row record;
  row_count integer;
begin
  select pg_catalog.count(*)::integer
  into row_count
  from public.list_authorized_moodle_projection_freshness(
    '40000000-0000-4000-8000-000000000006',
    '50000000-0000-4000-8000-000000000006',
    'ba000000-0000-4000-8000-000000000001',
    'course_content',
    '2026-07-16T14:30:00Z'
  );

  if row_count <> 3 then
    raise exception 'Super Admin freshness list returned % rows instead of 3', row_count;
  end if;

  select pg_catalog.count(*)::integer
  into row_count
  from public.list_authorized_moodle_projection_freshness(
    '40000000-0000-4000-8000-000000000006',
    '50000000-0000-4000-8000-000000000006',
    'ba000000-0000-4000-8000-000000000001',
    'course_content',
    '2026-07-16T14:30:00Z',
    array['b3000000-0000-4000-8000-000000000001'::uuid]
  );

  if row_count <> 1 then
    raise exception 'Exact-course freshness filter returned % rows instead of 1', row_count;
  end if;

  begin
    perform *
    from public.list_authorized_moodle_projection_freshness(
      '40000000-0000-4000-8000-000000000001',
      '50000000-0000-4000-8000-000000000001',
      'ba000000-0000-4000-8000-000000000001',
      'course_content',
      '2026-07-16T14:30:00Z',
      array['b3000000-0000-4000-8000-000000000002'::uuid]
    );
    raise exception 'Out-of-authority freshness filter was accepted';
  exception
    when insufficient_privilege then null;
  end;

  select *
  into strict stale_row
  from public.list_authorized_moodle_projection_freshness(
    '40000000-0000-4000-8000-000000000006',
    '50000000-0000-4000-8000-000000000006',
    'ba000000-0000-4000-8000-000000000001',
    'course_content',
    '2026-07-16T14:30:00Z'
  )
  where internal_course_id = 'b3000000-0000-4000-8000-000000000001';

  if stale_row.freshness_state <> 'stale'
    or stale_row.projection_family <> 'course_content'
    or stale_row.latest_outcome <> 'unavailable'
    or pg_catalog.jsonb_typeof(stale_row.sanitized_payload) <> 'array'
    or stale_row.sanitized_payload -> 0 ->> 'sourceId' <> '5101'
    or stale_row.sanitized_payload -> 0 -> 'activities' -> 0 ->> 'instanceSourceId' <> '7101'
    or stale_row.sanitized_payload -> 0 -> 'activities' -> 0 ->> 'type' <> 'page'
    or stale_row.projection_hash is null
    or stale_row.successful_sync_run_id <> 'bc000000-0000-4000-8000-000000000001'
    or stale_row.successful_observed_at <> '2026-07-16T12:00:00Z'
    or stale_row.retain_until <> '2026-07-20T12:00:00Z'
    or stale_row.latest_observed_at <> '2026-07-16T14:00:00Z' then
    raise exception 'Failed run replaced or hid the last sanitized success: %', stale_row;
  end if;

  select *
  into strict fresh_row
  from public.list_authorized_moodle_projection_freshness(
    '40000000-0000-4000-8000-000000000006',
    '50000000-0000-4000-8000-000000000006',
    'ba000000-0000-4000-8000-000000000001',
    'course_content',
    '2026-07-16T14:30:00Z'
  )
  where internal_course_id = 'b3000000-0000-4000-8000-000000000002';

  if fresh_row.freshness_state <> 'fresh'
    or fresh_row.latest_outcome <> 'empty'
    or fresh_row.sanitized_payload is distinct from '[]'::jsonb
    or fresh_row.projection_hash is null
    or fresh_row.successful_sync_run_id <> 'bc000000-0000-4000-8000-000000000003'
    or fresh_row.retain_until <> '2026-07-18T14:00:00Z' then
    raise exception 'Fresh empty projection semantics mismatch: %', fresh_row;
  end if;

  select *
  into strict unavailable_row
  from public.list_authorized_moodle_projection_freshness(
    '40000000-0000-4000-8000-000000000006',
    '50000000-0000-4000-8000-000000000006',
    'ba000000-0000-4000-8000-000000000001',
    'course_content',
    '2026-07-16T14:30:00Z'
  )
  where internal_course_id = 'b3000000-0000-4000-8000-000000000003';

  if unavailable_row.freshness_state <> 'unavailable'
    or unavailable_row.latest_outcome <> 'reconciliation'
    or unavailable_row.reconciliation_reason <> 'ambiguous_mapping'
    or unavailable_row.sanitized_payload is not null
    or unavailable_row.projection_hash is not null then
    raise exception 'Unavailable reconciliation semantics mismatch: %', unavailable_row;
  end if;

  select pg_catalog.count(*)::integer
  into row_count
  from public.list_authorized_moodle_projection_freshness(
    '40000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    'ba000000-0000-4000-8000-000000000001',
    'course_content',
    '2026-07-16T14:30:00Z'
  );

  if row_count <> 1 then
    raise exception 'Student freshness list escaped course authority';
  end if;

  select *
  into strict catalog_row
  from public.list_authorized_moodle_projection_freshness(
    '40000000-0000-4000-8000-000000000006',
    '50000000-0000-4000-8000-000000000006',
    'ba000000-0000-4000-8000-000000000001',
    'course_catalog',
    '2026-07-16T14:30:00Z'
  )
  where internal_course_id = 'b3000000-0000-4000-8000-000000000001';

  if catalog_row.freshness_state <> 'fresh'
    or catalog_row.projection_family <> 'course_catalog'
    or catalog_row.sanitized_payload -> 0 ->> 'sourceId' <> '4201'
    or catalog_row.sanitized_payload -> 0 ->> 'title' <> 'Synthetic Arabic Course'
    or catalog_row.sanitized_payload -> 0 ->> 'shortTitle' <> 'Arabic 1'
    or catalog_row.successful_sync_run_id <> 'bc000000-0000-4000-8000-000000000006'
    or catalog_row.retain_until <> '2026-07-17T14:20:00Z'
    or catalog_row.sanitized_payload -> 0 ? 'courseId'
    or catalog_row.sanitized_payload -> 0 ? 'id' then
    raise exception 'Course catalog read-model projection mismatch: %', catalog_row;
  end if;

  select *
  into strict expired_row
  from public.list_authorized_moodle_projection_freshness(
    '40000000-0000-4000-8000-000000000006',
    '50000000-0000-4000-8000-000000000006',
    'ba000000-0000-4000-8000-000000000001',
    'course_content',
    '2026-07-21T12:00:01Z'
  )
  where internal_course_id = 'b3000000-0000-4000-8000-000000000001';

  if expired_row.freshness_state <> 'unavailable'
    or expired_row.sanitized_payload is not null
    or expired_row.projection_hash is not null
    or expired_row.successful_sync_run_id is not null
    or expired_row.successful_observed_at is not null
    or expired_row.fresh_until is not null
    or expired_row.retain_until is not null then
    raise exception 'Expired retained content projection remained available: %', expired_row;
  end if;

  select *
  into strict expired_row
  from public.list_authorized_moodle_projection_freshness(
    '40000000-0000-4000-8000-000000000006',
    '50000000-0000-4000-8000-000000000006',
    'ba000000-0000-4000-8000-000000000001',
    'course_catalog',
    '2026-07-17T14:20:01Z'
  )
  where internal_course_id = 'b3000000-0000-4000-8000-000000000001';

  if expired_row.freshness_state <> 'unavailable'
    or expired_row.sanitized_payload is not null
    or expired_row.projection_hash is not null then
    raise exception 'Expired retained catalog projection remained available: %', expired_row;
  end if;

  begin
    perform *
    from public.list_authorized_moodle_projection_freshness(
      '40000000-0000-4000-8000-000000000006',
      '50000000-0000-4000-8000-000000000006',
      'ba000000-0000-4000-8000-000000000001',
      'legacy_course_shape',
      '2026-07-16T14:30:00Z'
    );
    raise exception 'Malformed projection family was accepted by freshness RPC';
  exception
    when invalid_parameter_value then null;
  end;
end;
$$;

do $$
declare
  replay record;
  before_count integer;
  after_count integer;
begin
  select pg_catalog.count(*)::integer into before_count
  from public.moodle_projection_observations;

  select * into strict replay
  from public.record_moodle_projection_observation(
    'phase6b.course-content.4201.success',
    'ba000000-0000-4000-8000-000000000001',
    'b3000000-0000-4000-8000-000000000001',
    'bb000000-0000-4000-8000-000000000001',
    'bc000000-0000-4000-8000-000000000001',
    'bd000000-0000-4000-8000-000000000001',
    'course_content',
    'available',
    '[{"sourceId":"5101","position":1,"title":"Synthetic section","visible":true,"activities":[{"sourceId":"6101","instanceSourceId":"7101","type":"page","title":"Synthetic welcome","visible":true,"completionTracking":"none"}]}]'::jsonb,
    digest(convert_to('[{"sourceId":"5101","position":1,"title":"Synthetic section","visible":true,"activities":[{"sourceId":"6101","instanceSourceId":"7101","type":"page","title":"Synthetic welcome","visible":true,"completionTracking":"none"}]}]'::jsonb::text, 'UTF8'), 'sha256'),
    '2026-07-16T12:00:00Z',
    '2026-07-16T13:00:00Z',
    '2026-07-20T12:00:00Z'
  );

  select pg_catalog.count(*)::integer into after_count
  from public.moodle_projection_observations;

  if not replay.replayed or before_count <> after_count then
    raise exception 'Idempotent observation replay created a duplicate';
  end if;

  begin
    perform *
    from public.record_moodle_projection_observation(
      'phase6b.course-content.4201.success',
      'ba000000-0000-4000-8000-000000000001',
      'b3000000-0000-4000-8000-000000000001',
      'bb000000-0000-4000-8000-000000000001',
      'bc000000-0000-4000-8000-000000000001',
      'bd000000-0000-4000-8000-000000000001',
      'course_content',
      'available',
      '[]'::jsonb,
      digest(convert_to('[]'::jsonb::text, 'UTF8'), 'sha256'),
      '2026-07-16T12:00:00Z',
      '2026-07-16T13:00:00Z',
      '2026-07-20T12:00:00Z'
    );
    raise exception 'Conflicting observation replay was accepted';
  exception
    when unique_violation then null;
  end;
end;
$$;

do $$
declare
  unsafe_payload jsonb;
  unsafe_index integer := 0;
begin
  foreach unsafe_payload in array array[
    '{"raw_response":{"id":"4201"}}'::jsonb,
    '{"error":"provider detail"}'::jsonb,
    '{"contact":{"email":"person@example.invalid"}}'::jsonb,
    '{"credential":"synthetic-marker"}'::jsonb
  ] loop
    unsafe_index := unsafe_index + 1;
    begin
      perform *
      from public.record_moodle_projection_observation(
        'phase6b.unsafe-payload.' || unsafe_index,
        'ba000000-0000-4000-8000-000000000001',
        'b3000000-0000-4000-8000-000000000001',
        'bb000000-0000-4000-8000-000000000001',
        'bc000000-0000-4000-8000-000000000001',
        'bd000000-0000-4000-8000-000000000001',
        'course_content',
        'available',
        unsafe_payload,
        digest(convert_to(unsafe_payload::text, 'UTF8'), 'sha256'),
        '2026-07-16T12:00:00Z',
        '2026-07-16T13:00:00Z',
        '2026-07-20T12:00:00Z'
      );
      raise exception 'Unsafe raw/error/contact/credential payload marker was accepted';
    exception
      when invalid_parameter_value then null;
    end;
  end loop;

  begin
    perform *
    from public.record_moodle_projection_observation(
      'phase6b.unavailable-with-payload',
      'ba000000-0000-4000-8000-000000000001',
      'b3000000-0000-4000-8000-000000000001',
      'bb000000-0000-4000-8000-000000000001',
      'bc000000-0000-4000-8000-000000000002',
      'bd000000-0000-4000-8000-000000000002',
      'course_content',
      'unavailable',
      '[{"sourceId":"5101","position":1,"activities":[]}]'::jsonb,
      digest(convert_to('[{"sourceId":"5101","position":1,"activities":[]}]'::jsonb::text, 'UTF8'), 'sha256'),
      '2026-07-16T14:00:00Z', null, null
    );
    raise exception 'Unavailable observation retained a payload';
  exception
    when invalid_parameter_value then null;
  end;

  begin
    perform *
    from public.record_moodle_projection_observation(
      'phase6b.malformed-family',
      'ba000000-0000-4000-8000-000000000001',
      'b3000000-0000-4000-8000-000000000001',
      'bb000000-0000-4000-8000-000000000001',
      'bc000000-0000-4000-8000-000000000001',
      'bd000000-0000-4000-8000-000000000001',
      'legacy_course_shape',
      'available',
      '[]'::jsonb,
      digest(convert_to('[]'::jsonb::text, 'UTF8'), 'sha256'),
      '2026-07-16T12:00:00Z',
      '2026-07-16T13:00:00Z',
      '2026-07-20T12:00:00Z'
    );
    raise exception 'Malformed projection family was accepted by record RPC';
  exception
    when invalid_parameter_value then null;
  end;

  begin
    perform *
    from public.record_moodle_projection_observation(
      'phase6b.family-run-mismatch',
      'ba000000-0000-4000-8000-000000000001',
      'b3000000-0000-4000-8000-000000000001',
      'bb000000-0000-4000-8000-000000000001',
      'bc000000-0000-4000-8000-000000000001',
      'bd000000-0000-4000-8000-000000000001',
      'course_catalog',
      'available',
      '[]'::jsonb,
      digest(convert_to('[]'::jsonb::text, 'UTF8'), 'sha256'),
      '2026-07-16T12:00:00Z',
      '2026-07-16T13:00:00Z',
      '2026-07-20T12:00:00Z'
    );
    raise exception 'Projection family was not matched to sync-run entity type';
  exception
    when check_violation then null;
  end;

  begin
    perform *
    from public.record_moodle_projection_observation(
      'phase6b.retention-too-long',
      'ba000000-0000-4000-8000-000000000001',
      'b3000000-0000-4000-8000-000000000001',
      'bb000000-0000-4000-8000-000000000001',
      'bc000000-0000-4000-8000-000000000001',
      'bd000000-0000-4000-8000-000000000001',
      'course_content',
      'available',
      '[]'::jsonb,
      digest(convert_to('[]'::jsonb::text, 'UTF8'), 'sha256'),
      '2026-07-16T12:00:00Z',
      '2026-07-16T13:00:00Z',
      '2026-08-16T12:00:01Z'
    );
    raise exception 'Observation exceeded the bounded retention window';
  exception
    when invalid_parameter_value then null;
  end;

  begin
    update public.moodle_projection_observations
    set observed_at = observed_at + interval '1 second'
    where idempotency_key = 'phase6b.course-content.4201.success';
    raise exception 'Immutable observation was updated';
  exception
    when object_not_in_prerequisite_state then null;
  end;
end;
$$;

do $$
declare
  observation_id uuid;
  resolution record;
begin
  select id into strict observation_id
  from public.moodle_projection_observations
  where idempotency_key = 'phase6b.course-content.4203.reconciliation';

  begin
    perform *
    from public.resolve_moodle_projection_reconciliation(
      '40000000-0000-4000-8000-000000000002',
      '50000000-0000-4000-8000-000000000002',
      observation_id,
      'source_rechecked'
    );
    raise exception 'Teacher resolved a Moodle reconciliation case';
  exception
    when insufficient_privilege then null;
  end;

  select * into strict resolution
  from public.resolve_moodle_projection_reconciliation(
    '40000000-0000-4000-8000-000000000006',
    '50000000-0000-4000-8000-000000000006',
    observation_id,
    'source_rechecked'
  );

  if resolution.status <> 'resolved' or resolution.replayed then
    raise exception 'Super Admin reconciliation resolution mismatch: %', resolution;
  end if;

  select * into strict resolution
  from public.resolve_moodle_projection_reconciliation(
    '40000000-0000-4000-8000-000000000006',
    '50000000-0000-4000-8000-000000000006',
    observation_id,
    'source_rechecked'
  );

  if resolution.status <> 'resolved' or not resolution.replayed then
    raise exception 'Reconciliation replay was not idempotent';
  end if;

  begin
    perform *
    from public.resolve_moodle_projection_reconciliation(
      '40000000-0000-4000-8000-000000000006',
      '50000000-0000-4000-8000-000000000006',
      observation_id,
      'provider_record_ignored'
    );
    raise exception 'Conflicting reconciliation replay was accepted';
  exception
    when unique_violation then null;
  end;
end;
$$;

do $$
begin
  insert into public.integration_connections (
    id,
    provider,
    label,
    environment,
    mode,
    status,
    capabilities,
    last_verified_at,
    verification_evidence_hash
  )
  values (
    'ba000000-0000-4000-8000-000000000099',
    'moodle',
    'phase6b-ambiguity-negative-control',
    'sandbox',
    'read_only',
    'ready',
    '["courses.read"]'::jsonb,
    '2026-07-16T14:30:00Z',
    decode(repeat('99', 32), 'hex')
  );

  begin
    perform *
    from public.resolve_moodle_projection_context(
      '40000000-0000-4000-8000-000000000006',
      '50000000-0000-4000-8000-000000000006'
    );
    raise exception 'Multiple ready Moodle connections did not fail closed';
  exception
    when insufficient_privilege then null;
  end;

  delete from public.integration_connections
  where id = 'ba000000-0000-4000-8000-000000000099';
end;
$$;

rollback;
