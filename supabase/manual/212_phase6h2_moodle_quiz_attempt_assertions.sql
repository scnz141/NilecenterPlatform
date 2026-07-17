-- Nile Learn Phase 6H2 semantic assertions. Always rolled back.

begin;

do $$
declare
  context record;
  freshness record;
  replay record;
  purged record;
  person_payload jsonb := '{"internalCourseId":"b3000000-0000-4000-8000-000000000001","internalClassGroupId":"b6000000-0000-4000-8000-000000000001","quizProjectionId":"d1000000-0000-4000-8000-000000000002","providerState":"available","mappingStatus":"exact","learners":[{"internalUserId":"40000000-0000-4000-8000-000000000001","internalEnrollmentId":"b8000000-0000-4000-8000-000000000001","internalMembershipId":"b9000000-0000-4000-8000-000000000001","attemptProjectionId":"d2000000-0000-4000-8000-000000000001","attemptState":"finished","attemptNumber":2,"gradingState":"graded","latest":true,"preview":false,"startedAt":"2026-07-17T10:00:00Z","finishedAt":"2026-07-17T10:45:00Z","modifiedAt":"2026-07-17T10:45:00Z","score":87.5,"maximumScore":100}]}'::jsonb;
begin
  select * into strict context from public.resolve_moodle_quiz_attempt_context(
    '40000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    'b6000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000002'
  );
  if context.active_role <> 'student' or context.projection_audience <> 'learner'
    or context.authorized_user_ids <> array['40000000-0000-4000-8000-000000000001'::uuid]
    or context.course_mapping_status <> 'exact' or context.group_mapping_status <> 'exact'
    or context.user_mapping_status <> 'exact' or context.quiz_mapping_status <> 'exact' then
    raise exception 'Student own-result context mismatch: %', context;
  end if;

  select * into strict context from public.resolve_moodle_quiz_attempt_context(
    '40000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000002',
    'b6000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000002'
  );
  if context.active_role <> 'teacher' or context.projection_audience <> 'person_level'
    or context.authorized_user_ids <> array['40000000-0000-4000-8000-000000000001'::uuid] then
    raise exception 'Teacher exact-class person scope mismatch: %', context;
  end if;

  select * into strict context from public.resolve_moodle_quiz_attempt_context(
    '40000000-0000-4000-8000-000000000004',
    '50000000-0000-4000-8000-000000000004',
    'b6000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000002'
  );
  if context.active_role <> 'headofdepartment' or context.projection_audience <> 'aggregate'
    or cardinality(context.authorized_user_ids) <> 0 or context.user_mapping_status <> 'exact' then
    raise exception 'HOD aggregate scope mismatch: %', context;
  end if;

  select * into strict context from public.resolve_moodle_quiz_attempt_context(
    '40000000-0000-4000-8000-000000000006',
    '50000000-0000-4000-8000-000000000006',
    'b6000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000002'
  );
  if context.active_role <> 'superadmin' or context.projection_audience <> 'aggregate'
    or cardinality(context.authorized_user_ids) <> 0 then
    raise exception 'Super Admin aggregate scope mismatch: %', context;
  end if;

  begin
    perform * from public.resolve_moodle_quiz_attempt_context(
      '40000000-0000-4000-8000-000000000003',
      '50000000-0000-4000-8000-000000000003',
      'b6000000-0000-4000-8000-000000000001',
      'd1000000-0000-4000-8000-000000000002');
    raise exception 'Registrar received quiz attempt context';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.resolve_moodle_quiz_attempt_context(
      '40000000-0000-4000-8000-000000000005',
      '50000000-0000-4000-8000-000000000005',
      'b6000000-0000-4000-8000-000000000001',
      'd1000000-0000-4000-8000-000000000002');
    raise exception 'Branch Admin received quiz attempt context';
  exception when insufficient_privilege then null;
  end;

  select * into strict freshness from public.list_authorized_moodle_quiz_attempt_freshness(
    '40000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    'ba000000-0000-4000-8000-000000000001',
    'b6000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000002', '2026-07-17T12:10:00Z'
  );
  if freshness.projection_audience <> 'learner' or freshness.freshness_state <> 'fresh'
    or pg_catalog.jsonb_array_length(freshness.sanitized_payload->'learners') <> 1
    or freshness.sanitized_payload->'learners'->0->>'internalUserId'
      <> '40000000-0000-4000-8000-000000000001'
    or freshness.fresh_until <> '2026-07-17T12:15:00Z' then
    raise exception 'Fresh own-learner result mismatch: %', freshness;
  end if;

  select * into strict freshness from public.list_authorized_moodle_quiz_attempt_freshness(
    '40000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000002',
    'ba000000-0000-4000-8000-000000000001',
    'b6000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000002', '2026-07-17T12:10:00Z'
  );
  if freshness.projection_audience <> 'person_level' or freshness.freshness_state <> 'fresh'
    or pg_catalog.jsonb_array_length(freshness.sanitized_payload->'learners') <> 1 then
    raise exception 'Teacher exact-class person result mismatch: %', freshness;
  end if;

  select * into strict freshness from public.list_authorized_moodle_quiz_attempt_freshness(
    '40000000-0000-4000-8000-000000000004',
    '50000000-0000-4000-8000-000000000004',
    'ba000000-0000-4000-8000-000000000001',
    'b6000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000002', '2026-07-17T12:10:00Z'
  );
  if freshness.projection_audience <> 'aggregate' or freshness.freshness_state <> 'fresh'
    or freshness.sanitized_payload->>'learnerCount' <> '1'
    or freshness.sanitized_payload ? 'learners' or freshness.sanitized_payload ? 'score' then
    raise exception 'HOD aggregate-only result mismatch: %', freshness;
  end if;

  select * into strict freshness from public.list_authorized_moodle_quiz_attempt_freshness(
    '40000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000002',
    'ba000000-0000-4000-8000-000000000001',
    'b6000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000002', '2026-07-17T14:30:00Z'
  );
  if freshness.freshness_state <> 'stale_retained' or freshness.latest_outcome <> 'unavailable'
    or freshness.sanitized_payload is null then
    raise exception 'Stale-retained person result mismatch: %', freshness;
  end if;

  select * into strict replay from public.record_moodle_quiz_attempt_observation(
    'phase6h2.fake.quiz.person',
    'ba000000-0000-4000-8000-000000000001',
    'b3000000-0000-4000-8000-000000000001',
    'b6000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000002',
    'bb000000-0000-4000-8000-000000000001',
    'c1000000-0000-4000-8000-000000000001',
    'e5000000-0000-4000-8000-000000000003',
    'e6000000-0000-4000-8000-000000000003',
    'person_level', 'available', person_payload,
    public.digest(pg_catalog.convert_to(person_payload::text, 'UTF8'), 'sha256'),
    '2026-07-17T12:01:00Z', '2026-07-17T12:16:00Z', '2026-07-24T12:01:00Z'
  );
  if replay.replayed is not true then
    raise exception 'Idempotent quiz attempt replay created a duplicate';
  end if;

  begin
    perform * from public.record_moodle_quiz_attempt_observation(
      'phase6h2.fake.quiz.person',
      'ba000000-0000-4000-8000-000000000001',
      'b3000000-0000-4000-8000-000000000001',
      'b6000000-0000-4000-8000-000000000001',
      'd1000000-0000-4000-8000-000000000002',
      'bb000000-0000-4000-8000-000000000001',
      'c1000000-0000-4000-8000-000000000001',
      'e5000000-0000-4000-8000-000000000003',
      'e6000000-0000-4000-8000-000000000003',
      'person_level', 'available', person_payload,
      public.digest(pg_catalog.convert_to(person_payload::text, 'UTF8'), 'sha256'),
      '2026-07-17T12:01:00Z', '2026-07-17T12:16:00Z', '2026-07-25T12:01:00Z');
    raise exception 'Conflicting quiz attempt replay was accepted';
  exception when unique_violation then null;
  end;

  if nile_private.moodle_quiz_attempt_payload_is_safe(
    pg_catalog.jsonb_set(person_payload, '{learners,0}',
      person_payload->'learners'->0 || '{"attemptNumber":21}'::jsonb), 'person_level') then
    raise exception 'Attempt number above 20 was accepted';
  end if;
  if nile_private.moodle_quiz_attempt_payload_is_safe(
    pg_catalog.jsonb_set(person_payload, '{learners,0}',
      person_payload->'learners'->0 || '{"feedback":"forbidden"}'::jsonb), 'person_level') then
    raise exception 'Feedback was accepted in H2';
  end if;
  if nile_private.moodle_quiz_attempt_payload_is_safe(
    '{"internalCourseId":"b3000000-0000-4000-8000-000000000001","internalClassGroupId":"b6000000-0000-4000-8000-000000000001","quizProjectionId":"d1000000-0000-4000-8000-000000000002","providerState":"available","mappingStatus":"exact","learnerCount":1,"attemptedCount":1,"finishedCount":1,"gradedCount":1,"internalUserId":"40000000-0000-4000-8000-000000000001"}'::jsonb,
    'aggregate') then
    raise exception 'Aggregate payload accepted a person identifier';
  end if;

  update public.external_records set sync_state = 'ignored'
  where id = 'd1000000-0000-4000-8000-000000000002';
  select * into strict freshness from public.list_authorized_moodle_quiz_attempt_freshness(
    '40000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    'ba000000-0000-4000-8000-000000000001',
    'b6000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000002', '2026-07-17T12:10:00Z');
  if freshness.quiz_mapping_status <> 'missing'
    or freshness.freshness_state <> 'reconciliation' or freshness.sanitized_payload is not null then
    raise exception 'Missing quiz mapping retained attempt payload: %', freshness;
  end if;
  update public.external_records set sync_state = 'matched'
  where id = 'd1000000-0000-4000-8000-000000000002';

  begin
    update public.moodle_quiz_attempt_observations set outcome = outcome
    where idempotency_key = 'phase6h2.fake.quiz.person';
    raise exception 'Immutable quiz attempt accepted an update';
  exception when object_not_in_prerequisite_state then null;
  end;

  update public.teacher_assignments set status = 'ended', ends_at = pg_catalog.now()
  where id = 'b7000000-0000-4000-8000-000000000001';
  begin
    perform * from public.resolve_moodle_quiz_attempt_context(
      '40000000-0000-4000-8000-000000000002',
      '50000000-0000-4000-8000-000000000002',
      'b6000000-0000-4000-8000-000000000001',
      'd1000000-0000-4000-8000-000000000002');
    raise exception 'Revoked teacher retained exact-class result access';
  exception when insufficient_privilege then null;
  end;
  update public.teacher_assignments set status = 'active', ends_at = null
  where id = 'b7000000-0000-4000-8000-000000000001';

  select * into strict purged from public.purge_moodle_quiz_attempt_observations(
    '2026-07-17T14:30:00Z', 1);
  if purged.deleted_count <> 1 then
    raise exception 'Bounded quiz attempt purge mismatch: %', purged;
  end if;
end;
$$;

rollback;
