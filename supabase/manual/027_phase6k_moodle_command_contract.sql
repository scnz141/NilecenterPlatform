-- Nile Learn Phase 6K Moodle command-contract foundation.
-- Manual-only and intentionally unapplied. This package does not enable a
-- worker, a browser command route, Moodle credentials, or provider writes.

begin;

do $$
declare
  dependency text;
begin
  foreach dependency in array array[
    'app_users', 'role_grants', 'auth_sessions', 'command_executions',
    'audit_logs', 'outbox_events', 'integration_connections',
    'external_records', 'reconciliation_cases'
  ] loop
    if pg_catalog.to_regclass('public.' || dependency) is null then
      raise exception 'Phase 6K requires public.%', dependency;
    end if;
  end loop;

  if pg_catalog.to_regprocedure('nile_private.jsonb_has_forbidden_keys(jsonb)') is null then
    raise exception 'Phase 6K requires the Phase 1 forbidden-key helper';
  end if;
end;
$$;

create function nile_private.moodle_command_operation_is_allowed(operation text)
returns boolean
language sql
immutable
strict
security invoker
set search_path = ''
as $$
  select operation = any(array[
    'delivery_course.clone', 'delivery_course.archive',
    'delivery_course.restore', 'section.upsert', 'section.reorder',
    'section.visibility', 'page.upsert', 'book.upsert', 'url.upsert',
    'resource.upsert', 'resource.archive', 'assignment.upsert',
    'assignment.archive', 'quiz_shell.upsert', 'quiz.archive',
    'question.upsert', 'question.move', 'grade.update', 'completion.update'
  ]::text[]);
$$;

create function nile_private.moodle_plugin_manifest_is_safe(
  operations jsonb,
  native_launch_kinds jsonb
)
returns boolean
language plpgsql
immutable
strict
security invoker
set search_path = ''
as $$
declare
  operation jsonb;
  operation_names text[] := array[]::text[];
  launch_kind text;
  launch_kinds text[] := array[]::text[];
begin
  if pg_catalog.jsonb_typeof(operations) <> 'array'
    or pg_catalog.jsonb_typeof(native_launch_kinds) <> 'array'
    or pg_catalog.jsonb_array_length(operations) <> 19
    or pg_catalog.jsonb_array_length(native_launch_kinds) <> 6
    or nile_private.jsonb_has_forbidden_keys(operations)
    or nile_private.jsonb_has_forbidden_keys(native_launch_kinds)
    or pg_catalog.octet_length(operations::text) > 16384 then
    return false;
  end if;

  for operation in select value from pg_catalog.jsonb_array_elements(operations)
  loop
    if pg_catalog.jsonb_typeof(operation) <> 'object'
      or (select pg_catalog.array_agg(keys.key order by keys.key)
          from pg_catalog.jsonb_object_keys(operation) as keys(key))
        is distinct from array['name', 'requiredCapability']::text[]
      or not nile_private.moodle_command_operation_is_allowed(operation->>'name')
      or (operation->>'requiredCapability') !~ '^[a-z][a-z0-9_]+/[a-z][a-z0-9_:.-]+$' then
      return false;
    end if;
    operation_names := operation_names || (operation->>'name');
  end loop;

  if (select pg_catalog.count(distinct item) from pg_catalog.unnest(operation_names) as item) <> 19 then
    return false;
  end if;

  for launch_kind in
    select value from pg_catalog.jsonb_array_elements_text(native_launch_kinds) as launch(value)
  loop
    if launch_kind not in (
      'lesson_authoring', 'h5p_authoring', 'scorm_authoring',
      'video_time_authoring', 'quiz_attempt', 'assignment_submission'
    ) then
      return false;
    end if;
    launch_kinds := launch_kinds || launch_kind;
  end loop;

  return (
    select pg_catalog.count(distinct item)
    from pg_catalog.unnest(launch_kinds) as item
  ) = 6;
end;
$$;

