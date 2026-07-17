-- Nile Learn Phase 6A deterministic fake-only authority fixture.
--
-- Requires the accepted Phase 1 local fake seed. All identities, organizations,
-- provider rows, and timestamps below are synthetic and contain no credentials.

begin;

insert into public.programs (
  id,
  department_id,
  code,
  title,
  language,
  status
)
values
  (
    'b1000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    'arabic-quran',
    'Synthetic Arabic and Quran Program',
    'en',
    'active'
  ),
  (
    'b1000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000002',
    'foundations',
    'Synthetic Foundations Program',
    'en',
    'active'
  )
on conflict (id) do update
set
  department_id = excluded.department_id,
  code = excluded.code,
  title = excluded.title,
  language = excluded.language,
  status = excluded.status;

insert into public.course_levels (
  id,
  program_id,
  code,
  title,
  sort_order,
  status
)
values
  (
    'b2000000-0000-4000-8000-000000000001',
    'b1000000-0000-4000-8000-000000000001',
    'level-1',
    'Synthetic Level 1',
    1,
    'active'
  ),
  (
    'b2000000-0000-4000-8000-000000000002',
    'b1000000-0000-4000-8000-000000000002',
    'foundation-1',
    'Synthetic Foundation Level 1',
    1,
    'active'
  )
on conflict (id) do update
set
  program_id = excluded.program_id,
  code = excluded.code,
  title = excluded.title,
  sort_order = excluded.sort_order,
  status = excluded.status;

insert into public.course_templates (
  id,
  program_id,
  level_id,
  code,
  slug,
  title,
  description,
  status
)
values
  (
    'b3000000-0000-4000-8000-000000000001',
    'b1000000-0000-4000-8000-000000000001',
    'b2000000-0000-4000-8000-000000000001',
    'arabic-1',
    'phase6a-synthetic-arabic-1',
    'Synthetic Arabic Course',
    'Fake Phase 6A authority fixture',
    'active'
  ),
  (
    'b3000000-0000-4000-8000-000000000002',
    'b1000000-0000-4000-8000-000000000001',
    'b2000000-0000-4000-8000-000000000001',
    'quran-1',
    'phase6a-synthetic-quran-1',
    'Synthetic Quran Course',
    'Fake Phase 6A HOD scope fixture',
    'active'
  ),
  (
    'b3000000-0000-4000-8000-000000000003',
    'b1000000-0000-4000-8000-000000000002',
    'b2000000-0000-4000-8000-000000000002',
    'foundation-1',
    'phase6a-synthetic-foundation-1',
    'Synthetic Foundation Course',
    'Fake Phase 6A cross-department fixture',
    'active'
  )
on conflict (id) do update
set
  program_id = excluded.program_id,
  level_id = excluded.level_id,
  code = excluded.code,
  slug = excluded.slug,
  title = excluded.title,
  description = excluded.description,
  status = excluded.status;

insert into public.student_profiles (
  id,
  user_id,
  home_branch_id,
  status
)
values (
  'b4000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'active'
)
on conflict (id) do update
set
  user_id = excluded.user_id,
  home_branch_id = excluded.home_branch_id,
  status = excluded.status;

insert into public.course_runs (
  id,
  course_template_id,
  branch_id,
  code,
  term,
  starts_on,
  ends_on,
  status
)
values
  (
    'b5000000-0000-4000-8000-000000000001',
    'b3000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'phase6a-arabic-2026',
    'Synthetic 2026',
    '2026-01-01',
    '2026-12-31',
    'active'
  ),
  (
    'b5000000-0000-4000-8000-000000000002',
    'b3000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000001',
    'phase6a-quran-2026',
    'Synthetic 2026',
    '2026-01-01',
    '2026-12-31',
    'active'
  )
on conflict (id) do update
set
  course_template_id = excluded.course_template_id,
  branch_id = excluded.branch_id,
  code = excluded.code,
  term = excluded.term,
  starts_on = excluded.starts_on,
  ends_on = excluded.ends_on,
  status = excluded.status;

insert into public.class_groups (
  id,
  course_run_id,
  code,
  name,
  capacity,
  status
)
values (
  'b6000000-0000-4000-8000-000000000001',
  'b5000000-0000-4000-8000-000000000001',
  'phase6a-group-a',
  'Synthetic Group A',
  12,
  'active'
)
on conflict (id) do update
set
  course_run_id = excluded.course_run_id,
  code = excluded.code,
  name = excluded.name,
  capacity = excluded.capacity,
  status = excluded.status;

insert into public.teacher_assignments (
  id,
  class_group_id,
  teacher_profile_id,
  assignment_type,
  starts_at,
  ends_at,
  status
)
values (
  'b7000000-0000-4000-8000-000000000001',
  'b6000000-0000-4000-8000-000000000001',
  '80000000-0000-4000-8000-000000000002',
  'primary',
  '2026-01-01T00:00:00Z',
  null,
  'active'
)
on conflict (id) do update
set
  class_group_id = excluded.class_group_id,
  teacher_profile_id = excluded.teacher_profile_id,
  assignment_type = excluded.assignment_type,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  status = excluded.status;

