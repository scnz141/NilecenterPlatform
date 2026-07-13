-- Nile Learn Phase 13F1 semantic assertions.
-- Run only against the disposable local acceptance database.

begin;

do $$
declare
  v_count integer;
  v_projection jsonb;
begin
  select count(*)
  into v_count
  from pg_catalog.pg_tables
  where schemaname = 'public'
    and tablename = any(array[
      'form_permission_mappings',
      'form_operation_permissions',
      'role_grant_permissions',
      'form_command_results',
      'form_public_commands',
      'form_public_rate_limits',
      'form_offline_bundles',
      'form_offline_bundle_items',
      'nile_forms_repository_contract'
    ]);
  if v_count <> 9 then
    raise exception 'Phase 13F1 table count mismatch: %', v_count;
  end if;

  select count(*)
  into v_count
  from pg_catalog.pg_class as relation
  join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relname = any(array[
      'form_permission_mappings',
      'form_operation_permissions',
      'role_grant_permissions',
      'form_command_results',
      'form_public_commands',
      'form_public_rate_limits',
      'form_offline_bundles',
      'form_offline_bundle_items',
      'nile_forms_repository_contract'
    ])
    and relation.relrowsecurity
    and relation.relforcerowsecurity;
  if v_count <> 9 then
    raise exception 'Phase 13F1 forced-RLS table count mismatch: %', v_count;
  end if;

  select count(*)
  into v_count
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and tablename like 'form_%';
  if v_count <> 0 then
    raise exception 'Nile Forms browser policies must remain absent';
  end if;

  select count(*)
  into v_count
  from public.form_permission_mappings;
  if v_count <> 9 then
    raise exception 'Nile Forms permission mapping count mismatch: %', v_count;
  end if;
  if exists (
    select 1
    from public.form_permission_mappings as mapping
    where replace(mapping.application_code, ':', '.') <> mapping.database_code
  ) then
    raise exception 'Nile Forms permission mapping is not one-to-one';
  end if;
  if not exists (
    select 1
    from public.form_permission_mappings
    where application_code = 'forms:read' and database_code = 'forms.read'
  ) or not exists (
    select 1
    from public.form_permission_mappings
    where application_code = 'form_submissions:sensitive_read'
      and database_code = 'form_submissions.sensitive_read'
  ) then
    raise exception 'Required Nile Forms permission translations are missing';
  end if;

  select count(*) into v_count
  from public.form_operation_permissions
  where operation_kind = 'query';
  if v_count <> 13 then
    raise exception 'Nile Forms query catalog count mismatch: %', v_count;
  end if;
  select count(*) into v_count
  from public.form_operation_permissions
  where operation_kind = 'command';
  if v_count <> 20 then
    raise exception 'Nile Forms command catalog count mismatch: %', v_count;
  end if;

  if exists (
    select 1
    from public.role_permissions
    where permission_code = 'form_submissions.sensitive_read'
  ) then
    raise exception 'Sensitive Forms access must never be role-wide';
  end if;
  if not exists (
    select 1
    from public.role_grant_permissions as permission
    where permission.role_grant_id = '50000000-0000-4000-8000-000000000006'
      and permission.permission_code = 'form_submissions.sensitive_read'
      and permission.status = 'active'
      and permission.source = 'auto_superadmin'
  ) then
    raise exception 'Active Super Admin grant lacks default sensitive evidence';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants as privilege
    where privilege.grantee = 'nile_forms_executor'
      and privilege.privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
  ) then
    raise exception 'Nile Forms executor received forbidden table DML';
  end if;
  if exists (
    select 1
    from pg_catalog.pg_roles
    where rolname = 'nile_forms_executor'
      and (
        rolsuper
        or rolcreatedb
        or rolcreaterole
        or rolcanlogin
        or rolreplication
        or rolbypassrls
        or rolinherit
      )
  ) then
    raise exception 'Nile Forms executor role attributes are unsafe';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_auth_members as membership
    where membership.member = (
      select role.oid
      from pg_catalog.pg_roles as role
      where role.rolname = 'nile_forms_executor'
    )
  ) then
    raise exception 'Nile Forms executor must not inherit or assume another database role';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_auth_members as membership
    join pg_catalog.pg_roles as member_role on member_role.oid = membership.member
    where membership.roleid = (
      select role.oid
      from pg_catalog.pg_roles as role
      where role.rolname = 'nile_forms_executor'
    )
      and member_role.rolname <> 'authenticator'
  ) then
    raise exception 'Only authenticator may assume the Nile Forms executor role';
  end if;

  if exists (
    select 1 from pg_catalog.pg_roles where rolname = 'authenticator'
  ) and not exists (
    select 1
    from pg_catalog.pg_auth_members as membership
    join pg_catalog.pg_roles as member_role on member_role.oid = membership.member
    where membership.roleid = (
      select role.oid
      from pg_catalog.pg_roles as role
      where role.rolname = 'nile_forms_executor'
    )
      and member_role.rolname = 'authenticator'
  ) then
    raise exception 'Authenticator cannot assume the Nile Forms executor role';
  end if;

  if not pg_catalog.has_function_privilege(
    'nile_forms_executor',
    'public.nile_forms_query(text,text,text,jsonb)',
    'EXECUTE'
  ) or not pg_catalog.has_function_privilege(
    'nile_forms_executor',
    'public.nile_forms_public_query(text,text)',
    'EXECUTE'
  ) or not pg_catalog.has_function_privilege(
    'nile_forms_executor',
    'public.nile_forms_command(text,text,text,jsonb,text,text)',
    'EXECUTE'
  ) or not pg_catalog.has_function_privilege(
    'nile_forms_executor',
    'public.nile_forms_public_command(text,uuid,uuid,jsonb,text,text,text,text,text,integer,text,integer,text,integer)',
    'EXECUTE'
  ) or not pg_catalog.has_function_privilege(
    'nile_forms_executor',
    'public.nile_forms_contract_status()',
    'EXECUTE'
  ) then
    raise exception 'Nile Forms executor RPC catalog is incomplete';
  end if;

  select count(*)
  into v_count
  from pg_catalog.pg_proc as procedure
  join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname in ('public', 'nile_private')
    and pg_catalog.has_function_privilege(
      'nile_forms_executor',
      procedure.oid,
      'EXECUTE'
    )
    and not exists (
      select 1
      from pg_catalog.pg_depend as dependency
      where dependency.classid = 'pg_catalog.pg_proc'::pg_catalog.regclass
        and dependency.objid = procedure.oid
        and dependency.refclassid = 'pg_catalog.pg_extension'::pg_catalog.regclass
        and dependency.deptype = 'e'
    )
    and procedure.oid <> all(array[
      pg_catalog.to_regprocedure('public.nile_forms_query(text,text,text,jsonb)')::oid,
      pg_catalog.to_regprocedure('public.nile_forms_public_query(text,text)')::oid,
      pg_catalog.to_regprocedure('public.nile_forms_command(text,text,text,jsonb,text,text)')::oid,
      pg_catalog.to_regprocedure('public.nile_forms_public_command(text,uuid,uuid,jsonb,text,text,text,text,text,integer,text,integer,text,integer)')::oid,
      pg_catalog.to_regprocedure('public.nile_forms_contract_status()')::oid
    ]);
  if v_count <> 0 then
    raise exception 'Nile Forms executor can execute functions outside its exact RPC catalog: %', v_count;
  end if;

  if exists (
    select 1 from pg_catalog.pg_roles where rolname = 'authenticator'
  ) and not pg_catalog.pg_has_role(
    'authenticator',
    'nile_forms_executor',
    'MEMBER'
  ) then
    raise exception 'PostgREST authenticator cannot assume the Nile Forms executor role';
  end if;

  if pg_catalog.has_function_privilege(
    'anon',
    'public.nile_forms_command(text,text,text,jsonb,text,text)',
    'EXECUTE'
  ) or pg_catalog.has_function_privilege(
    'authenticated',
    'public.nile_forms_command(text,text,text,jsonb,text,text)',
    'EXECUTE'
  ) or pg_catalog.has_function_privilege(
    'anon',
    'public.nile_forms_public_command(text,uuid,uuid,jsonb,text,text,text,text,text,integer,text,integer,text,integer)',
    'EXECUTE'
  ) or pg_catalog.has_function_privilege(
    'authenticated',
    'public.nile_forms_public_command(text,uuid,uuid,jsonb,text,text,text,text,text,integer,text,integer,text,integer)',
    'EXECUTE'
  ) then
    raise exception 'Browser database roles can execute Nile Forms RPCs';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = any(array[
        'nile_forms_query',
        'nile_forms_public_query',
        'nile_forms_command',
        'nile_forms_public_command',
        'nile_forms_contract_status'
      ])
      and (
        not procedure.prosecdef
        or not ('search_path=""' = any(coalesce(procedure.proconfig, '{}'::text[])))
      )
  ) then
    raise exception 'Nile Forms RPC security-definer search path is unsafe';
  end if;

  if not exists (
    select 1
    from public.nile_forms_repository_contract
    where singleton
      and catalog_version = 'phase13f1-v1'
      and schema_evidence_sha256 = 'aae2c27e6dc6ecaa48162ac03937e82e37d3cfd5c533e7a11e84d0d7725a8e63'
      and executor_role = 'nile_forms_executor'
      and public_hmac_key_version > 0
      and (
        public_hmac_previous_key_version is null
        or public_hmac_previous_key_version <> public_hmac_key_version
      )
  ) then
    raise exception 'Nile Forms repository contract evidence is missing';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'form_submissions_authority_exclusive_check'
      and not convalidated
  ) or not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'form_drafts_authority_exclusive_check'
      and not convalidated
  ) then
    raise exception 'Normalized authority constraints must preserve older rows';
  end if;

  select nile_private.project_nile_form_submission(
    submission,
    'projection',
    false
  )
  into v_projection
  from public.form_submissions as submission
  where submission.id = 'f6000000-0000-4000-8000-000000000001';
  if v_projection #> '{answer_json,full_name}' is null
    or v_projection #> '{answer_json,national_id}' is not null then
    raise exception 'Nile Forms non-sensitive projection redaction failed';
  end if;
  select nile_private.project_nile_form_submission(
    submission,
    'projection',
    true
  )
  into v_projection
  from public.form_submissions as submission
  where submission.id = 'f6000000-0000-4000-8000-000000000001';
  if v_projection #> '{answer_json,national_id}' is null then
    raise exception 'Grant-scoped sensitive projection failed';
  end if;
  select nile_private.project_nile_form_submission(
    submission,
    'index',
    true
  )
  into v_projection
  from public.form_submissions as submission
  where submission.id = 'f6000000-0000-4000-8000-000000000001';
  if v_projection #> '{answer_json,full_name}' is null
    or v_projection #> '{answer_json,national_id}' is not null then
    raise exception 'Nile Forms index projection leaked a sensitive value';
  end if;

  begin
    insert into public.form_submission_index_values (
      submission_id,
      field_id,
      value_type,
      text_value
    )
    values (
      'f6000000-0000-4000-8000-000000000001',
      'national_id',
      'text',
      'MUST-NOT-PERSIST'
    );
    raise exception 'Sensitive form index insertion unexpectedly succeeded';
  exception
    when sqlstate '42501' then null;
  end;

  if not exists (
    select 1 from public.form_versions
    where id = 'f2000000-0000-4000-8000-000000000001'
      and status = 'published'
      and encode(content_hash, 'hex') = repeat('1', 64)
  ) or not exists (
    select 1 from public.form_submissions
    where id = 'f6000000-0000-4000-8000-000000000001'
      and answer_json ->> 'national_id' = 'FAKE-0001'
  ) or not exists (
    select 1 from public.form_reviews
    where id = 'f8000000-0000-4000-8000-000000000001'
  ) or not exists (
    select 1 from public.form_sync_receipts
    where id = 'fa000000-0000-4000-8000-000000000001'
      and status = 'accepted'
  ) or not exists (
    select 1 from public.form_legacy_import_records
    where id = 'fd000000-0000-4000-8000-000000000001'
      and payload_hash = decode(repeat('6', 64), 'hex')
  ) then
    raise exception 'Accepted Phase 13A-E evidence changed during Phase 13F1';
  end if;

  if exists (
    select 1
    from public.outbox_events
    where payload::text ~ '(FAKE-000[1-3]|national_id)'
  ) or exists (
    select 1
    from public.audit_logs
    where metadata::text ~ '(FAKE-000[1-3]|national_id)'
      or before_state::text ~ '(FAKE-000[1-3]|national_id)'
      or after_state::text ~ '(FAKE-000[1-3]|national_id)'
  ) then
    raise exception 'Sensitive Nile Forms values leaked into audit or outbox evidence';
  end if;
end;
$$;

rollback;
