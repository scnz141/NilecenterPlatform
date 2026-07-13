-- Nile Learn Phase 13F1 local-only rollback.
-- Removes only Phase 13F1 objects/evidence and restores the accepted Phase
-- 13A-E schema. Never run against a linked, shared, preview, or remote project.

begin;

create temporary table phase13f1_command_ids on commit drop as
select result.command_id as id
from public.form_command_results as result;

create temporary table phase13f1_public_command_ids on commit drop as
select command.id
from public.form_public_commands as command;

create temporary table phase13f1_definition_ids on commit drop as
select distinct (result.result_json -> 'definition' ->> 'id')::uuid as id
from public.form_command_results as result
where result.operation = 'forms.definitions.create'
  and result.result_json -> 'definition' ->> 'id' is not null;

create temporary table phase13f1_import_run_ids on commit drop as
select distinct id
from (
  select (result.result_json ->> 'id')::uuid as id
  from public.form_command_results as result
  where result.operation = 'forms.migration.preview.record'
  union all
  select (record.result_json -> 'record' ->> 'run_id')::uuid as id
  from public.form_command_results as record
  where record.operation = 'forms.migration.import.record'
) as run
where id is not null;

alter table public.command_executions disable trigger command_executions_preserve_identity;
alter table public.command_executions disable trigger command_evidence_required;
alter table public.audit_logs disable trigger audit_logs_immutable;
alter table public.form_versions disable trigger form_versions_preserve_published;
alter table public.form_submissions disable trigger form_submissions_preserve_evidence;
alter table public.form_reviews disable trigger form_reviews_immutable;
alter table public.form_sync_receipts disable trigger form_sync_receipts_immutable;
alter table public.form_legacy_import_runs disable trigger form_legacy_import_runs_preserve_evidence;
alter table public.form_legacy_import_records disable trigger form_legacy_import_records_preserve_evidence;
alter table public.role_grant_permissions disable trigger role_grant_permissions_preserve_evidence;
alter table public.form_command_results disable trigger form_command_results_immutable;
alter table public.form_public_commands disable trigger form_public_commands_preserve_evidence;
alter table public.form_offline_bundles disable trigger form_offline_bundles_immutable;
alter table public.form_offline_bundle_items disable trigger form_offline_bundle_items_immutable;

alter table public.form_drafts
  drop constraint form_drafts_authority_exclusive_check;
alter table public.form_submissions
  drop constraint form_submissions_authority_exclusive_check;
alter table public.outbox_events
  drop constraint outbox_events_authority_exactly_one_check;

alter table public.form_drafts
  drop constraint form_drafts_public_command_id_fkey;
alter table public.form_submissions
  drop constraint form_submissions_public_command_id_fkey;
alter table public.form_public_commands
  drop constraint form_public_commands_draft_id_fkey,
  drop constraint form_public_commands_submission_id_fkey;

delete from public.outbox_events as event
where event.command_id in (select id from phase13f1_command_ids)
  or event.public_command_id in (select id from phase13f1_public_command_ids);

delete from public.audit_logs as audit
where audit.command_id in (select id from phase13f1_command_ids);

delete from public.form_public_commands as command
where command.id in (select id from phase13f1_public_command_ids);

delete from public.form_reviews as review
where review.command_id in (select id from phase13f1_command_ids);

delete from public.form_sync_receipts as receipt
where receipt.command_id in (select id from phase13f1_command_ids);

delete from public.form_submission_index_values as index_value
where index_value.submission_id in (
  select submission.id
  from public.form_submissions as submission
  where submission.command_id in (select id from phase13f1_command_ids)
    or submission.public_command_id in (select id from phase13f1_public_command_ids)
);

delete from public.form_attachments as attachment
where attachment.submission_id in (
  select submission.id
  from public.form_submissions as submission
  where submission.command_id in (select id from phase13f1_command_ids)
    or submission.public_command_id in (select id from phase13f1_public_command_ids)
);

delete from public.form_legacy_import_records as record
where record.run_id in (select id from phase13f1_import_run_ids)
  or record.submission_id in (
    select submission.id
    from public.form_submissions as submission
    where submission.command_id in (select id from phase13f1_command_ids)
  );

delete from public.form_submissions as submission
where submission.command_id in (select id from phase13f1_command_ids)
  or submission.public_command_id in (select id from phase13f1_public_command_ids);