create table public.moodle_plugin_manifests (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.integration_connections(id) on delete restrict,
  component text not null check (component = 'local_nilelearn'),
  plugin_version text not null check (plugin_version ~ '^[a-z0-9][a-z0-9._:+-]{0,79}$'),
  protocol_version text not null check (protocol_version = '1.0'),
  operations jsonb not null,
  native_launch_kinds jsonb not null,
  manifest_hash bytea not null check (pg_catalog.octet_length(manifest_hash) = 32),
  status text not null check (status in ('verified', 'revoked')),
  verified_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  unique (connection_id, component, plugin_version, protocol_version),
  check (nile_private.moodle_plugin_manifest_is_safe(operations, native_launch_kinds)),
  check ((status = 'revoked') = (revoked_at is not null)),
  check (revoked_at is null or revoked_at >= verified_at)
);

create unique index moodle_plugin_manifests_one_verified_uidx
  on public.moodle_plugin_manifests (connection_id, component, protocol_version)
  where status = 'verified';

create table public.moodle_command_requests (
  id uuid primary key,
  command_id uuid not null unique references public.command_executions(id) on delete restrict,
  outbox_event_id uuid not null unique references public.outbox_events(id) on delete restrict,
  connection_id uuid not null references public.integration_connections(id) on delete restrict,
  plugin_manifest_id uuid not null references public.moodle_plugin_manifests(id) on delete restrict,
  actor_mapping_id uuid not null references public.external_records(id) on delete restrict,
  target_mapping_id uuid references public.external_records(id) on delete restrict,
  target_context_id uuid not null,
  operation text not null check (nile_private.moodle_command_operation_is_allowed(operation)),
  request_hash bytea not null check (pg_catalog.octet_length(request_hash) = 32),
  expected_provider_version text not null
    check (expected_provider_version ~ '^[a-z0-9][a-z0-9._:+-]{0,79}$'),
  status text not null default 'queued'
    check (status in ('queued', 'applied', 'failed', 'reconciliation_required', 'cancelled')),
  provider_result_hash bytea check (
    provider_result_hash is null or pg_catalog.octet_length(provider_result_hash) = 32
  ),
  provider_version text check (
    provider_version is null or provider_version ~ '^[a-z0-9][a-z0-9._:+-]{0,79}$'
  ),
  reconciliation_case_id uuid references public.reconciliation_cases(id) on delete restrict,
  completed_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  check ((status = 'applied') = (
    provider_result_hash is not null and provider_version is not null and completed_at is not null
  )),
  check ((status = 'reconciliation_required') = (reconciliation_case_id is not null)),
  check (status not in ('failed', 'cancelled') or completed_at is not null)
);

create index moodle_command_requests_status_idx
  on public.moodle_command_requests (status, created_at);
create index moodle_command_requests_connection_idx
  on public.moodle_command_requests (connection_id, created_at desc);

create table public.moodle_command_attempts (
  id bigint generated always as identity primary key,
  command_request_id uuid not null references public.moodle_command_requests(id) on delete restrict,
  attempt_number integer not null check (attempt_number > 0),
  worker_id text not null check (worker_id ~ '^[a-z0-9][a-z0-9._:-]{2,79}$'),
  outcome text not null check (outcome in ('applied', 'failed', 'unknown', 'denied')),
  provider_request_id text,
  response_hash bytea check (
    response_hash is null or pg_catalog.octet_length(response_hash) = 32
  ),
  error_code text check (error_code is null or error_code ~ '^[a-z0-9][a-z0-9._:-]{0,79}$'),
  started_at timestamptz not null,
  finished_at timestamptz not null,
  created_at timestamptz not null default pg_catalog.now(),
  unique (command_request_id, attempt_number),
  check (finished_at >= started_at),
  check ((outcome = 'applied') = (response_hash is not null)),
  check ((outcome in ('failed', 'denied')) = (error_code is not null))
);

create function nile_private.validate_moodle_command_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  command_row public.command_executions%rowtype;
  outbox_row public.outbox_events%rowtype;
  connection_row public.integration_connections%rowtype;
  manifest_row public.moodle_plugin_manifests%rowtype;
  actor_mapping public.external_records%rowtype;
  target_mapping public.external_records%rowtype;
