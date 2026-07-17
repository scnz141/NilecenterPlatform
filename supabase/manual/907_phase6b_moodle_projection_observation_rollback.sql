-- Nile Learn Phase 6B observation package rollback.

begin;

drop function public.resolve_moodle_projection_reconciliation(uuid, uuid, uuid, text);
drop function public.list_authorized_moodle_projection_freshness(uuid, uuid, uuid, text, timestamptz, uuid[]);
drop function public.record_moodle_projection_observation(text, uuid, uuid, uuid, uuid, uuid, text, text, jsonb, bytea, timestamptz, timestamptz, timestamptz, uuid, text);
drop function public.list_moodle_course_mappings_for_connection(uuid, uuid[]);
drop function public.resolve_moodle_projection_context(uuid, uuid);
drop table public.moodle_projection_observations;
drop function nile_private.moodle_sanitized_projection_is_safe(jsonb, integer);

commit;
