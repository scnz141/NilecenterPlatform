-- Nile Learn Phase 6F deterministic fake-only observation fixture.
-- Requires accepted Phase 1, Phase 6A, and Phase 6E fake fixtures.

begin;

insert into public.external_records (
  id, connection_id, entity_type, internal_id, external_id,
  external_parent_id, source_version, source_updated_at, source_hash,
  sync_state, last_seen_at, last_synced_at, metadata
) values (
  'c1000000-0000-4000-8000-000000000001',
  'ba000000-0000-4000-8000-000000000001',
  'class_group',
  'b6000000-0000-4000-8000-000000000001',
  '8101',
  '4201',
  'phase6f-fake-only-v1',
  '2026-07-17T11:00:00Z',
  public.digest('phase6f-group-8101', 'sha256'),
  'synced',
  '2026-07-17T12:00:00Z',
  '2026-07-17T12:00:00Z',
  '{"fixture":"phase6f-fake-only","boundary":"exact-class-group"}'::jsonb
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
  ('c2000000-0000-4000-8000-000000000001', 'ba000000-0000-4000-8000-000000000001', 'enrollment_groups_projection', 'read', 'succeeded', 1, 1, 0, '2026-07-17T09:55:00Z', '2026-07-17T10:00:00Z', '40000000-0000-4000-8000-000000000006', '2026-07-17T09:55:00Z'),
  ('c2000000-0000-4000-8000-000000000002', 'ba000000-0000-4000-8000-000000000001', 'enrollment_groups_projection', 'read', 'succeeded', 1, 1, 0, '2026-07-17T11:55:00Z', '2026-07-17T12:00:00Z', '40000000-0000-4000-8000-000000000006', '2026-07-17T11:55:00Z'),
  ('c2000000-0000-4000-8000-000000000003', 'ba000000-0000-4000-8000-000000000001', 'enrollment_groups_projection', 'read', 'succeeded', 1, 1, 0, '2026-07-17T11:56:00Z', '2026-07-17T12:01:00Z', '40000000-0000-4000-8000-000000000006', '2026-07-17T11:56:00Z'),
  ('c2000000-0000-4000-8000-000000000004', 'ba000000-0000-4000-8000-000000000001', 'enrollment_groups_projection', 'read', 'failed', 1, 0, 1, '2026-07-17T13:55:00Z', '2026-07-17T14:00:00Z', '40000000-0000-4000-8000-000000000006', '2026-07-17T13:55:00Z'),
  ('c2000000-0000-4000-8000-000000000005', 'ba000000-0000-4000-8000-000000000001', 'enrollment_groups_projection', 'read', 'partial', 1, 0, 0, '2026-07-17T14:00:00Z', '2026-07-17T14:05:00Z', '40000000-0000-4000-8000-000000000006', '2026-07-17T14:00:00Z')
on conflict (id) do nothing;

insert into public.sync_run_items (
  id, sync_run_id, external_record_id, external_id, status,
  source_hash, error_class, error_detail, created_at
)
values
  ('c3000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', '8101', 'succeeded', decode(repeat('41', 32), 'hex'), null, null, '2026-07-17T10:00:00Z'),
  ('c3000000-0000-4000-8000-000000000002', 'c2000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001', '8101', 'succeeded', decode(repeat('42', 32), 'hex'), null, null, '2026-07-17T12:00:00Z'),
  ('c3000000-0000-4000-8000-000000000003', 'c2000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000001', '8101', 'succeeded', decode(repeat('43', 32), 'hex'), null, null, '2026-07-17T12:01:00Z'),
  ('c3000000-0000-4000-8000-000000000004', 'c2000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000001', '8101', 'failed', null, 'provider_unavailable', 'Synthetic unavailable outcome', '2026-07-17T14:00:00Z'),
  ('c3000000-0000-4000-8000-000000000005', 'c2000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000001', '8101', 'needs_review', decode(repeat('45', 32), 'hex'), null, null, '2026-07-17T14:05:00Z')
on conflict (id) do nothing;

insert into public.reconciliation_cases (
  id, connection_id, entity_type, internal_id, external_id,
  reason, status, created_at, updated_at
) values (
  'c4000000-0000-4000-8000-000000000001',
  'ba000000-0000-4000-8000-000000000001',
  'enrollment_groups_projection',
  'b6000000-0000-4000-8000-000000000001',
  '8101',
  'provider_membership_drift',
  'open',
  '2026-07-17T14:05:00Z',
  '2026-07-17T14:05:00Z'
)
on conflict (id) do nothing;

select * from public.record_moodle_enrollment_group_observation(
  'phase6f.person.8101.empty',
  'ba000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000001',
  'b6000000-0000-4000-8000-000000000001',
  'bb000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'c2000000-0000-4000-8000-000000000001',
  'c3000000-0000-4000-8000-000000000001',
  'person_level', 'empty',
  '{"internalCourseId":"b3000000-0000-4000-8000-000000000001","internalClassGroupId":"b6000000-0000-4000-8000-000000000001","providerState":"empty","mappingStatus":"exact","learners":[]}'::jsonb,
  public.digest(pg_catalog.convert_to('{"internalCourseId":"b3000000-0000-4000-8000-000000000001","internalClassGroupId":"b6000000-0000-4000-8000-000000000001","providerState":"empty","mappingStatus":"exact","learners":[]}'::jsonb::text, 'UTF8'), 'sha256'),
  '2026-07-17T10:00:00Z', '2026-07-17T10:30:00Z', '2026-07-18T10:00:00Z'
);

select * from public.record_moodle_enrollment_group_observation(
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

select * from public.record_moodle_enrollment_group_observation(
  'phase6f.aggregate.8101.available',
  'ba000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000001',
  'b6000000-0000-4000-8000-000000000001',
  'bb000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'c2000000-0000-4000-8000-000000000003',
  'c3000000-0000-4000-8000-000000000003',
  'aggregate', 'available',
  '{"internalCourseId":"b3000000-0000-4000-8000-000000000001","internalClassGroupId":"b6000000-0000-4000-8000-000000000001","providerState":"available","mappingStatus":"exact","learnerCount":1,"mappedLearnerCount":1,"unmappedLearnerCount":0}'::jsonb,
  public.digest(pg_catalog.convert_to('{"internalCourseId":"b3000000-0000-4000-8000-000000000001","internalClassGroupId":"b6000000-0000-4000-8000-000000000001","providerState":"available","mappingStatus":"exact","learnerCount":1,"mappedLearnerCount":1,"unmappedLearnerCount":0}'::jsonb::text, 'UTF8'), 'sha256'),
  '2026-07-17T12:01:00Z', '2026-07-17T13:01:00Z', '2026-07-20T12:01:00Z'
);

select * from public.record_moodle_enrollment_group_observation(
  'phase6f.person.8101.unavailable',
  'ba000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000001',
  'b6000000-0000-4000-8000-000000000001',
  'bb000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'c2000000-0000-4000-8000-000000000004',
  'c3000000-0000-4000-8000-000000000004',
  'person_level', 'unavailable', null, null,
  '2026-07-17T14:00:00Z', null, null
);

select * from public.record_moodle_enrollment_group_observation(
  'phase6f.aggregate.8101.reconciliation',
  'ba000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000001',
  'b6000000-0000-4000-8000-000000000001',
  'bb000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'c2000000-0000-4000-8000-000000000005',
  'c3000000-0000-4000-8000-000000000005',
  'aggregate', 'reconciliation', null, null,
  '2026-07-17T14:05:00Z', null, null,
  'c4000000-0000-4000-8000-000000000001',
  'provider_membership_drift'
);

commit;