insert into public.enrollments (
  id,
  student_profile_id,
  course_run_id,
  starts_at,
  ends_at,
  status,
  source
)
values (
  'b8000000-0000-4000-8000-000000000001',
  'b4000000-0000-4000-8000-000000000001',
  'b5000000-0000-4000-8000-000000000001',
  '2026-01-01T00:00:00Z',
  null,
  'active',
  'nile_learn'
)
on conflict (id) do update
set
  student_profile_id = excluded.student_profile_id,
  course_run_id = excluded.course_run_id,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  status = excluded.status,
  source = excluded.source;

insert into public.class_memberships (
  id,
  enrollment_id,
  course_run_id,
  class_group_id,
  starts_at,
  ends_at,
  status
)
values (
  'b9000000-0000-4000-8000-000000000001',
  'b8000000-0000-4000-8000-000000000001',
  'b5000000-0000-4000-8000-000000000001',
  'b6000000-0000-4000-8000-000000000001',
  '2026-01-01T00:00:00Z',
  null,
  'active'
)
on conflict (id) do update
set
  enrollment_id = excluded.enrollment_id,
  course_run_id = excluded.course_run_id,
  class_group_id = excluded.class_group_id,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  status = excluded.status;

insert into public.integration_connections (
  id,
  provider,
  label,
  environment,
  mode,
  status,
  capabilities,
  last_verified_at,
  verification_evidence_hash,
  created_by,
  updated_by
)
values (
  'ba000000-0000-4000-8000-000000000001',
  'moodle',
  'phase6a-synthetic-read-only',
  'sandbox',
  'read_only',
  'ready',
  '["courses.read"]'::jsonb,
  '2026-07-16T12:00:00Z',
  decode(repeat('11', 32), 'hex'),
  '40000000-0000-4000-8000-000000000006',
  '40000000-0000-4000-8000-000000000006'
)
on conflict (id) do update
set
  provider = excluded.provider,
  label = excluded.label,
  environment = excluded.environment,
  mode = excluded.mode,
  status = excluded.status,
  capabilities = excluded.capabilities,
  last_verified_at = excluded.last_verified_at,
  verification_evidence_hash = excluded.verification_evidence_hash,
  updated_by = excluded.updated_by;

insert into public.external_records (
  id,
  connection_id,
  entity_type,
  internal_id,
  external_id,
  external_parent_id,
  source_version,
  source_updated_at,
  source_hash,
  sync_state,
  last_seen_at,
  last_synced_at,
  metadata
)
values
  (
    'bb000000-0000-4000-8000-000000000001',
    'ba000000-0000-4000-8000-000000000001',
    'course',
    'b3000000-0000-4000-8000-000000000001',
    '4201',
    '42',
    '2026071601',
    '2026-07-16T11:00:00Z',
    decode(repeat('21', 32), 'hex'),
    'synced',
    '2026-07-16T12:00:00Z',
    '2026-07-16T12:00:00Z',
    '{"fixture":"phase6a-fake-only"}'::jsonb
  ),
  (
    'bb000000-0000-4000-8000-000000000002',
    'ba000000-0000-4000-8000-000000000001',
    'course',
    'b3000000-0000-4000-8000-000000000002',
    '4202',
    '42',
    '2026071501',
    '2026-07-15T11:00:00Z',
    decode(repeat('22', 32), 'hex'),
    'stale',
    '2026-07-16T12:00:00Z',
    '2026-07-15T12:00:00Z',
    '{"fixture":"phase6a-fake-only"}'::jsonb
  ),
  (
    'bb000000-0000-4000-8000-000000000003',
    'ba000000-0000-4000-8000-000000000001',
    'course',
    'b3000000-0000-4000-8000-000000000003',
    '4203',
    '43',
    '2026071601',
    '2026-07-16T11:30:00Z',
    decode(repeat('23', 32), 'hex'),
    'matched',
    '2026-07-16T12:00:00Z',
    null,
    '{"fixture":"phase6a-fake-only"}'::jsonb
  ),
  (
    'bb000000-0000-4000-8000-000000000004',
    'ba000000-0000-4000-8000-000000000001',
    'course_content',
    'b3000000-0000-4000-8000-000000000001',
    'content-4201',
    '4201',
    '2026071601',
    '2026-07-16T11:00:00Z',
    decode(repeat('24', 32), 'hex'),
    'synced',
    '2026-07-16T12:00:00Z',
    '2026-07-16T12:00:00Z',
    '{"fixture":"phase6a-fake-only"}'::jsonb
  ),
  (
    'bb000000-0000-4000-8000-000000000005',
    'a0000000-0000-4000-8000-000000000001',
    'course',
    'b3000000-0000-4000-8000-000000000001',
    'not-moodle-4201',
    null,
    'fixture',
    '2026-07-16T11:00:00Z',
    decode(repeat('25', 32), 'hex'),
    'matched',
    '2026-07-16T12:00:00Z',
    null,
    '{"fixture":"phase6a-negative-control"}'::jsonb
  )
on conflict (id) do update
set
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
  metadata = excluded.metadata;

commit;