delete from public.form_drafts as draft
where draft.command_id in (select id from phase13f1_command_ids)
  or draft.public_command_id in (select id from phase13f1_public_command_ids);

delete from public.form_offline_bundle_items as item
where item.bundle_id in (
  select bundle.id
  from public.form_offline_bundles as bundle
  where bundle.command_id in (select id from phase13f1_command_ids)
);

delete from public.form_offline_bundles as bundle
where bundle.command_id in (select id from phase13f1_command_ids);

delete from public.form_offline_devices as device
where device.command_id in (select id from phase13f1_command_ids);

delete from public.form_assignments as assignment
where assignment.command_id in (select id from phase13f1_command_ids)
  or assignment.publication_id in (
    select publication.id
    from public.form_publications as publication
    where publication.command_id in (select id from phase13f1_command_ids)
  );

delete from public.form_publications as publication
where publication.command_id in (select id from phase13f1_command_ids)
  or publication.definition_id in (select id from phase13f1_definition_ids);

delete from public.form_legacy_import_runs as run
where run.id in (select id from phase13f1_import_run_ids);

update public.form_definitions as definition
set
  current_draft_version_id = null,
  current_published_version_id = null
where definition.id in (select id from phase13f1_definition_ids);

delete from public.form_versions as version
where version.definition_id in (select id from phase13f1_definition_ids);

delete from public.form_definitions as definition
where definition.id in (select id from phase13f1_definition_ids);

delete from public.role_grant_permissions as permission
where permission.command_id in (select id from phase13f1_command_ids);

delete from public.form_command_results as result
where result.command_id in (select id from phase13f1_command_ids);

delete from public.command_executions as command
where command.id in (select id from phase13f1_command_ids);

alter table public.command_executions enable trigger command_executions_preserve_identity;
alter table public.command_executions enable trigger command_evidence_required;
alter table public.audit_logs enable trigger audit_logs_immutable;
alter table public.form_versions enable trigger form_versions_preserve_published;
alter table public.form_submissions enable trigger form_submissions_preserve_evidence;
alter table public.form_reviews enable trigger form_reviews_immutable;
alter table public.form_sync_receipts enable trigger form_sync_receipts_immutable;
alter table public.form_legacy_import_runs enable trigger form_legacy_import_runs_preserve_evidence;
alter table public.form_legacy_import_records enable trigger form_legacy_import_records_preserve_evidence;

drop trigger role_grants_form_sensitive_default on public.role_grants;
drop trigger role_grant_permissions_preserve_evidence on public.role_grant_permissions;
drop trigger form_command_results_immutable on public.form_command_results;
drop trigger form_public_commands_preserve_evidence on public.form_public_commands;
drop trigger form_offline_bundles_immutable on public.form_offline_bundles;
drop trigger form_offline_bundle_items_immutable on public.form_offline_bundle_items;
drop trigger nile_forms_repository_contract_immutable on public.nile_forms_repository_contract;
drop trigger form_submission_index_values_reject_sensitive on public.form_submission_index_values;

drop function public.nile_forms_public_command(
  text, uuid, uuid, jsonb, text, text, text, text, text, integer, text, integer, text, integer
);
drop function public.nile_forms_command(text, text, text, jsonb, text, text);
drop function public.nile_forms_public_query(text, text);
drop function public.nile_forms_query(text, text, text, jsonb);
drop function public.nile_forms_contract_status();

drop function nile_private.project_nile_form_submission(
  public.form_submissions, text, boolean
);
drop function nile_private.validate_nile_forms_rpc_input(text, text, jsonb);
drop function nile_private.nile_forms_assignment_matches(
  public.form_assignments, uuid, text, uuid[], uuid[]
);
drop function nile_private.nile_forms_submission_allowed(
  text, uuid[], uuid[], public.form_submissions
);
drop function nile_private.nile_forms_definition_allowed(
  text, uuid, uuid, uuid[], uuid[], public.form_definitions
);
drop function nile_private.preserve_role_grant_permission_evidence();
drop function nile_private.require_nile_forms_authority(text, text, text);
drop function nile_private.nile_forms_scope_allows(text, uuid[], uuid[], uuid, uuid);
drop function nile_private.reject_sensitive_form_index_value();
drop function nile_private.project_nile_form_answers(jsonb, jsonb, text, boolean);
drop function nile_private.nile_forms_schema_fields(jsonb);
drop function nile_private.ensure_superadmin_form_sensitive_grant();
drop function nile_private.preserve_form_command_evidence();

