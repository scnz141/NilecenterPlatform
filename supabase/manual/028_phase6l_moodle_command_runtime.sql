-- Nile Learn Phase 6L Moodle command runtime.
-- Manual-only. Apply only to the pinned isolated fake-data staging project
-- after 027. Never apply to production.

begin;

do $$
declare
  dependency text;
begin
  foreach dependency in array array[
    'moodle_plugin_manifests', 'moodle_command_requests',
    'moodle_command_attempts', 'auth_sessions', 'role_grants',
    'external_records', 'integration_connections', 'reconciliation_cases'
  ] loop
    if pg_catalog.to_regclass('public.' || dependency) is null then
      raise exception 'Phase 6L requires public.%', dependency;
    end if;
  end loop;
end;
$$;

alter table public.integration_connections
  drop constraint if exists integration_connections_check;
alter table public.integration_connections
  drop constraint if exists integration_connections_mode_check;
alter table public.integration_connections
  add constraint integration_connections_mode_check check (
    mode in ('disabled', 'read_only', 'write_limited', 'migration')
  );
alter table public.integration_connections
  add constraint integration_connections_provider_mode_check check (
    provider <> 'legacy_ems' or mode in ('disabled', 'read_only', 'migration')
  );
alter table public.integration_connections
  add constraint integration_connections_moodle_mode_check check (
    provider <> 'moodle'
    or mode in ('disabled', 'read_only', 'write_limited')
  );

alter table public.moodle_command_requests
  drop constraint if exists moodle_command_requests_status_check;
alter table public.moodle_command_requests
  add constraint moodle_command_requests_status_check check (
    status in (
      'queued', 'processing', 'applied', 'failed',
      'reconciliation_required', 'cancelled'
    )
  );
alter table public.moodle_command_requests
  add column lease_until timestamptz,
  add column leased_by text,
  add column attempt_count integer not null default 0 check (attempt_count >= 0),
  add column last_error_code text check (
    last_error_code is null
    or last_error_code ~ '^[a-z0-9][a-z0-9._:-]{0,79}$'
  ),
  add constraint moodle_command_requests_lease_check check (
    (status = 'processing') =
    (lease_until is not null and leased_by is not null)
  );

create table public.moodle_native_launch_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_hash bytea not null unique check (pg_catalog.octet_length(ticket_hash) = 32),
  session_id uuid not null,
  actor_user_id uuid not null,
  actor_role_grant_id uuid not null,
  actor_mapping_id uuid not null references public.external_records(id) on delete restrict,
  target_mapping_id uuid not null references public.external_records(id) on delete restrict,
  launch_kind text not null check (launch_kind in (
    'lesson_authoring', 'h5p_authoring', 'scorm_authoring',
    'video_time_authoring', 'quiz_attempt', 'assignment_submission'
  )),
  return_path text not null check (
    return_path ~ '^/app/[a-z0-9/_-]{1,220}$'
    and return_path !~ '\.\.'
  ),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  foreign key (session_id, actor_user_id, actor_role_grant_id)
    references public.auth_sessions(id, user_id, active_role_grant_id)
    on delete restrict,
  check (expires_at > created_at and expires_at <= created_at + interval '60 seconds'),
  check (consumed_at is null or consumed_at between created_at and expires_at)
);

create index moodle_native_launch_tickets_expiry_idx
  on public.moodle_native_launch_tickets (expires_at)
  where consumed_at is null;

create or replace function nile_private.moodle_command_role_is_allowed(
  p_role text,
  p_operation text
)
returns boolean
language sql
immutable
strict
security invoker
set search_path = ''
as $$
  select case
    when p_role = 'headofdepartment' then
      nile_private.moodle_command_operation_is_allowed(p_operation)
    when p_role = 'teacher' then p_operation = any(array[
      'section.upsert', 'section.reorder', 'section.visibility',
      'page.upsert', 'book.upsert', 'url.upsert', 'resource.upsert',
      'resource.archive', 'assignment.upsert', 'assignment.archive',
      'quiz_shell.upsert', 'quiz.archive', 'question.upsert',
      'question.move', 'grade.update', 'completion.update'
    ]::text[])
    when p_role = 'superadmin' then p_operation = any(array[
      'delivery_course.clone', 'delivery_course.archive',
      'delivery_course.restore'
    ]::text[])
    else false
  end;
$$;

