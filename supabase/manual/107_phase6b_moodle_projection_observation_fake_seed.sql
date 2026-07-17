-- Nile Learn Phase 6B deterministic fake-only observation fixture.
-- Requires the Phase 1 and Phase 6A fake fixtures on a disposable database.

begin;

insert into public.sync_runs (
  id,
  connection_id,
  entity_type,
  direction,
  status,
  discovered_count,
  succeeded_count,
  failed_count,
  started_at,
  finished_at,
  created_by,
  created_at
)
values
  ('bc000000-0000-4000-8000-000000000001', 'ba000000-0000-4000-8000-000000000001', 'course_content', 'read', 'succeeded', 1, 1, 0, '2026-07-16T11:55:00Z', '2026-07-16T12:00:00Z', '40000000-0000-4000-8000-000000000006', '2026-07-16T11:55:00Z'),
  ('bc000000-0000-4000-8000-000000000002', 'ba000000-0000-4000-8000-000000000001', 'course_content', 'read', 'failed', 1, 0, 1, '2026-07-16T13:55:00Z', '2026-07-16T14:00:00Z', '40000000-0000-4000-8000-000000000006', '2026-07-16T13:55:00Z'),
  ('bc000000-0000-4000-8000-000000000003', 'ba000000-0000-4000-8000-000000000001', 'course_content', 'read', 'succeeded', 1, 1, 0, '2026-07-16T13:55:00Z', '2026-07-16T14:00:00Z', '40000000-0000-4000-8000-000000000006', '2026-07-16T13:55:00Z'),
  ('bc000000-0000-4000-8000-000000000004', 'ba000000-0000-4000-8000-000000000001', 'course_content', 'read', 'failed', 1, 0, 1, '2026-07-16T13:56:00Z', '2026-07-16T14:01:00Z', '40000000-0000-4000-8000-000000000006', '2026-07-16T13:56:00Z'),
  ('bc000000-0000-4000-8000-000000000005', 'ba000000-0000-4000-8000-000000000001', 'course_content', 'read', 'partial', 1, 0, 0, '2026-07-16T14:05:00Z', '2026-07-16T14:10:00Z', '40000000-0000-4000-8000-000000000006', '2026-07-16T14:05:00Z'),
  ('bc000000-0000-4000-8000-000000000006', 'ba000000-0000-4000-8000-000000000001', 'course', 'read', 'succeeded', 1, 1, 0, '2026-07-16T14:15:00Z', '2026-07-16T14:20:00Z', '40000000-0000-4000-8000-000000000006', '2026-07-16T14:15:00Z')
on conflict (id) do nothing;

insert into public.sync_run_items (
  id,
  sync_run_id,
  external_record_id,
  external_id,
  status,
  source_hash,
  error_class,
  error_detail,
  created_at
)
values
  ('bd000000-0000-4000-8000-000000000001', 'bc000000-0000-4000-8000-000000000001', 'bb000000-0000-4000-8000-000000000001', '4201', 'succeeded', decode(repeat('31', 32), 'hex'), null, null, '2026-07-16T12:00:00Z'),
  ('bd000000-0000-4000-8000-000000000002', 'bc000000-0000-4000-8000-000000000002', 'bb000000-0000-4000-8000-000000000001', '4201', 'failed', null, 'provider_unavailable', 'Synthetic unavailable outcome', '2026-07-16T14:00:00Z'),
  ('bd000000-0000-4000-8000-000000000003', 'bc000000-0000-4000-8000-000000000003', 'bb000000-0000-4000-8000-000000000002', '4202', 'succeeded', decode(repeat('32', 32), 'hex'), null, null, '2026-07-16T14:00:00Z'),
  ('bd000000-0000-4000-8000-000000000004', 'bc000000-0000-4000-8000-000000000004', 'bb000000-0000-4000-8000-000000000003', '4203', 'failed', null, 'provider_unavailable', 'Synthetic unavailable outcome', '2026-07-16T14:01:00Z'),
  ('bd000000-0000-4000-8000-000000000005', 'bc000000-0000-4000-8000-000000000005', 'bb000000-0000-4000-8000-000000000003', '4203', 'needs_review', decode(repeat('33', 32), 'hex'), null, null, '2026-07-16T14:10:00Z'),
  ('bd000000-0000-4000-8000-000000000006', 'bc000000-0000-4000-8000-000000000006', 'bb000000-0000-4000-8000-000000000001', '4201', 'succeeded', decode(repeat('34', 32), 'hex'), null, null, '2026-07-16T14:20:00Z')
