-- Nile Learn Phase 13F1: normalized Nile Forms repository contract.
--
-- LOCAL ACCEPTANCE ONLY. This file must remain under supabase/manual and must
-- never be applied to a linked, shared, preview, or production project.

begin;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_roles where rolname = 'nile_forms_executor'
  ) then
    create role nile_forms_executor nologin noinherit nobypassrls;
  end if;
end;
$$;

alter role nile_forms_executor
  nosuperuser nocreatedb nocreaterole nologin noinherit noreplication nobypassrls;

do $$
declare
  v_role_name text;
begin
  for v_role_name in
    select role.rolname
    from pg_catalog.pg_auth_members as membership
    join pg_catalog.pg_roles as role on role.oid = membership.roleid
    where membership.member = (
      select executor.oid
      from pg_catalog.pg_roles as executor
      where executor.rolname = 'nile_forms_executor'
    )
  loop
    execute pg_catalog.format(
      'revoke %I from nile_forms_executor',
      v_role_name
    );
  end loop;
end;
$$;

do $$
declare
  v_member_role_name text;
begin
  for v_member_role_name in
    select member_role.rolname
    from pg_catalog.pg_auth_members as membership
    join pg_catalog.pg_roles as member_role on member_role.oid = membership.member
    where membership.roleid = (
      select executor.oid
      from pg_catalog.pg_roles as executor
      where executor.rolname = 'nile_forms_executor'
    )
      and member_role.rolname <> 'authenticator'
  loop
    execute pg_catalog.format(
      'revoke nile_forms_executor from %I',
      v_member_role_name
    );
  end loop;
end;
$$;

-- PostgREST connects as authenticator and may switch only into roles granted
-- to it. NOINHERIT keeps the executor's RPC capability opt-in per JWT claim.
do $$
begin
  if exists (
    select 1 from pg_catalog.pg_roles where rolname = 'authenticator'
  ) then
    execute 'grant nile_forms_executor to authenticator';
  end if;
end;
$$;

insert into public.permissions (code, category, description, sensitive)
values (
  'form_submissions.sensitive_read',
  'forms',
  'Read sensitive Nile Forms answers within one effective role grant',
  true
)
on conflict (code) do update
set
  category = excluded.category,
  description = excluded.description,
  sensitive = excluded.sensitive;

create table public.form_permission_mappings (
  application_code text primary key,
  database_code text not null unique references public.permissions(code) on delete restrict,
  created_at timestamptz not null default now(),
  check (application_code ~ '^[a-z][a-z0-9_.-]+:[a-z][a-z0-9_.-]+$'),
  check (replace(application_code, ':', '.') = database_code),
  unique (application_code, database_code)
);

insert into public.form_permission_mappings (application_code, database_code)
values
  ('forms:read', 'forms.read'),
  ('forms:write', 'forms.write'),
  ('forms:publish', 'forms.publish'),
  ('forms:assign', 'forms.assign'),
  ('forms:respond', 'forms.respond'),
  ('form_submissions:read', 'form_submissions.read'),
  ('form_submissions:review', 'form_submissions.review'),
  ('form_submissions:export', 'form_submissions.export'),
  ('form_submissions:sensitive_read', 'form_submissions.sensitive_read');

create table public.form_operation_permissions (
  operation text primary key,
  operation_kind text not null check (operation_kind in ('query', 'command')),
  application_permission_code text not null,
  database_permission_code text not null,
  created_at timestamptz not null default now(),
  foreign key (application_permission_code, database_permission_code)
    references public.form_permission_mappings(application_code, database_code)
    on delete restrict,
  check (operation ~ '^forms\.[a-z][a-z0-9_.]+$')
);

insert into public.form_operation_permissions (
  operation,
  operation_kind,
  application_permission_code,
  database_permission_code
)
values
  ('forms.definitions.list', 'query', 'forms:read', 'forms.read'),
  ('forms.definitions.get', 'query', 'forms:read', 'forms.read'),
  ('forms.management.options', 'query', 'forms:write', 'forms.write'),
  ('forms.assigned.list', 'query', 'forms:read', 'forms.read'),
  ('forms.assigned.get', 'query', 'forms:read', 'forms.read'),
  ('forms.submissions.own.get', 'query', 'forms:read', 'forms.read'),
  ('forms.drafts.load', 'query', 'forms:respond', 'forms.respond'),
  ('forms.submissions.list', 'query', 'form_submissions:read', 'form_submissions.read'),
  ('forms.submissions.get', 'query', 'form_submissions:read', 'form_submissions.read'),
  ('forms.submissions.export', 'query', 'form_submissions:export', 'form_submissions.export'),
  ('forms.offline.bundle.get', 'query', 'forms:respond', 'forms.respond'),
  ('forms.migration.status', 'query', 'forms:write', 'forms.write'),
  ('forms.migration.runs.list', 'query', 'forms:write', 'forms.write'),
  ('forms.definitions.create', 'command', 'forms:write', 'forms.write'),
  ('forms.versions.draft.create', 'command', 'forms:write', 'forms.write'),
  ('forms.versions.draft.update', 'command', 'forms:write', 'forms.write'),
  ('forms.versions.publish', 'command', 'forms:publish', 'forms.publish'),
  ('forms.publications.retire', 'command', 'forms:publish', 'forms.publish'),
  ('forms.assignments.create', 'command', 'forms:assign', 'forms.assign'),
  ('forms.assignments.revoke', 'command', 'forms:assign', 'forms.assign'),
  ('forms.drafts.save', 'command', 'forms:respond', 'forms.respond'),
  ('forms.submissions.submit', 'command', 'forms:respond', 'forms.respond'),
  ('forms.submissions.withdraw', 'command', 'forms:respond', 'forms.respond'),
  ('forms.submissions.review', 'command', 'form_submissions:review', 'form_submissions.review'),
  ('forms.offline.devices.enroll', 'command', 'forms:respond', 'forms.respond'),
  ('forms.offline.devices.revoke', 'command', 'forms:respond', 'forms.respond'),
  ('forms.offline.bundle.issue', 'command', 'forms:respond', 'forms.respond'),
  ('forms.offline.sync.item', 'command', 'forms:respond', 'forms.respond'),
  ('forms.permissions.sensitive.grant', 'command', 'forms:write', 'forms.write'),
  ('forms.permissions.sensitive.revoke', 'command', 'forms:write', 'forms.write'),
  ('forms.migration.preview.record', 'command', 'forms:write', 'forms.write'),
  ('forms.migration.import.record', 'command', 'forms:write', 'forms.write'),
  ('forms.migration.reconcile', 'command', 'forms:write', 'forms.write');

create table public.role_grant_permissions (
  id uuid primary key default gen_random_uuid(),
  role_grant_id uuid not null references public.role_grants(id) on delete restrict,
  permission_code text not null references public.permissions(code) on delete restrict,
  status text not null default 'active' check (status in ('active', 'revoked')),
  source text not null check (source in ('auto_superadmin', 'explicit')),
  granted_by uuid references public.app_users(id) on delete restrict,
  command_id uuid references public.command_executions(id) on delete restrict,
  reason text not null check (char_length(reason) between 3 and 500),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references public.app_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at),
  check (
    (source = 'auto_superadmin' and command_id is null)
    or (source = 'explicit' and command_id is not null and granted_by is not null)
  ),
  check (
    (status = 'active' and revoked_at is null and revoked_by is null)
    or (status = 'revoked' and revoked_at is not null and revoked_by is not null)
  )
);

create unique index role_grant_permissions_active_uidx
  on public.role_grant_permissions (role_grant_id, permission_code)
  where status = 'active';

create table public.form_command_results (
  command_id uuid primary key references public.command_executions(id) on delete restrict,
  operation text not null references public.form_operation_permissions(operation) on delete restrict,
  result_json jsonb not null check (jsonb_typeof(result_json) = 'object'),
  created_at timestamptz not null default now(),
  check (not nile_private.jsonb_has_forbidden_keys(result_json))
);

create table public.form_public_commands (
  id uuid primary key default gen_random_uuid(),
  operation text not null
    check (operation in ('forms.public.draft.save', 'forms.public.submit')),
  publication_id uuid not null references public.form_publications(id) on delete restrict,
  version_id uuid not null references public.form_versions(id) on delete restrict,
  idempotency_key text not null unique
    check (char_length(idempotency_key) between 8 and 200),
  client_submission_id text not null
    check (char_length(client_submission_id) between 8 and 128),
  request_hmac bytea not null check (octet_length(request_hmac) = 32),
  request_fingerprint bytea not null check (octet_length(request_fingerprint) = 32),
  evidence_key_version integer not null check (evidence_key_version > 0),
  ip_hmac bytea not null check (octet_length(ip_hmac) = 32),
  ip_key_version integer not null check (ip_key_version > 0),
  user_agent_hash bytea not null check (octet_length(user_agent_hash) = 32),
  status text not null default 'started' check (status in ('started', 'succeeded')),
  draft_id uuid references public.form_drafts(id) on delete restrict,
  submission_id uuid references public.form_submissions(id) on delete restrict,
  result_json jsonb check (result_json is null or jsonb_typeof(result_json) = 'object'),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  check (evidence_key_version = ip_key_version),
  check (
    (
      status = 'started'
      and draft_id is null
      and submission_id is null
      and result_json is null
      and completed_at is null
    )
    or (
      status = 'succeeded'
      and completed_at is not null
      and result_json is not null
      and (
        (operation = 'forms.public.draft.save' and draft_id is not null and submission_id is null)
        or (operation = 'forms.public.submit' and submission_id is not null and draft_id is null)
      )
    )
  )
);

create index form_public_commands_draft_idx
  on public.form_public_commands (draft_id) where draft_id is not null;
create unique index form_public_commands_submission_uidx
  on public.form_public_commands (submission_id) where submission_id is not null;

alter table public.form_drafts
  add column command_id uuid references public.command_executions(id) on delete restrict,
  add column public_command_id uuid references public.form_public_commands(id) on delete restrict,
  add constraint form_drafts_authority_exclusive_check
    check (num_nonnulls(command_id, public_command_id) = 1) not valid;

alter table public.form_submissions
  add column public_command_id uuid references public.form_public_commands(id) on delete restrict,
  add constraint form_submissions_authority_exclusive_check
    check (num_nonnulls(command_id, public_command_id) = 1) not valid;

create unique index form_drafts_public_command_uidx
  on public.form_drafts (public_command_id) where public_command_id is not null;
create unique index form_submissions_public_command_uidx
  on public.form_submissions (public_command_id) where public_command_id is not null;

alter table public.outbox_events
  alter column command_id drop not null,
  add column public_command_id uuid references public.form_public_commands(id) on delete restrict,
  add constraint outbox_events_authority_exactly_one_check
    check (num_nonnulls(command_id, public_command_id) = 1);

alter table public.form_sync_receipts
  add column command_id uuid references public.command_executions(id) on delete restrict;

alter table public.form_offline_devices
  add column command_id uuid references public.command_executions(id) on delete restrict;

create table public.form_public_rate_limits (
  ip_hmac bytea not null check (octet_length(ip_hmac) = 32),
  ip_key_version integer not null check (ip_key_version > 0),
  operation text not null
    check (operation in ('forms.public.draft.save', 'forms.public.submit')),
  window_started_at timestamptz not null,
  attempts integer not null default 0 check (attempts between 0 and 12),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (ip_hmac, ip_key_version, operation, window_started_at),
  check (expires_at > window_started_at),
  check (expires_at <= window_started_at + interval '24 hours')
);

create index form_public_rate_limits_expiry_idx
  on public.form_public_rate_limits (expires_at);

create table public.form_offline_bundles (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.form_offline_devices(id) on delete restrict,
  role_grant_id uuid not null references public.role_grants(id) on delete restrict,
  issued_by uuid not null references public.app_users(id) on delete restrict,
  command_id uuid not null references public.command_executions(id) on delete restrict,
  bundle_mac bytea not null check (octet_length(bundle_mac) = 32),
  mac_key_version integer not null check (mac_key_version > 0),
  safe_option_digest bytea not null check (octet_length(safe_option_digest) = 32),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (expires_at > issued_at),
  check (expires_at <= issued_at + interval '72 hours'),
  unique (id, device_id, role_grant_id)
);

create table public.form_offline_bundle_items (
  id uuid primary key default gen_random_uuid(),
  bundle_id uuid not null references public.form_offline_bundles(id) on delete restrict,
  device_id uuid not null,
  role_grant_id uuid not null,
  assignment_id uuid not null references public.form_assignments(id) on delete restrict,
  publication_id uuid not null references public.form_publications(id) on delete restrict,
  version_id uuid not null references public.form_versions(id) on delete restrict,
  item_mac bytea not null check (octet_length(item_mac) = 32),
  safe_option_digest bytea not null check (octet_length(safe_option_digest) = 32),
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  foreign key (bundle_id, device_id, role_grant_id)
    references public.form_offline_bundles(id, device_id, role_grant_id)
    on delete restrict,
  check (expires_at > issued_at),
  unique (bundle_id, assignment_id, publication_id, version_id)
);

create table public.nile_forms_repository_contract (
  singleton boolean primary key default true check (singleton),
  catalog_version text not null,
  schema_evidence_sha256 text not null
    check (schema_evidence_sha256 ~ '^[0-9a-f]{64}$'),
  executor_role text not null check (executor_role = 'nile_forms_executor'),
  draft_key_version integer not null check (draft_key_version > 0),
  public_hmac_key_version integer not null check (public_hmac_key_version > 0),
  public_hmac_previous_key_version integer
    check (
      public_hmac_previous_key_version is null
      or (
        public_hmac_previous_key_version > 0
        and public_hmac_previous_key_version <> public_hmac_key_version
      )
    ),
  offline_mac_key_version integer not null check (offline_mac_key_version > 0),
  installed_at timestamptz not null default now()
);

insert into public.nile_forms_repository_contract (
  singleton,
  catalog_version,
  schema_evidence_sha256,
  executor_role,
  draft_key_version,
  public_hmac_key_version,
  public_hmac_previous_key_version,
  offline_mac_key_version
)
values (
  true,
  'phase13f1-v1',
  'aae2c27e6dc6ecaa48162ac03937e82e37d3cfd5c533e7a11e84d0d7725a8e63',
  'nile_forms_executor',
  1,
  1,
  null,
  1
);

drop index public.form_publications_slug_uidx;
create unique index form_publications_slug_uidx
  on public.form_publications (lower(slug))
  where status <> 'retired';

