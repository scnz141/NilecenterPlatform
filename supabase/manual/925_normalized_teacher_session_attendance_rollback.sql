begin;

drop function if exists public.nile_read_student_attendance_workspace(text);
drop function if exists public.nile_read_teacher_attendance_workspace(text);
drop function if exists public.nile_save_teacher_attendance_with_evidence(
  text, uuid, uuid, jsonb, jsonb, integer, text, text
);
drop function if exists public.nile_create_teacher_class_session_with_evidence(
  text, uuid, text, text, timestamptz, timestamptz, text, text
);
drop table if exists public.attendance_records;
drop table if exists public.class_sessions;

commit;
