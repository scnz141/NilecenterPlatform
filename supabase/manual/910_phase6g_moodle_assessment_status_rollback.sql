-- Nile Learn Phase 6G disposable-database rollback.
-- Phase 6A/6E/6F schema and durable external/sync/reconciliation evidence remain.

begin;

drop function public.purge_moodle_assessment_status_observations(timestamptz, integer);
drop function public.list_authorized_moodle_assessment_status_freshness(uuid, uuid, uuid, uuid, timestamptz);
drop function public.record_moodle_assessment_status_observation(text, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, jsonb, bytea, timestamptz, timestamptz, timestamptz, uuid, text);
drop function public.resolve_moodle_assessment_status_context(uuid, uuid, uuid);
drop table public.moodle_assessment_status_observations;
drop function nile_private.guard_moodle_assessment_status_immutable();
drop function nile_private.moodle_assessment_status_payload_is_safe(jsonb);

commit;
