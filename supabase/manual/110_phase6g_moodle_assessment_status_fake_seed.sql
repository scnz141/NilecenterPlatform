-- Nile Learn Phase 6G deterministic fake-only assessment status fixture.
-- Requires accepted Phase 1, Phase 6A, Phase 6E, and Phase 6F fixtures.

begin;

insert into public.external_records (
  id, connection_id, entity_type, internal_id, external_id,
  external_parent_id, source_version, source_updated_at, source_hash,
  sync_state, last_seen_at, last_synced_at, metadata
)
values
  (
    'd1000000-0000-4000-8000-000000000001',
    'ba000000-0000-4000-8000-000000000001',
    'assignment', null, 'fake-assignment-1', '4201', 'phase6g-fake-only-v1',
    '2026-07-17T11:50:00Z', public.digest('phase6g-assignment-1', 'sha256'),
    'matched', '2026-07-17T12:00:00Z', null, '{}'::jsonb
  ),
  (
    'd1000000-0000-4000-8000-000000000002',
    'ba000000-0000-4000-8000-000000000001',
    'quiz', null, 'fake-quiz-1', '4201', 'phase6g-fake-only-v1',
    '2026-07-17T11:51:00Z', public.digest('phase6g-quiz-1', 'sha256'),
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
  ('d2000000-0000-4000-8000-000000000001', 'ba000000-0000-4000-8000-000000000001', 'assessment_status_projection', 'read', 'failed', 1, 0, 1, '2026-06-01T08:55:00Z', '2026-06-01T09:00:00Z', '40000000-0000-4000-8000-000000000006', '2026-06-01T08:55:00Z'),
  ('d2000000-0000-4000-8000-000000000002', 'ba000000-0000-4000-8000-000000000001', 'assessment_status_projection', 'read', 'partial', 1, 0, 0, '2026-06-02T08:55:00Z', '2026-06-02T09:00:00Z', '40000000-0000-4000-8000-000000000006', '2026-06-02T08:55:00Z'),
  ('d2000000-0000-4000-8000-000000000003', 'ba000000-0000-4000-8000-000000000001', 'assessment_status_projection', 'read', 'succeeded', 1, 1, 0, '2026-07-17T10:55:00Z', '2026-07-17T11:00:00Z', '40000000-0000-4000-8000-000000000006', '2026-07-17T10:55:00Z'),
  ('d2000000-0000-4000-8000-000000000004', 'ba000000-0000-4000-8000-000000000001', 'assessment_status_projection', 'read', 'succeeded', 2, 2, 0, '2026-07-17T11:55:00Z', '2026-07-17T12:00:00Z', '40000000-0000-4000-8000-000000000006', '2026-07-17T11:55:00Z'),
  ('d2000000-0000-4000-8000-000000000005', 'ba000000-0000-4000-8000-000000000001', 'assessment_status_projection', 'read', 'failed', 1, 0, 1, '2026-07-17T13:55:00Z', '2026-07-17T14:00:00Z', '40000000-0000-4000-8000-000000000006', '2026-07-17T13:55:00Z'),
  ('d2000000-0000-4000-8000-000000000006', 'ba000000-0000-4000-8000-000000000001', 'assessment_status_projection', 'read', 'partial', 1, 0, 0, '2026-07-17T14:00:00Z', '2026-07-17T14:05:00Z', '40000000-0000-4000-8000-000000000006', '2026-07-17T14:00:00Z')
on conflict (id) do nothing;

insert into public.sync_run_items (
  id, sync_run_id, external_record_id, external_id, status,
  source_hash, error_class, error_detail, created_at
)
values
  ('d3000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', '8101', 'failed', null, 'provider_unavailable', 'Synthetic unavailable fixture', '2026-06-01T09:00:00Z'),
  ('d3000000-0000-4000-8000-000000000002', 'd2000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001', '8101', 'needs_review', decode(repeat('51', 32), 'hex'), null, null, '2026-06-02T09:00:00Z'),
  ('d3000000-0000-4000-8000-000000000003', 'd2000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000001', '8101', 'succeeded', decode(repeat('52', 32), 'hex'), null, null, '2026-07-17T11:00:00Z'),
  ('d3000000-0000-4000-8000-000000000004', 'd2000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000001', '8101', 'succeeded', decode(repeat('53', 32), 'hex'), null, null, '2026-07-17T12:00:00Z'),
  ('d3000000-0000-4000-8000-000000000005', 'd2000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000001', '8101', 'failed', null, 'provider_unavailable', 'Synthetic unavailable fixture', '2026-07-17T14:00:00Z'),
  ('d3000000-0000-4000-8000-000000000006', 'd2000000-0000-4000-8000-000000000006', 'c1000000-0000-4000-8000-000000000001', '8101', 'needs_review', decode(repeat('54', 32), 'hex'), null, null, '2026-07-17T14:05:00Z')
on conflict (id) do nothing;

insert into public.reconciliation_cases (
  id, connection_id, entity_type, internal_id, external_id,
  reason, status, created_at, updated_at
) values (
  'd4000000-0000-4000-8000-000000000001',
  'ba000000-0000-4000-8000-000000000001',
  'assessment_status_projection',
  'b6000000-0000-4000-8000-000000000001',
  '8101',
  'provider_schedule_drift',
  'open',
  '2026-06-02T09:00:00Z',
  '2026-06-02T09:00:00Z'
)
on conflict (id) do nothing;

select * from public.record_moodle_assessment_status_observation(
  'phase6g.class.8101.old-unavailable',
  'ba000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000001',
  'b6000000-0000-4000-8000-000000000001',
  'bb000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'd2000000-0000-4000-8000-000000000001',
  'd3000000-0000-4000-8000-000000000001',
  'unavailable', null, null,
  '2026-06-01T09:00:00Z', null, null
);

select * from public.record_moodle_assessment_status_observation(
  'phase6g.class.8101.old-reconciliation',
  'ba000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000001',
  'b6000000-0000-4000-8000-000000000001',
  'bb000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'd2000000-0000-4000-8000-000000000002',
  'd3000000-0000-4000-8000-000000000002',
  'reconciliation', null, null,
  '2026-06-02T09:00:00Z', null, null,
  'd4000000-0000-4000-8000-000000000001',
  'provider_schedule_drift'
);

with fixture(payload) as (values (
  '{"internalCourseId":"b3000000-0000-4000-8000-000000000001","internalClassGroupId":"b6000000-0000-4000-8000-000000000001","providerState":"empty","mappingStatus":"exact","items":[]}'::jsonb
))
select result.*
from fixture
cross join lateral public.record_moodle_assessment_status_observation(
  'phase6g.class.8101.empty',
  'ba000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000001',
  'b6000000-0000-4000-8000-000000000001',
  'bb000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'd2000000-0000-4000-8000-000000000003',
  'd3000000-0000-4000-8000-000000000003',
  'empty', fixture.payload,
  public.digest(pg_catalog.convert_to(fixture.payload::text, 'UTF8'), 'sha256'),
  '2026-07-17T11:00:00Z', '2026-07-17T11:15:00Z', '2026-07-24T11:00:00Z'
) as result;

with fixture(payload) as (values (
  '{"internalCourseId":"b3000000-0000-4000-8000-000000000001","internalClassGroupId":"b6000000-0000-4000-8000-000000000001","providerState":"available","mappingStatus":"exact","items":[{"projectionId":"d1000000-0000-4000-8000-000000000001","kind":"assignment","title":"Synthetic writing task","visibility":"visible","opensAt":"2026-07-17T12:00:00Z","dueAt":"2026-07-20T12:00:00Z","cutoffAt":"2026-07-21T12:00:00Z","acceptsSubmissions":true},{"projectionId":"d1000000-0000-4000-8000-000000000002","kind":"quiz","title":"Synthetic unit quiz","visibility":"visible","opensAt":"2026-07-18T08:00:00Z","closesAt":"2026-07-18T09:00:00Z","acceptsSubmissions":false}]}'::jsonb
))
select result.*
from fixture
cross join lateral public.record_moodle_assessment_status_observation(
  'phase6g.class.8101.available',
  'ba000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000001',
  'b6000000-0000-4000-8000-000000000001',
  'bb000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'd2000000-0000-4000-8000-000000000004',
  'd3000000-0000-4000-8000-000000000004',
  'available', fixture.payload,
  public.digest(pg_catalog.convert_to(fixture.payload::text, 'UTF8'), 'sha256'),
  '2026-07-17T12:00:00Z', '2026-07-17T12:15:00Z', '2026-07-24T12:00:00Z'
) as result;

select * from public.record_moodle_assessment_status_observation(
  'phase6g.class.8101.unavailable',
  'ba000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000001',
  'b6000000-0000-4000-8000-000000000001',
  'bb000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'd2000000-0000-4000-8000-000000000005',
  'd3000000-0000-4000-8000-000000000005',
  'unavailable', null, null,
  '2026-07-17T14:00:00Z', null, null
);

select * from public.record_moodle_assessment_status_observation(
  'phase6g.class.8101.reconciliation',
  'ba000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000001',
  'b6000000-0000-4000-8000-000000000001',
  'bb000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
  'd2000000-0000-4000-8000-000000000006',
  'd3000000-0000-4000-8000-000000000006',
  'reconciliation', null, null,
  '2026-07-17T14:05:00Z', null, null,
  'd4000000-0000-4000-8000-000000000001',
  'provider_schedule_drift'
);

commit;
