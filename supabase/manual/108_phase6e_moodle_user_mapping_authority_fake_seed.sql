-- Nile Learn Phase 6E deterministic fake-only Moodle user mappings.
-- Requires the accepted Phase 1 and Phase 6A fake fixtures.

begin;

insert into public.external_records (
  id,
  connection_id,
  entity_type,
  internal_id,
  external_id,
  source_version,
  source_updated_at,
  source_hash,
  sync_state,
  last_seen_at,
  last_synced_at,
  metadata
)
select
  fixture.id,
  'ba000000-0000-4000-8000-000000000001'::uuid,
  'user',
  fixture.internal_id,
  fixture.external_id,
  'phase6e-fake-only-v1',
  '2026-07-17T10:00:00Z'::timestamptz,
  public.digest('phase6e-user-' || fixture.external_id, 'sha256'),
  'synced',
  '2026-07-17T10:05:00Z'::timestamptz,
  '2026-07-17T10:05:00Z'::timestamptz,
  pg_catalog.jsonb_build_object(
    'fixture', 'phase6e-fake-only',
    'boundary', 'exact-read-only'
  )
from (
  values
    ('bf000000-0000-4000-8000-000000000001'::uuid, '40000000-0000-4000-8000-000000000001'::uuid, '9101'::text),
    ('bf000000-0000-4000-8000-000000000002'::uuid, '40000000-0000-4000-8000-000000000002'::uuid, '9102'::text),
    ('bf000000-0000-4000-8000-000000000003'::uuid, '40000000-0000-4000-8000-000000000003'::uuid, '9103'::text),
    ('bf000000-0000-4000-8000-000000000004'::uuid, '40000000-0000-4000-8000-000000000004'::uuid, '9104'::text),
    ('bf000000-0000-4000-8000-000000000005'::uuid, '40000000-0000-4000-8000-000000000005'::uuid, '9105'::text),
    ('bf000000-0000-4000-8000-000000000006'::uuid, '40000000-0000-4000-8000-000000000006'::uuid, '9106'::text)
) as fixture(id, internal_id, external_id)
on conflict (id) do update
set
  connection_id = excluded.connection_id,
  entity_type = excluded.entity_type,
  internal_id = excluded.internal_id,
  external_id = excluded.external_id,
  source_version = excluded.source_version,
  source_updated_at = excluded.source_updated_at,
  source_hash = excluded.source_hash,
  sync_state = excluded.sync_state,
  last_seen_at = excluded.last_seen_at,
  last_synced_at = excluded.last_synced_at,
  last_error = null,
  metadata = excluded.metadata,
  updated_at = pg_catalog.now();

insert into public.external_records (
  id,
  connection_id,
  entity_type,
  internal_id,
  external_id,
  source_version,
  source_updated_at,
  sync_state,
  last_seen_at,
  metadata
)
values (
  'bf000000-0000-4000-8000-000000000007',
  'ba000000-0000-4000-8000-000000000001',
  'user',
  null,
  '9199',
  'phase6e-negative-control-v1',
  '2026-07-17T10:00:00Z',
  'ignored',
  '2026-07-17T10:05:00Z',
  '{"fixture":"phase6e-negative-control","boundary":"provider-only-ignored"}'::jsonb
)
on conflict (id) do update
set
  connection_id = excluded.connection_id,
  entity_type = excluded.entity_type,
  internal_id = excluded.internal_id,
  external_id = excluded.external_id,
  source_version = excluded.source_version,
  source_updated_at = excluded.source_updated_at,
  source_hash = null,
  sync_state = excluded.sync_state,
  last_seen_at = excluded.last_seen_at,
  last_synced_at = null,
  last_error = null,
  metadata = excluded.metadata,
  updated_at = pg_catalog.now();

commit;