begin
  select * into strict command_row
  from public.command_executions where id = new.command_id;
  select * into strict outbox_row
  from public.outbox_events where id = new.outbox_event_id;
  select * into strict connection_row
  from public.integration_connections where id = new.connection_id;
  select * into strict manifest_row
  from public.moodle_plugin_manifests where id = new.plugin_manifest_id;
  select * into strict actor_mapping
  from public.external_records where id = new.actor_mapping_id;

  if connection_row.provider <> 'moodle'
    or connection_row.status <> 'ready'
    or connection_row.mode not in ('read_only', 'write_limited') then
    raise exception 'Moodle command connection is not verified'
      using errcode = '23514';
  end if;
  if manifest_row.connection_id <> new.connection_id
    or manifest_row.status <> 'verified'
    or not exists (
      select 1 from pg_catalog.jsonb_array_elements(manifest_row.operations) as item
      where item->>'name' = new.operation
    ) then
    raise exception 'Moodle command operation is not in the verified plugin manifest'
      using errcode = '23514';
  end if;
  if actor_mapping.connection_id <> new.connection_id
    or actor_mapping.entity_type <> 'user'
    or actor_mapping.internal_id <> command_row.actor_user_id
    or actor_mapping.sync_state <> 'synced' then
    raise exception 'Moodle command actor mapping is not exact'
      using errcode = '23514';
  end if;
  if new.target_mapping_id is not null then
    select * into strict target_mapping
    from public.external_records where id = new.target_mapping_id;
    if target_mapping.connection_id <> new.connection_id
      or target_mapping.internal_id is null
      or target_mapping.sync_state <> 'synced' then
      raise exception 'Moodle command target mapping is not exact'
        using errcode = '23514';
    end if;
  elsif new.operation <> 'delivery_course.clone' then
    raise exception 'Only delivery-course cloning may omit a target mapping'
      using errcode = '23514';
  end if;
  if command_row.command_type <> 'moodle.command.enqueue'
    or not command_row.requires_outbox
    or command_row.request_hash <> new.request_hash
    or outbox_row.command_id <> new.command_id
    or outbox_row.event_type <> 'moodle.command.requested'
    or outbox_row.aggregate_type <> 'moodle_command'
    or outbox_row.aggregate_id <> new.id::text
    or outbox_row.idempotency_key <> command_row.idempotency_key || ':provider'
    or outbox_row.payload->>'moodleCommandRequestId' <> new.id::text
    or outbox_row.payload->>'protocolVersion' <> manifest_row.protocol_version
    or outbox_row.payload->>'operation' <> new.operation
    or outbox_row.payload->>'connectionId' <> new.connection_id::text
    or outbox_row.payload->>'actorMappingId' <> new.actor_mapping_id::text
    or outbox_row.payload->>'targetContextId' <> new.target_context_id::text
    or outbox_row.payload->>'expectedProviderVersion' <> new.expected_provider_version
    or outbox_row.payload->>'payloadHash' <> pg_catalog.encode(new.request_hash, 'hex') then
    raise exception 'Moodle command, audit, and outbox evidence disagree'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create function nile_private.preserve_moodle_plugin_manifest()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Moodle plugin manifests cannot be deleted' using errcode = '55000';
  end if;
  if old.id is distinct from new.id
    or old.connection_id is distinct from new.connection_id
    or old.component is distinct from new.component
    or old.plugin_version is distinct from new.plugin_version
    or old.protocol_version is distinct from new.protocol_version
    or old.operations is distinct from new.operations
    or old.native_launch_kinds is distinct from new.native_launch_kinds
    or old.manifest_hash is distinct from new.manifest_hash
    or old.verified_at is distinct from new.verified_at
    or old.created_at is distinct from new.created_at
    or old.status = 'revoked'
    or not (old.status = 'verified' and new.status in ('verified', 'revoked')) then
    raise exception 'Moodle plugin manifest identity is immutable' using errcode = '55000';
  end if;
  return new;
end;
$$;

