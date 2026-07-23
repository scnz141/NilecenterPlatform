-- Nile Learn Phase 6K Moodle command-contract rollback.

begin;

drop trigger if exists outbox_events_require_moodle_command_request on public.outbox_events;
drop function if exists nile_private.require_moodle_command_request_for_outbox();
drop table if exists public.moodle_command_attempts;
drop table if exists public.moodle_command_requests;
drop table if exists public.moodle_plugin_manifests;
drop function if exists nile_private.require_moodle_command_atomic_evidence();
drop function if exists nile_private.preserve_moodle_command_request();
drop function if exists nile_private.preserve_moodle_plugin_manifest();
drop function if exists nile_private.validate_moodle_command_request();
drop function if exists nile_private.moodle_plugin_manifest_is_safe(jsonb, jsonb);
drop function if exists nile_private.moodle_command_operation_is_allowed(text);

commit;
