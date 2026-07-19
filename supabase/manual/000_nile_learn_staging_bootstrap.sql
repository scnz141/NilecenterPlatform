-- Nile Learn single-file Supabase staging bootstrap
--
-- GENERATED FILE. Run `npm run build:supabase-sql-bundle` after changing any
-- source migration. Verify it with `npm run check:supabase-sql-bundle`.
--
-- TARGET: a fresh, disposable Nile Learn Supabase staging project only.
-- DO NOT paste this into production, a shared school database, or a project
-- that already contains any of these migrations. The source migrations are
-- intentionally not idempotent and each section preserves its own transaction.
-- A later section failure does not roll back sections already committed.
--
-- INCLUDED: promoted migration-history SQL, core read-only verification,
-- accepted Phase 6 read-only Moodle projection packages, and the disabled
-- transactional-email/account-invitation foundation in dependency order.
--
-- EXCLUDED: fake/demo seeds, semantic assertion fixtures, rollback drills,
-- provider credentials, Moodle writes, and Phase 13F1 normalized persistence.
-- Phase 13F1 is explicitly local-only and is not approved for remote Supabase.
--
-- This file changes schema only. It does not activate Moodle, email delivery,
-- account invitations, or any runtime environment variable.
--
-- Generated from 20 reviewed SQL sources.

-- ============================================================================
-- 01. Compatibility platform tables
-- Source: supabase/migrations/20260626185139_platform_demo_seed_tables.sql
-- SHA-256: 68eb50a969a2b184381ace404f7e63f9be32dd03604d6419de8a530c5b02cb1a
-- ============================================================================

create table if not exists public.platform_records (
  id text primary key,
  type text not null check (type in ('lead', 'placement', 'operational')),
  payload jsonb not null default '{}'::jsonb,
  actor_id text,
  created_at timestamptz not null default now()
);

create index if not exists platform_records_type_created_at_idx
  on public.platform_records (type, created_at desc);

alter table public.platform_records enable row level security;

grant select, insert, update, delete on table public.platform_records to service_role;
revoke all on table public.platform_records from anon, authenticated;

drop policy if exists "server service can manage platform records" on public.platform_records;
create policy "server service can manage platform records"
  on public.platform_records
  for all
  to service_role
  using (true)
  with check (true);

create table if not exists public.platform_demo_entities (
  entity_type text not null,
  entity_id text not null,
  payload jsonb not null default '{}'::jsonb,
  seeded_at timestamptz not null default now(),
  primary key (entity_type, entity_id)
);

create index if not exists platform_demo_entities_type_idx
  on public.platform_demo_entities (entity_type);

alter table public.platform_demo_entities enable row level security;

grant select, insert, update, delete on table public.platform_demo_entities to service_role;
revoke all on table public.platform_demo_entities from anon, authenticated;

drop policy if exists "server service can manage demo entities" on public.platform_demo_entities;
create policy "server service can manage demo entities"
  on public.platform_demo_entities
  for all
  to service_role
  using (true)
  with check (true);

-- ============================================================================
-- 02. Compatibility state snapshots and events
-- Source: supabase/migrations/20260627110345_platform_state_snapshots.sql
-- SHA-256: 8f4af283f0498f781618ca09ae4db60e35e381d97a9283bfabe61ebc2b59f72f
-- ============================================================================

create table if not exists public.platform_state_snapshots (
  id text primary key,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists platform_state_snapshots_updated_at_idx
  on public.platform_state_snapshots (updated_at desc);

alter table public.platform_state_snapshots enable row level security;

grant select, insert, update, delete on table public.platform_state_snapshots to service_role;
revoke all on table public.platform_state_snapshots from anon, authenticated;

drop policy if exists "server service can manage platform state snapshots" on public.platform_state_snapshots;
create policy "server service can manage platform state snapshots"
  on public.platform_state_snapshots
  for all
  to service_role
  using (true)
  with check (true);

create table if not exists public.platform_events (
  id text primary key,
  actor_id text,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  summary text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists platform_events_action_created_at_idx
  on public.platform_events (action, created_at desc);

create index if not exists platform_events_entity_idx
  on public.platform_events (entity_type, entity_id);

alter table public.platform_events enable row level security;

grant select, insert, update, delete on table public.platform_events to service_role;
revoke all on table public.platform_events from anon, authenticated;

drop policy if exists "server service can manage platform events" on public.platform_events;
create policy "server service can manage platform events"
  on public.platform_events
  for all
  to service_role
  using (true)
  with check (true);

-- ============================================================================
-- 03. Phase 1 identity, scope, audit, and mapping
-- Source: supabase/migrations/20260710053837_phase1_identity_scope_session_audit_mapping.sql
-- SHA-256: 3f60d8d79ceabae2e9ab7cd886db246f2a5c0af185ae832c545bd667bebe9bc1
-- ============================================================================

-- Nile Learn Phase 1 identity, scope, session, audit, outbox, and mapping SQL.
--
-- Status: reviewed local-only migration source. An exact copy is promoted in
-- supabase/migrations for disposable local Supabase validation.
-- Do not apply this file or its promoted migration to linked, preview, shared,
-- or production Supabase without a separately approved promotion slice.
--
-- This draft is additive. Existing public.platform_* compatibility tables are
-- intentionally untouched until snapshot retirement.

begin;

create extension if not exists pgcrypto;
create extension if not exists citext;
create extension if not exists btree_gist;

create schema nile_private;
revoke all on schema nile_private from public, anon, authenticated;

create function nile_private.jsonb_has_forbidden_keys(payload jsonb)
returns boolean
language plpgsql
immutable
strict
security invoker
set search_path = ''
as $$
declare
  pair record;
  element jsonb;
begin
  case pg_catalog.jsonb_typeof(payload)
    when 'object' then
      for pair in
        select entry.key, entry.value
        from pg_catalog.jsonb_each(payload) as entry
      loop
        if pg_catalog.lower(pair.key) ~
          '(password|passwd|secret|api.?key|token|authorization|cookie|credential|private.?key|service.?role)' then
          return true;
        end if;

        if nile_private.jsonb_has_forbidden_keys(pair.value) then
          return true;
        end if;
      end loop;
    when 'array' then
      for element in
        select item.value
        from pg_catalog.jsonb_array_elements(payload) as item
      loop
        if nile_private.jsonb_has_forbidden_keys(element) then
          return true;
        end if;
      end loop;
    else
      return false;
  end case;

  return false;
end;
$$;

create function nile_private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create function nile_private.reject_immutable_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception '% rows are immutable', tg_table_name
    using errcode = '55000';
end;
$$;

create function nile_private.reject_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception '% rows must be retired, revoked, or archived, not deleted', tg_table_name
    using errcode = '55000';
end;
$$;

create function nile_private.preserve_app_user_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.id is distinct from new.id
    or old.legacy_id is distinct from new.legacy_id
    or old.created_at is distinct from new.created_at then
    raise exception 'Application user identity provenance is immutable'
      using errcode = '55000';
  end if;

  if old.auth_user_id is not null
    and old.auth_user_id is distinct from new.auth_user_id then
    raise exception 'An established Auth mapping cannot be cleared or reassigned'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  code citext not null unique,
  name text not null,
  timezone text not null default 'Africa/Cairo',
  address jsonb not null default '{}'::jsonb,
  status text not null default 'active'
    check (status in ('active', 'paused', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.app_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete restrict,
  legacy_id text unique,
  full_name text not null,
  email citext not null unique,
  phone text,
  status text not null default 'invited'
    check (status in ('invited', 'active', 'paused', 'disabled', 'archived')),
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (auth_user_id is not null or status = 'invited'),
  check (activated_at is null or auth_user_id is not null)
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  code citext not null unique,
  name text not null,
  status text not null default 'active'
    check (status in ('active', 'paused', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.department_branches (
  department_id uuid not null references public.departments(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (department_id, branch_id)
);

create table public.permissions (
  code text primary key,
  category text not null,
  description text not null,
  sensitive boolean not null default false,
  created_at timestamptz not null default now(),
  check (code ~ '^[a-z][a-z0-9_.-]+$')
);

create table public.role_permissions (
  role text not null
    check (role in ('student', 'teacher', 'registrar', 'headofdepartment', 'branchadmin', 'superadmin')),
  permission_code text not null references public.permissions(code) on delete restrict,
  granted boolean not null default true,
  updated_by uuid references public.app_users(id) on delete restrict,
  updated_at timestamptz not null default now(),
  primary key (role, permission_code)
);

create table public.role_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete restrict,
  role text not null
    check (role in ('student', 'teacher', 'registrar', 'headofdepartment', 'branchadmin', 'superadmin')),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'revoked', 'expired')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  granted_by uuid references public.app_users(id) on delete restrict,
  granted_reason text,
  revoked_at timestamptz,
  revoked_by uuid references public.app_users(id) on delete restrict,
  revocation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (ends_at is null or ends_at > starts_at),
  check (
    (
      status = 'revoked'
      and revoked_at is not null
      and revocation_reason is not null
    )
    or (
      status <> 'revoked'
      and revoked_at is null
      and revoked_by is null
      and revocation_reason is null
    )
  ),
  exclude using gist (
    user_id with =,
    role with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status = 'active')
);

create table public.role_grant_branch_scopes (
  id uuid primary key default gen_random_uuid(),
  role_grant_id uuid not null references public.role_grants(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  granted_by uuid references public.app_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at),
  exclude using gist (
    role_grant_id with =,
    branch_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
);

create table public.role_grant_department_scopes (
  id uuid primary key default gen_random_uuid(),
  role_grant_id uuid not null references public.role_grants(id) on delete restrict,
  department_id uuid not null references public.departments(id) on delete restrict,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  granted_by uuid references public.app_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at),
  exclude using gist (
    role_grant_id with =,
    department_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
);

create table public.staff_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.app_users(id) on delete restrict,
  title text,
  availability_status text not null default 'not_applicable'
    check (availability_status in ('available', 'limited', 'unavailable', 'not_applicable')),
  status text not null default 'active'
    check (status in ('active', 'paused', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.staff_subjects (
  id uuid primary key default gen_random_uuid(),
  staff_profile_id uuid not null references public.staff_profiles(id) on delete restrict,
  subject text not null,
  teaching_level text,
  created_at timestamptz not null default now(),
  unique nulls not distinct (staff_profile_id, subject, teaching_level)
);

create table public.auth_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  user_id uuid not null references public.app_users(id) on delete restrict,
  active_role_grant_id uuid not null,
  provider text not null check (provider in ('supabase', 'demo')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references public.app_users(id) on delete restrict,
  ip_hash bytea,
  user_agent_hash bytea,
  metadata jsonb not null default '{}'::jsonb,
  unique (id, user_id, active_role_grant_id),
  foreign key (active_role_grant_id, user_id)
    references public.role_grants(id, user_id) on delete restrict,
  check (expires_at > created_at),
  check (last_seen_at is null or last_seen_at >= created_at),
  check (revoked_at is null or revoked_at >= created_at),
  check (revoked_by is null or revoked_at is not null),
  check (not nile_private.jsonb_has_forbidden_keys(metadata))
);

create table public.command_executions (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  actor_user_id uuid not null references public.app_users(id) on delete restrict,
  actor_role_grant_id uuid not null,
  session_id uuid not null,
  command_type text not null,
  target_type text,
  target_id text,
  request_hash bytea not null check (octet_length(request_hash) = 32),
  requires_outbox boolean not null default false,
  status text not null default 'started'
    check (status in ('started', 'succeeded')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  foreign key (actor_role_grant_id, actor_user_id)
    references public.role_grants(id, user_id) on delete restrict,
  foreign key (session_id, actor_user_id, actor_role_grant_id)
    references public.auth_sessions(id, user_id, active_role_grant_id) on delete restrict,
  unique (id, actor_user_id, actor_role_grant_id, session_id),
  check ((status = 'succeeded') = (completed_at is not null))
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  command_id uuid not null references public.command_executions(id) on delete restrict,
  actor_user_id uuid not null references public.app_users(id) on delete restrict,
  actor_role_grant_id uuid not null,
  session_id uuid not null,
  request_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  branch_id uuid references public.branches(id) on delete restrict,
  department_id uuid references public.departments(id) on delete restrict,
  before_state jsonb not null default '{}'::jsonb,
  after_state jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  retention_until timestamptz not null default (now() + interval '365 days'),
  foreign key (command_id, actor_user_id, actor_role_grant_id, session_id)
    references public.command_executions(
      id,
      actor_user_id,
      actor_role_grant_id,
      session_id
    ) on delete restrict,
  unique (command_id, action, entity_type, entity_id),
  check (not nile_private.jsonb_has_forbidden_keys(before_state)),
  check (not nile_private.jsonb_has_forbidden_keys(after_state)),
  check (not nile_private.jsonb_has_forbidden_keys(metadata)),
  check (retention_until >= occurred_at + interval '365 days')
);

create table public.outbox_events (
  id uuid primary key default gen_random_uuid(),
  command_id uuid not null references public.command_executions(id) on delete restrict,
  event_type text not null,
  aggregate_type text not null,
  aggregate_id text not null,
  payload jsonb not null,
  idempotency_key text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'succeeded', 'failed', 'dead_letter')),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not nile_private.jsonb_has_forbidden_keys(payload)),
  check ((status = 'processing') = (locked_at is not null and locked_by is not null)),
  check ((status = 'succeeded') = (processed_at is not null))
);

create table public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  label text not null,
  environment text not null default 'sandbox'
    check (environment in ('local', 'sandbox', 'preview', 'production')),
  mode text not null default 'disabled'
    check (mode in ('disabled', 'read_only', 'write_limited', 'migration')),
  status text not null default 'unconfigured'
    check (status in ('unconfigured', 'verifying', 'ready', 'degraded', 'disabled')),
  capabilities jsonb not null default '[]'::jsonb,
  last_verified_at timestamptz,
  verification_evidence_hash bytea,
  last_error text,
  created_by uuid references public.app_users(id) on delete restrict,
  updated_by uuid references public.app_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, environment, label),
  check (jsonb_typeof(capabilities) = 'array'),
  check (not nile_private.jsonb_has_forbidden_keys(capabilities)),
  check (provider <> 'legacy_ems' or mode in ('disabled', 'read_only', 'migration')),
  check (provider <> 'moodle' or mode in ('disabled', 'read_only')),
  check (
    status <> 'ready'
    or (
      last_verified_at is not null
      and verification_evidence_hash is not null
      and octet_length(verification_evidence_hash) = 32
    )
  )
);

create table public.integration_env_requirements (
  connection_id uuid not null references public.integration_connections(id) on delete restrict,
  env_var_name text not null,
  required boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (connection_id, env_var_name),
  check (env_var_name ~ '^[A-Z][A-Z0-9_]+$')
);

create table public.external_records (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.integration_connections(id) on delete restrict,
  entity_type text not null,
  internal_id uuid,
  external_id text not null,
  external_parent_id text,
  source_version text,
  source_updated_at timestamptz,
  source_hash bytea,
  sync_state text not null default 'discovered'
    check (sync_state in ('discovered', 'matched', 'synced', 'stale', 'error', 'ignored')),
  last_seen_at timestamptz not null default now(),
  last_synced_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, entity_type, external_id),
  unique (id, connection_id, entity_type),
  check (source_hash is null or octet_length(source_hash) = 32),
  check (not nile_private.jsonb_has_forbidden_keys(metadata)),
  check (
    sync_state <> 'synced'
    or (
      internal_id is not null
      and source_hash is not null
      and source_updated_at is not null
      and last_synced_at is not null
    )
  )
);

create unique index external_records_internal_mapping_uidx
  on public.external_records (connection_id, entity_type, internal_id)
  where internal_id is not null;

create table public.sync_cursors (
  connection_id uuid not null references public.integration_connections(id) on delete restrict,
  entity_type text not null,
  direction text not null check (direction in ('read', 'write')),
  cursor_value text,
  updated_at timestamptz not null default now(),
  primary key (connection_id, entity_type, direction)
);

create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.integration_connections(id) on delete restrict,
  entity_type text not null,
  direction text not null check (direction in ('read', 'write')),
  status text not null default 'pending'
    check (status in ('pending', 'running', 'succeeded', 'partial', 'failed', 'cancelled')),
  cursor_before text,
  cursor_after text,
  discovered_count integer not null default 0 check (discovered_count >= 0),
  succeeded_count integer not null default 0 check (succeeded_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  started_at timestamptz,
  finished_at timestamptz,
  error_summary text,
  created_by uuid references public.app_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (finished_at is null or started_at is not null),
  check (finished_at is null or finished_at >= started_at),
  check (
    status not in ('succeeded', 'partial', 'failed', 'cancelled')
    or finished_at is not null
  ),
  check (succeeded_count + failed_count <= discovered_count)
);

create table public.sync_run_items (
  id uuid primary key default gen_random_uuid(),
  sync_run_id uuid not null references public.sync_runs(id) on delete restrict,
  external_record_id uuid references public.external_records(id) on delete restrict,
  external_id text not null,
  status text not null
    check (status in ('succeeded', 'skipped', 'failed', 'needs_review')),
  source_hash bytea,
  error_class text,
  error_detail text,
  created_at timestamptz not null default now(),
  unique (sync_run_id, external_id),
  check (source_hash is null or octet_length(source_hash) = 32),
  check ((status = 'failed') = (error_class is not null))
);

create table public.reconciliation_cases (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.integration_connections(id) on delete restrict,
  entity_type text not null,
  internal_id uuid,
  external_id text,
  reason text not null,
  status text not null default 'open'
    check (status in ('open', 'matched', 'ignored', 'resolved')),
  resolution text,
  resolved_by uuid references public.app_users(id) on delete restrict,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    status = 'open'
    or (resolution is not null and resolved_by is not null and resolved_at is not null)
  )
);

create unique index reconciliation_cases_one_open_uidx
  on public.reconciliation_cases (
    connection_id,
    entity_type,
    coalesce(internal_id::text, ''),
    coalesce(external_id, ''),
    reason
  )
  where status = 'open';

create table public.migration_runs (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.integration_connections(id) on delete restrict,
  entity_type text not null,
  run_kind text not null
    check (run_kind in ('dry_run', 'approved_import', 'final_delta', 'cutover', 'rollback')),
  status text not null default 'draft'
    check (status in ('draft', 'validating', 'ready', 'approved', 'applying', 'completed', 'failed', 'rolled_back')),
  source_watermark text,
  source_manifest_hash bytea not null check (octet_length(source_manifest_hash) = 32),
  source_count integer not null default 0 check (source_count >= 0),
  matched_count integer not null default 0 check (matched_count >= 0),
  imported_count integer not null default 0 check (imported_count >= 0),
  exception_count integer not null default 0 check (exception_count >= 0),
  approved_by uuid references public.app_users(id) on delete restrict,
  approved_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  rollback_reference text,
  created_by uuid not null references public.app_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (id, connection_id, entity_type),
  check (matched_count + exception_count <= source_count),
  check (imported_count <= matched_count),
  check (
    status not in ('approved', 'applying', 'completed')
    or (approved_by is not null and approved_at is not null)
  ),
  check (status <> 'rolled_back' or rollback_reference is not null),
  check (completed_at is null or started_at is not null),
  check (completed_at is null or completed_at >= started_at)
);

create table public.migration_run_items (
  id uuid primary key default gen_random_uuid(),
  migration_run_id uuid not null,
  connection_id uuid not null,
  entity_type text not null,
  external_record_id uuid not null,
  external_id text not null,
  source_hash bytea not null check (octet_length(source_hash) = 32),
  match_status text not null
    check (match_status in ('unmatched', 'matched', 'ambiguous', 'rejected', 'imported')),
  internal_id uuid,
  validation_errors jsonb not null default '[]'::jsonb,
  before_image jsonb not null default '{}'::jsonb,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (migration_run_id, connection_id, entity_type)
    references public.migration_runs(id, connection_id, entity_type) on delete restrict,
  foreign key (external_record_id, connection_id, entity_type)
    references public.external_records(id, connection_id, entity_type) on delete restrict,
  unique (migration_run_id, external_id, source_hash),
  check (jsonb_typeof(validation_errors) = 'array'),
  check (not nile_private.jsonb_has_forbidden_keys(before_image)),
  check ((match_status = 'imported') = (internal_id is not null and applied_at is not null))
);

create unique index migration_run_items_one_import_uidx
  on public.migration_run_items (connection_id, entity_type, external_id, source_hash)
  where match_status = 'imported';

create table public.migration_evidence (
  id uuid primary key default gen_random_uuid(),
  migration_run_id uuid not null references public.migration_runs(id) on delete restrict,
  evidence_type text not null
    check (evidence_type in (
      'dry_run_report',
      'reconciliation_approval',
      'final_delta',
      'cutover',
      'rollback',
      'credential_retirement'
    )),
  evidence_hash bytea not null check (octet_length(evidence_hash) = 32),
  summary text not null,
  recorded_by uuid not null references public.app_users(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  unique (migration_run_id, evidence_type, evidence_hash)
);

create index role_grants_user_effective_idx
  on public.role_grants (user_id, status, starts_at, ends_at);
create index role_grant_branch_scopes_grant_idx
  on public.role_grant_branch_scopes (role_grant_id, starts_at, ends_at);
create index role_grant_branch_scopes_branch_idx
  on public.role_grant_branch_scopes (branch_id);
create index role_grant_department_scopes_grant_idx
  on public.role_grant_department_scopes (role_grant_id, starts_at, ends_at);
create index role_grant_department_scopes_department_idx
  on public.role_grant_department_scopes (department_id);
create index auth_sessions_user_active_idx
  on public.auth_sessions (user_id, expires_at)
  where revoked_at is null;
create index auth_sessions_user_id_idx
  on public.auth_sessions (user_id);
create index auth_sessions_expires_at_idx
  on public.auth_sessions (expires_at) where revoked_at is null;
create index auth_sessions_revoked_at_idx
  on public.auth_sessions (revoked_at) where revoked_at is not null;
create index command_executions_actor_started_idx
  on public.command_executions (actor_user_id, started_at desc);
create index audit_logs_actor_time_idx
  on public.audit_logs (actor_user_id, occurred_at desc);
create index audit_logs_entity_time_idx
  on public.audit_logs (entity_type, entity_id, occurred_at desc);
create index outbox_events_claim_idx
  on public.outbox_events (status, available_at, created_at)
  where status in ('pending', 'failed');
create index external_records_sync_state_idx
  on public.external_records (connection_id, entity_type, sync_state);
create index sync_runs_connection_time_idx
  on public.sync_runs (connection_id, created_at desc);
create index reconciliation_cases_status_idx
  on public.reconciliation_cases (connection_id, status, created_at);
create index migration_runs_connection_time_idx
  on public.migration_runs (connection_id, created_at desc);

-- Every foreign-key lookup used by authorization, audit, sync, or migration
-- receives a leading btree index. Primary/unique keys already cover the
-- remaining foreign keys whose referenced columns are first in the key.
create index department_branches_branch_idx
  on public.department_branches (branch_id);
create index role_permissions_permission_idx
  on public.role_permissions (permission_code);
create index role_permissions_updated_by_idx
  on public.role_permissions (updated_by) where updated_by is not null;
create index role_grants_granted_by_idx
  on public.role_grants (granted_by) where granted_by is not null;
create index role_grants_revoked_by_idx
  on public.role_grants (revoked_by) where revoked_by is not null;
create index role_grant_branch_scopes_granted_by_idx
  on public.role_grant_branch_scopes (granted_by) where granted_by is not null;
create index role_grant_department_scopes_granted_by_idx
  on public.role_grant_department_scopes (granted_by) where granted_by is not null;
create index auth_sessions_grant_user_idx
  on public.auth_sessions (active_role_grant_id, user_id);
create index auth_sessions_revoked_by_idx
  on public.auth_sessions (revoked_by) where revoked_by is not null;
create index command_executions_session_actor_idx
  on public.command_executions (session_id, actor_user_id, actor_role_grant_id);
create index command_executions_role_actor_idx
  on public.command_executions (actor_role_grant_id, actor_user_id);
create index audit_logs_role_actor_idx
  on public.audit_logs (actor_role_grant_id, actor_user_id);
create index audit_logs_command_authority_idx
  on public.audit_logs (command_id, actor_user_id, actor_role_grant_id, session_id);
create index audit_logs_session_idx
  on public.audit_logs (session_id);
create index audit_logs_branch_time_idx
  on public.audit_logs (branch_id, occurred_at desc) where branch_id is not null;
create index audit_logs_department_time_idx
  on public.audit_logs (department_id, occurred_at desc) where department_id is not null;
create index audit_logs_retention_idx
  on public.audit_logs (retention_until) where retention_until is not null;
create index outbox_events_command_idx
  on public.outbox_events (command_id);
create index integration_connections_created_by_idx
  on public.integration_connections (created_by) where created_by is not null;
create index integration_connections_updated_by_idx
  on public.integration_connections (updated_by) where updated_by is not null;
create index sync_runs_created_by_idx
  on public.sync_runs (created_by) where created_by is not null;
create index sync_run_items_external_record_idx
  on public.sync_run_items (external_record_id) where external_record_id is not null;
create index reconciliation_cases_resolved_by_idx
  on public.reconciliation_cases (resolved_by) where resolved_by is not null;
create index migration_runs_approved_by_idx
  on public.migration_runs (approved_by) where approved_by is not null;
create index migration_runs_created_by_idx
  on public.migration_runs (created_by);
create index migration_run_items_run_source_idx
  on public.migration_run_items (migration_run_id, connection_id, entity_type);
create index migration_run_items_external_source_idx
  on public.migration_run_items (external_record_id, connection_id, entity_type);
create index migration_evidence_recorded_by_idx
  on public.migration_evidence (recorded_by);

create function nile_private.validate_role_grant_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  grant_id uuid;
  grant_role text;
  grant_status text;
  grant_user_status text;
  grant_starts_at timestamptz;
  grant_ends_at timestamptz;
  branch_scope_count integer;
  department_scope_count integer;
  branch_scope_total integer;
  department_scope_total integer;
  invalid_scope_pair_count integer;
begin
  if tg_table_name = 'role_grants' then
    grant_id := case when tg_op = 'DELETE' then old.id else new.id end;
  else
    grant_id := case
      when tg_op = 'DELETE' then old.role_grant_id
      else new.role_grant_id
    end;
  end if;

  select
    role_grant.role,
    role_grant.status,
    app_user.status,
    role_grant.starts_at,
    role_grant.ends_at
  into grant_role, grant_status, grant_user_status, grant_starts_at, grant_ends_at
  from public.role_grants as role_grant
  join public.app_users as app_user on app_user.id = role_grant.user_id
  where role_grant.id = grant_id;

  if not found or grant_status <> 'active' then
    return null;
  end if;

  if grant_user_status <> 'active' then
    raise exception 'Active role grants require an active app user'
      using errcode = '23514';
  end if;

  select count(*)
  into branch_scope_count
  from public.role_grant_branch_scopes as scope
  where scope.role_grant_id = grant_id
    and scope.starts_at <= grant_starts_at
    and (
      scope.ends_at is null
      or (grant_ends_at is not null and scope.ends_at >= grant_ends_at)
    );

  select count(*)
  into department_scope_count
  from public.role_grant_department_scopes as scope
  where scope.role_grant_id = grant_id
    and scope.starts_at <= grant_starts_at
    and (
      scope.ends_at is null
      or (grant_ends_at is not null and scope.ends_at >= grant_ends_at)
    );

  select count(*)
  into branch_scope_total
  from public.role_grant_branch_scopes as scope
  where scope.role_grant_id = grant_id;

  select count(*)
  into department_scope_total
  from public.role_grant_department_scopes as scope
  where scope.role_grant_id = grant_id;

  select count(*)
  into invalid_scope_pair_count
  from public.role_grant_branch_scopes as branch_scope
  cross join public.role_grant_department_scopes as department_scope
  where branch_scope.role_grant_id = grant_id
    and department_scope.role_grant_id = grant_id
    and branch_scope.starts_at <= grant_starts_at
    and (
      branch_scope.ends_at is null
      or (grant_ends_at is not null and branch_scope.ends_at >= grant_ends_at)
    )
    and department_scope.starts_at <= grant_starts_at
    and (
      department_scope.ends_at is null
      or (grant_ends_at is not null and department_scope.ends_at >= grant_ends_at)
    )
    and not exists (
      select 1
      from public.department_branches as department_branch
      where department_branch.branch_id = branch_scope.branch_id
        and department_branch.department_id = department_scope.department_id
    );

  if invalid_scope_pair_count <> 0 then
    raise exception 'Branch and department scopes must reference a valid department branch assignment'
      using errcode = '23514';
  end if;

  if grant_role = 'superadmin'
    and (branch_scope_total <> 0 or department_scope_total <> 0) then
    raise exception 'Super Admin grants must be global and unscoped'
      using errcode = '23514';
  elsif grant_role in ('student', 'registrar', 'branchadmin')
    and (branch_scope_count = 0 or department_scope_total <> 0) then
    raise exception '% grants require branch scope only', grant_role
      using errcode = '23514';
  elsif grant_role = 'teacher'
    and (branch_scope_count = 0 or department_scope_count = 0) then
    raise exception 'Teacher grants require branch and department scope'
      using errcode = '23514';
  elsif grant_role = 'headofdepartment' and department_scope_count = 0 then
    raise exception 'HOD grants require department scope'
      using errcode = '23514';
  end if;

  return null;
end;
$$;

create function nile_private.validate_auth_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  mapped_user_status text;
  grant_status text;
  grant_starts_at timestamptz;
  grant_ends_at timestamptz;
begin
  select app_user.status
  into strict mapped_user_status
  from public.app_users as app_user
  where app_user.id = new.user_id;

  select role_grant.status, role_grant.starts_at, role_grant.ends_at
  into strict grant_status, grant_starts_at, grant_ends_at
  from public.role_grants as role_grant
  where role_grant.id = new.active_role_grant_id
    and role_grant.user_id = new.user_id;

  if mapped_user_status <> 'active'
    or grant_status <> 'active'
    or grant_starts_at > pg_catalog.now()
    or (grant_ends_at is not null and grant_ends_at <= pg_catalog.now()) then
    raise exception 'Session requires an active user and effective role grant'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create function nile_private.resolve_auth_session(p_token_hash bytea)
returns table (
  session_id uuid,
  user_id uuid,
  active_role_grant_id uuid,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    session.id,
    session.user_id,
    session.active_role_grant_id,
    session.expires_at
  from public.auth_sessions as session
  join public.app_users as app_user on app_user.id = session.user_id
  join public.role_grants as role_grant
    on role_grant.id = session.active_role_grant_id
   and role_grant.user_id = session.user_id
  where session.token_hash = p_token_hash
    and session.revoked_at is null
    and session.expires_at > pg_catalog.now()
    and app_user.status = 'active'
    and role_grant.status = 'active'
    and role_grant.starts_at <= pg_catalog.now()
    and (role_grant.ends_at is null or role_grant.ends_at > pg_catalog.now())
$$;

create function nile_private.resolve_effective_role_grant(
  p_user_id uuid,
  p_role_grant_id uuid,
  p_at timestamptz
)
returns table (
  active_role text,
  branch_ids uuid[],
  department_ids uuid[]
)
language sql
stable
security definer
set search_path = ''
as $$
  with grant_row as (
    select role_grant.role
    from public.role_grants as role_grant
    where role_grant.id = p_role_grant_id
      and role_grant.user_id = p_user_id
      and role_grant.status = 'active'
      and role_grant.starts_at <= p_at
      and (role_grant.ends_at is null or role_grant.ends_at > p_at)
  ),
  scope_row as (
    select
      grant_row.role,
      coalesce(
        (
          select pg_catalog.array_agg(scope.branch_id order by scope.branch_id)
          from public.role_grant_branch_scopes as scope
          join public.branches as branch
            on branch.id = scope.branch_id
           and branch.status = 'active'
          where scope.role_grant_id = p_role_grant_id
            and scope.starts_at <= p_at
            and (scope.ends_at is null or scope.ends_at > p_at)
        ),
        '{}'::uuid[]
      ) as branch_ids,
      coalesce(
        (
          select pg_catalog.array_agg(scope.department_id order by scope.department_id)
          from public.role_grant_department_scopes as scope
          join public.departments as department
            on department.id = scope.department_id
           and department.status = 'active'
          where scope.role_grant_id = p_role_grant_id
            and scope.starts_at <= p_at
            and (scope.ends_at is null or scope.ends_at > p_at)
        ),
        '{}'::uuid[]
      ) as department_ids
    from grant_row
  )
  select scope_row.role, scope_row.branch_ids, scope_row.department_ids
  from scope_row
  where
    not exists (
      select 1
      from pg_catalog.unnest(scope_row.branch_ids) as branch_scope(branch_id)
      cross join pg_catalog.unnest(scope_row.department_ids) as department_scope(department_id)
      where not exists (
        select 1
        from public.department_branches as department_branch
        where department_branch.branch_id = branch_scope.branch_id
          and department_branch.department_id = department_scope.department_id
      )
    )
    and (
      (
      scope_row.role = 'superadmin'
      and pg_catalog.cardinality(scope_row.branch_ids) = 0
      and pg_catalog.cardinality(scope_row.department_ids) = 0
    )
    or (
      scope_row.role in ('student', 'registrar', 'branchadmin')
      and pg_catalog.cardinality(scope_row.branch_ids) > 0
      and pg_catalog.cardinality(scope_row.department_ids) = 0
    )
    or (
      scope_row.role = 'teacher'
      and pg_catalog.cardinality(scope_row.branch_ids) > 0
      and pg_catalog.cardinality(scope_row.department_ids) > 0
    )
    or (
      scope_row.role = 'headofdepartment'
      and pg_catalog.cardinality(scope_row.department_ids) > 0
    )
    )
$$;

create function public.resolve_login_authority(
  p_auth_user_id uuid,
  p_requested_role text
)
returns table (
  user_id uuid,
  auth_user_id uuid,
  email text,
  full_name text,
  active_role_grant_id uuid,
  active_role text,
  branch_ids uuid[],
  department_ids uuid[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    app_user.id,
    app_user.auth_user_id,
    app_user.email::text,
    app_user.full_name,
    role_grant.id,
    authority.active_role,
    authority.branch_ids,
    authority.department_ids
  from public.app_users as app_user
  join public.role_grants as role_grant
    on role_grant.user_id = app_user.id
   and role_grant.role = p_requested_role
  cross join lateral nile_private.resolve_effective_role_grant(
    app_user.id,
    role_grant.id,
    pg_catalog.now()
  ) as authority
  where app_user.auth_user_id = p_auth_user_id
    and app_user.status = 'active'
$$;

create function public.resolve_auth_session_authority(p_token_hash text)
returns table (
  user_id uuid,
  auth_user_id uuid,
  email text,
  full_name text,
  active_role_grant_id uuid,
  active_role text,
  provider text,
  created_at timestamptz,
  expires_at timestamptz,
  branch_ids uuid[],
  department_ids uuid[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    app_user.id,
    app_user.auth_user_id,
    app_user.email::text,
    app_user.full_name,
    session.active_role_grant_id,
    authority.active_role,
    session.provider,
    session.created_at,
    session.expires_at,
    authority.branch_ids,
    authority.department_ids
  from public.auth_sessions as session
  join public.app_users as app_user on app_user.id = session.user_id
  cross join lateral nile_private.resolve_effective_role_grant(
    session.user_id,
    session.active_role_grant_id,
    pg_catalog.now()
  ) as authority
  where session.token_hash = case
      when p_token_hash ~ '^[0-9a-f]{64}$'
        then pg_catalog.decode(p_token_hash, 'hex')
      else null
    end
    and session.revoked_at is null
    and session.expires_at > pg_catalog.now()
    and app_user.status = 'active'
$$;

create function nile_private.enforce_sync_direction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  connection_provider text;
  connection_mode text;
begin
  select connection.provider, connection.mode
  into strict connection_provider, connection_mode
  from public.integration_connections as connection
  where connection.id = new.connection_id;

  if new.direction = 'write' and connection_mode <> 'write_limited' then
    raise exception 'Connection % is not approved for writes', new.connection_id
      using errcode = '42501';
  end if;

  if new.direction = 'write' and connection_provider = 'legacy_ems' then
    raise exception 'Legacy EMS writeback is prohibited'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create function nile_private.enforce_migration_connection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  connection_provider text;
  connection_mode text;
begin
  select connection.provider, connection.mode
  into strict connection_provider, connection_mode
  from public.integration_connections as connection
  where connection.id = new.connection_id;

  if connection_provider <> 'legacy_ems' or connection_mode <> 'migration' then
    raise exception 'Migration runs require a legacy_ems migration connection'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create function nile_private.preserve_external_record_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'External mappings are durable evidence and cannot be deleted'
      using errcode = '55000';
  end if;

  if old.id is distinct from new.id
    or old.connection_id is distinct from new.connection_id
    or old.entity_type is distinct from new.entity_type
    or old.external_id is distinct from new.external_id
    or old.created_at is distinct from new.created_at then
    raise exception 'External source identity is immutable'
      using errcode = '55000';
  end if;

  if old.internal_id is not null and old.internal_id is distinct from new.internal_id then
    raise exception 'An established external-to-internal mapping cannot be rewritten'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create function nile_private.validate_migration_item_source()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  mapped_external_id text;
  mapped_source_hash bytea;
  mapped_internal_id uuid;
  migration_kind text;
  migration_status text;
begin
  select
    external_record.external_id,
    external_record.source_hash,
    external_record.internal_id
  into strict mapped_external_id, mapped_source_hash, mapped_internal_id
  from public.external_records as external_record
  where external_record.id = new.external_record_id
    and external_record.connection_id = new.connection_id
    and external_record.entity_type = new.entity_type;

  if mapped_external_id is distinct from new.external_id
    or mapped_source_hash is null
    or mapped_source_hash is distinct from new.source_hash then
    raise exception 'Migration item must preserve the mapped source identity and payload hash'
      using errcode = '23514';
  end if;

  select migration_run.run_kind, migration_run.status
  into strict migration_kind, migration_status
  from public.migration_runs as migration_run
  where migration_run.id = new.migration_run_id
    and migration_run.connection_id = new.connection_id
    and migration_run.entity_type = new.entity_type;

  if new.match_status = 'imported'
    and (migration_kind = 'dry_run' or migration_status <> 'applying') then
    raise exception 'Imported migration items require an applying non-dry-run migration'
      using errcode = '23514';
  end if;

  if new.match_status = 'imported'
    and (mapped_internal_id is null or mapped_internal_id is distinct from new.internal_id) then
    raise exception 'Imported migration item must use the durable external-record mapping'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create function nile_private.preserve_outbox_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.command_id is distinct from new.command_id
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

create function nile_private.preserve_role_grant_history()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Role grants must be revoked or expired, not deleted'
      using errcode = '55000';
  end if;

  if old.id is distinct from new.id
    or old.user_id is distinct from new.user_id
    or old.role is distinct from new.role
    or old.starts_at is distinct from new.starts_at
    or old.ends_at is distinct from new.ends_at
    or old.granted_by is distinct from new.granted_by
    or old.granted_reason is distinct from new.granted_reason
    or old.created_at is distinct from new.created_at then
    raise exception 'Role-grant identity, effective window, and provenance are immutable'
      using errcode = '55000';
  end if;

  if not (
    old.status = new.status
    or (old.status = 'pending' and new.status in ('active', 'revoked'))
    or (old.status = 'active' and new.status in ('revoked', 'expired'))
  ) then
    raise exception 'Invalid role-grant transition from % to %', old.status, new.status
      using errcode = '23514';
  end if;

  if old.status in ('revoked', 'expired') then
    raise exception 'Terminal role-grant evidence cannot be rewritten'
      using errcode = '55000';
  end if;

  if new.status = 'expired'
    and (new.ends_at is null or new.ends_at > pg_catalog.now()) then
    raise exception 'A role grant can expire only after its immutable effective window ends'
      using errcode = '23514';
  end if;

  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create function nile_private.preserve_scope_history()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Scope history rows cannot be deleted'
      using errcode = '55000';
  end if;

  if old.id is distinct from new.id
    or old.role_grant_id is distinct from new.role_grant_id
    or old.starts_at is distinct from new.starts_at
    or old.granted_by is distinct from new.granted_by
    or old.created_at is distinct from new.created_at
    or (to_jsonb(old) ->> 'branch_id') is distinct from (to_jsonb(new) ->> 'branch_id')
    or (to_jsonb(old) ->> 'department_id') is distinct from (to_jsonb(new) ->> 'department_id') then
    raise exception 'Scope identity and provenance are immutable'
      using errcode = '55000';
  end if;

  if old.ends_at is not null and old.ends_at is distinct from new.ends_at then
    raise exception 'A retired scope window cannot be reopened or rewritten'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create function nile_private.preserve_session_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Sessions must be revoked, not deleted'
      using errcode = '55000';
  end if;

  if old.id is distinct from new.id
    or old.token_hash is distinct from new.token_hash
    or old.user_id is distinct from new.user_id
    or old.active_role_grant_id is distinct from new.active_role_grant_id
    or old.provider is distinct from new.provider
    or old.created_at is distinct from new.created_at
    or old.expires_at is distinct from new.expires_at then
    raise exception 'Session identity and authority are immutable'
      using errcode = '55000';
  end if;

  if old.revoked_at is not null and old is distinct from new then
    raise exception 'A revoked session cannot be reopened or rewritten'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create function nile_private.preserve_command_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Command execution rows cannot be deleted'
      using errcode = '55000';
  end if;

  if old.id is distinct from new.id
    or old.idempotency_key is distinct from new.idempotency_key
    or old.actor_user_id is distinct from new.actor_user_id
    or old.actor_role_grant_id is distinct from new.actor_role_grant_id
    or old.session_id is distinct from new.session_id
    or old.command_type is distinct from new.command_type
    or old.target_type is distinct from new.target_type
    or old.target_id is distinct from new.target_id
    or old.request_hash is distinct from new.request_hash
    or old.requires_outbox is distinct from new.requires_outbox
    or old.started_at is distinct from new.started_at then
    raise exception 'Command identity and request evidence are immutable'
      using errcode = '55000';
  end if;

  if old.status = 'succeeded' and old is distinct from new then
    raise exception 'Completed commands cannot be reopened or rewritten'
      using errcode = '55000';
  end if;

  if old.status = 'started' and new.status not in ('started', 'succeeded') then
    raise exception 'Invalid command transition from % to %', old.status, new.status
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create function nile_private.require_command_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'succeeded' then
    return null;
  end if;

  if not exists (
    select 1 from public.audit_logs as audit where audit.command_id = new.id
  ) then
    raise exception 'A successful command requires immutable audit evidence'
      using errcode = '23514';
  end if;

  if new.requires_outbox and not exists (
    select 1 from public.outbox_events as event where event.command_id = new.id
  ) then
    raise exception 'This successful command requires an outbox event'
      using errcode = '23514';
  end if;

  return null;
end;
$$;

create function nile_private.preserve_migration_run_history()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Migration runs are durable evidence and cannot be deleted'
      using errcode = '55000';
  end if;

  if old.id is distinct from new.id
    or old.connection_id is distinct from new.connection_id
    or old.entity_type is distinct from new.entity_type
    or old.run_kind is distinct from new.run_kind
    or old.source_watermark is distinct from new.source_watermark
    or old.source_manifest_hash is distinct from new.source_manifest_hash
    or old.created_by is distinct from new.created_by
    or old.created_at is distinct from new.created_at then
    raise exception 'Migration source identity and manifest evidence are immutable'
      using errcode = '55000';
  end if;

  if old.status = 'rolled_back' and old is distinct from new then
    raise exception 'Completed migration evidence cannot be rewritten'
      using errcode = '55000';
  end if;

  if old.status = 'completed'
    and new.status = 'completed'
    and old is distinct from new then
    raise exception 'Completed migration evidence cannot be rewritten'
      using errcode = '55000';
  end if;

  if old.approved_at is not null
    and (old.approved_at is distinct from new.approved_at
      or old.approved_by is distinct from new.approved_by) then
    raise exception 'Migration approval evidence cannot be rewritten'
      using errcode = '55000';
  end if;

  if old.started_at is not null and old.started_at is distinct from new.started_at then
    raise exception 'Migration start evidence cannot be rewritten'
      using errcode = '55000';
  end if;

  if old.completed_at is not null and old.completed_at is distinct from new.completed_at then
    raise exception 'Migration completion evidence cannot be rewritten'
      using errcode = '55000';
  end if;

  if not (
    old.status = new.status
    or (old.status = 'draft' and new.status in ('validating', 'failed'))
    or (old.status = 'validating' and new.status in ('ready', 'failed'))
    or (old.status = 'ready' and new.status in ('approved', 'failed'))
    or (old.status = 'approved' and new.status in ('applying', 'failed'))
    or (old.status = 'applying' and new.status in ('completed', 'failed'))
    or (old.status in ('completed', 'failed') and new.status = 'rolled_back')
  ) then
    raise exception 'Invalid migration transition from % to %', old.status, new.status
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create function nile_private.preserve_migration_item_history()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Migration item evidence cannot be deleted'
      using errcode = '55000';
  end if;

  if old.id is distinct from new.id
    or old.migration_run_id is distinct from new.migration_run_id
    or old.connection_id is distinct from new.connection_id
    or old.entity_type is distinct from new.entity_type
    or old.external_record_id is distinct from new.external_record_id
    or old.external_id is distinct from new.external_id
    or old.source_hash is distinct from new.source_hash
    or old.before_image is distinct from new.before_image
    or old.created_at is distinct from new.created_at then
    raise exception 'Migration item source identity and payload evidence are immutable'
      using errcode = '55000';
  end if;

  if old.match_status in ('imported', 'rejected') and old is distinct from new then
    raise exception 'Terminal migration items cannot be rewritten'
      using errcode = '55000';
  end if;

  if old.internal_id is not null and old.internal_id is distinct from new.internal_id then
    raise exception 'A migration item mapping cannot be rewritten'
      using errcode = '55000';
  end if;

  if old.applied_at is not null and old.applied_at is distinct from new.applied_at then
    raise exception 'Migration application evidence cannot be rewritten'
      using errcode = '55000';
  end if;

  if not (
    old.match_status = new.match_status
    or (old.match_status = 'unmatched' and new.match_status in ('matched', 'ambiguous', 'rejected'))
    or (old.match_status = 'ambiguous' and new.match_status in ('matched', 'rejected'))
    or (old.match_status = 'matched' and new.match_status in ('imported', 'rejected'))
  ) then
    raise exception 'Invalid migration item transition from % to %', old.match_status, new.match_status
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create function nile_private.require_cutover_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  missing_evidence text[];
begin
  if new.status <> 'completed' or new.run_kind <> 'cutover' then
    return null;
  end if;

  select pg_catalog.array_agg(required.evidence_type order by required.evidence_type)
  into missing_evidence
  from unnest(array[
    'reconciliation_approval',
    'final_delta',
    'cutover',
    'rollback',
    'credential_retirement'
  ]) as required(evidence_type)
  where not exists (
    select 1
    from public.migration_evidence as evidence
    where evidence.migration_run_id = new.id
      and evidence.evidence_type = required.evidence_type
  );

  if missing_evidence is not null then
    raise exception 'Cutover is missing required evidence: %', missing_evidence
      using errcode = '23514';
  end if;

  return null;
end;
$$;

revoke all on all functions in schema nile_private from public, anon, authenticated;

revoke all on function public.resolve_login_authority(uuid, text)
from public, anon, authenticated;
revoke all on function public.resolve_auth_session_authority(text)
from public, anon, authenticated;

grant usage on schema nile_private to service_role;
grant execute on all functions in schema nile_private to service_role;
grant execute on function public.resolve_login_authority(uuid, text)
to service_role;
grant execute on function public.resolve_auth_session_authority(text)
to service_role;

create trigger branches_set_updated_at
before update on public.branches
for each row execute function nile_private.set_updated_at();
create trigger app_users_set_updated_at
before update on public.app_users
for each row execute function nile_private.set_updated_at();
create trigger app_users_preserve_identity
before update on public.app_users
for each row execute function nile_private.preserve_app_user_identity();
create trigger departments_set_updated_at
before update on public.departments
for each row execute function nile_private.set_updated_at();
create trigger role_permissions_set_updated_at
before update on public.role_permissions
for each row execute function nile_private.set_updated_at();
create trigger role_grants_preserve_history
before update or delete on public.role_grants
for each row execute function nile_private.preserve_role_grant_history();
create trigger branch_scopes_preserve_history
before update or delete on public.role_grant_branch_scopes
for each row execute function nile_private.preserve_scope_history();
create trigger department_scopes_preserve_history
before update or delete on public.role_grant_department_scopes
for each row execute function nile_private.preserve_scope_history();
create constraint trigger role_grants_validate_scope
after insert or update on public.role_grants
deferrable initially deferred
for each row execute function nile_private.validate_role_grant_scope();
create constraint trigger branch_scopes_validate_grant
after insert or update or delete on public.role_grant_branch_scopes
deferrable initially deferred
for each row execute function nile_private.validate_role_grant_scope();
create constraint trigger department_scopes_validate_grant
after insert or update or delete on public.role_grant_department_scopes
deferrable initially deferred
for each row execute function nile_private.validate_role_grant_scope();
create trigger staff_profiles_set_updated_at
before update on public.staff_profiles
for each row execute function nile_private.set_updated_at();
create trigger auth_sessions_validate
before insert or update of user_id, active_role_grant_id on public.auth_sessions
for each row execute function nile_private.validate_auth_session();
create trigger auth_sessions_preserve_identity
before update or delete on public.auth_sessions
for each row execute function nile_private.preserve_session_identity();
create trigger command_executions_preserve_identity
before update or delete on public.command_executions
for each row execute function nile_private.preserve_command_identity();
create constraint trigger command_evidence_required
after insert or update of status on public.command_executions
deferrable initially deferred
for each row execute function nile_private.require_command_evidence();
create trigger outbox_events_set_updated_at
before update on public.outbox_events
for each row execute function nile_private.set_updated_at();
create trigger outbox_events_preserve_identity
before update on public.outbox_events
for each row execute function nile_private.preserve_outbox_identity();
create trigger integration_connections_set_updated_at
before update on public.integration_connections
for each row execute function nile_private.set_updated_at();
create trigger external_records_set_updated_at
before update on public.external_records
for each row execute function nile_private.set_updated_at();
create trigger external_records_preserve_identity
before update or delete on public.external_records
for each row execute function nile_private.preserve_external_record_identity();
create trigger reconciliation_cases_set_updated_at
before update on public.reconciliation_cases
for each row execute function nile_private.set_updated_at();
create trigger audit_logs_immutable
before update or delete on public.audit_logs
for each row execute function nile_private.reject_immutable_change();
create trigger migration_evidence_immutable
before update or delete on public.migration_evidence
for each row execute function nile_private.reject_immutable_change();
create trigger sync_runs_direction_guard
before insert or update of connection_id, direction on public.sync_runs
for each row execute function nile_private.enforce_sync_direction();
create trigger migration_runs_connection_guard
before insert or update of connection_id on public.migration_runs
for each row execute function nile_private.enforce_migration_connection();
create trigger migration_runs_preserve_history
before update or delete on public.migration_runs
for each row execute function nile_private.preserve_migration_run_history();
create constraint trigger migration_cutover_evidence_required
after insert or update of status on public.migration_runs
deferrable initially deferred
for each row execute function nile_private.require_cutover_evidence();
create trigger migration_run_items_validate_source
before insert or update on public.migration_run_items
for each row execute function nile_private.validate_migration_item_source();
create trigger migration_run_items_preserve_history
before update or delete on public.migration_run_items
for each row execute function nile_private.preserve_migration_item_history();

alter table public.branches enable row level security;
alter table public.branches force row level security;
alter table public.app_users enable row level security;
alter table public.app_users force row level security;
alter table public.departments enable row level security;
alter table public.departments force row level security;
alter table public.department_branches enable row level security;
alter table public.department_branches force row level security;
alter table public.permissions enable row level security;
alter table public.permissions force row level security;
alter table public.role_permissions enable row level security;
alter table public.role_permissions force row level security;
alter table public.role_grants enable row level security;
alter table public.role_grants force row level security;
alter table public.role_grant_branch_scopes enable row level security;
alter table public.role_grant_branch_scopes force row level security;
alter table public.role_grant_department_scopes enable row level security;
alter table public.role_grant_department_scopes force row level security;
alter table public.staff_profiles enable row level security;
alter table public.staff_profiles force row level security;
alter table public.staff_subjects enable row level security;
alter table public.staff_subjects force row level security;
alter table public.auth_sessions enable row level security;
alter table public.auth_sessions force row level security;
alter table public.command_executions enable row level security;
alter table public.command_executions force row level security;
alter table public.audit_logs enable row level security;
alter table public.audit_logs force row level security;
alter table public.outbox_events enable row level security;
alter table public.outbox_events force row level security;
alter table public.integration_connections enable row level security;
alter table public.integration_connections force row level security;
alter table public.integration_env_requirements enable row level security;
alter table public.integration_env_requirements force row level security;
alter table public.external_records enable row level security;
alter table public.external_records force row level security;
alter table public.sync_cursors enable row level security;
alter table public.sync_cursors force row level security;
alter table public.sync_runs enable row level security;
alter table public.sync_runs force row level security;
alter table public.sync_run_items enable row level security;
alter table public.sync_run_items force row level security;
alter table public.reconciliation_cases enable row level security;
alter table public.reconciliation_cases force row level security;
alter table public.migration_runs enable row level security;
alter table public.migration_runs force row level security;
alter table public.migration_run_items enable row level security;
alter table public.migration_run_items force row level security;
alter table public.migration_evidence enable row level security;
alter table public.migration_evidence force row level security;

revoke all on table
  public.branches,
  public.app_users,
  public.departments,
  public.department_branches,
  public.permissions,
  public.role_permissions,
  public.role_grants,
  public.role_grant_branch_scopes,
  public.role_grant_department_scopes,
  public.staff_profiles,
  public.staff_subjects,
  public.auth_sessions,
  public.command_executions,
  public.audit_logs,
  public.outbox_events,
  public.integration_connections,
  public.integration_env_requirements,
  public.external_records,
  public.sync_cursors,
  public.sync_runs,
  public.sync_run_items,
  public.reconciliation_cases,
  public.migration_runs,
  public.migration_run_items,
  public.migration_evidence
from public, anon, authenticated;

revoke all on sequence public.audit_logs_id_seq
from public, anon, authenticated;

grant select, insert, update, delete on table
  public.branches,
  public.app_users,
  public.departments,
  public.department_branches,
  public.permissions,
  public.role_permissions,
  public.role_grants,
  public.role_grant_branch_scopes,
  public.role_grant_department_scopes,
  public.staff_profiles,
  public.staff_subjects,
  public.auth_sessions,
  public.command_executions,
  public.audit_logs,
  public.outbox_events,
  public.integration_connections,
  public.integration_env_requirements,
  public.external_records,
  public.sync_cursors,
  public.sync_runs,
  public.sync_run_items,
  public.reconciliation_cases,
  public.migration_runs,
  public.migration_run_items,
  public.migration_evidence
to service_role;
grant usage, select on sequence public.audit_logs_id_seq to service_role;

-- Phase 1 normalized base tables are server-only. The browser receives scoped
-- DTOs from server APIs that resolve the opaque application session and its
-- single active role grant. Direct authenticated policies are deliberately
-- absent so Supabase Auth JWTs cannot union multi-role grants or bypass the
-- application session boundary.

commit;

-- ============================================================================
-- 04. Phase 2B atomic session lifecycle
-- Source: supabase/migrations/20260710132000_phase2b_atomic_session_lifecycle.sql
-- SHA-256: e99d5a8534257c56f53cc952c7de79c68a11454e10e6b6442b6a23cabdc2ebe9
-- ============================================================================

-- Nile Learn Phase 2B: atomic durable-session lifecycle evidence.
--
-- Local-only until the master-plan checkpoint explicitly approves remote
-- promotion. These RPCs are server-only and never accept plaintext tokens.

begin;

create unique index audit_logs_session_lifecycle_uidx
  on public.audit_logs (action, entity_type, entity_id)
  where entity_type = 'auth_session'
    and action in ('session.created', 'session.revoked');

create function public.create_auth_session_with_evidence(
  p_token_hash text,
  p_user_id uuid,
  p_auth_user_id uuid,
  p_active_role_grant_id uuid,
  p_ttl_seconds integer,
  p_idempotency_key text,
  p_request_hash text
)
returns table (
  session_id uuid,
  command_id uuid,
  session_created_at timestamptz,
  session_expires_at timestamptz,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token_hash bytea;
  v_request_hash bytea;
  v_existing_command public.command_executions%rowtype;
  v_existing_audit public.audit_logs%rowtype;
  v_existing_session public.auth_sessions%rowtype;
  v_session_id uuid;
  v_command_id uuid;
  v_created_at timestamptz;
  v_expires_at timestamptz;
  v_grant_ends_at timestamptz;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-fA-F]{64}$' then
    raise exception 'Session token hash must be 64 hexadecimal characters'
      using errcode = '22023';
  end if;
  if p_request_hash is null or p_request_hash !~ '^[0-9a-fA-F]{64}$' then
    raise exception 'Session request hash must be 64 hexadecimal characters'
      using errcode = '22023';
  end if;
  if p_idempotency_key is null
    or pg_catalog.btrim(p_idempotency_key) = ''
    or pg_catalog.octet_length(p_idempotency_key) > 200 then
    raise exception 'Session idempotency key is invalid'
      using errcode = '22023';
  end if;
  if p_ttl_seconds is null or p_ttl_seconds < 60 or p_ttl_seconds > 43200 then
    raise exception 'Session TTL must be between 60 and 43200 seconds'
      using errcode = '22023';
  end if;

  v_token_hash := pg_catalog.decode(pg_catalog.lower(p_token_hash), 'hex');
  v_request_hash := pg_catalog.decode(pg_catalog.lower(p_request_hash), 'hex');

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_idempotency_key, 0)
  );

  select command.*
  into v_existing_command
  from public.command_executions as command
  where command.idempotency_key = p_idempotency_key;

  if found then
    if v_existing_command.command_type is distinct from 'session.create'
      or v_existing_command.actor_user_id is distinct from p_user_id
      or v_existing_command.actor_role_grant_id is distinct from p_active_role_grant_id
      or v_existing_command.request_hash is distinct from v_request_hash
      or v_existing_command.target_type is distinct from 'auth_session'
      or v_existing_command.target_id is distinct from v_existing_command.session_id::text then
      raise exception 'Session create idempotency key conflicts with existing evidence'
        using errcode = '23505';
    end if;
    if v_existing_command.status <> 'succeeded' then
      raise exception 'Session create evidence is incomplete'
        using errcode = '55000';
    end if;

    select session.*
    into v_existing_session
    from public.auth_sessions as session
    where session.id = v_existing_command.session_id;

    if not found then
      raise exception 'Session create evidence is incomplete'
        using errcode = '55000';
    end if;
    if v_existing_session.token_hash is distinct from v_token_hash
      or v_existing_session.user_id is distinct from p_user_id
      or v_existing_session.active_role_grant_id is distinct from p_active_role_grant_id then
      raise exception 'Session create idempotency key conflicts with existing session parameters'
        using errcode = '23505';
    end if;

    select audit.*
    into v_existing_audit
    from public.audit_logs as audit
    where audit.command_id = v_existing_command.id
      and audit.action = 'session.created'
      and audit.entity_type = 'auth_session'
      and audit.entity_id = v_existing_command.session_id::text;

    if not found then
      raise exception 'Session create evidence is incomplete'
        using errcode = '55000';
    end if;
    if v_existing_audit.after_state -> 'status'
        is distinct from pg_catalog.to_jsonb('active'::text)
      or v_existing_audit.after_state -> 'provider'
        is distinct from pg_catalog.to_jsonb(v_existing_session.provider)
      or v_existing_audit.after_state -> 'created_at'
        is distinct from pg_catalog.to_jsonb(v_existing_session.created_at)
      or v_existing_audit.after_state -> 'expires_at'
        is distinct from pg_catalog.to_jsonb(v_existing_session.expires_at)
      or v_existing_audit.metadata -> 'session_model'
        is distinct from pg_catalog.to_jsonb('normalized'::text) then
      raise exception 'Session create evidence is incomplete'
        using errcode = '55000';
    end if;
    if v_existing_audit.metadata -> 'auth_user_id'
        is distinct from pg_catalog.to_jsonb(p_auth_user_id)
      or v_existing_audit.metadata -> 'requested_ttl_seconds'
        is distinct from pg_catalog.to_jsonb(p_ttl_seconds) then
      raise exception 'Session create idempotency key conflicts with existing request parameters'
        using errcode = '23505';
    end if;

    v_created_at := v_existing_session.created_at;
    v_expires_at := v_existing_session.expires_at;

    return query
    select
      v_existing_command.session_id,
      v_existing_command.id,
      v_created_at,
      v_expires_at,
      true;
    return;
  end if;

  select role_grant.ends_at
  into v_grant_ends_at
  from public.app_users as app_user
  join public.role_grants as role_grant
    on role_grant.id = p_active_role_grant_id
   and role_grant.user_id = app_user.id
  cross join lateral nile_private.resolve_effective_role_grant(
    app_user.id,
    role_grant.id,
    pg_catalog.statement_timestamp()
  ) as authority
  where app_user.id = p_user_id
    and app_user.auth_user_id = p_auth_user_id
    and app_user.status = 'active';

  if not found then
    raise exception 'Session creation requires one active mapped user and effective role grant'
      using errcode = '42501';
  end if;

  v_created_at := pg_catalog.statement_timestamp();
  v_expires_at := v_created_at
    + pg_catalog.make_interval(secs => p_ttl_seconds);
  if v_grant_ends_at is not null and v_grant_ends_at < v_expires_at then
    v_expires_at := v_grant_ends_at;
  end if;
  if v_expires_at <= v_created_at then
    raise exception 'Session role grant expires too soon'
      using errcode = '42501';
  end if;

  insert into public.auth_sessions (
    token_hash,
    user_id,
    active_role_grant_id,
    provider,
    created_at,
    expires_at
  )
  values (
    v_token_hash,
    p_user_id,
    p_active_role_grant_id,
    'supabase',
    v_created_at,
    v_expires_at
  )
  returning id into v_session_id;

  insert into public.command_executions (
    idempotency_key,
    actor_user_id,
    actor_role_grant_id,
    session_id,
    command_type,
    target_type,
    target_id,
    request_hash
  )
  values (
    p_idempotency_key,
    p_user_id,
    p_active_role_grant_id,
    v_session_id,
    'session.create',
    'auth_session',
    v_session_id::text,
    v_request_hash
  )
  returning id into v_command_id;

  insert into public.audit_logs (
    command_id,
    actor_user_id,
    actor_role_grant_id,
    session_id,
    action,
    entity_type,
    entity_id,
    after_state,
    metadata
  )
  values (
    v_command_id,
    p_user_id,
    p_active_role_grant_id,
    v_session_id,
    'session.created',
    'auth_session',
    v_session_id::text,
    pg_catalog.jsonb_build_object(
      'status', 'active',
      'provider', 'supabase',
      'created_at', v_created_at,
      'expires_at', v_expires_at
    ),
    pg_catalog.jsonb_build_object(
      'session_model', 'normalized',
      'auth_user_id', p_auth_user_id,
      'requested_ttl_seconds', p_ttl_seconds
    )
  );

  update public.command_executions
  set status = 'succeeded',
      completed_at = pg_catalog.statement_timestamp()
  where id = v_command_id;

  return query
  select v_session_id, v_command_id, v_created_at, v_expires_at, false;
end;
$$;

create function public.revoke_auth_session_with_evidence(
  p_token_hash text,
  p_idempotency_key text,
  p_request_hash text
)
returns table (
  session_id uuid,
  command_id uuid,
  session_revoked_at timestamptz,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token_hash bytea;
  v_request_hash bytea;
  v_existing_command public.command_executions%rowtype;
  v_existing_audit public.audit_logs%rowtype;
  v_session public.auth_sessions%rowtype;
  v_command_id uuid;
  v_revoked_at timestamptz;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-fA-F]{64}$' then
    raise exception 'Session token hash must be 64 hexadecimal characters'
      using errcode = '22023';
  end if;
  if p_request_hash is null or p_request_hash !~ '^[0-9a-fA-F]{64}$' then
    raise exception 'Session request hash must be 64 hexadecimal characters'
      using errcode = '22023';
  end if;
  if p_idempotency_key is null
    or pg_catalog.btrim(p_idempotency_key) = ''
    or pg_catalog.octet_length(p_idempotency_key) > 200 then
    raise exception 'Session idempotency key is invalid'
      using errcode = '22023';
  end if;

  v_token_hash := pg_catalog.decode(pg_catalog.lower(p_token_hash), 'hex');
  v_request_hash := pg_catalog.decode(pg_catalog.lower(p_request_hash), 'hex');

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_idempotency_key, 0)
  );

  select command.*
  into v_existing_command
  from public.command_executions as command
  where command.idempotency_key = p_idempotency_key;

  if found then
    if v_existing_command.command_type is distinct from 'session.revoke'
      or v_existing_command.request_hash is distinct from v_request_hash
      or v_existing_command.target_type is distinct from 'auth_session'
      or v_existing_command.target_id is distinct from v_existing_command.session_id::text then
      raise exception 'Session revoke idempotency key conflicts with existing evidence'
        using errcode = '23505';
    end if;
    if v_existing_command.status <> 'succeeded' then
      raise exception 'Session revoke evidence is incomplete'
        using errcode = '55000';
    end if;

    select session.*
    into v_session
    from public.auth_sessions as session
    where session.id = v_existing_command.session_id;

    if not found or v_session.revoked_at is null then
      raise exception 'Session revoke evidence is incomplete'
        using errcode = '55000';
    end if;
    if v_session.token_hash is distinct from v_token_hash then
      raise exception 'Session revoke idempotency key conflicts with existing session parameters'
        using errcode = '23505';
    end if;

    select audit.*
    into v_existing_audit
    from public.audit_logs as audit
    where audit.command_id = v_existing_command.id
      and audit.action = 'session.revoked'
      and audit.entity_type = 'auth_session'
      and audit.entity_id = v_existing_command.session_id::text;

    if not found then
      raise exception 'Session revoke evidence is incomplete'
        using errcode = '55000';
    end if;
    if v_existing_audit.before_state -> 'status'
        is distinct from pg_catalog.to_jsonb('active'::text)
      or v_existing_audit.before_state -> 'expires_at'
        is distinct from pg_catalog.to_jsonb(v_session.expires_at)
      or v_existing_audit.after_state -> 'status'
        is distinct from pg_catalog.to_jsonb('revoked'::text)
      or v_existing_audit.after_state -> 'revoked_at'
        is distinct from pg_catalog.to_jsonb(v_session.revoked_at)
      or v_existing_audit.after_state -> 'revoked_by'
        is distinct from pg_catalog.to_jsonb(v_session.user_id)
      or v_existing_audit.metadata -> 'session_model'
        is distinct from pg_catalog.to_jsonb('normalized'::text) then
      raise exception 'Session revoke evidence is incomplete'
        using errcode = '55000';
    end if;

    v_revoked_at := v_session.revoked_at;

    return query
    select
      v_existing_command.session_id,
      v_existing_command.id,
      v_revoked_at,
      true;
    return;
  end if;

  select session.*
  into v_session
  from public.auth_sessions as session
  where session.token_hash = v_token_hash
  for update;

  if not found or v_session.revoked_at is not null then
    return;
  end if;

  v_revoked_at := pg_catalog.statement_timestamp();

  insert into public.command_executions (
    idempotency_key,
    actor_user_id,
    actor_role_grant_id,
    session_id,
    command_type,
    target_type,
    target_id,
    request_hash
  )
  values (
    p_idempotency_key,
    v_session.user_id,
    v_session.active_role_grant_id,
    v_session.id,
    'session.revoke',
    'auth_session',
    v_session.id::text,
    v_request_hash
  )
  returning id into v_command_id;

  update public.auth_sessions
  set revoked_at = v_revoked_at,
      revoked_by = v_session.user_id
  where id = v_session.id;

  insert into public.audit_logs (
    command_id,
    actor_user_id,
    actor_role_grant_id,
    session_id,
    action,
    entity_type,
    entity_id,
    before_state,
    after_state,
    metadata
  )
  values (
    v_command_id,
    v_session.user_id,
    v_session.active_role_grant_id,
    v_session.id,
    'session.revoked',
    'auth_session',
    v_session.id::text,
    pg_catalog.jsonb_build_object(
      'status', 'active',
      'expires_at', v_session.expires_at
    ),
    pg_catalog.jsonb_build_object(
      'status', 'revoked',
      'revoked_at', v_revoked_at,
      'revoked_by', v_session.user_id
    ),
    pg_catalog.jsonb_build_object('session_model', 'normalized')
  );

  update public.command_executions
  set status = 'succeeded',
      completed_at = pg_catalog.statement_timestamp()
  where id = v_command_id;

  return query
  select v_session.id, v_command_id, v_revoked_at, false;
end;
$$;

revoke all on function public.create_auth_session_with_evidence(
  text, uuid, uuid, uuid, integer, text, text
) from public, anon, authenticated;
revoke all on function public.revoke_auth_session_with_evidence(text, text, text)
from public, anon, authenticated;

grant execute on function public.create_auth_session_with_evidence(
  text, uuid, uuid, uuid, integer, text, text
) to service_role;
grant execute on function public.revoke_auth_session_with_evidence(text, text, text)
to service_role;

commit;

-- ============================================================================
-- 05. Compatibility cross-instance sessions
-- Source: supabase/migrations/20260718193000_compatibility_auth_sessions.sql
-- SHA-256: f2bf7b806622e5297c5aa83cfa66e9b04485c356f04c14a2f116c482e81e8645
-- ============================================================================

-- Durable cross-instance sessions for the internal-alpha compatibility runtime.
-- This table stores SHA-256 token hashes only. Browser roles receive no access.

create table if not exists public.compatibility_auth_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique
    check (token_hash ~ '^[0-9a-f]{64}$'),
  user_id text not null,
  email text not null,
  full_name text not null,
  roles jsonb not null
    check (jsonb_typeof(roles) = 'array' and jsonb_array_length(roles) > 0),
  active_role text not null
    check (active_role in (
      'student',
      'teacher',
      'registrar',
      'headofdepartment',
      'branchadmin',
      'superadmin'
    )),
  provider text not null
    check (provider in ('demo', 'supabase')),
  created_at timestamptz not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  check (expires_at > created_at),
  check (revoked_at is null or revoked_at >= created_at)
);

create index if not exists compatibility_auth_sessions_expiry_idx
  on public.compatibility_auth_sessions (expires_at)
  where revoked_at is null;

create index if not exists compatibility_auth_sessions_user_idx
  on public.compatibility_auth_sessions (user_id, created_at desc);

alter table public.compatibility_auth_sessions enable row level security;
alter table public.compatibility_auth_sessions force row level security;

revoke all on table public.compatibility_auth_sessions
from public, anon, authenticated;
grant select, insert, update on table public.compatibility_auth_sessions
to service_role;

-- ============================================================================
-- 06. Nile Forms foundation
-- Source: supabase/migrations/20260711143555_nile_forms_foundation.sql
-- SHA-256: 2776e75f4d22a40d7d6444a265516d51b029d6c4c2525fd63a5f172d4118a93c
-- ============================================================================

-- Nile Learn Phase 13A Nile Forms schema foundation.
--
-- Status: additive local-only migration. Do not apply to a linked, shared,
-- preview, or production project without a separately approved promotion gate.
-- Phase 1 identity, role grants, scopes, audit, and outbox tables must exist.

begin;

create function nile_private.preserve_published_form_version()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and old.status <> 'draft' then
    raise exception 'Published form versions are immutable'
      using errcode = '55000';
  end if;

  if tg_op = 'UPDATE' and old.status in ('published', 'retired') then
    if old.id is distinct from new.id
      or old.definition_id is distinct from new.definition_id
      or old.version_number is distinct from new.version_number
      or old.revision is distinct from new.revision
      or old.schema_json is distinct from new.schema_json
      or old.logic_json is distinct from new.logic_json
      or old.translations_json is distinct from new.translations_json
      or old.content_hash is distinct from new.content_hash
      or old.authored_by is distinct from new.authored_by
      or old.published_by is distinct from new.published_by
      or old.published_at is distinct from new.published_at
      or old.created_at is distinct from new.created_at then
      raise exception 'Published form version content and provenance are immutable'
        using errcode = '55000';
    end if;

    if old.status = 'retired' and new.status <> 'retired' then
      raise exception 'Retired form versions cannot be reactivated'
        using errcode = '55000';
    end if;

    if old.status = 'published' and new.status not in ('published', 'retired') then
      raise exception 'Published form versions may only be retired'
        using errcode = '55000';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create function nile_private.preserve_form_submission_evidence()
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

create table public.form_definitions (
  id uuid primary key default gen_random_uuid(),
  form_key text not null unique check (form_key ~ '^[a-z][a-z0-9_:-]{2,79}$'),
  title text not null check (char_length(title) between 1 and 200),
  category text not null
    check (category in ('admissions', 'student_support', 'attendance', 'consent', 'branch_operations')),
  owner_user_id uuid not null references public.app_users(id) on delete restrict,
  owner_role_grant_id uuid not null,
  owner_role text not null
    check (owner_role in ('registrar', 'headofdepartment', 'branchadmin', 'superadmin')),
  branch_id uuid references public.branches(id) on delete restrict,
  department_id uuid references public.departments(id) on delete restrict,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (owner_role_grant_id, owner_user_id)
    references public.role_grants(id, user_id) on delete restrict,
  check (
    (owner_role = 'superadmin' and branch_id is null and department_id is null)
    or (owner_role in ('registrar', 'branchadmin') and branch_id is not null and department_id is null)
    or (owner_role = 'headofdepartment' and department_id is not null)
  )
);

create table public.form_versions (
  id uuid primary key default gen_random_uuid(),
  definition_id uuid not null references public.form_definitions(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  status text not null default 'draft'
    check (status in ('draft', 'published', 'retired')),
  revision integer not null default 1 check (revision > 0),
  schema_json jsonb not null,
  logic_json jsonb not null default '[]'::jsonb,
  translations_json jsonb not null,
  content_hash bytea not null check (octet_length(content_hash) = 32),
  authored_by uuid not null references public.app_users(id) on delete restrict,
  published_by uuid references public.app_users(id) on delete restrict,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (definition_id, version_number),
  unique (id, definition_id),
  check (jsonb_typeof(schema_json) = 'object'),
  check (jsonb_typeof(logic_json) = 'array'),
  check (jsonb_typeof(translations_json) = 'object'),
  check (not nile_private.jsonb_has_forbidden_keys(schema_json)),
  check (not nile_private.jsonb_has_forbidden_keys(logic_json)),
  check (not nile_private.jsonb_has_forbidden_keys(translations_json)),
  check (
    (status = 'draft' and published_by is null and published_at is null)
    or (status in ('published', 'retired') and published_by is not null and published_at is not null)
  )
);

alter table public.form_definitions
  add column current_draft_version_id uuid,
  add column current_published_version_id uuid,
  add foreign key (current_draft_version_id, id)
    references public.form_versions(id, definition_id) on delete restrict,
  add foreign key (current_published_version_id, id)
    references public.form_versions(id, definition_id) on delete restrict;

create unique index form_definitions_one_draft_version_uidx
  on public.form_definitions (current_draft_version_id)
  where current_draft_version_id is not null;
create unique index form_definitions_one_published_version_uidx
  on public.form_definitions (current_published_version_id)
  where current_published_version_id is not null;

create table public.form_publications (
  id uuid primary key default gen_random_uuid(),
  definition_id uuid not null,
  version_id uuid not null,
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{2,79}$'),
  audience text not null check (audience in ('public', 'authenticated', 'assigned')),
  status text not null default 'scheduled'
    check (status in ('scheduled', 'open', 'closed', 'retired')),
  opens_at timestamptz,
  closes_at timestamptz,
  allow_multiple boolean not null default false,
  allow_drafts boolean not null default true,
  offline_eligible boolean not null default false,
  created_by uuid not null references public.app_users(id) on delete restrict,
  command_id uuid references public.command_executions(id) on delete restrict,
  created_at timestamptz not null default now(),
  retired_at timestamptz,
  foreign key (version_id, definition_id)
    references public.form_versions(id, definition_id) on delete restrict,
  unique (id, definition_id, version_id),
  check (closes_at is null or opens_at is null or closes_at > opens_at),
  check (status <> 'retired' or retired_at is not null),
  check (audience = 'assigned' or offline_eligible = false)
);

create unique index form_publications_slug_uidx
  on public.form_publications (lower(slug));

create table public.form_assignments (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.form_publications(id) on delete restrict,
  target_type text not null
    check (target_type in ('user', 'role', 'branch', 'department', 'course', 'class')),
  target_user_id uuid references public.app_users(id) on delete restrict,
  target_role text
    check (target_role in ('student', 'teacher', 'registrar', 'headofdepartment', 'branchadmin', 'superadmin')),
  target_branch_id uuid references public.branches(id) on delete restrict,
  target_department_id uuid references public.departments(id) on delete restrict,
  target_key text,
  assigned_by uuid not null references public.app_users(id) on delete restrict,
  command_id uuid references public.command_executions(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  check (expires_at is null or expires_at > assigned_at),
  check (revoked_at is null or revoked_at >= assigned_at),
  check (
    (target_type = 'user' and target_user_id is not null and num_nonnulls(target_role, target_branch_id, target_department_id, target_key) = 0)
    or (target_type = 'role' and target_role is not null and num_nonnulls(target_user_id, target_branch_id, target_department_id, target_key) = 0)
    or (target_type = 'branch' and target_branch_id is not null and num_nonnulls(target_user_id, target_role, target_department_id, target_key) = 0)
    or (target_type = 'department' and target_department_id is not null and num_nonnulls(target_user_id, target_role, target_branch_id, target_key) = 0)
    or (target_type in ('course', 'class') and target_key is not null and num_nonnulls(target_user_id, target_role, target_branch_id, target_department_id) = 0)
  ),
  unique (id, publication_id)
);

create unique index form_assignments_active_target_uidx
  on public.form_assignments (
    publication_id,
    target_type,
    coalesce(target_user_id::text, target_role, target_branch_id::text, target_department_id::text, target_key)
  )
  where revoked_at is null;

create table public.form_drafts (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null,
  definition_id uuid not null,
  version_id uuid not null,
  assignment_id uuid,
  respondent_user_id uuid references public.app_users(id) on delete restrict,
  guest_token_hash bytea check (guest_token_hash is null or octet_length(guest_token_hash) = 32),
  encrypted_payload bytea not null,
  payload_nonce bytea not null check (octet_length(payload_nonce) = 12),
  payload_key_version integer not null check (payload_key_version > 0),
  revision integer not null default 1 check (revision > 0),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (publication_id, definition_id, version_id)
    references public.form_publications(id, definition_id, version_id) on delete restrict,
  foreign key (assignment_id, publication_id)
    references public.form_assignments(id, publication_id) on delete restrict,
  check (num_nonnulls(respondent_user_id, guest_token_hash) = 1),
  check (expires_at > created_at)
);

create unique index form_drafts_respondent_uidx
  on public.form_drafts (publication_id, version_id, respondent_user_id)
  where respondent_user_id is not null;
create unique index form_drafts_guest_uidx
  on public.form_drafts (publication_id, version_id, guest_token_hash)
  where guest_token_hash is not null;

create table public.form_submissions (
  id uuid primary key default gen_random_uuid(),
  definition_id uuid not null references public.form_definitions(id) on delete restrict,
  publication_id uuid not null,
  version_id uuid not null,
  assignment_id uuid,
  respondent_user_id uuid references public.app_users(id) on delete restrict,
  respondent_role text
    check (respondent_role in ('student', 'teacher', 'registrar', 'headofdepartment', 'branchadmin', 'superadmin')),
  branch_id uuid references public.branches(id) on delete restrict,
  department_id uuid references public.departments(id) on delete restrict,
  source text not null check (source in ('web', 'offline', 'legacy_import')),
  answer_json jsonb not null,
  status text not null default 'submitted'
    check (status in ('submitted', 'under_review', 'accepted', 'rejected', 'promoted', 'withdrawn', 'quarantined')),
  revision integer not null default 1 check (revision > 0),
  client_submission_id text,
  client_submitted_at timestamptz,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  command_id uuid references public.command_executions(id) on delete restrict,
  legacy_source_form_id text,
  legacy_source_submission_id text,
  legacy_payload_hash bytea check (legacy_payload_hash is null or octet_length(legacy_payload_hash) = 32),
  legacy_import_run_id uuid references public.migration_runs(id) on delete restrict,
  reconciliation_status text
    check (reconciliation_status in ('pending', 'matched', 'exception')),
  foreign key (publication_id, definition_id, version_id)
    references public.form_publications(id, definition_id, version_id) on delete restrict,
  foreign key (assignment_id, publication_id)
    references public.form_assignments(id, publication_id) on delete restrict,
  check (jsonb_typeof(answer_json) = 'object'),
  check (not nile_private.jsonb_has_forbidden_keys(answer_json)),
  check (respondent_user_id is not null or respondent_role is null),
  check (
    source <> 'legacy_import'
    or num_nonnulls(legacy_source_form_id, legacy_source_submission_id, legacy_payload_hash, legacy_import_run_id, reconciliation_status) = 5
  ),
  check (
    source = 'legacy_import'
    or num_nonnulls(legacy_source_form_id, legacy_source_submission_id, legacy_payload_hash, legacy_import_run_id, reconciliation_status) = 0
  )
);

create unique index form_submissions_client_id_uidx
  on public.form_submissions (publication_id, client_submission_id)
  where client_submission_id is not null;
create unique index form_submissions_legacy_source_uidx
  on public.form_submissions (legacy_source_form_id, legacy_source_submission_id)
  where source = 'legacy_import';
create index form_submissions_inbox_idx
  on public.form_submissions (status, branch_id, department_id, submitted_at desc);

create table public.form_submission_index_values (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.form_submissions(id) on delete restrict,
  field_id text not null,
  value_type text not null check (value_type in ('text', 'number', 'date', 'timestamp', 'boolean')),
  text_value text,
  number_value numeric,
  date_value date,
  timestamp_value timestamptz,
  boolean_value boolean,
  created_at timestamptz not null default now(),
  unique (submission_id, field_id),
  check (num_nonnulls(text_value, number_value, date_value, timestamp_value, boolean_value) = 1),
  check (
    (value_type = 'text' and text_value is not null)
    or (value_type = 'number' and number_value is not null)
    or (value_type = 'date' and date_value is not null)
    or (value_type = 'timestamp' and timestamp_value is not null)
    or (value_type = 'boolean' and boolean_value is not null)
  )
);

create index form_submission_index_text_idx
  on public.form_submission_index_values (field_id, text_value)
  where text_value is not null;
create index form_submission_index_number_idx
  on public.form_submission_index_values (field_id, number_value)
  where number_value is not null;

create table public.form_reviews (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.form_submissions(id) on delete restrict,
  reviewer_user_id uuid not null references public.app_users(id) on delete restrict,
  reviewer_role_grant_id uuid not null,
  decision text not null check (decision in ('under_review', 'accepted', 'rejected')),
  comments text check (comments is null or char_length(comments) <= 4000),
  expected_submission_revision integer not null check (expected_submission_revision > 0),
  command_id uuid references public.command_executions(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (reviewer_role_grant_id, reviewer_user_id)
    references public.role_grants(id, user_id) on delete restrict
);

create index form_reviews_submission_idx
  on public.form_reviews (submission_id, created_at desc);

create table public.form_promotions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.form_submissions(id) on delete restrict,
  adapter text not null
    check (adapter in ('lead.create', 'application.create', 'placement.create', 'support_ticket.create', 'attendance_exception.create')),
  command_id uuid not null references public.command_executions(id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending', 'succeeded', 'failed')),
  resulting_entity_type text,
  resulting_entity_id text,
  error_detail text,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check ((status = 'pending') = (completed_at is null)),
  check ((status = 'succeeded') = (resulting_entity_type is not null and resulting_entity_id is not null)),
  check ((status = 'failed') = (error_detail is not null))
);

create unique index form_promotions_submission_adapter_uidx
  on public.form_promotions (submission_id, adapter);

create table public.form_offline_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete restrict,
  role_grant_id uuid not null,
  label text not null check (char_length(label) between 1 and 120),
  device_token_hash bytea not null unique check (octet_length(device_token_hash) = 32),
  public_key text not null,
  enrolled_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by uuid references public.app_users(id) on delete restrict,
  foreign key (role_grant_id, user_id)
    references public.role_grants(id, user_id) on delete restrict,
  check (expires_at > enrolled_at and expires_at <= enrolled_at + interval '90 days'),
  check (revoked_by is null or revoked_at is not null)
);

create table public.form_sync_receipts (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.form_offline_devices(id) on delete restrict,
  client_submission_id text not null,
  submission_id uuid references public.form_submissions(id) on delete restrict,
  status text not null check (status in ('accepted', 'duplicate', 'quarantined', 'rejected')),
  reason text,
  payload_hash bytea not null check (octet_length(payload_hash) = 32),
  received_at timestamptz not null default now(),
  unique (device_id, client_submission_id),
  check ((status = 'rejected') = (submission_id is null)),
  check (status not in ('quarantined', 'rejected') or reason is not null)
);

-- Reserved metadata only. No storage locator, upload API, or file bytes are
-- authorized by this phase.
create table public.form_attachments (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.form_submissions(id) on delete restrict,
  field_id text not null,
  status text not null default 'reserved' check (status = 'reserved'),
  created_at timestamptz not null default now(),
  unique (submission_id, field_id)
);

insert into public.permissions (code, category, description, sensitive)
values
  ('forms.read', 'forms', 'Read assigned or scoped form definitions', false),
  ('forms.write', 'forms', 'Create and edit scoped draft form versions', true),
  ('forms.publish', 'forms', 'Publish or retire scoped form versions', true),
  ('forms.assign', 'forms', 'Assign scoped form publications', true),
  ('forms.respond', 'forms', 'Respond to available form publications', false),
  ('form_submissions.read', 'forms', 'Read scoped form submissions', true),
  ('form_submissions.review', 'forms', 'Review and promote scoped form submissions', true),
  ('form_submissions.export', 'forms', 'Export scoped form submissions', true)
on conflict (code) do nothing;

insert into public.role_permissions (role, permission_code, granted)
values
  ('student', 'forms.read', true),
  ('student', 'forms.respond', true),
  ('teacher', 'forms.read', true),
  ('teacher', 'forms.respond', true),
  ('registrar', 'forms.read', true),
  ('registrar', 'forms.write', true),
  ('registrar', 'forms.publish', true),
  ('registrar', 'forms.assign', true),
  ('registrar', 'forms.respond', true),
  ('registrar', 'form_submissions.read', true),
  ('registrar', 'form_submissions.review', true),
  ('registrar', 'form_submissions.export', true),
  ('headofdepartment', 'forms.read', true),
  ('headofdepartment', 'forms.write', true),
  ('headofdepartment', 'forms.publish', true),
  ('headofdepartment', 'forms.assign', true),
  ('headofdepartment', 'forms.respond', true),
  ('headofdepartment', 'form_submissions.read', true),
  ('headofdepartment', 'form_submissions.review', true),
  ('headofdepartment', 'form_submissions.export', true),
  ('branchadmin', 'forms.read', true),
  ('branchadmin', 'forms.write', true),
  ('branchadmin', 'forms.publish', true),
  ('branchadmin', 'forms.assign', true),
  ('branchadmin', 'forms.respond', true),
  ('branchadmin', 'form_submissions.read', true),
  ('branchadmin', 'form_submissions.review', true),
  ('branchadmin', 'form_submissions.export', true),
  ('superadmin', 'forms.read', true),
  ('superadmin', 'forms.write', true),
  ('superadmin', 'forms.publish', true),
  ('superadmin', 'forms.assign', true),
  ('superadmin', 'forms.respond', true),
  ('superadmin', 'form_submissions.read', true),
  ('superadmin', 'form_submissions.review', true),
  ('superadmin', 'form_submissions.export', true)
on conflict (role, permission_code) do update
set granted = excluded.granted, updated_at = now();

create trigger form_definitions_set_updated_at
before update on public.form_definitions
for each row execute function nile_private.set_updated_at();
create trigger form_versions_set_updated_at
before update on public.form_versions
for each row execute function nile_private.set_updated_at();
create trigger form_versions_preserve_published
before update or delete on public.form_versions
for each row execute function nile_private.preserve_published_form_version();
create trigger form_drafts_set_updated_at
before update on public.form_drafts
for each row execute function nile_private.set_updated_at();
create trigger form_submissions_set_updated_at
before update on public.form_submissions
for each row execute function nile_private.set_updated_at();
create trigger form_submissions_preserve_evidence
before update or delete on public.form_submissions
for each row execute function nile_private.preserve_form_submission_evidence();
create trigger form_reviews_immutable
before update or delete on public.form_reviews
for each row execute function nile_private.reject_immutable_change();
create trigger form_sync_receipts_immutable
before update or delete on public.form_sync_receipts
for each row execute function nile_private.reject_immutable_change();

alter table public.form_definitions enable row level security;
alter table public.form_definitions force row level security;
alter table public.form_versions enable row level security;
alter table public.form_versions force row level security;
alter table public.form_publications enable row level security;
alter table public.form_publications force row level security;
alter table public.form_assignments enable row level security;
alter table public.form_assignments force row level security;
alter table public.form_drafts enable row level security;
alter table public.form_drafts force row level security;
alter table public.form_submissions enable row level security;
alter table public.form_submissions force row level security;
alter table public.form_submission_index_values enable row level security;
alter table public.form_submission_index_values force row level security;
alter table public.form_reviews enable row level security;
alter table public.form_reviews force row level security;
alter table public.form_promotions enable row level security;
alter table public.form_promotions force row level security;
alter table public.form_offline_devices enable row level security;
alter table public.form_offline_devices force row level security;
alter table public.form_sync_receipts enable row level security;
alter table public.form_sync_receipts force row level security;
alter table public.form_attachments enable row level security;
alter table public.form_attachments force row level security;

revoke all on table
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
  public.form_attachments
from public, anon, authenticated;

grant select, insert, update, delete on table
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
  public.form_attachments
to service_role;

revoke all on function nile_private.preserve_published_form_version()
from public, anon, authenticated;
revoke all on function nile_private.preserve_form_submission_evidence()
from public, anon, authenticated;
grant execute on function nile_private.preserve_published_form_version()
to service_role;
grant execute on function nile_private.preserve_form_submission_evidence()
to service_role;

-- Browser policies are deliberately absent. Scoped DTOs are served only after
-- the application server resolves one opaque session and its active role grant.

commit;

-- ============================================================================
-- 07. Nile Forms finite legacy import evidence
-- Source: supabase/migrations/20260711193000_nile_forms_legacy_import.sql
-- SHA-256: f175cb532af5b04ab4ee36992533072f6c664be46faf91c68be133ae3e4763a6
-- ============================================================================

-- Nile Learn Phase 13E finite legacy form migration evidence.
--
-- Status: additive local-only migration. This stores import and reconciliation
-- evidence only. No provider credential, polling job, webhook, or live sync is
-- authorized by this phase.

begin;

create function nile_private.preserve_form_legacy_import_run()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Legacy form import runs are durable evidence'
      using errcode = '55000';
  end if;

  if old.id is distinct from new.id
    or old.provider is distinct from new.provider
    or old.source_form_id is distinct from new.source_form_id
    or old.source_form_title is distinct from new.source_form_title
    or old.target_publication_id is distinct from new.target_publication_id
    or old.target_version_id is distinct from new.target_version_id
    or old.mapping_json is distinct from new.mapping_json
    or old.source_offset is distinct from new.source_offset
    or old.source_limit is distinct from new.source_limit
    or old.preview_hash is distinct from new.preview_hash
    or old.total_rows is distinct from new.total_rows
    or old.valid_rows is distinct from new.valid_rows
    or old.created_by is distinct from new.created_by
    or old.created_at is distinct from new.created_at then
    raise exception 'Legacy form import run provenance is immutable'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create function nile_private.preserve_form_legacy_import_record()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Legacy form import records are durable evidence'
      using errcode = '55000';
  end if;

  if old.id is distinct from new.id
    or old.run_id is distinct from new.run_id
    or old.provider is distinct from new.provider
    or old.source_form_id is distinct from new.source_form_id
    or old.source_submission_id is distinct from new.source_submission_id
    or old.payload_hash is distinct from new.payload_hash
    or old.submission_id is distinct from new.submission_id
    or old.errors_json is distinct from new.errors_json
    or old.created_at is distinct from new.created_at then
    raise exception 'Legacy form import record provenance is immutable'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create table public.form_legacy_import_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider = 'jotform'),
  source_form_id text not null check (char_length(source_form_id) between 3 and 40),
  source_form_title text not null check (char_length(source_form_title) between 1 and 240),
  target_publication_id uuid not null references public.form_publications(id) on delete restrict,
  target_version_id uuid not null references public.form_versions(id) on delete restrict,
  mapping_json jsonb not null check (jsonb_typeof(mapping_json) = 'array'),
  source_offset integer not null default 0 check (source_offset >= 0),
  source_limit integer not null check (source_limit between 1 and 1000),
  preview_hash bytea not null check (octet_length(preview_hash) = 32),
  status text not null check (status in ('previewed', 'imported', 'reconciled', 'failed')),
  total_rows integer not null check (total_rows >= 0),
  valid_rows integer not null check (valid_rows between 0 and total_rows),
  imported_rows integer not null default 0 check (imported_rows >= 0),
  duplicate_rows integer not null default 0 check (duplicate_rows >= 0),
  exception_rows integer not null default 0 check (exception_rows >= 0),
  created_by uuid not null references public.app_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check (not nile_private.jsonb_has_forbidden_keys(mapping_json)),
  check ((status = 'previewed') = (completed_at is null))
);

create index form_legacy_import_runs_source_idx
  on public.form_legacy_import_runs (provider, source_form_id, created_at desc);

alter table public.form_submissions
  drop constraint form_submissions_legacy_import_run_id_fkey,
  add constraint form_submissions_legacy_import_run_id_fkey
    foreign key (legacy_import_run_id)
    references public.form_legacy_import_runs(id) on delete restrict;

create table public.form_legacy_import_records (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.form_legacy_import_runs(id) on delete restrict,
  provider text not null check (provider = 'jotform'),
  source_form_id text not null check (char_length(source_form_id) between 3 and 40),
  source_submission_id text not null check (char_length(source_submission_id) between 1 and 128),
  payload_hash bytea not null check (octet_length(payload_hash) = 32),
  submission_id uuid references public.form_submissions(id) on delete restrict,
  reconciliation_status text not null
    check (reconciliation_status in ('pending', 'matched', 'exception')),
  errors_json jsonb not null default '[]'::jsonb check (jsonb_typeof(errors_json) = 'array'),
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  reconciled_by uuid references public.app_users(id) on delete restrict,
  reconciled_at timestamptz,
  check (not nile_private.jsonb_has_forbidden_keys(errors_json)),
  check (reconciliation_status <> 'pending' or reconciled_at is null),
  check (reconciliation_status <> 'matched' or reconciled_at is not null),
  check (reconciled_by is null or reconciled_at is not null),
  check ((submission_id is null) = (reconciliation_status = 'exception' and jsonb_array_length(errors_json) > 0))
);

create unique index form_legacy_import_records_imported_source_uidx
  on public.form_legacy_import_records (provider, source_form_id, source_submission_id)
  where submission_id is not null;

create index form_legacy_import_records_run_idx
  on public.form_legacy_import_records (run_id, reconciliation_status, created_at);

create trigger form_legacy_import_runs_preserve_evidence
before update or delete on public.form_legacy_import_runs
for each row execute function nile_private.preserve_form_legacy_import_run();

create trigger form_legacy_import_records_preserve_evidence
before update or delete on public.form_legacy_import_records
for each row execute function nile_private.preserve_form_legacy_import_record();

alter table public.form_legacy_import_runs enable row level security;
alter table public.form_legacy_import_runs force row level security;
alter table public.form_legacy_import_records enable row level security;
alter table public.form_legacy_import_records force row level security;

revoke all on table
  public.form_legacy_import_runs,
  public.form_legacy_import_records
from public, anon, authenticated;

grant select, insert, update, delete on table
  public.form_legacy_import_runs,
  public.form_legacy_import_records
to service_role;

revoke all on function nile_private.preserve_form_legacy_import_run()
from public, anon, authenticated;
revoke all on function nile_private.preserve_form_legacy_import_record()
from public, anon, authenticated;
grant execute on function nile_private.preserve_form_legacy_import_run()
to service_role;
grant execute on function nile_private.preserve_form_legacy_import_record()
to service_role;

commit;

-- ============================================================================
-- 08. Core installation verification
-- Source: supabase/manual/200_install_verification.sql
-- SHA-256: 49addf4c2b01b0bb78a41e524eaecf76e38da9588e856c4e83a7a7ba4e327b5c
-- ============================================================================

-- Nile Learn manual installation verification.
--
-- Run after 001 and 002. This script is read-only: it creates no application
-- rows and raises an exception when the identity/session foundation is unsafe
-- or incomplete.

begin read only;

do $$
declare
  required_tables text[] := array[
    'branches',
    'app_users',
    'departments',
    'department_branches',
    'permissions',
    'role_permissions',
    'role_grants',
    'role_grant_branch_scopes',
    'role_grant_department_scopes',
    'staff_profiles',
    'staff_subjects',
    'auth_sessions',
    'command_executions',
    'audit_logs',
    'outbox_events',
    'integration_connections',
    'integration_env_requirements',
    'external_records',
    'sync_cursors',
    'sync_runs',
    'sync_run_items',
    'reconciliation_cases',
    'migration_runs',
    'migration_run_items',
    'migration_evidence'
  ];
  missing_tables text[];
  unsafe_rls text[];
  browser_policy_tables text[];
begin
  select array_agg(table_name order by table_name)
  into missing_tables
  from unnest(required_tables) as table_name
  where to_regclass('public.' || table_name) is null;

  if missing_tables is not null then
    raise exception 'Missing Nile Learn tables: %', missing_tables;
  end if;

  select array_agg(class.relname order by class.relname)
  into unsafe_rls
  from pg_catalog.pg_class as class
  join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
  where namespace.nspname = 'public'
    and class.relname = any (required_tables)
    and (not class.relrowsecurity or not class.relforcerowsecurity);

  if unsafe_rls is not null then
    raise exception 'RLS must be enabled and forced on: %', unsafe_rls;
  end if;

  select array_agg(policy.tablename order by policy.tablename)
  into browser_policy_tables
  from pg_catalog.pg_policies as policy
  where policy.schemaname = 'public'
    and policy.tablename = any (required_tables);

  if browser_policy_tables is not null then
    raise exception 'Server-only tables unexpectedly expose browser policies: %', browser_policy_tables;
  end if;

  if to_regprocedure(
    'public.create_auth_session_with_evidence(text,uuid,uuid,uuid,integer,text,text)'
  ) is null then
    raise exception 'create_auth_session_with_evidence RPC is missing';
  end if;

  if to_regprocedure(
    'public.revoke_auth_session_with_evidence(text,text,text)'
  ) is null then
    raise exception 'revoke_auth_session_with_evidence RPC is missing';
  end if;

  if has_function_privilege(
    'anon',
    'public.create_auth_session_with_evidence(text,uuid,uuid,uuid,integer,text,text)',
    'execute'
  ) or has_function_privilege(
    'authenticated',
    'public.create_auth_session_with_evidence(text,uuid,uuid,uuid,integer,text,text)',
    'execute'
  ) then
    raise exception 'Browser roles can execute the session creation RPC';
  end if;

  if has_function_privilege(
    'anon',
    'public.revoke_auth_session_with_evidence(text,text,text)',
    'execute'
  ) or has_function_privilege(
    'authenticated',
    'public.revoke_auth_session_with_evidence(text,text,text)',
    'execute'
  ) then
    raise exception 'Browser roles can execute the session revocation RPC';
  end if;
end;
$$;

select
  'Nile Learn identity/session foundation verified' as result,
  current_database() as database_name,
  current_timestamp as verified_at,
  (select count(*) from pg_catalog.pg_tables
   where schemaname = 'public'
     and tablename = any (array[
       'branches', 'app_users', 'departments', 'department_branches',
       'permissions', 'role_permissions', 'role_grants',
       'role_grant_branch_scopes', 'role_grant_department_scopes',
       'staff_profiles', 'staff_subjects', 'auth_sessions',
       'command_executions', 'audit_logs', 'outbox_events',
       'integration_connections', 'integration_env_requirements',
       'external_records', 'sync_cursors', 'sync_runs', 'sync_run_items',
       'reconciliation_cases', 'migration_runs', 'migration_run_items',
       'migration_evidence'
     ])) as verified_table_count;

commit;

-- ============================================================================
-- 09. Phase 6I Supabase pgcrypto compatibility
-- Source: supabase/manual/015_phase6i_pgcrypto_schema_compatibility.sql
-- SHA-256: 15f436aff4c236bb665fb5dc0bdfdd12505c62778f930369259c2dc0b226d0af
-- ============================================================================

-- Nile Learn Phase 6I pgcrypto schema compatibility package.
--
-- Supabase installs pgcrypto in the extensions schema while portable PostgreSQL
-- environments may install it in public. The accepted Phase 6 SQL calls the
-- public digest overloads explicitly. Create narrow service-only forwarding
-- wrappers only when those public overloads are absent.

begin;

do $phase6i$
begin
  if pg_catalog.to_regprocedure('public.digest(bytea,text)') is null then
    if pg_catalog.to_regprocedure('extensions.digest(bytea,text)') is null then
      raise exception 'Phase 6I requires pgcrypto digest(bytea,text)';
    end if;

    execute $sql$
      create function public.digest(data bytea, algorithm text)
      returns bytea
      language sql
      immutable
      strict
      parallel safe
      security invoker
      set search_path = ''
      as 'select extensions.digest(data, algorithm)'
    $sql$;
    comment on function public.digest(bytea, text)
      is 'nile-phase6i-pgcrypto-compatibility';
  end if;

  if pg_catalog.to_regprocedure('public.digest(text,text)') is null then
    if pg_catalog.to_regprocedure('extensions.digest(text,text)') is null then
      raise exception 'Phase 6I requires pgcrypto digest(text,text)';
    end if;

    execute $sql$
      create function public.digest(data text, algorithm text)
      returns bytea
      language sql
      immutable
      strict
      parallel safe
      security invoker
      set search_path = ''
      as 'select extensions.digest(data, algorithm)'
    $sql$;
    comment on function public.digest(text, text)
      is 'nile-phase6i-pgcrypto-compatibility';
  end if;
end;
$phase6i$;

revoke all on function public.digest(bytea, text)
from public, anon, authenticated;
revoke all on function public.digest(text, text)
from public, anon, authenticated;

grant execute on function public.digest(bytea, text) to service_role;
grant execute on function public.digest(text, text) to service_role;

commit;

-- ============================================================================
-- 10. Phase 6A Moodle projection authority
-- Source: supabase/manual/006_phase6a_moodle_projection_authority.sql
-- SHA-256: fdfbd3f0ece34e7fe6a3a5576fb58a3fd2e80548f43374129b7166a6279329f9
-- ============================================================================

-- Nile Learn Phase 6A normalized Moodle projection authority package.
--
-- Status: reviewed, additive, and intentionally unapplied. Run only after the
-- accepted Phase 1 identity/scope/mapping package on a disposable database.
-- Do not add this file to migration history or apply it to any Supabase project
-- without a separately approved promotion slice.

begin;

do $$
declare
  missing_dependencies text[];
begin
  select pg_catalog.array_agg(dependency order by dependency)
  into missing_dependencies
  from pg_catalog.unnest(array[
    'app_users',
    'branches',
    'departments',
    'external_records',
    'integration_connections',
    'role_grant_department_scopes',
    'role_grants',
    'staff_profiles'
  ]) as dependency
  where pg_catalog.to_regclass('public.' || dependency) is null;

  if missing_dependencies is not null then
    raise exception 'Phase 6A requires Phase 1 tables: %', missing_dependencies;
  end if;

  if pg_catalog.to_regprocedure('nile_private.set_updated_at()') is null then
    raise exception 'Phase 6A requires nile_private.set_updated_at()';
  end if;
end;
$$;

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete restrict,
  code text not null,
  title text not null,
  language text not null default 'en',
  status text not null default 'active'
    check (status in ('active', 'paused', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id, code),
  unique (id, department_id)
);

create table public.course_levels (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete restrict,
  code text not null,
  title text not null,
  sort_order integer not null check (sort_order > 0),
  status text not null default 'active'
    check (status in ('active', 'paused', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, code),
  unique (program_id, sort_order),
  unique (id, program_id)
);

create table public.course_templates (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete restrict,
  level_id uuid not null,
  code text not null,
  slug text not null unique,
  title text not null,
  description text,
  status text not null default 'active'
    check (status in ('active', 'paused', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (level_id, program_id)
    references public.course_levels(id, program_id) on delete restrict,
  unique (program_id, code)
);

create table public.student_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.app_users(id) on delete restrict,
  home_branch_id uuid references public.branches(id) on delete restrict,
  status text not null default 'active'
    check (status in ('active', 'paused', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.course_runs (
  id uuid primary key default gen_random_uuid(),
  course_template_id uuid not null references public.course_templates(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  code text not null,
  term text not null,
  starts_on date not null,
  ends_on date not null,
  status text not null default 'planned'
    check (status in ('planned', 'active', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on),
  unique (branch_id, code),
  unique (id, course_template_id)
);

create table public.class_groups (
  id uuid primary key default gen_random_uuid(),
  course_run_id uuid not null references public.course_runs(id) on delete restrict,
  code text not null,
  name text not null,
  capacity integer not null check (capacity > 0),
  status text not null default 'active'
    check (status in ('active', 'paused', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_run_id, code),
  unique (id, course_run_id)
);

create table public.teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  class_group_id uuid not null references public.class_groups(id) on delete restrict,
  teacher_profile_id uuid not null references public.staff_profiles(id) on delete restrict,
  assignment_type text not null default 'primary'
    check (assignment_type in ('primary', 'substitute', 'assistant')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  status text not null default 'active'
    check (status in ('active', 'ended', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at),
  check (status = 'active' or ends_at is not null),
  exclude using gist (
    class_group_id with =,
    teacher_profile_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status = 'active')
);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_profile_id uuid not null references public.student_profiles(id) on delete restrict,
  course_run_id uuid not null references public.course_runs(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'paused', 'completed', 'cancelled')),
  source text not null default 'nile_learn'
    check (source in ('nile_learn', 'legacy_ems')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at),
  check (
    (status in ('pending', 'active', 'paused') and ends_at is null)
    or (status in ('completed', 'cancelled') and ends_at is not null)
  ),
  unique (id, course_run_id),
  exclude using gist (
    student_profile_id with =,
    course_run_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('pending', 'active', 'paused'))
);

create table public.class_memberships (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null,
  course_run_id uuid not null,
  class_group_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  status text not null default 'active'
    check (status in ('active', 'paused', 'ended', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (enrollment_id, course_run_id)
    references public.enrollments(id, course_run_id) on delete restrict,
  foreign key (class_group_id, course_run_id)
    references public.class_groups(id, course_run_id) on delete restrict,
  check (ends_at is null or ends_at > starts_at),
  check (
    (status in ('active', 'paused') and ends_at is null)
    or (status in ('ended', 'cancelled') and ends_at is not null)
  ),
  exclude using gist (
    enrollment_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('active', 'paused'))
);

create index programs_department_id_idx on public.programs (department_id);
create index course_levels_program_id_idx on public.course_levels (program_id);
create index course_templates_program_id_idx on public.course_templates (program_id);
create index course_templates_level_id_idx on public.course_templates (level_id);
create index student_profiles_home_branch_id_idx on public.student_profiles (home_branch_id);
create index course_runs_course_template_id_idx on public.course_runs (course_template_id);
create index course_runs_branch_id_idx on public.course_runs (branch_id);
create index class_groups_course_run_id_idx on public.class_groups (course_run_id);
create index teacher_assignments_class_group_id_idx on public.teacher_assignments (class_group_id);
create index teacher_assignments_teacher_profile_id_idx on public.teacher_assignments (teacher_profile_id);
create index enrollments_student_profile_id_idx on public.enrollments (student_profile_id);
create index enrollments_course_run_id_idx on public.enrollments (course_run_id);
create index class_memberships_enrollment_id_idx on public.class_memberships (enrollment_id);
create index class_memberships_course_run_id_idx on public.class_memberships (course_run_id);
create index class_memberships_class_group_id_idx on public.class_memberships (class_group_id);

create function public.resolve_moodle_course_projection_authority(
  p_user_id uuid,
  p_active_role_grant_id uuid
)
returns table (
  active_role text,
  authorized_course_ids uuid[],
  observed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  resolved_role text;
  resolved_student_profile_id uuid;
  resolved_staff_profile_id uuid;
begin
  select role_grant.role
  into resolved_role
  from public.app_users as app_user
  join public.role_grants as role_grant
    on role_grant.user_id = app_user.id
  where app_user.id = p_user_id
    and app_user.status = 'active'
    and role_grant.id = p_active_role_grant_id
    and role_grant.status = 'active'
    and role_grant.starts_at <= pg_catalog.now()
    and (role_grant.ends_at is null or role_grant.ends_at > pg_catalog.now());

  if resolved_role is null
    or resolved_role not in ('student', 'teacher', 'headofdepartment', 'superadmin') then
    raise exception 'Moodle course projection authority is not active'
      using errcode = '42501';
  end if;

  if resolved_role = 'student' then
    select profile.id
    into resolved_student_profile_id
    from public.student_profiles as profile
    where profile.user_id = p_user_id
      and profile.status = 'active';

    if resolved_student_profile_id is null then
      raise exception 'Active student profile is required'
        using errcode = '42501';
    end if;

    return query
    select
      resolved_role,
      coalesce(
        pg_catalog.array_agg(authority.internal_course_id order by authority.internal_course_id),
        '{}'::uuid[]
      ),
      pg_catalog.now()
    from (
      select distinct course_run.course_template_id as internal_course_id
      from public.enrollments as enrollment
      join public.course_runs as course_run on course_run.id = enrollment.course_run_id
      join public.course_templates as course_template on course_template.id = course_run.course_template_id
      where enrollment.student_profile_id = resolved_student_profile_id
        and enrollment.status in ('active', 'completed')
        and course_run.status in ('active', 'completed')
        and course_template.status = 'active'
    ) as authority;
    return;
  end if;

  select profile.id
  into resolved_staff_profile_id
  from public.staff_profiles as profile
  where profile.user_id = p_user_id
    and profile.status = 'active';

  if resolved_staff_profile_id is null then
    raise exception 'Active staff profile is required'
      using errcode = '42501';
  end if;

  if resolved_role = 'teacher' then
    return query
    select
      resolved_role,
      coalesce(
        pg_catalog.array_agg(authority.internal_course_id order by authority.internal_course_id),
        '{}'::uuid[]
      ),
      pg_catalog.now()
    from (
      select distinct course_run.course_template_id as internal_course_id
      from public.teacher_assignments as assignment
      join public.class_groups as class_group on class_group.id = assignment.class_group_id
      join public.course_runs as course_run on course_run.id = class_group.course_run_id
      join public.course_templates as course_template on course_template.id = course_run.course_template_id
      where assignment.teacher_profile_id = resolved_staff_profile_id
        and assignment.status = 'active'
        and assignment.starts_at <= pg_catalog.now()
        and (assignment.ends_at is null or assignment.ends_at > pg_catalog.now())
        and class_group.status = 'active'
        and course_run.status = 'active'
        and course_template.status = 'active'
    ) as authority;
    return;
  end if;

  if resolved_role = 'headofdepartment' then
    return query
    select
      resolved_role,
      coalesce(
        pg_catalog.array_agg(authority.internal_course_id order by authority.internal_course_id),
        '{}'::uuid[]
      ),
      pg_catalog.now()
    from (
      select distinct course_template.id as internal_course_id
      from public.role_grant_department_scopes as scope
      join public.programs as program on program.department_id = scope.department_id
      join public.course_templates as course_template on course_template.program_id = program.id
      where scope.role_grant_id = p_active_role_grant_id
        and scope.starts_at <= pg_catalog.now()
        and (scope.ends_at is null or scope.ends_at > pg_catalog.now())
        and program.status = 'active'
        and course_template.status = 'active'
    ) as authority;
    return;
  end if;

  return query
  select
    resolved_role,
    coalesce(
      pg_catalog.array_agg(course_template.id order by course_template.id),
      '{}'::uuid[]
    ),
    pg_catalog.now()
  from public.course_templates as course_template
  where course_template.status = 'active';
end;
$$;

create function public.list_moodle_course_mappings(
  p_internal_course_ids uuid[] default null
)
returns table (
  internal_course_id uuid,
  external_course_id text,
  sync_state text,
  last_seen_at timestamptz,
  last_synced_at timestamptz,
  source_updated_at timestamptz,
  last_error text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    external_record.internal_id,
    external_record.external_id,
    external_record.sync_state,
    external_record.last_seen_at,
    external_record.last_synced_at,
    external_record.source_updated_at,
    external_record.last_error
  from public.integration_connections as connection
  join public.external_records as external_record
    on external_record.connection_id = connection.id
  join public.course_templates as course_template
    on course_template.id = external_record.internal_id
  where connection.provider = 'moodle'
    and external_record.entity_type = 'course'
    and external_record.sync_state <> 'ignored'
    and (
      p_internal_course_ids is null
      or external_record.internal_id = any (p_internal_course_ids)
    )
  order by external_record.internal_id, connection.id;
$$;

revoke all on function public.resolve_moodle_course_projection_authority(uuid, uuid)
from public, anon, authenticated;
revoke all on function public.list_moodle_course_mappings(uuid[])
from public, anon, authenticated;

grant execute on function public.resolve_moodle_course_projection_authority(uuid, uuid)
to service_role;
grant execute on function public.list_moodle_course_mappings(uuid[])
to service_role;

create trigger programs_set_updated_at
before update on public.programs
for each row execute function nile_private.set_updated_at();
create trigger course_levels_set_updated_at
before update on public.course_levels
for each row execute function nile_private.set_updated_at();
create trigger course_templates_set_updated_at
before update on public.course_templates
for each row execute function nile_private.set_updated_at();
create trigger student_profiles_set_updated_at
before update on public.student_profiles
for each row execute function nile_private.set_updated_at();
create trigger course_runs_set_updated_at
before update on public.course_runs
for each row execute function nile_private.set_updated_at();
create trigger class_groups_set_updated_at
before update on public.class_groups
for each row execute function nile_private.set_updated_at();
create trigger teacher_assignments_set_updated_at
before update on public.teacher_assignments
for each row execute function nile_private.set_updated_at();
create trigger enrollments_set_updated_at
before update on public.enrollments
for each row execute function nile_private.set_updated_at();
create trigger class_memberships_set_updated_at
before update on public.class_memberships
for each row execute function nile_private.set_updated_at();

alter table public.programs enable row level security;
alter table public.programs force row level security;
alter table public.course_levels enable row level security;
alter table public.course_levels force row level security;
alter table public.course_templates enable row level security;
alter table public.course_templates force row level security;
alter table public.student_profiles enable row level security;
alter table public.student_profiles force row level security;
alter table public.course_runs enable row level security;
alter table public.course_runs force row level security;
alter table public.class_groups enable row level security;
alter table public.class_groups force row level security;
alter table public.teacher_assignments enable row level security;
alter table public.teacher_assignments force row level security;
alter table public.enrollments enable row level security;
alter table public.enrollments force row level security;
alter table public.class_memberships enable row level security;
alter table public.class_memberships force row level security;

revoke all on table
  public.programs,
  public.course_levels,
  public.course_templates,
  public.student_profiles,
  public.course_runs,
  public.class_groups,
  public.teacher_assignments,
  public.enrollments,
  public.class_memberships
from public, anon, authenticated;

grant select, insert, update, delete on table
  public.programs,
  public.course_levels,
  public.course_templates,
  public.student_profiles,
  public.course_runs,
  public.class_groups,
  public.teacher_assignments,
  public.enrollments,
  public.class_memberships
to service_role;

commit;

-- ============================================================================
-- 11. Phase 6B Moodle projection observations
-- Source: supabase/manual/007_phase6b_moodle_projection_observation.sql
-- SHA-256: 1e8747d6167f0652b8af877737450f05143beff2e0fe650f36f027f0be34b4dd
-- ============================================================================

-- Nile Learn Phase 6B Moodle projection observation package.
--
-- Status: additive, manual, and intentionally unapplied. Run only after the
-- accepted Phase 1 and Phase 6A packages on a disposable database. This file
-- stores sanitized projection snapshots, never raw Moodle responses.

begin;

do $$
declare
  missing_dependencies text[];
begin
  select pg_catalog.array_agg(dependency order by dependency)
  into missing_dependencies
  from pg_catalog.unnest(array[
    'app_users',
    'course_templates',
    'external_records',
    'integration_connections',
    'reconciliation_cases',
    'role_grants',
    'sync_run_items',
    'sync_runs'
  ]) as dependency
  where pg_catalog.to_regclass('public.' || dependency) is null;

  if missing_dependencies is not null then
    raise exception 'Phase 6B requires Phase 1 and Phase 6A tables: %', missing_dependencies;
  end if;

  if pg_catalog.to_regprocedure(
    'public.resolve_moodle_course_projection_authority(uuid,uuid)'
  ) is null then
    raise exception 'Phase 6B requires the Phase 6A authority RPC';
  end if;

  if pg_catalog.to_regprocedure('nile_private.reject_immutable_change()') is null
    or pg_catalog.to_regprocedure('nile_private.jsonb_has_forbidden_keys(jsonb)') is null then
    raise exception 'Phase 6B requires Phase 1 immutable and JSON safety helpers';
  end if;
end;
$$;

create function nile_private.moodle_sanitized_projection_is_safe(
  payload jsonb,
  depth integer default 0
)
returns boolean
language plpgsql
immutable
strict
security invoker
set search_path = ''
as $$
declare
  pair record;
  element jsonb;
begin
  if depth > 8
    or pg_catalog.octet_length(payload::text) > 262144
    or nile_private.jsonb_has_forbidden_keys(payload) then
    return false;
  end if;

  case pg_catalog.jsonb_typeof(payload)
    when 'object' then
      if (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(payload)) > 128 then
        return false;
      end if;

      for pair in
        select entry.key, entry.value
        from pg_catalog.jsonb_each(payload) as entry
      loop
        if pg_catalog.length(pair.key) > 80
          or pg_catalog.lower(pair.key) ~
            '(^|_)(raw|response|error|errors|exception|debuginfo|contact|contacts|email|phone|address|username|password|passwd|secret|api.?key|token|authorization|cookie|credential|private.?key|service.?role)($|_)'
          or not nile_private.moodle_sanitized_projection_is_safe(pair.value, depth + 1) then
          return false;
        end if;
      end loop;
    when 'array' then
      if pg_catalog.jsonb_array_length(payload) > 500 then
        return false;
      end if;

      for element in
        select item.value
        from pg_catalog.jsonb_array_elements(payload) as item
      loop
        if not nile_private.moodle_sanitized_projection_is_safe(element, depth + 1) then
          return false;
        end if;
      end loop;
    when 'string' then
      if pg_catalog.length(payload #>> '{}') > 4096
        or (payload #>> '{}') ~* '(bearer[[:space:]]+|wstoken|moodlewsrestformat|password=|token=|authorization:)' then
        return false;
      end if;
    else
      return true;
  end case;

  return true;
end;
$$;

create table public.moodle_projection_observations (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  request_hash bytea not null check (octet_length(request_hash) = 32),
  connection_id uuid not null references public.integration_connections(id) on delete restrict,
  internal_course_id uuid not null references public.course_templates(id) on delete restrict,
  external_record_id uuid references public.external_records(id) on delete restrict,
  sync_run_id uuid not null references public.sync_runs(id) on delete restrict,
  sync_run_item_id uuid not null references public.sync_run_items(id) on delete restrict,
  reconciliation_case_id uuid references public.reconciliation_cases(id) on delete restrict,
  projection_family text not null
    check (projection_family in ('course_catalog', 'course_content')),
  outcome text not null check (outcome in ('available', 'empty', 'unavailable', 'reconciliation')),
  reconciliation_reason text check (
    reconciliation_reason in (
      'missing_mapping',
      'missing_provider_record',
      'ambiguous_mapping'
    )
  ),
  sanitized_payload jsonb,
  projection_hash bytea check (projection_hash is null or octet_length(projection_hash) = 32),
  observed_at timestamptz not null,
  fresh_until timestamptz,
  retain_until timestamptz,
  created_at timestamptz not null default now(),
  check (idempotency_key ~ '^[a-z0-9][a-z0-9._:-]{7,127}$'),
  check (
    sanitized_payload is null
    or (
      pg_catalog.jsonb_typeof(sanitized_payload) in ('object', 'array')
      and nile_private.moodle_sanitized_projection_is_safe(sanitized_payload)
    )
  ),
  check (
    (
      outcome in ('available', 'empty')
      and external_record_id is not null
      and sanitized_payload is not null
      and projection_hash is not null
      and fresh_until is not null
      and fresh_until > observed_at
      and retain_until is not null
      and retain_until > fresh_until
      and retain_until <= observed_at + interval '30 days'
      and reconciliation_case_id is null
      and reconciliation_reason is null
    )
    or (
      outcome = 'unavailable'
      and sanitized_payload is null
      and projection_hash is null
      and fresh_until is null
      and retain_until is null
      and reconciliation_case_id is null
      and reconciliation_reason is null
    )
    or (
      outcome = 'reconciliation'
      and sanitized_payload is null
      and projection_hash is null
      and fresh_until is null
      and retain_until is null
      and reconciliation_case_id is not null
      and reconciliation_reason is not null
    )
  )
);

create index moodle_projection_observations_course_time_idx
  on public.moodle_projection_observations (
    connection_id,
    internal_course_id,
    projection_family,
    observed_at desc,
    id desc
  );

create index moodle_projection_observations_success_idx
  on public.moodle_projection_observations (
    connection_id,
    internal_course_id,
    projection_family,
    observed_at desc,
    id desc
  )
  where outcome in ('available', 'empty');

create index moodle_projection_observations_sync_run_idx
  on public.moodle_projection_observations (sync_run_id, sync_run_item_id);

create index moodle_projection_observations_reconciliation_idx
  on public.moodle_projection_observations (reconciliation_case_id)
  where reconciliation_case_id is not null;

create function public.resolve_moodle_projection_context(
  p_user_id uuid,
  p_active_role_grant_id uuid
)
returns table (
  connection_id uuid,
  active_role text,
  authorized_course_ids uuid[],
  observed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  resolved_connection_id uuid;
  connection_count integer;
begin
  select
    pg_catalog.count(*)::integer,
    (pg_catalog.array_agg(connection.id order by connection.id))[1]
  into connection_count, resolved_connection_id
  from public.integration_connections as connection
  where connection.provider = 'moodle'
    and connection.mode = 'read_only'
    and connection.status = 'ready';

  if connection_count <> 1 then
    raise exception 'Moodle projection requires exactly one ready read-only connection'
      using errcode = '42501';
  end if;

  return query
  select
    resolved_connection_id,
    authority.active_role,
    authority.authorized_course_ids,
    authority.observed_at
  from public.resolve_moodle_course_projection_authority(
    p_user_id,
    p_active_role_grant_id
  ) as authority;
end;
$$;

create function public.list_moodle_course_mappings_for_connection(
  p_connection_id uuid,
  p_internal_course_ids uuid[] default null
)
returns table (
  internal_course_id uuid,
  external_record_id uuid,
  external_course_id text,
  sync_state text,
  last_seen_at timestamptz,
  last_synced_at timestamptz,
  source_updated_at timestamptz,
  last_error text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.integration_connections as connection
    where connection.id = p_connection_id
      and connection.provider = 'moodle'
      and connection.mode = 'read_only'
      and connection.status = 'ready'
  ) then
    raise exception 'Moodle projection connection is not ready and read-only'
      using errcode = '42501';
  end if;

  return query
  select
    external_record.internal_id,
    external_record.id,
    external_record.external_id,
    external_record.sync_state,
    external_record.last_seen_at,
    external_record.last_synced_at,
    external_record.source_updated_at,
    external_record.last_error
  from public.external_records as external_record
  join public.course_templates as course_template
    on course_template.id = external_record.internal_id
  where external_record.connection_id = p_connection_id
    and external_record.entity_type = 'course'
    and external_record.sync_state <> 'ignored'
    and (
      p_internal_course_ids is null
      or external_record.internal_id = any (p_internal_course_ids)
    )
  order by external_record.internal_id;
end;
$$;

create function public.record_moodle_projection_observation(
  p_idempotency_key text,
  p_connection_id uuid,
  p_internal_course_id uuid,
  p_external_record_id uuid,
  p_sync_run_id uuid,
  p_sync_run_item_id uuid,
  p_projection_family text,
  p_outcome text,
  p_sanitized_payload jsonb,
  p_projection_hash bytea,
  p_observed_at timestamptz,
  p_fresh_until timestamptz,
  p_retain_until timestamptz,
  p_reconciliation_case_id uuid default null,
  p_reconciliation_reason text default null
)
returns table (
  observation_id uuid,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  calculated_request_hash bytea;
  inserted_id uuid;
  existing_observation record;
  mapped_internal_course_id uuid;
  mapped_connection_id uuid;
  mapped_external_id text;
  run_connection_id uuid;
  run_entity_type text;
  run_direction text;
  run_status text;
  item_sync_run_id uuid;
  item_external_record_id uuid;
  item_external_id text;
  item_status text;
  case_connection_id uuid;
  case_internal_id uuid;
  case_external_id text;
  case_reason text;
  case_status text;
begin
  if p_idempotency_key is null
    or p_idempotency_key !~ '^[a-z0-9][a-z0-9._:-]{7,127}$'
    or p_projection_family not in ('course_catalog', 'course_content')
    or p_outcome not in ('available', 'empty', 'unavailable', 'reconciliation')
    or p_observed_at is null then
    raise exception 'Invalid Moodle observation command metadata'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.integration_connections as connection
    where connection.id = p_connection_id
      and connection.provider = 'moodle'
      and connection.mode = 'read_only'
      and connection.status = 'ready'
  ) then
    raise exception 'Moodle observation connection is not ready and read-only'
      using errcode = '42501';
  end if;

  if p_outcome in ('available', 'empty') then
    if p_sanitized_payload is null
      or pg_catalog.jsonb_typeof(p_sanitized_payload) not in ('object', 'array')
      or not nile_private.moodle_sanitized_projection_is_safe(p_sanitized_payload)
      or p_projection_hash is null
      or pg_catalog.octet_length(p_projection_hash) <> 32
      or p_projection_hash is distinct from public.digest(
        pg_catalog.convert_to(p_sanitized_payload::text, 'UTF8'),
        'sha256'
      )
      or p_fresh_until is null
      or p_fresh_until <= p_observed_at
      or p_retain_until is null
      or p_retain_until <= p_fresh_until
      or p_retain_until > p_observed_at + interval '30 days'
      or p_reconciliation_case_id is not null
      or p_reconciliation_reason is not null then
      raise exception 'Successful observation requires one safe hashed projection and freshness bound'
        using errcode = '22023';
    end if;
  elsif p_sanitized_payload is not null
    or p_projection_hash is not null
    or p_fresh_until is not null
    or p_retain_until is not null then
    raise exception 'Unavailable and reconciliation observations cannot retain a projection'
      using errcode = '22023';
  end if;

  if p_outcome = 'reconciliation' then
    if p_reconciliation_case_id is null
      or p_reconciliation_reason not in (
        'missing_mapping',
        'missing_provider_record',
        'ambiguous_mapping'
      ) then
      raise exception 'Reconciliation observation requires one bounded reason and case'
        using errcode = '22023';
    end if;
  elsif p_reconciliation_case_id is not null or p_reconciliation_reason is not null then
    raise exception 'Only reconciliation observations can reference a case'
      using errcode = '22023';
  end if;

  if p_external_record_id is not null then
    select
      external_record.internal_id,
      external_record.connection_id,
      external_record.external_id
    into strict mapped_internal_course_id, mapped_connection_id, mapped_external_id
    from public.external_records as external_record
    where external_record.id = p_external_record_id
      and external_record.entity_type = 'course'
      and external_record.sync_state <> 'ignored';

    if mapped_connection_id is distinct from p_connection_id
      or mapped_internal_course_id is distinct from p_internal_course_id then
      raise exception 'Observation mapping is outside the exact connection and course context'
        using errcode = '23514';
    end if;
  elsif p_outcome in ('available', 'empty') then
    raise exception 'Successful observation requires an exact Moodle course mapping'
      using errcode = '23514';
  end if;

  select sync_run.connection_id, sync_run.entity_type, sync_run.direction, sync_run.status
  into strict run_connection_id, run_entity_type, run_direction, run_status
  from public.sync_runs as sync_run
  where sync_run.id = p_sync_run_id;

  select
    sync_item.sync_run_id,
    sync_item.external_record_id,
    sync_item.external_id,
    sync_item.status
  into strict item_sync_run_id, item_external_record_id, item_external_id, item_status
  from public.sync_run_items as sync_item
  where sync_item.id = p_sync_run_item_id;

  if run_connection_id is distinct from p_connection_id
    or run_entity_type <> (case p_projection_family
      when 'course_catalog' then 'course'
      when 'course_content' then 'course_content'
    end)
    or run_direction <> 'read'
    or run_status not in ('succeeded', 'partial', 'failed')
    or item_sync_run_id is distinct from p_sync_run_id
    or item_external_record_id is distinct from p_external_record_id
    or (p_external_record_id is not null and item_external_id is distinct from mapped_external_id) then
    raise exception 'Observation run item is outside the exact connection and mapping context'
      using errcode = '23514';
  end if;

  if (p_outcome in ('available', 'empty') and item_status <> 'succeeded')
    or (p_outcome = 'unavailable' and item_status <> 'failed')
    or (p_outcome = 'reconciliation' and item_status <> 'needs_review') then
    raise exception 'Observation outcome does not match the immutable sync item result'
      using errcode = '23514';
  end if;

  if p_outcome = 'reconciliation' then
    select
      reconciliation.connection_id,
      reconciliation.internal_id,
      reconciliation.external_id,
      reconciliation.reason,
      reconciliation.status
    into strict
      case_connection_id,
      case_internal_id,
      case_external_id,
      case_reason,
      case_status
    from public.reconciliation_cases as reconciliation
    where reconciliation.id = p_reconciliation_case_id;

    if case_connection_id is distinct from p_connection_id
      or case_internal_id is distinct from p_internal_course_id
      or case_external_id is distinct from item_external_id
      or case_reason is distinct from p_reconciliation_reason
      or case_status <> 'open' then
      raise exception 'Reconciliation case is outside the observation context'
        using errcode = '23514';
    end if;
  end if;

  calculated_request_hash := public.digest(
    pg_catalog.convert_to(
      pg_catalog.jsonb_build_array(
        p_connection_id::text,
        p_internal_course_id::text,
        p_external_record_id::text,
        p_sync_run_id::text,
        p_sync_run_item_id::text,
        p_projection_family,
        p_outcome,
        p_sanitized_payload,
        pg_catalog.encode(p_projection_hash, 'hex'),
        p_observed_at::text,
        p_fresh_until::text,
        p_retain_until::text,
        p_reconciliation_case_id::text,
        p_reconciliation_reason
      )::text,
      'UTF8'
    ),
    'sha256'
  );

  insert into public.moodle_projection_observations (
    idempotency_key,
    request_hash,
    connection_id,
    internal_course_id,
    external_record_id,
    sync_run_id,
    sync_run_item_id,
    reconciliation_case_id,
    projection_family,
    outcome,
    reconciliation_reason,
    sanitized_payload,
    projection_hash,
    observed_at,
    fresh_until,
    retain_until
  )
  values (
    p_idempotency_key,
    calculated_request_hash,
    p_connection_id,
    p_internal_course_id,
    p_external_record_id,
    p_sync_run_id,
    p_sync_run_item_id,
    p_reconciliation_case_id,
    p_projection_family,
    p_outcome,
    p_reconciliation_reason,
    p_sanitized_payload,
    p_projection_hash,
    p_observed_at,
    p_fresh_until,
    p_retain_until
  )
  on conflict (idempotency_key) do nothing
  returning id into inserted_id;

  if inserted_id is not null then
    return query select inserted_id, false;
    return;
  end if;

  select observation.id, observation.request_hash
  into strict existing_observation
  from public.moodle_projection_observations as observation
  where observation.idempotency_key = p_idempotency_key;

  if existing_observation.request_hash is distinct from calculated_request_hash then
    raise exception 'Moodle observation idempotency conflict'
      using errcode = '23505';
  end if;

  return query select existing_observation.id, true;
end;
$$;

create function public.list_authorized_moodle_projection_freshness(
  p_user_id uuid,
  p_active_role_grant_id uuid,
  p_connection_id uuid,
  p_projection_family text,
  p_as_of timestamptz,
  p_internal_course_ids uuid[] default null
)
returns table (
  connection_id uuid,
  active_role text,
  internal_course_id uuid,
  external_course_id text,
  projection_family text,
  freshness_state text,
  latest_outcome text,
  reconciliation_reason text,
  sanitized_payload jsonb,
  projection_hash bytea,
  successful_sync_run_id uuid,
  successful_observed_at timestamptz,
  fresh_until timestamptz,
  retain_until timestamptz,
  latest_observed_at timestamptz,
  observed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  context record;
begin
  if p_as_of is null
    or p_projection_family not in ('course_catalog', 'course_content') then
    raise exception 'Freshness evaluation requires an explicit timestamp'
      using errcode = '22023';
  end if;

  select *
  into strict context
  from public.resolve_moodle_projection_context(
    p_user_id,
    p_active_role_grant_id
  );

  if context.connection_id is distinct from p_connection_id then
    raise exception 'Moodle projection connection does not match the authorized context'
      using errcode = '42501';
  end if;

  if p_internal_course_ids is not null and exists (
    select 1
    from pg_catalog.unnest(p_internal_course_ids) as requested(internal_course_id)
    where requested.internal_course_id is null
      or not (requested.internal_course_id = any (context.authorized_course_ids))
  ) then
    raise exception 'Moodle projection course filter is outside authorized context'
      using errcode = '42501';
  end if;

  return query
  select
    context.connection_id,
    context.active_role,
    authorized_course.internal_course_id,
    mapping.external_id,
    p_projection_family,
    case
      when retained_success.id is null then 'unavailable'
      when latest_observation.id = retained_success.id
        and p_as_of <= retained_success.fresh_until then 'fresh'
      else 'stale'
    end,
    latest_observation.outcome,
    latest_observation.reconciliation_reason,
    retained_success.sanitized_payload,
    retained_success.projection_hash,
    retained_success.sync_run_id,
    retained_success.observed_at,
    retained_success.fresh_until,
    retained_success.retain_until,
    latest_observation.observed_at,
    context.observed_at
  from pg_catalog.unnest(context.authorized_course_ids) as authorized_course(internal_course_id)
  left join public.external_records as mapping
    on mapping.connection_id = context.connection_id
   and mapping.entity_type = 'course'
   and mapping.internal_id = authorized_course.internal_course_id
   and mapping.sync_state <> 'ignored'
  left join lateral (
    select observation.*
    from public.moodle_projection_observations as observation
    where observation.connection_id = context.connection_id
      and observation.internal_course_id = authorized_course.internal_course_id
      and observation.projection_family = p_projection_family
      and observation.observed_at <= p_as_of
    order by observation.observed_at desc, observation.id desc
    limit 1
  ) as latest_observation on true
  left join lateral (
    select observation.*
    from public.moodle_projection_observations as observation
    where observation.connection_id = context.connection_id
      and observation.internal_course_id = authorized_course.internal_course_id
      and observation.projection_family = p_projection_family
      and observation.external_record_id = mapping.id
      and observation.outcome in ('available', 'empty')
      and observation.observed_at <= p_as_of
      and p_as_of <= observation.retain_until
    order by observation.observed_at desc, observation.id desc
    limit 1
  ) as retained_success on true
  where p_internal_course_ids is null
    or authorized_course.internal_course_id = any (p_internal_course_ids)
  order by authorized_course.internal_course_id;
end;
$$;

create function public.resolve_moodle_projection_reconciliation(
  p_user_id uuid,
  p_active_role_grant_id uuid,
  p_observation_id uuid,
  p_resolution text
)
returns table (
  reconciliation_case_id uuid,
  status text,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  context record;
  observation record;
  existing_case record;
  target_status text;
begin
  if p_resolution not in (
    'mapping_confirmed',
    'provider_record_ignored',
    'source_rechecked',
    'no_match_confirmed'
  ) then
    raise exception 'Unsupported Moodle reconciliation resolution'
      using errcode = '22023';
  end if;

  select *
  into strict context
  from public.resolve_moodle_projection_context(
    p_user_id,
    p_active_role_grant_id
  );

  if context.active_role <> 'superadmin' then
    raise exception 'Moodle reconciliation requires Super Admin authority'
      using errcode = '42501';
  end if;

  select
    projection.connection_id,
    projection.reconciliation_case_id
  into strict observation
  from public.moodle_projection_observations as projection
  where projection.id = p_observation_id
    and projection.outcome = 'reconciliation';

  if observation.connection_id is distinct from context.connection_id then
    raise exception 'Reconciliation observation is outside the authorized connection'
      using errcode = '42501';
  end if;

  target_status := case p_resolution
    when 'mapping_confirmed' then 'matched'
    when 'provider_record_ignored' then 'ignored'
    else 'resolved'
  end;

  select case_row.status, case_row.resolution, case_row.resolved_by
  into strict existing_case
  from public.reconciliation_cases as case_row
  where case_row.id = observation.reconciliation_case_id
  for update;

  if existing_case.status = 'open' then
    update public.reconciliation_cases
    set
      status = target_status,
      resolution = p_resolution,
      resolved_by = p_user_id,
      resolved_at = pg_catalog.now()
    where id = observation.reconciliation_case_id;

    return query
    select observation.reconciliation_case_id, target_status, false;
    return;
  end if;

  if existing_case.status = target_status
    and existing_case.resolution = p_resolution
    and existing_case.resolved_by = p_user_id then
    return query
    select observation.reconciliation_case_id, target_status, true;
    return;
  end if;

  raise exception 'Moodle reconciliation resolution conflict'
    using errcode = '23505';
end;
$$;

create trigger moodle_projection_observations_immutable
before update or delete on public.moodle_projection_observations
for each row execute function nile_private.reject_immutable_change();

alter table public.moodle_projection_observations enable row level security;
alter table public.moodle_projection_observations force row level security;

revoke all on table public.moodle_projection_observations
from public, anon, authenticated, service_role;

revoke all on function nile_private.moodle_sanitized_projection_is_safe(jsonb, integer)
from public, anon, authenticated, service_role;

revoke all on function public.resolve_moodle_projection_context(uuid, uuid)
from public, anon, authenticated;
revoke all on function public.list_moodle_course_mappings_for_connection(uuid, uuid[])
from public, anon, authenticated;
revoke all on function public.record_moodle_projection_observation(text, uuid, uuid, uuid, uuid, uuid, text, text, jsonb, bytea, timestamptz, timestamptz, timestamptz, uuid, text)
from public, anon, authenticated;
revoke all on function public.list_authorized_moodle_projection_freshness(uuid, uuid, uuid, text, timestamptz, uuid[])
from public, anon, authenticated;
revoke all on function public.resolve_moodle_projection_reconciliation(uuid, uuid, uuid, text)
from public, anon, authenticated;

grant execute on function public.resolve_moodle_projection_context(uuid, uuid)
to service_role;
grant execute on function public.list_moodle_course_mappings_for_connection(uuid, uuid[])
to service_role;
grant execute on function public.record_moodle_projection_observation(text, uuid, uuid, uuid, uuid, uuid, text, text, jsonb, bytea, timestamptz, timestamptz, timestamptz, uuid, text)
to service_role;
grant execute on function public.list_authorized_moodle_projection_freshness(uuid, uuid, uuid, text, timestamptz, uuid[])
to service_role;
grant execute on function public.resolve_moodle_projection_reconciliation(uuid, uuid, uuid, text)
to service_role;

commit;

-- ============================================================================
-- 12. Phase 6E Moodle user mapping authority
-- Source: supabase/manual/008_phase6e_moodle_user_mapping_authority.sql
-- SHA-256: 104dbdcf4625522e141d2b7cd925ce536c2b236450e89d67580bf801ee4a3444
-- ============================================================================

-- Nile Learn Phase 6E additive Moodle user-mapping authority.
--
-- This package adds service-only read RPCs over accepted normalized tables.
-- It creates no table and performs no Moodle or normalized workflow writes.

begin;

do $$
declare
  required_relation text;
begin
  foreach required_relation in array array[
    'app_users',
    'role_grants',
    'role_grant_department_scopes',
    'departments',
    'staff_profiles',
    'programs',
    'course_templates',
    'course_runs',
    'class_groups',
    'teacher_assignments',
    'student_profiles',
    'enrollments',
    'class_memberships',
    'integration_connections',
    'external_records'
  ] loop
    if pg_catalog.to_regclass('public.' || required_relation) is null then
      raise exception 'Phase 6E requires public.%', required_relation;
    end if;
  end loop;

  if pg_catalog.to_regprocedure(
    'nile_private.resolve_effective_role_grant(uuid,uuid,timestamp with time zone)'
  ) is null then
    raise exception 'Phase 6E requires nile_private.resolve_effective_role_grant(uuid, uuid, timestamptz)';
  end if;
end;
$$;

create function public.resolve_moodle_user_projection_authority(
  p_user_id uuid,
  p_active_role_grant_id uuid
)
returns table (
  active_role text,
  authorized_user_ids uuid[],
  observed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  authority_at timestamptz := pg_catalog.now();
  authority record;
begin
  if p_user_id is null or p_active_role_grant_id is null then
    raise exception using
      errcode = '42501',
      message = 'A current user and role grant are required';
  end if;

  select effective.active_role, effective.department_ids
  into authority
  from nile_private.resolve_effective_role_grant(
    p_user_id,
    p_active_role_grant_id,
    authority_at
  ) as effective
  join public.app_users as actor
    on actor.id = p_user_id
   and actor.status = 'active';

  if authority.active_role is null then
    raise exception using
      errcode = '42501',
      message = 'The user and role grant do not resolve to current authority';
  end if;

  if authority.active_role not in (
    'student',
    'teacher',
    'headofdepartment',
    'superadmin'
  ) then
    raise exception using
      errcode = '42501',
      message = 'The active role cannot read Moodle user projections';
  end if;

  active_role := authority.active_role;
  observed_at := authority_at;

  if active_role = 'student' then
    authorized_user_ids := array[p_user_id];

  elsif active_role = 'teacher' then
    select coalesce(
      pg_catalog.array_agg(candidate.user_id order by candidate.user_id),
      '{}'::uuid[]
    )
    into authorized_user_ids
    from (
      select p_user_id as user_id
      union
      select learner.id
      from public.staff_profiles as teacher_profile
      join public.teacher_assignments as assignment
        on assignment.teacher_profile_id = teacher_profile.id
       and assignment.status = 'active'
       and assignment.starts_at <= authority_at
       and (assignment.ends_at is null or assignment.ends_at > authority_at)
      join public.class_groups as class_group
        on class_group.id = assignment.class_group_id
       and class_group.status = 'active'
      join public.course_runs as course_run
        on course_run.id = class_group.course_run_id
       and course_run.status = 'active'
       and course_run.starts_on <= authority_at::date
       and course_run.ends_on >= authority_at::date
      join public.class_memberships as membership
        on membership.class_group_id = class_group.id
       and membership.course_run_id = course_run.id
       and membership.status = 'active'
       and membership.starts_at <= authority_at
       and (membership.ends_at is null or membership.ends_at > authority_at)
      join public.enrollments as enrollment
        on enrollment.id = membership.enrollment_id
       and enrollment.course_run_id = course_run.id
       and enrollment.status = 'active'
       and enrollment.starts_at <= authority_at
       and (enrollment.ends_at is null or enrollment.ends_at > authority_at)
      join public.student_profiles as student_profile
        on student_profile.id = enrollment.student_profile_id
       and student_profile.status = 'active'
      join public.app_users as learner
        on learner.id = student_profile.user_id
       and learner.status = 'active'
      where teacher_profile.user_id = p_user_id
        and teacher_profile.status = 'active'
    ) as candidate;

  elsif active_role = 'headofdepartment' then
    select coalesce(
      pg_catalog.array_agg(candidate.user_id order by candidate.user_id),
      '{}'::uuid[]
    )
    into authorized_user_ids
    from (
      select p_user_id as user_id
      union
      select staff_user.id
      from public.role_grants as staff_grant
      join public.role_grant_department_scopes as staff_scope
        on staff_scope.role_grant_id = staff_grant.id
       and staff_scope.department_id = any(authority.department_ids)
       and staff_scope.starts_at <= authority_at
       and (staff_scope.ends_at is null or staff_scope.ends_at > authority_at)
      join public.departments as department
        on department.id = staff_scope.department_id
       and department.status = 'active'
      join public.app_users as staff_user
        on staff_user.id = staff_grant.user_id
       and staff_user.status = 'active'
      join public.staff_profiles as staff_profile
        on staff_profile.user_id = staff_user.id
       and staff_profile.status = 'active'
      where staff_grant.status = 'active'
        and staff_grant.starts_at <= authority_at
        and (staff_grant.ends_at is null or staff_grant.ends_at > authority_at)
      union
      select learner.id
      from public.programs as program
      join public.course_templates as course_template
        on course_template.program_id = program.id
       and course_template.status = 'active'
      join public.course_runs as course_run
        on course_run.course_template_id = course_template.id
       and course_run.status = 'active'
       and course_run.starts_on <= authority_at::date
       and course_run.ends_on >= authority_at::date
      join public.enrollments as enrollment
        on enrollment.course_run_id = course_run.id
       and enrollment.status = 'active'
       and enrollment.starts_at <= authority_at
       and (enrollment.ends_at is null or enrollment.ends_at > authority_at)
      join public.student_profiles as student_profile
        on student_profile.id = enrollment.student_profile_id
       and student_profile.status = 'active'
      join public.app_users as learner
        on learner.id = student_profile.user_id
       and learner.status = 'active'
      where program.department_id = any(authority.department_ids)
        and program.status = 'active'
    ) as candidate;

  else
    select coalesce(
      pg_catalog.array_agg(app_user.id order by app_user.id),
      '{}'::uuid[]
    )
    into authorized_user_ids
    from public.app_users as app_user
    where app_user.status = 'active';
  end if;

  return next;
end;
$$;

create function public.list_moodle_user_mappings_for_connection(
  p_connection_id uuid,
  p_internal_user_ids uuid[]
)
returns table (
  internal_user_id uuid,
  external_record_id uuid,
  external_user_id text,
  sync_state text,
  last_seen_at timestamptz,
  last_synced_at timestamptz,
  source_updated_at timestamptz,
  last_error text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  requested_count integer;
begin
  if p_connection_id is null
    or p_internal_user_ids is null
    or pg_catalog.cardinality(p_internal_user_ids) = 0
    or pg_catalog.array_position(p_internal_user_ids, null) is not null then
    raise exception using
      errcode = '22023',
      message = 'A connection and nonempty user ID array without nulls are required';
  end if;

  select pg_catalog.count(*)::integer
  into requested_count
  from (
    select distinct requested.user_id
    from pg_catalog.unnest(p_internal_user_ids) as requested(user_id)
  ) as unique_requested;

  if requested_count <> pg_catalog.cardinality(p_internal_user_ids) then
    raise exception using
      errcode = '22023',
      message = 'Duplicate internal user IDs are not accepted';
  end if;

  if not exists (
    select 1
    from public.integration_connections as connection
    where connection.id = p_connection_id
      and connection.provider = 'moodle'
      and connection.mode = 'read_only'
      and connection.status = 'ready'
  ) then
    raise exception using
      errcode = '42501',
      message = 'The connection is not an active read-only Moodle authority';
  end if;

  if exists (
    select 1
    from pg_catalog.unnest(p_internal_user_ids) as requested(user_id)
    left join public.app_users as app_user
      on app_user.id = requested.user_id
     and app_user.status = 'active'
    where app_user.id is null
  ) then
    raise exception using
      errcode = '42501',
      message = 'Every requested mapping must target an active app user';
  end if;

  if exists (
    select 1
    from public.external_records as external_record
    where external_record.connection_id = p_connection_id
      and external_record.entity_type = 'user'
      and external_record.internal_id = any(p_internal_user_ids)
      and external_record.sync_state <> 'ignored'
      and (
        external_record.external_id !~ '^[1-9][0-9]{0,15}$'
        or external_record.external_id::numeric > 9007199254740991
      )
  ) then
    raise exception using
      errcode = '23514',
      message = 'A requested Moodle user mapping has an invalid exact external ID';
  end if;

  return query
  select
    external_record.internal_id,
    external_record.id,
    external_record.external_id,
    external_record.sync_state,
    external_record.last_seen_at,
    external_record.last_synced_at,
    external_record.source_updated_at,
    external_record.last_error
  from public.external_records as external_record
  join public.app_users as app_user
    on app_user.id = external_record.internal_id
   and app_user.status = 'active'
  where external_record.connection_id = p_connection_id
    and external_record.entity_type = 'user'
    and external_record.internal_id = any(p_internal_user_ids)
    and external_record.sync_state <> 'ignored'
  order by external_record.internal_id;
end;
$$;

revoke all on function public.resolve_moodle_user_projection_authority(uuid, uuid)
from public, anon, authenticated;
revoke all on function public.list_moodle_user_mappings_for_connection(uuid, uuid[])
from public, anon, authenticated;

grant execute on function public.resolve_moodle_user_projection_authority(uuid, uuid)
to service_role;
grant execute on function public.list_moodle_user_mappings_for_connection(uuid, uuid[])
to service_role;

commit;

-- ============================================================================
-- 13. Phase 6F Moodle enrollment and group observations
-- Source: supabase/manual/009_phase6f_moodle_enrollment_group_observation.sql
-- SHA-256: 6e11a4cc473e60be17d8f4d357100fa2513cc37f4f020e521e399591a7100702
-- ============================================================================

-- Nile Learn Phase 6F additive Moodle enrollment/group observation package.
-- Manual-only and intentionally unapplied. Stores sanitized projections only.

begin;

do $$
declare
  dependency text;
begin
  foreach dependency in array array[
    'app_users', 'role_grants', 'programs', 'course_templates', 'course_runs',
    'class_groups', 'teacher_assignments', 'student_profiles', 'enrollments',
    'class_memberships', 'integration_connections', 'external_records',
    'sync_runs', 'sync_run_items', 'reconciliation_cases'
  ] loop
    if pg_catalog.to_regclass('public.' || dependency) is null then
      raise exception 'Phase 6F requires public.%', dependency;
    end if;
  end loop;

  if pg_catalog.to_regprocedure(
    'public.resolve_moodle_user_projection_authority(uuid,uuid)'
  ) is null then
    raise exception 'Phase 6F requires the accepted Phase 6E user authority RPC';
  end if;

  if pg_catalog.to_regprocedure('nile_private.reject_immutable_change()') is null
    or pg_catalog.to_regprocedure('nile_private.jsonb_has_forbidden_keys(jsonb)') is null then
    raise exception 'Phase 6F requires Phase 1 safety helpers';
  end if;
end;
$$;

-- DTO contract:
-- person_level: internalCourseId, internalClassGroupId, providerState,
-- mappingStatus, learners[{internalUserId, internalEnrollmentId,
-- internalMembershipId, providerState, mappingStatus}].
-- aggregate: the same root IDs/states plus learnerCount, mappedLearnerCount,
-- unmappedLearnerCount. Names, email, roles, access times, provider IDs, and raw
-- metadata are not accepted.
create function nile_private.moodle_enrollment_group_payload_is_safe(
  payload jsonb,
  audience text
)
returns boolean
language plpgsql
immutable
strict
security invoker
set search_path = ''
as $$
declare
  root_keys text[];
  learner jsonb;
  learner_keys text[];
  uuid_pattern constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
begin
  if audience not in ('person_level', 'aggregate')
    or pg_catalog.jsonb_typeof(payload) <> 'object'
    or pg_catalog.octet_length(payload::text) > 65536
    or nile_private.jsonb_has_forbidden_keys(payload) then
    return false;
  end if;

  select pg_catalog.array_agg(key order by key)
  into root_keys
  from pg_catalog.jsonb_object_keys(payload) as key;

  if audience = 'person_level' then
    if root_keys is distinct from array[
      'internalClassGroupId', 'internalCourseId', 'learners',
      'mappingStatus', 'providerState'
    ]::text[]
      or pg_catalog.jsonb_typeof(payload->'learners') <> 'array'
      or pg_catalog.jsonb_array_length(payload->'learners') > 500 then
      return false;
    end if;
  elsif root_keys is distinct from array[
    'internalClassGroupId', 'internalCourseId', 'learnerCount',
    'mappedLearnerCount', 'mappingStatus', 'providerState',
    'unmappedLearnerCount'
  ]::text[] then
    return false;
  end if;

  if (payload->>'internalCourseId') !~ uuid_pattern
    or (payload->>'internalClassGroupId') !~ uuid_pattern
    or payload->>'providerState' not in ('available', 'empty')
    or payload->>'mappingStatus' not in ('exact', 'reconciliation') then
    return false;
  end if;

  if audience = 'aggregate' then
    if pg_catalog.jsonb_typeof(payload->'learnerCount') <> 'number'
      or pg_catalog.jsonb_typeof(payload->'mappedLearnerCount') <> 'number'
      or pg_catalog.jsonb_typeof(payload->'unmappedLearnerCount') <> 'number'
      or (payload->>'learnerCount') !~ '^[0-9]{1,6}$'
      or (payload->>'mappedLearnerCount') !~ '^[0-9]{1,6}$'
      or (payload->>'unmappedLearnerCount') !~ '^[0-9]{1,6}$'
      or (payload->>'learnerCount')::integer
        <> (payload->>'mappedLearnerCount')::integer
          + (payload->>'unmappedLearnerCount')::integer then
      return false;
    end if;
    return true;
  end if;

  for learner in
    select item.value
    from pg_catalog.jsonb_array_elements(payload->'learners') as item(value)
  loop
    if pg_catalog.jsonb_typeof(learner) <> 'object'
      or nile_private.jsonb_has_forbidden_keys(learner) then
      return false;
    end if;

    select pg_catalog.array_agg(key order by key)
    into learner_keys
    from pg_catalog.jsonb_object_keys(learner) as key;

    if learner_keys is distinct from array[
      'internalEnrollmentId', 'internalMembershipId', 'internalUserId',
      'mappingStatus', 'providerState'
    ]::text[]
      or (learner->>'internalUserId') !~ uuid_pattern
      or (learner->>'internalEnrollmentId') !~ uuid_pattern
      or (learner->>'internalMembershipId') !~ uuid_pattern
      or learner->>'providerState' <> 'enrolled'
      or learner->>'mappingStatus' not in ('exact', 'missing') then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

create table public.moodle_enrollment_group_observations (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  request_hash bytea not null check (pg_catalog.octet_length(request_hash) = 32),
  connection_id uuid not null references public.integration_connections(id) on delete restrict,
  internal_course_id uuid not null references public.course_templates(id) on delete restrict,
  internal_class_group_id uuid not null references public.class_groups(id) on delete restrict,
  external_course_record_id uuid references public.external_records(id) on delete restrict,
  external_group_record_id uuid references public.external_records(id) on delete restrict,
  sync_run_id uuid not null references public.sync_runs(id) on delete restrict,
  sync_run_item_id uuid not null references public.sync_run_items(id) on delete restrict,
  reconciliation_case_id uuid references public.reconciliation_cases(id) on delete restrict,
  audience text not null check (audience in ('person_level', 'aggregate')),
  outcome text not null check (outcome in ('available', 'empty', 'unavailable', 'reconciliation')),
  reconciliation_reason text check (
    reconciliation_reason in (
      'missing_course_mapping', 'missing_group_mapping',
      'missing_user_mapping', 'provider_membership_drift', 'ambiguous_mapping'
    )
  ),
  sanitized_payload jsonb,
  projection_hash bytea check (
    projection_hash is null or pg_catalog.octet_length(projection_hash) = 32
  ),
  observed_at timestamptz not null,
  fresh_until timestamptz,
  retain_until timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  check (idempotency_key ~ '^[a-z0-9][a-z0-9._:-]{7,127}$'),
  check (
    sanitized_payload is null
    or nile_private.moodle_enrollment_group_payload_is_safe(sanitized_payload, audience)
  ),
  check (
    (
      outcome in ('available', 'empty')
      and external_course_record_id is not null
      and external_group_record_id is not null
      and sanitized_payload is not null
      and projection_hash is not null
      and fresh_until > observed_at
      and retain_until > fresh_until
      and retain_until <= observed_at + interval '30 days'
      and reconciliation_case_id is null
      and reconciliation_reason is null
    ) or (
      outcome = 'unavailable'
      and sanitized_payload is null and projection_hash is null
      and fresh_until is null and retain_until is null
      and reconciliation_case_id is null and reconciliation_reason is null
    ) or (
      outcome = 'reconciliation'
      and sanitized_payload is null and projection_hash is null
      and fresh_until is null and retain_until is null
      and reconciliation_case_id is not null and reconciliation_reason is not null
    )
  )
);

create index moodle_enrollment_group_observations_scope_time_idx
  on public.moodle_enrollment_group_observations (
    connection_id, internal_course_id, internal_class_group_id,
    audience, observed_at desc, id desc
  );
create index moodle_enrollment_group_observations_retained_idx
  on public.moodle_enrollment_group_observations (
    connection_id, internal_class_group_id, audience, retain_until desc
  ) where outcome in ('available', 'empty');
create index moodle_enrollment_group_observations_run_idx
  on public.moodle_enrollment_group_observations (sync_run_id, sync_run_item_id);

create function public.resolve_moodle_enrollment_group_context(
  p_user_id uuid,
  p_active_role_grant_id uuid,
  p_internal_class_group_id uuid
)
returns table (
  connection_id uuid,
  active_role text,
  projection_audience text,
  internal_course_id uuid,
  internal_course_run_id uuid,
  internal_class_group_id uuid,
  authorized_user_ids uuid[],
  course_mapping_status text,
  group_mapping_status text,
  user_mapping_status text,
  observed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  authority_at timestamptz := pg_catalog.now();
  user_authority record;
  effective_grant record;
  class_context record;
  ready_connection_id uuid;
  connection_count integer;
begin
  if p_user_id is null or p_active_role_grant_id is null
    or p_internal_class_group_id is null then
    raise exception 'Current actor, grant, and class group are required'
      using errcode = '42501';
  end if;

  select * into strict user_authority
  from public.resolve_moodle_user_projection_authority(
    p_user_id, p_active_role_grant_id
  );

  if user_authority.active_role not in ('teacher', 'headofdepartment', 'superadmin') then
    raise exception 'Role cannot read enrollment/group projections'
      using errcode = '42501';
  end if;

  select * into strict effective_grant
  from nile_private.resolve_effective_role_grant(
    p_user_id, p_active_role_grant_id, authority_at
  );

  select
    class_group.id as class_group_id,
    course_run.id as course_run_id,
    course_template.id as course_id,
    program.department_id
  into strict class_context
  from public.class_groups as class_group
  join public.course_runs as course_run
    on course_run.id = class_group.course_run_id
   and course_run.status = 'active'
   and course_run.starts_on <= authority_at::date
   and course_run.ends_on >= authority_at::date
  join public.course_templates as course_template
    on course_template.id = course_run.course_template_id
   and course_template.status = 'active'
  join public.programs as program
    on program.id = course_template.program_id
   and program.status = 'active'
  where class_group.id = p_internal_class_group_id
    and class_group.status = 'active';

  if user_authority.active_role = 'teacher' and not exists (
    select 1
    from public.staff_profiles as teacher_profile
    join public.teacher_assignments as assignment
      on assignment.teacher_profile_id = teacher_profile.id
     and assignment.class_group_id = class_context.class_group_id
     and assignment.status = 'active'
     and assignment.starts_at <= authority_at
     and (assignment.ends_at is null or assignment.ends_at > authority_at)
    where teacher_profile.user_id = p_user_id
      and teacher_profile.status = 'active'
  ) then
    raise exception 'Teacher is not currently assigned to the exact class'
      using errcode = '42501';
  end if;

  if user_authority.active_role = 'headofdepartment'
    and not (class_context.department_id = any(effective_grant.department_ids)) then
    raise exception 'Class is outside the active HOD department scope'
      using errcode = '42501';
  end if;

  select pg_catalog.count(*)::integer,
    (pg_catalog.array_agg(connection.id order by connection.id))[1]
  into connection_count, ready_connection_id
  from public.integration_connections as connection
  where connection.provider = 'moodle'
    and connection.mode = 'read_only'
    and connection.status = 'ready';

  if connection_count <> 1 then
    raise exception 'Enrollment/group projection requires exactly one ready read-only Moodle connection'
      using errcode = '42501';
  end if;

  connection_id := ready_connection_id;
  active_role := user_authority.active_role;
  projection_audience := case active_role
    when 'teacher' then 'person_level'
    else 'aggregate'
  end;
  internal_course_id := class_context.course_id;
  internal_course_run_id := class_context.course_run_id;
  internal_class_group_id := class_context.class_group_id;
  observed_at := authority_at;

  if active_role = 'teacher' then
    select coalesce(pg_catalog.array_agg(learner.id order by learner.id), '{}'::uuid[])
    into authorized_user_ids
    from public.class_memberships as membership
    join public.enrollments as enrollment
      on enrollment.id = membership.enrollment_id
     and enrollment.course_run_id = class_context.course_run_id
     and enrollment.status = 'active'
     and enrollment.starts_at <= authority_at
     and (enrollment.ends_at is null or enrollment.ends_at > authority_at)
    join public.student_profiles as student_profile
      on student_profile.id = enrollment.student_profile_id
     and student_profile.status = 'active'
    join public.app_users as learner
      on learner.id = student_profile.user_id and learner.status = 'active'
    where membership.class_group_id = class_context.class_group_id
      and membership.course_run_id = class_context.course_run_id
      and membership.status = 'active'
      and membership.starts_at <= authority_at
      and (membership.ends_at is null or membership.ends_at > authority_at);
  else
    authorized_user_ids := '{}'::uuid[];
  end if;

  course_mapping_status := case when exists (
    select 1 from public.external_records as mapping
    where mapping.connection_id = ready_connection_id
      and mapping.entity_type = 'course'
      and mapping.internal_id = class_context.course_id
      and mapping.sync_state <> 'ignored'
  ) then 'exact' else 'missing' end;
  group_mapping_status := case when exists (
    select 1 from public.external_records as mapping
    where mapping.connection_id = ready_connection_id
      and mapping.entity_type = 'class_group'
      and mapping.internal_id = class_context.class_group_id
      and mapping.sync_state <> 'ignored'
  ) then 'exact' else 'missing' end;
  user_mapping_status := case when not exists (
    select 1
    from public.class_memberships as membership
    join public.enrollments as enrollment
      on enrollment.id = membership.enrollment_id
     and enrollment.course_run_id = class_context.course_run_id
     and enrollment.status = 'active'
     and enrollment.starts_at <= authority_at
     and (enrollment.ends_at is null or enrollment.ends_at > authority_at)
    join public.student_profiles as student_profile
      on student_profile.id = enrollment.student_profile_id
     and student_profile.status = 'active'
    join public.app_users as learner
      on learner.id = student_profile.user_id and learner.status = 'active'
    left join public.external_records as mapping
      on mapping.connection_id = ready_connection_id
     and mapping.entity_type = 'user'
     and mapping.internal_id = learner.id
     and mapping.sync_state <> 'ignored'
    where membership.class_group_id = class_context.class_group_id
      and membership.course_run_id = class_context.course_run_id
      and membership.status = 'active'
      and membership.starts_at <= authority_at
      and (membership.ends_at is null or membership.ends_at > authority_at)
      and mapping.id is null
  ) then 'exact' else 'missing' end;

  return next;
exception
  when no_data_found then
    raise exception 'Class context does not resolve to current normalized authority'
      using errcode = '42501';
end;
$$;

create function public.record_moodle_enrollment_group_observation(
  p_idempotency_key text,
  p_connection_id uuid,
  p_internal_course_id uuid,
  p_internal_class_group_id uuid,
  p_external_course_record_id uuid,
  p_external_group_record_id uuid,
  p_sync_run_id uuid,
  p_sync_run_item_id uuid,
  p_audience text,
  p_outcome text,
  p_sanitized_payload jsonb,
  p_projection_hash bytea,
  p_observed_at timestamptz,
  p_fresh_until timestamptz,
  p_retain_until timestamptz,
  p_reconciliation_case_id uuid default null,
  p_reconciliation_reason text default null
)
returns table (observation_id uuid, replayed boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  calculated_request_hash bytea;
  inserted_id uuid;
  existing_observation record;
  class_context record;
  course_mapping record;
  group_mapping record;
  run_row record;
  item_row record;
  case_row record;
  payload_learner jsonb;
  roster_count integer;
  mapped_count integer;
begin
  if p_idempotency_key is null
    or p_idempotency_key !~ '^[a-z0-9][a-z0-9._:-]{7,127}$'
    or p_audience not in ('person_level', 'aggregate')
    or p_outcome not in ('available', 'empty', 'unavailable', 'reconciliation')
    or p_observed_at is null then
    raise exception 'Invalid enrollment/group observation metadata'
      using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.integration_connections as connection
    where connection.id = p_connection_id
      and connection.provider = 'moodle'
      and connection.mode = 'read_only'
      and connection.status = 'ready'
  ) then
    raise exception 'Observation connection is not ready read-only Moodle'
      using errcode = '42501';
  end if;

  select course_template.id as course_id, course_run.id as run_id, class_group.id as group_id
  into strict class_context
  from public.class_groups as class_group
  join public.course_runs as course_run
    on course_run.id = class_group.course_run_id
   and course_run.status = 'active'
   and course_run.starts_on <= p_observed_at::date
   and course_run.ends_on >= p_observed_at::date
  join public.course_templates as course_template
    on course_template.id = course_run.course_template_id
   and course_template.status = 'active'
  where class_group.id = p_internal_class_group_id
    and class_group.status = 'active';

  if class_context.course_id is distinct from p_internal_course_id then
    raise exception 'Observation course and class context do not match'
      using errcode = '23514';
  end if;

  if p_outcome in ('available', 'empty') then
    if p_sanitized_payload is null
      or not nile_private.moodle_enrollment_group_payload_is_safe(
        p_sanitized_payload, p_audience
      )
      or p_projection_hash is null
      or p_projection_hash is distinct from public.digest(
        pg_catalog.convert_to(p_sanitized_payload::text, 'UTF8'), 'sha256'
      )
      or p_fresh_until is null or p_fresh_until <= p_observed_at
      or p_retain_until is null or p_retain_until <= p_fresh_until
      or p_retain_until > p_observed_at + interval '30 days'
      or p_reconciliation_case_id is not null
      or p_reconciliation_reason is not null
      or (p_sanitized_payload->>'internalCourseId')::uuid <> p_internal_course_id
      or (p_sanitized_payload->>'internalClassGroupId')::uuid <> p_internal_class_group_id
      or p_sanitized_payload->>'providerState' <> p_outcome
      or (p_outcome = 'empty' and p_sanitized_payload->>'mappingStatus' <> 'exact') then
      raise exception 'Successful observation requires an exact safe bounded projection'
        using errcode = '22023';
    end if;
  elsif p_sanitized_payload is not null or p_projection_hash is not null
    or p_fresh_until is not null or p_retain_until is not null then
    raise exception 'Unavailable and reconciliation outcomes cannot retain payloads'
      using errcode = '22023';
  end if;

  if p_outcome = 'reconciliation' then
    if p_reconciliation_case_id is null or p_reconciliation_reason not in (
      'missing_course_mapping', 'missing_group_mapping',
      'missing_user_mapping', 'provider_membership_drift', 'ambiguous_mapping'
    ) then
      raise exception 'Reconciliation requires one bounded case and reason'
        using errcode = '22023';
    end if;
  elsif p_reconciliation_case_id is not null or p_reconciliation_reason is not null then
    raise exception 'Only reconciliation outcomes can reference a case'
      using errcode = '22023';
  end if;

  if p_external_course_record_id is not null then
    select mapping.connection_id, mapping.internal_id, mapping.external_id
    into strict course_mapping
    from public.external_records as mapping
    where mapping.id = p_external_course_record_id
      and mapping.entity_type = 'course' and mapping.sync_state <> 'ignored';
    if course_mapping.connection_id <> p_connection_id
      or course_mapping.internal_id <> p_internal_course_id then
      raise exception 'Course mapping is outside the exact observation context'
        using errcode = '23514';
    end if;
  elsif p_outcome in ('available', 'empty') then
    raise exception 'Successful observation requires an exact course mapping'
      using errcode = '23514';
  end if;

  if p_external_group_record_id is not null then
    select mapping.connection_id, mapping.internal_id, mapping.external_id
    into strict group_mapping
    from public.external_records as mapping
    where mapping.id = p_external_group_record_id
      and mapping.entity_type = 'class_group' and mapping.sync_state <> 'ignored';
    if group_mapping.connection_id <> p_connection_id
      or group_mapping.internal_id <> p_internal_class_group_id then
      raise exception 'Group mapping is outside the exact observation context'
        using errcode = '23514';
    end if;
  elsif p_outcome in ('available', 'empty') then
    raise exception 'Successful observation requires an exact group mapping'
      using errcode = '23514';
  end if;

  if p_outcome = 'available' and p_audience = 'person_level' then
    for payload_learner in
      select item.value from pg_catalog.jsonb_array_elements(
        p_sanitized_payload->'learners'
      ) as item(value)
    loop
      if not exists (
        select 1
        from public.class_memberships as membership
        join public.enrollments as enrollment
          on enrollment.id = membership.enrollment_id
         and enrollment.course_run_id = class_context.run_id
         and enrollment.status = 'active'
         and enrollment.starts_at <= p_observed_at
         and (enrollment.ends_at is null or enrollment.ends_at > p_observed_at)
        join public.student_profiles as student_profile
          on student_profile.id = enrollment.student_profile_id
         and student_profile.status = 'active'
        join public.app_users as learner
          on learner.id = student_profile.user_id and learner.status = 'active'
        where membership.id = (payload_learner->>'internalMembershipId')::uuid
          and enrollment.id = (payload_learner->>'internalEnrollmentId')::uuid
          and learner.id = (payload_learner->>'internalUserId')::uuid
          and membership.class_group_id = p_internal_class_group_id
          and membership.course_run_id = class_context.run_id
          and membership.status = 'active'
          and membership.starts_at <= p_observed_at
          and (membership.ends_at is null or membership.ends_at > p_observed_at)
      ) then
        raise exception 'Person-level payload contains a noncurrent learner tuple'
          using errcode = '23514';
      end if;

      if ((payload_learner->>'mappingStatus') = 'exact') is distinct from exists (
        select 1 from public.external_records as user_mapping
        where user_mapping.connection_id = p_connection_id
          and user_mapping.entity_type = 'user'
          and user_mapping.internal_id = (payload_learner->>'internalUserId')::uuid
          and user_mapping.sync_state <> 'ignored'
      ) then
        raise exception 'Person-level user mapping status drifted from exact records'
          using errcode = '23514';
      end if;
    end loop;

    select pg_catalog.count(*)::integer into roster_count
    from public.class_memberships as membership
    join public.enrollments as enrollment
      on enrollment.id = membership.enrollment_id
     and enrollment.course_run_id = class_context.run_id
     and enrollment.status = 'active'
     and enrollment.starts_at <= p_observed_at
     and (enrollment.ends_at is null or enrollment.ends_at > p_observed_at)
    join public.student_profiles as student_profile
      on student_profile.id = enrollment.student_profile_id and student_profile.status = 'active'
    join public.app_users as learner
      on learner.id = student_profile.user_id and learner.status = 'active'
    where membership.class_group_id = p_internal_class_group_id
      and membership.course_run_id = class_context.run_id
      and membership.status = 'active'
      and membership.starts_at <= p_observed_at
      and (membership.ends_at is null or membership.ends_at > p_observed_at);

    if roster_count <> pg_catalog.jsonb_array_length(p_sanitized_payload->'learners')
      or roster_count <> (
        select pg_catalog.count(distinct item.value->>'internalUserId')
        from pg_catalog.jsonb_array_elements(p_sanitized_payload->'learners') as item(value)
      )
      or ((p_sanitized_payload->>'mappingStatus') = 'exact') is distinct from not exists (
        select 1
        from pg_catalog.jsonb_array_elements(p_sanitized_payload->'learners') as item(value)
        where item.value->>'mappingStatus' = 'missing'
      ) then
      raise exception 'Person-level payload is not the exact current class roster'
        using errcode = '23514';
    end if;
  elsif p_outcome = 'empty' and p_audience = 'person_level'
    and pg_catalog.jsonb_array_length(p_sanitized_payload->'learners') <> 0 then
    raise exception 'Empty person-level projection must contain no learners'
      using errcode = '23514';
  elsif p_outcome = 'available' and p_audience = 'aggregate' then
    select pg_catalog.count(*)::integer,
      pg_catalog.count(user_mapping.id)::integer
    into roster_count, mapped_count
    from public.class_memberships as membership
    join public.enrollments as enrollment
      on enrollment.id = membership.enrollment_id
     and enrollment.course_run_id = class_context.run_id
     and enrollment.status = 'active'
     and enrollment.starts_at <= p_observed_at
     and (enrollment.ends_at is null or enrollment.ends_at > p_observed_at)
    join public.student_profiles as student_profile
      on student_profile.id = enrollment.student_profile_id and student_profile.status = 'active'
    join public.app_users as learner
      on learner.id = student_profile.user_id and learner.status = 'active'
    left join public.external_records as user_mapping
      on user_mapping.connection_id = p_connection_id
     and user_mapping.entity_type = 'user'
     and user_mapping.internal_id = learner.id
     and user_mapping.sync_state <> 'ignored'
    where membership.class_group_id = p_internal_class_group_id
      and membership.course_run_id = class_context.run_id
      and membership.status = 'active'
      and membership.starts_at <= p_observed_at
      and (membership.ends_at is null or membership.ends_at > p_observed_at);

    if (p_sanitized_payload->>'learnerCount')::integer <> roster_count
      or (p_sanitized_payload->>'mappedLearnerCount')::integer <> mapped_count
      or (p_sanitized_payload->>'unmappedLearnerCount')::integer <> roster_count - mapped_count
      or ((p_sanitized_payload->>'mappingStatus') = 'exact')
        is distinct from (roster_count = mapped_count) then
      raise exception 'Aggregate payload counts drifted from current exact mappings'
        using errcode = '23514';
    end if;
  elsif p_outcome = 'empty' and p_audience = 'aggregate'
    and (
      (p_sanitized_payload->>'learnerCount')::integer <> 0
      or (p_sanitized_payload->>'mappedLearnerCount')::integer <> 0
      or (p_sanitized_payload->>'unmappedLearnerCount')::integer <> 0
    ) then
    raise exception 'Empty aggregate projection must contain zero counts'
      using errcode = '23514';
  end if;

  select sync_run.connection_id, sync_run.entity_type,
    sync_run.direction, sync_run.status
  into strict run_row
  from public.sync_runs as sync_run where sync_run.id = p_sync_run_id;
  select item.sync_run_id, item.external_record_id,
    item.external_id, item.status
  into strict item_row
  from public.sync_run_items as item where item.id = p_sync_run_item_id;

  if run_row.connection_id <> p_connection_id
    or run_row.entity_type <> 'enrollment_groups_projection'
    or run_row.direction <> 'read'
    or run_row.status not in ('succeeded', 'partial', 'failed')
    or item_row.sync_run_id <> p_sync_run_id
    or item_row.external_record_id is distinct from p_external_group_record_id
    or (p_external_group_record_id is not null
      and item_row.external_id is distinct from group_mapping.external_id)
    or (p_outcome in ('available', 'empty') and item_row.status <> 'succeeded')
    or (p_outcome = 'unavailable' and item_row.status <> 'failed')
    or (p_outcome = 'reconciliation' and item_row.status <> 'needs_review') then
    raise exception 'Observation sync evidence is outside the exact read context'
      using errcode = '23514';
  end if;

  if p_outcome = 'reconciliation' then
    select reconciliation.connection_id, reconciliation.entity_type,
      reconciliation.internal_id, reconciliation.external_id,
      reconciliation.reason, reconciliation.status
    into strict case_row
    from public.reconciliation_cases as reconciliation
    where reconciliation.id = p_reconciliation_case_id;
    if case_row.connection_id <> p_connection_id
      or case_row.entity_type <> 'enrollment_groups_projection'
      or case_row.internal_id <> p_internal_class_group_id
      or case_row.external_id is distinct from item_row.external_id
      or case_row.reason <> p_reconciliation_reason
      or case_row.status <> 'open' then
      raise exception 'Reconciliation case is outside the exact class context'
        using errcode = '23514';
    end if;
  end if;

  calculated_request_hash := public.digest(
    pg_catalog.convert_to(pg_catalog.jsonb_build_array(
      p_connection_id::text, p_internal_course_id::text,
      p_internal_class_group_id::text, p_external_course_record_id::text,
      p_external_group_record_id::text, p_sync_run_id::text,
      p_sync_run_item_id::text, p_audience, p_outcome, p_sanitized_payload,
      pg_catalog.encode(p_projection_hash, 'hex'), p_observed_at::text,
      p_fresh_until::text, p_retain_until::text,
      p_reconciliation_case_id::text, p_reconciliation_reason
    )::text, 'UTF8'), 'sha256'
  );

  insert into public.moodle_enrollment_group_observations (
    idempotency_key, request_hash, connection_id, internal_course_id,
    internal_class_group_id, external_course_record_id,
    external_group_record_id, sync_run_id, sync_run_item_id,
    reconciliation_case_id, audience, outcome, reconciliation_reason,
    sanitized_payload, projection_hash, observed_at, fresh_until, retain_until
  ) values (
    p_idempotency_key, calculated_request_hash, p_connection_id,
    p_internal_course_id, p_internal_class_group_id,
    p_external_course_record_id, p_external_group_record_id,
    p_sync_run_id, p_sync_run_item_id, p_reconciliation_case_id,
    p_audience, p_outcome, p_reconciliation_reason, p_sanitized_payload,
    p_projection_hash, p_observed_at, p_fresh_until, p_retain_until
  ) on conflict (idempotency_key) do nothing returning id into inserted_id;

  if inserted_id is not null then
    return query select inserted_id, false;
    return;
  end if;

  select observation.id, observation.request_hash into strict existing_observation
  from public.moodle_enrollment_group_observations as observation
  where observation.idempotency_key = p_idempotency_key;
  if existing_observation.request_hash is distinct from calculated_request_hash then
    raise exception 'Enrollment/group observation idempotency conflict'
      using errcode = '23505';
  end if;
  return query select existing_observation.id, true;
exception
  when no_data_found then
    raise exception 'Observation references missing or inactive exact evidence'
      using errcode = '23514';
end;
$$;

create function public.list_authorized_moodle_enrollment_group_freshness(
  p_user_id uuid,
  p_active_role_grant_id uuid,
  p_connection_id uuid,
  p_internal_class_group_id uuid,
  p_as_of timestamptz
)
returns table (
  connection_id uuid,
  active_role text,
  projection_audience text,
  internal_course_id uuid,
  internal_class_group_id uuid,
  course_mapping_status text,
  group_mapping_status text,
  user_mapping_status text,
  freshness_state text,
  latest_outcome text,
  reconciliation_reason text,
  sanitized_payload jsonb,
  projection_hash bytea,
  successful_sync_run_id uuid,
  successful_observed_at timestamptz,
  fresh_until timestamptz,
  retain_until timestamptz,
  latest_observed_at timestamptz,
  authority_observed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  context record;
begin
  if p_as_of is null then
    raise exception 'Freshness evaluation requires an explicit timestamp'
      using errcode = '22023';
  end if;

  select * into strict context
  from public.resolve_moodle_enrollment_group_context(
    p_user_id, p_active_role_grant_id, p_internal_class_group_id
  );
  if context.connection_id <> p_connection_id then
    raise exception 'Connection is outside the live class authority context'
      using errcode = '42501';
  end if;

  return query
  select
    context.connection_id, context.active_role, context.projection_audience,
    context.internal_course_id, context.internal_class_group_id,
    context.course_mapping_status, context.group_mapping_status,
    context.user_mapping_status,
    case
      when context.course_mapping_status <> 'exact'
        or context.group_mapping_status <> 'exact'
        or context.user_mapping_status <> 'exact' then 'reconciliation'
      when retained_success.id is not null
        and latest_observation.id = retained_success.id
        and p_as_of <= retained_success.fresh_until then 'fresh'
      when retained_success.id is not null then 'stale_retained'
      when prior_success.id is not null then 'expired'
      when latest_observation.outcome = 'reconciliation' then 'reconciliation'
      else 'unavailable'
    end,
    latest_observation.outcome,
    latest_observation.reconciliation_reason,
    retained_success.sanitized_payload,
    retained_success.projection_hash,
    retained_success.sync_run_id,
    retained_success.observed_at,
    retained_success.fresh_until,
    retained_success.retain_until,
    latest_observation.observed_at,
    context.observed_at
  from (select 1) as singleton
  left join lateral (
    select observation.*
    from public.moodle_enrollment_group_observations as observation
    where observation.connection_id = context.connection_id
      and observation.internal_course_id = context.internal_course_id
      and observation.internal_class_group_id = context.internal_class_group_id
      and observation.audience = context.projection_audience
      and observation.observed_at <= p_as_of
    order by observation.observed_at desc, observation.id desc limit 1
  ) as latest_observation on true
  left join lateral (
    select observation.*
    from public.moodle_enrollment_group_observations as observation
    where observation.connection_id = context.connection_id
      and observation.internal_course_id = context.internal_course_id
      and observation.internal_class_group_id = context.internal_class_group_id
      and observation.audience = context.projection_audience
      and observation.outcome in ('available', 'empty')
      and context.course_mapping_status = 'exact'
      and context.group_mapping_status = 'exact'
      and context.user_mapping_status = 'exact'
      and (
        context.projection_audience <> 'person_level'
        or not exists (
          select 1
          from pg_catalog.jsonb_array_elements(
            observation.sanitized_payload->'learners'
          ) as retained_learner(value)
          where not (
            (retained_learner.value->>'internalUserId')::uuid
              = any(context.authorized_user_ids)
          )
        )
      )
      and observation.observed_at <= p_as_of
      and p_as_of <= observation.retain_until
    order by observation.observed_at desc, observation.id desc limit 1
  ) as retained_success on true
  left join lateral (
    select observation.id
    from public.moodle_enrollment_group_observations as observation
    where observation.connection_id = context.connection_id
      and observation.internal_course_id = context.internal_course_id
      and observation.internal_class_group_id = context.internal_class_group_id
      and observation.audience = context.projection_audience
      and observation.outcome in ('available', 'empty')
      and observation.observed_at <= p_as_of
    order by observation.observed_at desc, observation.id desc limit 1
  ) as prior_success on true;
end;
$$;

create trigger moodle_enrollment_group_observations_immutable
before update or delete on public.moodle_enrollment_group_observations
for each row execute function nile_private.reject_immutable_change();

alter table public.moodle_enrollment_group_observations enable row level security;
alter table public.moodle_enrollment_group_observations force row level security;

revoke all on table public.moodle_enrollment_group_observations
from public, anon, authenticated, service_role;
revoke all on function nile_private.moodle_enrollment_group_payload_is_safe(jsonb, text)
from public, anon, authenticated, service_role;

revoke all on function public.resolve_moodle_enrollment_group_context(uuid, uuid, uuid)
from public, anon, authenticated;
revoke all on function public.record_moodle_enrollment_group_observation(text, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, text, jsonb, bytea, timestamptz, timestamptz, timestamptz, uuid, text)
from public, anon, authenticated;
revoke all on function public.list_authorized_moodle_enrollment_group_freshness(uuid, uuid, uuid, uuid, timestamptz)
from public, anon, authenticated;

grant execute on function public.resolve_moodle_enrollment_group_context(uuid, uuid, uuid)
to service_role;
grant execute on function public.record_moodle_enrollment_group_observation(text, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, text, jsonb, bytea, timestamptz, timestamptz, timestamptz, uuid, text)
to service_role;
grant execute on function public.list_authorized_moodle_enrollment_group_freshness(uuid, uuid, uuid, uuid, timestamptz)
to service_role;

commit;

-- ============================================================================
-- 14. Phase 6G Moodle assessment status observations
-- Source: supabase/manual/010_phase6g_moodle_assessment_status_observation.sql
-- SHA-256: e2290461ac824c7bf3aa4009bf94d2d58492a0826d524c367b3ceefa5358616c
-- ============================================================================

-- Nile Learn Phase 6G additive Moodle assessment status observation package.
-- Manual-only and intentionally unapplied. Stores one sanitized class snapshot.

begin;

do $$
declare
  dependency text;
begin
  foreach dependency in array array[
    'app_users', 'role_grants', 'programs', 'course_templates', 'course_runs',
    'class_groups', 'teacher_assignments', 'student_profiles', 'enrollments',
    'class_memberships', 'integration_connections', 'external_records',
    'sync_runs', 'sync_run_items', 'reconciliation_cases',
    'moodle_enrollment_group_observations'
  ] loop
    if pg_catalog.to_regclass('public.' || dependency) is null then
      raise exception 'Phase 6G requires public.%', dependency;
    end if;
  end loop;

  if pg_catalog.to_regprocedure(
    'public.resolve_moodle_user_projection_authority(uuid,uuid)'
  ) is null then
    raise exception 'Phase 6G requires the accepted Phase 6E user authority RPC';
  end if;

  if pg_catalog.to_regprocedure('nile_private.reject_immutable_change()') is null
    or pg_catalog.to_regprocedure('nile_private.jsonb_has_forbidden_keys(jsonb)') is null then
    raise exception 'Phase 6G requires Phase 1 safety helpers';
  end if;
end;
$$;

-- Payload contract:
-- {internalCourseId, internalClassGroupId, providerState, mappingStatus, items}.
-- Each item contains projectionId (the internal external_records UUID), kind,
-- title, visibility, acceptsSubmissions, and only the applicable schedule keys.
create function nile_private.moodle_assessment_status_payload_is_safe(payload jsonb)
returns boolean
language plpgsql
immutable
strict
security invoker
set search_path = ''
as $$
declare
  root_keys text[];
  item jsonb;
  item_keys text[];
  projection_ids uuid[] := '{}'::uuid[];
  projection_id uuid;
  timestamp_key text;
  timestamp_value timestamptz;
  previous_timestamp timestamptz;
  item_count integer;
  uuid_pattern constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
begin
  if pg_catalog.jsonb_typeof(payload) <> 'object'
    or pg_catalog.octet_length(payload::text) > 131072
    or nile_private.jsonb_has_forbidden_keys(payload) then
    return false;
  end if;

  select pg_catalog.array_agg(key order by key)
  into root_keys
  from pg_catalog.jsonb_object_keys(payload) as key;

  if root_keys is distinct from array[
    'internalClassGroupId', 'internalCourseId', 'items',
    'mappingStatus', 'providerState'
  ]::text[]
    or (payload->>'internalCourseId') !~ uuid_pattern
    or (payload->>'internalClassGroupId') !~ uuid_pattern
    or payload->>'providerState' not in ('available', 'empty')
    or payload->>'mappingStatus' <> 'exact'
    or pg_catalog.jsonb_typeof(payload->'items') <> 'array' then
    return false;
  end if;

  item_count := pg_catalog.jsonb_array_length(payload->'items');
  if item_count > 500
    or (payload->>'providerState' = 'available' and item_count = 0)
    or (payload->>'providerState' = 'empty' and item_count <> 0) then
    return false;
  end if;

  for item in
    select entry.value
    from pg_catalog.jsonb_array_elements(payload->'items') as entry(value)
  loop
    if pg_catalog.jsonb_typeof(item) <> 'object'
      or nile_private.jsonb_has_forbidden_keys(item) then
      return false;
    end if;

    select pg_catalog.array_agg(key order by key)
    into item_keys
    from pg_catalog.jsonb_object_keys(item) as key;

    if not (item_keys @> array[
      'acceptsSubmissions', 'kind', 'projectionId', 'title', 'visibility'
    ]::text[])
      or not (item_keys <@ array[
        'acceptsSubmissions', 'closesAt', 'cutoffAt', 'dueAt', 'kind',
        'opensAt', 'projectionId', 'title', 'visibility'
      ]::text[])
      or (item->>'projectionId') !~ uuid_pattern
      or item->>'kind' not in ('assignment', 'quiz')
      or item->>'visibility' not in ('visible', 'hidden')
      or pg_catalog.jsonb_typeof(item->'acceptsSubmissions') <> 'boolean'
      or pg_catalog.jsonb_typeof(item->'title') <> 'string'
      or pg_catalog.length(item->>'title') not between 1 and 300
      or item->>'title' ~ '[<>]'
      or item->>'title' ~* '(https?://|javascript:|data:)' then
      return false;
    end if;

    projection_id := (item->>'projectionId')::uuid;
    if projection_id = any(projection_ids) then
      return false;
    end if;
    projection_ids := pg_catalog.array_append(projection_ids, projection_id);

    previous_timestamp := null;
    foreach timestamp_key in array array['opensAt', 'dueAt', 'cutoffAt', 'closesAt']
    loop
      if item ? timestamp_key then
        if pg_catalog.jsonb_typeof(item->timestamp_key) <> 'string'
          or pg_catalog.length(item->>timestamp_key) > 40 then
          return false;
        end if;
        begin
          timestamp_value := (item->>timestamp_key)::timestamptz;
        exception when invalid_datetime_format or datetime_field_overflow then
          return false;
        end;
        if previous_timestamp is not null and timestamp_value < previous_timestamp then
          return false;
        end if;
        previous_timestamp := timestamp_value;
      end if;
    end loop;
  end loop;

  return true;
end;
$$;

create table public.moodle_assessment_status_observations (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  request_hash bytea not null check (pg_catalog.octet_length(request_hash) = 32),
  connection_id uuid not null references public.integration_connections(id) on delete restrict,
  internal_course_id uuid not null references public.course_templates(id) on delete restrict,
  internal_class_group_id uuid not null references public.class_groups(id) on delete restrict,
  external_course_record_id uuid references public.external_records(id) on delete restrict,
  external_group_record_id uuid references public.external_records(id) on delete restrict,
  sync_run_id uuid not null references public.sync_runs(id) on delete restrict,
  sync_run_item_id uuid not null references public.sync_run_items(id) on delete restrict,
  reconciliation_case_id uuid references public.reconciliation_cases(id) on delete restrict,
  outcome text not null check (outcome in ('available', 'empty', 'unavailable', 'reconciliation')),
  reconciliation_reason text check (
    reconciliation_reason in (
      'missing_course_mapping', 'missing_group_mapping', 'missing_user_mapping',
      'missing_assessment_mapping', 'provider_schedule_drift', 'ambiguous_mapping'
    )
  ),
  sanitized_payload jsonb,
  projection_hash bytea check (
    projection_hash is null or pg_catalog.octet_length(projection_hash) = 32
  ),
  observed_at timestamptz not null,
  fresh_until timestamptz,
  retain_until timestamptz,
  purge_after timestamptz not null,
  created_at timestamptz not null default pg_catalog.now(),
  check (idempotency_key ~ '^[a-z0-9][a-z0-9._:-]{7,127}$'),
  check (
    sanitized_payload is null
    or nile_private.moodle_assessment_status_payload_is_safe(sanitized_payload)
  ),
  check (purge_after > observed_at and purge_after <= observed_at + interval '30 days'),
  check (
    (
      outcome in ('available', 'empty')
      and external_course_record_id is not null
      and external_group_record_id is not null
      and sanitized_payload is not null
      and projection_hash is not null
      and fresh_until = observed_at + interval '15 minutes'
      and retain_until > fresh_until
      and retain_until <= purge_after
      and reconciliation_case_id is null
      and reconciliation_reason is null
    ) or (
      outcome = 'unavailable'
      and sanitized_payload is null and projection_hash is null
      and fresh_until is null and retain_until is null
      and reconciliation_case_id is null and reconciliation_reason is null
    ) or (
      outcome = 'reconciliation'
      and sanitized_payload is null and projection_hash is null
      and fresh_until is null and retain_until is null
      and reconciliation_case_id is not null and reconciliation_reason is not null
    )
  )
);

create index moodle_assessment_status_observations_scope_time_idx
  on public.moodle_assessment_status_observations (
    connection_id, internal_course_id, internal_class_group_id,
    observed_at desc, id desc
  );
create index moodle_assessment_status_observations_retained_idx
  on public.moodle_assessment_status_observations (
    connection_id, internal_class_group_id, retain_until desc
  ) where outcome in ('available', 'empty');
create index moodle_assessment_status_observations_purge_idx
  on public.moodle_assessment_status_observations (purge_after, id);

create function public.resolve_moodle_assessment_status_context(
  p_user_id uuid,
  p_active_role_grant_id uuid,
  p_internal_class_group_id uuid
)
returns table (
  connection_id uuid,
  active_role text,
  projection_audience text,
  internal_course_id uuid,
  internal_course_run_id uuid,
  internal_class_group_id uuid,
  subject_user_id uuid,
  course_mapping_status text,
  group_mapping_status text,
  user_mapping_status text,
  assessment_mapping_status text,
  observed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  authority_at timestamptz := pg_catalog.now();
  user_authority record;
  effective_grant record;
  class_context record;
  ready_connection_id uuid;
  connection_count integer;
  course_external_id text;
begin
  if p_user_id is null or p_active_role_grant_id is null
    or p_internal_class_group_id is null then
    raise exception 'Current actor, grant, and class group are required'
      using errcode = '42501';
  end if;

  select * into strict user_authority
  from public.resolve_moodle_user_projection_authority(
    p_user_id, p_active_role_grant_id
  );
  if user_authority.active_role not in (
    'student', 'teacher', 'headofdepartment', 'superadmin'
  ) then
    raise exception 'Role cannot read assessment status projections'
      using errcode = '42501';
  end if;

  select * into strict effective_grant
  from nile_private.resolve_effective_role_grant(
    p_user_id, p_active_role_grant_id, authority_at
  );

  select class_group.id as group_id, class_group.status as group_status,
    course_run.id as run_id, course_run.status as run_status,
    course_run.starts_on, course_run.ends_on,
    course_template.id as course_id, program.department_id
  into strict class_context
  from public.class_groups as class_group
  join public.course_runs as course_run
    on course_run.id = class_group.course_run_id
   and course_run.status in ('active', 'completed')
  join public.course_templates as course_template
    on course_template.id = course_run.course_template_id
   and course_template.status = 'active'
  join public.programs as program
    on program.id = course_template.program_id and program.status = 'active'
  where class_group.id = p_internal_class_group_id
    and class_group.status in ('active', 'completed');

  if user_authority.active_role = 'student' then
    if not exists (
      select 1
      from public.student_profiles as student_profile
      join public.enrollments as enrollment
        on enrollment.student_profile_id = student_profile.id
       and enrollment.course_run_id = class_context.run_id
       and enrollment.status in ('active', 'completed')
      join public.class_memberships as membership
        on membership.enrollment_id = enrollment.id
       and membership.course_run_id = class_context.run_id
       and membership.class_group_id = class_context.group_id
       and (
         (enrollment.status = 'active' and membership.status = 'active'
          and enrollment.starts_at <= authority_at
          and (enrollment.ends_at is null or enrollment.ends_at > authority_at)
          and membership.starts_at <= authority_at
          and (membership.ends_at is null or membership.ends_at > authority_at))
         or (enrollment.status = 'completed' and membership.status = 'ended')
       )
      where student_profile.user_id = p_user_id
        and student_profile.status = 'active'
    ) then
      raise exception 'Student does not own an exact active or completed class enrollment'
        using errcode = '42501';
    end if;
  elsif user_authority.active_role = 'teacher' then
    if class_context.run_status <> 'active'
      or class_context.group_status <> 'active'
      or authority_at::date not between class_context.starts_on and class_context.ends_on
      or not exists (
        select 1
        from public.staff_profiles as teacher_profile
        join public.teacher_assignments as assignment
          on assignment.teacher_profile_id = teacher_profile.id
         and assignment.class_group_id = class_context.group_id
         and assignment.status = 'active'
         and assignment.starts_at <= authority_at
         and (assignment.ends_at is null or assignment.ends_at > authority_at)
        where teacher_profile.user_id = p_user_id
          and teacher_profile.status = 'active'
      ) then
      raise exception 'Teacher is not currently assigned to the exact class'
        using errcode = '42501';
    end if;
  elsif user_authority.active_role = 'headofdepartment'
    and not (class_context.department_id = any(effective_grant.department_ids)) then
    raise exception 'Class is outside the active HOD department scope'
      using errcode = '42501';
  end if;

  select pg_catalog.count(*)::integer,
    (pg_catalog.array_agg(connection.id order by connection.id))[1]
  into connection_count, ready_connection_id
  from public.integration_connections as connection
  where connection.provider = 'moodle'
    and connection.mode = 'read_only'
    and connection.status = 'ready';
  if connection_count <> 1 then
    raise exception 'Assessment status requires exactly one ready read-only Moodle connection'
      using errcode = '42501';
  end if;

  connection_id := ready_connection_id;
  active_role := user_authority.active_role;
  projection_audience := case when active_role = 'student'
    then 'learner' else 'class_staff' end;
  internal_course_id := class_context.course_id;
  internal_course_run_id := class_context.run_id;
  internal_class_group_id := class_context.group_id;
  subject_user_id := case when active_role = 'student' then p_user_id else null end;
  observed_at := authority_at;

  select mapping.external_id into course_external_id
  from public.external_records as mapping
  where mapping.connection_id = ready_connection_id
    and mapping.entity_type = 'course'
    and mapping.internal_id = class_context.course_id
    and mapping.sync_state <> 'ignored';
  course_mapping_status := case when course_external_id is null then 'missing' else 'exact' end;
  group_mapping_status := case when exists (
    select 1 from public.external_records as mapping
    where mapping.connection_id = ready_connection_id
      and mapping.entity_type = 'class_group'
      and mapping.internal_id = class_context.group_id
      and mapping.sync_state <> 'ignored'
  ) then 'exact' else 'missing' end;
  user_mapping_status := case
    when active_role <> 'student' then 'not_required'
    when exists (
      select 1 from public.external_records as mapping
      where mapping.connection_id = ready_connection_id
        and mapping.entity_type = 'user'
        and mapping.internal_id = p_user_id
        and mapping.sync_state <> 'ignored'
    ) then 'exact' else 'missing' end;

  assessment_mapping_status := case
    when course_external_id is null then 'missing'
    when exists (
      select 1 from public.external_records as mapping
      where mapping.connection_id = ready_connection_id
        and mapping.entity_type in ('assignment', 'quiz')
        and mapping.external_parent_id = course_external_id
        and mapping.sync_state in ('discovered', 'stale', 'error')
    ) then 'reconciliation'
    when exists (
      select 1 from public.external_records as mapping
      where mapping.connection_id = ready_connection_id
        and mapping.entity_type in ('assignment', 'quiz')
        and mapping.external_parent_id = course_external_id
        and mapping.sync_state in ('matched', 'synced')
    ) or exists (
      select 1 from public.moodle_assessment_status_observations as observation
      where observation.connection_id = ready_connection_id
        and observation.internal_class_group_id = class_context.group_id
        and observation.outcome = 'empty'
    ) then 'exact'
    else 'missing'
  end;

  return next;
exception
  when no_data_found then
    raise exception 'Class context does not resolve to normalized authority'
      using errcode = '42501';
end;
$$;

create function public.record_moodle_assessment_status_observation(
  p_idempotency_key text,
  p_connection_id uuid,
  p_internal_course_id uuid,
  p_internal_class_group_id uuid,
  p_external_course_record_id uuid,
  p_external_group_record_id uuid,
  p_sync_run_id uuid,
  p_sync_run_item_id uuid,
  p_outcome text,
  p_sanitized_payload jsonb,
  p_projection_hash bytea,
  p_observed_at timestamptz,
  p_fresh_until timestamptz,
  p_retain_until timestamptz,
  p_reconciliation_case_id uuid default null,
  p_reconciliation_reason text default null
)
returns table (observation_id uuid, replayed boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  calculated_request_hash bytea;
  inserted_id uuid;
  existing_observation record;
  class_context record;
  course_mapping record;
  group_mapping record;
  run_row record;
  item_row record;
  case_row record;
  payload_item jsonb;
  mapped_kind text;
  item_count integer;
begin
  if p_idempotency_key is null
    or p_idempotency_key !~ '^[a-z0-9][a-z0-9._:-]{7,127}$'
    or p_outcome not in ('available', 'empty', 'unavailable', 'reconciliation')
    or p_observed_at is null then
    raise exception 'Invalid assessment status observation metadata'
      using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.integration_connections as connection
    where connection.id = p_connection_id
      and connection.provider = 'moodle'
      and connection.mode = 'read_only'
      and connection.status = 'ready'
  ) then
    raise exception 'Observation connection is not ready read-only Moodle'
      using errcode = '42501';
  end if;

  select course_template.id as course_id, course_run.id as run_id,
    class_group.id as group_id
  into strict class_context
  from public.class_groups as class_group
  join public.course_runs as course_run
    on course_run.id = class_group.course_run_id
   and course_run.status in ('active', 'completed')
  join public.course_templates as course_template
    on course_template.id = course_run.course_template_id
   and course_template.status = 'active'
  where class_group.id = p_internal_class_group_id
    and class_group.status in ('active', 'completed');
  if class_context.course_id <> p_internal_course_id then
    raise exception 'Observation course and class context do not match'
      using errcode = '23514';
  end if;

  if p_outcome in ('available', 'empty') then
    if p_sanitized_payload is null
      or not nile_private.moodle_assessment_status_payload_is_safe(p_sanitized_payload)
      or p_projection_hash is null
      or p_projection_hash is distinct from public.digest(
        pg_catalog.convert_to(p_sanitized_payload::text, 'UTF8'), 'sha256'
      )
      or p_fresh_until is distinct from p_observed_at + interval '15 minutes'
      or p_retain_until is null or p_retain_until <= p_fresh_until
      or p_retain_until > p_observed_at + interval '30 days'
      or p_reconciliation_case_id is not null
      or p_reconciliation_reason is not null
      or (p_sanitized_payload->>'internalCourseId')::uuid <> p_internal_course_id
      or (p_sanitized_payload->>'internalClassGroupId')::uuid <> p_internal_class_group_id
      or p_sanitized_payload->>'providerState' <> p_outcome then
      raise exception 'Successful observation requires one exact safe atomic 15 minute projection'
        using errcode = '22023';
    end if;
  elsif p_sanitized_payload is not null or p_projection_hash is not null
    or p_fresh_until is not null or p_retain_until is not null then
    raise exception 'Unavailable and reconciliation outcomes cannot retain payloads'
      using errcode = '22023';
  end if;

  if p_outcome = 'reconciliation' then
    if p_reconciliation_case_id is null or p_reconciliation_reason not in (
      'missing_course_mapping', 'missing_group_mapping', 'missing_user_mapping',
      'missing_assessment_mapping', 'provider_schedule_drift', 'ambiguous_mapping'
    ) then
      raise exception 'Reconciliation requires one bounded case and reason'
        using errcode = '22023';
    end if;
  elsif p_reconciliation_case_id is not null or p_reconciliation_reason is not null then
    raise exception 'Only reconciliation outcomes can reference a case'
      using errcode = '22023';
  end if;

  if p_external_course_record_id is not null then
    select mapping.connection_id, mapping.internal_id, mapping.external_id
    into strict course_mapping
    from public.external_records as mapping
    where mapping.id = p_external_course_record_id
      and mapping.entity_type = 'course' and mapping.sync_state <> 'ignored';
    if course_mapping.connection_id <> p_connection_id
      or course_mapping.internal_id <> p_internal_course_id then
      raise exception 'Course mapping is outside the exact observation context'
        using errcode = '23514';
    end if;
  elsif p_outcome in ('available', 'empty') then
    raise exception 'Successful observation requires an exact course mapping'
      using errcode = '23514';
  end if;

  if p_external_group_record_id is not null then
    select mapping.connection_id, mapping.internal_id, mapping.external_id
    into strict group_mapping
    from public.external_records as mapping
    where mapping.id = p_external_group_record_id
      and mapping.entity_type = 'class_group' and mapping.sync_state <> 'ignored';
    if group_mapping.connection_id <> p_connection_id
      or group_mapping.internal_id <> p_internal_class_group_id then
      raise exception 'Group mapping is outside the exact observation context'
        using errcode = '23514';
    end if;
  elsif p_outcome in ('available', 'empty') then
    raise exception 'Successful observation requires an exact group mapping'
      using errcode = '23514';
  end if;

  if p_outcome = 'available' then
    item_count := 0;
    for payload_item in
      select entry.value
      from pg_catalog.jsonb_array_elements(p_sanitized_payload->'items') as entry(value)
    loop
      select mapping.entity_type into strict mapped_kind
      from public.external_records as mapping
      where mapping.id = (payload_item->>'projectionId')::uuid
        and mapping.connection_id = p_connection_id
        and mapping.entity_type in ('assignment', 'quiz')
        and mapping.external_parent_id = course_mapping.external_id
        and mapping.sync_state in ('matched', 'synced');
      if mapped_kind <> payload_item->>'kind' then
        raise exception 'Assessment projection ID kind does not match exact mapping'
          using errcode = '23514';
      end if;
      item_count := item_count + 1;
    end loop;
    if item_count <> pg_catalog.jsonb_array_length(p_sanitized_payload->'items') then
      raise exception 'Atomic assessment snapshot item count mismatch'
        using errcode = '23514';
    end if;
  end if;

  select sync_run.connection_id, sync_run.entity_type,
    sync_run.direction, sync_run.status
  into strict run_row
  from public.sync_runs as sync_run where sync_run.id = p_sync_run_id;
  select item.sync_run_id, item.external_record_id,
    item.external_id, item.status
  into strict item_row
  from public.sync_run_items as item where item.id = p_sync_run_item_id;
  if run_row.connection_id <> p_connection_id
    or run_row.entity_type <> 'assessment_status_projection'
    or run_row.direction <> 'read'
    or run_row.status not in ('succeeded', 'partial', 'failed')
    or item_row.sync_run_id <> p_sync_run_id
    or item_row.external_record_id is distinct from p_external_group_record_id
    or (p_external_group_record_id is not null
      and item_row.external_id is distinct from group_mapping.external_id)
    or (p_outcome in ('available', 'empty') and item_row.status <> 'succeeded')
    or (p_outcome = 'unavailable' and item_row.status <> 'failed')
    or (p_outcome = 'reconciliation' and item_row.status <> 'needs_review') then
    raise exception 'Observation sync evidence is outside the exact atomic read context'
      using errcode = '23514';
  end if;

  if p_outcome = 'reconciliation' then
    select reconciliation.connection_id, reconciliation.entity_type,
      reconciliation.internal_id, reconciliation.external_id,
      reconciliation.reason, reconciliation.status
    into strict case_row
    from public.reconciliation_cases as reconciliation
    where reconciliation.id = p_reconciliation_case_id;
    if case_row.connection_id <> p_connection_id
      or case_row.entity_type <> 'assessment_status_projection'
      or case_row.internal_id <> p_internal_class_group_id
      or case_row.external_id is distinct from item_row.external_id
      or case_row.reason <> p_reconciliation_reason
      or case_row.status <> 'open' then
      raise exception 'Reconciliation case is outside the exact class context'
        using errcode = '23514';
    end if;
  end if;

  calculated_request_hash := public.digest(
    pg_catalog.convert_to(pg_catalog.jsonb_build_array(
      p_connection_id::text, p_internal_course_id::text,
      p_internal_class_group_id::text, p_external_course_record_id::text,
      p_external_group_record_id::text, p_sync_run_id::text,
      p_sync_run_item_id::text, p_outcome, p_sanitized_payload,
      pg_catalog.encode(p_projection_hash, 'hex'), p_observed_at::text,
      p_fresh_until::text, p_retain_until::text,
      p_reconciliation_case_id::text, p_reconciliation_reason
    )::text, 'UTF8'), 'sha256'
  );

  insert into public.moodle_assessment_status_observations (
    idempotency_key, request_hash, connection_id, internal_course_id,
    internal_class_group_id, external_course_record_id,
    external_group_record_id, sync_run_id, sync_run_item_id,
    reconciliation_case_id, outcome, reconciliation_reason,
    sanitized_payload, projection_hash, observed_at, fresh_until,
    retain_until, purge_after
  ) values (
    p_idempotency_key, calculated_request_hash, p_connection_id,
    p_internal_course_id, p_internal_class_group_id,
    p_external_course_record_id, p_external_group_record_id,
    p_sync_run_id, p_sync_run_item_id, p_reconciliation_case_id,
    p_outcome, p_reconciliation_reason, p_sanitized_payload,
    p_projection_hash, p_observed_at, p_fresh_until, p_retain_until,
    p_observed_at + interval '30 days'
  ) on conflict (idempotency_key) do nothing returning id into inserted_id;

  if inserted_id is not null then
    return query select inserted_id, false;
    return;
  end if;
  select observation.id, observation.request_hash into strict existing_observation
  from public.moodle_assessment_status_observations as observation
  where observation.idempotency_key = p_idempotency_key;
  if existing_observation.request_hash is distinct from calculated_request_hash then
    raise exception 'Assessment status observation idempotency conflict'
      using errcode = '23505';
  end if;
  return query select existing_observation.id, true;
exception
  when no_data_found then
    raise exception 'Observation references missing or inactive exact evidence'
      using errcode = '23514';
end;
$$;

create function public.list_authorized_moodle_assessment_status_freshness(
  p_user_id uuid,
  p_active_role_grant_id uuid,
  p_connection_id uuid,
  p_internal_class_group_id uuid,
  p_as_of timestamptz
)
returns table (
  connection_id uuid,
  active_role text,
  projection_audience text,
  internal_course_id uuid,
  internal_course_run_id uuid,
  internal_class_group_id uuid,
  subject_user_id uuid,
  course_mapping_status text,
  group_mapping_status text,
  user_mapping_status text,
  assessment_mapping_status text,
  freshness_state text,
  latest_outcome text,
  reconciliation_reason text,
  sanitized_payload jsonb,
  projection_hash bytea,
  successful_sync_run_id uuid,
  successful_observed_at timestamptz,
  fresh_until timestamptz,
  retain_until timestamptz,
  latest_observed_at timestamptz,
  authority_observed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  context record;
begin
  if p_as_of is null then
    raise exception 'Freshness evaluation requires an explicit timestamp'
      using errcode = '22023';
  end if;
  select * into strict context
  from public.resolve_moodle_assessment_status_context(
    p_user_id, p_active_role_grant_id, p_internal_class_group_id
  );
  if context.connection_id <> p_connection_id then
    raise exception 'Connection is outside the live class authority context'
      using errcode = '42501';
  end if;

  return query
  select context.connection_id, context.active_role, context.projection_audience,
    context.internal_course_id, context.internal_course_run_id,
    context.internal_class_group_id, context.subject_user_id,
    context.course_mapping_status, context.group_mapping_status,
    context.user_mapping_status, context.assessment_mapping_status,
    case
      when context.course_mapping_status <> 'exact'
        or context.group_mapping_status <> 'exact'
        or context.user_mapping_status = 'missing'
        or context.assessment_mapping_status in ('missing', 'reconciliation')
        then 'reconciliation'
      when retained_success.id is not null
        and latest_observation.id = retained_success.id
        and p_as_of <= retained_success.fresh_until then 'fresh'
      when retained_success.id is not null then 'stale_retained'
      when prior_success.id is not null then 'expired'
      when latest_observation.outcome = 'reconciliation' then 'reconciliation'
      else 'unavailable'
    end,
    latest_observation.outcome, latest_observation.reconciliation_reason,
    retained_success.sanitized_payload, retained_success.projection_hash,
    retained_success.sync_run_id, retained_success.observed_at,
    retained_success.fresh_until, retained_success.retain_until,
    latest_observation.observed_at, context.observed_at
  from (select 1) as singleton
  left join lateral (
    select observation.*
    from public.moodle_assessment_status_observations as observation
    where observation.connection_id = context.connection_id
      and observation.internal_course_id = context.internal_course_id
      and observation.internal_class_group_id = context.internal_class_group_id
      and observation.observed_at <= p_as_of
    order by observation.observed_at desc, observation.id desc limit 1
  ) as latest_observation on true
  left join lateral (
    select observation.*
    from public.moodle_assessment_status_observations as observation
    where observation.connection_id = context.connection_id
      and observation.internal_course_id = context.internal_course_id
      and observation.internal_class_group_id = context.internal_class_group_id
      and observation.outcome in ('available', 'empty')
      and context.course_mapping_status = 'exact'
      and context.group_mapping_status = 'exact'
      and context.user_mapping_status <> 'missing'
      and context.assessment_mapping_status = 'exact'
      and not exists (
        select 1
        from pg_catalog.jsonb_array_elements(observation.sanitized_payload->'items') as payload_item(value)
        where not exists (
          select 1
          from public.external_records as mapping
          join public.external_records as course_mapping
            on course_mapping.connection_id = context.connection_id
           and course_mapping.entity_type = 'course'
           and course_mapping.internal_id = context.internal_course_id
           and course_mapping.sync_state <> 'ignored'
           and mapping.external_parent_id = course_mapping.external_id
          where mapping.id = (payload_item.value->>'projectionId')::uuid
            and mapping.connection_id = context.connection_id
            and mapping.entity_type = payload_item.value->>'kind'
            and mapping.sync_state in ('matched', 'synced')
        )
      )
      and observation.observed_at <= p_as_of
      and p_as_of <= observation.retain_until
    order by observation.observed_at desc, observation.id desc limit 1
  ) as retained_success on true
  left join lateral (
    select observation.id
    from public.moodle_assessment_status_observations as observation
    where observation.connection_id = context.connection_id
      and observation.internal_course_id = context.internal_course_id
      and observation.internal_class_group_id = context.internal_class_group_id
      and observation.outcome in ('available', 'empty')
      and observation.observed_at <= p_as_of
    order by observation.observed_at desc, observation.id desc limit 1
  ) as prior_success on true;
end;
$$;

create function nile_private.guard_moodle_assessment_status_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  purge_cutoff timestamptz;
begin
  if tg_op = 'DELETE'
    and pg_catalog.current_setting('nile.phase6g_purge', true) = 'bounded' then
    purge_cutoff := pg_catalog.current_setting(
      'nile.phase6g_purge_cutoff', true
    )::timestamptz;
    if old.purge_after <= purge_cutoff then
      return old;
    end if;
  end if;
  raise exception 'Moodle assessment status observations are immutable'
    using errcode = '55000';
end;
$$;

create function public.purge_moodle_assessment_status_observations(
  p_as_of timestamptz,
  p_limit integer default 500
)
returns table (deleted_count integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_as_of is null or p_limit is null or p_limit < 1 or p_limit > 1000 then
    raise exception 'Bounded purge requires a timestamp and limit from 1 through 1000'
      using errcode = '22023';
  end if;
  perform pg_catalog.set_config('nile.phase6g_purge', 'bounded', true);
  perform pg_catalog.set_config('nile.phase6g_purge_cutoff', p_as_of::text, true);
  return query
  with candidates as (
    select observation.id
    from public.moodle_assessment_status_observations as observation
    where observation.purge_after <= p_as_of
    order by observation.purge_after, observation.id
    limit p_limit
    for update
  ), deleted as (
    delete from public.moodle_assessment_status_observations as observation
    using candidates
    where observation.id = candidates.id
    returning observation.id
  )
  select pg_catalog.count(*)::integer from deleted;
end;
$$;

create trigger moodle_assessment_status_observations_immutable
before update or delete on public.moodle_assessment_status_observations
for each row execute function nile_private.guard_moodle_assessment_status_immutable();

alter table public.moodle_assessment_status_observations enable row level security;
alter table public.moodle_assessment_status_observations force row level security;

revoke all on table public.moodle_assessment_status_observations
from public, anon, authenticated, service_role;
revoke all on function nile_private.moodle_assessment_status_payload_is_safe(jsonb)
from public, anon, authenticated, service_role;
revoke all on function nile_private.guard_moodle_assessment_status_immutable()
from public, anon, authenticated, service_role;

revoke all on function public.resolve_moodle_assessment_status_context(uuid, uuid, uuid)
from public, anon, authenticated;
revoke all on function public.record_moodle_assessment_status_observation(text, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, jsonb, bytea, timestamptz, timestamptz, timestamptz, uuid, text)
from public, anon, authenticated;
revoke all on function public.list_authorized_moodle_assessment_status_freshness(uuid, uuid, uuid, uuid, timestamptz)
from public, anon, authenticated;
revoke all on function public.purge_moodle_assessment_status_observations(timestamptz, integer)
from public, anon, authenticated;

grant execute on function public.resolve_moodle_assessment_status_context(uuid, uuid, uuid)
to service_role;
grant execute on function public.record_moodle_assessment_status_observation(text, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, jsonb, bytea, timestamptz, timestamptz, timestamptz, uuid, text)
to service_role;
grant execute on function public.list_authorized_moodle_assessment_status_freshness(uuid, uuid, uuid, uuid, timestamptz)
to service_role;
grant execute on function public.purge_moodle_assessment_status_observations(timestamptz, integer)
to service_role;

commit;

-- ============================================================================
-- 15. Phase 6H1 Moodle assignment result observations
-- Source: supabase/manual/011_phase6h1_moodle_assignment_result_observation.sql
-- SHA-256: 7e44e08ae378f34be35df4495ce6f01ef8dd260bc782b36ccd3dacbb1548de08
-- ============================================================================

-- Nile Learn Phase 6H1 additive Moodle assignment result observation package.
-- Manual-only and intentionally unapplied. Stores sanitized projections only.

begin;

do $$
declare
  dependency text;
begin
  foreach dependency in array array[
    'app_users', 'role_grants', 'programs', 'course_templates', 'course_runs',
    'class_groups', 'teacher_assignments', 'student_profiles', 'enrollments',
    'class_memberships', 'integration_connections', 'external_records',
    'sync_runs', 'sync_run_items', 'reconciliation_cases',
    'moodle_assessment_status_observations'
  ] loop
    if pg_catalog.to_regclass('public.' || dependency) is null then
      raise exception 'Phase 6H1 requires public.%', dependency;
    end if;
  end loop;

  if pg_catalog.to_regprocedure(
    'public.resolve_moodle_user_projection_authority(uuid,uuid)'
  ) is null then
    raise exception 'Phase 6H1 requires the accepted Phase 6E user authority RPC';
  end if;

  if pg_catalog.to_regprocedure('nile_private.reject_immutable_change()') is null
    or pg_catalog.to_regprocedure('nile_private.jsonb_has_forbidden_keys(jsonb)') is null then
    raise exception 'Phase 6H1 requires Phase 1 safety helpers';
  end if;
end;
$$;

-- Payload contract:
-- learner/person_level: internalCourseId, internalClassGroupId,
-- assignmentProjectionId, providerState, mappingStatus, and learners[].
-- aggregate: the same root IDs/states plus learnerCount, submittedCount, and
-- gradedCount. Provider IDs and all content, files, answers, comments, feedback,
-- grader identity, and contact data are rejected by the closed key sets.
create function nile_private.moodle_assignment_result_payload_is_safe(
  payload jsonb,
  audience text
)
returns boolean
language plpgsql
immutable
strict
security invoker
set search_path = ''
as $$
declare
  root_keys text[];
  learner jsonb;
  learner_keys text[];
  timestamp_key text;
  timestamp_value timestamptz;
  score numeric;
  maximum_score numeric;
  uuid_pattern constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
begin
  if audience not in ('learner', 'person_level', 'aggregate')
    or pg_catalog.jsonb_typeof(payload) <> 'object'
    or pg_catalog.octet_length(payload::text) > 65536
    or nile_private.jsonb_has_forbidden_keys(payload) then
    return false;
  end if;

  select pg_catalog.array_agg(key order by key)
  into root_keys
  from pg_catalog.jsonb_object_keys(payload) as key;

  if audience in ('learner', 'person_level') then
    if root_keys is distinct from array[
      'assignmentProjectionId', 'internalClassGroupId', 'internalCourseId',
      'learners', 'mappingStatus', 'providerState'
    ]::text[]
      or pg_catalog.jsonb_typeof(payload->'learners') <> 'array'
      or pg_catalog.jsonb_array_length(payload->'learners') > 500 then
      return false;
    end if;
  elsif root_keys is distinct from array[
    'assignmentProjectionId', 'gradedCount', 'internalClassGroupId',
    'internalCourseId', 'learnerCount', 'mappingStatus', 'providerState',
    'submittedCount'
  ]::text[] then
    return false;
  end if;

  if (payload->>'internalCourseId') !~ uuid_pattern
    or (payload->>'internalClassGroupId') !~ uuid_pattern
    or (payload->>'assignmentProjectionId') !~ uuid_pattern
    or payload->>'providerState' not in ('available', 'empty')
    or payload->>'mappingStatus' <> 'exact' then
    return false;
  end if;

  if audience = 'aggregate' then
    if pg_catalog.jsonb_typeof(payload->'learnerCount') <> 'number'
      or pg_catalog.jsonb_typeof(payload->'submittedCount') <> 'number'
      or pg_catalog.jsonb_typeof(payload->'gradedCount') <> 'number'
      or (payload->>'learnerCount') !~ '^[0-9]{1,6}$'
      or (payload->>'submittedCount') !~ '^[0-9]{1,6}$'
      or (payload->>'gradedCount') !~ '^[0-9]{1,6}$'
      or (payload->>'submittedCount')::integer > (payload->>'learnerCount')::integer
      or (payload->>'gradedCount')::integer > (payload->>'submittedCount')::integer then
      return false;
    end if;
    return true;
  end if;

  for learner in
    select item.value
    from pg_catalog.jsonb_array_elements(payload->'learners') as item(value)
  loop
    if pg_catalog.jsonb_typeof(learner) <> 'object'
      or nile_private.jsonb_has_forbidden_keys(learner) then
      return false;
    end if;

    select pg_catalog.array_agg(key order by key)
    into learner_keys
    from pg_catalog.jsonb_object_keys(learner) as key;

    if not (learner_keys @> array[
      'attemptNumber', 'gradingState', 'internalEnrollmentId',
      'internalMembershipId', 'internalUserId', 'latest', 'submissionState'
    ]::text[])
      or not (learner_keys <@ array[
        'attemptNumber', 'gradedAt', 'gradingState', 'internalEnrollmentId',
        'internalMembershipId', 'internalUserId', 'latest', 'maximumScore',
        'modifiedAt', 'score', 'submissionState', 'submittedAt'
      ]::text[])
      or (learner->>'internalUserId') !~ uuid_pattern
      or (learner->>'internalEnrollmentId') !~ uuid_pattern
      or (learner->>'internalMembershipId') !~ uuid_pattern
      or learner->>'submissionState' not in ('not_submitted', 'draft', 'submitted', 'reopened')
      or learner->>'gradingState' not in ('not_graded', 'graded', 'released')
      or pg_catalog.jsonb_typeof(learner->'attemptNumber') <> 'number'
      or (learner->>'attemptNumber') !~ '^(0|[1-9]|1[0-9]|20)$'
      or pg_catalog.jsonb_typeof(learner->'latest') <> 'boolean' then
      return false;
    end if;

    if (learner->>'submissionState') = 'not_submitted'
      and ((learner->>'attemptNumber')::integer <> 0
        or learner->>'gradingState' <> 'not_graded'
        or learner ?| array['submittedAt', 'score', 'maximumScore', 'gradedAt']) then
      return false;
    elsif (learner->>'submissionState') <> 'not_submitted'
      and (learner->>'attemptNumber')::integer < 1 then
      return false;
    end if;

    foreach timestamp_key in array array['submittedAt', 'modifiedAt', 'gradedAt']
    loop
      if learner ? timestamp_key then
        if pg_catalog.jsonb_typeof(learner->timestamp_key) <> 'string'
          or pg_catalog.length(learner->>timestamp_key) > 40 then
          return false;
        end if;
        begin
          timestamp_value := (learner->>timestamp_key)::timestamptz;
        exception when invalid_datetime_format or datetime_field_overflow then
          return false;
        end;
      end if;
    end loop;

    if (learner ? 'score') <> (learner ? 'maximumScore') then
      return false;
    end if;
    if learner ? 'score' then
      if pg_catalog.jsonb_typeof(learner->'score') <> 'number'
        or pg_catalog.jsonb_typeof(learner->'maximumScore') <> 'number'
        or (learner->>'score') !~ '^[0-9]{1,6}(\.[0-9]{1,4})?$'
        or (learner->>'maximumScore') !~ '^[0-9]{1,6}(\.[0-9]{1,4})?$' then
        return false;
      end if;
      score := (learner->>'score')::numeric;
      maximum_score := (learner->>'maximumScore')::numeric;
      if maximum_score <= 0 or score < 0 or score > maximum_score
        or learner->>'gradingState' = 'not_graded' then
        return false;
      end if;
    end if;
    if (learner ? 'gradedAt') and learner->>'gradingState' = 'not_graded' then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

create table public.moodle_assignment_result_observations (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  request_hash bytea not null check (pg_catalog.octet_length(request_hash) = 32),
  connection_id uuid not null references public.integration_connections(id) on delete restrict,
  internal_course_id uuid not null references public.course_templates(id) on delete restrict,
  internal_class_group_id uuid not null references public.class_groups(id) on delete restrict,
  assignment_projection_id uuid not null references public.external_records(id) on delete restrict,
  subject_user_id uuid references public.app_users(id) on delete restrict,
  external_course_record_id uuid references public.external_records(id) on delete restrict,
  external_group_record_id uuid references public.external_records(id) on delete restrict,
  sync_run_id uuid not null references public.sync_runs(id) on delete restrict,
  sync_run_item_id uuid not null references public.sync_run_items(id) on delete restrict,
  reconciliation_case_id uuid references public.reconciliation_cases(id) on delete restrict,
  audience text not null check (audience in ('learner', 'person_level', 'aggregate')),
  outcome text not null check (outcome in ('available', 'empty', 'unavailable', 'reconciliation')),
  reconciliation_reason text check (
    reconciliation_reason in (
      'missing_course_mapping', 'missing_group_mapping',
      'missing_user_mapping', 'missing_assignment_mapping',
      'provider_result_drift', 'ambiguous_mapping'
    )
  ),
  sanitized_payload jsonb,
  projection_hash bytea check (
    projection_hash is null or pg_catalog.octet_length(projection_hash) = 32
  ),
  observed_at timestamptz not null,
  fresh_until timestamptz,
  retain_until timestamptz,
  purge_after timestamptz not null,
  created_at timestamptz not null default pg_catalog.now(),
  check (idempotency_key ~ '^[a-z0-9][a-z0-9._:-]{7,127}$'),
  check ((audience = 'learner') = (subject_user_id is not null)),
  check (
    sanitized_payload is null
    or nile_private.moodle_assignment_result_payload_is_safe(sanitized_payload, audience)
  ),
  check (
    (
      outcome in ('available', 'empty')
      and external_course_record_id is not null
      and external_group_record_id is not null
      and sanitized_payload is not null
      and projection_hash is not null
      and fresh_until = observed_at + interval '15 minutes'
      and retain_until > fresh_until
      and retain_until <= purge_after
      and reconciliation_case_id is null
      and reconciliation_reason is null
    ) or (
      outcome = 'unavailable'
      and sanitized_payload is null and projection_hash is null
      and fresh_until is null and retain_until is null
      and reconciliation_case_id is null and reconciliation_reason is null
    ) or (
      outcome = 'reconciliation'
      and sanitized_payload is null and projection_hash is null
      and fresh_until is null and retain_until is null
      and reconciliation_case_id is not null and reconciliation_reason is not null
    )
  ),
  check (purge_after > observed_at and purge_after <= observed_at + interval '30 days')
);

create index moodle_assignment_result_observations_scope_time_idx
  on public.moodle_assignment_result_observations (
    connection_id, internal_course_id, internal_class_group_id,
    assignment_projection_id, audience, subject_user_id,
    observed_at desc, id desc
  );
create index moodle_assignment_result_observations_retained_idx
  on public.moodle_assignment_result_observations (
    connection_id, internal_class_group_id, assignment_projection_id,
    audience, subject_user_id, retain_until desc
  ) where outcome in ('available', 'empty');
create index moodle_assignment_result_observations_purge_idx
  on public.moodle_assignment_result_observations (purge_after, id);

create function public.resolve_moodle_assignment_result_context(
  p_user_id uuid,
  p_active_role_grant_id uuid,
  p_internal_class_group_id uuid,
  p_assignment_projection_id uuid
)
returns table (
  connection_id uuid,
  active_role text,
  projection_audience text,
  internal_course_id uuid,
  internal_course_run_id uuid,
  internal_class_group_id uuid,
  assignment_projection_id uuid,
  authorized_user_ids uuid[],
  course_mapping_status text,
  group_mapping_status text,
  user_mapping_status text,
  assignment_mapping_status text,
  observed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  authority_at timestamptz := pg_catalog.now();
  user_authority record;
  effective_grant record;
  class_context record;
  ready_connection_id uuid;
  connection_count integer;
  course_external_id text;
begin
  if p_user_id is null or p_active_role_grant_id is null
    or p_internal_class_group_id is null or p_assignment_projection_id is null then
    raise exception 'Current actor, grant, class group, and assignment projection are required'
      using errcode = '42501';
  end if;

  select * into strict user_authority
  from public.resolve_moodle_user_projection_authority(
    p_user_id, p_active_role_grant_id
  );

  if user_authority.active_role not in (
    'student', 'teacher', 'headofdepartment', 'superadmin'
  ) then
    raise exception 'Role cannot read assignment result observations'
      using errcode = '42501';
  end if;

  select * into strict effective_grant
  from nile_private.resolve_effective_role_grant(
    p_user_id, p_active_role_grant_id, authority_at
  );

  select
    class_group.id as class_group_id, class_group.status as group_status,
    course_run.id as course_run_id, course_run.status as run_status,
    course_run.starts_on, course_run.ends_on, course_template.id as course_id,
    program.department_id
  into strict class_context
  from public.class_groups as class_group
  join public.course_runs as course_run
    on course_run.id = class_group.course_run_id
   and course_run.status in ('active', 'completed')
  join public.course_templates as course_template
    on course_template.id = course_run.course_template_id
   and course_template.status = 'active'
  join public.programs as program
    on program.id = course_template.program_id
   and program.status = 'active'
  where class_group.id = p_internal_class_group_id
    and class_group.status in ('active', 'completed');

  if user_authority.active_role = 'student' then
    if not exists (
      select 1
      from public.student_profiles as student_profile
      join public.enrollments as enrollment
        on enrollment.student_profile_id = student_profile.id
       and enrollment.course_run_id = class_context.course_run_id
       and enrollment.status in ('active', 'completed')
      join public.class_memberships as membership
        on membership.enrollment_id = enrollment.id
       and membership.course_run_id = class_context.course_run_id
       and membership.class_group_id = class_context.class_group_id
       and (
         (enrollment.status = 'active' and membership.status = 'active'
          and enrollment.starts_at <= authority_at
          and (enrollment.ends_at is null or enrollment.ends_at > authority_at)
          and membership.starts_at <= authority_at
          and (membership.ends_at is null or membership.ends_at > authority_at))
         or (enrollment.status = 'completed' and membership.status = 'ended')
       )
      where student_profile.user_id = p_user_id
        and student_profile.status = 'active'
    ) then
      raise exception 'Student does not own an exact active or completed class enrollment'
        using errcode = '42501';
    end if;
  end if;

  if user_authority.active_role = 'teacher' and (
    class_context.run_status <> 'active'
    or class_context.group_status <> 'active'
    or authority_at::date not between class_context.starts_on and class_context.ends_on
    or not exists (
    select 1
    from public.staff_profiles as teacher_profile
    join public.teacher_assignments as assignment
      on assignment.teacher_profile_id = teacher_profile.id
     and assignment.class_group_id = class_context.class_group_id
     and assignment.status = 'active'
     and assignment.starts_at <= authority_at
     and (assignment.ends_at is null or assignment.ends_at > authority_at)
    where teacher_profile.user_id = p_user_id
      and teacher_profile.status = 'active'
    )
  ) then
    raise exception 'Teacher is not currently assigned to the exact class'
      using errcode = '42501';
  end if;

  if user_authority.active_role = 'headofdepartment'
    and not (class_context.department_id = any(effective_grant.department_ids)) then
    raise exception 'Class is outside the active HOD department scope'
      using errcode = '42501';
  end if;

  select pg_catalog.count(*)::integer,
    (pg_catalog.array_agg(connection.id order by connection.id))[1]
  into connection_count, ready_connection_id
  from public.integration_connections as connection
  where connection.provider = 'moodle'
    and connection.mode = 'read_only'
    and connection.status = 'ready';

  if connection_count <> 1 then
    raise exception 'Assignment result projection requires exactly one ready read-only Moodle connection'
      using errcode = '42501';
  end if;

  connection_id := ready_connection_id;
  active_role := user_authority.active_role;
  projection_audience := case active_role
    when 'student' then 'learner'
    when 'teacher' then 'person_level'
    else 'aggregate'
  end;
  internal_course_id := class_context.course_id;
  internal_course_run_id := class_context.course_run_id;
  internal_class_group_id := class_context.class_group_id;
  assignment_projection_id := p_assignment_projection_id;
  observed_at := authority_at;

  if active_role = 'student' then
    authorized_user_ids := array[p_user_id]::uuid[];
  elsif active_role = 'teacher' then
    select coalesce(pg_catalog.array_agg(learner.id order by learner.id), '{}'::uuid[])
    into authorized_user_ids
    from public.class_memberships as membership
    join public.enrollments as enrollment
      on enrollment.id = membership.enrollment_id
     and enrollment.course_run_id = class_context.course_run_id
     and enrollment.status = 'active'
     and enrollment.starts_at <= authority_at
     and (enrollment.ends_at is null or enrollment.ends_at > authority_at)
    join public.student_profiles as student_profile
      on student_profile.id = enrollment.student_profile_id
     and student_profile.status = 'active'
    join public.app_users as learner
      on learner.id = student_profile.user_id and learner.status = 'active'
    where membership.class_group_id = class_context.class_group_id
      and membership.course_run_id = class_context.course_run_id
      and membership.status = 'active'
      and membership.starts_at <= authority_at
      and (membership.ends_at is null or membership.ends_at > authority_at);
  else
    authorized_user_ids := '{}'::uuid[];
  end if;

  select mapping.external_id into course_external_id
  from public.external_records as mapping
  where mapping.connection_id = ready_connection_id
    and mapping.entity_type = 'course'
    and mapping.internal_id = class_context.course_id
    and mapping.sync_state <> 'ignored';
  course_mapping_status := case when course_external_id is not null
    then 'exact' else 'missing' end;
  group_mapping_status := case when exists (
    select 1 from public.external_records as mapping
    where mapping.connection_id = ready_connection_id
      and mapping.entity_type = 'class_group'
      and mapping.internal_id = class_context.class_group_id
      and mapping.sync_state <> 'ignored'
  ) then 'exact' else 'missing' end;
  user_mapping_status := case
    when active_role = 'student' and exists (
      select 1 from public.external_records as mapping
      where mapping.connection_id = ready_connection_id
        and mapping.entity_type = 'user'
        and mapping.internal_id = p_user_id
        and mapping.sync_state <> 'ignored'
    ) then 'exact'
    when active_role = 'student' then 'missing'
    when not exists (
    select 1
    from public.class_memberships as membership
    join public.enrollments as enrollment
      on enrollment.id = membership.enrollment_id
     and enrollment.course_run_id = class_context.course_run_id
     and enrollment.status = 'active'
     and enrollment.starts_at <= authority_at
     and (enrollment.ends_at is null or enrollment.ends_at > authority_at)
    join public.student_profiles as student_profile
      on student_profile.id = enrollment.student_profile_id
     and student_profile.status = 'active'
    join public.app_users as learner
      on learner.id = student_profile.user_id and learner.status = 'active'
    left join public.external_records as mapping
      on mapping.connection_id = ready_connection_id
     and mapping.entity_type = 'user'
     and mapping.internal_id = learner.id
     and mapping.sync_state <> 'ignored'
    where (active_role <> 'teacher' or learner.id = any(authorized_user_ids))
      and membership.class_group_id = class_context.class_group_id
      and membership.course_run_id = class_context.course_run_id
      and membership.status = 'active'
      and membership.starts_at <= authority_at
      and (membership.ends_at is null or membership.ends_at > authority_at)
      and mapping.id is null
  ) then 'exact' else 'missing' end;
  assignment_mapping_status := case when course_external_id is not null and exists (
    select 1 from public.external_records as mapping
    where mapping.id = p_assignment_projection_id
      and mapping.connection_id = ready_connection_id
      and mapping.entity_type = 'assignment'
      and mapping.external_parent_id = course_external_id
      and mapping.sync_state in ('matched', 'synced')
  ) then 'exact' else 'missing' end;

  return next;
exception
  when no_data_found then
    raise exception 'Class context does not resolve to current normalized authority'
      using errcode = '42501';
end;
$$;

create function public.record_moodle_assignment_result_observation(
  p_idempotency_key text,
  p_connection_id uuid,
  p_internal_course_id uuid,
  p_internal_class_group_id uuid,
  p_assignment_projection_id uuid,
  p_external_course_record_id uuid,
  p_external_group_record_id uuid,
  p_sync_run_id uuid,
  p_sync_run_item_id uuid,
  p_audience text,
  p_outcome text,
  p_sanitized_payload jsonb,
  p_projection_hash bytea,
  p_observed_at timestamptz,
  p_fresh_until timestamptz,
  p_retain_until timestamptz,
  p_reconciliation_case_id uuid default null,
  p_reconciliation_reason text default null
)
returns table (observation_id uuid, replayed boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  calculated_request_hash bytea;
  inserted_id uuid;
  existing_observation record;
  class_context record;
  course_mapping record;
  group_mapping record;
  assignment_mapping record;
  run_row record;
  item_row record;
  case_row record;
  payload_learner jsonb;
  derived_subject_user_id uuid;
  roster_count integer;
  mapped_count integer;
begin
  if p_idempotency_key is null
    or p_idempotency_key !~ '^[a-z0-9][a-z0-9._:-]{7,127}$'
    or p_audience not in ('learner', 'person_level', 'aggregate')
    or p_outcome not in ('available', 'empty', 'unavailable', 'reconciliation')
    or (p_audience = 'learner' and p_outcome <> 'available')
    or p_observed_at is null then
    raise exception 'Invalid assignment result observation metadata'
      using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.integration_connections as connection
    where connection.id = p_connection_id
      and connection.provider = 'moodle'
      and connection.mode = 'read_only'
      and connection.status = 'ready'
  ) then
    raise exception 'Observation connection is not ready read-only Moodle'
      using errcode = '42501';
  end if;

  select course_template.id as course_id, course_run.id as run_id, class_group.id as group_id
  into strict class_context
  from public.class_groups as class_group
  join public.course_runs as course_run
    on course_run.id = class_group.course_run_id
   and course_run.status = 'active'
   and course_run.starts_on <= p_observed_at::date
   and course_run.ends_on >= p_observed_at::date
  join public.course_templates as course_template
    on course_template.id = course_run.course_template_id
   and course_template.status = 'active'
  where class_group.id = p_internal_class_group_id
    and class_group.status = 'active';

  if class_context.course_id is distinct from p_internal_course_id then
    raise exception 'Observation course and class context do not match'
      using errcode = '23514';
  end if;

  if p_outcome in ('available', 'empty') then
    if p_sanitized_payload is null
      or not nile_private.moodle_assignment_result_payload_is_safe(
        p_sanitized_payload, p_audience
      )
      or p_projection_hash is null
      or p_projection_hash is distinct from public.digest(
        pg_catalog.convert_to(p_sanitized_payload::text, 'UTF8'), 'sha256'
      )
      or p_fresh_until is distinct from p_observed_at + interval '15 minutes'
      or p_retain_until is null or p_retain_until <= p_fresh_until
      or p_retain_until > p_observed_at + interval '30 days'
      or p_reconciliation_case_id is not null
      or p_reconciliation_reason is not null
      or (p_sanitized_payload->>'internalCourseId')::uuid <> p_internal_course_id
      or (p_sanitized_payload->>'internalClassGroupId')::uuid <> p_internal_class_group_id
      or (p_sanitized_payload->>'assignmentProjectionId')::uuid <> p_assignment_projection_id
      or p_sanitized_payload->>'providerState' <> p_outcome
      or (p_outcome = 'empty' and p_sanitized_payload->>'mappingStatus' <> 'exact') then
      raise exception 'Successful observation requires an exact safe bounded projection'
        using errcode = '22023';
    end if;
  elsif p_sanitized_payload is not null or p_projection_hash is not null
    or p_fresh_until is not null or p_retain_until is not null then
    raise exception 'Unavailable and reconciliation outcomes cannot retain payloads'
      using errcode = '22023';
  end if;

  if p_outcome = 'reconciliation' then
    if p_reconciliation_case_id is null or p_reconciliation_reason not in (
      'missing_course_mapping', 'missing_group_mapping',
      'missing_user_mapping', 'missing_assignment_mapping',
      'provider_result_drift', 'ambiguous_mapping'
    ) then
      raise exception 'Reconciliation requires one bounded case and reason'
        using errcode = '22023';
    end if;
  elsif p_reconciliation_case_id is not null or p_reconciliation_reason is not null then
    raise exception 'Only reconciliation outcomes can reference a case'
      using errcode = '22023';
  end if;

  if p_external_course_record_id is not null then
    select mapping.connection_id, mapping.internal_id, mapping.external_id
    into strict course_mapping
    from public.external_records as mapping
    where mapping.id = p_external_course_record_id
      and mapping.entity_type = 'course' and mapping.sync_state <> 'ignored';
    if course_mapping.connection_id <> p_connection_id
      or course_mapping.internal_id <> p_internal_course_id then
      raise exception 'Course mapping is outside the exact observation context'
        using errcode = '23514';
    end if;
  elsif p_outcome in ('available', 'empty') then
    raise exception 'Successful observation requires an exact course mapping'
      using errcode = '23514';
  end if;

  if p_external_group_record_id is not null then
    select mapping.connection_id, mapping.internal_id, mapping.external_id
    into strict group_mapping
    from public.external_records as mapping
    where mapping.id = p_external_group_record_id
      and mapping.entity_type = 'class_group' and mapping.sync_state <> 'ignored';
    if group_mapping.connection_id <> p_connection_id
      or group_mapping.internal_id <> p_internal_class_group_id then
      raise exception 'Group mapping is outside the exact observation context'
        using errcode = '23514';
    end if;
  elsif p_outcome in ('available', 'empty') then
    raise exception 'Successful observation requires an exact group mapping'
      using errcode = '23514';
  end if;

  select mapping.connection_id, mapping.external_parent_id, mapping.external_id
  into strict assignment_mapping
  from public.external_records as mapping
  where mapping.id = p_assignment_projection_id
    and mapping.entity_type = 'assignment'
    and mapping.sync_state in ('matched', 'synced');
  if assignment_mapping.connection_id <> p_connection_id
    or assignment_mapping.external_parent_id <> course_mapping.external_id then
    raise exception 'Assignment mapping is outside the exact course context'
      using errcode = '23514';
  end if;

  if p_outcome = 'available' and p_audience in ('learner', 'person_level') then
    for payload_learner in
      select item.value from pg_catalog.jsonb_array_elements(
        p_sanitized_payload->'learners'
      ) as item(value)
    loop
      if not exists (
        select 1
        from public.class_memberships as membership
        join public.enrollments as enrollment
          on enrollment.id = membership.enrollment_id
         and enrollment.course_run_id = class_context.run_id
         and enrollment.status = 'active'
         and enrollment.starts_at <= p_observed_at
         and (enrollment.ends_at is null or enrollment.ends_at > p_observed_at)
        join public.student_profiles as student_profile
          on student_profile.id = enrollment.student_profile_id
         and student_profile.status = 'active'
        join public.app_users as learner
          on learner.id = student_profile.user_id and learner.status = 'active'
        where membership.id = (payload_learner->>'internalMembershipId')::uuid
          and enrollment.id = (payload_learner->>'internalEnrollmentId')::uuid
          and learner.id = (payload_learner->>'internalUserId')::uuid
          and membership.class_group_id = p_internal_class_group_id
          and membership.course_run_id = class_context.run_id
          and membership.status = 'active'
          and membership.starts_at <= p_observed_at
          and (membership.ends_at is null or membership.ends_at > p_observed_at)
      ) then
        raise exception 'Person-level payload contains a noncurrent learner tuple'
          using errcode = '23514';
      end if;

      if not exists (
        select 1 from public.external_records as user_mapping
        where user_mapping.connection_id = p_connection_id
          and user_mapping.entity_type = 'user'
          and user_mapping.internal_id = (payload_learner->>'internalUserId')::uuid
          and user_mapping.sync_state <> 'ignored'
      ) then
        raise exception 'Person-level result lacks an exact user mapping'
          using errcode = '23514';
      end if;
    end loop;

    select pg_catalog.count(*)::integer into roster_count
    from public.class_memberships as membership
    join public.enrollments as enrollment
      on enrollment.id = membership.enrollment_id
     and enrollment.course_run_id = class_context.run_id
     and enrollment.status = 'active'
     and enrollment.starts_at <= p_observed_at
     and (enrollment.ends_at is null or enrollment.ends_at > p_observed_at)
    join public.student_profiles as student_profile
      on student_profile.id = enrollment.student_profile_id and student_profile.status = 'active'
    join public.app_users as learner
      on learner.id = student_profile.user_id and learner.status = 'active'
    where membership.class_group_id = p_internal_class_group_id
      and membership.course_run_id = class_context.run_id
      and membership.status = 'active'
      and membership.starts_at <= p_observed_at
      and (membership.ends_at is null or membership.ends_at > p_observed_at);

    if p_audience = 'learner' then
      if pg_catalog.jsonb_array_length(p_sanitized_payload->'learners') <> 1 then
        raise exception 'Learner result must contain exactly one learner tuple'
          using errcode = '23514';
      end if;
      derived_subject_user_id := (p_sanitized_payload->'learners'->0->>'internalUserId')::uuid;
    elsif roster_count <> pg_catalog.jsonb_array_length(p_sanitized_payload->'learners')
      or roster_count <> (
        select pg_catalog.count(distinct item.value->>'internalUserId')
        from pg_catalog.jsonb_array_elements(p_sanitized_payload->'learners') as item(value)
      ) then
      raise exception 'Person-level payload is not the exact current class roster'
        using errcode = '23514';
    end if;
  elsif p_outcome = 'empty' and p_audience in ('learner', 'person_level')
    and pg_catalog.jsonb_array_length(p_sanitized_payload->'learners') <> 0 then
    raise exception 'Empty person-level projection must contain no learners'
      using errcode = '23514';
  elsif p_outcome = 'available' and p_audience = 'aggregate' then
    select pg_catalog.count(*)::integer, pg_catalog.count(user_mapping.id)::integer
    into roster_count, mapped_count
    from public.class_memberships as membership
    join public.enrollments as enrollment
      on enrollment.id = membership.enrollment_id
     and enrollment.course_run_id = class_context.run_id
     and enrollment.status = 'active'
     and enrollment.starts_at <= p_observed_at
     and (enrollment.ends_at is null or enrollment.ends_at > p_observed_at)
    join public.student_profiles as student_profile
      on student_profile.id = enrollment.student_profile_id and student_profile.status = 'active'
    join public.app_users as learner
      on learner.id = student_profile.user_id and learner.status = 'active'
    left join public.external_records as user_mapping
      on user_mapping.connection_id = p_connection_id
     and user_mapping.entity_type = 'user'
     and user_mapping.internal_id = learner.id
     and user_mapping.sync_state <> 'ignored'
    where membership.class_group_id = p_internal_class_group_id
      and membership.course_run_id = class_context.run_id
      and membership.status = 'active'
      and membership.starts_at <= p_observed_at
      and (membership.ends_at is null or membership.ends_at > p_observed_at);

    if (p_sanitized_payload->>'learnerCount')::integer <> roster_count
      or mapped_count <> roster_count
      then
      raise exception 'Aggregate counts require the exact fully mapped current class'
        using errcode = '23514';
    end if;
  elsif p_outcome = 'empty' and p_audience = 'aggregate'
    and (
      (p_sanitized_payload->>'learnerCount')::integer <> 0
      or (p_sanitized_payload->>'submittedCount')::integer <> 0
      or (p_sanitized_payload->>'gradedCount')::integer <> 0
    ) then
    raise exception 'Empty aggregate projection must contain zero counts'
      using errcode = '23514';
  end if;

  select sync_run.connection_id, sync_run.entity_type,
    sync_run.direction, sync_run.status
  into strict run_row
  from public.sync_runs as sync_run where sync_run.id = p_sync_run_id;
  select item.sync_run_id, item.external_record_id,
    item.external_id, item.status
  into strict item_row
  from public.sync_run_items as item where item.id = p_sync_run_item_id;

  if run_row.connection_id <> p_connection_id
    or run_row.entity_type <> 'assignment_results_projection'
    or run_row.direction <> 'read'
    or run_row.status not in ('succeeded', 'partial', 'failed')
    or item_row.sync_run_id <> p_sync_run_id
    or item_row.external_record_id is distinct from p_assignment_projection_id
    or item_row.external_id is distinct from assignment_mapping.external_id
    or (p_outcome in ('available', 'empty') and item_row.status <> 'succeeded')
    or (p_outcome = 'unavailable' and item_row.status <> 'failed')
    or (p_outcome = 'reconciliation' and item_row.status <> 'needs_review') then
    raise exception 'Observation sync evidence is outside the exact read context'
      using errcode = '23514';
  end if;

  if p_outcome = 'reconciliation' then
    select reconciliation.connection_id, reconciliation.entity_type,
      reconciliation.internal_id, reconciliation.external_id,
      reconciliation.reason, reconciliation.status
    into strict case_row
    from public.reconciliation_cases as reconciliation
    where reconciliation.id = p_reconciliation_case_id;
    if case_row.connection_id <> p_connection_id
      or case_row.entity_type <> 'assignment_results_projection'
      or case_row.internal_id <> p_assignment_projection_id
      or case_row.external_id is distinct from item_row.external_id
      or case_row.reason <> p_reconciliation_reason
      or case_row.status <> 'open' then
      raise exception 'Reconciliation case is outside the exact class context'
        using errcode = '23514';
    end if;
  end if;

  calculated_request_hash := public.digest(
    pg_catalog.convert_to(pg_catalog.jsonb_build_array(
      p_connection_id::text, p_internal_course_id::text,
      p_internal_class_group_id::text, p_assignment_projection_id::text,
      p_external_course_record_id::text,
      p_external_group_record_id::text, p_sync_run_id::text,
      p_sync_run_item_id::text, p_audience, p_outcome, p_sanitized_payload,
      pg_catalog.encode(p_projection_hash, 'hex'), p_observed_at::text,
      p_fresh_until::text, p_retain_until::text,
      p_reconciliation_case_id::text, p_reconciliation_reason
    )::text, 'UTF8'), 'sha256'
  );

  insert into public.moodle_assignment_result_observations (
    idempotency_key, request_hash, connection_id, internal_course_id,
    internal_class_group_id, assignment_projection_id, subject_user_id,
    external_course_record_id,
    external_group_record_id, sync_run_id, sync_run_item_id,
    reconciliation_case_id, audience, outcome, reconciliation_reason,
    sanitized_payload, projection_hash, observed_at, fresh_until, retain_until,
    purge_after
  ) values (
    p_idempotency_key, calculated_request_hash, p_connection_id,
    p_internal_course_id, p_internal_class_group_id, p_assignment_projection_id,
    derived_subject_user_id,
    p_external_course_record_id, p_external_group_record_id,
    p_sync_run_id, p_sync_run_item_id, p_reconciliation_case_id,
    p_audience, p_outcome, p_reconciliation_reason, p_sanitized_payload,
    p_projection_hash, p_observed_at, p_fresh_until, p_retain_until,
    p_observed_at + interval '30 days'
  ) on conflict (idempotency_key) do nothing returning id into inserted_id;

  if inserted_id is not null then
    return query select inserted_id, false;
    return;
  end if;

  select observation.id, observation.request_hash into strict existing_observation
  from public.moodle_assignment_result_observations as observation
  where observation.idempotency_key = p_idempotency_key;
  if existing_observation.request_hash is distinct from calculated_request_hash then
    raise exception 'Assignment result observation idempotency conflict'
      using errcode = '23505';
  end if;
  return query select existing_observation.id, true;
exception
  when no_data_found then
    raise exception 'Observation references missing or inactive exact evidence'
      using errcode = '23514';
end;
$$;

create function public.list_authorized_moodle_assignment_result_freshness(
  p_user_id uuid,
  p_active_role_grant_id uuid,
  p_connection_id uuid,
  p_internal_class_group_id uuid,
  p_assignment_projection_id uuid,
  p_as_of timestamptz
)
returns table (
  connection_id uuid,
  active_role text,
  projection_audience text,
  internal_course_id uuid,
  internal_class_group_id uuid,
  assignment_projection_id uuid,
  authorized_user_ids uuid[],
  course_mapping_status text,
  group_mapping_status text,
  user_mapping_status text,
  assignment_mapping_status text,
  freshness_state text,
  latest_outcome text,
  reconciliation_reason text,
  sanitized_payload jsonb,
  projection_hash bytea,
  successful_sync_run_id uuid,
  successful_observed_at timestamptz,
  fresh_until timestamptz,
  retain_until timestamptz,
  latest_observed_at timestamptz,
  authority_observed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  context record;
begin
  if p_as_of is null then
    raise exception 'Freshness evaluation requires an explicit timestamp'
      using errcode = '22023';
  end if;

  select * into strict context
  from public.resolve_moodle_assignment_result_context(
    p_user_id, p_active_role_grant_id, p_internal_class_group_id,
    p_assignment_projection_id
  );
  if context.connection_id <> p_connection_id then
    raise exception 'Connection is outside the live class authority context'
      using errcode = '42501';
  end if;

  return query
  select
    context.connection_id, context.active_role, context.projection_audience,
    context.internal_course_id, context.internal_class_group_id,
    context.assignment_projection_id, context.authorized_user_ids,
    context.course_mapping_status, context.group_mapping_status,
    context.user_mapping_status, context.assignment_mapping_status,
    case
      when context.course_mapping_status <> 'exact'
        or context.group_mapping_status <> 'exact'
        or context.assignment_mapping_status <> 'exact'
        or context.user_mapping_status = 'missing' then 'reconciliation'
      when retained_success.id is not null
        and latest_observation.id = retained_success.id
        and p_as_of <= retained_success.fresh_until then 'fresh'
      when retained_success.id is not null then 'stale_retained'
      when prior_success.id is not null then 'expired'
      when latest_observation.outcome = 'reconciliation' then 'reconciliation'
      else 'unavailable'
    end,
    latest_observation.outcome,
    latest_observation.reconciliation_reason,
    retained_success.sanitized_payload,
    retained_success.projection_hash,
    retained_success.sync_run_id,
    retained_success.observed_at,
    retained_success.fresh_until,
    retained_success.retain_until,
    latest_observation.observed_at,
    context.observed_at
  from (select 1) as singleton
  left join lateral (
    select observation.*
    from public.moodle_assignment_result_observations as observation
    where observation.connection_id = context.connection_id
      and observation.internal_course_id = context.internal_course_id
      and observation.internal_class_group_id = context.internal_class_group_id
      and observation.assignment_projection_id = context.assignment_projection_id
      and observation.audience = context.projection_audience
      and (context.projection_audience <> 'learner'
        or observation.subject_user_id = context.authorized_user_ids[1])
      and observation.observed_at <= p_as_of
    order by observation.observed_at desc, observation.id desc limit 1
  ) as latest_observation on true
  left join lateral (
    select observation.*
    from public.moodle_assignment_result_observations as observation
    where observation.connection_id = context.connection_id
      and observation.internal_course_id = context.internal_course_id
      and observation.internal_class_group_id = context.internal_class_group_id
      and observation.assignment_projection_id = context.assignment_projection_id
      and observation.audience = context.projection_audience
      and (context.projection_audience <> 'learner'
        or observation.subject_user_id = context.authorized_user_ids[1])
      and observation.outcome in ('available', 'empty')
      and context.course_mapping_status = 'exact'
      and context.group_mapping_status = 'exact'
      and context.user_mapping_status <> 'missing'
      and context.assignment_mapping_status = 'exact'
      and (
        context.projection_audience = 'aggregate'
        or not exists (
          select 1
          from pg_catalog.jsonb_array_elements(
            observation.sanitized_payload->'learners'
          ) as retained_learner(value)
          where not (
            (retained_learner.value->>'internalUserId')::uuid
              = any(context.authorized_user_ids)
          )
        )
      )
      and observation.observed_at <= p_as_of
      and p_as_of <= observation.retain_until
    order by observation.observed_at desc, observation.id desc limit 1
  ) as retained_success on true
  left join lateral (
    select observation.id
    from public.moodle_assignment_result_observations as observation
    where observation.connection_id = context.connection_id
      and observation.internal_course_id = context.internal_course_id
      and observation.internal_class_group_id = context.internal_class_group_id
      and observation.assignment_projection_id = context.assignment_projection_id
      and observation.audience = context.projection_audience
      and (context.projection_audience <> 'learner'
        or observation.subject_user_id = context.authorized_user_ids[1])
      and observation.outcome in ('available', 'empty')
      and observation.observed_at <= p_as_of
    order by observation.observed_at desc, observation.id desc limit 1
  ) as prior_success on true;
end;
$$;

create function nile_private.guard_moodle_assignment_result_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  purge_cutoff timestamptz;
begin
  if tg_op = 'DELETE'
    and pg_catalog.current_setting('nile.phase6h1_purge', true) = 'bounded' then
    purge_cutoff := pg_catalog.current_setting(
      'nile.phase6h1_purge_cutoff', true
    )::timestamptz;
    if old.purge_after <= purge_cutoff then
      return old;
    end if;
  end if;
  raise exception 'Moodle assignment result observations are immutable'
    using errcode = '55000';
end;
$$;

create function public.purge_moodle_assignment_result_observations(
  p_as_of timestamptz,
  p_limit integer default 500
)
returns table (deleted_count integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_as_of is null or p_limit is null or p_limit < 1 or p_limit > 1000 then
    raise exception 'Bounded purge requires a timestamp and limit from 1 through 1000'
      using errcode = '22023';
  end if;
  perform pg_catalog.set_config('nile.phase6h1_purge', 'bounded', true);
  perform pg_catalog.set_config('nile.phase6h1_purge_cutoff', p_as_of::text, true);
  return query
  with candidates as (
    select observation.id
    from public.moodle_assignment_result_observations as observation
    where observation.purge_after <= p_as_of
    order by observation.purge_after, observation.id
    limit p_limit
    for update
  ), deleted as (
    delete from public.moodle_assignment_result_observations as observation
    using candidates
    where observation.id = candidates.id
    returning observation.id
  )
  select pg_catalog.count(*)::integer from deleted;
end;
$$;

create trigger moodle_assignment_result_observations_immutable
before update or delete on public.moodle_assignment_result_observations
for each row execute function nile_private.guard_moodle_assignment_result_immutable();

alter table public.moodle_assignment_result_observations enable row level security;
alter table public.moodle_assignment_result_observations force row level security;

revoke all on table public.moodle_assignment_result_observations
from public, anon, authenticated, service_role;
revoke all on function nile_private.moodle_assignment_result_payload_is_safe(jsonb, text)
from public, anon, authenticated, service_role;
revoke all on function nile_private.guard_moodle_assignment_result_immutable()
from public, anon, authenticated, service_role;

revoke all on function public.resolve_moodle_assignment_result_context(uuid, uuid, uuid, uuid)
from public, anon, authenticated;
revoke all on function public.record_moodle_assignment_result_observation(text, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, text, jsonb, bytea, timestamptz, timestamptz, timestamptz, uuid, text)
from public, anon, authenticated;
revoke all on function public.list_authorized_moodle_assignment_result_freshness(uuid, uuid, uuid, uuid, uuid, timestamptz)
from public, anon, authenticated;
revoke all on function public.purge_moodle_assignment_result_observations(timestamptz, integer)
from public, anon, authenticated;

grant execute on function public.resolve_moodle_assignment_result_context(uuid, uuid, uuid, uuid)
to service_role;
grant execute on function public.record_moodle_assignment_result_observation(text, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, text, jsonb, bytea, timestamptz, timestamptz, timestamptz, uuid, text)
to service_role;
grant execute on function public.list_authorized_moodle_assignment_result_freshness(uuid, uuid, uuid, uuid, uuid, timestamptz)
to service_role;
grant execute on function public.purge_moodle_assignment_result_observations(timestamptz, integer)
to service_role;

commit;

-- ============================================================================
-- 16. Phase 6H2 Moodle quiz attempt observations
-- Source: supabase/manual/012_phase6h2_moodle_quiz_attempt_observation.sql
-- SHA-256: 3021e5ed4491a8e493cc0c076d65ca615428449a9330391d26d31394268c64e1
-- ============================================================================

-- Nile Learn Phase 6H2 additive Moodle quiz attempt observation package.
-- Manual-only and intentionally unapplied. Stores sanitized projections only.

begin;

do $$
declare
  dependency text;
begin
  foreach dependency in array array[
    'app_users', 'role_grants', 'programs', 'course_templates', 'course_runs',
    'class_groups', 'teacher_assignments', 'student_profiles', 'enrollments',
    'class_memberships', 'integration_connections', 'external_records',
    'sync_runs', 'sync_run_items', 'reconciliation_cases',
    'moodle_assessment_status_observations'
  ] loop
    if pg_catalog.to_regclass('public.' || dependency) is null then
      raise exception 'Phase 6H2 requires public.%', dependency;
    end if;
  end loop;

  if pg_catalog.to_regprocedure(
    'public.resolve_moodle_user_projection_authority(uuid,uuid)'
  ) is null then
    raise exception 'Phase 6H2 requires the accepted Phase 6E user authority RPC';
  end if;

  if pg_catalog.to_regprocedure('nile_private.reject_immutable_change()') is null
    or pg_catalog.to_regprocedure('nile_private.jsonb_has_forbidden_keys(jsonb)') is null then
    raise exception 'Phase 6H2 requires Phase 1 safety helpers';
  end if;
end;
$$;

-- Payload contract:
-- learner/person_level: internalCourseId, internalClassGroupId,
-- quizProjectionId, providerState, mappingStatus, and learners[].
-- aggregate: the same root IDs/states plus learnerCount, attemptedCount,
-- finishedCount, and gradedCount. Provider IDs and all question content,
-- answers, files, comments, feedback,
-- grader identity, and contact data are rejected by the closed key sets.
create function nile_private.moodle_quiz_attempt_payload_is_safe(
  payload jsonb,
  audience text
)
returns boolean
language plpgsql
immutable
strict
security invoker
set search_path = ''
as $$
declare
  root_keys text[];
  learner jsonb;
  learner_keys text[];
  timestamp_key text;
  timestamp_value timestamptz;
  score numeric;
  maximum_score numeric;
  uuid_pattern constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
begin
  if audience not in ('learner', 'person_level', 'aggregate')
    or pg_catalog.jsonb_typeof(payload) <> 'object'
    or pg_catalog.octet_length(payload::text) > 65536
    or nile_private.jsonb_has_forbidden_keys(payload) then
    return false;
  end if;

  select pg_catalog.array_agg(key order by key)
  into root_keys
  from pg_catalog.jsonb_object_keys(payload) as key;

  if audience in ('learner', 'person_level') then
    if root_keys is distinct from array[
      'internalClassGroupId', 'internalCourseId', 'learners', 'mappingStatus',
      'providerState', 'quizProjectionId'
    ]::text[]
      or pg_catalog.jsonb_typeof(payload->'learners') <> 'array'
      or pg_catalog.jsonb_array_length(payload->'learners') > 500 then
      return false;
    end if;
  elsif root_keys is distinct from array[
    'attemptedCount', 'finishedCount', 'gradedCount', 'internalClassGroupId',
    'internalCourseId', 'learnerCount', 'mappingStatus', 'providerState',
    'quizProjectionId'
  ]::text[] then
    return false;
  end if;

  if (payload->>'internalCourseId') !~ uuid_pattern
    or (payload->>'internalClassGroupId') !~ uuid_pattern
    or (payload->>'quizProjectionId') !~ uuid_pattern
    or payload->>'providerState' not in ('available', 'empty')
    or payload->>'mappingStatus' <> 'exact' then
    return false;
  end if;

  if audience = 'aggregate' then
    if pg_catalog.jsonb_typeof(payload->'learnerCount') <> 'number'
      or pg_catalog.jsonb_typeof(payload->'attemptedCount') <> 'number'
      or pg_catalog.jsonb_typeof(payload->'finishedCount') <> 'number'
      or pg_catalog.jsonb_typeof(payload->'gradedCount') <> 'number'
      or (payload->>'learnerCount') !~ '^[0-9]{1,6}$'
      or (payload->>'attemptedCount') !~ '^[0-9]{1,6}$'
      or (payload->>'finishedCount') !~ '^[0-9]{1,6}$'
      or (payload->>'gradedCount') !~ '^[0-9]{1,6}$'
      or (payload->>'attemptedCount')::integer > (payload->>'learnerCount')::integer
      or (payload->>'finishedCount')::integer > (payload->>'attemptedCount')::integer
      or (payload->>'gradedCount')::integer > (payload->>'finishedCount')::integer then
      return false;
    end if;
    return true;
  end if;

  for learner in
    select item.value
    from pg_catalog.jsonb_array_elements(payload->'learners') as item(value)
  loop
    if pg_catalog.jsonb_typeof(learner) <> 'object'
      or nile_private.jsonb_has_forbidden_keys(learner) then
      return false;
    end if;

    select pg_catalog.array_agg(key order by key)
    into learner_keys
    from pg_catalog.jsonb_object_keys(learner) as key;

    if not (learner_keys @> array[
      'attemptNumber', 'attemptState', 'gradingState', 'internalEnrollmentId',
      'internalMembershipId', 'internalUserId', 'latest', 'preview'
    ]::text[])
      or not (learner_keys <@ array[
        'attemptNumber', 'attemptProjectionId', 'attemptState', 'finishedAt',
        'gradingState', 'internalEnrollmentId', 'internalMembershipId',
        'internalUserId', 'latest', 'maximumScore', 'modifiedAt', 'preview',
        'score', 'startedAt'
      ]::text[])
      or (learner->>'internalUserId') !~ uuid_pattern
      or (learner->>'internalEnrollmentId') !~ uuid_pattern
      or (learner->>'internalMembershipId') !~ uuid_pattern
      or learner->>'attemptState' not in ('not_started', 'in_progress', 'finished', 'abandoned')
      or learner->>'gradingState' not in ('not_graded', 'graded', 'released')
      or pg_catalog.jsonb_typeof(learner->'attemptNumber') <> 'number'
      or (learner->>'attemptNumber') !~ '^(0|[1-9]|1[0-9]|20)$'
      or pg_catalog.jsonb_typeof(learner->'latest') <> 'boolean'
      or pg_catalog.jsonb_typeof(learner->'preview') <> 'boolean'
      or (learner->>'preview')::boolean then
      return false;
    end if;

    if (learner->>'attemptState') = 'not_started'
      and ((learner->>'attemptNumber')::integer <> 0
        or learner->>'gradingState' <> 'not_graded'
        or learner ?| array[
          'attemptProjectionId', 'startedAt', 'finishedAt', 'modifiedAt',
          'score', 'maximumScore'
        ]) then
      return false;
    elsif (learner->>'attemptState') <> 'not_started'
      and ((learner->>'attemptNumber')::integer < 1
        or not (learner ? 'attemptProjectionId')
        or (learner->>'attemptProjectionId') !~ uuid_pattern
        or not (learner ? 'startedAt')) then
      return false;
    elsif learner->>'attemptState' = 'finished' and not (learner ? 'finishedAt') then
      return false;
    elsif learner->>'attemptState' = 'in_progress'
      and (learner ?| array['finishedAt', 'score', 'maximumScore']
        or learner->>'gradingState' <> 'not_graded') then
      return false;
    end if;

    foreach timestamp_key in array array['startedAt', 'finishedAt', 'modifiedAt']
    loop
      if learner ? timestamp_key then
        if pg_catalog.jsonb_typeof(learner->timestamp_key) <> 'string'
          or pg_catalog.length(learner->>timestamp_key) > 40 then
          return false;
        end if;
        begin
          timestamp_value := (learner->>timestamp_key)::timestamptz;
        exception when invalid_datetime_format or datetime_field_overflow then
          return false;
        end;
      end if;
    end loop;

    if (learner ? 'score') <> (learner ? 'maximumScore') then
      return false;
    end if;
    if learner ? 'score' then
      if pg_catalog.jsonb_typeof(learner->'score') <> 'number'
        or pg_catalog.jsonb_typeof(learner->'maximumScore') <> 'number'
        or (learner->>'score') !~ '^[0-9]{1,6}(\.[0-9]{1,4})?$'
        or (learner->>'maximumScore') !~ '^[0-9]{1,6}(\.[0-9]{1,4})?$' then
        return false;
      end if;
      score := (learner->>'score')::numeric;
      maximum_score := (learner->>'maximumScore')::numeric;
      if maximum_score <= 0 or score < 0 or score > maximum_score
        or learner->>'gradingState' = 'not_graded'
        or learner->>'attemptState' <> 'finished' then
        return false;
      end if;
    end if;
    if learner->>'gradingState' <> 'not_graded' and not (learner ? 'score') then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

create table public.moodle_quiz_attempt_observations (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  request_hash bytea not null check (pg_catalog.octet_length(request_hash) = 32),
  connection_id uuid not null references public.integration_connections(id) on delete restrict,
  internal_course_id uuid not null references public.course_templates(id) on delete restrict,
  internal_class_group_id uuid not null references public.class_groups(id) on delete restrict,
  quiz_projection_id uuid not null references public.external_records(id) on delete restrict,
  subject_user_id uuid references public.app_users(id) on delete restrict,
  external_course_record_id uuid references public.external_records(id) on delete restrict,
  external_group_record_id uuid references public.external_records(id) on delete restrict,
  sync_run_id uuid not null references public.sync_runs(id) on delete restrict,
  sync_run_item_id uuid not null references public.sync_run_items(id) on delete restrict,
  reconciliation_case_id uuid references public.reconciliation_cases(id) on delete restrict,
  audience text not null check (audience in ('learner', 'person_level', 'aggregate')),
  outcome text not null check (outcome in ('available', 'empty', 'unavailable', 'reconciliation')),
  reconciliation_reason text check (
    reconciliation_reason in (
      'missing_course_mapping', 'missing_group_mapping',
      'missing_user_mapping', 'missing_quiz_mapping',
      'provider_result_drift', 'ambiguous_mapping'
    )
  ),
  sanitized_payload jsonb,
  projection_hash bytea check (
    projection_hash is null or pg_catalog.octet_length(projection_hash) = 32
  ),
  observed_at timestamptz not null,
  fresh_until timestamptz,
  retain_until timestamptz,
  purge_after timestamptz not null,
  created_at timestamptz not null default pg_catalog.now(),
  check (idempotency_key ~ '^[a-z0-9][a-z0-9._:-]{7,127}$'),
  check ((audience = 'learner') = (subject_user_id is not null)),
  check (
    sanitized_payload is null
    or nile_private.moodle_quiz_attempt_payload_is_safe(sanitized_payload, audience)
  ),
  check (
    (
      outcome in ('available', 'empty')
      and external_course_record_id is not null
      and external_group_record_id is not null
      and sanitized_payload is not null
      and projection_hash is not null
      and fresh_until = observed_at + interval '15 minutes'
      and retain_until > fresh_until
      and retain_until <= purge_after
      and reconciliation_case_id is null
      and reconciliation_reason is null
    ) or (
      outcome = 'unavailable'
      and sanitized_payload is null and projection_hash is null
      and fresh_until is null and retain_until is null
      and reconciliation_case_id is null and reconciliation_reason is null
    ) or (
      outcome = 'reconciliation'
      and sanitized_payload is null and projection_hash is null
      and fresh_until is null and retain_until is null
      and reconciliation_case_id is not null and reconciliation_reason is not null
    )
  ),
  check (purge_after > observed_at and purge_after <= observed_at + interval '30 days')
);

create index moodle_quiz_attempt_observations_scope_time_idx
  on public.moodle_quiz_attempt_observations (
    connection_id, internal_course_id, internal_class_group_id,
    quiz_projection_id, audience, subject_user_id,
    observed_at desc, id desc
  );
create index moodle_quiz_attempt_observations_retained_idx
  on public.moodle_quiz_attempt_observations (
    connection_id, internal_class_group_id, quiz_projection_id,
    audience, subject_user_id, retain_until desc
  ) where outcome in ('available', 'empty');
create index moodle_quiz_attempt_observations_purge_idx
  on public.moodle_quiz_attempt_observations (purge_after, id);

create function public.resolve_moodle_quiz_attempt_context(
  p_user_id uuid,
  p_active_role_grant_id uuid,
  p_internal_class_group_id uuid,
  p_quiz_projection_id uuid
)
returns table (
  connection_id uuid,
  active_role text,
  projection_audience text,
  internal_course_id uuid,
  internal_course_run_id uuid,
  internal_class_group_id uuid,
  quiz_projection_id uuid,
  authorized_user_ids uuid[],
  course_mapping_status text,
  group_mapping_status text,
  user_mapping_status text,
  quiz_mapping_status text,
  observed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  authority_at timestamptz := pg_catalog.now();
  user_authority record;
  effective_grant record;
  class_context record;
  ready_connection_id uuid;
  connection_count integer;
  course_external_id text;
begin
  if p_user_id is null or p_active_role_grant_id is null
    or p_internal_class_group_id is null or p_quiz_projection_id is null then
    raise exception 'Current actor, grant, class group, and quiz projection are required'
      using errcode = '42501';
  end if;

  select * into strict user_authority
  from public.resolve_moodle_user_projection_authority(
    p_user_id, p_active_role_grant_id
  );

  if user_authority.active_role not in (
    'student', 'teacher', 'headofdepartment', 'superadmin'
  ) then
    raise exception 'Role cannot read quiz attempt observations'
      using errcode = '42501';
  end if;

  select * into strict effective_grant
  from nile_private.resolve_effective_role_grant(
    p_user_id, p_active_role_grant_id, authority_at
  );

  select
    class_group.id as class_group_id, class_group.status as group_status,
    course_run.id as course_run_id, course_run.status as run_status,
    course_run.starts_on, course_run.ends_on, course_template.id as course_id,
    program.department_id
  into strict class_context
  from public.class_groups as class_group
  join public.course_runs as course_run
    on course_run.id = class_group.course_run_id
   and course_run.status in ('active', 'completed')
  join public.course_templates as course_template
    on course_template.id = course_run.course_template_id
   and course_template.status = 'active'
  join public.programs as program
    on program.id = course_template.program_id
   and program.status = 'active'
  where class_group.id = p_internal_class_group_id
    and class_group.status in ('active', 'completed');

  if user_authority.active_role = 'student' then
    if not exists (
      select 1
      from public.student_profiles as student_profile
      join public.enrollments as enrollment
        on enrollment.student_profile_id = student_profile.id
       and enrollment.course_run_id = class_context.course_run_id
       and enrollment.status in ('active', 'completed')
      join public.class_memberships as membership
        on membership.enrollment_id = enrollment.id
       and membership.course_run_id = class_context.course_run_id
       and membership.class_group_id = class_context.class_group_id
       and (
         (enrollment.status = 'active' and membership.status = 'active'
          and enrollment.starts_at <= authority_at
          and (enrollment.ends_at is null or enrollment.ends_at > authority_at)
          and membership.starts_at <= authority_at
          and (membership.ends_at is null or membership.ends_at > authority_at))
         or (enrollment.status = 'completed' and membership.status = 'ended')
       )
      where student_profile.user_id = p_user_id
        and student_profile.status = 'active'
    ) then
      raise exception 'Student does not own an exact active or completed class enrollment'
        using errcode = '42501';
    end if;
  end if;

  if user_authority.active_role = 'teacher' and (
    class_context.run_status <> 'active'
    or class_context.group_status <> 'active'
    or authority_at::date not between class_context.starts_on and class_context.ends_on
    or not exists (
    select 1
    from public.staff_profiles as teacher_profile
    join public.teacher_assignments as assignment
      on assignment.teacher_profile_id = teacher_profile.id
     and assignment.class_group_id = class_context.class_group_id
     and assignment.status = 'active'
     and assignment.starts_at <= authority_at
     and (assignment.ends_at is null or assignment.ends_at > authority_at)
    where teacher_profile.user_id = p_user_id
      and teacher_profile.status = 'active'
    )
  ) then
    raise exception 'Teacher is not currently assigned to the exact class'
      using errcode = '42501';
  end if;

  if user_authority.active_role = 'headofdepartment'
    and not (class_context.department_id = any(effective_grant.department_ids)) then
    raise exception 'Class is outside the active HOD department scope'
      using errcode = '42501';
  end if;

  select pg_catalog.count(*)::integer,
    (pg_catalog.array_agg(connection.id order by connection.id))[1]
  into connection_count, ready_connection_id
  from public.integration_connections as connection
  where connection.provider = 'moodle'
    and connection.mode = 'read_only'
    and connection.status = 'ready';

  if connection_count <> 1 then
    raise exception 'Quiz attempt projection requires exactly one ready read-only Moodle connection'
      using errcode = '42501';
  end if;

  connection_id := ready_connection_id;
  active_role := user_authority.active_role;
  projection_audience := case active_role
    when 'student' then 'learner'
    when 'teacher' then 'person_level'
    else 'aggregate'
  end;
  internal_course_id := class_context.course_id;
  internal_course_run_id := class_context.course_run_id;
  internal_class_group_id := class_context.class_group_id;
  quiz_projection_id := p_quiz_projection_id;
  observed_at := authority_at;

  if active_role = 'student' then
    authorized_user_ids := array[p_user_id]::uuid[];
  elsif active_role = 'teacher' then
    select coalesce(pg_catalog.array_agg(learner.id order by learner.id), '{}'::uuid[])
    into authorized_user_ids
    from public.class_memberships as membership
    join public.enrollments as enrollment
      on enrollment.id = membership.enrollment_id
     and enrollment.course_run_id = class_context.course_run_id
     and enrollment.status = 'active'
     and enrollment.starts_at <= authority_at
     and (enrollment.ends_at is null or enrollment.ends_at > authority_at)
    join public.student_profiles as student_profile
      on student_profile.id = enrollment.student_profile_id
     and student_profile.status = 'active'
    join public.app_users as learner
      on learner.id = student_profile.user_id and learner.status = 'active'
    where membership.class_group_id = class_context.class_group_id
      and membership.course_run_id = class_context.course_run_id
      and membership.status = 'active'
      and membership.starts_at <= authority_at
      and (membership.ends_at is null or membership.ends_at > authority_at);
  else
    authorized_user_ids := '{}'::uuid[];
  end if;

  select mapping.external_id into course_external_id
  from public.external_records as mapping
  where mapping.connection_id = ready_connection_id
    and mapping.entity_type = 'course'
    and mapping.internal_id = class_context.course_id
    and mapping.sync_state <> 'ignored';
  course_mapping_status := case when course_external_id is not null
    then 'exact' else 'missing' end;
  group_mapping_status := case when exists (
    select 1 from public.external_records as mapping
    where mapping.connection_id = ready_connection_id
      and mapping.entity_type = 'class_group'
      and mapping.internal_id = class_context.class_group_id
      and mapping.sync_state <> 'ignored'
  ) then 'exact' else 'missing' end;
  user_mapping_status := case
    when active_role = 'student' and exists (
      select 1 from public.external_records as mapping
      where mapping.connection_id = ready_connection_id
        and mapping.entity_type = 'user'
        and mapping.internal_id = p_user_id
        and mapping.sync_state <> 'ignored'
    ) then 'exact'
    when active_role = 'student' then 'missing'
    when not exists (
    select 1
    from public.class_memberships as membership
    join public.enrollments as enrollment
      on enrollment.id = membership.enrollment_id
     and enrollment.course_run_id = class_context.course_run_id
     and enrollment.status = 'active'
     and enrollment.starts_at <= authority_at
     and (enrollment.ends_at is null or enrollment.ends_at > authority_at)
    join public.student_profiles as student_profile
      on student_profile.id = enrollment.student_profile_id
     and student_profile.status = 'active'
    join public.app_users as learner
      on learner.id = student_profile.user_id and learner.status = 'active'
    left join public.external_records as mapping
      on mapping.connection_id = ready_connection_id
     and mapping.entity_type = 'user'
     and mapping.internal_id = learner.id
     and mapping.sync_state <> 'ignored'
    where (active_role <> 'teacher' or learner.id = any(authorized_user_ids))
      and membership.class_group_id = class_context.class_group_id
      and membership.course_run_id = class_context.course_run_id
      and membership.status = 'active'
      and membership.starts_at <= authority_at
      and (membership.ends_at is null or membership.ends_at > authority_at)
      and mapping.id is null
  ) then 'exact' else 'missing' end;
  quiz_mapping_status := case when course_external_id is not null and exists (
    select 1 from public.external_records as mapping
    where mapping.id = p_quiz_projection_id
      and mapping.connection_id = ready_connection_id
      and mapping.entity_type = 'quiz'
      and mapping.external_parent_id = course_external_id
      and mapping.sync_state in ('matched', 'synced')
  ) then 'exact' else 'missing' end;

  return next;
exception
  when no_data_found then
    raise exception 'Class context does not resolve to current normalized authority'
      using errcode = '42501';
end;
$$;

create function public.record_moodle_quiz_attempt_observation(
  p_idempotency_key text,
  p_connection_id uuid,
  p_internal_course_id uuid,
  p_internal_class_group_id uuid,
  p_quiz_projection_id uuid,
  p_external_course_record_id uuid,
  p_external_group_record_id uuid,
  p_sync_run_id uuid,
  p_sync_run_item_id uuid,
  p_audience text,
  p_outcome text,
  p_sanitized_payload jsonb,
  p_projection_hash bytea,
  p_observed_at timestamptz,
  p_fresh_until timestamptz,
  p_retain_until timestamptz,
  p_reconciliation_case_id uuid default null,
  p_reconciliation_reason text default null
)
returns table (observation_id uuid, replayed boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  calculated_request_hash bytea;
  inserted_id uuid;
  existing_observation record;
  class_context record;
  course_mapping record;
  group_mapping record;
  quiz_mapping record;
  run_row record;
  item_row record;
  case_row record;
  payload_learner jsonb;
  derived_subject_user_id uuid;
  roster_count integer;
  mapped_count integer;
begin
  if p_idempotency_key is null
    or p_idempotency_key !~ '^[a-z0-9][a-z0-9._:-]{7,127}$'
    or p_audience not in ('learner', 'person_level', 'aggregate')
    or p_outcome not in ('available', 'empty', 'unavailable', 'reconciliation')
    or (p_audience = 'learner' and p_outcome <> 'available')
    or p_observed_at is null then
    raise exception 'Invalid quiz attempt observation metadata'
      using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.integration_connections as connection
    where connection.id = p_connection_id
      and connection.provider = 'moodle'
      and connection.mode = 'read_only'
      and connection.status = 'ready'
  ) then
    raise exception 'Observation connection is not ready read-only Moodle'
      using errcode = '42501';
  end if;

  select course_template.id as course_id, course_run.id as run_id, class_group.id as group_id
  into strict class_context
  from public.class_groups as class_group
  join public.course_runs as course_run
    on course_run.id = class_group.course_run_id
   and course_run.status = 'active'
   and course_run.starts_on <= p_observed_at::date
   and course_run.ends_on >= p_observed_at::date
  join public.course_templates as course_template
    on course_template.id = course_run.course_template_id
   and course_template.status = 'active'
  where class_group.id = p_internal_class_group_id
    and class_group.status = 'active';

  if class_context.course_id is distinct from p_internal_course_id then
    raise exception 'Observation course and class context do not match'
      using errcode = '23514';
  end if;

  if p_outcome in ('available', 'empty') then
    if p_sanitized_payload is null
      or not nile_private.moodle_quiz_attempt_payload_is_safe(
        p_sanitized_payload, p_audience
      )
      or p_projection_hash is null
      or p_projection_hash is distinct from public.digest(
        pg_catalog.convert_to(p_sanitized_payload::text, 'UTF8'), 'sha256'
      )
      or p_fresh_until is distinct from p_observed_at + interval '15 minutes'
      or p_retain_until is null or p_retain_until <= p_fresh_until
      or p_retain_until > p_observed_at + interval '30 days'
      or p_reconciliation_case_id is not null
      or p_reconciliation_reason is not null
      or (p_sanitized_payload->>'internalCourseId')::uuid <> p_internal_course_id
      or (p_sanitized_payload->>'internalClassGroupId')::uuid <> p_internal_class_group_id
      or (p_sanitized_payload->>'quizProjectionId')::uuid <> p_quiz_projection_id
      or p_sanitized_payload->>'providerState' <> p_outcome
      or (p_outcome = 'empty' and p_sanitized_payload->>'mappingStatus' <> 'exact') then
      raise exception 'Successful observation requires an exact safe bounded projection'
        using errcode = '22023';
    end if;
  elsif p_sanitized_payload is not null or p_projection_hash is not null
    or p_fresh_until is not null or p_retain_until is not null then
    raise exception 'Unavailable and reconciliation outcomes cannot retain payloads'
      using errcode = '22023';
  end if;

  if p_outcome = 'reconciliation' then
    if p_reconciliation_case_id is null or p_reconciliation_reason not in (
      'missing_course_mapping', 'missing_group_mapping',
      'missing_user_mapping', 'missing_quiz_mapping',
      'provider_result_drift', 'ambiguous_mapping'
    ) then
      raise exception 'Reconciliation requires one bounded case and reason'
        using errcode = '22023';
    end if;
  elsif p_reconciliation_case_id is not null or p_reconciliation_reason is not null then
    raise exception 'Only reconciliation outcomes can reference a case'
      using errcode = '22023';
  end if;

  if p_external_course_record_id is not null then
    select mapping.connection_id, mapping.internal_id, mapping.external_id
    into strict course_mapping
    from public.external_records as mapping
    where mapping.id = p_external_course_record_id
      and mapping.entity_type = 'course' and mapping.sync_state <> 'ignored';
    if course_mapping.connection_id <> p_connection_id
      or course_mapping.internal_id <> p_internal_course_id then
      raise exception 'Course mapping is outside the exact observation context'
        using errcode = '23514';
    end if;
  elsif p_outcome in ('available', 'empty') then
    raise exception 'Successful observation requires an exact course mapping'
      using errcode = '23514';
  end if;

  if p_external_group_record_id is not null then
    select mapping.connection_id, mapping.internal_id, mapping.external_id
    into strict group_mapping
    from public.external_records as mapping
    where mapping.id = p_external_group_record_id
      and mapping.entity_type = 'class_group' and mapping.sync_state <> 'ignored';
    if group_mapping.connection_id <> p_connection_id
      or group_mapping.internal_id <> p_internal_class_group_id then
      raise exception 'Group mapping is outside the exact observation context'
        using errcode = '23514';
    end if;
  elsif p_outcome in ('available', 'empty') then
    raise exception 'Successful observation requires an exact group mapping'
      using errcode = '23514';
  end if;

  select mapping.connection_id, mapping.external_parent_id, mapping.external_id
  into strict quiz_mapping
  from public.external_records as mapping
  where mapping.id = p_quiz_projection_id
    and mapping.entity_type = 'quiz'
    and mapping.sync_state in ('matched', 'synced');
  if quiz_mapping.connection_id <> p_connection_id
    or quiz_mapping.external_parent_id <> course_mapping.external_id then
    raise exception 'Quiz mapping is outside the exact course context'
      using errcode = '23514';
  end if;

  if p_outcome = 'available' and p_audience in ('learner', 'person_level') then
    for payload_learner in
      select item.value from pg_catalog.jsonb_array_elements(
        p_sanitized_payload->'learners'
      ) as item(value)
    loop
      if not exists (
        select 1
        from public.class_memberships as membership
        join public.enrollments as enrollment
          on enrollment.id = membership.enrollment_id
         and enrollment.course_run_id = class_context.run_id
         and enrollment.status = 'active'
         and enrollment.starts_at <= p_observed_at
         and (enrollment.ends_at is null or enrollment.ends_at > p_observed_at)
        join public.student_profiles as student_profile
          on student_profile.id = enrollment.student_profile_id
         and student_profile.status = 'active'
        join public.app_users as learner
          on learner.id = student_profile.user_id and learner.status = 'active'
        where membership.id = (payload_learner->>'internalMembershipId')::uuid
          and enrollment.id = (payload_learner->>'internalEnrollmentId')::uuid
          and learner.id = (payload_learner->>'internalUserId')::uuid
          and membership.class_group_id = p_internal_class_group_id
          and membership.course_run_id = class_context.run_id
          and membership.status = 'active'
          and membership.starts_at <= p_observed_at
          and (membership.ends_at is null or membership.ends_at > p_observed_at)
      ) then
        raise exception 'Person-level payload contains a noncurrent learner tuple'
          using errcode = '23514';
      end if;

      if not exists (
        select 1 from public.external_records as user_mapping
        where user_mapping.connection_id = p_connection_id
          and user_mapping.entity_type = 'user'
          and user_mapping.internal_id = (payload_learner->>'internalUserId')::uuid
          and user_mapping.sync_state <> 'ignored'
      ) then
        raise exception 'Person-level result lacks an exact user mapping'
          using errcode = '23514';
      end if;

      if payload_learner->>'attemptState' <> 'not_started' and not exists (
        select 1
        from public.external_records as attempt_mapping
        where attempt_mapping.id = (payload_learner->>'attemptProjectionId')::uuid
          and attempt_mapping.connection_id = p_connection_id
          and attempt_mapping.entity_type = 'quiz_attempt'
          and attempt_mapping.external_parent_id = quiz_mapping.external_id
          and attempt_mapping.sync_state in ('matched', 'synced')
      ) then
        raise exception 'Quiz result lacks an exact attempt mapping'
          using errcode = '23514';
      end if;
    end loop;

    select pg_catalog.count(*)::integer into roster_count
    from public.class_memberships as membership
    join public.enrollments as enrollment
      on enrollment.id = membership.enrollment_id
     and enrollment.course_run_id = class_context.run_id
     and enrollment.status = 'active'
     and enrollment.starts_at <= p_observed_at
     and (enrollment.ends_at is null or enrollment.ends_at > p_observed_at)
    join public.student_profiles as student_profile
      on student_profile.id = enrollment.student_profile_id and student_profile.status = 'active'
    join public.app_users as learner
      on learner.id = student_profile.user_id and learner.status = 'active'
    where membership.class_group_id = p_internal_class_group_id
      and membership.course_run_id = class_context.run_id
      and membership.status = 'active'
      and membership.starts_at <= p_observed_at
      and (membership.ends_at is null or membership.ends_at > p_observed_at);

    if p_audience = 'learner' then
      if pg_catalog.jsonb_array_length(p_sanitized_payload->'learners') <> 1 then
        raise exception 'Learner result must contain exactly one learner tuple'
          using errcode = '23514';
      end if;
      derived_subject_user_id := (p_sanitized_payload->'learners'->0->>'internalUserId')::uuid;
    elsif roster_count <> pg_catalog.jsonb_array_length(p_sanitized_payload->'learners')
      or roster_count <> (
        select pg_catalog.count(distinct item.value->>'internalUserId')
        from pg_catalog.jsonb_array_elements(p_sanitized_payload->'learners') as item(value)
      ) then
      raise exception 'Person-level payload is not the exact current class roster'
        using errcode = '23514';
    end if;

    if (
      select pg_catalog.count(item.value->>'attemptProjectionId')
      from pg_catalog.jsonb_array_elements(p_sanitized_payload->'learners') as item(value)
      where item.value ? 'attemptProjectionId'
    ) <> (
      select pg_catalog.count(distinct item.value->>'attemptProjectionId')
      from pg_catalog.jsonb_array_elements(p_sanitized_payload->'learners') as item(value)
      where item.value ? 'attemptProjectionId'
    ) then
      raise exception 'Quiz attempt mappings must be unique per projection'
        using errcode = '23514';
    end if;
  elsif p_outcome = 'empty' and p_audience in ('learner', 'person_level')
    and pg_catalog.jsonb_array_length(p_sanitized_payload->'learners') <> 0 then
    raise exception 'Empty person-level projection must contain no learners'
      using errcode = '23514';
  elsif p_outcome = 'available' and p_audience = 'aggregate' then
    select pg_catalog.count(*)::integer, pg_catalog.count(user_mapping.id)::integer
    into roster_count, mapped_count
    from public.class_memberships as membership
    join public.enrollments as enrollment
      on enrollment.id = membership.enrollment_id
     and enrollment.course_run_id = class_context.run_id
     and enrollment.status = 'active'
     and enrollment.starts_at <= p_observed_at
     and (enrollment.ends_at is null or enrollment.ends_at > p_observed_at)
    join public.student_profiles as student_profile
      on student_profile.id = enrollment.student_profile_id and student_profile.status = 'active'
    join public.app_users as learner
      on learner.id = student_profile.user_id and learner.status = 'active'
    left join public.external_records as user_mapping
      on user_mapping.connection_id = p_connection_id
     and user_mapping.entity_type = 'user'
     and user_mapping.internal_id = learner.id
     and user_mapping.sync_state <> 'ignored'
    where membership.class_group_id = p_internal_class_group_id
      and membership.course_run_id = class_context.run_id
      and membership.status = 'active'
      and membership.starts_at <= p_observed_at
      and (membership.ends_at is null or membership.ends_at > p_observed_at);

    if (p_sanitized_payload->>'learnerCount')::integer <> roster_count
      or mapped_count <> roster_count
      then
      raise exception 'Aggregate counts require the exact fully mapped current class'
        using errcode = '23514';
    end if;
  elsif p_outcome = 'empty' and p_audience = 'aggregate'
    and (
      (p_sanitized_payload->>'learnerCount')::integer <> 0
      or (p_sanitized_payload->>'attemptedCount')::integer <> 0
      or (p_sanitized_payload->>'finishedCount')::integer <> 0
      or (p_sanitized_payload->>'gradedCount')::integer <> 0
    ) then
    raise exception 'Empty aggregate projection must contain zero counts'
      using errcode = '23514';
  end if;

  select sync_run.connection_id, sync_run.entity_type,
    sync_run.direction, sync_run.status
  into strict run_row
  from public.sync_runs as sync_run where sync_run.id = p_sync_run_id;
  select item.sync_run_id, item.external_record_id,
    item.external_id, item.status
  into strict item_row
  from public.sync_run_items as item where item.id = p_sync_run_item_id;

  if run_row.connection_id <> p_connection_id
    or run_row.entity_type <> 'quiz_attempts_projection'
    or run_row.direction <> 'read'
    or run_row.status not in ('succeeded', 'partial', 'failed')
    or item_row.sync_run_id <> p_sync_run_id
    or item_row.external_record_id is distinct from p_quiz_projection_id
    or item_row.external_id is distinct from quiz_mapping.external_id
    or (p_outcome in ('available', 'empty') and item_row.status <> 'succeeded')
    or (p_outcome = 'unavailable' and item_row.status <> 'failed')
    or (p_outcome = 'reconciliation' and item_row.status <> 'needs_review') then
    raise exception 'Observation sync evidence is outside the exact read context'
      using errcode = '23514';
  end if;

  if p_outcome = 'reconciliation' then
    select reconciliation.connection_id, reconciliation.entity_type,
      reconciliation.internal_id, reconciliation.external_id,
      reconciliation.reason, reconciliation.status
    into strict case_row
    from public.reconciliation_cases as reconciliation
    where reconciliation.id = p_reconciliation_case_id;
    if case_row.connection_id <> p_connection_id
      or case_row.entity_type <> 'quiz_attempts_projection'
      or case_row.internal_id <> p_quiz_projection_id
      or case_row.external_id is distinct from item_row.external_id
      or case_row.reason <> p_reconciliation_reason
      or case_row.status <> 'open' then
      raise exception 'Reconciliation case is outside the exact class context'
        using errcode = '23514';
    end if;
  end if;

  calculated_request_hash := public.digest(
    pg_catalog.convert_to(pg_catalog.jsonb_build_array(
      p_connection_id::text, p_internal_course_id::text,
      p_internal_class_group_id::text, p_quiz_projection_id::text,
      p_external_course_record_id::text,
      p_external_group_record_id::text, p_sync_run_id::text,
      p_sync_run_item_id::text, p_audience, p_outcome, p_sanitized_payload,
      pg_catalog.encode(p_projection_hash, 'hex'), p_observed_at::text,
      p_fresh_until::text, p_retain_until::text,
      p_reconciliation_case_id::text, p_reconciliation_reason
    )::text, 'UTF8'), 'sha256'
  );

  insert into public.moodle_quiz_attempt_observations (
    idempotency_key, request_hash, connection_id, internal_course_id,
    internal_class_group_id, quiz_projection_id, subject_user_id,
    external_course_record_id,
    external_group_record_id, sync_run_id, sync_run_item_id,
    reconciliation_case_id, audience, outcome, reconciliation_reason,
    sanitized_payload, projection_hash, observed_at, fresh_until, retain_until,
    purge_after
  ) values (
    p_idempotency_key, calculated_request_hash, p_connection_id,
    p_internal_course_id, p_internal_class_group_id, p_quiz_projection_id,
    derived_subject_user_id,
    p_external_course_record_id, p_external_group_record_id,
    p_sync_run_id, p_sync_run_item_id, p_reconciliation_case_id,
    p_audience, p_outcome, p_reconciliation_reason, p_sanitized_payload,
    p_projection_hash, p_observed_at, p_fresh_until, p_retain_until,
    p_observed_at + interval '30 days'
  ) on conflict (idempotency_key) do nothing returning id into inserted_id;

  if inserted_id is not null then
    return query select inserted_id, false;
    return;
  end if;

  select observation.id, observation.request_hash into strict existing_observation
  from public.moodle_quiz_attempt_observations as observation
  where observation.idempotency_key = p_idempotency_key;
  if existing_observation.request_hash is distinct from calculated_request_hash then
    raise exception 'Quiz attempt observation idempotency conflict'
      using errcode = '23505';
  end if;
  return query select existing_observation.id, true;
exception
  when no_data_found then
    raise exception 'Observation references missing or inactive exact evidence'
      using errcode = '23514';
end;
$$;

create function public.list_authorized_moodle_quiz_attempt_freshness(
  p_user_id uuid,
  p_active_role_grant_id uuid,
  p_connection_id uuid,
  p_internal_class_group_id uuid,
  p_quiz_projection_id uuid,
  p_as_of timestamptz
)
returns table (
  connection_id uuid,
  active_role text,
  projection_audience text,
  internal_course_id uuid,
  internal_class_group_id uuid,
  quiz_projection_id uuid,
  authorized_user_ids uuid[],
  course_mapping_status text,
  group_mapping_status text,
  user_mapping_status text,
  quiz_mapping_status text,
  freshness_state text,
  latest_outcome text,
  reconciliation_reason text,
  sanitized_payload jsonb,
  projection_hash bytea,
  successful_sync_run_id uuid,
  successful_observed_at timestamptz,
  fresh_until timestamptz,
  retain_until timestamptz,
  latest_observed_at timestamptz,
  authority_observed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  context record;
begin
  if p_as_of is null then
    raise exception 'Freshness evaluation requires an explicit timestamp'
      using errcode = '22023';
  end if;

  select * into strict context
  from public.resolve_moodle_quiz_attempt_context(
    p_user_id, p_active_role_grant_id, p_internal_class_group_id,
    p_quiz_projection_id
  );
  if context.connection_id <> p_connection_id then
    raise exception 'Connection is outside the live class authority context'
      using errcode = '42501';
  end if;

  return query
  select
    context.connection_id, context.active_role, context.projection_audience,
    context.internal_course_id, context.internal_class_group_id,
    context.quiz_projection_id, context.authorized_user_ids,
    context.course_mapping_status, context.group_mapping_status,
    context.user_mapping_status, context.quiz_mapping_status,
    case
      when context.course_mapping_status <> 'exact'
        or context.group_mapping_status <> 'exact'
        or context.quiz_mapping_status <> 'exact'
        or context.user_mapping_status = 'missing' then 'reconciliation'
      when retained_success.id is not null
        and latest_observation.id = retained_success.id
        and p_as_of <= retained_success.fresh_until then 'fresh'
      when retained_success.id is not null then 'stale_retained'
      when prior_success.id is not null then 'expired'
      when latest_observation.outcome = 'reconciliation' then 'reconciliation'
      else 'unavailable'
    end,
    latest_observation.outcome,
    latest_observation.reconciliation_reason,
    retained_success.sanitized_payload,
    retained_success.projection_hash,
    retained_success.sync_run_id,
    retained_success.observed_at,
    retained_success.fresh_until,
    retained_success.retain_until,
    latest_observation.observed_at,
    context.observed_at
  from (select 1) as singleton
  left join lateral (
    select observation.*
    from public.moodle_quiz_attempt_observations as observation
    where observation.connection_id = context.connection_id
      and observation.internal_course_id = context.internal_course_id
      and observation.internal_class_group_id = context.internal_class_group_id
      and observation.quiz_projection_id = context.quiz_projection_id
      and observation.audience = context.projection_audience
      and (context.projection_audience <> 'learner'
        or observation.subject_user_id = context.authorized_user_ids[1])
      and observation.observed_at <= p_as_of
    order by observation.observed_at desc, observation.id desc limit 1
  ) as latest_observation on true
  left join lateral (
    select observation.*
    from public.moodle_quiz_attempt_observations as observation
    where observation.connection_id = context.connection_id
      and observation.internal_course_id = context.internal_course_id
      and observation.internal_class_group_id = context.internal_class_group_id
      and observation.quiz_projection_id = context.quiz_projection_id
      and observation.audience = context.projection_audience
      and (context.projection_audience <> 'learner'
        or observation.subject_user_id = context.authorized_user_ids[1])
      and observation.outcome in ('available', 'empty')
      and context.course_mapping_status = 'exact'
      and context.group_mapping_status = 'exact'
      and context.user_mapping_status <> 'missing'
      and context.quiz_mapping_status = 'exact'
      and (
        context.projection_audience = 'aggregate'
        or not exists (
          select 1
          from pg_catalog.jsonb_array_elements(
            observation.sanitized_payload->'learners'
          ) as retained_learner(value)
          where not (
            (retained_learner.value->>'internalUserId')::uuid
              = any(context.authorized_user_ids)
          )
        )
      )
      and observation.observed_at <= p_as_of
      and p_as_of <= observation.retain_until
    order by observation.observed_at desc, observation.id desc limit 1
  ) as retained_success on true
  left join lateral (
    select observation.id
    from public.moodle_quiz_attempt_observations as observation
    where observation.connection_id = context.connection_id
      and observation.internal_course_id = context.internal_course_id
      and observation.internal_class_group_id = context.internal_class_group_id
      and observation.quiz_projection_id = context.quiz_projection_id
      and observation.audience = context.projection_audience
      and (context.projection_audience <> 'learner'
        or observation.subject_user_id = context.authorized_user_ids[1])
      and observation.outcome in ('available', 'empty')
      and observation.observed_at <= p_as_of
    order by observation.observed_at desc, observation.id desc limit 1
  ) as prior_success on true;
end;
$$;

create function nile_private.guard_moodle_quiz_attempt_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  purge_cutoff timestamptz;
begin
  if tg_op = 'DELETE'
    and pg_catalog.current_setting('nile.phase6h2_purge', true) = 'bounded' then
    purge_cutoff := pg_catalog.current_setting(
      'nile.phase6h2_purge_cutoff', true
    )::timestamptz;
    if old.purge_after <= purge_cutoff then
      return old;
    end if;
  end if;
  raise exception 'Moodle quiz attempt observations are immutable'
    using errcode = '55000';
end;
$$;

create function public.purge_moodle_quiz_attempt_observations(
  p_as_of timestamptz,
  p_limit integer default 500
)
returns table (deleted_count integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_as_of is null or p_limit is null or p_limit < 1 or p_limit > 1000 then
    raise exception 'Bounded purge requires a timestamp and limit from 1 through 1000'
      using errcode = '22023';
  end if;
  perform pg_catalog.set_config('nile.phase6h2_purge', 'bounded', true);
  perform pg_catalog.set_config('nile.phase6h2_purge_cutoff', p_as_of::text, true);
  return query
  with candidates as (
    select observation.id
    from public.moodle_quiz_attempt_observations as observation
    where observation.purge_after <= p_as_of
    order by observation.purge_after, observation.id
    limit p_limit
    for update
  ), deleted as (
    delete from public.moodle_quiz_attempt_observations as observation
    using candidates
    where observation.id = candidates.id
    returning observation.id
  )
  select pg_catalog.count(*)::integer from deleted;
end;
$$;

create trigger moodle_quiz_attempt_observations_immutable
before update or delete on public.moodle_quiz_attempt_observations
for each row execute function nile_private.guard_moodle_quiz_attempt_immutable();

alter table public.moodle_quiz_attempt_observations enable row level security;
alter table public.moodle_quiz_attempt_observations force row level security;

revoke all on table public.moodle_quiz_attempt_observations
from public, anon, authenticated, service_role;
revoke all on function nile_private.moodle_quiz_attempt_payload_is_safe(jsonb, text)
from public, anon, authenticated, service_role;
revoke all on function nile_private.guard_moodle_quiz_attempt_immutable()
from public, anon, authenticated, service_role;

revoke all on function public.resolve_moodle_quiz_attempt_context(uuid, uuid, uuid, uuid)
from public, anon, authenticated;
revoke all on function public.record_moodle_quiz_attempt_observation(text, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, text, jsonb, bytea, timestamptz, timestamptz, timestamptz, uuid, text)
from public, anon, authenticated;
revoke all on function public.list_authorized_moodle_quiz_attempt_freshness(uuid, uuid, uuid, uuid, uuid, timestamptz)
from public, anon, authenticated;
revoke all on function public.purge_moodle_quiz_attempt_observations(timestamptz, integer)
from public, anon, authenticated;

grant execute on function public.resolve_moodle_quiz_attempt_context(uuid, uuid, uuid, uuid)
to service_role;
grant execute on function public.record_moodle_quiz_attempt_observation(text, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, text, jsonb, bytea, timestamptz, timestamptz, timestamptz, uuid, text)
to service_role;
grant execute on function public.list_authorized_moodle_quiz_attempt_freshness(uuid, uuid, uuid, uuid, uuid, timestamptz)
to service_role;
grant execute on function public.purge_moodle_quiz_attempt_observations(timestamptz, integer)
to service_role;

commit;

-- ============================================================================
-- 17. Phase 6H3 Moodle grade outcome observations
-- Source: supabase/manual/013_phase6h3_moodle_grade_outcome_observation.sql
-- SHA-256: 68086f90a5993522b6e73f6ef8fc04b0b84e5b5a900b60e9bbe25d61f9d9915a
-- ============================================================================

-- Nile Learn Phase 6H3 additive Moodle grade outcome observation package.
-- Manual-only and intentionally unapplied. Stores sanitized projections only.

begin;

do $$
declare
  dependency text;
begin
  foreach dependency in array array[
    'app_users', 'role_grants', 'programs', 'course_templates', 'course_runs',
    'class_groups', 'teacher_assignments', 'student_profiles', 'enrollments',
    'class_memberships', 'integration_connections', 'external_records',
    'sync_runs', 'sync_run_items', 'reconciliation_cases',
    'moodle_assessment_status_observations'
  ] loop
    if pg_catalog.to_regclass('public.' || dependency) is null then
      raise exception 'Phase 6H3 requires public.%', dependency;
    end if;
  end loop;

  if pg_catalog.to_regprocedure(
    'public.resolve_moodle_user_projection_authority(uuid,uuid)'
  ) is null then
    raise exception 'Phase 6H3 requires the accepted Phase 6E user authority RPC';
  end if;

  if pg_catalog.to_regprocedure('nile_private.reject_immutable_change()') is null
    or pg_catalog.to_regprocedure('nile_private.jsonb_has_forbidden_keys(jsonb)') is null then
    raise exception 'Phase 6H3 requires Phase 1 safety helpers';
  end if;
end;
$$;

-- Payload contract:
-- learner/person_level: internalCourseId, internalClassGroupId,
-- gradeItemProjectionId, providerState, mappingStatus, and learners[].
-- aggregate: the same root IDs/states plus learnerCount, gradedCount,
-- releasedCount, and feedbackReleasedCount. Provider IDs, questions, answers,
-- files, comments, grader identity, and contact data are rejected. Feedback is
-- sanitized, bounded, and permitted only for explicitly released outcomes.
create function nile_private.moodle_grade_outcome_payload_is_safe(
  payload jsonb,
  audience text
)
returns boolean
language plpgsql
immutable
strict
security invoker
set search_path = ''
as $$
declare
  root_keys text[];
  learner jsonb;
  learner_keys text[];
  timestamp_key text;
  timestamp_value timestamptz;
  score numeric;
  maximum_score numeric;
  uuid_pattern constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
begin
  if audience not in ('learner', 'person_level', 'aggregate')
    or pg_catalog.jsonb_typeof(payload) <> 'object'
    or pg_catalog.octet_length(payload::text) > 65536
    or nile_private.jsonb_has_forbidden_keys(payload) then
    return false;
  end if;

  select pg_catalog.array_agg(key order by key)
  into root_keys
  from pg_catalog.jsonb_object_keys(payload) as key;

  if audience in ('learner', 'person_level') then
    if not (
      root_keys @> array[
        'gradeItemProjectionId', 'internalClassGroupId', 'internalCourseId',
        'learners', 'mappingStatus', 'providerState'
      ]::text[]
      and root_keys <@ array[
        'gradeItemProjectionId', 'internalClassGroupId', 'internalCourseId',
        'learners', 'mappingStatus', 'providerState'
      ]::text[]
    )
      or pg_catalog.jsonb_typeof(payload->'learners') <> 'array'
      or pg_catalog.jsonb_array_length(payload->'learners') > 500 then
      return false;
    end if;
  elsif not (
    root_keys @> array[
      'feedbackReleasedCount', 'gradeItemProjectionId', 'gradedCount',
      'internalClassGroupId', 'internalCourseId', 'learnerCount', 'mappingStatus',
      'providerState', 'releasedCount'
    ]::text[]
    and root_keys <@ array[
      'feedbackReleasedCount', 'gradeItemProjectionId', 'gradedCount',
      'internalClassGroupId', 'internalCourseId', 'learnerCount', 'mappingStatus',
      'providerState', 'releasedCount'
    ]::text[]
  ) then
    return false;
  end if;

  if (payload->>'internalCourseId') !~ uuid_pattern
    or (payload->>'internalClassGroupId') !~ uuid_pattern
    or (payload->>'gradeItemProjectionId') !~ uuid_pattern
    or payload->>'providerState' not in ('available', 'empty')
    or payload->>'mappingStatus' <> 'exact' then
    return false;
  end if;

  if audience = 'aggregate' then
    if pg_catalog.jsonb_typeof(payload->'learnerCount') <> 'number'
      or pg_catalog.jsonb_typeof(payload->'gradedCount') <> 'number'
      or pg_catalog.jsonb_typeof(payload->'releasedCount') <> 'number'
      or pg_catalog.jsonb_typeof(payload->'feedbackReleasedCount') <> 'number'
      or (payload->>'learnerCount') !~ '^[0-9]{1,6}$'
      or (payload->>'gradedCount') !~ '^[0-9]{1,6}$'
      or (payload->>'releasedCount') !~ '^[0-9]{1,6}$'
      or (payload->>'feedbackReleasedCount') !~ '^[0-9]{1,6}$'
      or (payload->>'gradedCount')::integer > (payload->>'learnerCount')::integer
      or (payload->>'releasedCount')::integer > (payload->>'gradedCount')::integer
      or (payload->>'feedbackReleasedCount')::integer > (payload->>'releasedCount')::integer then
      return false;
    end if;
    return true;
  end if;

  for learner in
    select item.value
    from pg_catalog.jsonb_array_elements(payload->'learners') as item(value)
  loop
    if pg_catalog.jsonb_typeof(learner) <> 'object'
      or nile_private.jsonb_has_forbidden_keys(learner) then
      return false;
    end if;

    select pg_catalog.array_agg(key order by key)
    into learner_keys
    from pg_catalog.jsonb_object_keys(learner) as key;

    if not (learner_keys @> array[
      'gradingState', 'internalEnrollmentId', 'internalMembershipId',
      'internalUserId'
    ]::text[])
      or not (learner_keys <@ array[
        'feedback', 'gradedAt', 'gradingState', 'internalEnrollmentId',
        'internalMembershipId', 'internalUserId', 'maximumScore',
        'releasedAt', 'score'
      ]::text[])
      or (learner->>'internalUserId') !~ uuid_pattern
      or (learner->>'internalEnrollmentId') !~ uuid_pattern
      or (learner->>'internalMembershipId') !~ uuid_pattern
      or learner->>'gradingState' not in ('not_graded', 'graded', 'released') then
      return false;
    end if;

    if learner->>'gradingState' = 'not_graded'
      and learner ?| array[
        'score', 'maximumScore', 'gradedAt', 'releasedAt', 'feedback'
      ] then
      return false;
    elsif learner->>'gradingState' in ('graded', 'released')
      and (not (learner ? 'score') or not (learner ? 'maximumScore')
        or not (learner ? 'gradedAt')) then
      return false;
    elsif learner->>'gradingState' = 'graded'
      and learner ?| array['releasedAt', 'feedback'] then
      return false;
    elsif learner->>'gradingState' = 'released'
      and not (learner ? 'releasedAt') then
      return false;
    elsif audience = 'learner' and learner->>'gradingState' = 'graded' then
      return false;
    end if;

    foreach timestamp_key in array array['gradedAt', 'releasedAt']
    loop
      if learner ? timestamp_key then
        if pg_catalog.jsonb_typeof(learner->timestamp_key) <> 'string'
          or pg_catalog.length(learner->>timestamp_key) > 40 then
          return false;
        end if;
        begin
          timestamp_value := (learner->>timestamp_key)::timestamptz;
        exception when invalid_datetime_format or datetime_field_overflow then
          return false;
        end;
      end if;
    end loop;

    if (learner ? 'score') <> (learner ? 'maximumScore') then
      return false;
    end if;
    if learner ? 'score' then
      if pg_catalog.jsonb_typeof(learner->'score') <> 'number'
        or pg_catalog.jsonb_typeof(learner->'maximumScore') <> 'number'
        or (learner->>'score') !~ '^[0-9]{1,6}(\.[0-9]{1,4})?$'
        or (learner->>'maximumScore') !~ '^[0-9]{1,6}(\.[0-9]{1,4})?$' then
        return false;
      end if;
      score := (learner->>'score')::numeric;
      maximum_score := (learner->>'maximumScore')::numeric;
      if maximum_score <= 0 or score < 0 or score > maximum_score
        or learner->>'gradingState' = 'not_graded' then
        return false;
      end if;
    end if;
    if learner->>'gradingState' <> 'not_graded' and not (learner ? 'score') then
      return false;
    end if;
    if learner ? 'feedback' then
      if learner->>'gradingState' <> 'released'
        or pg_catalog.jsonb_typeof(learner->'feedback') <> 'string'
        or pg_catalog.length(learner->>'feedback') < 1
        or pg_catalog.length(learner->>'feedback') > 2000
        or (learner->>'feedback') ~ '[<>]' then
        return false;
      end if;
    end if;
  end loop;

  return true;
end;
$$;

create table public.moodle_grade_outcome_observations (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  request_hash bytea not null check (pg_catalog.octet_length(request_hash) = 32),
  connection_id uuid not null references public.integration_connections(id) on delete restrict,
  internal_course_id uuid not null references public.course_templates(id) on delete restrict,
  internal_class_group_id uuid not null references public.class_groups(id) on delete restrict,
  grade_item_projection_id uuid not null references public.external_records(id) on delete restrict,
  subject_user_id uuid references public.app_users(id) on delete restrict,
  external_course_record_id uuid references public.external_records(id) on delete restrict,
  external_group_record_id uuid references public.external_records(id) on delete restrict,
  sync_run_id uuid not null references public.sync_runs(id) on delete restrict,
  sync_run_item_id uuid not null references public.sync_run_items(id) on delete restrict,
  reconciliation_case_id uuid references public.reconciliation_cases(id) on delete restrict,
  audience text not null check (audience in ('learner', 'person_level', 'aggregate')),
  outcome text not null check (outcome in ('available', 'empty', 'unavailable', 'reconciliation')),
  reconciliation_reason text check (
    reconciliation_reason in (
      'missing_course_mapping', 'missing_group_mapping',
      'missing_user_mapping', 'missing_grade_item_mapping',
      'provider_result_drift', 'ambiguous_mapping'
    )
  ),
  sanitized_payload jsonb,
  projection_hash bytea check (
    projection_hash is null or pg_catalog.octet_length(projection_hash) = 32
  ),
  observed_at timestamptz not null,
  fresh_until timestamptz,
  retain_until timestamptz,
  purge_after timestamptz not null,
  created_at timestamptz not null default pg_catalog.now(),
  check (idempotency_key ~ '^[a-z0-9][a-z0-9._:-]{7,127}$'),
  check ((audience = 'learner') = (subject_user_id is not null)),
  check (
    sanitized_payload is null
    or nile_private.moodle_grade_outcome_payload_is_safe(sanitized_payload, audience)
  ),
  check (
    (
      outcome in ('available', 'empty')
      and external_course_record_id is not null
      and external_group_record_id is not null
      and sanitized_payload is not null
      and projection_hash is not null
      and fresh_until = observed_at + interval '15 minutes'
      and retain_until > fresh_until
      and retain_until <= purge_after
      and reconciliation_case_id is null
      and reconciliation_reason is null
    ) or (
      outcome = 'unavailable'
      and sanitized_payload is null and projection_hash is null
      and fresh_until is null and retain_until is null
      and reconciliation_case_id is null and reconciliation_reason is null
    ) or (
      outcome = 'reconciliation'
      and sanitized_payload is null and projection_hash is null
      and fresh_until is null and retain_until is null
      and reconciliation_case_id is not null and reconciliation_reason is not null
    )
  ),
  check (purge_after > observed_at and purge_after <= observed_at + interval '30 days')
);

create index moodle_grade_outcome_observations_scope_time_idx
  on public.moodle_grade_outcome_observations (
    connection_id, internal_course_id, internal_class_group_id,
    grade_item_projection_id, audience, subject_user_id,
    observed_at desc, id desc
  );
create index moodle_grade_outcome_observations_retained_idx
  on public.moodle_grade_outcome_observations (
    connection_id, internal_class_group_id, grade_item_projection_id,
    audience, subject_user_id, retain_until desc
  ) where outcome in ('available', 'empty');
create index moodle_grade_outcome_observations_purge_idx
  on public.moodle_grade_outcome_observations (purge_after, id);

create function public.resolve_moodle_grade_outcome_context(
  p_user_id uuid,
  p_active_role_grant_id uuid,
  p_internal_class_group_id uuid,
  p_grade_item_projection_id uuid
)
returns table (
  connection_id uuid,
  active_role text,
  projection_audience text,
  internal_course_id uuid,
  internal_course_run_id uuid,
  internal_class_group_id uuid,
  grade_item_projection_id uuid,
  authorized_user_ids uuid[],
  course_mapping_status text,
  group_mapping_status text,
  user_mapping_status text,
  grade_item_mapping_status text,
  observed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  authority_at timestamptz := pg_catalog.now();
  user_authority record;
  effective_grant record;
  class_context record;
  ready_connection_id uuid;
  connection_count integer;
  course_external_id text;
begin
  if p_user_id is null or p_active_role_grant_id is null
    or p_internal_class_group_id is null or p_grade_item_projection_id is null then
    raise exception 'Current actor, grant, class group, and grade item projection are required'
      using errcode = '42501';
  end if;

  select * into strict user_authority
  from public.resolve_moodle_user_projection_authority(
    p_user_id, p_active_role_grant_id
  );

  if user_authority.active_role not in (
    'student', 'teacher', 'headofdepartment', 'superadmin'
  ) then
    raise exception 'Role cannot read grade outcome observations'
      using errcode = '42501';
  end if;

  select * into strict effective_grant
  from nile_private.resolve_effective_role_grant(
    p_user_id, p_active_role_grant_id, authority_at
  );

  select
    class_group.id as class_group_id, class_group.status as group_status,
    course_run.id as course_run_id, course_run.status as run_status,
    course_run.starts_on, course_run.ends_on, course_template.id as course_id,
    program.department_id
  into strict class_context
  from public.class_groups as class_group
  join public.course_runs as course_run
    on course_run.id = class_group.course_run_id
   and course_run.status in ('active', 'completed')
  join public.course_templates as course_template
    on course_template.id = course_run.course_template_id
   and course_template.status = 'active'
  join public.programs as program
    on program.id = course_template.program_id
   and program.status = 'active'
  where class_group.id = p_internal_class_group_id
    and class_group.status in ('active', 'completed');

  if user_authority.active_role = 'student' then
    if not exists (
      select 1
      from public.student_profiles as student_profile
      join public.enrollments as enrollment
        on enrollment.student_profile_id = student_profile.id
       and enrollment.course_run_id = class_context.course_run_id
       and enrollment.status in ('active', 'completed')
      join public.class_memberships as membership
        on membership.enrollment_id = enrollment.id
       and membership.course_run_id = class_context.course_run_id
       and membership.class_group_id = class_context.class_group_id
       and (
         (enrollment.status = 'active' and membership.status = 'active'
          and enrollment.starts_at <= authority_at
          and (enrollment.ends_at is null or enrollment.ends_at > authority_at)
          and membership.starts_at <= authority_at
          and (membership.ends_at is null or membership.ends_at > authority_at))
         or (enrollment.status = 'completed' and membership.status = 'ended')
       )
      where student_profile.user_id = p_user_id
        and student_profile.status = 'active'
    ) then
      raise exception 'Student does not own an exact active or completed class enrollment'
        using errcode = '42501';
    end if;
  end if;

  if user_authority.active_role = 'teacher' and (
    class_context.run_status <> 'active'
    or class_context.group_status <> 'active'
    or authority_at::date not between class_context.starts_on and class_context.ends_on
    or not exists (
    select 1
    from public.staff_profiles as teacher_profile
    join public.teacher_assignments as assignment
      on assignment.teacher_profile_id = teacher_profile.id
     and assignment.class_group_id = class_context.class_group_id
     and assignment.status = 'active'
     and assignment.starts_at <= authority_at
     and (assignment.ends_at is null or assignment.ends_at > authority_at)
    where teacher_profile.user_id = p_user_id
      and teacher_profile.status = 'active'
    )
  ) then
    raise exception 'Teacher is not currently assigned to the exact class'
      using errcode = '42501';
  end if;

  if user_authority.active_role = 'headofdepartment'
    and not (class_context.department_id = any(effective_grant.department_ids)) then
    raise exception 'Class is outside the active HOD department scope'
      using errcode = '42501';
  end if;

  select pg_catalog.count(*)::integer,
    (pg_catalog.array_agg(connection.id order by connection.id))[1]
  into connection_count, ready_connection_id
  from public.integration_connections as connection
  where connection.provider = 'moodle'
    and connection.mode = 'read_only'
    and connection.status = 'ready';

  if connection_count <> 1 then
    raise exception 'Grade outcome projection requires exactly one ready read-only Moodle connection'
      using errcode = '42501';
  end if;

  connection_id := ready_connection_id;
  active_role := user_authority.active_role;
  projection_audience := case active_role
    when 'student' then 'learner'
    when 'teacher' then 'person_level'
    else 'aggregate'
  end;
  internal_course_id := class_context.course_id;
  internal_course_run_id := class_context.course_run_id;
  internal_class_group_id := class_context.class_group_id;
  grade_item_projection_id := p_grade_item_projection_id;
  observed_at := authority_at;

  if active_role = 'student' then
    authorized_user_ids := array[p_user_id]::uuid[];
  elsif active_role = 'teacher' then
    select coalesce(pg_catalog.array_agg(learner.id order by learner.id), '{}'::uuid[])
    into authorized_user_ids
    from public.class_memberships as membership
    join public.enrollments as enrollment
      on enrollment.id = membership.enrollment_id
     and enrollment.course_run_id = class_context.course_run_id
     and enrollment.status = 'active'
     and enrollment.starts_at <= authority_at
     and (enrollment.ends_at is null or enrollment.ends_at > authority_at)
    join public.student_profiles as student_profile
      on student_profile.id = enrollment.student_profile_id
     and student_profile.status = 'active'
    join public.app_users as learner
      on learner.id = student_profile.user_id and learner.status = 'active'
    where membership.class_group_id = class_context.class_group_id
      and membership.course_run_id = class_context.course_run_id
      and membership.status = 'active'
      and membership.starts_at <= authority_at
      and (membership.ends_at is null or membership.ends_at > authority_at);
  else
    authorized_user_ids := '{}'::uuid[];
  end if;

  select mapping.external_id into course_external_id
  from public.external_records as mapping
  where mapping.connection_id = ready_connection_id
    and mapping.entity_type = 'course'
    and mapping.internal_id = class_context.course_id
    and mapping.sync_state <> 'ignored';
  course_mapping_status := case when course_external_id is not null
    then 'exact' else 'missing' end;
  group_mapping_status := case when exists (
    select 1 from public.external_records as mapping
    where mapping.connection_id = ready_connection_id
      and mapping.entity_type = 'class_group'
      and mapping.internal_id = class_context.class_group_id
      and mapping.sync_state <> 'ignored'
  ) then 'exact' else 'missing' end;
  user_mapping_status := case
    when active_role = 'student' and exists (
      select 1 from public.external_records as mapping
      where mapping.connection_id = ready_connection_id
        and mapping.entity_type = 'user'
        and mapping.internal_id = p_user_id
        and mapping.sync_state <> 'ignored'
    ) then 'exact'
    when active_role = 'student' then 'missing'
    when not exists (
    select 1
    from public.class_memberships as membership
    join public.enrollments as enrollment
      on enrollment.id = membership.enrollment_id
     and enrollment.course_run_id = class_context.course_run_id
     and enrollment.status = 'active'
     and enrollment.starts_at <= authority_at
     and (enrollment.ends_at is null or enrollment.ends_at > authority_at)
    join public.student_profiles as student_profile
      on student_profile.id = enrollment.student_profile_id
     and student_profile.status = 'active'
    join public.app_users as learner
      on learner.id = student_profile.user_id and learner.status = 'active'
    left join public.external_records as mapping
      on mapping.connection_id = ready_connection_id
     and mapping.entity_type = 'user'
     and mapping.internal_id = learner.id
     and mapping.sync_state <> 'ignored'
    where (active_role <> 'teacher' or learner.id = any(authorized_user_ids))
      and membership.class_group_id = class_context.class_group_id
      and membership.course_run_id = class_context.course_run_id
      and membership.status = 'active'
      and membership.starts_at <= authority_at
      and (membership.ends_at is null or membership.ends_at > authority_at)
      and mapping.id is null
  ) then 'exact' else 'missing' end;
  grade_item_mapping_status := case when course_external_id is not null and exists (
    select 1 from public.external_records as mapping
    where mapping.id = p_grade_item_projection_id
      and mapping.connection_id = ready_connection_id
      and mapping.entity_type = 'grade_item'
      and mapping.external_parent_id = course_external_id
      and mapping.sync_state in ('matched', 'synced')
  ) then 'exact' else 'missing' end;

  return next;
exception
  when no_data_found then
    raise exception 'Class context does not resolve to current normalized authority'
      using errcode = '42501';
end;
$$;

create function public.record_moodle_grade_outcome_observation(
  p_idempotency_key text,
  p_connection_id uuid,
  p_internal_course_id uuid,
  p_internal_class_group_id uuid,
  p_grade_item_projection_id uuid,
  p_external_course_record_id uuid,
  p_external_group_record_id uuid,
  p_sync_run_id uuid,
  p_sync_run_item_id uuid,
  p_audience text,
  p_outcome text,
  p_sanitized_payload jsonb,
  p_projection_hash bytea,
  p_observed_at timestamptz,
  p_fresh_until timestamptz,
  p_retain_until timestamptz,
  p_reconciliation_case_id uuid default null,
  p_reconciliation_reason text default null
)
returns table (observation_id uuid, replayed boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  calculated_request_hash bytea;
  inserted_id uuid;
  existing_observation record;
  class_context record;
  course_mapping record;
  group_mapping record;
  grade_item_mapping record;
  run_row record;
  item_row record;
  case_row record;
  payload_learner jsonb;
  derived_subject_user_id uuid;
  roster_count integer;
  mapped_count integer;
begin
  if p_idempotency_key is null
    or p_idempotency_key !~ '^[a-z0-9][a-z0-9._:-]{7,127}$'
    or p_audience not in ('learner', 'person_level', 'aggregate')
    or p_outcome not in ('available', 'empty', 'unavailable', 'reconciliation')
    or (p_audience = 'learner' and p_outcome <> 'available')
    or p_observed_at is null then
    raise exception 'Invalid grade outcome observation metadata'
      using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.integration_connections as connection
    where connection.id = p_connection_id
      and connection.provider = 'moodle'
      and connection.mode = 'read_only'
      and connection.status = 'ready'
  ) then
    raise exception 'Observation connection is not ready read-only Moodle'
      using errcode = '42501';
  end if;

  select course_template.id as course_id, course_run.id as run_id, class_group.id as group_id
  into strict class_context
  from public.class_groups as class_group
  join public.course_runs as course_run
    on course_run.id = class_group.course_run_id
   and course_run.status = 'active'
   and course_run.starts_on <= p_observed_at::date
   and course_run.ends_on >= p_observed_at::date
  join public.course_templates as course_template
    on course_template.id = course_run.course_template_id
   and course_template.status = 'active'
  where class_group.id = p_internal_class_group_id
    and class_group.status = 'active';

  if class_context.course_id is distinct from p_internal_course_id then
    raise exception 'Observation course and class context do not match'
      using errcode = '23514';
  end if;

  if p_outcome in ('available', 'empty') then
    if p_sanitized_payload is null
      or not nile_private.moodle_grade_outcome_payload_is_safe(
        p_sanitized_payload, p_audience
      )
      or p_projection_hash is null
      or p_projection_hash is distinct from public.digest(
        pg_catalog.convert_to(p_sanitized_payload::text, 'UTF8'), 'sha256'
      )
      or p_fresh_until is distinct from p_observed_at + interval '15 minutes'
      or p_retain_until is null or p_retain_until <= p_fresh_until
      or p_retain_until > p_observed_at + interval '30 days'
      or p_reconciliation_case_id is not null
      or p_reconciliation_reason is not null
      or (p_sanitized_payload->>'internalCourseId')::uuid <> p_internal_course_id
      or (p_sanitized_payload->>'internalClassGroupId')::uuid <> p_internal_class_group_id
      or (p_sanitized_payload->>'gradeItemProjectionId')::uuid <> p_grade_item_projection_id
      or p_sanitized_payload->>'providerState' <> p_outcome
      or (p_outcome = 'empty' and p_sanitized_payload->>'mappingStatus' <> 'exact') then
      raise exception 'Successful observation requires an exact safe bounded projection'
        using errcode = '22023';
    end if;
  elsif p_sanitized_payload is not null or p_projection_hash is not null
    or p_fresh_until is not null or p_retain_until is not null then
    raise exception 'Unavailable and reconciliation outcomes cannot retain payloads'
      using errcode = '22023';
  end if;

  if p_outcome = 'reconciliation' then
    if p_reconciliation_case_id is null or p_reconciliation_reason not in (
      'missing_course_mapping', 'missing_group_mapping',
      'missing_user_mapping', 'missing_grade_item_mapping',
      'provider_result_drift', 'ambiguous_mapping'
    ) then
      raise exception 'Reconciliation requires one bounded case and reason'
        using errcode = '22023';
    end if;
  elsif p_reconciliation_case_id is not null or p_reconciliation_reason is not null then
    raise exception 'Only reconciliation outcomes can reference a case'
      using errcode = '22023';
  end if;

  if p_external_course_record_id is not null then
    select mapping.connection_id, mapping.internal_id, mapping.external_id
    into strict course_mapping
    from public.external_records as mapping
    where mapping.id = p_external_course_record_id
      and mapping.entity_type = 'course' and mapping.sync_state <> 'ignored';
    if course_mapping.connection_id <> p_connection_id
      or course_mapping.internal_id <> p_internal_course_id then
      raise exception 'Course mapping is outside the exact observation context'
        using errcode = '23514';
    end if;
  elsif p_outcome in ('available', 'empty') then
    raise exception 'Successful observation requires an exact course mapping'
      using errcode = '23514';
  end if;

  if p_external_group_record_id is not null then
    select mapping.connection_id, mapping.internal_id, mapping.external_id
    into strict group_mapping
    from public.external_records as mapping
    where mapping.id = p_external_group_record_id
      and mapping.entity_type = 'class_group' and mapping.sync_state <> 'ignored';
    if group_mapping.connection_id <> p_connection_id
      or group_mapping.internal_id <> p_internal_class_group_id then
      raise exception 'Group mapping is outside the exact observation context'
        using errcode = '23514';
    end if;
  elsif p_outcome in ('available', 'empty') then
    raise exception 'Successful observation requires an exact group mapping'
      using errcode = '23514';
  end if;

  select mapping.connection_id, mapping.external_parent_id, mapping.external_id
  into strict grade_item_mapping
  from public.external_records as mapping
  where mapping.id = p_grade_item_projection_id
    and mapping.entity_type = 'grade_item'
    and mapping.sync_state in ('matched', 'synced');
  if grade_item_mapping.connection_id <> p_connection_id
    or grade_item_mapping.external_parent_id <> course_mapping.external_id then
    raise exception 'Grade item mapping is outside the exact course context'
      using errcode = '23514';
  end if;

  if p_outcome = 'available' and p_audience in ('learner', 'person_level') then
    for payload_learner in
      select item.value from pg_catalog.jsonb_array_elements(
        p_sanitized_payload->'learners'
      ) as item(value)
    loop
      if not exists (
        select 1
        from public.class_memberships as membership
        join public.enrollments as enrollment
          on enrollment.id = membership.enrollment_id
         and enrollment.course_run_id = class_context.run_id
         and enrollment.status = 'active'
         and enrollment.starts_at <= p_observed_at
         and (enrollment.ends_at is null or enrollment.ends_at > p_observed_at)
        join public.student_profiles as student_profile
          on student_profile.id = enrollment.student_profile_id
         and student_profile.status = 'active'
        join public.app_users as learner
          on learner.id = student_profile.user_id and learner.status = 'active'
        where membership.id = (payload_learner->>'internalMembershipId')::uuid
          and enrollment.id = (payload_learner->>'internalEnrollmentId')::uuid
          and learner.id = (payload_learner->>'internalUserId')::uuid
          and membership.class_group_id = p_internal_class_group_id
          and membership.course_run_id = class_context.run_id
          and membership.status = 'active'
          and membership.starts_at <= p_observed_at
          and (membership.ends_at is null or membership.ends_at > p_observed_at)
      ) then
        raise exception 'Person-level payload contains a noncurrent learner tuple'
          using errcode = '23514';
      end if;

      if not exists (
        select 1 from public.external_records as user_mapping
        where user_mapping.connection_id = p_connection_id
          and user_mapping.entity_type = 'user'
          and user_mapping.internal_id = (payload_learner->>'internalUserId')::uuid
          and user_mapping.sync_state <> 'ignored'
      ) then
        raise exception 'Person-level result lacks an exact user mapping'
          using errcode = '23514';
      end if;

    end loop;

    select pg_catalog.count(*)::integer into roster_count
    from public.class_memberships as membership
    join public.enrollments as enrollment
      on enrollment.id = membership.enrollment_id
     and enrollment.course_run_id = class_context.run_id
     and enrollment.status = 'active'
     and enrollment.starts_at <= p_observed_at
     and (enrollment.ends_at is null or enrollment.ends_at > p_observed_at)
    join public.student_profiles as student_profile
      on student_profile.id = enrollment.student_profile_id and student_profile.status = 'active'
    join public.app_users as learner
      on learner.id = student_profile.user_id and learner.status = 'active'
    where membership.class_group_id = p_internal_class_group_id
      and membership.course_run_id = class_context.run_id
      and membership.status = 'active'
      and membership.starts_at <= p_observed_at
      and (membership.ends_at is null or membership.ends_at > p_observed_at);

    if p_audience = 'learner' then
      if pg_catalog.jsonb_array_length(p_sanitized_payload->'learners') <> 1 then
        raise exception 'Learner result must contain exactly one learner tuple'
          using errcode = '23514';
      end if;
      derived_subject_user_id := (p_sanitized_payload->'learners'->0->>'internalUserId')::uuid;
    elsif roster_count <> pg_catalog.jsonb_array_length(p_sanitized_payload->'learners')
      or roster_count <> (
        select pg_catalog.count(distinct item.value->>'internalUserId')
        from pg_catalog.jsonb_array_elements(p_sanitized_payload->'learners') as item(value)
      ) then
      raise exception 'Person-level payload is not the exact current class roster'
        using errcode = '23514';
    end if;

  elsif p_outcome = 'empty' and p_audience in ('learner', 'person_level')
    and pg_catalog.jsonb_array_length(p_sanitized_payload->'learners') <> 0 then
    raise exception 'Empty person-level projection must contain no learners'
      using errcode = '23514';
  elsif p_outcome = 'available' and p_audience = 'aggregate' then
    select pg_catalog.count(*)::integer, pg_catalog.count(user_mapping.id)::integer
    into roster_count, mapped_count
    from public.class_memberships as membership
    join public.enrollments as enrollment
      on enrollment.id = membership.enrollment_id
     and enrollment.course_run_id = class_context.run_id
     and enrollment.status = 'active'
     and enrollment.starts_at <= p_observed_at
     and (enrollment.ends_at is null or enrollment.ends_at > p_observed_at)
    join public.student_profiles as student_profile
      on student_profile.id = enrollment.student_profile_id and student_profile.status = 'active'
    join public.app_users as learner
      on learner.id = student_profile.user_id and learner.status = 'active'
    left join public.external_records as user_mapping
      on user_mapping.connection_id = p_connection_id
     and user_mapping.entity_type = 'user'
     and user_mapping.internal_id = learner.id
     and user_mapping.sync_state <> 'ignored'
    where membership.class_group_id = p_internal_class_group_id
      and membership.course_run_id = class_context.run_id
      and membership.status = 'active'
      and membership.starts_at <= p_observed_at
      and (membership.ends_at is null or membership.ends_at > p_observed_at);

    if (p_sanitized_payload->>'learnerCount')::integer <> roster_count
      or mapped_count <> roster_count
      then
      raise exception 'Aggregate counts require the exact fully mapped current class'
        using errcode = '23514';
    end if;
  elsif p_outcome = 'empty' and p_audience = 'aggregate'
    and (
      (p_sanitized_payload->>'learnerCount')::integer <> 0
      or (p_sanitized_payload->>'gradedCount')::integer <> 0
      or (p_sanitized_payload->>'releasedCount')::integer <> 0
      or (p_sanitized_payload->>'feedbackReleasedCount')::integer <> 0
    ) then
    raise exception 'Empty aggregate projection must contain zero counts'
      using errcode = '23514';
  end if;

  select sync_run.connection_id, sync_run.entity_type,
    sync_run.direction, sync_run.status
  into strict run_row
  from public.sync_runs as sync_run where sync_run.id = p_sync_run_id;
  select item.sync_run_id, item.external_record_id,
    item.external_id, item.status
  into strict item_row
  from public.sync_run_items as item where item.id = p_sync_run_item_id;

  if run_row.connection_id <> p_connection_id
    or run_row.entity_type <> 'grade_outcomes_projection'
    or run_row.direction <> 'read'
    or run_row.status not in ('succeeded', 'partial', 'failed')
    or item_row.sync_run_id <> p_sync_run_id
    or item_row.external_record_id is distinct from p_grade_item_projection_id
    or item_row.external_id is distinct from grade_item_mapping.external_id
    or (p_outcome in ('available', 'empty') and item_row.status <> 'succeeded')
    or (p_outcome = 'unavailable' and item_row.status <> 'failed')
    or (p_outcome = 'reconciliation' and item_row.status <> 'needs_review') then
    raise exception 'Observation sync evidence is outside the exact read context'
      using errcode = '23514';
  end if;

  if p_outcome = 'reconciliation' then
    select reconciliation.connection_id, reconciliation.entity_type,
      reconciliation.internal_id, reconciliation.external_id,
      reconciliation.reason, reconciliation.status
    into strict case_row
    from public.reconciliation_cases as reconciliation
    where reconciliation.id = p_reconciliation_case_id;
    if case_row.connection_id <> p_connection_id
      or case_row.entity_type <> 'grade_outcomes_projection'
      or case_row.internal_id <> p_grade_item_projection_id
      or case_row.external_id is distinct from item_row.external_id
      or case_row.reason <> p_reconciliation_reason
      or case_row.status <> 'open' then
      raise exception 'Reconciliation case is outside the exact class context'
        using errcode = '23514';
    end if;
  end if;

  calculated_request_hash := public.digest(
    pg_catalog.convert_to(pg_catalog.jsonb_build_array(
      p_connection_id::text, p_internal_course_id::text,
      p_internal_class_group_id::text, p_grade_item_projection_id::text,
      p_external_course_record_id::text,
      p_external_group_record_id::text, p_sync_run_id::text,
      p_sync_run_item_id::text, p_audience, p_outcome, p_sanitized_payload,
      pg_catalog.encode(p_projection_hash, 'hex'), p_observed_at::text,
      p_fresh_until::text, p_retain_until::text,
      p_reconciliation_case_id::text, p_reconciliation_reason
    )::text, 'UTF8'), 'sha256'
  );

  insert into public.moodle_grade_outcome_observations (
    idempotency_key, request_hash, connection_id, internal_course_id,
    internal_class_group_id, grade_item_projection_id, subject_user_id,
    external_course_record_id,
    external_group_record_id, sync_run_id, sync_run_item_id,
    reconciliation_case_id, audience, outcome, reconciliation_reason,
    sanitized_payload, projection_hash, observed_at, fresh_until, retain_until,
    purge_after
  ) values (
    p_idempotency_key, calculated_request_hash, p_connection_id,
    p_internal_course_id, p_internal_class_group_id, p_grade_item_projection_id,
    derived_subject_user_id,
    p_external_course_record_id, p_external_group_record_id,
    p_sync_run_id, p_sync_run_item_id, p_reconciliation_case_id,
    p_audience, p_outcome, p_reconciliation_reason, p_sanitized_payload,
    p_projection_hash, p_observed_at, p_fresh_until, p_retain_until,
    p_observed_at + interval '30 days'
  ) on conflict (idempotency_key) do nothing returning id into inserted_id;

  if inserted_id is not null then
    return query select inserted_id, false;
    return;
  end if;

  select observation.id, observation.request_hash into strict existing_observation
  from public.moodle_grade_outcome_observations as observation
  where observation.idempotency_key = p_idempotency_key;
  if existing_observation.request_hash is distinct from calculated_request_hash then
    raise exception 'Grade outcome observation idempotency conflict'
      using errcode = '23505';
  end if;
  return query select existing_observation.id, true;
exception
  when no_data_found then
    raise exception 'Observation references missing or inactive exact evidence'
      using errcode = '23514';
end;
$$;

create function public.list_authorized_moodle_grade_outcome_freshness(
  p_user_id uuid,
  p_active_role_grant_id uuid,
  p_connection_id uuid,
  p_internal_class_group_id uuid,
  p_grade_item_projection_id uuid,
  p_as_of timestamptz
)
returns table (
  connection_id uuid,
  active_role text,
  projection_audience text,
  internal_course_id uuid,
  internal_class_group_id uuid,
  grade_item_projection_id uuid,
  authorized_user_ids uuid[],
  course_mapping_status text,
  group_mapping_status text,
  user_mapping_status text,
  grade_item_mapping_status text,
  freshness_state text,
  latest_outcome text,
  reconciliation_reason text,
  sanitized_payload jsonb,
  projection_hash bytea,
  successful_sync_run_id uuid,
  successful_observed_at timestamptz,
  fresh_until timestamptz,
  retain_until timestamptz,
  latest_observed_at timestamptz,
  authority_observed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  context record;
begin
  if p_as_of is null then
    raise exception 'Freshness evaluation requires an explicit timestamp'
      using errcode = '22023';
  end if;

  select * into strict context
  from public.resolve_moodle_grade_outcome_context(
    p_user_id, p_active_role_grant_id, p_internal_class_group_id,
    p_grade_item_projection_id
  );
  if context.connection_id <> p_connection_id then
    raise exception 'Connection is outside the live class authority context'
      using errcode = '42501';
  end if;

  return query
  select
    context.connection_id, context.active_role, context.projection_audience,
    context.internal_course_id, context.internal_class_group_id,
    context.grade_item_projection_id, context.authorized_user_ids,
    context.course_mapping_status, context.group_mapping_status,
    context.user_mapping_status, context.grade_item_mapping_status,
    case
      when context.course_mapping_status <> 'exact'
        or context.group_mapping_status <> 'exact'
        or context.grade_item_mapping_status <> 'exact'
        or context.user_mapping_status = 'missing' then 'reconciliation'
      when retained_success.id is not null
        and latest_observation.id = retained_success.id
        and p_as_of <= retained_success.fresh_until then 'fresh'
      when retained_success.id is not null then 'stale_retained'
      when prior_success.id is not null then 'expired'
      when latest_observation.outcome = 'reconciliation' then 'reconciliation'
      else 'unavailable'
    end,
    latest_observation.outcome,
    latest_observation.reconciliation_reason,
    retained_success.sanitized_payload,
    retained_success.projection_hash,
    retained_success.sync_run_id,
    retained_success.observed_at,
    retained_success.fresh_until,
    retained_success.retain_until,
    latest_observation.observed_at,
    context.observed_at
  from (select 1) as singleton
  left join lateral (
    select observation.*
    from public.moodle_grade_outcome_observations as observation
    where observation.connection_id = context.connection_id
      and observation.internal_course_id = context.internal_course_id
      and observation.internal_class_group_id = context.internal_class_group_id
      and observation.grade_item_projection_id = context.grade_item_projection_id
      and observation.audience = context.projection_audience
      and (context.projection_audience <> 'learner'
        or observation.subject_user_id = context.authorized_user_ids[1])
      and observation.observed_at <= p_as_of
    order by observation.observed_at desc, observation.id desc limit 1
  ) as latest_observation on true
  left join lateral (
    select observation.*
    from public.moodle_grade_outcome_observations as observation
    where observation.connection_id = context.connection_id
      and observation.internal_course_id = context.internal_course_id
      and observation.internal_class_group_id = context.internal_class_group_id
      and observation.grade_item_projection_id = context.grade_item_projection_id
      and observation.audience = context.projection_audience
      and (context.projection_audience <> 'learner'
        or observation.subject_user_id = context.authorized_user_ids[1])
      and observation.outcome in ('available', 'empty')
      and context.course_mapping_status = 'exact'
      and context.group_mapping_status = 'exact'
      and context.user_mapping_status <> 'missing'
      and context.grade_item_mapping_status = 'exact'
      and (
        context.projection_audience = 'aggregate'
        or not exists (
          select 1
          from pg_catalog.jsonb_array_elements(
            observation.sanitized_payload->'learners'
          ) as retained_learner(value)
          where not (
            (retained_learner.value->>'internalUserId')::uuid
              = any(context.authorized_user_ids)
          )
        )
      )
      and observation.observed_at <= p_as_of
      and p_as_of <= observation.retain_until
    order by observation.observed_at desc, observation.id desc limit 1
  ) as retained_success on true
  left join lateral (
    select observation.id
    from public.moodle_grade_outcome_observations as observation
    where observation.connection_id = context.connection_id
      and observation.internal_course_id = context.internal_course_id
      and observation.internal_class_group_id = context.internal_class_group_id
      and observation.grade_item_projection_id = context.grade_item_projection_id
      and observation.audience = context.projection_audience
      and (context.projection_audience <> 'learner'
        or observation.subject_user_id = context.authorized_user_ids[1])
      and observation.outcome in ('available', 'empty')
      and observation.observed_at <= p_as_of
    order by observation.observed_at desc, observation.id desc limit 1
  ) as prior_success on true;
end;
$$;

create function nile_private.guard_moodle_grade_outcome_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  purge_cutoff timestamptz;
begin
  if tg_op = 'DELETE'
    and pg_catalog.current_setting('nile.phase6h3_purge', true) = 'bounded' then
    purge_cutoff := pg_catalog.current_setting(
      'nile.phase6h3_purge_cutoff', true
    )::timestamptz;
    if old.purge_after <= purge_cutoff then
      return old;
    end if;
  end if;
  raise exception 'Moodle grade outcome observations are immutable'
    using errcode = '55000';
end;
$$;

create function public.purge_moodle_grade_outcome_observations(
  p_as_of timestamptz,
  p_limit integer default 500
)
returns table (deleted_count integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_as_of is null or p_limit is null or p_limit < 1 or p_limit > 1000 then
    raise exception 'Bounded purge requires a timestamp and limit from 1 through 1000'
      using errcode = '22023';
  end if;
  perform pg_catalog.set_config('nile.phase6h3_purge', 'bounded', true);
  perform pg_catalog.set_config('nile.phase6h3_purge_cutoff', p_as_of::text, true);
  return query
  with candidates as (
    select observation.id
    from public.moodle_grade_outcome_observations as observation
    where observation.purge_after <= p_as_of
    order by observation.purge_after, observation.id
    limit p_limit
    for update
  ), deleted as (
    delete from public.moodle_grade_outcome_observations as observation
    using candidates
    where observation.id = candidates.id
    returning observation.id
  )
  select pg_catalog.count(*)::integer from deleted;
end;
$$;

create trigger moodle_grade_outcome_observations_immutable
before update or delete on public.moodle_grade_outcome_observations
for each row execute function nile_private.guard_moodle_grade_outcome_immutable();

alter table public.moodle_grade_outcome_observations enable row level security;
alter table public.moodle_grade_outcome_observations force row level security;

revoke all on table public.moodle_grade_outcome_observations
from public, anon, authenticated, service_role;
revoke all on function nile_private.moodle_grade_outcome_payload_is_safe(jsonb, text)
from public, anon, authenticated, service_role;
revoke all on function nile_private.guard_moodle_grade_outcome_immutable()
from public, anon, authenticated, service_role;

revoke all on function public.resolve_moodle_grade_outcome_context(uuid, uuid, uuid, uuid)
from public, anon, authenticated;
revoke all on function public.record_moodle_grade_outcome_observation(text, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, text, jsonb, bytea, timestamptz, timestamptz, timestamptz, uuid, text)
from public, anon, authenticated;
revoke all on function public.list_authorized_moodle_grade_outcome_freshness(uuid, uuid, uuid, uuid, uuid, timestamptz)
from public, anon, authenticated;
revoke all on function public.purge_moodle_grade_outcome_observations(timestamptz, integer)
from public, anon, authenticated;

grant execute on function public.resolve_moodle_grade_outcome_context(uuid, uuid, uuid, uuid)
to service_role;
grant execute on function public.record_moodle_grade_outcome_observation(text, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, text, jsonb, bytea, timestamptz, timestamptz, timestamptz, uuid, text)
to service_role;
grant execute on function public.list_authorized_moodle_grade_outcome_freshness(uuid, uuid, uuid, uuid, uuid, timestamptz)
to service_role;
grant execute on function public.purge_moodle_grade_outcome_observations(timestamptz, integer)
to service_role;

commit;

-- ============================================================================
-- 18. Phase 6H4 Moodle activity outcome observations
-- Source: supabase/manual/014_phase6h4_moodle_activity_outcome_observation.sql
-- SHA-256: ba9a523bbd0f75de11f8a3bd23651fc7a26bd3dbab0db15fbfca8b9212f99372
-- ============================================================================

-- Nile Learn Phase 6H4 additive Moodle activity outcome observation package.
-- Manual-only and intentionally unapplied. Stores sanitized projections only.

begin;

do $$
declare
  dependency text;
begin
  foreach dependency in array array[
    'app_users', 'role_grants', 'programs', 'course_templates', 'course_runs',
    'class_groups', 'teacher_assignments', 'student_profiles', 'enrollments',
    'class_memberships', 'integration_connections', 'external_records',
    'sync_runs', 'sync_run_items', 'reconciliation_cases',
    'moodle_assessment_status_observations'
  ] loop
    if pg_catalog.to_regclass('public.' || dependency) is null then
      raise exception 'Phase 6H4 requires public.%', dependency;
    end if;
  end loop;

  if pg_catalog.to_regprocedure(
    'public.resolve_moodle_user_projection_authority(uuid,uuid)'
  ) is null then
    raise exception 'Phase 6H4 requires the accepted Phase 6E user authority RPC';
  end if;

  if pg_catalog.to_regprocedure('nile_private.reject_immutable_change()') is null
    or pg_catalog.to_regprocedure('nile_private.jsonb_has_forbidden_keys(jsonb)') is null then
    raise exception 'Phase 6H4 requires Phase 1 safety helpers';
  end if;
end;
$$;

-- Payload contract:
-- learner/person_level: internalCourseId, internalClassGroupId,
-- activityProjectionId, activityKind, providerState, mappingStatus, and
-- learners[]. Aggregate: the same root IDs/states plus learnerCount,
-- startedCount, completedCount, passedCount, failedCount, and scoredCount.
-- Raw tracks, interactions, answers, files, comments, provider identifiers,
-- grader identity, and contact data are rejected. Scores are permitted only
-- when explicitly released.
create function nile_private.moodle_activity_outcome_payload_is_safe(
  payload jsonb,
  audience text
)
returns boolean
language plpgsql
immutable
strict
security invoker
set search_path = ''
as $$
declare
  root_keys text[];
  learner jsonb;
  learner_keys text[];
  timestamp_key text;
  timestamp_value timestamptz;
  score numeric;
  maximum_score numeric;
  uuid_pattern constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
begin
  if audience not in ('learner', 'person_level', 'aggregate')
    or pg_catalog.jsonb_typeof(payload) <> 'object'
    or pg_catalog.octet_length(payload::text) > 65536
    or nile_private.jsonb_has_forbidden_keys(payload) then
    return false;
  end if;

  select pg_catalog.array_agg(key order by key)
  into root_keys
  from pg_catalog.jsonb_object_keys(payload) as key;

  if audience in ('learner', 'person_level') then
    if root_keys is distinct from array[
      'activityKind', 'activityProjectionId', 'internalClassGroupId',
      'internalCourseId', 'learners', 'mappingStatus', 'providerState'
    ]::text[]
      or pg_catalog.jsonb_typeof(payload->'learners') <> 'array'
      or pg_catalog.jsonb_array_length(payload->'learners') > 500 then
      return false;
    end if;
  elsif root_keys is distinct from array[
    'activityKind', 'activityProjectionId', 'completedCount', 'failedCount',
    'internalClassGroupId', 'internalCourseId', 'learnerCount', 'mappingStatus',
    'passedCount', 'providerState', 'scoredCount', 'startedCount'
  ]::text[] then
    return false;
  end if;

  if (payload->>'internalCourseId') !~ uuid_pattern
    or (payload->>'internalClassGroupId') !~ uuid_pattern
    or (payload->>'activityProjectionId') !~ uuid_pattern
    or payload->>'activityKind' not in ('lesson', 'h5p', 'scorm')
    or payload->>'providerState' not in ('available', 'empty')
    or payload->>'mappingStatus' <> 'exact' then
    return false;
  end if;

  if audience = 'aggregate' then
    if pg_catalog.jsonb_typeof(payload->'learnerCount') <> 'number'
      or pg_catalog.jsonb_typeof(payload->'startedCount') <> 'number'
      or pg_catalog.jsonb_typeof(payload->'completedCount') <> 'number'
      or pg_catalog.jsonb_typeof(payload->'passedCount') <> 'number'
      or pg_catalog.jsonb_typeof(payload->'failedCount') <> 'number'
      or pg_catalog.jsonb_typeof(payload->'scoredCount') <> 'number'
      or (payload->>'learnerCount') !~ '^[0-9]{1,6}$'
      or (payload->>'startedCount') !~ '^[0-9]{1,6}$'
      or (payload->>'completedCount') !~ '^[0-9]{1,6}$'
      or (payload->>'passedCount') !~ '^[0-9]{1,6}$'
      or (payload->>'failedCount') !~ '^[0-9]{1,6}$'
      or (payload->>'scoredCount') !~ '^[0-9]{1,6}$'
      or (payload->>'startedCount')::integer > (payload->>'learnerCount')::integer
      or (payload->>'completedCount')::integer > (payload->>'startedCount')::integer
      or (payload->>'passedCount')::integer + (payload->>'failedCount')::integer
        > (payload->>'completedCount')::integer
      or (payload->>'scoredCount')::integer > (payload->>'learnerCount')::integer then
      return false;
    end if;
    return true;
  end if;

  for learner in
    select item.value
    from pg_catalog.jsonb_array_elements(payload->'learners') as item(value)
  loop
    if pg_catalog.jsonb_typeof(learner) <> 'object'
      or nile_private.jsonb_has_forbidden_keys(learner) then
      return false;
    end if;

    select pg_catalog.array_agg(key order by key)
    into learner_keys
    from pg_catalog.jsonb_object_keys(learner) as key;

    if not (learner_keys @> array[
      'completionState', 'internalEnrollmentId', 'internalMembershipId',
      'internalUserId', 'scoreState'
    ]::text[])
      or not (learner_keys <@ array[
        'completedAt', 'completionState', 'internalEnrollmentId',
        'internalMembershipId', 'internalUserId', 'maximumScore',
        'releasedAt', 'score', 'scoreState'
      ]::text[])
      or (learner->>'internalUserId') !~ uuid_pattern
      or (learner->>'internalEnrollmentId') !~ uuid_pattern
      or (learner->>'internalMembershipId') !~ uuid_pattern
      or learner->>'completionState' not in (
        'not_started', 'in_progress', 'completed', 'passed', 'failed'
      )
      or learner->>'scoreState' not in ('not_scored', 'released') then
      return false;
    end if;

    if learner->>'completionState' in ('not_started', 'in_progress')
      and learner ? 'completedAt' then
      return false;
    elsif learner->>'scoreState' = 'not_scored'
      and learner ?| array['score', 'maximumScore', 'releasedAt'] then
      return false;
    elsif learner->>'scoreState' = 'released'
      and (not (learner ? 'score') or not (learner ? 'maximumScore')
        or not (learner ? 'releasedAt')) then
      return false;
    end if;

    foreach timestamp_key in array array['completedAt', 'releasedAt']
    loop
      if learner ? timestamp_key then
        if pg_catalog.jsonb_typeof(learner->timestamp_key) <> 'string'
          or pg_catalog.length(learner->>timestamp_key) > 40 then
          return false;
        end if;
        begin
          timestamp_value := (learner->>timestamp_key)::timestamptz;
        exception when invalid_datetime_format or datetime_field_overflow then
          return false;
        end;
      end if;
    end loop;

    if (learner ? 'score') <> (learner ? 'maximumScore') then
      return false;
    end if;
    if learner ? 'score' then
      if pg_catalog.jsonb_typeof(learner->'score') <> 'number'
        or pg_catalog.jsonb_typeof(learner->'maximumScore') <> 'number'
        or (learner->>'score') !~ '^[0-9]{1,6}(\.[0-9]{1,4})?$'
        or (learner->>'maximumScore') !~ '^[0-9]{1,6}(\.[0-9]{1,4})?$' then
        return false;
      end if;
      score := (learner->>'score')::numeric;
      maximum_score := (learner->>'maximumScore')::numeric;
      if maximum_score <= 0 or score < 0 or score > maximum_score
        or learner->>'scoreState' <> 'released' then
        return false;
      end if;
    end if;
  end loop;

  return true;
end;
$$;

create table public.moodle_activity_outcome_observations (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  request_hash bytea not null check (pg_catalog.octet_length(request_hash) = 32),
  connection_id uuid not null references public.integration_connections(id) on delete restrict,
  internal_course_id uuid not null references public.course_templates(id) on delete restrict,
  internal_class_group_id uuid not null references public.class_groups(id) on delete restrict,
  activity_projection_id uuid not null references public.external_records(id) on delete restrict,
  activity_kind text not null check (activity_kind in ('lesson', 'h5p', 'scorm')),
  subject_user_id uuid references public.app_users(id) on delete restrict,
  external_course_record_id uuid references public.external_records(id) on delete restrict,
  external_group_record_id uuid references public.external_records(id) on delete restrict,
  sync_run_id uuid not null references public.sync_runs(id) on delete restrict,
  sync_run_item_id uuid not null references public.sync_run_items(id) on delete restrict,
  reconciliation_case_id uuid references public.reconciliation_cases(id) on delete restrict,
  audience text not null check (audience in ('learner', 'person_level', 'aggregate')),
  outcome text not null check (outcome in ('available', 'empty', 'unavailable', 'reconciliation')),
  reconciliation_reason text check (
    reconciliation_reason in (
      'missing_course_mapping', 'missing_group_mapping',
      'missing_user_mapping', 'missing_activity_mapping',
      'provider_result_drift', 'ambiguous_mapping'
    )
  ),
  sanitized_payload jsonb,
  projection_hash bytea check (
    projection_hash is null or pg_catalog.octet_length(projection_hash) = 32
  ),
  observed_at timestamptz not null,
  fresh_until timestamptz,
  retain_until timestamptz,
  purge_after timestamptz not null,
  created_at timestamptz not null default pg_catalog.now(),
  check (idempotency_key ~ '^[a-z0-9][a-z0-9._:-]{7,127}$'),
  check ((audience = 'learner') = (subject_user_id is not null)),
  check (
    sanitized_payload is null
    or (
      nile_private.moodle_activity_outcome_payload_is_safe(sanitized_payload, audience)
      and sanitized_payload->>'activityKind' = activity_kind
    )
  ),
  check (
    (
      outcome in ('available', 'empty')
      and external_course_record_id is not null
      and external_group_record_id is not null
      and sanitized_payload is not null
      and projection_hash is not null
      and fresh_until = observed_at + interval '15 minutes'
      and retain_until > fresh_until
      and retain_until <= purge_after
      and reconciliation_case_id is null
      and reconciliation_reason is null
    ) or (
      outcome = 'unavailable'
      and sanitized_payload is null and projection_hash is null
      and fresh_until is null and retain_until is null
      and reconciliation_case_id is null and reconciliation_reason is null
    ) or (
      outcome = 'reconciliation'
      and sanitized_payload is null and projection_hash is null
      and fresh_until is null and retain_until is null
      and reconciliation_case_id is not null and reconciliation_reason is not null
    )
  ),
  check (purge_after > observed_at and purge_after <= observed_at + interval '30 days')
);

create index moodle_activity_outcome_observations_scope_time_idx
  on public.moodle_activity_outcome_observations (
    connection_id, internal_course_id, internal_class_group_id,
    activity_projection_id, audience, subject_user_id,
    observed_at desc, id desc
  );
create index moodle_activity_outcome_observations_retained_idx
  on public.moodle_activity_outcome_observations (
    connection_id, internal_class_group_id, activity_projection_id,
    audience, subject_user_id, retain_until desc
  ) where outcome in ('available', 'empty');
create index moodle_activity_outcome_observations_purge_idx
  on public.moodle_activity_outcome_observations (purge_after, id);

create function public.resolve_moodle_activity_outcome_context(
  p_user_id uuid,
  p_active_role_grant_id uuid,
  p_internal_class_group_id uuid,
  p_activity_projection_id uuid
)
returns table (
  connection_id uuid,
  active_role text,
  projection_audience text,
  internal_course_id uuid,
  internal_course_run_id uuid,
  internal_class_group_id uuid,
  activity_projection_id uuid,
  activity_kind text,
  authorized_user_ids uuid[],
  course_mapping_status text,
  group_mapping_status text,
  user_mapping_status text,
  activity_mapping_status text,
  observed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  authority_at timestamptz := pg_catalog.now();
  user_authority record;
  effective_grant record;
  class_context record;
  ready_connection_id uuid;
  connection_count integer;
  course_external_id text;
begin
  if p_user_id is null or p_active_role_grant_id is null
    or p_internal_class_group_id is null or p_activity_projection_id is null then
    raise exception 'Current actor, grant, class group, and activity projection are required'
      using errcode = '42501';
  end if;

  select * into strict user_authority
  from public.resolve_moodle_user_projection_authority(
    p_user_id, p_active_role_grant_id
  );

  if user_authority.active_role not in (
    'student', 'teacher', 'headofdepartment', 'superadmin'
  ) then
    raise exception 'Role cannot read activity outcome observations'
      using errcode = '42501';
  end if;

  select * into strict effective_grant
  from nile_private.resolve_effective_role_grant(
    p_user_id, p_active_role_grant_id, authority_at
  );

  select
    class_group.id as class_group_id, class_group.status as group_status,
    course_run.id as course_run_id, course_run.status as run_status,
    course_run.starts_on, course_run.ends_on, course_template.id as course_id,
    program.department_id
  into strict class_context
  from public.class_groups as class_group
  join public.course_runs as course_run
    on course_run.id = class_group.course_run_id
   and course_run.status in ('active', 'completed')
  join public.course_templates as course_template
    on course_template.id = course_run.course_template_id
   and course_template.status = 'active'
  join public.programs as program
    on program.id = course_template.program_id
   and program.status = 'active'
  where class_group.id = p_internal_class_group_id
    and class_group.status in ('active', 'completed');

  if user_authority.active_role = 'student' then
    if not exists (
      select 1
      from public.student_profiles as student_profile
      join public.enrollments as enrollment
        on enrollment.student_profile_id = student_profile.id
       and enrollment.course_run_id = class_context.course_run_id
       and enrollment.status in ('active', 'completed')
      join public.class_memberships as membership
        on membership.enrollment_id = enrollment.id
       and membership.course_run_id = class_context.course_run_id
       and membership.class_group_id = class_context.class_group_id
       and (
         (enrollment.status = 'active' and membership.status = 'active'
          and enrollment.starts_at <= authority_at
          and (enrollment.ends_at is null or enrollment.ends_at > authority_at)
          and membership.starts_at <= authority_at
          and (membership.ends_at is null or membership.ends_at > authority_at))
         or (enrollment.status = 'completed' and membership.status = 'ended')
       )
      where student_profile.user_id = p_user_id
        and student_profile.status = 'active'
    ) then
      raise exception 'Student does not own an exact active or completed class enrollment'
        using errcode = '42501';
    end if;
  end if;

  if user_authority.active_role = 'teacher' and (
    class_context.run_status <> 'active'
    or class_context.group_status <> 'active'
    or authority_at::date not between class_context.starts_on and class_context.ends_on
    or not exists (
    select 1
    from public.staff_profiles as teacher_profile
    join public.teacher_assignments as assignment
      on assignment.teacher_profile_id = teacher_profile.id
     and assignment.class_group_id = class_context.class_group_id
     and assignment.status = 'active'
     and assignment.starts_at <= authority_at
     and (assignment.ends_at is null or assignment.ends_at > authority_at)
    where teacher_profile.user_id = p_user_id
      and teacher_profile.status = 'active'
    )
  ) then
    raise exception 'Teacher is not currently assigned to the exact class'
      using errcode = '42501';
  end if;

  if user_authority.active_role = 'headofdepartment'
    and not (class_context.department_id = any(effective_grant.department_ids)) then
    raise exception 'Class is outside the active HOD department scope'
      using errcode = '42501';
  end if;

  select pg_catalog.count(*)::integer,
    (pg_catalog.array_agg(connection.id order by connection.id))[1]
  into connection_count, ready_connection_id
  from public.integration_connections as connection
  where connection.provider = 'moodle'
    and connection.mode = 'read_only'
    and connection.status = 'ready';

  if connection_count <> 1 then
    raise exception 'Activity outcome projection requires exactly one ready read-only Moodle connection'
      using errcode = '42501';
  end if;

  connection_id := ready_connection_id;
  active_role := user_authority.active_role;
  projection_audience := case active_role
    when 'student' then 'learner'
    when 'teacher' then 'person_level'
    else 'aggregate'
  end;
  internal_course_id := class_context.course_id;
  internal_course_run_id := class_context.course_run_id;
  internal_class_group_id := class_context.class_group_id;
  activity_projection_id := p_activity_projection_id;
  observed_at := authority_at;

  if active_role = 'student' then
    authorized_user_ids := array[p_user_id]::uuid[];
  elsif active_role = 'teacher' then
    select coalesce(pg_catalog.array_agg(learner.id order by learner.id), '{}'::uuid[])
    into authorized_user_ids
    from public.class_memberships as membership
    join public.enrollments as enrollment
      on enrollment.id = membership.enrollment_id
     and enrollment.course_run_id = class_context.course_run_id
     and enrollment.status = 'active'
     and enrollment.starts_at <= authority_at
     and (enrollment.ends_at is null or enrollment.ends_at > authority_at)
    join public.student_profiles as student_profile
      on student_profile.id = enrollment.student_profile_id
     and student_profile.status = 'active'
    join public.app_users as learner
      on learner.id = student_profile.user_id and learner.status = 'active'
    where membership.class_group_id = class_context.class_group_id
      and membership.course_run_id = class_context.course_run_id
      and membership.status = 'active'
      and membership.starts_at <= authority_at
      and (membership.ends_at is null or membership.ends_at > authority_at);
  else
    authorized_user_ids := '{}'::uuid[];
  end if;

  select mapping.external_id into course_external_id
  from public.external_records as mapping
  where mapping.connection_id = ready_connection_id
    and mapping.entity_type = 'course'
    and mapping.internal_id = class_context.course_id
    and mapping.sync_state <> 'ignored';
  course_mapping_status := case when course_external_id is not null
    then 'exact' else 'missing' end;
  group_mapping_status := case when exists (
    select 1 from public.external_records as mapping
    where mapping.connection_id = ready_connection_id
      and mapping.entity_type = 'class_group'
      and mapping.internal_id = class_context.class_group_id
      and mapping.sync_state <> 'ignored'
  ) then 'exact' else 'missing' end;
  user_mapping_status := case
    when active_role = 'student' and exists (
      select 1 from public.external_records as mapping
      where mapping.connection_id = ready_connection_id
        and mapping.entity_type = 'user'
        and mapping.internal_id = p_user_id
        and mapping.sync_state <> 'ignored'
    ) then 'exact'
    when active_role = 'student' then 'missing'
    when not exists (
    select 1
    from public.class_memberships as membership
    join public.enrollments as enrollment
      on enrollment.id = membership.enrollment_id
     and enrollment.course_run_id = class_context.course_run_id
     and enrollment.status = 'active'
     and enrollment.starts_at <= authority_at
     and (enrollment.ends_at is null or enrollment.ends_at > authority_at)
    join public.student_profiles as student_profile
      on student_profile.id = enrollment.student_profile_id
     and student_profile.status = 'active'
    join public.app_users as learner
      on learner.id = student_profile.user_id and learner.status = 'active'
    left join public.external_records as mapping
      on mapping.connection_id = ready_connection_id
     and mapping.entity_type = 'user'
     and mapping.internal_id = learner.id
     and mapping.sync_state <> 'ignored'
    where (active_role <> 'teacher' or learner.id = any(authorized_user_ids))
      and membership.class_group_id = class_context.class_group_id
      and membership.course_run_id = class_context.course_run_id
      and membership.status = 'active'
      and membership.starts_at <= authority_at
      and (membership.ends_at is null or membership.ends_at > authority_at)
      and mapping.id is null
  ) then 'exact' else 'missing' end;
  activity_mapping_status := case when course_external_id is not null and exists (
    select 1 from public.external_records as mapping
    where mapping.id = p_activity_projection_id
      and mapping.connection_id = ready_connection_id
      and mapping.entity_type in ('lesson', 'h5p_activity', 'scorm')
      and mapping.external_parent_id = course_external_id
      and mapping.sync_state in ('matched', 'synced')
  ) then 'exact' else 'missing' end;
  select case mapping.entity_type
    when 'lesson' then 'lesson'
    when 'h5p_activity' then 'h5p'
    when 'scorm' then 'scorm'
  end into strict activity_kind
  from public.external_records as mapping
  where mapping.id = p_activity_projection_id
    and mapping.entity_type in ('lesson', 'h5p_activity', 'scorm');

  return next;
exception
  when no_data_found then
    raise exception 'Class context does not resolve to current normalized authority'
      using errcode = '42501';
end;
$$;

create function public.record_moodle_activity_outcome_observation(
  p_idempotency_key text,
  p_connection_id uuid,
  p_internal_course_id uuid,
  p_internal_class_group_id uuid,
  p_activity_projection_id uuid,
  p_external_course_record_id uuid,
  p_external_group_record_id uuid,
  p_sync_run_id uuid,
  p_sync_run_item_id uuid,
  p_audience text,
  p_outcome text,
  p_sanitized_payload jsonb,
  p_projection_hash bytea,
  p_observed_at timestamptz,
  p_fresh_until timestamptz,
  p_retain_until timestamptz,
  p_reconciliation_case_id uuid default null,
  p_reconciliation_reason text default null
)
returns table (observation_id uuid, replayed boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  calculated_request_hash bytea;
  inserted_id uuid;
  existing_observation record;
  class_context record;
  course_mapping record;
  group_mapping record;
  activity_mapping record;
  derived_activity_kind text;
  run_row record;
  item_row record;
  case_row record;
  payload_learner jsonb;
  derived_subject_user_id uuid;
  roster_count integer;
  mapped_count integer;
begin
  if p_idempotency_key is null
    or p_idempotency_key !~ '^[a-z0-9][a-z0-9._:-]{7,127}$'
    or p_audience not in ('learner', 'person_level', 'aggregate')
    or p_outcome not in ('available', 'empty', 'unavailable', 'reconciliation')
    or (p_audience = 'learner' and p_outcome <> 'available')
    or p_observed_at is null then
    raise exception 'Invalid activity outcome observation metadata'
      using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.integration_connections as connection
    where connection.id = p_connection_id
      and connection.provider = 'moodle'
      and connection.mode = 'read_only'
      and connection.status = 'ready'
  ) then
    raise exception 'Observation connection is not ready read-only Moodle'
      using errcode = '42501';
  end if;

  select course_template.id as course_id, course_run.id as run_id, class_group.id as group_id
  into strict class_context
  from public.class_groups as class_group
  join public.course_runs as course_run
    on course_run.id = class_group.course_run_id
   and course_run.status = 'active'
   and course_run.starts_on <= p_observed_at::date
   and course_run.ends_on >= p_observed_at::date
  join public.course_templates as course_template
    on course_template.id = course_run.course_template_id
   and course_template.status = 'active'
  where class_group.id = p_internal_class_group_id
    and class_group.status = 'active';

  if class_context.course_id is distinct from p_internal_course_id then
    raise exception 'Observation course and class context do not match'
      using errcode = '23514';
  end if;

  if p_outcome in ('available', 'empty') then
    if p_sanitized_payload is null
      or not nile_private.moodle_activity_outcome_payload_is_safe(
        p_sanitized_payload, p_audience
      )
      or p_projection_hash is null
      or p_projection_hash is distinct from public.digest(
        pg_catalog.convert_to(p_sanitized_payload::text, 'UTF8'), 'sha256'
      )
      or p_fresh_until is distinct from p_observed_at + interval '15 minutes'
      or p_retain_until is null or p_retain_until <= p_fresh_until
      or p_retain_until > p_observed_at + interval '30 days'
      or p_reconciliation_case_id is not null
      or p_reconciliation_reason is not null
      or (p_sanitized_payload->>'internalCourseId')::uuid <> p_internal_course_id
      or (p_sanitized_payload->>'internalClassGroupId')::uuid <> p_internal_class_group_id
      or (p_sanitized_payload->>'activityProjectionId')::uuid <> p_activity_projection_id
      or p_sanitized_payload->>'providerState' <> p_outcome
      or (p_outcome = 'empty' and p_sanitized_payload->>'mappingStatus' <> 'exact') then
      raise exception 'Successful observation requires an exact safe bounded projection'
        using errcode = '22023';
    end if;
  elsif p_sanitized_payload is not null or p_projection_hash is not null
    or p_fresh_until is not null or p_retain_until is not null then
    raise exception 'Unavailable and reconciliation outcomes cannot retain payloads'
      using errcode = '22023';
  end if;

  if p_outcome = 'reconciliation' then
    if p_reconciliation_case_id is null or p_reconciliation_reason not in (
      'missing_course_mapping', 'missing_group_mapping',
      'missing_user_mapping', 'missing_activity_mapping',
      'provider_result_drift', 'ambiguous_mapping'
    ) then
      raise exception 'Reconciliation requires one bounded case and reason'
        using errcode = '22023';
    end if;
  elsif p_reconciliation_case_id is not null or p_reconciliation_reason is not null then
    raise exception 'Only reconciliation outcomes can reference a case'
      using errcode = '22023';
  end if;

  if p_external_course_record_id is not null then
    select mapping.connection_id, mapping.internal_id, mapping.external_id
    into strict course_mapping
    from public.external_records as mapping
    where mapping.id = p_external_course_record_id
      and mapping.entity_type = 'course' and mapping.sync_state <> 'ignored';
    if course_mapping.connection_id <> p_connection_id
      or course_mapping.internal_id <> p_internal_course_id then
      raise exception 'Course mapping is outside the exact observation context'
        using errcode = '23514';
    end if;
  elsif p_outcome in ('available', 'empty') then
    raise exception 'Successful observation requires an exact course mapping'
      using errcode = '23514';
  end if;

  if p_external_group_record_id is not null then
    select mapping.connection_id, mapping.internal_id, mapping.external_id
    into strict group_mapping
    from public.external_records as mapping
    where mapping.id = p_external_group_record_id
      and mapping.entity_type = 'class_group' and mapping.sync_state <> 'ignored';
    if group_mapping.connection_id <> p_connection_id
      or group_mapping.internal_id <> p_internal_class_group_id then
      raise exception 'Group mapping is outside the exact observation context'
        using errcode = '23514';
    end if;
  elsif p_outcome in ('available', 'empty') then
    raise exception 'Successful observation requires an exact group mapping'
      using errcode = '23514';
  end if;

  select mapping.connection_id, mapping.external_parent_id, mapping.external_id,
    case mapping.entity_type
      when 'lesson' then 'lesson'
      when 'h5p_activity' then 'h5p'
      when 'scorm' then 'scorm'
    end as activity_kind
  into strict activity_mapping
  from public.external_records as mapping
  where mapping.id = p_activity_projection_id
    and mapping.entity_type in ('lesson', 'h5p_activity', 'scorm')
    and mapping.sync_state in ('matched', 'synced');
  if activity_mapping.connection_id <> p_connection_id
    or activity_mapping.external_parent_id <> course_mapping.external_id then
    raise exception 'Activity mapping is outside the exact course context'
      using errcode = '23514';
  end if;
  derived_activity_kind := activity_mapping.activity_kind;
  if p_outcome in ('available', 'empty')
    and p_sanitized_payload->>'activityKind' <> derived_activity_kind then
    raise exception 'Activity kind does not match the exact mapping'
      using errcode = '23514';
  end if;

  if p_outcome = 'available' and p_audience in ('learner', 'person_level') then
    for payload_learner in
      select item.value from pg_catalog.jsonb_array_elements(
        p_sanitized_payload->'learners'
      ) as item(value)
    loop
      if not exists (
        select 1
        from public.class_memberships as membership
        join public.enrollments as enrollment
          on enrollment.id = membership.enrollment_id
         and enrollment.course_run_id = class_context.run_id
         and enrollment.status = 'active'
         and enrollment.starts_at <= p_observed_at
         and (enrollment.ends_at is null or enrollment.ends_at > p_observed_at)
        join public.student_profiles as student_profile
          on student_profile.id = enrollment.student_profile_id
         and student_profile.status = 'active'
        join public.app_users as learner
          on learner.id = student_profile.user_id and learner.status = 'active'
        where membership.id = (payload_learner->>'internalMembershipId')::uuid
          and enrollment.id = (payload_learner->>'internalEnrollmentId')::uuid
          and learner.id = (payload_learner->>'internalUserId')::uuid
          and membership.class_group_id = p_internal_class_group_id
          and membership.course_run_id = class_context.run_id
          and membership.status = 'active'
          and membership.starts_at <= p_observed_at
          and (membership.ends_at is null or membership.ends_at > p_observed_at)
      ) then
        raise exception 'Person-level payload contains a noncurrent learner tuple'
          using errcode = '23514';
      end if;

      if not exists (
        select 1 from public.external_records as user_mapping
        where user_mapping.connection_id = p_connection_id
          and user_mapping.entity_type = 'user'
          and user_mapping.internal_id = (payload_learner->>'internalUserId')::uuid
          and user_mapping.sync_state <> 'ignored'
      ) then
        raise exception 'Person-level result lacks an exact user mapping'
          using errcode = '23514';
      end if;

    end loop;

    select pg_catalog.count(*)::integer into roster_count
    from public.class_memberships as membership
    join public.enrollments as enrollment
      on enrollment.id = membership.enrollment_id
     and enrollment.course_run_id = class_context.run_id
     and enrollment.status = 'active'
     and enrollment.starts_at <= p_observed_at
     and (enrollment.ends_at is null or enrollment.ends_at > p_observed_at)
    join public.student_profiles as student_profile
      on student_profile.id = enrollment.student_profile_id and student_profile.status = 'active'
    join public.app_users as learner
      on learner.id = student_profile.user_id and learner.status = 'active'
    where membership.class_group_id = p_internal_class_group_id
      and membership.course_run_id = class_context.run_id
      and membership.status = 'active'
      and membership.starts_at <= p_observed_at
      and (membership.ends_at is null or membership.ends_at > p_observed_at);

    if p_audience = 'learner' then
      if pg_catalog.jsonb_array_length(p_sanitized_payload->'learners') <> 1 then
        raise exception 'Learner result must contain exactly one learner tuple'
          using errcode = '23514';
      end if;
      derived_subject_user_id := (p_sanitized_payload->'learners'->0->>'internalUserId')::uuid;
    elsif roster_count <> pg_catalog.jsonb_array_length(p_sanitized_payload->'learners')
      or roster_count <> (
        select pg_catalog.count(distinct item.value->>'internalUserId')
        from pg_catalog.jsonb_array_elements(p_sanitized_payload->'learners') as item(value)
      ) then
      raise exception 'Person-level payload is not the exact current class roster'
        using errcode = '23514';
    end if;

  elsif p_outcome = 'empty' and p_audience in ('learner', 'person_level')
    and pg_catalog.jsonb_array_length(p_sanitized_payload->'learners') <> 0 then
    raise exception 'Empty person-level projection must contain no learners'
      using errcode = '23514';
  elsif p_outcome = 'available' and p_audience = 'aggregate' then
    select pg_catalog.count(*)::integer, pg_catalog.count(user_mapping.id)::integer
    into roster_count, mapped_count
    from public.class_memberships as membership
    join public.enrollments as enrollment
      on enrollment.id = membership.enrollment_id
     and enrollment.course_run_id = class_context.run_id
     and enrollment.status = 'active'
     and enrollment.starts_at <= p_observed_at
     and (enrollment.ends_at is null or enrollment.ends_at > p_observed_at)
    join public.student_profiles as student_profile
      on student_profile.id = enrollment.student_profile_id and student_profile.status = 'active'
    join public.app_users as learner
      on learner.id = student_profile.user_id and learner.status = 'active'
    left join public.external_records as user_mapping
      on user_mapping.connection_id = p_connection_id
     and user_mapping.entity_type = 'user'
     and user_mapping.internal_id = learner.id
     and user_mapping.sync_state <> 'ignored'
    where membership.class_group_id = p_internal_class_group_id
      and membership.course_run_id = class_context.run_id
      and membership.status = 'active'
      and membership.starts_at <= p_observed_at
      and (membership.ends_at is null or membership.ends_at > p_observed_at);

    if (p_sanitized_payload->>'learnerCount')::integer <> roster_count
      or mapped_count <> roster_count
      then
      raise exception 'Aggregate counts require the exact fully mapped current class'
        using errcode = '23514';
    end if;
  elsif p_outcome = 'empty' and p_audience = 'aggregate'
    and (
      (p_sanitized_payload->>'learnerCount')::integer <> 0
      or (p_sanitized_payload->>'startedCount')::integer <> 0
      or (p_sanitized_payload->>'completedCount')::integer <> 0
      or (p_sanitized_payload->>'passedCount')::integer <> 0
      or (p_sanitized_payload->>'failedCount')::integer <> 0
      or (p_sanitized_payload->>'scoredCount')::integer <> 0
    ) then
    raise exception 'Empty aggregate projection must contain zero counts'
      using errcode = '23514';
  end if;

  select sync_run.connection_id, sync_run.entity_type,
    sync_run.direction, sync_run.status
  into strict run_row
  from public.sync_runs as sync_run where sync_run.id = p_sync_run_id;
  select item.sync_run_id, item.external_record_id,
    item.external_id, item.status
  into strict item_row
  from public.sync_run_items as item where item.id = p_sync_run_item_id;

  if run_row.connection_id <> p_connection_id
    or run_row.entity_type <> 'activity_outcomes_projection'
    or run_row.direction <> 'read'
    or run_row.status not in ('succeeded', 'partial', 'failed')
    or item_row.sync_run_id <> p_sync_run_id
    or item_row.external_record_id is distinct from p_activity_projection_id
    or item_row.external_id is distinct from activity_mapping.external_id
    or (p_outcome in ('available', 'empty') and item_row.status <> 'succeeded')
    or (p_outcome = 'unavailable' and item_row.status <> 'failed')
    or (p_outcome = 'reconciliation' and item_row.status <> 'needs_review') then
    raise exception 'Observation sync evidence is outside the exact read context'
      using errcode = '23514';
  end if;

  if p_outcome = 'reconciliation' then
    select reconciliation.connection_id, reconciliation.entity_type,
      reconciliation.internal_id, reconciliation.external_id,
      reconciliation.reason, reconciliation.status
    into strict case_row
    from public.reconciliation_cases as reconciliation
    where reconciliation.id = p_reconciliation_case_id;
    if case_row.connection_id <> p_connection_id
      or case_row.entity_type <> 'activity_outcomes_projection'
      or case_row.internal_id <> p_activity_projection_id
      or case_row.external_id is distinct from item_row.external_id
      or case_row.reason <> p_reconciliation_reason
      or case_row.status <> 'open' then
      raise exception 'Reconciliation case is outside the exact class context'
        using errcode = '23514';
    end if;
  end if;

  calculated_request_hash := public.digest(
    pg_catalog.convert_to(pg_catalog.jsonb_build_array(
      p_connection_id::text, p_internal_course_id::text,
      p_internal_class_group_id::text, p_activity_projection_id::text,
      derived_activity_kind,
      p_external_course_record_id::text,
      p_external_group_record_id::text, p_sync_run_id::text,
      p_sync_run_item_id::text, p_audience, p_outcome, p_sanitized_payload,
      pg_catalog.encode(p_projection_hash, 'hex'), p_observed_at::text,
      p_fresh_until::text, p_retain_until::text,
      p_reconciliation_case_id::text, p_reconciliation_reason
    )::text, 'UTF8'), 'sha256'
  );

  insert into public.moodle_activity_outcome_observations (
    idempotency_key, request_hash, connection_id, internal_course_id,
    internal_class_group_id, activity_projection_id, activity_kind,
    subject_user_id,
    external_course_record_id,
    external_group_record_id, sync_run_id, sync_run_item_id,
    reconciliation_case_id, audience, outcome, reconciliation_reason,
    sanitized_payload, projection_hash, observed_at, fresh_until, retain_until,
    purge_after
  ) values (
    p_idempotency_key, calculated_request_hash, p_connection_id,
    p_internal_course_id, p_internal_class_group_id, p_activity_projection_id,
    derived_activity_kind, derived_subject_user_id,
    p_external_course_record_id, p_external_group_record_id,
    p_sync_run_id, p_sync_run_item_id, p_reconciliation_case_id,
    p_audience, p_outcome, p_reconciliation_reason, p_sanitized_payload,
    p_projection_hash, p_observed_at, p_fresh_until, p_retain_until,
    p_observed_at + interval '30 days'
  ) on conflict (idempotency_key) do nothing returning id into inserted_id;

  if inserted_id is not null then
    return query select inserted_id, false;
    return;
  end if;

  select observation.id, observation.request_hash into strict existing_observation
  from public.moodle_activity_outcome_observations as observation
  where observation.idempotency_key = p_idempotency_key;
  if existing_observation.request_hash is distinct from calculated_request_hash then
    raise exception 'Activity outcome observation idempotency conflict'
      using errcode = '23505';
  end if;
  return query select existing_observation.id, true;
exception
  when no_data_found then
    raise exception 'Observation references missing or inactive exact evidence'
      using errcode = '23514';
end;
$$;

create function public.list_authorized_moodle_activity_outcome_freshness(
  p_user_id uuid,
  p_active_role_grant_id uuid,
  p_connection_id uuid,
  p_internal_class_group_id uuid,
  p_activity_projection_id uuid,
  p_as_of timestamptz
)
returns table (
  connection_id uuid,
  active_role text,
  projection_audience text,
  internal_course_id uuid,
  internal_class_group_id uuid,
  activity_projection_id uuid,
  activity_kind text,
  authorized_user_ids uuid[],
  course_mapping_status text,
  group_mapping_status text,
  user_mapping_status text,
  activity_mapping_status text,
  freshness_state text,
  latest_outcome text,
  reconciliation_reason text,
  sanitized_payload jsonb,
  projection_hash bytea,
  successful_sync_run_id uuid,
  successful_observed_at timestamptz,
  fresh_until timestamptz,
  retain_until timestamptz,
  latest_observed_at timestamptz,
  authority_observed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  context record;
begin
  if p_as_of is null then
    raise exception 'Freshness evaluation requires an explicit timestamp'
      using errcode = '22023';
  end if;

  select * into strict context
  from public.resolve_moodle_activity_outcome_context(
    p_user_id, p_active_role_grant_id, p_internal_class_group_id,
    p_activity_projection_id
  );
  if context.connection_id <> p_connection_id then
    raise exception 'Connection is outside the live class authority context'
      using errcode = '42501';
  end if;

  return query
  select
    context.connection_id, context.active_role, context.projection_audience,
    context.internal_course_id, context.internal_class_group_id,
    context.activity_projection_id, context.activity_kind,
    context.authorized_user_ids,
    context.course_mapping_status, context.group_mapping_status,
    context.user_mapping_status, context.activity_mapping_status,
    case
      when context.course_mapping_status <> 'exact'
        or context.group_mapping_status <> 'exact'
        or context.activity_mapping_status <> 'exact'
        or context.user_mapping_status = 'missing' then 'reconciliation'
      when retained_success.id is not null
        and latest_observation.id = retained_success.id
        and p_as_of <= retained_success.fresh_until then 'fresh'
      when retained_success.id is not null then 'stale_retained'
      when prior_success.id is not null then 'expired'
      when latest_observation.outcome = 'reconciliation' then 'reconciliation'
      else 'unavailable'
    end,
    latest_observation.outcome,
    latest_observation.reconciliation_reason,
    retained_success.sanitized_payload,
    retained_success.projection_hash,
    retained_success.sync_run_id,
    retained_success.observed_at,
    retained_success.fresh_until,
    retained_success.retain_until,
    latest_observation.observed_at,
    context.observed_at
  from (select 1) as singleton
  left join lateral (
    select observation.*
    from public.moodle_activity_outcome_observations as observation
    where observation.connection_id = context.connection_id
      and observation.internal_course_id = context.internal_course_id
      and observation.internal_class_group_id = context.internal_class_group_id
      and observation.activity_projection_id = context.activity_projection_id
      and observation.activity_kind = context.activity_kind
      and observation.audience = context.projection_audience
      and (context.projection_audience <> 'learner'
        or observation.subject_user_id = context.authorized_user_ids[1])
      and observation.observed_at <= p_as_of
    order by observation.observed_at desc, observation.id desc limit 1
  ) as latest_observation on true
  left join lateral (
    select observation.*
    from public.moodle_activity_outcome_observations as observation
    where observation.connection_id = context.connection_id
      and observation.internal_course_id = context.internal_course_id
      and observation.internal_class_group_id = context.internal_class_group_id
      and observation.activity_projection_id = context.activity_projection_id
      and observation.activity_kind = context.activity_kind
      and observation.audience = context.projection_audience
      and (context.projection_audience <> 'learner'
        or observation.subject_user_id = context.authorized_user_ids[1])
      and observation.outcome in ('available', 'empty')
      and context.course_mapping_status = 'exact'
      and context.group_mapping_status = 'exact'
      and context.user_mapping_status <> 'missing'
      and context.activity_mapping_status = 'exact'
      and (
        context.projection_audience = 'aggregate'
        or not exists (
          select 1
          from pg_catalog.jsonb_array_elements(
            observation.sanitized_payload->'learners'
          ) as retained_learner(value)
          where not (
            (retained_learner.value->>'internalUserId')::uuid
              = any(context.authorized_user_ids)
          )
        )
      )
      and observation.observed_at <= p_as_of
      and p_as_of <= observation.retain_until
    order by observation.observed_at desc, observation.id desc limit 1
  ) as retained_success on true
  left join lateral (
    select observation.id
    from public.moodle_activity_outcome_observations as observation
    where observation.connection_id = context.connection_id
      and observation.internal_course_id = context.internal_course_id
      and observation.internal_class_group_id = context.internal_class_group_id
      and observation.activity_projection_id = context.activity_projection_id
      and observation.activity_kind = context.activity_kind
      and observation.audience = context.projection_audience
      and (context.projection_audience <> 'learner'
        or observation.subject_user_id = context.authorized_user_ids[1])
      and observation.outcome in ('available', 'empty')
      and observation.observed_at <= p_as_of
    order by observation.observed_at desc, observation.id desc limit 1
  ) as prior_success on true;
end;
$$;

create function nile_private.guard_moodle_activity_outcome_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  purge_cutoff timestamptz;
begin
  if tg_op = 'DELETE'
    and pg_catalog.current_setting('nile.phase6h4_purge', true) = 'bounded' then
    purge_cutoff := pg_catalog.current_setting(
      'nile.phase6h4_purge_cutoff', true
    )::timestamptz;
    if old.purge_after <= purge_cutoff then
      return old;
    end if;
  end if;
  raise exception 'Moodle activity outcome observations are immutable'
    using errcode = '55000';
end;
$$;

create function public.purge_moodle_activity_outcome_observations(
  p_as_of timestamptz,
  p_limit integer default 500
)
returns table (deleted_count integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_as_of is null or p_limit is null or p_limit < 1 or p_limit > 1000 then
    raise exception 'Bounded purge requires a timestamp and limit from 1 through 1000'
      using errcode = '22023';
  end if;
  perform pg_catalog.set_config('nile.phase6h4_purge', 'bounded', true);
  perform pg_catalog.set_config('nile.phase6h4_purge_cutoff', p_as_of::text, true);
  return query
  with candidates as (
    select observation.id
    from public.moodle_activity_outcome_observations as observation
    where observation.purge_after <= p_as_of
    order by observation.purge_after, observation.id
    limit p_limit
    for update
  ), deleted as (
    delete from public.moodle_activity_outcome_observations as observation
    using candidates
    where observation.id = candidates.id
    returning observation.id
  )
  select pg_catalog.count(*)::integer from deleted;
end;
$$;

create trigger moodle_activity_outcome_observations_immutable
before update or delete on public.moodle_activity_outcome_observations
for each row execute function nile_private.guard_moodle_activity_outcome_immutable();

alter table public.moodle_activity_outcome_observations enable row level security;
alter table public.moodle_activity_outcome_observations force row level security;

revoke all on table public.moodle_activity_outcome_observations
from public, anon, authenticated, service_role;
revoke all on function nile_private.moodle_activity_outcome_payload_is_safe(jsonb, text)
from public, anon, authenticated, service_role;
revoke all on function nile_private.guard_moodle_activity_outcome_immutable()
from public, anon, authenticated, service_role;

revoke all on function public.resolve_moodle_activity_outcome_context(uuid, uuid, uuid, uuid)
from public, anon, authenticated;
revoke all on function public.record_moodle_activity_outcome_observation(text, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, text, jsonb, bytea, timestamptz, timestamptz, timestamptz, uuid, text)
from public, anon, authenticated;
revoke all on function public.list_authorized_moodle_activity_outcome_freshness(uuid, uuid, uuid, uuid, uuid, timestamptz)
from public, anon, authenticated;
revoke all on function public.purge_moodle_activity_outcome_observations(timestamptz, integer)
from public, anon, authenticated;

grant execute on function public.resolve_moodle_activity_outcome_context(uuid, uuid, uuid, uuid)
to service_role;
grant execute on function public.record_moodle_activity_outcome_observation(text, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, text, jsonb, bytea, timestamptz, timestamptz, timestamptz, uuid, text)
to service_role;
grant execute on function public.list_authorized_moodle_activity_outcome_freshness(uuid, uuid, uuid, uuid, uuid, timestamptz)
to service_role;
grant execute on function public.purge_moodle_activity_outcome_observations(timestamptz, integer)
to service_role;

commit;

-- ============================================================================
-- 19. Transactional email delivery
-- Source: supabase/manual/016_transactional_email_delivery.sql
-- SHA-256: d44124abad963f22ac7e4822ff199bee7d56613ffcb6e4c19c08d5b842f2f87d
-- ============================================================================

-- Nile Learn transactional email delivery foundation.
-- Manual-only and intentionally unapplied. No provider credential is stored.
-- Requires the accepted Phase 1 identity, command, audit, and outbox schema.

begin;

do $$
declare
  dependency text;
begin
  foreach dependency in array array[
    'app_users', 'command_executions', 'audit_logs', 'outbox_events'
  ] loop
    if pg_catalog.to_regclass('public.' || dependency) is null then
      raise exception 'Transactional email delivery requires public.%', dependency;
    end if;
  end loop;

  if pg_catalog.to_regprocedure('nile_private.jsonb_has_forbidden_keys(jsonb)') is null
    or pg_catalog.to_regprocedure('nile_private.set_updated_at()') is null then
    raise exception 'Transactional email delivery requires Phase 1 safety helpers';
  end if;
end;
$$;

create or replace function nile_private.email_outbox_payload_is_safe(payload jsonb)
returns boolean
language plpgsql
immutable
strict
security invoker
set search_path = ''
as $$
declare
  root_keys text[];
begin
  if pg_catalog.jsonb_typeof(payload) <> 'object'
    or pg_catalog.octet_length(payload::text) > 32768
    or nile_private.jsonb_has_forbidden_keys(payload) then
    return false;
  end if;

  select pg_catalog.array_agg(key order by key)
  into root_keys
  from pg_catalog.jsonb_object_keys(payload) as key;

  if root_keys is distinct from array[
    'locale', 'recipientUserId', 'schemaVersion', 'templateKey',
    'templateVersion', 'variables'
  ]::text[]
    or payload->>'schemaVersion' <> '1'
    or payload->>'templateKey' not in (
      'account_recovery', 'enrollment_activated', 'placement_updated',
      'schedule_changed', 'attendance_alert', 'grading_feedback',
      'certificate_issued', 'message_notification'
    )
    or payload->>'templateVersion' <> '1'
    or payload->>'locale' not in ('en', 'ar', 'zh', 'ru', 'ur', 'tr')
    or (payload->>'recipientUserId') !~
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or pg_catalog.jsonb_typeof(payload->'variables') <> 'object'
    or (
      select pg_catalog.count(*)
      from pg_catalog.jsonb_object_keys(payload->'variables')
    ) > 24 then
    return false;
  end if;

  return true;
end;
$$;

create table if not exists public.email_deliveries (
  id uuid primary key default gen_random_uuid(),
  outbox_event_id uuid not null unique
    references public.outbox_events(id) on delete restrict,
  recipient_user_id uuid not null references public.app_users(id) on delete restrict,
  recipient_address_hash bytea,
  provider text not null default 'resend' check (provider = 'resend'),
  provider_message_id text unique,
  template_key text not null check (template_key in (
    'account_recovery', 'enrollment_activated', 'placement_updated',
    'schedule_changed', 'attendance_alert', 'grading_feedback',
    'certificate_issued', 'message_notification'
  )),
  template_version integer not null check (template_version = 1),
  locale text not null check (locale in ('en', 'ar', 'zh', 'ru', 'ur', 'tr')),
  status text not null default 'queued' check (status in (
    'queued', 'processing', 'retry', 'sent', 'delivered', 'delayed',
    'bounced', 'complained', 'failed', 'suppressed', 'dead_letter'
  )),
  attempts integer not null default 0 check (attempts between 0 and 5),
  locked_at timestamptz,
  locked_by text,
  lease_until timestamptz,
  last_error_code text,
  sent_at timestamptz,
  delivered_at timestamptz,
  last_provider_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (recipient_address_hash is null or octet_length(recipient_address_hash) = 32),
  check (provider_message_id is null or (
    length(provider_message_id) between 3 and 200
    and provider_message_id ~ '^[A-Za-z0-9._:-]+$'
  )),
  check (last_error_code is null or (
    length(last_error_code) between 3 and 80
    and last_error_code ~ '^[a-z0-9._:-]+$'
  )),
  check (
    (status = 'processing' and locked_at is not null and locked_by is not null
      and lease_until is not null and lease_until > locked_at)
    or (status <> 'processing' and locked_at is null and locked_by is null
      and lease_until is null)
  ),
  check (status not in ('sent', 'delivered', 'delayed', 'bounced', 'complained')
    or provider_message_id is not null),
  check (sent_at is null or provider_message_id is not null),
  check (delivered_at is null or status = 'delivered')
);

create table if not exists public.email_suppressions (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.app_users(id) on delete restrict,
  provider text not null default 'resend' check (provider = 'resend'),
  reason text not null check (reason in ('bounced', 'complained', 'provider_suppressed')),
  status text not null default 'active' check (status in ('active', 'released')),
  source_delivery_id uuid references public.email_deliveries(id) on delete restrict,
  source_webhook_id text not null,
  suppressed_at timestamptz not null,
  released_at timestamptz,
  released_by uuid references public.app_users(id) on delete restrict,
  release_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recipient_user_id, provider),
  check (length(source_webhook_id) between 3 and 200),
  check (
    (status = 'active' and released_at is null and released_by is null
      and release_reason is null)
    or (status = 'released' and released_at is not null
      and released_by is not null and length(release_reason) between 8 and 500)
  )
);

create table if not exists public.email_webhook_events (
  webhook_id text primary key,
  provider text not null default 'resend' check (provider = 'resend'),
  provider_message_id text not null,
  event_type text not null check (event_type in (
    'email.sent', 'email.scheduled', 'email.delivered',
    'email.delivery_delayed', 'email.complained', 'email.bounced',
    'email.failed', 'email.suppressed'
  )),
  event_created_at timestamptz not null,
  payload_hash bytea not null check (octet_length(payload_hash) = 32),
  delivery_id uuid references public.email_deliveries(id) on delete restrict,
  processed_at timestamptz not null default now(),
  check (length(webhook_id) between 3 and 200),
  check (length(provider_message_id) between 3 and 200),
  check (provider_message_id ~ '^[A-Za-z0-9._:-]+$')
);

create index if not exists email_deliveries_status_time_idx
  on public.email_deliveries (status, updated_at);
create index if not exists email_deliveries_recipient_time_idx
  on public.email_deliveries (recipient_user_id, created_at desc);
create index if not exists email_suppressions_active_recipient_idx
  on public.email_suppressions (recipient_user_id)
  where status = 'active';
create index if not exists email_webhook_events_message_time_idx
  on public.email_webhook_events (provider_message_id, event_created_at desc);

drop trigger if exists email_deliveries_set_updated_at on public.email_deliveries;
create trigger email_deliveries_set_updated_at
before update on public.email_deliveries
for each row execute function nile_private.set_updated_at();

drop trigger if exists email_suppressions_set_updated_at on public.email_suppressions;
create trigger email_suppressions_set_updated_at
before update on public.email_suppressions
for each row execute function nile_private.set_updated_at();

alter table public.email_deliveries enable row level security;
alter table public.email_deliveries force row level security;
alter table public.email_suppressions enable row level security;
alter table public.email_suppressions force row level security;
alter table public.email_webhook_events enable row level security;
alter table public.email_webhook_events force row level security;

revoke all on table public.email_deliveries from public, anon, authenticated;
revoke all on table public.email_suppressions from public, anon, authenticated;
revoke all on table public.email_webhook_events from public, anon, authenticated;
revoke all on table public.email_deliveries from service_role;
revoke all on table public.email_suppressions from service_role;
revoke all on table public.email_webhook_events from service_role;

create or replace function public.nile_claim_email_delivery(
  p_worker_id text,
  p_lease_seconds integer
)
returns table (
  delivery_id uuid,
  outbox_event_id uuid,
  recipient_user_id uuid,
  recipient_email text,
  template_key text,
  template_version integer,
  locale text,
  variables jsonb,
  idempotency_key text,
  attempt_number integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.outbox_events%rowtype;
  user_row public.app_users%rowtype;
  delivery_row public.email_deliveries%rowtype;
  recipient_id uuid;
begin
  if p_worker_id is null or length(p_worker_id) not between 8 and 120
    or p_worker_id !~ '^[A-Za-z0-9._:-]+$'
    or p_lease_seconds not between 30 and 300 then
    raise exception 'Email delivery lease request is invalid'
      using errcode = '22023';
  end if;

  loop
    select event.* into event_row
    from public.outbox_events as event
    left join public.email_deliveries as delivery
      on delivery.outbox_event_id = event.id
    where event.event_type = 'email.delivery.requested'
      and event.available_at <= now()
      and (
        event.status in ('pending', 'failed')
        or (event.status = 'processing' and delivery.lease_until <= now())
      )
    order by event.available_at, event.created_at
    for update of event skip locked
    limit 1;

    if not found then
      return;
    end if;

    if not nile_private.email_outbox_payload_is_safe(event_row.payload)
      or length(event_row.idempotency_key) > 256 then
      update public.outbox_events
      set status = 'dead_letter', locked_at = null, locked_by = null,
        attempts = least(attempts + 1, 5), last_error = 'invalid_email_payload',
        processed_at = null
      where id = event_row.id;
      continue;
    end if;

    recipient_id := (event_row.payload->>'recipientUserId')::uuid;
    select app_user.* into user_row
    from public.app_users as app_user
    where app_user.id = recipient_id and app_user.status = 'active';

    if not found then
      update public.outbox_events
      set status = 'dead_letter', locked_at = null, locked_by = null,
        attempts = least(attempts + 1, 5), last_error = 'recipient_unavailable',
        processed_at = null
      where id = event_row.id;
      continue;
    end if;

    if exists (
      select 1 from public.email_suppressions as suppression
      where suppression.recipient_user_id = recipient_id
        and suppression.provider = 'resend' and suppression.status = 'active'
    ) then
      update public.outbox_events
      set status = 'processing', locked_at = now(), locked_by = p_worker_id,
        attempts = least(attempts + 1, 5), last_error = null,
        processed_at = null
      where id = event_row.id
      returning * into event_row;

      insert into public.email_deliveries (
        outbox_event_id, recipient_user_id, template_key, template_version,
        locale, status, attempts, last_error_code
      ) values (
        event_row.id, recipient_id, event_row.payload->>'templateKey', 1,
        event_row.payload->>'locale', 'suppressed',
        event_row.attempts, 'recipient_suppressed'
      ) on conflict on constraint email_deliveries_outbox_event_id_key do update set
        status = 'suppressed', attempts = least(public.email_deliveries.attempts + 1, 5),
        locked_at = null, locked_by = null, lease_until = null,
        last_error_code = 'recipient_suppressed';

      update public.outbox_events
      set status = 'succeeded', locked_at = null, locked_by = null,
        last_error = null, processed_at = now()
      where id = event_row.id;
      continue;
    end if;

    update public.outbox_events
    set status = 'processing', locked_at = now(), locked_by = p_worker_id,
      attempts = least(attempts + 1, 5), last_error = null,
      processed_at = null
    where id = event_row.id
    returning * into event_row;

    insert into public.email_deliveries (
      outbox_event_id, recipient_user_id, template_key, template_version,
      locale, status, attempts, locked_at, locked_by, lease_until,
      last_error_code
    ) values (
      event_row.id, recipient_id, event_row.payload->>'templateKey', 1,
      event_row.payload->>'locale', 'processing', event_row.attempts,
      event_row.locked_at, p_worker_id,
      event_row.locked_at + pg_catalog.make_interval(secs => p_lease_seconds), null
    ) on conflict on constraint email_deliveries_outbox_event_id_key do update set
      status = 'processing', attempts = excluded.attempts,
      locked_at = excluded.locked_at, locked_by = excluded.locked_by,
      lease_until = excluded.lease_until, last_error_code = null
    returning * into delivery_row;

    return query select
      delivery_row.id, event_row.id, recipient_id, user_row.email::text,
      delivery_row.template_key, delivery_row.template_version,
      delivery_row.locale, event_row.payload->'variables',
      event_row.idempotency_key, delivery_row.attempts;
    return;
  end loop;
end;
$$;

create or replace function public.nile_complete_email_delivery(
  p_delivery_id uuid,
  p_worker_id text,
  p_outcome text,
  p_provider_message_id text default null,
  p_recipient_hash text default null,
  p_error_code text default null,
  p_retry_after_seconds integer default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  delivery_row public.email_deliveries%rowtype;
begin
  select delivery.* into strict delivery_row
  from public.email_deliveries as delivery
  where delivery.id = p_delivery_id
  for update;

  if delivery_row.status <> 'processing'
    or delivery_row.locked_by is distinct from p_worker_id
    or delivery_row.lease_until < now() then
    raise exception 'Email delivery lease is not current'
      using errcode = '40001';
  end if;

  if p_outcome = 'sent' then
    if p_provider_message_id is null
      or p_provider_message_id !~ '^[A-Za-z0-9._:-]{3,200}$'
      or p_recipient_hash !~ '^[a-f0-9]{64}$'
      or p_error_code is not null or p_retry_after_seconds is not null then
      raise exception 'Sent email completion evidence is invalid'
        using errcode = '22023';
    end if;

    update public.email_deliveries set
      status = 'sent', provider_message_id = p_provider_message_id,
      recipient_address_hash = pg_catalog.decode(p_recipient_hash, 'hex'),
      sent_at = now(), locked_at = null, locked_by = null, lease_until = null,
      last_error_code = null
    where id = p_delivery_id;

    update public.outbox_events set
      status = 'succeeded', locked_at = null, locked_by = null,
      processed_at = now(), last_error = null
    where id = delivery_row.outbox_event_id;
    return;
  end if;

  if p_error_code is null or p_error_code !~ '^[a-z0-9._:-]{3,80}$'
    or p_provider_message_id is not null or p_recipient_hash is not null then
    raise exception 'Failed email completion evidence is invalid'
      using errcode = '22023';
  end if;

  if p_outcome = 'retry' then
    if p_retry_after_seconds not between 30 and 3600
      or delivery_row.attempts >= 5 then
      raise exception 'Email retry request is invalid'
        using errcode = '22023';
    end if;
    update public.email_deliveries set
      status = 'retry', locked_at = null, locked_by = null, lease_until = null,
      last_error_code = p_error_code
    where id = p_delivery_id;
    update public.outbox_events set
      status = 'failed', locked_at = null, locked_by = null,
      available_at = now() + pg_catalog.make_interval(secs => p_retry_after_seconds),
      last_error = p_error_code, processed_at = null
    where id = delivery_row.outbox_event_id;
    return;
  elsif p_outcome = 'dead_letter' then
    if p_retry_after_seconds is not null then
      raise exception 'Dead-letter completion cannot schedule a retry'
        using errcode = '22023';
    end if;
    update public.email_deliveries set
      status = 'dead_letter', locked_at = null, locked_by = null,
      lease_until = null, last_error_code = p_error_code
    where id = p_delivery_id;
    update public.outbox_events set
      status = 'dead_letter', locked_at = null, locked_by = null,
      last_error = p_error_code, processed_at = null
    where id = delivery_row.outbox_event_id;
    return;
  end if;

  raise exception 'Unsupported email completion outcome'
    using errcode = '22023';
exception
  when no_data_found then
    raise exception 'Email delivery does not exist'
      using errcode = 'P0002';
end;
$$;

create or replace function public.nile_record_email_webhook(
  p_webhook_id text,
  p_provider_message_id text,
  p_event_type text,
  p_event_created_at timestamptz,
  p_payload_hash text
)
returns table (
  duplicate boolean,
  delivery_updated boolean,
  suppression_created boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  delivery_row public.email_deliveries%rowtype;
  existing_webhook public.email_webhook_events%rowtype;
  inserted_webhook_id text;
  next_status text;
  created_suppression boolean := false;
begin
  if p_webhook_id is null or length(p_webhook_id) not between 3 and 200
    or p_provider_message_id !~ '^[A-Za-z0-9._:-]{3,200}$'
    or p_event_type not in (
      'email.sent', 'email.scheduled', 'email.delivered',
      'email.delivery_delayed', 'email.complained', 'email.bounced',
      'email.failed', 'email.suppressed'
    )
    or p_event_created_at is null
    or p_event_created_at > now() + interval '5 minutes'
    or p_payload_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Email webhook evidence is invalid'
      using errcode = '22023';
  end if;

  insert into public.email_webhook_events (
    webhook_id, provider_message_id, event_type, event_created_at, payload_hash
  ) values (
    p_webhook_id, p_provider_message_id, p_event_type, p_event_created_at,
    pg_catalog.decode(p_payload_hash, 'hex')
  ) on conflict (webhook_id) do nothing
  returning webhook_id into inserted_webhook_id;

  if inserted_webhook_id is null then
    select webhook.* into strict existing_webhook
    from public.email_webhook_events as webhook
    where webhook.webhook_id = p_webhook_id;
    if existing_webhook.provider_message_id <> p_provider_message_id
      or existing_webhook.event_type <> p_event_type
      or existing_webhook.event_created_at <> p_event_created_at
      or existing_webhook.payload_hash is distinct from pg_catalog.decode(p_payload_hash, 'hex') then
      raise exception 'Email webhook idempotency conflict'
        using errcode = '23505';
    end if;
    return query select true, false, false;
    return;
  end if;

  select delivery.* into delivery_row
  from public.email_deliveries as delivery
  where delivery.provider_message_id = p_provider_message_id
  for update;

  if not found then
    return query select false, false, false;
    return;
  end if;

  update public.email_webhook_events
  set delivery_id = delivery_row.id
  where webhook_id = p_webhook_id;

  next_status := case p_event_type
    when 'email.delivered' then 'delivered'
    when 'email.delivery_delayed' then 'delayed'
    when 'email.complained' then 'complained'
    when 'email.bounced' then 'bounced'
    when 'email.failed' then 'failed'
    when 'email.suppressed' then 'suppressed'
    else delivery_row.status
  end;

  if p_event_type in ('email.complained', 'email.bounced', 'email.suppressed') then
    insert into public.email_suppressions (
      recipient_user_id, reason, source_delivery_id, source_webhook_id,
      suppressed_at
    ) values (
      delivery_row.recipient_user_id,
      case p_event_type
        when 'email.complained' then 'complained'
        when 'email.bounced' then 'bounced'
        else 'provider_suppressed'
      end,
      delivery_row.id, p_webhook_id, p_event_created_at
    ) on conflict (recipient_user_id, provider) do update set
      reason = excluded.reason, status = 'active',
      source_delivery_id = excluded.source_delivery_id,
      source_webhook_id = excluded.source_webhook_id,
      suppressed_at = excluded.suppressed_at,
      released_at = null, released_by = null, release_reason = null;
    created_suppression := true;
  end if;

  if delivery_row.last_provider_event_at is null
    or p_event_created_at > delivery_row.last_provider_event_at
    or p_event_type in ('email.complained', 'email.bounced', 'email.suppressed') then
    update public.email_deliveries set
      status = next_status,
      delivered_at = case when next_status = 'delivered'
        then p_event_created_at else null end,
      last_provider_event_at = greatest(
        coalesce(last_provider_event_at, p_event_created_at), p_event_created_at
      ),
      last_error_code = case next_status
        when 'delayed' then 'provider_delayed'
        when 'failed' then 'provider_failed'
        when 'bounced' then 'provider_bounced'
        when 'complained' then 'provider_complained'
        when 'suppressed' then 'provider_suppressed'
        else null
      end
    where id = delivery_row.id;
    return query select false, true, created_suppression;
    return;
  end if;

  return query select false, false, created_suppression;
end;
$$;

revoke all on function public.nile_claim_email_delivery(text, integer)
  from public, anon, authenticated;
revoke all on function public.nile_complete_email_delivery(
  uuid, text, text, text, text, text, integer
) from public, anon, authenticated;
revoke all on function public.nile_record_email_webhook(
  text, text, text, timestamptz, text
) from public, anon, authenticated;

grant execute on function public.nile_claim_email_delivery(text, integer)
  to service_role;
grant execute on function public.nile_complete_email_delivery(
  uuid, text, text, text, text, text, integer
) to service_role;
grant execute on function public.nile_record_email_webhook(
  text, text, text, timestamptz, text
) to service_role;

commit;

-- ============================================================================
-- 20. Account invitation lifecycle
-- Source: supabase/manual/017_account_invitation_lifecycle.sql
-- SHA-256: c0593c0611e4d4af54143d23c0bd35010cda7fca2d9fa5f38c1d8fed303fc981
-- ============================================================================

-- Nile Learn normalized account invitation lifecycle.
-- Manual-only. Requires Phase 1, Phase 6A student profiles, and email delivery.
-- No provider credential or plaintext invitation token is stored here.

begin;

do $$
declare
  dependency text;
begin
  foreach dependency in array array[
    'app_users', 'role_grants', 'role_grant_branch_scopes',
    'role_grant_department_scopes', 'staff_profiles', 'staff_subjects',
    'student_profiles', 'auth_sessions', 'command_executions', 'audit_logs',
    'outbox_events', 'email_deliveries'
  ] loop
    if pg_catalog.to_regclass('public.' || dependency) is null then
      raise exception 'Account invitations require public.%', dependency;
    end if;
  end loop;
end;
$$;

create table if not exists public.user_invitations (
  id uuid primary key,
  user_id uuid not null unique references public.app_users(id) on delete restrict,
  role_grant_id uuid not null unique references public.role_grants(id) on delete restrict,
  auth_user_id uuid not null unique references auth.users(id) on delete restrict,
  status text not null default 'queued' check (status in (
    'queued', 'sent', 'delivered', 'accepted', 'expired', 'revoked', 'failed'
  )),
  expires_at timestamptz not null,
  send_count integer not null default 1 check (send_count between 1 and 20),
  last_sent_at timestamptz,
  accepted_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references public.app_users(id) on delete restrict,
  last_email_outbox_event_id uuid unique
    references public.outbox_events(id) on delete restrict,
  created_by uuid not null references public.app_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > created_at),
  check ((status = 'accepted') = (accepted_at is not null)),
  check ((status = 'revoked') = (revoked_at is not null)),
  check (revoked_by is null or revoked_at is not null)
);

create table if not exists public.identity_lifecycle_events (
  id bigint generated always as identity primary key,
  invitation_id uuid not null references public.user_invitations(id) on delete restrict,
  user_id uuid not null references public.app_users(id) on delete restrict,
  auth_user_id uuid not null references auth.users(id) on delete restrict,
  event_type text not null check (event_type in (
    'invitation.accepted', 'invitation.expired', 'invitation.revoked'
  )),
  source text not null check (source in ('verified_auth_identity', 'administrator')),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (invitation_id, event_type),
  check (not nile_private.jsonb_has_forbidden_keys(metadata))
);

create index if not exists user_invitations_status_expiry_idx
  on public.user_invitations (status, expires_at);
create index if not exists identity_lifecycle_events_user_time_idx
  on public.identity_lifecycle_events (user_id, occurred_at desc);

drop trigger if exists user_invitations_set_updated_at on public.user_invitations;
create trigger user_invitations_set_updated_at
before update on public.user_invitations
for each row execute function nile_private.set_updated_at();

alter table public.user_invitations enable row level security;
alter table public.user_invitations force row level security;
alter table public.identity_lifecycle_events enable row level security;
alter table public.identity_lifecycle_events force row level security;

revoke all on table public.user_invitations from public, anon, authenticated, service_role;
revoke all on table public.identity_lifecycle_events from public, anon, authenticated, service_role;
revoke all on sequence public.identity_lifecycle_events_id_seq
  from public, anon, authenticated, service_role;

alter table public.email_deliveries
  drop constraint email_deliveries_template_key_check;
alter table public.email_deliveries
  add constraint email_deliveries_template_key_check check (template_key in (
    'account_invitation', 'account_recovery', 'enrollment_activated',
    'placement_updated', 'schedule_changed', 'attendance_alert',
    'grading_feedback', 'certificate_issued', 'message_notification'
  ));

create or replace function nile_private.email_outbox_payload_is_safe(payload jsonb)
returns boolean
language plpgsql
immutable
strict
security invoker
set search_path = ''
as $$
declare
  root_keys text[];
begin
  if pg_catalog.jsonb_typeof(payload) <> 'object'
    or pg_catalog.octet_length(payload::text) > 32768
    or nile_private.jsonb_has_forbidden_keys(payload) then
    return false;
  end if;

  select pg_catalog.array_agg(key order by key)
  into root_keys
  from pg_catalog.jsonb_object_keys(payload) as key;

  if root_keys is distinct from array[
    'locale', 'recipientUserId', 'schemaVersion', 'templateKey',
    'templateVersion', 'variables'
  ]::text[]
    or payload->>'schemaVersion' <> '1'
    or payload->>'templateKey' not in (
      'account_invitation', 'account_recovery', 'enrollment_activated',
      'placement_updated', 'schedule_changed', 'attendance_alert',
      'grading_feedback', 'certificate_issued', 'message_notification'
    )
    or payload->>'templateVersion' <> '1'
    or payload->>'locale' not in ('en', 'ar', 'zh', 'ru', 'ur', 'tr')
    or (payload->>'recipientUserId') !~
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or pg_catalog.jsonb_typeof(payload->'variables') <> 'object'
    or (
      select pg_catalog.count(*)
      from pg_catalog.jsonb_object_keys(payload->'variables')
    ) > 24 then
    return false;
  end if;

  return true;
end;
$$;

create or replace function public.nile_create_user_invitation_with_evidence(
  p_session_token_hash text,
  p_invitation_id uuid,
  p_auth_user_id uuid,
  p_full_name text,
  p_email text,
  p_phone text,
  p_role text,
  p_branch_ref text,
  p_department_ref text,
  p_title text,
  p_availability_status text,
  p_subjects text[],
  p_teaching_levels text[],
  p_locale text,
  p_activation_envelope text,
  p_expires_at timestamptz,
  p_idempotency_key text,
  p_request_hash text
)
returns table (
  invitation_id uuid,
  user_id uuid,
  role_grant_id uuid,
  outbox_event_id uuid,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_session public.auth_sessions%rowtype;
  actor_grant public.role_grants%rowtype;
  actor_user public.app_users%rowtype;
  command_row public.command_executions%rowtype;
  created_user_id uuid := gen_random_uuid();
  created_grant_id uuid := gen_random_uuid();
  created_profile_id uuid := gen_random_uuid();
  created_command_id uuid := gen_random_uuid();
  created_outbox_id uuid := gen_random_uuid();
  normalized_email text;
  resolved_branch_id uuid;
  resolved_department_id uuid;
  subject_value text;
  level_value text;
begin
  normalized_email := pg_catalog.lower(pg_catalog.btrim(p_email));
  if nullif(pg_catalog.btrim(p_branch_ref), '') is not null then
    select branch.id into resolved_branch_id
    from public.branches as branch
    where branch.id::text = pg_catalog.btrim(p_branch_ref)
      or branch.legacy_id = pg_catalog.btrim(p_branch_ref)
      or branch.code::text = pg_catalog.btrim(p_branch_ref);
  end if;
  if nullif(pg_catalog.btrim(p_department_ref), '') is not null then
    select department.id into resolved_department_id
    from public.departments as department
    where department.id::text = pg_catalog.btrim(p_department_ref)
      or department.legacy_id = pg_catalog.btrim(p_department_ref)
      or department.code::text = pg_catalog.btrim(p_department_ref);
  end if;
  if p_session_token_hash !~ '^[a-f0-9]{64}$'
    or p_request_hash !~ '^[a-f0-9]{64}$'
    or length(p_idempotency_key) not between 12 and 256
    or length(pg_catalog.btrim(p_full_name)) not between 2 and 160
    or normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    or p_role not in ('student', 'teacher', 'registrar', 'headofdepartment', 'branchadmin', 'superadmin')
    or p_locale not in ('en', 'ar', 'zh', 'ru', 'ur', 'tr')
    or p_activation_envelope !~ '^v1\.[A-Za-z0-9_-]+$'
    or length(p_activation_envelope) not between 44 and 16000
    or p_expires_at not between now() + interval '15 minutes' and now() + interval '48 hours' then
    raise exception 'Account invitation request is invalid' using errcode = '22023';
  end if;

  select session.* into strict actor_session
  from public.auth_sessions as session
  where session.token_hash = pg_catalog.decode(p_session_token_hash, 'hex')
    and session.provider = 'supabase'
    and session.revoked_at is null
    and session.expires_at > now()
  for update;

  select app_user.*
  into strict actor_user
  from public.app_users as app_user
  join public.role_grants as role_grant
    on role_grant.id = actor_session.active_role_grant_id
    and role_grant.user_id = app_user.id
  where app_user.id = actor_session.user_id
    and app_user.status = 'active'
    and role_grant.role = 'superadmin'
    and role_grant.status = 'active'
    and role_grant.starts_at <= now()
    and (role_grant.ends_at is null or role_grant.ends_at > now());

  select role_grant.*
  into strict actor_grant
  from public.role_grants as role_grant
  where role_grant.id = actor_session.active_role_grant_id
    and role_grant.user_id = actor_user.id
    and role_grant.role = 'superadmin'
    and role_grant.status = 'active'
    and role_grant.starts_at <= now()
    and (role_grant.ends_at is null or role_grant.ends_at > now());

  select command.* into command_row
  from public.command_executions as command
  where command.idempotency_key = p_idempotency_key;
  if found then
    if command_row.request_hash is distinct from pg_catalog.decode(p_request_hash, 'hex')
      or command_row.command_type <> 'user.invitation.create'
      or command_row.status <> 'succeeded' then
      raise exception 'Account invitation idempotency conflict' using errcode = '23505';
    end if;
    return query
      select invitation.id, invitation.user_id, invitation.role_grant_id,
        invitation.last_email_outbox_event_id, true
      from public.user_invitations as invitation
      where invitation.id = command_row.target_id::uuid;
    return;
  end if;

  if exists (select 1 from public.app_users where email = normalized_email)
    or exists (select 1 from public.app_users where auth_user_id = p_auth_user_id) then
    raise exception 'This email or Auth identity is already registered' using errcode = '23505';
  end if;

  if p_role = 'superadmin' then
    if resolved_branch_id is not null or resolved_department_id is not null then
      raise exception 'Super Admin invitations cannot carry branch or department scope' using errcode = '22023';
    end if;
  elsif p_role in ('student', 'registrar', 'branchadmin') then
    if resolved_branch_id is null or resolved_department_id is not null then
      raise exception 'The selected role requires branch-only scope' using errcode = '22023';
    end if;
  elsif p_role = 'teacher' then
    if resolved_branch_id is null or resolved_department_id is null
      or coalesce(pg_catalog.array_length(p_subjects, 1), 0) = 0
      or coalesce(pg_catalog.array_length(p_teaching_levels, 1), 0) = 0
      or p_availability_status not in ('available', 'limited', 'unavailable') then
      raise exception 'Teacher invitations require branch, department, subjects, and levels' using errcode = '22023';
    end if;
  elsif p_role = 'headofdepartment' and resolved_department_id is null then
    raise exception 'HOD invitations require department scope' using errcode = '22023';
  end if;

  if nullif(pg_catalog.btrim(p_branch_ref), '') is not null
    and resolved_branch_id is null then
    raise exception 'Invitation branch is unavailable' using errcode = '23503';
  end if;
  if resolved_branch_id is not null and not exists (
    select 1 from public.branches where id = resolved_branch_id and status = 'active'
  ) then
    raise exception 'Invitation branch is unavailable' using errcode = '23503';
  end if;
  if nullif(pg_catalog.btrim(p_department_ref), '') is not null
    and resolved_department_id is null then
    raise exception 'Invitation department is unavailable' using errcode = '23503';
  end if;
  if resolved_department_id is not null and not exists (
    select 1 from public.departments where id = resolved_department_id and status = 'active'
  ) then
    raise exception 'Invitation department is unavailable' using errcode = '23503';
  end if;
  if resolved_branch_id is not null and resolved_department_id is not null and not exists (
    select 1 from public.department_branches
    where branch_id = resolved_branch_id and department_id = resolved_department_id
  ) then
    raise exception 'Invitation department is not available in the branch' using errcode = '23503';
  end if;

  insert into public.command_executions (
    id, idempotency_key, actor_user_id, actor_role_grant_id, session_id,
    command_type, target_type, target_id, request_hash, requires_outbox
  ) values (
    created_command_id, p_idempotency_key, actor_user.id, actor_grant.id,
    actor_session.id, 'user.invitation.create', 'UserInvitation',
    p_invitation_id::text, pg_catalog.decode(p_request_hash, 'hex'), true
  );

  insert into public.app_users (
    id, auth_user_id, full_name, email, phone, status
  ) values (
    created_user_id, p_auth_user_id, pg_catalog.btrim(p_full_name),
    normalized_email, nullif(pg_catalog.btrim(p_phone), ''), 'invited'
  );

  insert into public.role_grants (
    id, user_id, role, status, granted_by, granted_reason
  ) values (
    created_grant_id, created_user_id, p_role, 'pending', actor_user.id,
    'Account invitation awaiting verified acceptance'
  );

  if resolved_branch_id is not null then
    insert into public.role_grant_branch_scopes (
      role_grant_id, branch_id, granted_by
    ) values (created_grant_id, resolved_branch_id, actor_user.id);
  end if;
  if resolved_department_id is not null then
    insert into public.role_grant_department_scopes (
      role_grant_id, department_id, granted_by
    ) values (created_grant_id, resolved_department_id, actor_user.id);
  end if;

  if p_role = 'student' then
    insert into public.student_profiles (id, user_id, home_branch_id, status)
    values (created_profile_id, created_user_id, resolved_branch_id, 'active');
  else
    insert into public.staff_profiles (
      id, user_id, title, availability_status, status
    ) values (
      created_profile_id, created_user_id,
      nullif(pg_catalog.btrim(p_title), ''),
      case when p_role = 'teacher' then p_availability_status else 'not_applicable' end,
      'active'
    );

    if p_role = 'teacher' then
      foreach subject_value in array coalesce(p_subjects, array[]::text[]) loop
        foreach level_value in array coalesce(p_teaching_levels, array[]::text[]) loop
          insert into public.staff_subjects (staff_profile_id, subject, teaching_level)
          values (
            created_profile_id, pg_catalog.btrim(subject_value),
            pg_catalog.btrim(level_value)
          );
        end loop;
      end loop;
    end if;
  end if;

  insert into public.user_invitations (
    id, user_id, role_grant_id, auth_user_id, expires_at, created_by
  ) values (
    p_invitation_id, created_user_id, created_grant_id, p_auth_user_id,
    p_expires_at, actor_user.id
  );

  insert into public.audit_logs (
    command_id, actor_user_id, actor_role_grant_id, session_id,
    action, entity_type, entity_id, branch_id, department_id,
    after_state, metadata
  ) values (
    created_command_id, actor_user.id, actor_grant.id, actor_session.id,
    'user.invited', 'User', created_user_id::text, resolved_branch_id, resolved_department_id,
    pg_catalog.jsonb_build_object('status', 'invited', 'role', p_role),
    pg_catalog.jsonb_build_object('invitationId', p_invitation_id, 'delivery', 'queued')
  );

  insert into public.outbox_events (
    id, command_id, event_type, aggregate_type, aggregate_id, payload,
    idempotency_key
  ) values (
    created_outbox_id, created_command_id, 'email.delivery.requested',
    'UserInvitation', p_invitation_id::text,
    pg_catalog.jsonb_build_object(
      'schemaVersion', 1,
      'recipientUserId', created_user_id,
      'templateKey', 'account_invitation',
      'templateVersion', 1,
      'locale', p_locale,
      'variables', pg_catalog.jsonb_build_object(
        'displayName', pg_catalog.btrim(p_full_name),
        'roleLabel', p_role,
        'activationEnvelope', p_activation_envelope,
        'expiresInHours', pg_catalog.ceil(
          extract(epoch from (p_expires_at - now())) / 3600
        )::integer
      )
    ),
    'email.delivery:' || created_outbox_id::text
  );

  update public.user_invitations
  set last_email_outbox_event_id = created_outbox_id
  where id = p_invitation_id;

  update public.command_executions
  set status = 'succeeded', completed_at = now()
  where id = created_command_id;

  return query select p_invitation_id, created_user_id, created_grant_id,
    created_outbox_id, false;
exception
  when no_data_found then
    raise exception 'Current Super Admin session authority is unavailable'
      using errcode = '42501';
end;
$$;

create or replace function public.nile_accept_user_invitation(
  p_invitation_id uuid,
  p_auth_user_id uuid
)
returns table (user_id uuid, role text, accepted_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation public.user_invitations%rowtype;
  grant_row public.role_grants%rowtype;
  accepted_time timestamptz := now();
begin
  select item.* into strict invitation
  from public.user_invitations as item
  where item.id = p_invitation_id
  for update;

  if invitation.auth_user_id is distinct from p_auth_user_id
    or invitation.status not in ('queued', 'sent', 'delivered')
    or invitation.expires_at <= accepted_time then
    raise exception 'Invitation is invalid, expired, or already used'
      using errcode = '42501';
  end if;

  select role_grant.* into strict grant_row
  from public.role_grants as role_grant
  where role_grant.id = invitation.role_grant_id
    and role_grant.user_id = invitation.user_id
    and role_grant.status = 'pending'
  for update;

  update public.app_users
  set status = 'active', activated_at = accepted_time
  where id = invitation.user_id
    and auth_user_id = p_auth_user_id
    and status = 'invited';
  if not found then
    raise exception 'Invited identity is not available for activation'
      using errcode = '42501';
  end if;

  update public.role_grants
  set status = 'active'
  where id = invitation.role_grant_id;

  update public.user_invitations
  set status = 'accepted', accepted_at = accepted_time
  where id = invitation.id;

  insert into public.identity_lifecycle_events (
    invitation_id, user_id, auth_user_id, event_type, source
  ) values (
    invitation.id, invitation.user_id, p_auth_user_id,
    'invitation.accepted', 'verified_auth_identity'
  );

  return query select invitation.user_id, grant_row.role, accepted_time;
exception
  when no_data_found then
    raise exception 'Invitation is unavailable' using errcode = '42501';
end;
$$;

create or replace function public.nile_claim_email_delivery_v2(
  p_worker_id text,
  p_lease_seconds integer
)
returns table (
  delivery_id uuid,
  outbox_event_id uuid,
  recipient_user_id uuid,
  recipient_email text,
  template_key text,
  template_version integer,
  locale text,
  variables jsonb,
  idempotency_key text,
  attempt_number integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.outbox_events%rowtype;
  user_row public.app_users%rowtype;
  delivery_row public.email_deliveries%rowtype;
  recipient_id uuid;
begin
  if p_worker_id is null or length(p_worker_id) not between 8 and 120
    or p_worker_id !~ '^[A-Za-z0-9._:-]+$'
    or p_lease_seconds not between 30 and 300 then
    raise exception 'Email delivery lease request is invalid' using errcode = '22023';
  end if;

  loop
    select event.* into event_row
    from public.outbox_events as event
    left join public.email_deliveries as delivery
      on delivery.outbox_event_id = event.id
    where event.event_type = 'email.delivery.requested'
      and event.available_at <= now()
      and (
        event.status in ('pending', 'failed')
        or (event.status = 'processing' and delivery.lease_until <= now())
      )
    order by event.available_at, event.created_at
    for update of event skip locked
    limit 1;

    if not found then return; end if;

    if not nile_private.email_outbox_payload_is_safe(event_row.payload)
      or length(event_row.idempotency_key) > 256 then
      update public.outbox_events
      set status = 'dead_letter', locked_at = null, locked_by = null,
        attempts = least(attempts + 1, 5), last_error = 'invalid_email_payload',
        processed_at = null
      where id = event_row.id;
      continue;
    end if;

    recipient_id := (event_row.payload->>'recipientUserId')::uuid;
    select app_user.* into user_row
    from public.app_users as app_user
    where app_user.id = recipient_id
      and (
        app_user.status = 'active'
        or (
          app_user.status = 'invited'
          and event_row.payload->>'templateKey' = 'account_invitation'
        )
      );

    if not found then
      update public.outbox_events
      set status = 'dead_letter', locked_at = null, locked_by = null,
        attempts = least(attempts + 1, 5), last_error = 'recipient_unavailable',
        processed_at = null
      where id = event_row.id;
      continue;
    end if;

    if exists (
      select 1 from public.email_suppressions as suppression
      where suppression.recipient_user_id = recipient_id
        and suppression.provider = 'resend' and suppression.status = 'active'
    ) then
      update public.outbox_events
      set status = 'processing', locked_at = now(), locked_by = p_worker_id,
        attempts = least(attempts + 1, 5), last_error = null, processed_at = null
      where id = event_row.id returning * into event_row;
      insert into public.email_deliveries (
        outbox_event_id, recipient_user_id, template_key, template_version,
        locale, status, attempts, last_error_code
      ) values (
        event_row.id, recipient_id, event_row.payload->>'templateKey', 1,
        event_row.payload->>'locale', 'suppressed', event_row.attempts,
        'recipient_suppressed'
      ) on conflict on constraint email_deliveries_outbox_event_id_key do update set
        status = 'suppressed', attempts = least(public.email_deliveries.attempts + 1, 5),
        locked_at = null, locked_by = null, lease_until = null,
        last_error_code = 'recipient_suppressed';
      update public.outbox_events
      set status = 'succeeded', locked_at = null, locked_by = null,
        last_error = null, processed_at = now()
      where id = event_row.id;
      continue;
    end if;

    update public.outbox_events
    set status = 'processing', locked_at = now(), locked_by = p_worker_id,
      attempts = least(attempts + 1, 5), last_error = null, processed_at = null
    where id = event_row.id returning * into event_row;

    insert into public.email_deliveries (
      outbox_event_id, recipient_user_id, template_key, template_version,
      locale, status, attempts, locked_at, locked_by, lease_until,
      last_error_code
    ) values (
      event_row.id, recipient_id, event_row.payload->>'templateKey', 1,
      event_row.payload->>'locale', 'processing', event_row.attempts,
      event_row.locked_at, p_worker_id,
      event_row.locked_at + pg_catalog.make_interval(secs => p_lease_seconds), null
    ) on conflict on constraint email_deliveries_outbox_event_id_key do update set
      status = 'processing', attempts = excluded.attempts,
      locked_at = excluded.locked_at, locked_by = excluded.locked_by,
      lease_until = excluded.lease_until, last_error_code = null
    returning * into delivery_row;

    return query select delivery_row.id, event_row.id, recipient_id,
      user_row.email::text, delivery_row.template_key,
      delivery_row.template_version, delivery_row.locale,
      event_row.payload->'variables', event_row.idempotency_key,
      delivery_row.attempts;
    return;
  end loop;
end;
$$;

revoke all on function public.nile_create_user_invitation_with_evidence(
  text, uuid, uuid, text, text, text, text, text, text, text, text,
  text[], text[], text, text, timestamptz, text, text
) from public, anon, authenticated;
revoke all on function public.nile_accept_user_invitation(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.nile_claim_email_delivery_v2(text, integer)
  from public, anon, authenticated;

grant execute on function public.nile_create_user_invitation_with_evidence(
  text, uuid, uuid, text, text, text, text, text, text, text, text,
  text[], text[], text, text, timestamptz, text, text
) to service_role;
grant execute on function public.nile_accept_user_invitation(uuid, uuid)
  to service_role;
grant execute on function public.nile_claim_email_delivery_v2(text, integer)
  to service_role;

commit;

-- ============================================================================
-- Bootstrap completion marker
-- ============================================================================

select
  'Nile Learn staging schema bootstrap completed' as result,
  current_database() as database_name,
  current_timestamp as completed_at;
