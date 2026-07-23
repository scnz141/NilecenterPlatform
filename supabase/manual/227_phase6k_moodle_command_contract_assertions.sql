-- Nile Learn Phase 6K command-contract semantic assertions.
-- This script is read-only outside its rolled-back test transaction.

begin;

do $$
declare
  required_tables text[] := array[
    'moodle_plugin_manifests',
    'moodle_command_requests',
    'moodle_command_attempts'
  ];
  table_name text;
begin
  foreach table_name in array required_tables loop
    if pg_catalog.to_regclass('public.' || table_name) is null then
      raise exception 'Missing Phase 6K table public.%', table_name;
    end if;
    if not exists (
      select 1
      from pg_catalog.pg_class as class
      join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
      where namespace.nspname = 'public'
        and class.relname = table_name
        and class.relrowsecurity
        and class.relforcerowsecurity
    ) then
      raise exception 'Phase 6K RLS is not enabled and forced on public.%', table_name;
    end if;
    if exists (
      select 1 from pg_catalog.pg_policies as policy
      where policy.schemaname = 'public' and policy.tablename = table_name
    ) then
      raise exception 'Phase 6K server-only table public.% has a policy', table_name;
    end if;
    if pg_catalog.has_table_privilege('anon', 'public.' || table_name, 'SELECT')
      or pg_catalog.has_table_privilege('authenticated', 'public.' || table_name, 'SELECT')
      or pg_catalog.has_table_privilege('service_role', 'public.' || table_name, 'SELECT') then
      raise exception 'Runtime role has direct Phase 6K table access on public.%', table_name;
    end if;
  end loop;
end;
$$;

do $$
declare
  operations jsonb := '[
    {"name":"delivery_course.clone","requiredCapability":"moodle/course:create"},
    {"name":"delivery_course.archive","requiredCapability":"moodle/course:update"},
    {"name":"delivery_course.restore","requiredCapability":"moodle/course:update"},
    {"name":"section.upsert","requiredCapability":"moodle/course:manageactivities"},
    {"name":"section.reorder","requiredCapability":"moodle/course:sectionvisibility"},
    {"name":"section.visibility","requiredCapability":"moodle/course:sectionvisibility"},
    {"name":"page.upsert","requiredCapability":"moodle/course:manageactivities"},
    {"name":"book.upsert","requiredCapability":"moodle/course:manageactivities"},
    {"name":"url.upsert","requiredCapability":"moodle/course:manageactivities"},
    {"name":"resource.upsert","requiredCapability":"moodle/course:manageactivities"},
    {"name":"resource.archive","requiredCapability":"moodle/course:manageactivities"},
    {"name":"assignment.upsert","requiredCapability":"moodle/course:manageactivities"},
    {"name":"assignment.archive","requiredCapability":"moodle/course:manageactivities"},
    {"name":"quiz_shell.upsert","requiredCapability":"moodle/course:manageactivities"},
    {"name":"quiz.archive","requiredCapability":"moodle/course:manageactivities"},
    {"name":"question.upsert","requiredCapability":"moodle/question:editall"},
    {"name":"question.move","requiredCapability":"moodle/question:moveall"},
    {"name":"grade.update","requiredCapability":"moodle/grade:edit"},
    {"name":"completion.update","requiredCapability":"moodle/course:overridecompletion"}
  ]'::jsonb;
  launches jsonb := '[
    "lesson_authoring", "h5p_authoring", "scorm_authoring",
    "video_time_authoring", "quiz_attempt", "assignment_submission"
  ]'::jsonb;
begin
  if not nile_private.moodle_plugin_manifest_is_safe(operations, launches) then
    raise exception 'Complete local_nilelearn manifest was rejected';
  end if;
  if nile_private.moodle_plugin_manifest_is_safe(
    operations - (pg_catalog.jsonb_array_length(operations) - 1), launches
  ) then
    raise exception 'Incomplete local_nilelearn manifest was accepted';
  end if;
  if nile_private.moodle_command_operation_is_allowed('lesson_authoring') then
    raise exception 'Native Moodle launch was accepted as a command operation';
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname like '%moodle%command%'
  ) then
    raise exception 'Phase 6K unexpectedly exposed a public Moodle command RPC';
  end if;
end;
$$;

rollback;
