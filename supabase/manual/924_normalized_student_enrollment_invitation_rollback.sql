-- Roll back the manual normalized student enrollment invitation package.

begin;

drop function if exists public.nile_read_teacher_class_workspace(text);
drop function if exists public.nile_read_student_learning_workspace(text);
drop function if exists public.nile_read_admissions_student_workspace(text);
drop function if exists public.nile_accept_user_invitation_with_enrollment(uuid, uuid);
drop function if exists public.nile_create_student_enrollment_invitation_with_evidence(
  text, uuid, uuid, text, text, text, text, text, text, text, text, text,
  text, text, uuid, uuid, text, uuid, uuid, uuid, text, text, timestamptz,
  text, text
);

alter table if exists public.student_profiles
  drop column if exists placement_booking_id,
  drop column if exists application_id,
  drop column if exists lead_id,
  drop column if exists notes,
  drop column if exists course_interest,
  drop column if exists current_level,
  drop column if exists source;

commit;