create function nile_private.preserve_moodle_command_request()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Moodle command requests cannot be deleted' using errcode = '55000';
  end if;
  if old.id is distinct from new.id
    or old.command_id is distinct from new.command_id
    or old.outbox_event_id is distinct from new.outbox_event_id
    or old.connection_id is distinct from new.connection_id
    or old.plugin_manifest_id is distinct from new.plugin_manifest_id
    or old.actor_mapping_id is distinct from new.actor_mapping_id
    or old.target_mapping_id is distinct from new.target_mapping_id
    or old.target_context_id is distinct from new.target_context_id
    or old.operation is distinct from new.operation
    or old.request_hash is distinct from new.request_hash
    or old.expected_provider_version is distinct from new.expected_provider_version
    or old.created_at is distinct from new.created_at
    or old.status in ('applied', 'cancelled') then
    raise exception 'Moodle command request identity is immutable' using errcode = '55000';
  end if;
  if not (
    old.status = new.status
    or (old.status = 'queued' and new.status in ('applied', 'failed', 'reconciliation_required', 'cancelled'))
  ) then
    raise exception 'Invalid Moodle command transition from % to %', old.status, new.status
      using errcode = '23514';
  end if;
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create function nile_private.require_moodle_command_atomic_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.command_executions as command
    where command.id = new.command_id
      and command.status = 'succeeded'
      and command.requires_outbox
  ) or not exists (
    select 1
    from public.audit_logs as audit
    where audit.command_id = new.command_id
      and audit.action = 'moodle.command.queued'
      and audit.entity_type = 'moodle_command'
      and audit.entity_id = new.id::text
  ) or not exists (
    select 1
    from public.outbox_events as event
    where event.id = new.outbox_event_id
      and event.command_id = new.command_id
      and event.event_type = 'moodle.command.requested'
  ) then
    raise exception 'Moodle command request requires atomic command, audit, and outbox evidence'
      using errcode = '23514';
  end if;
  return null;
end;
$$;

create function nile_private.require_moodle_command_request_for_outbox()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.event_type = 'moodle.command.requested'
    and not exists (
      select 1 from public.moodle_command_requests as request
      where request.outbox_event_id = new.id and request.command_id = new.command_id
    ) then
    raise exception 'Moodle command outbox requires a durable command request'
      using errcode = '23514';
  end if;
  return null;
end;
$$;

create trigger moodle_plugin_manifests_preserve
before update or delete on public.moodle_plugin_manifests
for each row execute function nile_private.preserve_moodle_plugin_manifest();
create trigger moodle_command_requests_validate
before insert on public.moodle_command_requests
for each row execute function nile_private.validate_moodle_command_request();
create trigger moodle_command_requests_preserve
before update or delete on public.moodle_command_requests
for each row execute function nile_private.preserve_moodle_command_request();
create constraint trigger moodle_command_requests_require_atomic_evidence
after insert or update on public.moodle_command_requests
deferrable initially deferred
for each row execute function nile_private.require_moodle_command_atomic_evidence();
create trigger moodle_command_attempts_immutable
before update or delete on public.moodle_command_attempts
for each row execute function nile_private.reject_immutable_change();
create constraint trigger outbox_events_require_moodle_command_request
after insert or update on public.outbox_events
deferrable initially deferred
for each row execute function nile_private.require_moodle_command_request_for_outbox();

alter table public.moodle_plugin_manifests enable row level security;
alter table public.moodle_plugin_manifests force row level security;
alter table public.moodle_command_requests enable row level security;
alter table public.moodle_command_requests force row level security;
alter table public.moodle_command_attempts enable row level security;
alter table public.moodle_command_attempts force row level security;

revoke all on public.moodle_plugin_manifests from public, anon, authenticated, service_role;
revoke all on public.moodle_command_requests from public, anon, authenticated, service_role;
revoke all on public.moodle_command_attempts from public, anon, authenticated, service_role;
revoke all on function nile_private.moodle_command_operation_is_allowed(text)
  from public, anon, authenticated, service_role;
revoke all on function nile_private.moodle_plugin_manifest_is_safe(jsonb, jsonb)
  from public, anon, authenticated, service_role;

commit;
