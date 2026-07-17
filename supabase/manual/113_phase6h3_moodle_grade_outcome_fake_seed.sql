-- Nile Learn Phase 6H3 deterministic fake-only grade outcome fixture.
-- Requires accepted Phase 1, Phase 6A, Phase 6E, Phase 6F, and Phase 6G fixtures.

begin;

insert into public.external_records (
  id, connection_id, entity_type, internal_id, external_id,
  external_parent_id, source_version, source_updated_at, source_hash,
  sync_state, last_seen_at, last_synced_at, metadata
)
values (
  'd3000000-0000-4000-8000-000000000001',
  'ba000000-0000-4000-8000-000000000001',
  'grade_item', null, 'fake-grade-item-1', '4201',
  'phase6h3-fake-only-v1', '2026-07-17T11:58:00Z',
  public.digest('phase6h3-grade-item-1', 'sha256'),
  'matched', '2026-07-17T12:00:00Z', null, '{}'::jsonb
)
on conflict (id) do update set
  connection_id = excluded.connection_id,
  entity_type = excluded.entity_type,
  internal_id = excluded.internal_id,
  external_id = excluded.external_id,
  external_parent_id = excluded.external_parent_id,
  source_version = excluded.source_version,
  source_updated_at = excluded.source_updated_at,
  source_hash = excluded.source_hash,
  sync_state = excluded.sync_state,
  last_seen_at = excluded.last_seen_at,
  last_synced_at = excluded.last_synced_at,
  last_error = null,
  metadata = excluded.metadata;

insert into public.sync_runs (
  id, connection_id, entity_type, direction, status,
  discovered_count, succeeded_count, failed_count,
  started_at, finished_at, created_by, created_at
)
values
  ('f2000000-0000-4000-8000-000000000001', 'ba000000-0000-4000-8000-000000000001', 'grade_outcomes_projection', 'read', 'failed', 1, 0, 1, '2026-06-01T08:55:00Z', '2026-06-01T09:00:00Z', '40000000-0000-4000-8000-000000000006', '2026-06-01T08:55:00Z'),
  ('f2000000-0000-4000-8000-000000000002', 'ba000000-0000-4000-8000-000000000001', 'grade_outcomes_projection', 'read', 'succeeded', 1, 1, 0, '2026-07-17T11:55:00Z', '2026-07-17T12:00:00Z', '40000000-0000-4000-8000-000000000006', '2026-07-17T11:55:00Z'),
  ('f2000000-0000-4000-8000-000000000003', 'ba000000-0000-4000-8000-000000000001', 'grade_outcomes_projection', 'read', 'succeeded', 1, 1, 0, '2026-07-17T11:56:00Z', '2026-07-17T12:01:00Z', '40000000-0000-4000-8000-000000000006', '2026-07-17T11:56:00Z'),
  ('f2000000-0000-4000-8000-000000000004', 'ba000000-0000-4000-8000-000000000001', 'grade_outcomes_projection', 'read', 'succeeded', 1, 1, 0, '2026-07-17T11:57:00Z', '2026-07-17T12:02:00Z', '40000000-0000-4000-8000-000000000006', '2026-07-17T11:57:00Z'),
  ('f2000000-0000-4000-8000-000000000005', 'ba000000-0000-4000-8000-000000000001', 'grade_outcomes_projection', 'read', 'failed', 1, 0, 1, '2026-07-17T13:55:00Z', '2026-07-17T14:00:00Z', '40000000-0000-4000-8000-000000000006', '2026-07-17T13:55:00Z'),
  ('f2000000-0000-4000-8000-000000000006', 'ba000000-0000-4000-8000-000000000001', 'grade_outcomes_projection', 'read', 'partial', 1, 0, 0, '2026-07-17T14:00:00Z', '2026-07-17T14:05:00Z', '40000000-0000-4000-8000-000000000006', '2026-07-17T14:00:00Z')
on conflict (id) do nothing;

