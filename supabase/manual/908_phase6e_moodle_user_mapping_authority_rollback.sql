-- Nile Learn Phase 6E disposable-database rollback.
-- Shared Phase 1 and Phase 6A schema remains intact.

begin;

drop function public.list_moodle_user_mappings_for_connection(uuid, uuid[]);
drop function public.resolve_moodle_user_projection_authority(uuid, uuid);

commit;