create or replace function nile_private.moodle_target_course_internal_id(
  p_connection_id uuid,
  p_target_mapping_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(target.internal_id, parent.internal_id)
  from public.external_records as target
  left join public.external_records as parent
    on parent.connection_id = target.connection_id
   and parent.entity_type = 'course'
   and parent.external_id = target.external_parent_id
   and parent.sync_state = 'synced'
  where target.id = p_target_mapping_id
    and target.connection_id = p_connection_id
    and target.sync_state = 'synced';
$$;

create or replace function nile_private.moodle_launch_role_is_allowed(
  p_role text,
  p_launch_kind text
)
returns boolean
language sql
immutable
strict
security invoker
set search_path = ''
as $$
  select case
    when p_role = 'student' then
      p_launch_kind in ('quiz_attempt', 'assignment_submission')
    when p_role in ('teacher', 'headofdepartment') then
      p_launch_kind in (
        'lesson_authoring', 'h5p_authoring', 'scorm_authoring',
        'video_time_authoring'
      )
    else false
  end;
$$;

create or replace function nile_private.moodle_launch_target_type_is_allowed(
  p_launch_kind text,
  p_entity_type text
)
returns boolean
language sql
immutable
strict
security invoker
set search_path = ''
as $$
  select case p_launch_kind
    when 'lesson_authoring' then p_entity_type = 'lesson'
    when 'h5p_authoring' then p_entity_type = 'h5p_activity'
    when 'scorm_authoring' then p_entity_type = 'scorm'
    when 'video_time_authoring' then p_entity_type = 'video_time'
    when 'quiz_attempt' then p_entity_type = 'quiz'
    when 'assignment_submission' then p_entity_type = 'assignment'
    else false
  end;
$$;

create or replace function nile_private.moodle_launch_return_path_is_allowed(
  p_role text,
  p_return_path text
)
returns boolean
language sql
immutable
strict
security invoker
set search_path = ''
as $$
  select case p_role
    when 'student' then p_return_path like '/app/student/%'
    when 'teacher' then p_return_path like '/app/teacher/%'
    when 'headofdepartment' then p_return_path like '/app/hod/%'
    else false
  end;
$$;

create or replace function public.nile_create_moodle_command(
  p_session_id uuid,
  p_request_id uuid,
  p_operation text,
  p_target_mapping_id uuid,
  p_target_context_id uuid,
  p_expected_provider_version text,
  p_payload jsonb,
  p_idempotency_key text,
  p_request_hash text
)
returns table (
  command_request_id uuid,
  command_id uuid,
  outbox_event_id uuid,
  audit_id bigint,
  status text,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_session public.auth_sessions%rowtype;
  actor_grant public.role_grants%rowtype;
  existing_command public.command_executions%rowtype;
  connection public.integration_connections%rowtype;
  plugin_manifest public.moodle_plugin_manifests%rowtype;
  actor_mapping public.external_records%rowtype;
  context_mapping public.external_records%rowtype;
  target_course_id uuid;
  authorized_courses uuid[];
  authorized_users uuid[];
  source_template_id uuid;
  outcome_user_id uuid;
  created_command_id uuid := pg_catalog.gen_random_uuid();
  created_outbox_id uuid := pg_catalog.gen_random_uuid();
  created_audit_id bigint;
begin
  if p_request_id is null
    or p_operation is null
    or not nile_private.moodle_command_operation_is_allowed(p_operation)
    or p_expected_provider_version !~ '^[a-z0-9][a-z0-9._:+-]{0,79}$'
    or p_idempotency_key !~ '^[a-z0-9][a-z0-9._:-]{7,127}$'
    or p_request_hash !~ '^[a-f0-9]{64}$'
    or pg_catalog.jsonb_typeof(p_payload) <> 'object'
    or pg_catalog.octet_length(p_payload::text) > 65536
    or nile_private.jsonb_has_forbidden_keys(p_payload) then
    raise exception 'Moodle command request is invalid' using errcode = '22023';
  end if;

  select session.* into strict actor_session
  from public.auth_sessions as session
  join public.app_users as app_user
    on app_user.id = session.user_id and app_user.status = 'active'
  where session.id = p_session_id
    and session.revoked_at is null
    and session.expires_at > pg_catalog.now()
  for update;

  select role_grant.* into strict actor_grant
  from public.role_grants as role_grant
  where role_grant.id = actor_session.active_role_grant_id
    and role_grant.user_id = actor_session.user_id
    and role_grant.status = 'active'
    and role_grant.starts_at <= pg_catalog.now()
    and (role_grant.ends_at is null or role_grant.ends_at > pg_catalog.now());

  if not nile_private.moodle_command_role_is_allowed(actor_grant.role, p_operation) then
    raise exception 'Current role cannot perform this Moodle command'
      using errcode = '42501';
  end if;

  select command.* into existing_command
  from public.command_executions as command
  where command.idempotency_key = p_idempotency_key;
  if found then
    if existing_command.request_hash <> pg_catalog.decode(p_request_hash, 'hex')
      or existing_command.actor_user_id <> actor_session.user_id
      or existing_command.session_id <> actor_session.id then
      raise exception 'Moodle command idempotency conflict' using errcode = '23505';
    end if;
    return query
    select request.id, request.command_id, request.outbox_event_id, audit.id,
      request.status, true
    from public.moodle_command_requests as request
    join public.audit_logs as audit
      on audit.command_id = request.command_id
     and audit.action = 'moodle.command.queued'
    where request.command_id = existing_command.id;
    return;
  end if;

  select item.* into strict connection
  from public.integration_connections as item
  where item.provider = 'moodle'
    and item.environment in ('sandbox', 'preview')
    and item.mode = 'write_limited'
    and item.status = 'ready'
  order by item.last_verified_at desc
  limit 1;

  select manifest.* into strict plugin_manifest
  from public.moodle_plugin_manifests as manifest
  where manifest.connection_id = connection.id
    and manifest.component = 'local_nilelearn'
    and manifest.protocol_version = '1.0'
    and manifest.status = 'verified'
    and exists (
      select 1 from pg_catalog.jsonb_array_elements(manifest.operations) as operation
      where operation->>'name' = p_operation
    );

  select mapping.* into strict actor_mapping
  from public.external_records as mapping
  where mapping.connection_id = connection.id
    and mapping.entity_type = 'user'
    and mapping.internal_id = actor_session.user_id
    and mapping.sync_state = 'synced';

  select mapping.* into strict context_mapping
  from public.external_records as mapping
  where mapping.id = p_target_context_id
    and mapping.connection_id = connection.id
    and mapping.entity_type = 'context'
    and mapping.sync_state = 'synced';

  if p_operation <> 'delivery_course.clone' then
    if p_target_mapping_id is null then
      raise exception 'Moodle command target mapping is required' using errcode = '22023';
    end if;
    target_course_id := nile_private.moodle_target_course_internal_id(
      connection.id, p_target_mapping_id
    );
    select authority.authorized_course_ids into strict authorized_courses
    from public.resolve_moodle_course_projection_authority(
      actor_session.user_id, actor_session.active_role_grant_id
    ) as authority;
    if target_course_id is null
      or not target_course_id = any(authorized_courses) then
      raise exception 'Moodle command target is outside current scope'
        using errcode = '42501';
    end if;
  else
    if actor_grant.role <> 'headofdepartment'
      and actor_grant.role <> 'superadmin' then
      raise exception 'Only academic governance can clone delivery courses'
        using errcode = '42501';
    end if;
    if coalesce(p_payload->>'sourceTemplateInternalId', '')
      !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' then
      raise exception 'A valid internal source template is required'
        using errcode = '22023';
    end if;
    source_template_id := (p_payload->>'sourceTemplateInternalId')::uuid;
    select authority.authorized_course_ids into strict authorized_courses
    from public.resolve_moodle_course_projection_authority(
      actor_session.user_id, actor_session.active_role_grant_id
    ) as authority;
    if not source_template_id = any(authorized_courses)
      or not exists (
        select 1
        from public.external_records as source_mapping
        where source_mapping.connection_id = connection.id
          and source_mapping.entity_type = 'course'
          and source_mapping.internal_id = source_template_id
          and source_mapping.sync_state = 'synced'
      ) then
      raise exception 'Moodle source template is outside current scope'
        using errcode = '42501';
    end if;
  end if;

  if p_operation in ('grade.update', 'completion.update') then
    if coalesce(p_payload->>'userInternalId', '')
      !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' then
      raise exception 'A valid internal outcome user is required'
        using errcode = '22023';
    end if;
    outcome_user_id := (p_payload->>'userInternalId')::uuid;
    select authority.authorized_user_ids into strict authorized_users
    from public.resolve_moodle_user_projection_authority(
      actor_session.user_id, actor_session.active_role_grant_id
    ) as authority;
    if not outcome_user_id = any(authorized_users) then
      raise exception 'Moodle outcome user is outside current scope'
        using errcode = '42501';
    end if;
  end if;

  insert into public.command_executions (
    id, idempotency_key, actor_user_id, actor_role_grant_id, session_id,
    command_type, target_type, target_id, request_hash, requires_outbox
  ) values (
    created_command_id, p_idempotency_key, actor_session.user_id,
    actor_session.active_role_grant_id, actor_session.id,
    'moodle.command.enqueue', 'MoodleCommand', p_request_id::text,
    pg_catalog.decode(p_request_hash, 'hex'), true
  );

  insert into public.outbox_events (
    id, command_id, event_type, aggregate_type, aggregate_id, payload,
    idempotency_key
  ) values (
    created_outbox_id, created_command_id, 'moodle.command.requested',
    'moodle_command', p_request_id::text,
    pg_catalog.jsonb_build_object(
      'moodleCommandRequestId', p_request_id,
      'protocolVersion', '1.0',
      'operation', p_operation,
      'connectionId', connection.id,
      'actorMappingId', actor_mapping.id,
      'targetMappingId', p_target_mapping_id,
      'targetContextId', p_target_context_id,
      'expectedProviderVersion', p_expected_provider_version,
      'payloadHash', p_request_hash,
      'payload', p_payload
    ),
    p_idempotency_key || ':provider'
  );

  insert into public.moodle_command_requests (
    id, command_id, outbox_event_id, connection_id, plugin_manifest_id,
    actor_mapping_id, target_mapping_id, target_context_id, operation,
    request_hash, expected_provider_version
  ) values (
    p_request_id, created_command_id, created_outbox_id, connection.id,
    plugin_manifest.id, actor_mapping.id, p_target_mapping_id,
    p_target_context_id, p_operation, pg_catalog.decode(p_request_hash, 'hex'),
    p_expected_provider_version
  );

  insert into public.audit_logs (
    command_id, actor_user_id, actor_role_grant_id, session_id, action,
    entity_type, entity_id, after_state, metadata
  ) values (
    created_command_id, actor_session.user_id,
    actor_session.active_role_grant_id, actor_session.id,
    'moodle.command.queued', 'moodle_command', p_request_id::text,
    pg_catalog.jsonb_build_object('status', 'queued', 'operation', p_operation),
    pg_catalog.jsonb_build_object(
      'connectionId', connection.id,
      'targetMappingId', p_target_mapping_id
    )
  ) returning id into created_audit_id;

  update public.command_executions
  set status = 'succeeded', completed_at = pg_catalog.now()
  where id = created_command_id;

  return query select p_request_id, created_command_id, created_outbox_id,
    created_audit_id, 'queued'::text, false;
exception
  when no_data_found then
    raise exception 'Moodle command authority or verified integration is unavailable'
      using errcode = '42501';
end;
$$;

create or replace function public.nile_claim_moodle_command(
  p_worker_id text,
  p_lease_seconds integer
)
returns table (
  command_request_id uuid,
  operation text,
  connection_id uuid,
  actor_mapping_id uuid,
  actor_external_id text,
  target_mapping_id uuid,
  target_external_id text,
  target_context_id uuid,
  target_context_external_id text,
  expected_provider_version text,
  payload jsonb,
  payload_hash text,
  idempotency_key text,
  originating_command_id uuid,
  attempt_number integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  request public.moodle_command_requests%rowtype;
  event public.outbox_events%rowtype;
begin
  if p_worker_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,79}$'
    or p_lease_seconds not between 15 and 120 then
    raise exception 'Moodle worker lease is invalid' using errcode = '22023';
  end if;

  select item.* into request
  from public.moodle_command_requests as item
  where item.status = 'queued'
    or (
      item.status = 'processing'
      and item.lease_until <= pg_catalog.now()
    )
  order by item.created_at
  for update skip locked
  limit 1;
  if not found then return; end if;

  select outbox.* into strict event
  from public.outbox_events as outbox
  where outbox.id = request.outbox_event_id
  for update;

  update public.moodle_command_requests
  set status = 'processing',
    lease_until = pg_catalog.now() + pg_catalog.make_interval(secs => p_lease_seconds),
    leased_by = p_worker_id,
    attempt_count = attempt_count + 1,
    last_error_code = null
  where id = request.id
  returning * into request;

  update public.outbox_events
  set status = 'processing', locked_at = pg_catalog.now(),
    locked_by = p_worker_id, attempts = request.attempt_count,
    last_error = null
  where id = event.id;

  return query select request.id, request.operation, request.connection_id,
    request.actor_mapping_id, actor.external_id, request.target_mapping_id,
    target.external_id, request.target_context_id, context.external_id,
    request.expected_provider_version,
    event.payload->'payload', pg_catalog.encode(request.request_hash, 'hex'),
    event.idempotency_key, request.command_id, request.attempt_count
  from public.external_records as actor
  join public.external_records as context on context.id = request.target_context_id
  left join public.external_records as target on target.id = request.target_mapping_id
  where actor.id = request.actor_mapping_id;
end;
$$;

create or replace function public.nile_complete_moodle_command_attempt(
  p_command_request_id uuid,
  p_worker_id text,
  p_attempt_number integer,
  p_outcome text,
  p_provider_request_id text,
  p_response_hash text,
  p_provider_version text,
  p_error_code text
)
returns table (status text, reconciliation_case_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  request public.moodle_command_requests%rowtype;
  next_status text;
  case_id uuid;
begin
  select item.* into strict request
  from public.moodle_command_requests as item
  where item.id = p_command_request_id
    and item.status = 'processing'
    and item.leased_by = p_worker_id
    and item.lease_until > pg_catalog.now()
    and item.attempt_count = p_attempt_number
  for update;

  if p_outcome not in ('applied', 'failed', 'unknown', 'denied')
    or (p_outcome = 'applied' and (
      p_response_hash !~ '^[a-f0-9]{64}$'
      or p_provider_version !~ '^[a-z0-9][a-z0-9._:+-]{0,79}$'
    ))
    or (p_outcome in ('failed', 'denied') and
      p_error_code !~ '^[a-z0-9][a-z0-9._:-]{0,79}$') then
    raise exception 'Moodle command completion is invalid' using errcode = '22023';
  end if;

  insert into public.moodle_command_attempts (
    command_request_id, attempt_number, worker_id, outcome,
    provider_request_id, response_hash, error_code, started_at, finished_at
  ) values (
    request.id, p_attempt_number, p_worker_id, p_outcome,
    nullif(p_provider_request_id, ''),
    case when p_response_hash is null then null
      else pg_catalog.decode(p_response_hash, 'hex') end,
    nullif(p_error_code, ''),
    request.updated_at, pg_catalog.now()
  );

  if p_outcome = 'unknown' then
    insert into public.reconciliation_cases (
      connection_id, entity_type, internal_id, external_id, reason
    ) values (
      request.connection_id, 'moodle_command', request.id,
      p_provider_request_id, 'unknown_provider_outcome'
    ) on conflict do nothing;
    select item.id into strict case_id
    from public.reconciliation_cases as item
    where item.connection_id = request.connection_id
      and item.entity_type = 'moodle_command'
      and item.internal_id = request.id
      and item.reason = 'unknown_provider_outcome'
      and item.status = 'open';
    next_status := 'reconciliation_required';
  elsif p_outcome = 'applied' then
    next_status := 'applied';
  else
    next_status := 'failed';
  end if;

  update public.moodle_command_requests
  set status = next_status,
    lease_until = null,
    leased_by = null,
    last_error_code = nullif(p_error_code, ''),
    provider_result_hash = case when p_outcome = 'applied'
      then pg_catalog.decode(p_response_hash, 'hex') else null end,
    provider_version = case when p_outcome = 'applied'
      then p_provider_version else null end,
    reconciliation_case_id = case_id,
    completed_at = case when next_status <> 'reconciliation_required'
      then pg_catalog.now() else null end
  where id = request.id;

  update public.outbox_events
  set status = case when next_status = 'applied' then 'succeeded'
      when next_status = 'failed' then 'failed'
      else 'dead_letter' end,
    locked_at = null, locked_by = null,
    last_error = nullif(p_error_code, ''),
    processed_at = case when next_status = 'applied' then pg_catalog.now() else null end
  where id = request.outbox_event_id;

  return query select next_status, case_id;
end;
$$;

create or replace function public.nile_create_moodle_launch(
  p_session_id uuid,
  p_actor_mapping_id uuid,
  p_target_mapping_id uuid,
  p_launch_kind text,
  p_return_path text,
  p_ticket_hash text
)
returns table (launch_id uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_session public.auth_sessions%rowtype;
  actor_grant public.role_grants%rowtype;
  connection public.integration_connections%rowtype;
  actor_mapping public.external_records%rowtype;
  target_mapping public.external_records%rowtype;
  target_course_id uuid;
  authorized_courses uuid[];
  created_id uuid := pg_catalog.gen_random_uuid();
  expiry timestamptz := pg_catalog.now() + interval '60 seconds';
begin
  if p_ticket_hash !~ '^[a-f0-9]{64}$'
    or p_return_path !~ '^/app/[a-z0-9/_-]{1,220}$'
    or p_return_path ~ '\.\.'
    or p_launch_kind not in (
      'lesson_authoring', 'h5p_authoring', 'scorm_authoring',
      'video_time_authoring', 'quiz_attempt', 'assignment_submission'
    ) then
    raise exception 'Moodle launch request is invalid' using errcode = '22023';
  end if;
  select session.* into strict actor_session
  from public.auth_sessions as session
  join public.app_users as app_user
    on app_user.id = session.user_id and app_user.status = 'active'
  where session.id = p_session_id
    and session.revoked_at is null
    and session.expires_at > pg_catalog.now();
  select role_grant.* into strict actor_grant
  from public.role_grants as role_grant
  where role_grant.id = actor_session.active_role_grant_id
    and role_grant.user_id = actor_session.user_id
    and role_grant.status = 'active'
    and role_grant.starts_at <= pg_catalog.now()
    and (role_grant.ends_at is null or role_grant.ends_at > pg_catalog.now());
  if not nile_private.moodle_launch_role_is_allowed(
    actor_grant.role, p_launch_kind
  ) or not nile_private.moodle_launch_return_path_is_allowed(
    actor_grant.role, p_return_path
  ) then
    raise exception 'Current role cannot create this Moodle launch'
      using errcode = '42501';
  end if;

  select item.* into strict connection
  from public.integration_connections as item
  where item.provider = 'moodle'
    and item.environment in ('sandbox', 'preview')
    and item.mode = 'write_limited'
    and item.status = 'ready'
  order by item.last_verified_at desc
  limit 1;

  select mapping.* into strict actor_mapping
  from public.external_records as mapping
  where mapping.id = p_actor_mapping_id
    and mapping.connection_id = connection.id
    and mapping.entity_type = 'user'
    and mapping.internal_id = actor_session.user_id
    and mapping.sync_state = 'synced';

  select mapping.* into strict target_mapping
  from public.external_records as mapping
  where mapping.id = p_target_mapping_id
    and mapping.connection_id = connection.id
    and mapping.sync_state = 'synced';

  if not nile_private.moodle_launch_target_type_is_allowed(
    p_launch_kind, target_mapping.entity_type
  ) then
    raise exception 'Moodle launch target type is invalid'
      using errcode = '42501';
  end if;

  target_course_id := nile_private.moodle_target_course_internal_id(
    connection.id, target_mapping.id
  );
  select authority.authorized_course_ids into strict authorized_courses
  from public.resolve_moodle_course_projection_authority(
    actor_session.user_id, actor_session.active_role_grant_id
  ) as authority;
  if target_course_id is null
    or not target_course_id = any(authorized_courses) then
    raise exception 'Moodle launch target is outside current scope'
      using errcode = '42501';
  end if;

  insert into public.moodle_native_launch_tickets (
    id, ticket_hash, session_id, actor_user_id, actor_role_grant_id,
    actor_mapping_id, target_mapping_id, launch_kind, return_path, expires_at
  ) values (
    created_id, pg_catalog.decode(p_ticket_hash, 'hex'), actor_session.id,
    actor_session.user_id, actor_session.active_role_grant_id,
    p_actor_mapping_id, p_target_mapping_id, p_launch_kind, p_return_path, expiry
  );
  return query select created_id, expiry;
exception
  when no_data_found then
    raise exception 'Moodle launch authority is unavailable' using errcode = '42501';
end;
$$;

create or replace function public.nile_get_moodle_command_status(
  p_session_id uuid,
  p_command_request_id uuid
)
returns table (
  command_request_id uuid,
  operation text,
  status text,
  provider_version text,
  reconciliation_case_id uuid,
  attempt_count integer,
  last_error_code text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_session public.auth_sessions%rowtype;
begin
  select session.* into strict actor_session
  from public.auth_sessions as session
  join public.app_users as app_user
    on app_user.id = session.user_id and app_user.status = 'active'
  where session.id = p_session_id
    and session.revoked_at is null
    and session.expires_at > pg_catalog.now();

  return query
  select request.id, request.operation, request.status,
    request.provider_version, request.reconciliation_case_id,
    request.attempt_count, request.last_error_code,
    request.created_at, request.updated_at
  from public.moodle_command_requests as request
  join public.command_executions as command on command.id = request.command_id
  where request.id = p_command_request_id
    and (
      command.actor_user_id = actor_session.user_id
      or exists (
        select 1 from public.role_grants as role_grant
        where role_grant.id = actor_session.active_role_grant_id
          and role_grant.user_id = actor_session.user_id
          and role_grant.role = 'superadmin'
          and role_grant.status = 'active'
      )
    );
exception
  when no_data_found then
    raise exception 'Moodle command status authority is unavailable'
      using errcode = '42501';
end;
$$;

create or replace function public.nile_reconcile_moodle_command(
  p_session_id uuid,
  p_command_request_id uuid,
  p_resolution text,
  p_provider_result_hash text,
  p_provider_version text
)
returns table (status text, audit_id bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_session public.auth_sessions%rowtype;
  request public.moodle_command_requests%rowtype;
  created_audit_id bigint;
  next_status text;
begin
  select session.* into strict actor_session
  from public.auth_sessions as session
  join public.app_users as app_user
    on app_user.id = session.user_id and app_user.status = 'active'
  join public.role_grants as role_grant
    on role_grant.id = session.active_role_grant_id
   and role_grant.user_id = session.user_id
   and role_grant.role = 'superadmin'
   and role_grant.status = 'active'
  where session.id = p_session_id
    and session.revoked_at is null
    and session.expires_at > pg_catalog.now();

  select item.* into strict request
  from public.moodle_command_requests as item
  where item.id = p_command_request_id
    and item.status = 'reconciliation_required'
  for update;

  if p_resolution = 'confirmed_applied' then
    if p_provider_result_hash !~ '^[a-f0-9]{64}$'
      or p_provider_version !~ '^[a-z0-9][a-z0-9._:+-]{0,79}$' then
      raise exception 'Confirmed result evidence is invalid' using errcode = '22023';
    end if;
    next_status := 'applied';
  elsif p_resolution = 'confirmed_not_applied' then
    next_status := 'queued';
  elsif p_resolution = 'cancelled' then
    next_status := 'cancelled';
  else
    raise exception 'Moodle reconciliation resolution is invalid'
      using errcode = '22023';
  end if;

  update public.reconciliation_cases
  set status = 'resolved', resolution = p_resolution,
    resolved_by = actor_session.user_id, resolved_at = pg_catalog.now()
  where id = request.reconciliation_case_id and status = 'open';

  update public.moodle_command_requests
  set status = next_status,
    reconciliation_case_id = null,
    provider_result_hash = case when next_status = 'applied'
      then pg_catalog.decode(p_provider_result_hash, 'hex') else null end,
    provider_version = case when next_status = 'applied'
      then p_provider_version else null end,
    completed_at = case when next_status in ('applied', 'cancelled')
      then pg_catalog.now() else null end,
    last_error_code = null
  where id = request.id;

  update public.outbox_events
  set status = case when next_status = 'applied' then 'succeeded'
      when next_status = 'queued' then 'pending'
      else 'dead_letter' end,
    available_at = case when next_status = 'queued'
      then pg_catalog.now() else available_at end,
    locked_at = null, locked_by = null,
    last_error = null,
    processed_at = case when next_status = 'applied'
      then pg_catalog.now() else null end
  where id = request.outbox_event_id;

  insert into public.audit_logs (
    command_id, actor_user_id, actor_role_grant_id, session_id,
    action, entity_type, entity_id, after_state, metadata
  ) values (
    request.command_id, actor_session.user_id,
    actor_session.active_role_grant_id, actor_session.id,
    'moodle.command.reconciled', 'moodle_command', request.id::text,
    pg_catalog.jsonb_build_object('status', next_status),
    pg_catalog.jsonb_build_object('resolution', p_resolution)
  ) returning id into created_audit_id;

  return query select next_status, created_audit_id;
exception
  when no_data_found then
    raise exception 'Moodle reconciliation authority is unavailable'
      using errcode = '42501';
end;
$$;

create or replace function public.nile_consume_moodle_launch(
  p_ticket_hash text
)
returns table (
  launch_id uuid,
  actor_external_id text,
  target_external_id text,
  launch_kind text,
  return_path text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  ticket public.moodle_native_launch_tickets%rowtype;
  actor_session public.auth_sessions%rowtype;
  actor_grant public.role_grants%rowtype;
  actor_mapping public.external_records%rowtype;
  target_mapping public.external_records%rowtype;
  target_course_id uuid;
  authorized_courses uuid[];
begin
  if p_ticket_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Moodle launch ticket is invalid' using errcode = '22023';
  end if;
  select item.* into strict ticket
  from public.moodle_native_launch_tickets as item
  where item.ticket_hash = pg_catalog.decode(p_ticket_hash, 'hex')
    and item.consumed_at is null
    and item.expires_at > pg_catalog.now()
  for update of item;

  select session.* into strict actor_session
  from public.auth_sessions as session
  join public.app_users as app_user
    on app_user.id = session.user_id
   and app_user.status = 'active'
  where session.id = ticket.session_id
    and session.user_id = ticket.actor_user_id
    and session.active_role_grant_id = ticket.actor_role_grant_id
    and session.revoked_at is null
    and session.expires_at > pg_catalog.now();

  select role_grant.* into strict actor_grant
  from public.role_grants as role_grant
  where role_grant.id = actor_session.active_role_grant_id
    and role_grant.user_id = actor_session.user_id
    and role_grant.status = 'active'
    and role_grant.starts_at <= pg_catalog.now()
    and (role_grant.ends_at is null or role_grant.ends_at > pg_catalog.now());

  select mapping.* into strict actor_mapping
  from public.external_records as mapping
  where mapping.id = ticket.actor_mapping_id
    and mapping.entity_type = 'user'
    and mapping.internal_id = actor_session.user_id
    and mapping.sync_state = 'synced';

  select mapping.* into strict target_mapping
  from public.external_records as mapping
  where mapping.id = ticket.target_mapping_id
    and mapping.connection_id = actor_mapping.connection_id
    and mapping.sync_state = 'synced';

  if not nile_private.moodle_launch_role_is_allowed(
    actor_grant.role, ticket.launch_kind
  ) or not nile_private.moodle_launch_return_path_is_allowed(
    actor_grant.role, ticket.return_path
  ) or not nile_private.moodle_launch_target_type_is_allowed(
    ticket.launch_kind, target_mapping.entity_type
  ) then
    raise exception 'Moodle launch authority is no longer valid'
      using errcode = '42501';
  end if;

  target_course_id := nile_private.moodle_target_course_internal_id(
    actor_mapping.connection_id, target_mapping.id
  );
  select authority.authorized_course_ids into strict authorized_courses
  from public.resolve_moodle_course_projection_authority(
    actor_session.user_id, actor_session.active_role_grant_id
  ) as authority;
  if target_course_id is null
    or not target_course_id = any(authorized_courses) then
    raise exception 'Moodle launch relationship is no longer active'
      using errcode = '42501';
  end if;

  update public.moodle_native_launch_tickets
  set consumed_at = pg_catalog.now()
  where id = ticket.id;
  return query
  select ticket.id, actor_mapping.external_id, target_mapping.external_id,
    ticket.launch_kind, ticket.return_path;
exception
  when no_data_found then
    raise exception 'Moodle launch ticket is expired, used, or revoked'
      using errcode = '42501';
end;
$$;

create or replace function nile_private.preserve_moodle_command_request()
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
    or (old.status = 'queued' and new.status in (
      'processing', 'failed', 'reconciliation_required', 'cancelled'
    ))
    or (old.status = 'processing' and new.status in (
      'processing', 'applied', 'failed', 'reconciliation_required'
    ))
    or (old.status = 'reconciliation_required' and new.status in (
      'queued', 'applied', 'cancelled'
    ))
  ) then
    raise exception 'Invalid Moodle command transition from % to %', old.status, new.status
      using errcode = '23514';
  end if;
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

alter table public.moodle_native_launch_tickets enable row level security;
alter table public.moodle_native_launch_tickets force row level security;

revoke all on public.moodle_native_launch_tickets
  from public, anon, authenticated, service_role;
revoke all on function nile_private.moodle_command_role_is_allowed(text, text)
  from public, anon, authenticated, service_role;
revoke all on function nile_private.moodle_target_course_internal_id(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function nile_private.moodle_launch_role_is_allowed(text, text)
  from public, anon, authenticated, service_role;
revoke all on function nile_private.moodle_launch_target_type_is_allowed(text, text)
  from public, anon, authenticated, service_role;
revoke all on function nile_private.moodle_launch_return_path_is_allowed(text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.nile_create_moodle_command(
  uuid, uuid, text, uuid, uuid, text, jsonb, text, text
) from public, anon, authenticated;
revoke all on function public.nile_claim_moodle_command(text, integer)
  from public, anon, authenticated;
revoke all on function public.nile_complete_moodle_command_attempt(
  uuid, text, integer, text, text, text, text, text
) from public, anon, authenticated;
revoke all on function public.nile_create_moodle_launch(
  uuid, uuid, uuid, text, text, text
) from public, anon, authenticated;
revoke all on function public.nile_get_moodle_command_status(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.nile_reconcile_moodle_command(
  uuid, uuid, text, text, text
) from public, anon, authenticated;
revoke all on function public.nile_consume_moodle_launch(text)
  from public, anon, authenticated;

grant execute on function public.nile_create_moodle_command(
  uuid, uuid, text, uuid, uuid, text, jsonb, text, text
) to service_role;
grant execute on function public.nile_claim_moodle_command(text, integer)
  to service_role;
grant execute on function public.nile_complete_moodle_command_attempt(
  uuid, text, integer, text, text, text, text, text
) to service_role;
grant execute on function public.nile_create_moodle_launch(
  uuid, uuid, uuid, text, text, text
) to service_role;
grant execute on function public.nile_get_moodle_command_status(uuid, uuid)
  to service_role;
grant execute on function public.nile_reconcile_moodle_command(
  uuid, uuid, text, text, text
) to service_role;
grant execute on function public.nile_consume_moodle_launch(text)
  to service_role;

commit;