insert into public.sync_run_items (
  id, sync_run_id, external_record_id, external_id, status,
  source_hash, error_class, error_detail, created_at
)
values
  ('f3000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000001', 'fake-grade-item-1', 'failed', null, 'provider_unavailable', 'Synthetic unavailable fixture', '2026-06-01T09:00:00Z'),
  ('f3000000-0000-4000-8000-000000000002', 'f2000000-0000-4000-8000-000000000002', 'd3000000-0000-4000-8000-000000000001', 'fake-grade-item-1', 'succeeded', decode(repeat('61', 32), 'hex'), null, null, '2026-07-17T12:00:00Z'),
  ('f3000000-0000-4000-8000-000000000003', 'f2000000-0000-4000-8000-000000000003', 'd3000000-0000-4000-8000-000000000001', 'fake-grade-item-1', 'succeeded', decode(repeat('62', 32), 'hex'), null, null, '2026-07-17T12:01:00Z'),
  ('f3000000-0000-4000-8000-000000000004', 'f2000000-0000-4000-8000-000000000004', 'd3000000-0000-4000-8000-000000000001', 'fake-grade-item-1', 'succeeded', decode(repeat('63', 32), 'hex'), null, null, '2026-07-17T12:02:00Z'),
  ('f3000000-0000-4000-8000-000000000005', 'f2000000-0000-4000-8000-000000000005', 'd3000000-0000-4000-8000-000000000001', 'fake-grade-item-1', 'failed', null, 'provider_unavailable', 'Synthetic unavailable fixture', '2026-07-17T14:00:00Z'),
  ('f3000000-0000-4000-8000-000000000006', 'f2000000-0000-4000-8000-000000000006', 'd3000000-0000-4000-8000-000000000001', 'fake-grade-item-1', 'needs_review', decode(repeat('64', 32), 'hex'), null, null, '2026-07-17T14:05:00Z')
on conflict (id) do nothing;

insert into public.reconciliation_cases (
  id, connection_id, entity_type, internal_id, external_id,
  reason, status, created_at, updated_at
) values (
  'f4000000-0000-4000-8000-000000000001',
  'ba000000-0000-4000-8000-000000000001',
  'grade_outcomes_projection',
  'd3000000-0000-4000-8000-000000000001',
  'fake-grade-item-1',
  'provider_result_drift',
  'open',
  '2026-07-17T14:05:00Z',
  '2026-07-17T14:05:00Z'
)
on conflict (id) do nothing;

select * from public.record_moodle_grade_outcome_observation(
  'phase6h3.fake.grade.old-unavailable',
  'ba000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000001',
  'b6000000-0000-4000-8000-000000000001',
  'd3000000-0000-4000-8000-000000000001',
  'bb000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'f2000000-0000-4000-8000-000000000001',
  'f3000000-0000-4000-8000-000000000001',
  'person_level', 'unavailable', null, null,
  '2026-06-01T09:00:00Z', null, null
);

with fixture(payload) as (values (
  '{"internalCourseId":"b3000000-0000-4000-8000-000000000001","internalClassGroupId":"b6000000-0000-4000-8000-000000000001","gradeItemProjectionId":"d3000000-0000-4000-8000-000000000001","providerState":"available","mappingStatus":"exact","learners":[{"internalUserId":"40000000-0000-4000-8000-000000000001","internalEnrollmentId":"b8000000-0000-4000-8000-000000000001","internalMembershipId":"b9000000-0000-4000-8000-000000000001","gradingState":"released","score":87.5,"maximumScore":100,"gradedAt":"2026-07-17T10:45:00Z","releasedAt":"2026-07-17T11:00:00Z","feedback":"Clear and accurate work."}]}'::jsonb
))
select result.* from fixture cross join lateral public.record_moodle_grade_outcome_observation(
  'phase6h3.fake.grade.learner',
  'ba000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000001',
  'b6000000-0000-4000-8000-000000000001',
  'd3000000-0000-4000-8000-000000000001',
  'bb000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'f2000000-0000-4000-8000-000000000002',
  'f3000000-0000-4000-8000-000000000002',
  'learner', 'available', fixture.payload,
  public.digest(pg_catalog.convert_to(fixture.payload::text, 'UTF8'), 'sha256'),
  '2026-07-17T12:00:00Z', '2026-07-17T12:15:00Z', '2026-07-24T12:00:00Z'
) as result;

