-- Nile Learn Phase 13F1 deterministic local-only acceptance fixture.
--
-- Apply after Phase 1, the Phase 1 fake authority seed, Phase 2B, and the
-- accepted Phase 13A-E Forms migrations, but before Phase 13F1. The fixture
-- proves that the additive contract and its rollback preserve older evidence.

begin;

insert into public.auth_sessions (
  id,
  token_hash,
  user_id,
  active_role_grant_id,
  provider,
  expires_at
)
values
  (
    'a1000000-0000-4000-8000-000000000001',
    decode(repeat('a', 64), 'hex'),
    '40000000-0000-4000-8000-000000000006',
    '50000000-0000-4000-8000-000000000006',
    'demo',
    now() + interval '24 hours'
  ),
  (
    'a1000000-0000-4000-8000-000000000002',
    decode(repeat('b', 64), 'hex'),
    '40000000-0000-4000-8000-000000000003',
    '50000000-0000-4000-8000-000000000003',
    'demo',
    now() + interval '24 hours'
  ),
  (
    'a1000000-0000-4000-8000-000000000003',
    decode(repeat('c', 64), 'hex'),
    '40000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    'demo',
    now() + interval '24 hours'
  ),
  (
    'a1000000-0000-4000-8000-000000000004',
    decode(repeat('d', 64), 'hex'),
    '40000000-0000-4000-8000-000000000005',
    '50000000-0000-4000-8000-000000000005',
    'demo',
    now() + interval '24 hours'
  ),
  (
    'a1000000-0000-4000-8000-000000000005',
    decode(repeat('e', 64), 'hex'),
    '40000000-0000-4000-8000-000000000005',
    '50000000-0000-4000-8000-000000000005',
    'demo',
    now() + interval '24 hours'
  ),
  (
    'a1000000-0000-4000-8000-000000000006',
    decode(repeat('f', 64), 'hex'),
    '40000000-0000-4000-8000-000000000005',
    '50000000-0000-4000-8000-000000000005',
    'demo',
    now() + interval '24 hours'
  )
on conflict (id) do nothing;

insert into public.form_definitions (
  id,
  form_key,
  title,
  category,
  owner_user_id,
  owner_role_grant_id,
  owner_role,
  branch_id,
  status
)
values (
  'f1000000-0000-4000-8000-000000000001',
  'phase13f1_preserved_intake',
  'Preserved intake evidence',
  'admissions',
  '40000000-0000-4000-8000-000000000003',
  '50000000-0000-4000-8000-000000000003',
  'registrar',
  '20000000-0000-4000-8000-000000000002',
  'active'
);

insert into public.form_versions (
  id,
  definition_id,
  version_number,
  status,
  revision,
  schema_json,
  logic_json,
  translations_json,
  content_hash,
  authored_by,
  published_by,
  published_at
)
values (
  'f2000000-0000-4000-8000-000000000001',
  'f1000000-0000-4000-8000-000000000001',
  1,
  'published',
  1,
  '{"fields":[{"id":"full_name","type":"short_text","searchable":true,"reportable":true,"dataClass":"standard"},{"id":"national_id","type":"short_text","searchable":false,"reportable":true,"dataClass":"government_id"}]}'::jsonb,
  '[]'::jsonb,
  '{"en":{"title":"Preserved intake"},"ar":{"title":"Preserved intake"}}'::jsonb,
  decode(repeat('1', 64), 'hex'),
  '40000000-0000-4000-8000-000000000003',
  '40000000-0000-4000-8000-000000000003',
  now() - interval '2 days'
);

update public.form_definitions
set current_published_version_id = 'f2000000-0000-4000-8000-000000000001'
where id = 'f1000000-0000-4000-8000-000000000001';

insert into public.form_publications (
  id,
  definition_id,
  version_id,
  slug,
  audience,
  status,
  allow_multiple,
  allow_drafts,
  offline_eligible,
  created_by
)
values (
  'f3000000-0000-4000-8000-000000000001',
  'f1000000-0000-4000-8000-000000000001',
  'f2000000-0000-4000-8000-000000000001',
  'phase13f1-preserved-intake',
  'assigned',
  'open',
  true,
  true,
  true,
  '40000000-0000-4000-8000-000000000003'
);

insert into public.form_assignments (
  id,
  publication_id,
  target_type,
  target_user_id,
  assigned_by
)
values (
  'f4000000-0000-4000-8000-000000000001',
  'f3000000-0000-4000-8000-000000000001',
  'user',
  '40000000-0000-4000-8000-000000000003',
  '40000000-0000-4000-8000-000000000003'
);

insert into public.form_drafts (
  id,
  publication_id,
  definition_id,
  version_id,
  assignment_id,
  respondent_user_id,
  encrypted_payload,
  payload_nonce,
  payload_key_version,
  revision,
  expires_at
)
values (
  'f5000000-0000-4000-8000-000000000001',
  'f3000000-0000-4000-8000-000000000001',
  'f1000000-0000-4000-8000-000000000001',
  'f2000000-0000-4000-8000-000000000001',
  'f4000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000003',
  decode('01020304', 'hex'),
  decode(repeat('2', 24), 'hex'),
  1,
  1,
  now() + interval '7 days'
);