create function nile_private.preserve_form_command_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Nile Forms command evidence is immutable'
      using errcode = '55000';
  end if;
  if tg_table_name = 'form_public_commands' and old.status = 'started' then
    if old.id is distinct from new.id
      or old.operation is distinct from new.operation
      or old.publication_id is distinct from new.publication_id
      or old.version_id is distinct from new.version_id
      or old.idempotency_key is distinct from new.idempotency_key
      or old.client_submission_id is distinct from new.client_submission_id
      or old.request_hmac is distinct from new.request_hmac
      or old.request_fingerprint is distinct from new.request_fingerprint
      or old.evidence_key_version is distinct from new.evidence_key_version
      or old.ip_hmac is distinct from new.ip_hmac
      or old.ip_key_version is distinct from new.ip_key_version
      or old.user_agent_hash is distinct from new.user_agent_hash
      or old.started_at is distinct from new.started_at then
      raise exception 'Public command provenance is immutable'
        using errcode = '55000';
    end if;
    return new;
  end if;
  raise exception 'Nile Forms command evidence is immutable'
    using errcode = '55000';
end;
$$;

create function nile_private.ensure_superadmin_form_sensitive_grant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role = 'superadmin' and new.status = 'active' then
    insert into public.role_grant_permissions (
      role_grant_id,
      permission_code,
      source,
      reason,
      starts_at
    )
    values (
      new.id,
      'form_submissions.sensitive_read',
      'auto_superadmin',
      'Automatic Super Admin sensitive Forms access',
      new.starts_at
    )
    on conflict (role_grant_id, permission_code) where status = 'active'
    do nothing;
  end if;
  return new;
end;
$$;

create trigger role_grants_form_sensitive_default
after insert or update of status on public.role_grants
for each row execute function nile_private.ensure_superadmin_form_sensitive_grant();

insert into public.role_grant_permissions (
  role_grant_id,
  permission_code,
  source,
  reason,
  starts_at
)
select
  role_grant.id,
  'form_submissions.sensitive_read',
  'auto_superadmin',
  'Automatic Super Admin sensitive Forms access',
  role_grant.starts_at
from public.role_grants as role_grant
where role_grant.role = 'superadmin'
  and role_grant.status = 'active'
on conflict (role_grant_id, permission_code) where status = 'active'
do nothing;

create function nile_private.nile_forms_schema_fields(p_schema jsonb)
returns setof jsonb
language sql
immutable
security invoker
set search_path = ''
as $$
  select field.value
  from pg_catalog.jsonb_array_elements(
    case
      when pg_catalog.jsonb_typeof(p_schema -> 'fields') = 'array'
        then p_schema -> 'fields'
      else '[]'::jsonb
    end
  ) as field(value)
  union all
  select field.value
  from pg_catalog.jsonb_array_elements(
    case
      when pg_catalog.jsonb_typeof(p_schema -> 'pages') = 'array'
        then p_schema -> 'pages'
      else '[]'::jsonb
    end
  ) as page(value)
  cross join lateral pg_catalog.jsonb_array_elements(
    case
      when pg_catalog.jsonb_typeof(page.value -> 'fields') = 'array'
        then page.value -> 'fields'
      else '[]'::jsonb
    end
  ) as field(value)
$$;

create function nile_private.project_nile_form_answers(
  p_answers jsonb,
  p_schema jsonb,
  p_mode text,
  p_can_read_sensitive boolean
)
returns jsonb
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_field jsonb;
  v_field_id text;
  v_data_class text;
  v_sensitive boolean;
  v_allowed boolean;
  v_result jsonb := '{}'::jsonb;
begin
  if pg_catalog.jsonb_typeof(p_answers) <> 'object' then
    raise exception 'Nile Forms answers must be a JSON object'
      using errcode = '22023';
  end if;
  if p_mode not in ('projection', 'export', 'index', 'audit', 'outbox', 'log') then
    raise exception 'Unknown Nile Forms projection mode'
      using errcode = '22023';
  end if;
  for v_field in
    select * from nile_private.nile_forms_schema_fields(p_schema)
  loop
    v_field_id := v_field ->> 'id';
    if v_field_id is null or not (p_answers ? v_field_id) then
      continue;
    end if;
    v_data_class := coalesce(
      v_field ->> 'dataClass',
      v_field ->> 'data_class',
      'standard'
    );
    v_sensitive := v_data_class in (
      'government_id', 'payment', 'health', 'credential', 'file', 'signature'
    );
    v_allowed := true;
    if v_sensitive and (
      not p_can_read_sensitive
      or p_mode in ('index', 'audit', 'outbox', 'log')
    ) then
      v_allowed := false;
    end if;
    if p_mode = 'export' and coalesce((v_field ->> 'reportable')::boolean, false) = false then
      v_allowed := false;
    end if;
    if p_mode = 'index' and coalesce((v_field ->> 'searchable')::boolean, false) = false then
      v_allowed := false;
    end if;
    if v_allowed then
      v_result := v_result || pg_catalog.jsonb_build_object(
        v_field_id,
        p_answers -> v_field_id
      );
    end if;
  end loop;
  return v_result;
end;
$$;

create function nile_private.reject_sensitive_form_index_value()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_field jsonb;
  v_data_class text;
  v_searchable boolean;
begin
  select field
  into v_field
  from public.form_submissions as submission
  join public.form_versions as version on version.id = submission.version_id
  cross join lateral nile_private.nile_forms_schema_fields(version.schema_json) as field
  where submission.id = new.submission_id
    and field ->> 'id' = new.field_id;
  if not found then
    raise exception 'Indexed Nile Forms field is not present in the immutable schema'
      using errcode = '23514';
  end if;
  v_data_class := coalesce(
    v_field ->> 'dataClass',
    v_field ->> 'data_class',
    'standard'
  );
  v_searchable := coalesce((v_field ->> 'searchable')::boolean, false);
  if v_data_class in (
    'government_id', 'payment', 'health', 'credential', 'file', 'signature'
  ) then
    raise exception 'Sensitive Nile Forms values cannot be indexed'
      using errcode = '42501';
  end if;
  if not v_searchable then
    raise exception 'Nile Forms field is not marked searchable'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger form_submission_index_values_reject_sensitive
before insert or update on public.form_submission_index_values
for each row execute function nile_private.reject_sensitive_form_index_value();

create function nile_private.nile_forms_scope_allows(
  p_role text,
  p_branch_ids uuid[],
  p_department_ids uuid[],
  p_branch_id uuid,
  p_department_id uuid
)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select case
    when p_role = 'superadmin' then true
    when p_branch_id is not null and not (p_branch_id = any(p_branch_ids)) then false
    when p_department_id is not null and not (p_department_id = any(p_department_ids)) then false
    when p_branch_id is null and p_department_id is null then false
    else true
  end
$$;

create function nile_private.require_nile_forms_authority(
  p_token_hash text,
  p_operation text,
  p_operation_kind text
)
returns table (
  session_id uuid,
  user_id uuid,
  role_grant_id uuid,
  active_role text,
  branch_ids uuid[],
  department_ids uuid[],
  database_permission_code text,
  can_read_sensitive boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token_hash bytea;
  v_session public.auth_sessions%rowtype;
  v_user public.app_users%rowtype;
  v_grant public.role_grants%rowtype;
  v_database_permission text;
  v_branch_ids uuid[] := '{}'::uuid[];
  v_department_ids uuid[] := '{}'::uuid[];
  v_permission_granted boolean := false;
  v_sensitive boolean := false;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-fA-F]{64}$' then
    raise exception 'Nile Forms session token hash is invalid'
      using errcode = '22023';
  end if;
  if p_operation_kind not in ('query', 'command') then
    raise exception 'Nile Forms operation kind is invalid'
      using errcode = '22023';
  end if;
  v_token_hash := pg_catalog.decode(pg_catalog.lower(p_token_hash), 'hex');

  -- Shared deterministic lock order: session, user, grant, permission, scopes,
  -- assignment, then target. Session revocation also locks the session first.
  select session.*
  into v_session
  from public.auth_sessions as session
  where session.token_hash = v_token_hash
  for update;
  if not found
    or v_session.revoked_at is not null
    or v_session.expires_at <= pg_catalog.statement_timestamp() then
    raise exception 'Nile Forms session authority is unavailable'
      using errcode = '42501';
  end if;

  select app_user.*
  into v_user
  from public.app_users as app_user
  where app_user.id = v_session.user_id
  for update;
  if not found or v_user.status <> 'active' then
    raise exception 'Nile Forms user authority is unavailable'
      using errcode = '42501';
  end if;

  select role_grant.*
  into v_grant
  from public.role_grants as role_grant
  where role_grant.id = v_session.active_role_grant_id
    and role_grant.user_id = v_session.user_id
  for update;
  if not found
    or v_grant.status <> 'active'
    or v_grant.starts_at > pg_catalog.statement_timestamp()
    or (
      v_grant.ends_at is not null
      and v_grant.ends_at <= pg_catalog.statement_timestamp()
    ) then
    raise exception 'Nile Forms role grant authority is unavailable'
      using errcode = '42501';
  end if;

  select operation.database_permission_code
  into v_database_permission
  from public.form_operation_permissions as operation
  where operation.operation = p_operation
    and operation.operation_kind = p_operation_kind;
  if not found then
    raise exception 'Nile Forms operation is not registered'
      using errcode = '42501';
  end if;

  select role_permission.granted
  into v_permission_granted
  from public.role_permissions as role_permission
  where role_permission.role = v_grant.role
    and role_permission.permission_code = v_database_permission
  for share;
  if not found or not v_permission_granted then
    raise exception 'Nile Forms permission is denied'
      using errcode = '42501';
  end if;

  perform 1
  from public.role_grant_branch_scopes as scope
  where scope.role_grant_id = v_grant.id
  order by scope.id
  for share;
  perform 1
  from public.role_grant_department_scopes as scope
  where scope.role_grant_id = v_grant.id
  order by scope.id
  for share;

  select coalesce(pg_catalog.array_agg(scope.branch_id order by scope.branch_id), '{}'::uuid[])
  into v_branch_ids
  from public.role_grant_branch_scopes as scope
  join public.branches as branch
    on branch.id = scope.branch_id and branch.status = 'active'
  where scope.role_grant_id = v_grant.id
    and scope.starts_at <= pg_catalog.statement_timestamp()
    and (scope.ends_at is null or scope.ends_at > pg_catalog.statement_timestamp());

  select coalesce(pg_catalog.array_agg(scope.department_id order by scope.department_id), '{}'::uuid[])
  into v_department_ids
  from public.role_grant_department_scopes as scope
  join public.departments as department
    on department.id = scope.department_id and department.status = 'active'
  where scope.role_grant_id = v_grant.id
    and scope.starts_at <= pg_catalog.statement_timestamp()
    and (scope.ends_at is null or scope.ends_at > pg_catalog.statement_timestamp());

  if v_grant.role = 'superadmin' then
    if pg_catalog.cardinality(v_branch_ids) <> 0
      or pg_catalog.cardinality(v_department_ids) <> 0 then
      raise exception 'Super Admin Nile Forms authority must be global'
        using errcode = '42501';
    end if;
  elsif v_grant.role in ('student', 'registrar', 'branchadmin') then
    if pg_catalog.cardinality(v_branch_ids) = 0
      or pg_catalog.cardinality(v_department_ids) <> 0 then
      raise exception 'Nile Forms branch authority is empty or ambiguous'
        using errcode = '42501';
    end if;
  elsif v_grant.role = 'teacher' then
    if pg_catalog.cardinality(v_branch_ids) = 0
      or pg_catalog.cardinality(v_department_ids) = 0 then
      raise exception 'Nile Forms teacher authority is empty'
        using errcode = '42501';
    end if;
  elsif v_grant.role = 'headofdepartment' then
    if pg_catalog.cardinality(v_department_ids) = 0 then
      raise exception 'Nile Forms department authority is empty'
        using errcode = '42501';
    end if;
  else
    raise exception 'Nile Forms role is invalid'
      using errcode = '42501';
  end if;

  select exists (
    select 1
    from public.role_grant_permissions as permission
    where permission.role_grant_id = v_grant.id
      and permission.permission_code = 'form_submissions.sensitive_read'
      and permission.status = 'active'
      and permission.starts_at <= pg_catalog.statement_timestamp()
      and (
        permission.ends_at is null
        or permission.ends_at > pg_catalog.statement_timestamp()
      )
  ) into v_sensitive;

  return query
  select
    v_session.id,
    v_user.id,
    v_grant.id,
    v_grant.role,
    v_branch_ids,
    v_department_ids,
    v_database_permission,
    v_sensitive;
end;
$$;

create or replace function nile_private.preserve_form_submission_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Form submissions are immutable evidence'
      using errcode = '55000';
  end if;

  if old.id is distinct from new.id
    or old.definition_id is distinct from new.definition_id
    or old.publication_id is distinct from new.publication_id
    or old.version_id is distinct from new.version_id
    or old.assignment_id is distinct from new.assignment_id
    or old.respondent_user_id is distinct from new.respondent_user_id
    or old.respondent_role is distinct from new.respondent_role
    or old.branch_id is distinct from new.branch_id
    or old.department_id is distinct from new.department_id
    or old.source is distinct from new.source
    or old.answer_json is distinct from new.answer_json
    or old.client_submission_id is distinct from new.client_submission_id
    or old.client_submitted_at is distinct from new.client_submitted_at
    or old.submitted_at is distinct from new.submitted_at
    or old.command_id is distinct from new.command_id
    or old.public_command_id is distinct from new.public_command_id
    or old.legacy_source_form_id is distinct from new.legacy_source_form_id
    or old.legacy_source_submission_id is distinct from new.legacy_source_submission_id
    or old.legacy_payload_hash is distinct from new.legacy_payload_hash
    or old.legacy_import_run_id is distinct from new.legacy_import_run_id then
    raise exception 'Form submission answers and provenance are immutable'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create or replace function nile_private.preserve_outbox_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.command_id is distinct from new.command_id
    or old.public_command_id is distinct from new.public_command_id
    or old.event_type is distinct from new.event_type
    or old.aggregate_type is distinct from new.aggregate_type
    or old.aggregate_id is distinct from new.aggregate_id
    or old.payload is distinct from new.payload
    or old.idempotency_key is distinct from new.idempotency_key
    or old.created_at is distinct from new.created_at then
    raise exception 'Outbox event identity and payload are immutable'
      using errcode = '55000';
  end if;

  if not (
    old.status = new.status
    or (old.status = 'pending' and new.status in ('processing', 'dead_letter'))
    or (old.status = 'processing' and new.status in ('succeeded', 'failed', 'dead_letter'))
    or (old.status = 'failed' and new.status in ('processing', 'dead_letter'))
  ) then
    raise exception 'Invalid outbox transition from % to %', old.status, new.status
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create function nile_private.preserve_role_grant_permission_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Role-grant permission evidence is immutable'
      using errcode = '55000';
  end if;
  if old.id is distinct from new.id
    or old.role_grant_id is distinct from new.role_grant_id
    or old.permission_code is distinct from new.permission_code
    or old.source is distinct from new.source
    or old.granted_by is distinct from new.granted_by
    or old.command_id is distinct from new.command_id
    or old.reason is distinct from new.reason
    or old.starts_at is distinct from new.starts_at
    or old.ends_at is distinct from new.ends_at
    or old.created_at is distinct from new.created_at then
    raise exception 'Role-grant permission provenance is immutable'
      using errcode = '55000';
  end if;
  if old.status = 'revoked' and old is distinct from new then
    raise exception 'Revoked role-grant permission evidence cannot be rewritten'
      using errcode = '55000';
  end if;
  if old.status = 'active' and new.status = 'revoked'
    and new.revoked_at is not null and new.revoked_by is not null then
    return new;
  end if;
  if old is distinct from new then
    raise exception 'Invalid role-grant permission transition'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger role_grant_permissions_preserve_evidence