with fixture(payload) as (values (
  '{"internalCourseId":"b3000000-0000-4000-8000-000000000001","internalClassGroupId":"b6000000-0000-4000-8000-000000000001","gradeItemProjectionId":"d3000000-0000-4000-8000-000000000001","providerState":"available","mappingStatus":"exact","learners":[{"internalUserId":"40000000-0000-4000-8000-000000000001","internalEnrollmentId":"b8000000-0000-4000-8000-000000000001","internalMembershipId":"b9000000-0000-4000-8000-000000000001","gradingState":"released","score":87.5,"maximumScore":100,"gradedAt":"2026-07-17T10:45:00Z","releasedAt":"2026-07-17T11:00:00Z","feedback":"Clear and accurate work."}]}'::jsonb
))
select result.* from fixture cross join lateral public.record_moodle_grade_outcome_observation(
  'phase6h3.fake.grade.person',
  'ba000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000001',
  'b6000000-0000-4000-8000-000000000001',
  'd3000000-0000-4000-8000-000000000001',
  'bb000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'f2000000-0000-4000-8000-000000000003',
  'f3000000-0000-4000-8000-000000000003',
  'person_level', 'available', fixture.payload,
  public.digest(pg_catalog.convert_to(fixture.payload::text, 'UTF8'), 'sha256'),
  '2026-07-17T12:01:00Z', '2026-07-17T12:16:00Z', '2026-07-24T12:01:00Z'
) as result;

with fixture(payload) as (values (
  '{"internalCourseId":"b3000000-0000-4000-8000-000000000001","internalClassGroupId":"b6000000-0000-4000-8000-000000000001","gradeItemProjectionId":"d3000000-0000-4000-8000-000000000001","providerState":"available","mappingStatus":"exact","learnerCount":1,"gradedCount":1,"releasedCount":1,"feedbackReleasedCount":1}'::jsonb
))
select result.* from fixture cross join lateral public.record_moodle_grade_outcome_observation(
  'phase6h3.fake.grade.aggregate',
  'ba000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000001',
  'b6000000-0000-4000-8000-000000000001',
  'd3000000-0000-4000-8000-000000000001',
  'bb000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'f2000000-0000-4000-8000-000000000004',
  'f3000000-0000-4000-8000-000000000004',
  'aggregate', 'available', fixture.payload,
  public.digest(pg_catalog.convert_to(fixture.payload::text, 'UTF8'), 'sha256'),
  '2026-07-17T12:02:00Z', '2026-07-17T12:17:00Z', '2026-07-24T12:02:00Z'
) as result;

select * from public.record_moodle_grade_outcome_observation(
  'phase6h3.fake.grade.unavailable',
  'ba000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000001',
  'b6000000-0000-4000-8000-000000000001',
  'd3000000-0000-4000-8000-000000000001',
  'bb000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'f2000000-0000-4000-8000-000000000005',
  'f3000000-0000-4000-8000-000000000005',
  'person_level', 'unavailable', null, null,
  '2026-07-17T14:00:00Z', null, null
);

select * from public.record_moodle_grade_outcome_observation(
  'phase6h3.fake.grade.reconciliation',
  'ba000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000001',
  'b6000000-0000-4000-8000-000000000001',
  'd3000000-0000-4000-8000-000000000001',
  'bb000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'f2000000-0000-4000-8000-000000000006',
  'f3000000-0000-4000-8000-000000000006',
  'aggregate', 'reconciliation', null, null,
  '2026-07-17T14:05:00Z', null, null,
  'f4000000-0000-4000-8000-000000000001', 'provider_result_drift'
);

commit;
