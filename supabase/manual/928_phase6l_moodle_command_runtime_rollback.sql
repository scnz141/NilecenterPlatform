-- Nile Learn Phase 6L rollback. Leaves Phase 6K intact.

begin;

drop function if exists public.nile_consume_moodle_launch(text);
drop function if exists public.nile_reconcile_moodle_command(
  uuid, uuid, text, text, text
);
drop function if exists public.nile_get_moodle_command_status(uuid, uuid);
drop function if exists public.nile_create_moodle_launch(
  uuid, uuid, uuid, text, text, text
);
drop function if exists public.nile_complete_moodle_command_attempt(
  uuid, text, integer, text, text, text, text, text
);
drop function if exists public.nile_claim_moodle_command(text, integer);
drop function if exists public.nile_create_moodle_command(
  uuid, uuid, text, uuid, uuid, text, jsonb, text, text
);
drop function if exists nile_private.moodle_target_course_internal_id(uuid, uuid);
drop function if exists nile_private.moodle_launch_return_path_is_allowed(text, text);
drop function if exists nile_private.moodle_launch_target_type_is_allowed(text, text);
drop function if exists nile_private.moodle_launch_role_is_allowed(text, text);
drop function if exists nile_private.moodle_command_role_is_allowed(text, text);

drop table if exists public.moodle_native_launch_tickets;

alter table public.moodle_command_requests
  drop constraint if exists moodle_command_requests_lease_check,
  drop column if exists last_error_code,
  drop column if exists attempt_count,
  drop column if exists leased_by,
  drop column if exists lease_until,
  drop constraint if exists moodle_command_requests_status_check;
alter table public.moodle_command_requests
  add constraint moodle_command_requests_status_check check (
    status in ('queued', 'applied', 'failed', 'reconciliation_required', 'cancelled')
  );

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
      'applied', 'failed', 'reconciliation_required', 'cancelled'
    ))
  ) then
    raise exception 'Invalid Moodle command transition from % to %', old.status, new.status
      using errcode = '23514';
  end if;
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

alter table public.integration_connections
  drop constraint if exists integration_connections_moodle_mode_check;
alter table public.integration_connections
  drop constraint if exists integration_connections_provider_mode_check;
alter table public.integration_connections
  drop constraint if exists integration_connections_mode_check;
alter table public.integration_connections
  add constraint integration_connections_mode_check check (
    mode in ('disabled', 'read_only', 'migration')
  );
alter table public.integration_connections
  add constraint integration_connections_check check (
    provider <> 'legacy_ems' or mode in ('disabled', 'read_only', 'migration')
  );

commit;
