-- Nile Learn Phase 6F disposable-database rollback.
-- Phase 6A/6E schema and durable external/sync/reconciliation evidence remain.

begin;

drop function public.list_authorized_moodle_enrollment_group_freshness(uuid, uuid, uuid, uuid, timestamptz);
drop function public.record_moodle_enrollment_group_observation(text, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, text, jsonb, bytea, timestamptz, timestamptz, timestamptz, uuid, text);
drop function public.resolve_moodle_enrollment_group_context(uuid, uuid, uuid);
drop table public.moodle_enrollment_group_observations;
drop function nile_private.moodle_enrollment_group_payload_is_safe(jsonb, text);

commit;