before update or delete on public.role_grant_permissions
for each row execute function nile_private.preserve_role_grant_permission_evidence();
create trigger form_command_results_immutable
before update or delete on public.form_command_results
for each row execute function nile_private.reject_immutable_change();
create trigger form_public_commands_preserve_evidence
before update or delete on public.form_public_commands
for each row execute function nile_private.preserve_form_command_evidence();
create trigger form_offline_bundles_immutable
before update or delete on public.form_offline_bundles
for each row execute function nile_private.reject_immutable_change();
create trigger form_offline_bundle_items_immutable
before update or delete on public.form_offline_bundle_items
for each row execute function nile_private.reject_immutable_change();
create trigger nile_forms_repository_contract_immutable
before update or delete on public.nile_forms_repository_contract
for each row execute function nile_private.reject_immutable_change();

create function nile_private.nile_forms_definition_allowed(
  p_role text,
  p_user_id uuid,
  p_role_grant_id uuid,
  p_branch_ids uuid[],
  p_department_ids uuid[],
  p_definition public.form_definitions
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when p_role = 'superadmin' then true
    when p_role not in ('registrar', 'headofdepartment', 'branchadmin') then false
    when p_definition.owner_user_id = p_user_id
      and p_definition.owner_role_grant_id = p_role_grant_id then true
    when p_definition.branch_id is not null
      and p_definition.branch_id = any(p_branch_ids)
      and (
        p_definition.department_id is null
        or p_definition.department_id = any(p_department_ids)
      ) then true
    when p_definition.department_id is not null
      and p_definition.department_id = any(p_department_ids) then true
    else false
  end
$$;

create function nile_private.nile_forms_submission_allowed(
  p_role text,
  p_branch_ids uuid[],
  p_department_ids uuid[],
  p_submission public.form_submissions
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when p_role = 'superadmin' then true
    when p_submission.branch_id is not null
      and not (p_submission.branch_id = any(p_branch_ids)) then false
    when p_submission.department_id is not null
      and not (p_submission.department_id = any(p_department_ids)) then false
    when p_submission.branch_id is null and p_submission.department_id is null then false
    else true
  end
$$;

create function nile_private.nile_forms_assignment_matches(
  p_assignment public.form_assignments,
  p_user_id uuid,
  p_role text,
  p_branch_ids uuid[],
  p_department_ids uuid[]
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select p_assignment.revoked_at is null
    and (p_assignment.expires_at is null or p_assignment.expires_at > pg_catalog.statement_timestamp())
    and case p_assignment.target_type
      when 'user' then p_assignment.target_user_id = p_user_id
      when 'role' then p_assignment.target_role = p_role
      when 'branch' then p_assignment.target_branch_id = any(p_branch_ids)
      when 'department' then p_assignment.target_department_id = any(p_department_ids)
      else false
    end
$$;

create function nile_private.validate_nile_forms_rpc_input(
  p_operation text,
  p_target_id text,
  p_input jsonb
)
returns void
language plpgsql
immutable
security invoker
set search_path = ''
as $$
begin
  if p_operation is null or char_length(p_operation) > 100
    or p_operation !~ '^forms\.[a-z][a-z0-9_.]+$' then
    raise exception 'Nile Forms operation is invalid'
      using errcode = '22023';
  end if;
  if p_target_id is not null and char_length(p_target_id) > 200 then
    raise exception 'Nile Forms target is invalid'
      using errcode = '22023';
  end if;
  if pg_catalog.jsonb_typeof(coalesce(p_input, '{}'::jsonb)) <> 'object'
    or pg_catalog.octet_length(coalesce(p_input, '{}'::jsonb)::text) > 1048576 then
    raise exception 'Nile Forms input is invalid or too large'
      using errcode = '22023';
  end if;
  if nile_private.jsonb_has_forbidden_keys(
    coalesce(p_input, '{}'::jsonb) - 'guestTokenHash' - 'deviceTokenHash'
  ) then
    raise exception 'Nile Forms input contains a forbidden key'
      using errcode = '22023';
  end if;
end;
$$;

create function nile_private.project_nile_form_submission(
  p_submission public.form_submissions,
  p_mode text,
  p_can_read_sensitive boolean
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select (pg_catalog.to_jsonb(p_submission) - 'answer_json')
    || pg_catalog.jsonb_build_object(
      'answer_json',
      nile_private.project_nile_form_answers(
        p_submission.answer_json,
        version.schema_json,
        p_mode,
        p_can_read_sensitive
      )
    )
  from public.form_versions as version
  where version.id = p_submission.version_id
$$;

create function public.nile_forms_query(
  p_token_hash text,
  p_operation text,
  p_target_id text,
  p_input jsonb
)
returns table (data jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_authority record;
  v_definition public.form_definitions%rowtype;
  v_submission public.form_submissions%rowtype;
  v_result jsonb;
begin
  perform nile_private.validate_nile_forms_rpc_input(
    p_operation,
    p_target_id,
    coalesce(p_input, '{}'::jsonb)
  );
  select *
  into strict v_authority
  from nile_private.require_nile_forms_authority(
    p_token_hash,
    p_operation,
    'query'
  );

  if p_operation = 'forms.definitions.list' then
    select coalesce(
      pg_catalog.jsonb_agg(pg_catalog.to_jsonb(definition) order by definition.updated_at desc),
      '[]'::jsonb
    )
    into v_result
    from public.form_definitions as definition
    where nile_private.nile_forms_definition_allowed(
      v_authority.active_role,
      v_authority.user_id,
      v_authority.role_grant_id,
      v_authority.branch_ids,
      v_authority.department_ids,
      definition
    );
  elsif p_operation = 'forms.definitions.get' then
    select definition.*
    into v_definition
    from public.form_definitions as definition
    where definition.id = p_target_id::uuid;
    if not found or not nile_private.nile_forms_definition_allowed(
      v_authority.active_role,
      v_authority.user_id,
      v_authority.role_grant_id,
      v_authority.branch_ids,
      v_authority.department_ids,
      v_definition
    ) then
      raise exception 'Nile Forms definition scope is denied'
        using errcode = '42501';
    end if;
    select pg_catalog.jsonb_build_object(
      'definition', pg_catalog.to_jsonb(v_definition),
      'versions', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(version) order by version.version_number desc)
        from public.form_versions as version
        where version.definition_id = v_definition.id
      ), '[]'::jsonb),
      'publications', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(publication) order by publication.created_at desc)
        from public.form_publications as publication
        where publication.definition_id = v_definition.id
      ), '[]'::jsonb),
      'assignments', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(assignment) order by assignment.assigned_at desc)
        from public.form_assignments as assignment
        join public.form_publications as publication on publication.id = assignment.publication_id
        where publication.definition_id = v_definition.id
      ), '[]'::jsonb)
    ) into v_result;
  elsif p_operation = 'forms.management.options' then
    v_result := pg_catalog.jsonb_build_object(
      'role', v_authority.active_role,
      'branchIds', pg_catalog.to_jsonb(v_authority.branch_ids),
      'departmentIds', pg_catalog.to_jsonb(v_authority.department_ids)
    );
  elsif p_operation in ('forms.assigned.list', 'forms.assigned.get') then
    select coalesce(
      pg_catalog.jsonb_agg(item.payload order by item.created_at desc),
      '[]'::jsonb
    )
    into v_result
    from (
      select
        publication.created_at,
        pg_catalog.jsonb_build_object(
          'publication', pg_catalog.to_jsonb(publication),
          'definition', pg_catalog.to_jsonb(definition),
          'version', pg_catalog.to_jsonb(version)
        ) as payload
      from public.form_publications as publication
      join public.form_definitions as definition on definition.id = publication.definition_id
      join public.form_versions as version on version.id = publication.version_id
      where publication.status in ('open', 'scheduled')
        and (publication.opens_at is null or publication.opens_at <= pg_catalog.statement_timestamp())
        and (publication.closes_at is null or publication.closes_at > pg_catalog.statement_timestamp())
        and (p_operation = 'forms.assigned.list' or publication.id = p_target_id::uuid)
        and (
          publication.audience = 'authenticated'
          or (
            publication.audience = 'assigned'
            and exists (
              select 1
              from public.form_assignments as assignment
              where assignment.publication_id = publication.id
                and nile_private.nile_forms_assignment_matches(
                  assignment,
                  v_authority.user_id,
                  v_authority.active_role,
                  v_authority.branch_ids,
                  v_authority.department_ids
                )
            )
          )
        )
    ) as item;
    if p_operation = 'forms.assigned.get' then
      if pg_catalog.jsonb_array_length(v_result) <> 1 then
        raise exception 'Nile Forms assignment authority is denied'
          using errcode = '42501';
      end if;
      v_result := v_result -> 0;
    end if;
  elsif p_operation = 'forms.submissions.own.get' then
    select submission.*
    into v_submission
    from public.form_submissions as submission
    where submission.id = p_target_id::uuid
      and submission.respondent_user_id = v_authority.user_id;
    if not found then
      raise exception 'Nile Forms submission ownership is denied'
        using errcode = '42501';
    end if;
    v_result := nile_private.project_nile_form_submission(
      v_submission,
      'projection',
      v_authority.can_read_sensitive
    );
  elsif p_operation = 'forms.drafts.load' then
    select pg_catalog.to_jsonb(draft)
    into v_result
    from public.form_drafts as draft
    where draft.id = p_target_id::uuid
      and draft.respondent_user_id = v_authority.user_id
      and draft.expires_at > pg_catalog.statement_timestamp();
    if not found then
      raise exception 'Nile Forms draft ownership is denied'
        using errcode = '42501';
    end if;
  elsif p_operation in (
    'forms.submissions.list',
    'forms.submissions.get',
    'forms.submissions.export'
  ) then
    if p_operation = 'forms.submissions.get' then
      select submission.*
      into v_submission
      from public.form_submissions as submission
      where submission.id = p_target_id::uuid;
      if not found or not nile_private.nile_forms_submission_allowed(
        v_authority.active_role,
        v_authority.branch_ids,
        v_authority.department_ids,
        v_submission
      ) then
        raise exception 'Nile Forms submission scope is denied'
          using errcode = '42501';
      end if;
      v_result := pg_catalog.jsonb_build_object(
        'submission', nile_private.project_nile_form_submission(
          v_submission,
          'projection',
          v_authority.can_read_sensitive
        ),
        'reviews', coalesce((
          select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(review) order by review.created_at)
          from public.form_reviews as review
          where review.submission_id = v_submission.id
        ), '[]'::jsonb),
        'promotions', coalesce((
          select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(promotion) order by promotion.created_at)
          from public.form_promotions as promotion
          where promotion.submission_id = v_submission.id
        ), '[]'::jsonb)
      );
    else
      select coalesce(
        pg_catalog.jsonb_agg(
          nile_private.project_nile_form_submission(
            submission,
            case when p_operation = 'forms.submissions.export' then 'export' else 'projection' end,
            v_authority.can_read_sensitive
          ) order by submission.submitted_at desc
        ),
        '[]'::jsonb
      )
      into v_result
      from public.form_submissions as submission
      where nile_private.nile_forms_submission_allowed(
        v_authority.active_role,
        v_authority.branch_ids,
        v_authority.department_ids,
        submission
      );
    end if;
  elsif p_operation = 'forms.offline.bundle.get' then
    select pg_catalog.jsonb_build_object(
      'bundle', pg_catalog.to_jsonb(bundle),
      'items', coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(item) order by item.id)
        from public.form_offline_bundle_items as item
        where item.bundle_id = bundle.id
      ), '[]'::jsonb)
    )
    into v_result
    from public.form_offline_bundles as bundle
    join public.form_offline_devices as device on device.id = bundle.device_id
    where bundle.id = p_target_id::uuid
      and bundle.role_grant_id = v_authority.role_grant_id
      and device.user_id = v_authority.user_id
      and device.revoked_at is null
      and device.expires_at > pg_catalog.statement_timestamp()
      and bundle.expires_at > pg_catalog.statement_timestamp();
    if not found then
      raise exception 'Nile Forms offline bundle authority is denied'
        using errcode = '42501';
    end if;
  elsif p_operation in ('forms.migration.status', 'forms.migration.runs.list') then
    if v_authority.active_role <> 'superadmin' then
      raise exception 'Nile Forms migration authority is denied'
        using errcode = '42501';
    end if;
    if p_operation = 'forms.migration.status' then
      select pg_catalog.jsonb_build_object(
        'runs', count(*),
        'pendingRecords', count(*) filter (where record.reconciliation_status = 'pending')
      )
      into v_result
      from public.form_legacy_import_runs as run
      left join public.form_legacy_import_records as record on record.run_id = run.id;
    else
      select coalesce(
        pg_catalog.jsonb_agg(pg_catalog.to_jsonb(run) order by run.created_at desc),
        '[]'::jsonb
      )
      into v_result
      from public.form_legacy_import_runs as run;
    end if;
  else
    raise exception 'Nile Forms query operation is not implemented'
      using errcode = '42501';
  end if;

  return query select coalesce(v_result, 'null'::jsonb);