insert into public.form_submissions (
  id,
  definition_id,
  publication_id,
  version_id,
  assignment_id,
  respondent_user_id,
  respondent_role,
  branch_id,
  source,
  answer_json,
  status,
  revision,
  client_submission_id
)
values
  (
    'f6000000-0000-4000-8000-000000000001',
    'f1000000-0000-4000-8000-000000000001',
    'f3000000-0000-4000-8000-000000000001',
    'f2000000-0000-4000-8000-000000000001',
    'f4000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003',
    'registrar',
    '20000000-0000-4000-8000-000000000002',
    'web',
    '{"full_name":"Fake preserved applicant","national_id":"FAKE-0001"}'::jsonb,
    'under_review',
    2,
    'preserved-web-0001'
  ),
  (
    'f6000000-0000-4000-8000-000000000002',
    'f1000000-0000-4000-8000-000000000001',
    'f3000000-0000-4000-8000-000000000001',
    'f2000000-0000-4000-8000-000000000001',
    'f4000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000003',
    'registrar',
    '20000000-0000-4000-8000-000000000002',
    'offline',
    '{"full_name":"Fake offline applicant","national_id":"FAKE-0002"}'::jsonb,
    'submitted',
    1,
    'preserved-offline-0001'
  );

insert into public.form_submission_index_values (
  id,
  submission_id,
  field_id,
  value_type,
  text_value
)
values (
  'f7000000-0000-4000-8000-000000000001',
  'f6000000-0000-4000-8000-000000000001',
  'full_name',
  'text',
  'Fake preserved applicant'
);

insert into public.form_reviews (
  id,
  submission_id,
  reviewer_user_id,
  reviewer_role_grant_id,
  decision,
  comments,
  expected_submission_revision
)
values (
  'f8000000-0000-4000-8000-000000000001',
  'f6000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000003',
  '50000000-0000-4000-8000-000000000003',
  'under_review',
  'Fake preserved review',
  1
);

insert into public.form_offline_devices (
  id,
  user_id,
  role_grant_id,
  label,
  device_token_hash,
  public_key,
  expires_at
)
values (
  'f9000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000003',
  '50000000-0000-4000-8000-000000000003',
  'Fake registrar tablet',
  decode(repeat('3', 64), 'hex'),
  'fake-local-public-key',
  now() + interval '30 days'
);

insert into public.form_sync_receipts (
  id,
  device_id,
  client_submission_id,
  submission_id,
  status,
  payload_hash
)
values (
  'fa000000-0000-4000-8000-000000000001',
  'f9000000-0000-4000-8000-000000000001',
  'preserved-offline-0001',
  'f6000000-0000-4000-8000-000000000002',
  'accepted',
  decode(repeat('4', 64), 'hex')
);

insert into public.form_attachments (
  id,
  submission_id,
  field_id
)
values (
  'fb000000-0000-4000-8000-000000000001',
  'f6000000-0000-4000-8000-000000000001',
  'reserved_future_attachment'
);

insert into public.form_legacy_import_runs (
  id,
  provider,
  source_form_id,
  source_form_title,
  target_publication_id,
  target_version_id,
  mapping_json,
  source_limit,
  preview_hash,
  status,
  total_rows,
  valid_rows,
  imported_rows,
  created_by,
  completed_at
)
values (
  'fc000000-0000-4000-8000-000000000001',
  'jotform',
  'fake-source-form-001',
  'Fake preserved legacy form',
  'f3000000-0000-4000-8000-000000000001',
  'f2000000-0000-4000-8000-000000000001',
  '[]'::jsonb,
  100,
  decode(repeat('5', 64), 'hex'),
  'imported',
  1,
  1,
  1,
  '40000000-0000-4000-8000-000000000006',
  now() - interval '1 day'
);

insert into public.form_submissions (
  id,
  definition_id,
  publication_id,
  version_id,
  branch_id,
  source,
  answer_json,
  status,
  revision,
  client_submission_id,
  legacy_source_form_id,
  legacy_source_submission_id,
  legacy_payload_hash,
  legacy_import_run_id,
  reconciliation_status
)
values (
  'f6000000-0000-4000-8000-000000000003',
  'f1000000-0000-4000-8000-000000000001',
  'f3000000-0000-4000-8000-000000000001',
  'f2000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  'legacy_import',
  '{"full_name":"Fake legacy applicant","national_id":"FAKE-0003"}'::jsonb,
  'under_review',
  1,
  'legacy:fake-source-submission-001',
  'fake-source-form-001',
  'fake-source-submission-001',
  decode(repeat('6', 64), 'hex'),
  'fc000000-0000-4000-8000-000000000001',
  'pending'
);

insert into public.form_legacy_import_records (
  id,
  run_id,
  provider,
  source_form_id,
  source_submission_id,
  payload_hash,
  submission_id,
  reconciliation_status
)
values (
  'fd000000-0000-4000-8000-000000000001',
  'fc000000-0000-4000-8000-000000000001',
  'jotform',
  'fake-source-form-001',
  'fake-source-submission-001',
  decode(repeat('6', 64), 'hex'),
  'f6000000-0000-4000-8000-000000000003',
  'pending'
);

set constraints all immediate;

commit;
