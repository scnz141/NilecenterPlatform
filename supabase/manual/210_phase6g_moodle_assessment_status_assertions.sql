-- Nile Learn Phase 6G semantic assertions. Always rolled back.

begin;

do $$
declare
  context record;
  freshness record;
  replay record;
  purged record;
  payload jsonb := '{"internalCourseId":"b3000000-0000-4000-8000-000000000001","internalClassGroupId":"b6000000-0000-4000-8000-000000000001","providerState":"available","mappingStatus":"exact","items":[{"projectionId":"d1000000-0000-4000-8000-000000000001","kind":"assignment","title":"Synthetic writing task","visibility":"visible","opensAt":"2026-07-17T12:00:00Z","dueAt":"2026-07-20T12:00:00Z","cutoffAt":"2026-07-21T12:00:00Z","acceptsSubmissions":true},{"projectionId":"d1000000-0000-4000-8000-000000000002","kind":"quiz","title":"Synthetic unit quiz","visibility":"visible","opensAt":"2026-07-18T08:00:00Z","closesAt":"2026-07-18T09:00:00Z","acceptsSubmissions":false}]}'::jsonb;
begin
  select * into strict context
  from public.resolve_moodle_assessment_status_context(
    '40000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    'b6000000-0000-4000-8000-000000000001'
  );
  if context.active_role <> 'student'
    or context.projection_audience <> 'learner'
    or context.subject_user_id <> '40000000-0000-4000-8000-000000000001'
    or context.internal_course_id <> 'b3000000-0000-4000-8000-000000000001'
    or context.internal_course_run_id <> 'b5000000-0000-4000-8000-000000000001'
    or context.internal_class_group_id <> 'b6000000-0000-4000-8000-000000000001'
    or context.course_mapping_status <> 'exact'
    or context.group_mapping_status <> 'exact'
    or context.user_mapping_status <> 'exact'
    or context.assessment_mapping_status <> 'exact' then
    raise exception 'Student exact-class context mismatch: %', context;
  end if;

  select * into strict context
  from public.resolve_moodle_assessment_status_context(
    '40000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000002',
    'b6000000-0000-4000-8000-000000000001'
  );
  if context.active_role <> 'teacher'
    or context.projection_audience <> 'class_staff'
    or context.subject_user_id is not null
    or context.user_mapping_status <> 'not_required' then
    raise exception 'Teacher exact current-class context mismatch: %', context;
  end if;

  select * into strict context
  from public.resolve_moodle_assessment_status_context(
    '40000000-0000-4000-8000-000000000004',
    '50000000-0000-4000-8000-000000000004',
    'b6000000-0000-4000-8000-000000000001'
  );
  if context.active_role <> 'headofdepartment'
    or context.projection_audience <> 'class_staff' then
    raise exception 'HOD department context mismatch: %', context;
  end if;

  select * into strict context
  from public.resolve_moodle_assessment_status_context(
    '40000000-0000-4000-8000-000000000006',
    '50000000-0000-4000-8000-000000000006',
    'b6000000-0000-4000-8000-000000000001'
  );
  if context.active_role <> 'superadmin'
    or context.projection_audience <> 'class_staff' then
    raise exception 'Super Admin global context mismatch: %', context;
  end if;

  begin
    perform * from public.resolve_moodle_assessment_status_context(
      '40000000-0000-4000-8000-000000000003',
      '50000000-0000-4000-8000-000000000003',
      'b6000000-0000-4000-8000-000000000001'
    );
    raise exception 'Registrar received assessment status context';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.resolve_moodle_assessment_status_context(
      '40000000-0000-4000-8000-000000000005',
      '50000000-0000-4000-8000-000000000005',
      'b6000000-0000-4000-8000-000000000001'
    );
    raise exception 'Branch Admin received assessment status context';
  exception when insufficient_privilege then null;
  end;

  select * into strict freshness
  from public.list_authorized_moodle_assessment_status_freshness(
    '40000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    'ba000000-0000-4000-8000-000000000001',
    'b6000000-0000-4000-8000-000000000001',
    '2026-07-17T12:10:00Z'
  );
  if freshness.projection_audience <> 'learner'
    or freshness.subject_user_id <> '40000000-0000-4000-8000-000000000001'
    or freshness.freshness_state <> 'fresh'
    or freshness.latest_outcome <> 'available'
    or pg_catalog.jsonb_array_length(freshness.sanitized_payload->'items') <> 2
    or freshness.fresh_until <> '2026-07-17T12:15:00Z'
    or freshness.retain_until <> '2026-07-24T12:00:00Z' then
    raise exception 'Fresh learner assessment snapshot mismatch: %', freshness;
  end if;

  if (select pg_catalog.count(distinct item.value->>'kind')
      from pg_catalog.jsonb_array_elements(freshness.sanitized_payload->'items') as item(value)) <> 2
    or exists (
      select 1
      from pg_catalog.jsonb_array_elements(freshness.sanitized_payload->'items') as item(value)
      where item.value ?| array[
        'modifiedAt', 'submission', 'attempt', 'grade', 'feedback', 'question',
        'answer', 'completion', 'url', 'html', 'providerMetadata'
      ]
    ) then
    raise exception 'Atomic assignment and quiz payload shape is unsafe: %', freshness;
  end if;

  select * into strict freshness
  from public.list_authorized_moodle_assessment_status_freshness(
    '40000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000002',
    'ba000000-0000-4000-8000-000000000001',
    'b6000000-0000-4000-8000-000000000001',
    '2026-07-17T14:30:00Z'
  );
  if freshness.projection_audience <> 'class_staff'
    or freshness.freshness_state <> 'stale_retained'
    or freshness.latest_outcome <> 'reconciliation'
    or pg_catalog.jsonb_array_length(freshness.sanitized_payload->'items') <> 2 then
    raise exception 'Teacher stale-retained snapshot mismatch: %', freshness;
  end if;

  select * into strict freshness
  from public.list_authorized_moodle_assessment_status_freshness(
    '40000000-0000-4000-8000-000000000004',
    '50000000-0000-4000-8000-000000000004',
    'ba000000-0000-4000-8000-000000000001',
    'b6000000-0000-4000-8000-000000000001',
    '2026-07-25T12:00:01Z'
  );
  if freshness.freshness_state <> 'expired'
    or freshness.sanitized_payload is not null then
    raise exception 'Expired snapshot remained retained: %', freshness;
  end if;

  select * into strict freshness
  from public.list_authorized_moodle_assessment_status_freshness(
    '40000000-0000-4000-8000-000000000006',
    '50000000-0000-4000-8000-000000000006',
    'ba000000-0000-4000-8000-000000000001',
    'b6000000-0000-4000-8000-000000000001',
    '2026-06-01T09:05:00Z'
  );
  if freshness.freshness_state <> 'unavailable'
    or freshness.latest_outcome <> 'unavailable'
    or freshness.sanitized_payload is not null then
    raise exception 'Unavailable snapshot semantics mismatch: %', freshness;
  end if;

  select * into strict freshness
  from public.list_authorized_moodle_assessment_status_freshness(
    '40000000-0000-4000-8000-000000000006',
    '50000000-0000-4000-8000-000000000006',
    'ba000000-0000-4000-8000-000000000001',
    'b6000000-0000-4000-8000-000000000001',
    '2026-06-02T09:05:00Z'
  );
  if freshness.freshness_state <> 'reconciliation'
    or freshness.latest_outcome <> 'reconciliation'
    or freshness.reconciliation_reason <> 'provider_schedule_drift' then
    raise exception 'Reconciliation snapshot semantics mismatch: %', freshness;
  end if;

  select * into strict replay
  from public.record_moodle_assessment_status_observation(
    'phase6g.class.8101.available',
    'ba000000-0000-4000-8000-000000000001',
    'b3000000-0000-4000-8000-000000000001',
    'b6000000-0000-4000-8000-000000000001',
    'bb000000-0000-4000-8000-000000000001',
    'c1000000-0000-4000-8000-000000000001',
    'd2000000-0000-4000-8000-000000000004',
    'd3000000-0000-4000-8000-000000000004',
    'available', payload,
    public.digest(pg_catalog.convert_to(payload::text, 'UTF8'), 'sha256'),
    '2026-07-17T12:00:00Z', '2026-07-17T12:15:00Z', '2026-07-24T12:00:00Z'
  );
  if replay.replayed is not true then
    raise exception 'Idempotent assessment status replay created a duplicate';
  end if;

  begin
    perform * from public.record_moodle_assessment_status_observation(
      'phase6g.class.8101.available',
      'ba000000-0000-4000-8000-000000000001',
      'b3000000-0000-4000-8000-000000000001',
      'b6000000-0000-4000-8000-000000000001',
      'bb000000-0000-4000-8000-000000000001',
      'c1000000-0000-4000-8000-000000000001',
      'd2000000-0000-4000-8000-000000000004',
      'd3000000-0000-4000-8000-000000000004',
      'available', payload,
      public.digest(pg_catalog.convert_to(payload::text, 'UTF8'), 'sha256'),
      '2026-07-17T12:00:00Z', '2026-07-17T12:15:00Z', '2026-07-25T12:00:00Z'
    );
    raise exception 'Conflicting assessment status replay was accepted';
  exception when unique_violation then null;
  end;

  if nile_private.moodle_assessment_status_payload_is_safe(
    payload || '{"modifiedAt":"2026-07-17T12:00:00Z"}'::jsonb
  ) then
    raise exception 'Provider metadata key was accepted';
  end if;
  if nile_private.moodle_assessment_status_payload_is_safe(
    pg_catalog.jsonb_set(payload, '{items,0}',
      payload->'items'->0 || '{"submission":{"grade":99}}'::jsonb)
  ) then
    raise exception 'Submission or grade payload was accepted';
  end if;
  if nile_private.moodle_assessment_status_payload_is_safe(
    pg_catalog.jsonb_set(payload, '{items,0,title}', '"<p>unsafe</p>"'::jsonb)
  ) then
    raise exception 'HTML assessment title was accepted';
  end if;

  begin
    perform * from public.record_moodle_assessment_status_observation(
      'phase6g.invalid.freshness',
      'ba000000-0000-4000-8000-000000000001',
      'b3000000-0000-4000-8000-000000000001',
      'b6000000-0000-4000-8000-000000000001',
      'bb000000-0000-4000-8000-000000000001',
      'c1000000-0000-4000-8000-000000000001',
      'd2000000-0000-4000-8000-000000000004',
      'd3000000-0000-4000-8000-000000000004',
      'available', payload,
      public.digest(pg_catalog.convert_to(payload::text, 'UTF8'), 'sha256'),
      '2026-07-17T12:00:00Z', '2026-07-17T12:16:00Z', '2026-07-24T12:00:00Z'
    );
    raise exception 'Observation exceeded the 15 minute freshness contract';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform * from public.record_moodle_assessment_status_observation(
      'phase6g.invalid.retention',
      'ba000000-0000-4000-8000-000000000001',
      'b3000000-0000-4000-8000-000000000001',
      'b6000000-0000-4000-8000-000000000001',
      'bb000000-0000-4000-8000-000000000001',
      'c1000000-0000-4000-8000-000000000001',
      'd2000000-0000-4000-8000-000000000004',
      'd3000000-0000-4000-8000-000000000004',
      'available', payload,
      public.digest(pg_catalog.convert_to(payload::text, 'UTF8'), 'sha256'),
      '2026-07-17T12:00:00Z', '2026-07-17T12:15:00Z', '2026-08-17T12:00:01Z'
    );
    raise exception 'Observation exceeded 30 day retention';
  exception when invalid_parameter_value then null;
  end;

  begin
    update public.moodle_assessment_status_observations
    set outcome = outcome
    where idempotency_key = 'phase6g.class.8101.available';
    raise exception 'Immutable observation accepted an update';
  exception when object_not_in_prerequisite_state then null;
  end;

  update public.enrollments
  set status = 'completed', ends_at = '2026-07-16T12:00:00Z'
  where id = 'b8000000-0000-4000-8000-000000000001';
  update public.class_memberships
  set status = 'ended', ends_at = '2026-07-16T12:00:00Z'
  where id = 'b9000000-0000-4000-8000-000000000001';
  select * into strict context
  from public.resolve_moodle_assessment_status_context(
    '40000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    'b6000000-0000-4000-8000-000000000001'
  );
  if context.projection_audience <> 'learner' then
    raise exception 'Completed exact enrollment lost learner context: %', context;
  end if;
  update public.class_memberships set status = 'active', ends_at = null
  where id = 'b9000000-0000-4000-8000-000000000001';
  update public.enrollments set status = 'active', ends_at = null
  where id = 'b8000000-0000-4000-8000-000000000001';

  update public.external_records set sync_state = 'ignored'
  where id = 'bf000000-0000-4000-8000-000000000001';
  select * into strict freshness
  from public.list_authorized_moodle_assessment_status_freshness(
      '40000000-0000-4000-8000-000000000001',
      '50000000-0000-4000-8000-000000000001',
      'ba000000-0000-4000-8000-000000000001',
      'b6000000-0000-4000-8000-000000000001'
      , '2026-07-17T12:10:00Z'
  );
  if freshness.user_mapping_status <> 'missing'
    or freshness.freshness_state <> 'reconciliation'
    or freshness.sanitized_payload is not null then
    raise exception 'Learner without exact user mapping retained payload: %', freshness;
  end if;
  update public.external_records set sync_state = 'synced'
  where id = 'bf000000-0000-4000-8000-000000000001';

  update public.teacher_assignments
  set status = 'ended', ends_at = pg_catalog.now()
  where id = 'b7000000-0000-4000-8000-000000000001';
  begin
    perform * from public.resolve_moodle_assessment_status_context(
      '40000000-0000-4000-8000-000000000002',
      '50000000-0000-4000-8000-000000000002',
      'b6000000-0000-4000-8000-000000000001'
    );
    raise exception 'Revoked teacher assignment retained exact-class access';
  exception when insufficient_privilege then null;
  end;
  update public.teacher_assignments set status = 'active', ends_at = null
  where id = 'b7000000-0000-4000-8000-000000000001';

  select * into strict purged
  from public.purge_moodle_assessment_status_observations(
    '2026-07-17T14:30:00Z', 1
  );
  if purged.deleted_count <> 1 then
    raise exception 'Bounded purge did not delete exactly one eligible row: %', purged;
  end if;
  if (select pg_catalog.count(*) from public.moodle_assessment_status_observations
      where purge_after <= '2026-07-17T14:30:00Z') <> 1 then
    raise exception 'Bounded purge exceeded its limit or lost eligible evidence';
  end if;
end;
$$;

rollback;
