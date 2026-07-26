-- Nile Learn Phase 6L semantic assertions. Read-only.

do $$
declare
  v_table_name text;
  function_signature text;
begin
  foreach v_table_name in array array[
    'moodle_plugin_manifests', 'moodle_command_requests',
    'moodle_command_attempts', 'moodle_native_launch_tickets'
  ] loop
    if pg_catalog.to_regclass('public.' || v_table_name) is null then
      raise exception 'Missing Phase 6L table public.%', v_table_name;
    end if;
    if not exists (
      select 1 from pg_catalog.pg_class as class
      join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
      where namespace.nspname = 'public' and class.relname = v_table_name
        and class.relrowsecurity and class.relforcerowsecurity
    ) then
      raise exception 'Phase 6L RLS is not enabled and forced on public.%', v_table_name;
    end if;
    if exists (
      select 1 from information_schema.role_table_grants
      where table_schema = 'public'
        and role_table_grants.table_name = v_table_name
        and grantee in ('anon', 'authenticated')
    ) then
      raise exception 'Browser role has direct Phase 6L table access on public.%', v_table_name;
    end if;
  end loop;

  foreach function_signature in array array[
    'public.nile_create_moodle_command(uuid,uuid,text,uuid,uuid,text,jsonb,text,text)',
    'public.nile_claim_moodle_command(text,integer)',
    'public.nile_complete_moodle_command_attempt(uuid,text,integer,text,text,text,text,text)',
    'public.nile_get_moodle_command_status(uuid,uuid)',
    'public.nile_reconcile_moodle_command(uuid,uuid,text,text,text)',
    'public.nile_create_moodle_launch(uuid,uuid,uuid,text,text,text)',
    'public.nile_consume_moodle_launch(text)'
  ] loop
    if pg_catalog.to_regprocedure(function_signature) is null then
      raise exception 'Missing Phase 6L RPC %', function_signature;
    end if;
  end loop;

  if nile_private.moodle_command_role_is_allowed('student', 'grade.update')
    or nile_private.moodle_command_role_is_allowed('registrar', 'page.upsert')
    or nile_private.moodle_command_role_is_allowed('branchadmin', 'section.upsert')
    or nile_private.moodle_command_role_is_allowed('superadmin', 'question.upsert')
    or not nile_private.moodle_command_role_is_allowed('teacher', 'grade.update')
    or not nile_private.moodle_command_role_is_allowed(
      'headofdepartment', 'delivery_course.clone'
    ) then
    raise exception 'Phase 6L role-operation matrix is unsafe';
  end if;

  if nile_private.moodle_launch_role_is_allowed('teacher', 'quiz_attempt')
    or nile_private.moodle_launch_role_is_allowed(
      'student', 'lesson_authoring'
    )
    or nile_private.moodle_launch_role_is_allowed(
      'superadmin', 'lesson_authoring'
    )
    or not nile_private.moodle_launch_role_is_allowed(
      'student', 'quiz_attempt'
    )
    or not nile_private.moodle_launch_role_is_allowed(
      'teacher', 'lesson_authoring'
    )
    or not nile_private.moodle_launch_role_is_allowed(
      'headofdepartment', 'h5p_authoring'
    ) then
    raise exception 'Phase 6L launch role matrix is unsafe';
  end if;

  if nile_private.moodle_launch_target_type_is_allowed(
      'quiz_attempt', 'assignment'
    )
    or nile_private.moodle_launch_target_type_is_allowed(
      'lesson_authoring', 'course'
    )
    or not nile_private.moodle_launch_target_type_is_allowed(
      'quiz_attempt', 'quiz'
    )
    or not nile_private.moodle_launch_target_type_is_allowed(
      'assignment_submission', 'assignment'
    )
    or not nile_private.moodle_launch_target_type_is_allowed(
      'video_time_authoring', 'video_time'
    ) then
    raise exception 'Phase 6L launch target matrix is unsafe';
  end if;

  if nile_private.moodle_launch_return_path_is_allowed(
      'student', '/app/teacher/classes'
    )
    or nile_private.moodle_launch_return_path_is_allowed(
      'teacher', '/app/hod/courses'
    )
    or not nile_private.moodle_launch_return_path_is_allowed(
      'student', '/app/student/courses'
    )
    or not nile_private.moodle_launch_return_path_is_allowed(
      'teacher', '/app/teacher/classes'
    )
    or not nile_private.moodle_launch_return_path_is_allowed(
      'headofdepartment', '/app/hod/courses'
    ) then
    raise exception 'Phase 6L launch return-path matrix is unsafe';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.integration_connections'::pg_catalog.regclass
      and conname = 'integration_connections_moodle_mode_check'
  ) then
    raise exception 'Phase 6L Moodle write_limited connection guard is missing';
  end if;
end;
$$;
