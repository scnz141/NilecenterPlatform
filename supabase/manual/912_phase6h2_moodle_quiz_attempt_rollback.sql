-- Nile Learn Phase 6H2 disposable-database rollback.
-- Phase 6A/6E/6F/6G schema and durable integration evidence remain.

begin;

drop function public.purge_moodle_quiz_attempt_observations(timestamptz, integer);
drop function public.list_authorized_moodle_quiz_attempt_freshness(uuid, uuid, uuid, uuid, uuid, timestamptz);
drop function public.record_moodle_quiz_attempt_observation(text, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, text, jsonb, bytea, timestamptz, timestamptz, timestamptz, uuid, text);
drop function public.resolve_moodle_quiz_attempt_context(uuid, uuid, uuid, uuid);
drop table public.moodle_quiz_attempt_observations;
drop function nile_private.guard_moodle_quiz_attempt_immutable();
drop function nile_private.moodle_quiz_attempt_payload_is_safe(jsonb, text);

commit;