end;
$$;

create function public.nile_forms_public_query(
  p_operation text,
  p_target_id text
)
returns table (data jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform nile_private.validate_nile_forms_rpc_input(
    p_operation,
    p_target_id,
    '{}'::jsonb
  );
  if p_operation <> 'forms.publications.public.get' then
    raise exception 'Nile Forms public query is not registered'
      using errcode = '42501';
  end if;
  select pg_catalog.jsonb_build_object(
    'publication', pg_catalog.to_jsonb(publication),
    'definition', pg_catalog.to_jsonb(definition),
    'version', pg_catalog.to_jsonb(version)
  )
  into v_result
  from public.form_publications as publication
  join public.form_definitions as definition on definition.id = publication.definition_id
  join public.form_versions as version on version.id = publication.version_id
  where pg_catalog.lower(publication.slug) = pg_catalog.lower(p_target_id)
    and publication.audience = 'public'
    and publication.status = 'open'
    and (publication.opens_at is null or publication.opens_at <= pg_catalog.statement_timestamp())
    and (publication.closes_at is null or publication.closes_at > pg_catalog.statement_timestamp());
  if not found then
    raise exception 'Nile Forms public publication is unavailable'
      using errcode = '42501';
  end if;
  return query select v_result;
end;
$$;

create function public.nile_forms_contract_status()
returns table (
  "catalogVersion" text,
  "schemaEvidenceSha256" text,
  "executorRole" text,
  "draftKeyVersion" integer,
  "publicHmacKeyVersion" integer,
  "publicHmacPreviousKeyVersion" integer,
  "offlineMacKeyVersion" integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    contract.catalog_version,
    contract.schema_evidence_sha256,
    contract.executor_role,
    contract.draft_key_version,
    contract.public_hmac_key_version,
    contract.public_hmac_previous_key_version,
    contract.offline_mac_key_version
  from public.nile_forms_repository_contract as contract
  where contract.singleton
$$;

create function public.nile_forms_command(
  p_token_hash text,
  p_operation text,
  p_target_id text,
  p_input jsonb,
  p_idempotency_key text,
  p_request_hash text
)
returns table (data jsonb, replayed boolean, command_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_authority record;
  v_existing_command public.command_executions%rowtype;
  v_command_id uuid;
  v_result jsonb;
  v_requires_outbox boolean;
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_definition public.form_definitions%rowtype;
  v_version public.form_versions%rowtype;
  v_publication public.form_publications%rowtype;
  v_assignment public.form_assignments%rowtype;
  v_draft public.form_drafts%rowtype;
  v_submission public.form_submissions%rowtype;
  v_review public.form_reviews%rowtype;
  v_device public.form_offline_devices%rowtype;
  v_bundle public.form_offline_bundles%rowtype;
  v_bundle_item public.form_offline_bundle_items%rowtype;
  v_sync_receipt public.form_sync_receipts%rowtype;
  v_target_grant public.role_grants%rowtype;
  v_grant_permission public.role_grant_permissions%rowtype;
  v_import_run public.form_legacy_import_runs%rowtype;
  v_import_record public.form_legacy_import_records%rowtype;
  v_branch_id uuid;
  v_department_id uuid;
  v_version_id uuid;
  v_slug text;
  v_audience text;
  v_target_type text;
  v_target_value text;
  v_sync_status text;
begin
  perform nile_private.validate_nile_forms_rpc_input(
    p_operation,
    p_target_id,
    coalesce(p_input, '{}'::jsonb)
  );
  if p_idempotency_key is null
    or char_length(p_idempotency_key) not between 8 and 200
    or p_request_hash is null
    or p_request_hash !~ '^[0-9a-fA-F]{64}$' then
    raise exception 'Nile Forms command evidence is invalid'
      using errcode = '22023';
  end if;

  select *
  into strict v_authority
  from nile_private.require_nile_forms_authority(
    p_token_hash,
    p_operation,
    'command'
  );

  v_requires_outbox := p_operation in (
    'forms.submissions.submit',
    'forms.submissions.review'
  );
  insert into public.command_executions (
    idempotency_key,
    actor_user_id,
    actor_role_grant_id,
    session_id,
    command_type,
    target_type,
    target_id,
    request_hash,
    requires_outbox
  )
  values (
    p_idempotency_key,
    v_authority.user_id,
    v_authority.role_grant_id,
    v_authority.session_id,
    p_operation,
    'nile_form',
    p_target_id,
    pg_catalog.decode(pg_catalog.lower(p_request_hash), 'hex'),
    v_requires_outbox
  )
  on conflict (idempotency_key) do nothing
  returning id into v_command_id;

  if v_command_id is null then
    select command.*
    into strict v_existing_command
    from public.command_executions as command
    where command.idempotency_key = p_idempotency_key
    for update;
    if v_existing_command.actor_user_id is distinct from v_authority.user_id
      or v_existing_command.actor_role_grant_id is distinct from v_authority.role_grant_id
      or v_existing_command.session_id is distinct from v_authority.session_id
      or v_existing_command.command_type is distinct from p_operation
      or v_existing_command.target_id is distinct from p_target_id
      or v_existing_command.request_hash is distinct from pg_catalog.decode(pg_catalog.lower(p_request_hash), 'hex')
      or v_existing_command.status <> 'succeeded' then
      raise exception 'Nile Forms idempotency evidence conflicts with this request'
        using errcode = '23505';
    end if;
    select result.result_json
    into strict v_result
    from public.form_command_results as result
    where result.command_id = v_existing_command.id;
    return query select v_result, true, v_existing_command.id;
    return;
  end if;

  if p_operation = 'forms.definitions.create' then
    if v_authority.active_role not in ('registrar', 'headofdepartment', 'branchadmin', 'superadmin') then
      raise exception 'Nile Forms owner role is denied'
        using errcode = '42501';
    end if;
    v_branch_id := nullif(p_input ->> 'branchId', '')::uuid;
    v_department_id := nullif(p_input ->> 'departmentId', '')::uuid;
    if v_authority.active_role = 'superadmin' then
      if v_branch_id is not null or v_department_id is not null then
        raise exception 'Super Admin definitions must be global'
          using errcode = '42501';
      end if;
    elsif v_authority.active_role in ('registrar', 'branchadmin') then
      if v_branch_id is null or not (v_branch_id = any(v_authority.branch_ids))
        or v_department_id is not null then
        raise exception 'Nile Forms branch ownership is denied'
          using errcode = '42501';
      end if;
    elsif v_department_id is null
      or not (v_department_id = any(v_authority.department_ids)) then
      raise exception 'Nile Forms department ownership is denied'
        using errcode = '42501';
    end if;
    if p_input ->> 'category' not in (
      'admissions', 'student_support', 'attendance', 'consent', 'branch_operations'
    ) or coalesce(p_input ->> 'key', '') !~ '^[a-z][a-z0-9_:-]{2,79}$'
      or char_length(coalesce(p_input ->> 'title', '')) not between 1 and 200
      or pg_catalog.jsonb_typeof(p_input -> 'schema') <> 'object'
      or pg_catalog.jsonb_typeof(p_input -> 'logic') <> 'array'
      or pg_catalog.jsonb_typeof(p_input -> 'translations') <> 'object'
      or coalesce(p_input ->> 'contentHash', '') !~ '^[0-9a-fA-F]{64}$' then
      raise exception 'Nile Forms definition input is invalid'
        using errcode = '22023';
    end if;
    if v_authority.active_role = 'registrar' and p_input ->> 'category' <> 'admissions' then
      raise exception 'Registrar Forms ownership is limited to admissions'
        using errcode = '42501';
    end if;
    if v_authority.active_role = 'branchadmin'
      and p_input ->> 'category' not in ('attendance', 'consent', 'branch_operations') then
      raise exception 'Branch Admin Forms ownership is denied for this category'
        using errcode = '42501';
    end if;
    if v_authority.active_role = 'headofdepartment'
      and p_input ->> 'category' not in ('attendance', 'consent') then
      raise exception 'HOD Forms ownership is denied for this category'
        using errcode = '42501';
    end if;
    insert into public.form_definitions (
      form_key,
      title,
      category,
      owner_user_id,
      owner_role_grant_id,
      owner_role,
      branch_id,
      department_id
    )
    values (
      p_input ->> 'key',
      p_input ->> 'title',
      p_input ->> 'category',
      v_authority.user_id,
      v_authority.role_grant_id,
      v_authority.active_role,
      v_branch_id,
      v_department_id
    )
    returning * into v_definition;
    insert into public.form_versions (
      definition_id,
      version_number,
      schema_json,
      logic_json,
      translations_json,
      content_hash,
      authored_by
    )
    values (
      v_definition.id,
      1,
      p_input -> 'schema',
      p_input -> 'logic',
      p_input -> 'translations',
      pg_catalog.decode(pg_catalog.lower(p_input ->> 'contentHash'), 'hex'),
      v_authority.user_id
    )
    returning * into v_version;
    update public.form_definitions
    set current_draft_version_id = v_version.id
    where id = v_definition.id
    returning * into v_definition;
    v_result := pg_catalog.jsonb_build_object(
      'definition', pg_catalog.to_jsonb(v_definition),
      'version', pg_catalog.to_jsonb(v_version)
    );
  elsif p_operation in (
    'forms.versions.draft.create',
    'forms.versions.draft.update',
    'forms.versions.publish'
  ) then
    select definition.*
    into v_definition
    from public.form_definitions as definition
    where definition.id = p_target_id::uuid
    for update;
    if not found or not nile_private.nile_forms_definition_allowed(
      v_authority.active_role,
      v_authority.user_id,
      v_authority.role_grant_id,
      v_authority.branch_ids,
      v_authority.department_ids,
      v_definition
    ) then
      raise exception 'Nile Forms definition scope is denied'
        using errcode = '42501';
    end if;
    if p_operation = 'forms.versions.draft.create' then
      if v_definition.current_draft_version_id is not null then
        select version.* into strict v_version
        from public.form_versions as version
        where version.id = v_definition.current_draft_version_id;
      else
        select version.*
        into v_version
        from public.form_versions as version
        where version.definition_id = v_definition.id
        order by version.version_number desc
        limit 1
        for share;
        if not found then
          raise exception 'Nile Forms source version is missing'
            using errcode = '23514';
        end if;
        insert into public.form_versions (
          definition_id,
          version_number,
          schema_json,
          logic_json,
          translations_json,
          content_hash,
          authored_by
        )
        select
          v_definition.id,
          coalesce(max(version.version_number), 0) + 1,
          v_version.schema_json,
          v_version.logic_json,
          v_version.translations_json,
          v_version.content_hash,
          v_authority.user_id
        from public.form_versions as version
        where version.definition_id = v_definition.id
        returning * into v_version;
        update public.form_definitions
        set current_draft_version_id = v_version.id
        where id = v_definition.id;
      end if;
      v_result := pg_catalog.to_jsonb(v_version);
    elsif p_operation = 'forms.versions.draft.update' then
      v_version_id := nullif(p_input ->> 'versionId', '')::uuid;
      select version.*
      into v_version
      from public.form_versions as version
      where version.id = v_version_id
        and version.definition_id = v_definition.id
      for update;
      if not found or v_version.status <> 'draft'
        or v_definition.current_draft_version_id is distinct from v_version.id
        or v_version.revision <> (p_input ->> 'expectedRevision')::integer then
        raise exception 'Nile Forms draft revision conflicts with current evidence'
          using errcode = '40001';
      end if;
      if pg_catalog.jsonb_typeof(p_input -> 'schema') <> 'object'
        or pg_catalog.jsonb_typeof(p_input -> 'logic') <> 'array'
        or pg_catalog.jsonb_typeof(p_input -> 'translations') <> 'object'
        or coalesce(p_input ->> 'contentHash', '') !~ '^[0-9a-fA-F]{64}$' then
        raise exception 'Nile Forms draft schema is invalid'
          using errcode = '22023';
      end if;
      update public.form_versions
      set
        schema_json = p_input -> 'schema',
        logic_json = p_input -> 'logic',
        translations_json = p_input -> 'translations',
        content_hash = pg_catalog.decode(pg_catalog.lower(p_input ->> 'contentHash'), 'hex'),
        revision = revision + 1,
        updated_at = v_now
      where id = v_version.id
      returning * into v_version;
      v_result := pg_catalog.to_jsonb(v_version);
    else
      v_version_id := nullif(p_input ->> 'versionId', '')::uuid;
      v_slug := pg_catalog.lower(coalesce(p_input ->> 'slug', ''));
      v_audience := p_input ->> 'audience';
      if v_slug !~ '^[a-z0-9][a-z0-9-]{2,79}$'
        or v_audience not in ('public', 'authenticated', 'assigned') then
        raise exception 'Nile Forms publication input is invalid'
          using errcode = '22023';
      end if;
      select version.*
      into v_version
      from public.form_versions as version
      where version.id = v_version_id
        and version.definition_id = v_definition.id
      for update;
      if not found or v_version.status <> 'draft'
        or v_definition.current_draft_version_id is distinct from v_version.id then
        raise exception 'Only the current Nile Forms draft can be published'
          using errcode = '40001';
      end if;
      perform 1
      from public.form_publications as publication
      where pg_catalog.lower(publication.slug) = v_slug
        and publication.status <> 'retired'
      order by publication.id
      for update;
      if exists (
        select 1
        from public.form_publications as publication
        where pg_catalog.lower(publication.slug) = v_slug
          and publication.status <> 'retired'
          and publication.definition_id <> v_definition.id
      ) then
        raise exception 'Nile Forms publication slug is already owned'
          using errcode = '23505';
      end if;
      update public.form_publications
      set status = 'retired', retired_at = v_now
      where pg_catalog.lower(slug) = v_slug and status <> 'retired';
      update public.form_versions
      set
        status = 'published',
        published_by = v_authority.user_id,
        published_at = v_now,
        updated_at = v_now
      where id = v_version.id
      returning * into v_version;
      update public.form_definitions
      set
        current_draft_version_id = null,
        current_published_version_id = v_version.id,
        status = 'active',
        updated_at = v_now
      where id = v_definition.id;
      insert into public.form_publications (
        definition_id,
        version_id,
        slug,
        audience,
        status,
        opens_at,
        closes_at,
        allow_multiple,
        allow_drafts,
        offline_eligible,
        created_by,
        command_id
      )
      values (
        v_definition.id,
        v_version.id,
        v_slug,
        v_audience,
        case
          when nullif(p_input ->> 'opensAt', '')::timestamptz > v_now then 'scheduled'
          else 'open'
        end,
        nullif(p_input ->> 'opensAt', '')::timestamptz,
        nullif(p_input ->> 'closesAt', '')::timestamptz,
        coalesce((p_input ->> 'allowMultiple')::boolean, false),
        coalesce((p_input ->> 'allowDrafts')::boolean, true),
        coalesce((p_input ->> 'offlineEligible')::boolean, false),
        v_authority.user_id,
        v_command_id
      )
      returning * into v_publication;
      v_result := pg_catalog.jsonb_build_object(
        'version', pg_catalog.to_jsonb(v_version),
        'publication', pg_catalog.to_jsonb(v_publication)
      );
    end if;
  elsif p_operation = 'forms.publications.retire' then
    select publication.*
    into v_publication
    from public.form_publications as publication
    where publication.id = p_target_id::uuid
    for update;
    if not found then
      raise exception 'Nile Forms publication is missing'
        using errcode = '42501';
    end if;
    select definition.* into strict v_definition
    from public.form_definitions as definition
    where definition.id = v_publication.definition_id
    for share;
    if not nile_private.nile_forms_definition_allowed(
      v_authority.active_role,
      v_authority.user_id,
      v_authority.role_grant_id,
      v_authority.branch_ids,
      v_authority.department_ids,
      v_definition
    ) then
      raise exception 'Nile Forms publication scope is denied'
        using errcode = '42501';
    end if;
    if v_publication.status <> 'retired' then
      update public.form_publications
      set status = 'retired', retired_at = v_now
      where id = v_publication.id
      returning * into v_publication;
    end if;
    v_result := pg_catalog.to_jsonb(v_publication);
  elsif p_operation in ('forms.assignments.create', 'forms.assignments.revoke') then
    if p_operation = 'forms.assignments.create' then
      select publication.*
      into v_publication
      from public.form_publications as publication
      where publication.id = p_target_id::uuid
      for update;
      if not found or v_publication.audience <> 'assigned'
        or v_publication.status in ('closed', 'retired') then
        raise exception 'Nile Forms publication cannot be assigned'
          using errcode = '42501';
      end if;
      select definition.* into strict v_definition
      from public.form_definitions as definition
      where definition.id = v_publication.definition_id
      for share;
      if not nile_private.nile_forms_definition_allowed(
        v_authority.active_role,
        v_authority.user_id,
        v_authority.role_grant_id,
        v_authority.branch_ids,
        v_authority.department_ids,
        v_definition
      ) then
        raise exception 'Nile Forms assignment scope is denied'
          using errcode = '42501';
      end if;
      v_target_type := p_input ->> 'targetType';
      v_target_value := p_input ->> 'targetValue';
      if v_target_type not in ('user', 'role', 'branch', 'department', 'course', 'class')
        or coalesce(v_target_value, '') = '' then
        raise exception 'Nile Forms assignment target is invalid'
          using errcode = '22023';
      end if;
      if v_target_type = 'branch'
        and v_authority.active_role <> 'superadmin'
        and not (v_target_value::uuid = any(v_authority.branch_ids)) then
        raise exception 'Nile Forms target branch is denied'
          using errcode = '42501';
      end if;
      if v_target_type = 'department'
        and v_authority.active_role <> 'superadmin'
        and not (v_target_value::uuid = any(v_authority.department_ids)) then
        raise exception 'Nile Forms target department is denied'
          using errcode = '42501';
      end if;
      if v_target_type in ('user', 'course', 'class')
        and v_authority.active_role <> 'superadmin' then
        raise exception 'This Nile Forms assignment target requires global authority'
          using errcode = '42501';
      end if;
      insert into public.form_assignments (
        publication_id,
        target_type,
        target_user_id,
        target_role,
        target_branch_id,
        target_department_id,
        target_key,
        assigned_by,
        command_id,
        expires_at
      )
      values (
        v_publication.id,
        v_target_type,
        case when v_target_type = 'user' then v_target_value::uuid end,
        case when v_target_type = 'role' then v_target_value end,
        case when v_target_type = 'branch' then v_target_value::uuid end,
        case when v_target_type = 'department' then v_target_value::uuid end,
        case when v_target_type in ('course', 'class') then v_target_value end,
        v_authority.user_id,
        v_command_id,
        nullif(p_input ->> 'expiresAt', '')::timestamptz
      )
      returning * into v_assignment;
    else
      select assignment.*
      into v_assignment
      from public.form_assignments as assignment
      where assignment.id = p_target_id::uuid
      for update;
      if not found then
        raise exception 'Nile Forms assignment is missing'
          using errcode = '42501';
      end if;
      select publication.* into strict v_publication
      from public.form_publications as publication
      where publication.id = v_assignment.publication_id
      for share;
      select definition.* into strict v_definition
      from public.form_definitions as definition
      where definition.id = v_publication.definition_id
      for share;
      if not nile_private.nile_forms_definition_allowed(
        v_authority.active_role,
        v_authority.user_id,
        v_authority.role_grant_id,
        v_authority.branch_ids,
        v_authority.department_ids,
        v_definition
      ) then
        raise exception 'Nile Forms assignment scope is denied'
          using errcode = '42501';
      end if;
      if v_assignment.revoked_at is null then
        update public.form_assignments
        set revoked_at = v_now
        where id = v_assignment.id
        returning * into v_assignment;
      end if;
    end if;
    v_result := pg_catalog.to_jsonb(v_assignment);
  elsif p_operation = 'forms.drafts.save' then
    select publication.*
    into v_publication
    from public.form_publications as publication
    where publication.id = p_target_id::uuid
    for update;
    if not found or v_publication.status not in ('open', 'scheduled')
      or (v_publication.opens_at is not null and v_publication.opens_at > v_now)
      or (v_publication.closes_at is not null and v_publication.closes_at <= v_now)
      or v_publication.audience = 'public' then
      raise exception 'Nile Forms draft publication is unavailable'
        using errcode = '42501';
    end if;
    if v_publication.audience = 'assigned' then
      select assignment.*
      into v_assignment
      from public.form_assignments as assignment
      where assignment.publication_id = v_publication.id
        and nile_private.nile_forms_assignment_matches(
          assignment,
          v_authority.user_id,
          v_authority.active_role,
          v_authority.branch_ids,
          v_authority.department_ids
        )
      order by assignment.id
      limit 1
      for update;
      if not found then
        raise exception 'Nile Forms draft assignment is denied'
          using errcode = '42501';
      end if;
    end if;
    if coalesce(p_input ->> 'encryptedPayload', '') !~ '^[0-9a-fA-F]+$'
      or length(p_input ->> 'encryptedPayload') % 2 <> 0
      or coalesce(p_input ->> 'payloadNonce', '') !~ '^[0-9a-fA-F]{24}$'
      or coalesce((p_input ->> 'payloadKeyVersion')::integer, 0) < 1 then
      raise exception 'Nile Forms encrypted draft payload is invalid'
        using errcode = '22023';
    end if;
    select draft.*
    into v_draft
    from public.form_drafts as draft
    where draft.publication_id = v_publication.id
      and draft.version_id = v_publication.version_id
      and draft.respondent_user_id = v_authority.user_id
    for update;
    if found then
      if nullif(p_input ->> 'expectedRevision', '') is null
        or v_draft.revision <> (p_input ->> 'expectedRevision')::integer then
        raise exception 'Nile Forms draft revision conflicts with current evidence'
          using errcode = '40001';
      end if;
      if v_draft.assignment_id is distinct from v_assignment.id then
        raise exception 'Nile Forms draft assignment changed'
          using errcode = '42501';
      end if;
      update public.form_drafts
      set
        encrypted_payload = pg_catalog.decode(p_input ->> 'encryptedPayload', 'hex'),
        payload_nonce = pg_catalog.decode(p_input ->> 'payloadNonce', 'hex'),
        payload_key_version = (p_input ->> 'payloadKeyVersion')::integer,
        revision = revision + 1,
        expires_at = least(
          coalesce(v_publication.closes_at, v_now + interval '30 days'),
          v_now + interval '30 days'
        ),
        updated_at = v_now
      where id = v_draft.id
      returning * into v_draft;
    else
      insert into public.form_drafts (
        publication_id,
        definition_id,
        version_id,
        assignment_id,
        respondent_user_id,
        encrypted_payload,
        payload_nonce,
        payload_key_version,
        expires_at,
        command_id
      )
      values (
        v_publication.id,
        v_publication.definition_id,
        v_publication.version_id,
        v_assignment.id,
        v_authority.user_id,
        pg_catalog.decode(p_input ->> 'encryptedPayload', 'hex'),
        pg_catalog.decode(p_input ->> 'payloadNonce', 'hex'),
        (p_input ->> 'payloadKeyVersion')::integer,
        least(
          coalesce(v_publication.closes_at, v_now + interval '30 days'),
          v_now + interval '30 days'
        ),
        v_command_id
      )
      returning * into v_draft;
    end if;
    v_result := pg_catalog.jsonb_build_object(
      'draftId', v_draft.id,
      'revision', v_draft.revision,
      'expiresAt', v_draft.expires_at
    );
  elsif p_operation = 'forms.submissions.submit' then
    select publication.*
    into v_publication
    from public.form_publications as publication
    where publication.id = p_target_id::uuid
    for update;
    if not found or v_publication.status <> 'open'
      or (v_publication.opens_at is not null and v_publication.opens_at > v_now)
      or (v_publication.closes_at is not null and v_publication.closes_at <= v_now)
      or v_publication.audience = 'public' then
      raise exception 'Nile Forms submission publication is unavailable'
        using errcode = '42501';
    end if;
    select definition.* into strict v_definition
    from public.form_definitions as definition
    where definition.id = v_publication.definition_id
    for share;
    select version.* into strict v_version
    from public.form_versions as version
    where version.id = v_publication.version_id
    for share;
    if v_publication.audience = 'assigned' then
      select assignment.*
      into v_assignment
      from public.form_assignments as assignment
      where assignment.publication_id = v_publication.id
        and nile_private.nile_forms_assignment_matches(
          assignment,
          v_authority.user_id,
          v_authority.active_role,
          v_authority.branch_ids,
          v_authority.department_ids
        )
      order by assignment.id
      limit 1
      for update;
      if not found then
        raise exception 'Nile Forms submission assignment is denied'
          using errcode = '42501';
      end if;
    end if;
    if pg_catalog.jsonb_typeof(p_input -> 'answers') <> 'object'
      or char_length(coalesce(p_input ->> 'clientSubmissionId', '')) not between 8 and 128 then
      raise exception 'Nile Forms submission input is invalid'
        using errcode = '22023';
    end if;
    if not v_publication.allow_multiple and exists (
      select 1
      from public.form_submissions as submission
      where submission.publication_id = v_publication.id
        and submission.respondent_user_id = v_authority.user_id
        and submission.status <> 'withdrawn'
    ) then
      raise exception 'Nile Forms response limit reached'
        using errcode = '23505';
    end if;
    v_branch_id := coalesce(
      v_definition.branch_id,
      case when pg_catalog.cardinality(v_authority.branch_ids) = 1 then v_authority.branch_ids[1] end
    );
    v_department_id := coalesce(
      v_definition.department_id,
      case when pg_catalog.cardinality(v_authority.department_ids) = 1 then v_authority.department_ids[1] end
    );
    insert into public.form_submissions (
      definition_id,
      publication_id,
      version_id,
      assignment_id,
      respondent_user_id,
      respondent_role,
      branch_id,
      department_id,
      source,
      answer_json,
      client_submission_id,
      client_submitted_at,
      command_id
    )
    values (
      v_publication.definition_id,
      v_publication.id,
      v_publication.version_id,
      v_assignment.id,
      v_authority.user_id,
      v_authority.active_role,
      v_branch_id,
      v_department_id,
      'web',
      p_input -> 'answers',
      p_input ->> 'clientSubmissionId',
      nullif(p_input ->> 'clientSubmittedAt', '')::timestamptz,
      v_command_id
    )
    returning * into v_submission;
    delete from public.form_drafts as draft
    where draft.publication_id = v_publication.id
      and draft.respondent_user_id = v_authority.user_id;
    insert into public.outbox_events (
      command_id,
      event_type,
      aggregate_type,
      aggregate_id,
      payload,
      idempotency_key
    )
    values (
      v_command_id,
      'form.submitted',
      'FormSubmission',
      v_submission.id::text,
      pg_catalog.jsonb_build_object(
        'definitionId', v_submission.definition_id,
        'publicationId', v_submission.publication_id,
        'versionId', v_submission.version_id,
        'status', v_submission.status,
        'source', v_submission.source
      ),
      'form.submitted:' || v_submission.id::text
    );
    v_result := pg_catalog.jsonb_build_object(
      'submission', nile_private.project_nile_form_submission(
        v_submission,
        'projection',
        v_authority.can_read_sensitive
      )
    );
  elsif p_operation = 'forms.submissions.withdraw' then
    select submission.*
    into v_submission
    from public.form_submissions as submission
    where submission.id = p_target_id::uuid
    for update;
    if not found or v_submission.respondent_user_id is distinct from v_authority.user_id then
      raise exception 'Nile Forms submission ownership is denied'
        using errcode = '42501';
    end if;
    if v_submission.status <> 'submitted'
      or v_submission.revision <> (p_input ->> 'expectedRevision')::integer then
      raise exception 'Nile Forms submission withdrawal conflicts with current evidence'
        using errcode = '40001';
    end if;
    update public.form_submissions
    set status = 'withdrawn', revision = revision + 1, updated_at = v_now
    where id = v_submission.id
    returning * into v_submission;
    v_result := nile_private.project_nile_form_submission(
      v_submission,
      'projection',
      v_authority.can_read_sensitive
    );
  elsif p_operation = 'forms.submissions.review' then
    select submission.*
    into v_submission
    from public.form_submissions as submission
    where submission.id = p_target_id::uuid
    for update;
    if not found or not nile_private.nile_forms_submission_allowed(
      v_authority.active_role,
      v_authority.branch_ids,
      v_authority.department_ids,
      v_submission
    ) then
      raise exception 'Nile Forms review scope is denied'
        using errcode = '42501';
    end if;
    if p_input ->> 'decision' not in ('under_review', 'accepted', 'rejected')
      or v_submission.revision <> (p_input ->> 'expectedRevision')::integer
      or (
        p_input ->> 'decision' = 'under_review'
        and v_submission.status <> 'submitted'
      )
      or (
        p_input ->> 'decision' in ('accepted', 'rejected')
        and v_submission.status <> 'under_review'
      )
      or (
        p_input ->> 'decision' = 'rejected'
        and char_length(coalesce(p_input ->> 'comments', '')) < 5
      ) then
      raise exception 'Nile Forms review conflicts with current evidence'
        using errcode = '40001';
    end if;
    insert into public.form_reviews (
      submission_id,
      reviewer_user_id,
      reviewer_role_grant_id,
      decision,
      comments,
      expected_submission_revision,
      command_id
    )
    values (
      v_submission.id,
      v_authority.user_id,
      v_authority.role_grant_id,
      p_input ->> 'decision',
      nullif(p_input ->> 'comments', ''),
      (p_input ->> 'expectedRevision')::integer,
      v_command_id
    )
    returning * into v_review;
    update public.form_submissions
    set status = v_review.decision, revision = revision + 1, updated_at = v_now
    where id = v_submission.id
    returning * into v_submission;
    insert into public.outbox_events (
      command_id,
      event_type,
      aggregate_type,
      aggregate_id,
      payload,
      idempotency_key
    )
    values (
      v_command_id,
      'form.reviewed',
      'FormSubmission',
      v_submission.id::text,
      pg_catalog.jsonb_build_object(
        'submissionId', v_submission.id,
        'decision', v_review.decision,
        'revision', v_submission.revision
      ),
      'form.reviewed:' || v_review.id::text
    );
    v_result := pg_catalog.jsonb_build_object(
      'submission', nile_private.project_nile_form_submission(
        v_submission,
        'projection',
        v_authority.can_read_sensitive
      ),
      'review', pg_catalog.to_jsonb(v_review)
    );
  elsif p_operation in ('forms.offline.devices.enroll', 'forms.offline.devices.revoke') then
    if v_authority.active_role not in ('teacher', 'registrar', 'headofdepartment', 'branchadmin', 'superadmin') then
      raise exception 'Nile Forms offline staff authority is denied'
        using errcode = '42501';
    end if;
    if p_operation = 'forms.offline.devices.enroll' then
      if char_length(coalesce(p_input ->> 'label', '')) not between 1 and 120
        or coalesce(p_input ->> 'deviceTokenHash', '') !~ '^[0-9a-fA-F]{64}$'
        or char_length(coalesce(p_input ->> 'publicKey', '')) not between 32 and 4096
        or nullif(p_input ->> 'expiresAt', '')::timestamptz <= v_now
        or nullif(p_input ->> 'expiresAt', '')::timestamptz > v_now + interval '90 days' then
        raise exception 'Nile Forms offline device input is invalid'
          using errcode = '22023';
      end if;
      insert into public.form_offline_devices (
        user_id,
        role_grant_id,
        label,
        device_token_hash,
        public_key,
        enrolled_at,
        expires_at,
        command_id
      )
      values (
        v_authority.user_id,
        v_authority.role_grant_id,
        p_input ->> 'label',
        pg_catalog.decode(pg_catalog.lower(p_input ->> 'deviceTokenHash'), 'hex'),
        p_input ->> 'publicKey',
        v_now,
        (p_input ->> 'expiresAt')::timestamptz,
        v_command_id
      )
      returning pg_catalog.jsonb_build_object(
        'id', form_offline_devices.id,
        'label', form_offline_devices.label,
        'roleGrantId', form_offline_devices.role_grant_id,
        'enrolledAt', form_offline_devices.enrolled_at,
        'expiresAt', form_offline_devices.expires_at,
        'revokedAt', form_offline_devices.revoked_at
      ) into v_result;
    else
      update public.form_offline_devices
      set revoked_at = v_now, revoked_by = v_authority.user_id
      where id = p_target_id::uuid
        and user_id = v_authority.user_id
        and role_grant_id = v_authority.role_grant_id
        and revoked_at is null
      returning pg_catalog.jsonb_build_object(
        'id', form_offline_devices.id,
        'label', form_offline_devices.label,
        'roleGrantId', form_offline_devices.role_grant_id,
        'enrolledAt', form_offline_devices.enrolled_at,
        'expiresAt', form_offline_devices.expires_at,
        'revokedAt', form_offline_devices.revoked_at
      ) into v_result;
      if not found then
        raise exception 'Nile Forms offline device authority is denied'
          using errcode = '42501';
      end if;
    end if;
  elsif p_operation = 'forms.offline.bundle.issue' then
    if v_authority.active_role not in ('teacher', 'registrar', 'headofdepartment', 'branchadmin', 'superadmin') then
      raise exception 'Nile Forms offline staff authority is denied'
        using errcode = '42501';
    end if;
    select assignment.*
    into v_assignment
    from public.form_assignments as assignment
    where assignment.id = nullif(p_input ->> 'assignmentId', '')::uuid
    for update;
    if not found or not nile_private.nile_forms_assignment_matches(
      v_assignment,
      v_authority.user_id,
      v_authority.active_role,
      v_authority.branch_ids,
      v_authority.department_ids
    ) then
      raise exception 'Nile Forms offline assignment is denied'
        using errcode = '42501';
    end if;
    select device.*
    into v_device
    from public.form_offline_devices as device
    where device.id = p_target_id::uuid
      and device.user_id = v_authority.user_id
      and device.role_grant_id = v_authority.role_grant_id
    for update;
    if not found or v_device.revoked_at is not null or v_device.expires_at <= v_now then
      raise exception 'Nile Forms offline device authority is denied'
        using errcode = '42501';
    end if;
    select publication.*
    into v_publication
    from public.form_publications as publication
    where publication.id = v_assignment.publication_id
    for update;
    if not found or v_publication.audience <> 'assigned'
      or not v_publication.offline_eligible
      or v_publication.status <> 'open'
      or v_publication.version_id is distinct from nullif(p_input ->> 'versionId', '')::uuid then
      raise exception 'Nile Forms publication is not eligible for offline capture'
        using errcode = '42501';
    end if;
    if coalesce(p_input ->> 'bundleMac', '') !~ '^[0-9a-fA-F]{64}$'
      or coalesce(p_input ->> 'itemMac', '') !~ '^[0-9a-fA-F]{64}$'
      or coalesce(p_input ->> 'safeOptionDigest', '') !~ '^[0-9a-fA-F]{64}$'
      or coalesce((p_input ->> 'macKeyVersion')::integer, 0) < 1
      or nullif(p_input ->> 'expiresAt', '')::timestamptz <= v_now
      or nullif(p_input ->> 'expiresAt', '')::timestamptz > v_now + interval '72 hours' then
      raise exception 'Nile Forms offline bundle evidence is invalid'
        using errcode = '22023';
    end if;
    insert into public.form_offline_bundles (
      device_id,
      role_grant_id,
      issued_by,
      command_id,
      bundle_mac,
      mac_key_version,
      safe_option_digest,
      issued_at,
      expires_at
    )
    values (
      v_device.id,
      v_authority.role_grant_id,
      v_authority.user_id,
      v_command_id,
      pg_catalog.decode(pg_catalog.lower(p_input ->> 'bundleMac'), 'hex'),
      (p_input ->> 'macKeyVersion')::integer,
      pg_catalog.decode(pg_catalog.lower(p_input ->> 'safeOptionDigest'), 'hex'),
      v_now,
      (p_input ->> 'expiresAt')::timestamptz
    )
    returning * into v_bundle;
    insert into public.form_offline_bundle_items (
      bundle_id,
      device_id,
      role_grant_id,
      assignment_id,
      publication_id,
      version_id,
      item_mac,
      safe_option_digest,
      issued_at,
      expires_at
    )
    values (
      v_bundle.id,
      v_device.id,
      v_authority.role_grant_id,
      v_assignment.id,
      v_publication.id,
      v_publication.version_id,
      pg_catalog.decode(pg_catalog.lower(p_input ->> 'itemMac'), 'hex'),
      pg_catalog.decode(pg_catalog.lower(p_input ->> 'safeOptionDigest'), 'hex'),
      v_bundle.issued_at,
      v_bundle.expires_at
    )
    returning * into v_bundle_item;
    v_result := pg_catalog.jsonb_build_object(
      'bundle', pg_catalog.to_jsonb(v_bundle),
      'item', pg_catalog.to_jsonb(v_bundle_item)
    );
  elsif p_operation = 'forms.offline.sync.item' then
    if v_authority.active_role not in ('teacher', 'registrar', 'headofdepartment', 'branchadmin', 'superadmin') then
      raise exception 'Nile Forms offline staff authority is denied'
        using errcode = '42501';
    end if;
    select assignment.*
    into v_assignment
    from public.form_assignments as assignment
    where assignment.id = nullif(p_input ->> 'assignmentId', '')::uuid
    for update;
    if not found then
      raise exception 'Nile Forms offline proof assignment is missing'
        using errcode = '42501';
    end if;
    select device.*
    into v_device
    from public.form_offline_devices as device
    where device.id = nullif(p_input ->> 'deviceId', '')::uuid
      and device.user_id = v_authority.user_id
      and device.role_grant_id = v_authority.role_grant_id
    for update;
    if not found or v_device.revoked_at is not null or v_device.expires_at <= v_now then
      raise exception 'Nile Forms offline sync device authority is denied'
        using errcode = '42501';
    end if;
    select bundle.*
    into v_bundle
    from public.form_offline_bundles as bundle
    where bundle.id = nullif(p_input ->> 'bundleId', '')::uuid
      and bundle.device_id = v_device.id
      and bundle.role_grant_id = v_authority.role_grant_id
    for update;
    if not found or v_bundle.expires_at <= v_now
      or v_bundle.bundle_mac is distinct from pg_catalog.decode(coalesce(p_input ->> 'bundleMac', ''), 'hex')
      or v_bundle.safe_option_digest is distinct from pg_catalog.decode(coalesce(p_input ->> 'safeOptionDigest', ''), 'hex') then
      raise exception 'Nile Forms offline bundle proof is invalid'
        using errcode = '42501';
    end if;
    select item.*
    into v_bundle_item
    from public.form_offline_bundle_items as item
    where item.id = nullif(p_input ->> 'bundleItemId', '')::uuid
      and item.bundle_id = v_bundle.id
      and item.device_id = v_device.id
      and item.role_grant_id = v_authority.role_grant_id
      and item.assignment_id = v_assignment.id
    for update;
    if not found or v_bundle_item.expires_at <= v_now
      or v_bundle_item.item_mac is distinct from pg_catalog.decode(coalesce(p_input ->> 'itemMac', ''), 'hex')
      or v_bundle_item.safe_option_digest is distinct from v_bundle.safe_option_digest then
      raise exception 'Nile Forms offline item proof is invalid'
        using errcode = '42501';
    end if;
    if pg_catalog.jsonb_typeof(p_input -> 'answers') <> 'object'
      or char_length(coalesce(p_input ->> 'clientSubmissionId', '')) not between 8 and 128
      or coalesce(p_input ->> 'payloadHash', '') !~ '^[0-9a-fA-F]{64}$' then
      raise exception 'Nile Forms offline submission input is invalid'
        using errcode = '22023';
    end if;
    select publication.*
    into v_publication
    from public.form_publications as publication
    where publication.id = v_bundle_item.publication_id
    for update;
    select definition.* into strict v_definition
    from public.form_definitions as definition
    where definition.id = v_publication.definition_id
    for share;
    v_sync_status := case
      when nile_private.nile_forms_assignment_matches(
        v_assignment,
        v_authority.user_id,
        v_authority.active_role,
        v_authority.branch_ids,
        v_authority.department_ids
      )
        and v_publication.status = 'open'
        and v_publication.offline_eligible
        and v_publication.version_id = v_bundle_item.version_id
      then 'accepted'
      else 'quarantined'
    end;
    v_branch_id := coalesce(
      v_definition.branch_id,
      case when pg_catalog.cardinality(v_authority.branch_ids) = 1 then v_authority.branch_ids[1] end
    );
    v_department_id := coalesce(
      v_definition.department_id,
      case when pg_catalog.cardinality(v_authority.department_ids) = 1 then v_authority.department_ids[1] end
    );
    insert into public.form_submissions (
      definition_id,
      publication_id,
      version_id,
      assignment_id,
      respondent_user_id,
      respondent_role,
      branch_id,
      department_id,
      source,
      answer_json,
      status,
      client_submission_id,
      client_submitted_at,
      command_id
    )
    values (
      v_publication.definition_id,
      v_publication.id,
      v_bundle_item.version_id,
      v_assignment.id,
      v_authority.user_id,
      v_authority.active_role,
      v_branch_id,
      v_department_id,
      'offline',
      p_input -> 'answers',
      case when v_sync_status = 'accepted' then 'submitted' else 'quarantined' end,
      p_input ->> 'clientSubmissionId',
      nullif(p_input ->> 'clientSubmittedAt', '')::timestamptz,
      v_command_id
    )
    returning * into v_submission;
    insert into public.form_sync_receipts (
      device_id,
      client_submission_id,
      submission_id,
      status,
      reason,
      payload_hash,
      command_id
    )
    values (
      v_device.id,
      p_input ->> 'clientSubmissionId',
      v_submission.id,
      v_sync_status,
      case when v_sync_status = 'quarantined' then 'Assignment or publication changed after authorized capture' end,
      pg_catalog.decode(pg_catalog.lower(p_input ->> 'payloadHash'), 'hex'),
      v_command_id
    )
    returning * into v_sync_receipt;
    if v_sync_status = 'accepted' then
      insert into public.outbox_events (
        command_id,
        event_type,
        aggregate_type,
        aggregate_id,
        payload,
        idempotency_key
      )
      values (
        v_command_id,
        'form.submitted',
        'FormSubmission',
        v_submission.id::text,
        pg_catalog.jsonb_build_object(
          'definitionId', v_submission.definition_id,
          'publicationId', v_submission.publication_id,
          'versionId', v_submission.version_id,
          'status', v_submission.status,
          'source', v_submission.source
        ),
        'form.submitted:' || v_submission.id::text
      );
    end if;
    v_result := pg_catalog.jsonb_build_object(
      'submission', nile_private.project_nile_form_submission(
        v_submission,
        'projection',
        v_authority.can_read_sensitive
      ),
      'receipt', pg_catalog.to_jsonb(v_sync_receipt)
    );
  elsif p_operation in (
    'forms.permissions.sensitive.grant',
    'forms.permissions.sensitive.revoke'
  ) then
    if v_authority.active_role <> 'superadmin' then
      raise exception 'Nile Forms sensitive grant authority is denied'
        using errcode = '42501';
    end if;
    select role_grant.*
    into v_target_grant
    from public.role_grants as role_grant
    where role_grant.id = p_target_id::uuid
    for update;
    if not found or v_target_grant.status <> 'active'
      or v_target_grant.starts_at > v_now
      or (v_target_grant.ends_at is not null and v_target_grant.ends_at <= v_now) then
      raise exception 'Nile Forms target role grant is unavailable'
        using errcode = '42501';
    end if;
    if p_operation = 'forms.permissions.sensitive.grant' then
      if char_length(coalesce(p_input ->> 'reason', '')) not between 3 and 500 then
        raise exception 'Nile Forms sensitive grant reason is invalid'
          using errcode = '22023';
      end if;
      select permission.*
      into v_grant_permission
      from public.role_grant_permissions as permission
      where permission.role_grant_id = v_target_grant.id
        and permission.permission_code = 'form_submissions.sensitive_read'
        and permission.status = 'active'
      for update;
      if not found then
        insert into public.role_grant_permissions (
          role_grant_id,
          permission_code,
          source,
          granted_by,
          command_id,
          reason,
          starts_at,
          ends_at
        )
        values (
          v_target_grant.id,
          'form_submissions.sensitive_read',
          'explicit',
          v_authority.user_id,
          v_command_id,
          p_input ->> 'reason',
          v_now,
          nullif(p_input ->> 'endsAt', '')::timestamptz
        )
        returning * into v_grant_permission;
      end if;
    else
      select permission.*
      into v_grant_permission
      from public.role_grant_permissions as permission
      where permission.role_grant_id = v_target_grant.id
        and permission.permission_code = 'form_submissions.sensitive_read'
        and permission.status = 'active'
      for update;
      if not found then
        raise exception 'Nile Forms sensitive permission is not active'
          using errcode = '42501';
      end if;
      if v_grant_permission.source = 'auto_superadmin' then
        raise exception 'Automatic Super Admin sensitive access cannot be revoked separately'
          using errcode = '42501';
      end if;
      update public.role_grant_permissions
      set
        status = 'revoked',
        revoked_at = v_now,
        revoked_by = v_authority.user_id,
        updated_at = v_now
      where id = v_grant_permission.id
      returning * into v_grant_permission;
    end if;
    v_result := pg_catalog.to_jsonb(v_grant_permission);
  elsif p_operation = 'forms.migration.preview.record' then
    if v_authority.active_role <> 'superadmin' then
      raise exception 'Nile Forms migration authority is denied'
        using errcode = '42501';
    end if;
    select publication.*
    into v_publication
    from public.form_publications as publication
    where publication.id = p_target_id::uuid
    for update;
    if not found or v_publication.version_id is distinct from nullif(p_input ->> 'versionId', '')::uuid
      or pg_catalog.jsonb_typeof(p_input -> 'mapping') <> 'array'
      or coalesce(p_input ->> 'previewHash', '') !~ '^[0-9a-fA-F]{64}$'
      or coalesce((p_input ->> 'sourceLimit')::integer, 0) not between 1 and 1000 then
      raise exception 'Nile Forms migration preview evidence is invalid'
        using errcode = '22023';
    end if;
    insert into public.form_legacy_import_runs (
      provider,
      source_form_id,
      source_form_title,
      target_publication_id,
      target_version_id,
      mapping_json,
      source_offset,
      source_limit,
      preview_hash,
      status,
      total_rows,
      valid_rows,
      created_by
    )
    values (
      'jotform',
      p_input ->> 'sourceFormId',
      p_input ->> 'sourceFormTitle',
      v_publication.id,
      v_publication.version_id,
      p_input -> 'mapping',
      coalesce((p_input ->> 'sourceOffset')::integer, 0),
      (p_input ->> 'sourceLimit')::integer,
      pg_catalog.decode(pg_catalog.lower(p_input ->> 'previewHash'), 'hex'),
      'previewed',
      coalesce((p_input ->> 'totalRows')::integer, 0),
      coalesce((p_input ->> 'validRows')::integer, 0),
      v_authority.user_id
    )
    returning * into v_import_run;
    v_result := pg_catalog.to_jsonb(v_import_run);
  elsif p_operation = 'forms.migration.import.record' then
    if v_authority.active_role <> 'superadmin' then
      raise exception 'Nile Forms migration authority is denied'
        using errcode = '42501';
    end if;
    select run.*
    into v_import_run
    from public.form_legacy_import_runs as run
    where run.id = p_target_id::uuid
    for update;
    if not found or v_import_run.status <> 'previewed'
      or v_import_run.preview_hash is distinct from pg_catalog.decode(coalesce(p_input ->> 'previewHash', ''), 'hex')
      or pg_catalog.jsonb_typeof(p_input -> 'answers') <> 'object'
      or coalesce(p_input ->> 'payloadHash', '') !~ '^[0-9a-fA-F]{64}$' then
      raise exception 'Nile Forms migration import evidence is invalid'
        using errcode = '42501';
    end if;
    select publication.* into strict v_publication
    from public.form_publications as publication
    where publication.id = v_import_run.target_publication_id
    for share;
    select definition.* into strict v_definition
    from public.form_definitions as definition
    where definition.id = v_publication.definition_id
    for share;
    insert into public.form_submissions (
      definition_id,
      publication_id,
      version_id,
      branch_id,
      department_id,
      source,
      answer_json,
      status,
      client_submission_id,
      command_id,
      legacy_source_form_id,
      legacy_source_submission_id,
      legacy_payload_hash,
      legacy_import_run_id,
      reconciliation_status
    )
    values (
      v_publication.definition_id,
      v_publication.id,
      v_import_run.target_version_id,
      v_definition.branch_id,
      v_definition.department_id,
      'legacy_import',
      p_input -> 'answers',
      'under_review',
      'legacy:' || (p_input ->> 'sourceSubmissionId'),
      v_command_id,
      v_import_run.source_form_id,
      p_input ->> 'sourceSubmissionId',
      pg_catalog.decode(pg_catalog.lower(p_input ->> 'payloadHash'), 'hex'),
      v_import_run.id,
      'pending'
    )
    returning * into v_submission;
    insert into public.form_legacy_import_records (
      run_id,
      provider,
      source_form_id,
      source_submission_id,
      payload_hash,
      submission_id,
      reconciliation_status
    )
    values (
      v_import_run.id,
      'jotform',
      v_import_run.source_form_id,
      p_input ->> 'sourceSubmissionId',
      pg_catalog.decode(pg_catalog.lower(p_input ->> 'payloadHash'), 'hex'),
      v_submission.id,
      'pending'
    )
    returning * into v_import_record;
    update public.form_legacy_import_runs
    set imported_rows = imported_rows + 1
    where id = v_import_run.id
    returning * into v_import_run;
    v_result := pg_catalog.jsonb_build_object(
      'submission', nile_private.project_nile_form_submission(
        v_submission,
        'projection',
        v_authority.can_read_sensitive
      ),
      'record', pg_catalog.to_jsonb(v_import_record)
    );
  elsif p_operation = 'forms.migration.reconcile' then
    if v_authority.active_role <> 'superadmin' then
      raise exception 'Nile Forms migration authority is denied'
        using errcode = '42501';
    end if;
    select record.*
    into v_import_record
    from public.form_legacy_import_records as record
    where record.id = p_target_id::uuid
    for update;
    if not found or v_import_record.submission_id is null
      or p_input ->> 'status' <> 'matched' then
      raise exception 'Nile Forms reconciliation evidence is invalid'
        using errcode = '42501';
    end if;
    update public.form_legacy_import_records
    set
      reconciliation_status = 'matched',
      notes = nullif(p_input ->> 'notes', ''),
      reconciled_by = v_authority.user_id,
      reconciled_at = v_now
    where id = v_import_record.id
    returning * into v_import_record;
    update public.form_submissions
    set reconciliation_status = 'matched', updated_at = v_now
    where id = v_import_record.submission_id;
    update public.form_legacy_import_runs
    set
      status = case
        when not exists (
          select 1 from public.form_legacy_import_records as pending
          where pending.run_id = v_import_record.run_id
            and pending.reconciliation_status = 'pending'
        ) then 'reconciled'
        else status
      end,
      completed_at = case
        when not exists (
          select 1 from public.form_legacy_import_records as pending
          where pending.run_id = v_import_record.run_id
            and pending.reconciliation_status = 'pending'
        ) then v_now
        else completed_at
      end
    where id = v_import_record.run_id;
    v_result := pg_catalog.to_jsonb(v_import_record);
  else
    raise exception 'Nile Forms command operation is not implemented'
      using errcode = '42501';
  end if;

  insert into public.audit_logs (
    command_id,
    actor_user_id,
    actor_role_grant_id,
    session_id,
    action,
    entity_type,
    entity_id,
    branch_id,
    department_id,
    before_state,
    after_state,
    metadata
  )
  values (
    v_command_id,
    v_authority.user_id,
    v_authority.role_grant_id,
    v_authority.session_id,
    p_operation,
    'NileFormOperation',
    coalesce(p_target_id, v_result ->> 'id', v_command_id::text),
    v_branch_id,
    v_department_id,
    '{}'::jsonb,
    pg_catalog.jsonb_build_object('operation', p_operation),
    pg_catalog.jsonb_build_object(
      'catalogVersion', 'phase13f1-v1',
      'targetPresent', p_target_id is not null
    )
  );
  insert into public.form_command_results (command_id, operation, result_json)
  values (v_command_id, p_operation, coalesce(v_result, '{}'::jsonb));
  update public.command_executions
  set status = 'succeeded', completed_at = v_now
  where id = v_command_id;

  return query select coalesce(v_result, '{}'::jsonb), false, v_command_id;
end;
$$;

create function public.nile_forms_public_command(
  p_operation text,
  p_publication_id uuid,
  p_version_id uuid,
  p_input jsonb,
  p_client_submission_id text,
  p_idempotency_key text,
  p_request_hmac text,
  p_request_fingerprint text,
  p_ip_hmac text,
  p_ip_key_version integer,
  p_previous_ip_hmac text,
  p_previous_ip_key_version integer,
  p_user_agent_hash text,
  p_evidence_key_version integer
)
returns table (
  data jsonb,
  replayed boolean,
  command_id uuid,
  error_code text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.form_public_commands%rowtype;
  v_public_command_id uuid;
  v_publication public.form_publications%rowtype;
  v_definition public.form_definitions%rowtype;
  v_draft public.form_drafts%rowtype;
  v_submission public.form_submissions%rowtype;
  v_result jsonb;
  v_attempts integer;
  v_previous_attempts integer;
  v_contract_public_hmac_key_version integer;
  v_contract_public_hmac_previous_key_version integer;
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_window timestamptz := pg_catalog.date_trunc('minute', pg_catalog.statement_timestamp());
begin
  if p_operation not in ('forms.public.draft.save', 'forms.public.submit')
    or p_idempotency_key is null
    or char_length(p_idempotency_key) not between 8 and 200
    or p_client_submission_id is null
    or char_length(p_client_submission_id) not between 8 and 128
    or p_request_hmac !~ '^[0-9a-fA-F]{64}$'
    or p_request_fingerprint !~ '^[0-9a-fA-F]{64}$'
    or p_ip_hmac !~ '^[0-9a-fA-F]{64}$'
    or p_user_agent_hash !~ '^[0-9a-fA-F]{64}$'
    or coalesce(p_ip_key_version, 0) < 1
    or pg_catalog.num_nonnulls(
      p_previous_ip_hmac,
      p_previous_ip_key_version
    ) not in (0, 2)
    or (
      p_previous_ip_hmac is not null
      and (
        p_previous_ip_hmac !~ '^[0-9a-fA-F]{64}$'
        or coalesce(p_previous_ip_key_version, 0) < 1
        or p_previous_ip_key_version = p_ip_key_version
      )
    )
    or coalesce(p_evidence_key_version, 0) < 1
    or p_evidence_key_version <> p_ip_key_version then
    raise exception 'Nile Forms public command evidence is invalid'
      using errcode = '22023';
  end if;

  select
    contract.public_hmac_key_version,
    contract.public_hmac_previous_key_version
  into strict
    v_contract_public_hmac_key_version,
    v_contract_public_hmac_previous_key_version
  from public.nile_forms_repository_contract as contract
  where contract.singleton;
  if p_ip_key_version <> v_contract_public_hmac_key_version
    or p_evidence_key_version <> v_contract_public_hmac_key_version
    or (
      v_contract_public_hmac_previous_key_version is null
      and p_previous_ip_key_version is not null
    )
    or (
      v_contract_public_hmac_previous_key_version is not null
      and p_previous_ip_key_version is distinct from
        v_contract_public_hmac_previous_key_version
    ) then
    raise exception 'Nile Forms public HMAC key version is not authorized'
      using errcode = '42501';
  end if;

  insert into public.form_public_rate_limits (
    ip_hmac,
    ip_key_version,
    operation,
    window_started_at,
    attempts,
    expires_at,
    updated_at
  )
  values (
    pg_catalog.decode(pg_catalog.lower(p_ip_hmac), 'hex'),
    p_ip_key_version,
    p_operation,
    v_window,
    1,
    v_window + interval '24 hours',
    v_now
  )
  on conflict (ip_hmac, ip_key_version, operation, window_started_at)
  do update set
    attempts = least(public.form_public_rate_limits.attempts + 1, 12),
    updated_at = excluded.updated_at
  returning attempts into v_attempts;
  if p_previous_ip_hmac is not null then
    insert into public.form_public_rate_limits (
      ip_hmac,
      ip_key_version,
      operation,
      window_started_at,
      attempts,
      expires_at,
      updated_at
    )
    values (
      pg_catalog.decode(pg_catalog.lower(p_previous_ip_hmac), 'hex'),
      p_previous_ip_key_version,
      p_operation,
      v_window,
      1,
      v_window + interval '24 hours',
      v_now
    )
    on conflict (ip_hmac, ip_key_version, operation, window_started_at)
    do update set
      attempts = least(public.form_public_rate_limits.attempts + 1, 12),
      updated_at = excluded.updated_at
    returning attempts into v_previous_attempts;

    v_attempts := greatest(v_attempts, v_previous_attempts);
    update public.form_public_rate_limits
    set attempts = v_attempts, updated_at = v_now
    where operation = p_operation
      and window_started_at = v_window
      and (
        (
          ip_hmac = pg_catalog.decode(pg_catalog.lower(p_ip_hmac), 'hex')
          and ip_key_version = p_ip_key_version
        )
        or (
          ip_hmac = pg_catalog.decode(pg_catalog.lower(p_previous_ip_hmac), 'hex')
          and ip_key_version = p_previous_ip_key_version
        )
      );
  end if;
  if v_attempts > 10 then
    return query select '{}'::jsonb, false, null::uuid, 'forms_public_rate_limited'::text;
    return;
  end if;

  begin
    perform nile_private.validate_nile_forms_rpc_input(
      p_operation,
      p_publication_id::text,
      coalesce(p_input, '{}'::jsonb)
    );

  select command.*
  into v_existing
  from public.form_public_commands as command
  where command.idempotency_key = p_idempotency_key
  for update;
  if found then
    if v_existing.operation is distinct from p_operation
      or v_existing.publication_id is distinct from p_publication_id
      or v_existing.version_id is distinct from p_version_id
      or v_existing.client_submission_id is distinct from p_client_submission_id
      or v_existing.request_fingerprint is distinct from pg_catalog.decode(
        pg_catalog.lower(p_request_fingerprint),
        'hex'
      )
      or v_existing.status <> 'succeeded' then
      raise exception 'Nile Forms public idempotency evidence conflicts with this request'
        using errcode = '23505';
    end if;
    return query select v_existing.result_json, true, v_existing.id, null::text;
    return;
  end if;

  select publication.*
  into v_publication
  from public.form_publications as publication
  where publication.id = p_publication_id
  for update;
  if not found or v_publication.version_id is distinct from p_version_id
    or v_publication.audience <> 'public'
    or v_publication.status <> 'open'
    or (v_publication.opens_at is not null and v_publication.opens_at > v_now)
    or (v_publication.closes_at is not null and v_publication.closes_at <= v_now) then
    raise exception 'Nile Forms public publication is unavailable'
      using errcode = '42501';
  end if;
  select definition.* into strict v_definition
  from public.form_definitions as definition
  where definition.id = v_publication.definition_id
  for share;

  insert into public.form_public_commands (
    operation,
    publication_id,
    version_id,
    idempotency_key,
    client_submission_id,
    request_hmac,
    request_fingerprint,
    evidence_key_version,
    ip_hmac,
    ip_key_version,
    user_agent_hash
  )
  values (
    p_operation,
    p_publication_id,
    p_version_id,
    p_idempotency_key,
    p_client_submission_id,
    pg_catalog.decode(pg_catalog.lower(p_request_hmac), 'hex'),
    pg_catalog.decode(pg_catalog.lower(p_request_fingerprint), 'hex'),
    p_evidence_key_version,
    pg_catalog.decode(pg_catalog.lower(p_ip_hmac), 'hex'),
    p_ip_key_version,
    pg_catalog.decode(pg_catalog.lower(p_user_agent_hash), 'hex')
  )
  on conflict (idempotency_key) do nothing
  returning id into v_public_command_id;
  if v_public_command_id is null then
    select command.*
    into strict v_existing
    from public.form_public_commands as command
    where command.idempotency_key = p_idempotency_key
    for update;
    if v_existing.operation is distinct from p_operation
      or v_existing.publication_id is distinct from p_publication_id
      or v_existing.version_id is distinct from p_version_id
      or v_existing.client_submission_id is distinct from p_client_submission_id
      or v_existing.request_fingerprint is distinct from pg_catalog.decode(
        pg_catalog.lower(p_request_fingerprint),
        'hex'
      )
      or v_existing.status <> 'succeeded' then
      raise exception 'Nile Forms public idempotency evidence conflicts with this request'
        using errcode = '23505';
    end if;
    return query select v_existing.result_json, true, v_existing.id, null::text;
    return;
  end if;

  if p_operation = 'forms.public.draft.save' then
    if not v_publication.allow_drafts
      or coalesce(p_input ->> 'guestTokenHash', '') !~ '^[0-9a-fA-F]{64}$'
      or coalesce(p_input ->> 'encryptedPayload', '') !~ '^[0-9a-fA-F]+$'
      or length(p_input ->> 'encryptedPayload') % 2 <> 0
      or coalesce(p_input ->> 'payloadNonce', '') !~ '^[0-9a-fA-F]{24}$'
      or coalesce((p_input ->> 'payloadKeyVersion')::integer, 0) < 1 then
      raise exception 'Nile Forms public draft input is invalid'
        using errcode = '22023';
    end if;
    select draft.*
    into v_draft
    from public.form_drafts as draft
    where draft.publication_id = v_publication.id
      and draft.version_id = v_publication.version_id
      and draft.guest_token_hash = pg_catalog.decode(pg_catalog.lower(p_input ->> 'guestTokenHash'), 'hex')
    for update;
    if found then
      if nullif(p_input ->> 'expectedRevision', '') is null
        or v_draft.revision <> (p_input ->> 'expectedRevision')::integer then
        raise exception 'Nile Forms public draft revision conflicts with current evidence'
          using errcode = '40001';
      end if;
      update public.form_drafts
      set
        encrypted_payload = pg_catalog.decode(p_input ->> 'encryptedPayload', 'hex'),
        payload_nonce = pg_catalog.decode(p_input ->> 'payloadNonce', 'hex'),
        payload_key_version = (p_input ->> 'payloadKeyVersion')::integer,
        revision = revision + 1,
        expires_at = least(
          coalesce(v_publication.closes_at, v_now + interval '30 days'),
          v_now + interval '30 days'
        ),
        updated_at = v_now
      where id = v_draft.id
      returning * into v_draft;
    else
      insert into public.form_drafts (
        publication_id,
        definition_id,
        version_id,
        guest_token_hash,
        encrypted_payload,
        payload_nonce,
        payload_key_version,
        expires_at,
        public_command_id
      )
      values (
        v_publication.id,
        v_publication.definition_id,
        v_publication.version_id,
        pg_catalog.decode(pg_catalog.lower(p_input ->> 'guestTokenHash'), 'hex'),
        pg_catalog.decode(p_input ->> 'encryptedPayload', 'hex'),
        pg_catalog.decode(p_input ->> 'payloadNonce', 'hex'),
        (p_input ->> 'payloadKeyVersion')::integer,
        least(
          coalesce(v_publication.closes_at, v_now + interval '30 days'),
          v_now + interval '30 days'
        ),
        v_public_command_id
      )
      returning * into v_draft;
    end if;
    v_result := pg_catalog.jsonb_build_object(
      'draftId', v_draft.id,
      'revision', v_draft.revision,
      'expiresAt', v_draft.expires_at
    );
    update public.form_public_commands
    set
      status = 'succeeded',
      draft_id = v_draft.id,
      result_json = v_result,
      completed_at = v_now
    where id = v_public_command_id;
  else
    if pg_catalog.jsonb_typeof(p_input -> 'answers') <> 'object' then
      raise exception 'Nile Forms public answers are invalid'
        using errcode = '22023';
    end if;
    insert into public.form_submissions (
      definition_id,
      publication_id,
      version_id,
      branch_id,
      department_id,
      source,
      answer_json,
      client_submission_id,
      client_submitted_at,
      public_command_id
    )
    values (
      v_publication.definition_id,
      v_publication.id,
      v_publication.version_id,
      v_definition.branch_id,
      v_definition.department_id,
      'web',
      p_input -> 'answers',
      p_client_submission_id,
      nullif(p_input ->> 'clientSubmittedAt', '')::timestamptz,
      v_public_command_id
    )
    returning * into v_submission;
    insert into public.outbox_events (
      command_id,
      public_command_id,
      event_type,
      aggregate_type,
      aggregate_id,
      payload,
      idempotency_key
    )
    values (
      null,
      v_public_command_id,
      'form.submitted',
      'FormSubmission',
      v_submission.id::text,
      pg_catalog.jsonb_build_object(
        'definitionId', v_submission.definition_id,
        'publicationId', v_submission.publication_id,
        'versionId', v_submission.version_id,
        'status', v_submission.status,
        'source', v_submission.source
      ),
      'form.submitted:' || v_submission.id::text
    );
    v_result := pg_catalog.jsonb_build_object(
      'submission', nile_private.project_nile_form_submission(
        v_submission,
        'projection',
        false
      )
    );
    update public.form_public_commands
    set
      status = 'succeeded',
      submission_id = v_submission.id,
      result_json = v_result,
      completed_at = v_now
    where id = v_public_command_id;
  end if;

    return query select v_result, false, v_public_command_id, null::text;
  exception
    when unique_violation or serialization_failure then
      return query select
        '{}'::jsonb,
        false,
        null::uuid,
        'forms_public_conflict'::text;
    when invalid_parameter_value
      or check_violation
      or datetime_field_overflow
      or invalid_datetime_format
      or invalid_text_representation
      or numeric_value_out_of_range then
      return query select
        '{}'::jsonb,
        false,
        null::uuid,
        'forms_public_invalid'::text;
    when insufficient_privilege or no_data_found then
      return query select
        '{}'::jsonb,
        false,
        null::uuid,
        'forms_public_unavailable'::text;
  end;
end;
$$;

alter table public.form_permission_mappings enable row level security;
alter table public.form_permission_mappings force row level security;
alter table public.form_operation_permissions enable row level security;
alter table public.form_operation_permissions force row level security;
alter table public.role_grant_permissions enable row level security;
alter table public.role_grant_permissions force row level security;
alter table public.form_command_results enable row level security;
alter table public.form_command_results force row level security;
alter table public.form_public_commands enable row level security;
alter table public.form_public_commands force row level security;
alter table public.form_public_rate_limits enable row level security;
alter table public.form_public_rate_limits force row level security;
alter table public.form_offline_bundles enable row level security;
alter table public.form_offline_bundles force row level security;
alter table public.form_offline_bundle_items enable row level security;
alter table public.form_offline_bundle_items force row level security;
alter table public.nile_forms_repository_contract enable row level security;
alter table public.nile_forms_repository_contract force row level security;

revoke all on table
  public.form_permission_mappings,
  public.form_operation_permissions,
  public.role_grant_permissions,
  public.form_command_results,
  public.form_public_commands,
  public.form_public_rate_limits,
  public.form_offline_bundles,
  public.form_offline_bundle_items,
  public.nile_forms_repository_contract
from public, anon, authenticated, nile_forms_executor;

revoke all on table
  public.app_users,
  public.role_grants,
  public.role_grant_branch_scopes,
  public.role_grant_department_scopes,
  public.auth_sessions,
  public.permissions,
  public.role_permissions,
  public.command_executions,
  public.audit_logs,
  public.outbox_events,
  public.form_definitions,
  public.form_versions,
  public.form_publications,
  public.form_assignments,
  public.form_drafts,
  public.form_submissions,
  public.form_submission_index_values,
  public.form_reviews,
  public.form_promotions,
  public.form_offline_devices,
  public.form_sync_receipts,
  public.form_attachments,
  public.form_legacy_import_runs,
  public.form_legacy_import_records
from nile_forms_executor;

grant select, insert, update, delete on table
  public.form_permission_mappings,
  public.form_operation_permissions,
  public.role_grant_permissions,
  public.form_command_results,
  public.form_public_commands,
  public.form_public_rate_limits,
  public.form_offline_bundles,
  public.form_offline_bundle_items,
  public.nile_forms_repository_contract
to service_role;

revoke all on function public.nile_forms_query(text, text, text, jsonb)
from public, anon, authenticated, service_role;
revoke all on function public.nile_forms_public_query(text, text)
from public, anon, authenticated, service_role;
revoke all on function public.nile_forms_command(text, text, text, jsonb, text, text)
from public, anon, authenticated, service_role;
revoke all on function public.nile_forms_public_command(
  text, uuid, uuid, jsonb, text, text, text, text, text, integer, text, integer, text, integer
)
from public, anon, authenticated, service_role;
revoke all on function public.nile_forms_contract_status()
from public, anon, authenticated, service_role;

grant usage on schema public to nile_forms_executor;
grant execute on function public.nile_forms_query(text, text, text, jsonb)
to nile_forms_executor;
grant execute on function public.nile_forms_public_query(text, text)
to nile_forms_executor;
grant execute on function public.nile_forms_command(text, text, text, jsonb, text, text)
to nile_forms_executor;
grant execute on function public.nile_forms_public_command(
  text, uuid, uuid, jsonb, text, text, text, text, text, integer, text, integer, text, integer
)
to nile_forms_executor;
grant execute on function public.nile_forms_contract_status()
to nile_forms_executor;

revoke all on function nile_private.preserve_form_command_evidence()
from public, anon, authenticated, nile_forms_executor;
revoke all on function nile_private.ensure_superadmin_form_sensitive_grant()
from public, anon, authenticated, nile_forms_executor;
revoke all on function nile_private.nile_forms_schema_fields(jsonb)
from public, anon, authenticated, nile_forms_executor;
revoke all on function nile_private.project_nile_form_answers(jsonb, jsonb, text, boolean)
from public, anon, authenticated, nile_forms_executor;
revoke all on function nile_private.reject_sensitive_form_index_value()
from public, anon, authenticated, nile_forms_executor;
revoke all on function nile_private.nile_forms_scope_allows(text, uuid[], uuid[], uuid, uuid)
from public, anon, authenticated, nile_forms_executor;
revoke all on function nile_private.require_nile_forms_authority(text, text, text)
from public, anon, authenticated, nile_forms_executor;
revoke all on function nile_private.preserve_role_grant_permission_evidence()
from public, anon, authenticated, nile_forms_executor;
revoke all on function nile_private.nile_forms_definition_allowed(
  text, uuid, uuid, uuid[], uuid[], public.form_definitions
)
from public, anon, authenticated, nile_forms_executor;
revoke all on function nile_private.nile_forms_submission_allowed(
  text, uuid[], uuid[], public.form_submissions
)
from public, anon, authenticated, nile_forms_executor;
revoke all on function nile_private.nile_forms_assignment_matches(
  public.form_assignments, uuid, text, uuid[], uuid[]
)
from public, anon, authenticated, nile_forms_executor;
revoke all on function nile_private.validate_nile_forms_rpc_input(text, text, jsonb)
from public, anon, authenticated, nile_forms_executor;
revoke all on function nile_private.project_nile_form_submission(
  public.form_submissions, text, boolean
)
from public, anon, authenticated, nile_forms_executor;

-- The dedicated runtime principal owns no table or sequence DML. All access is
-- through the exact bounded SECURITY DEFINER signatures granted above.
commit;