on conflict (id) do nothing;

insert into public.reconciliation_cases (
  id,
  connection_id,
  entity_type,
  internal_id,
  external_id,
  reason,
  status,
  created_at,
  updated_at
)
values (
  'be000000-0000-4000-8000-000000000001',
  'ba000000-0000-4000-8000-000000000001',
  'course_content',
  'b3000000-0000-4000-8000-000000000003',
  '4203',
  'ambiguous_mapping',
  'open',
  '2026-07-16T14:10:00Z',
  '2026-07-16T14:10:00Z'
)
on conflict (id) do nothing;

select * from public.record_moodle_projection_observation(
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

select * from public.record_moodle_projection_observation(
  'phase6b.course-content.4201.unavailable',
  'ba000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000001',
  'bb000000-0000-4000-8000-000000000001',
  'bc000000-0000-4000-8000-000000000002',
  'bd000000-0000-4000-8000-000000000002',
  'course_content',
  'unavailable', null, null,
  '2026-07-16T14:00:00Z', null, null
);

select * from public.record_moodle_projection_observation(
  'phase6b.course-content.4202.empty',
  'ba000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000002',
  'bb000000-0000-4000-8000-000000000002',
  'bc000000-0000-4000-8000-000000000003',
  'bd000000-0000-4000-8000-000000000003',
  'course_content',
  'empty',
  '[]'::jsonb,
  digest(convert_to('[]'::jsonb::text, 'UTF8'), 'sha256'),
  '2026-07-16T14:00:00Z',
  '2026-07-16T16:00:00Z',
  '2026-07-18T14:00:00Z'
);

select * from public.record_moodle_projection_observation(
  'phase6b.course-content.4203.unavailable',
  'ba000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000003',
  'bb000000-0000-4000-8000-000000000003',
  'bc000000-0000-4000-8000-000000000004',
  'bd000000-0000-4000-8000-000000000004',
  'course_content',
  'unavailable', null, null,
  '2026-07-16T14:01:00Z', null, null
);

select * from public.record_moodle_projection_observation(
  'phase6b.course-content.4203.reconciliation',
  'ba000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000003',
  'bb000000-0000-4000-8000-000000000003',
  'bc000000-0000-4000-8000-000000000005',
  'bd000000-0000-4000-8000-000000000005',
  'course_content',
  'reconciliation', null, null,
  '2026-07-16T14:10:00Z', null, null,
  'be000000-0000-4000-8000-000000000001',
  'ambiguous_mapping'
);

select * from public.record_moodle_projection_observation(
  'phase6b.course-catalog.4201.success',
  'ba000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000001',
  'bb000000-0000-4000-8000-000000000001',
  'bc000000-0000-4000-8000-000000000006',
  'bd000000-0000-4000-8000-000000000006',
  'course_catalog',
  'available',
  '[{"sourceId":"4201","title":"Synthetic Arabic Course","shortTitle":"Arabic 1","visible":true}]'::jsonb,
  digest(convert_to('[{"sourceId":"4201","title":"Synthetic Arabic Course","shortTitle":"Arabic 1","visible":true}]'::jsonb::text, 'UTF8'), 'sha256'),
  '2026-07-16T14:20:00Z',
  '2026-07-16T15:20:00Z',
  '2026-07-17T14:20:00Z'
);

commit;