drop index public.form_submissions_public_command_uidx;
drop index public.form_drafts_public_command_uidx;

alter table public.form_drafts
  drop column public_command_id,
  drop column command_id;
alter table public.form_submissions
  drop column public_command_id;
alter table public.form_sync_receipts
  drop column command_id;
alter table public.form_offline_devices
  drop column command_id;
alter table public.outbox_events
  drop column public_command_id,
  alter column command_id set not null;

drop table public.form_offline_bundle_items;
drop table public.form_offline_bundles;
drop table public.form_public_rate_limits;
drop table public.form_public_commands;
drop table public.form_command_results;
drop table public.role_grant_permissions;
drop table public.form_operation_permissions;
drop table public.form_permission_mappings;
drop table public.nile_forms_repository_contract;

drop index public.form_publications_slug_uidx;
create unique index form_publications_slug_uidx
  on public.form_publications (lower(slug));

delete from public.permissions
where code = 'form_submissions.sensitive_read';

create or replace function nile_private.preserve_form_submission_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Form submissions are immutable evidence'
      using errcode = '55000';
  end if;

  if old.id is distinct from new.id
    or old.definition_id is distinct from new.definition_id
    or old.publication_id is distinct from new.publication_id
    or old.version_id is distinct from new.version_id
    or old.assignment_id is distinct from new.assignment_id
    or old.respondent_user_id is distinct from new.respondent_user_id
    or old.respondent_role is distinct from new.respondent_role
    or old.branch_id is distinct from new.branch_id
    or old.department_id is distinct from new.department_id
    or old.source is distinct from new.source
    or old.answer_json is distinct from new.answer_json
    or old.client_submission_id is distinct from new.client_submission_id
    or old.client_submitted_at is distinct from new.client_submitted_at
    or old.submitted_at is distinct from new.submitted_at
    or old.legacy_source_form_id is distinct from new.legacy_source_form_id
    or old.legacy_source_submission_id is distinct from new.legacy_source_submission_id
    or old.legacy_payload_hash is distinct from new.legacy_payload_hash
    or old.legacy_import_run_id is distinct from new.legacy_import_run_id then
    raise exception 'Form submission answers and provenance are immutable'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create or replace function nile_private.preserve_outbox_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.command_id is distinct from new.command_id
    or old.event_type is distinct from new.event_type
    or old.aggregate_type is distinct from new.aggregate_type
    or old.aggregate_id is distinct from new.aggregate_id
    or old.payload is distinct from new.payload
    or old.idempotency_key is distinct from new.idempotency_key
    or old.created_at is distinct from new.created_at then
    raise exception 'Outbox event identity and payload are immutable'
      using errcode = '55000';
  end if;

  if not (
    old.status = new.status
    or (old.status = 'pending' and new.status in ('processing', 'dead_letter'))
    or (old.status = 'processing' and new.status in ('succeeded', 'failed', 'dead_letter'))
    or (old.status = 'failed' and new.status in ('processing', 'dead_letter'))
  ) then
    raise exception 'Invalid outbox transition from % to %', old.status, new.status
      using errcode = '23514';
  end if;

  return new;
end;
$$;

do $$
declare
  v_role_name text;
begin
  for v_role_name in
    select member_role.rolname
    from pg_catalog.pg_auth_members as membership
    join pg_catalog.pg_roles as member_role on member_role.oid = membership.member
    where membership.roleid = (
      select executor.oid
      from pg_catalog.pg_roles as executor
      where executor.rolname = 'nile_forms_executor'
    )
  loop
    execute pg_catalog.format(
      'revoke nile_forms_executor from %I',
      v_role_name
    );
  end loop;

  for v_role_name in
    select inherited_role.rolname
    from pg_catalog.pg_auth_members as membership
    join pg_catalog.pg_roles as inherited_role on inherited_role.oid = membership.roleid
    where membership.member = (
      select executor.oid
      from pg_catalog.pg_roles as executor
      where executor.rolname = 'nile_forms_executor'
    )
  loop
    execute pg_catalog.format(
      'revoke %I from nile_forms_executor',
      v_role_name
    );
  end loop;
end;
$$;

revoke usage on schema public from nile_forms_executor;
drop role nile_forms_executor;

commit;
