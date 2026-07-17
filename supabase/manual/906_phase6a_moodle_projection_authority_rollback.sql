-- Nile Learn Phase 6A disposable-database rollback.
--
-- Run only before any dependent schema exists. Shared Phase 1 identity,
-- organization, and integration tables are intentionally retained.

begin;

drop function public.list_moodle_course_mappings(uuid[]);
drop function public.resolve_moodle_course_projection_authority(uuid, uuid);

drop table public.class_memberships;
drop table public.enrollments;
drop table public.teacher_assignments;
drop table public.class_groups;
drop table public.course_runs;
drop table public.student_profiles;
drop table public.course_templates;
drop table public.course_levels;
drop table public.programs;

commit;
