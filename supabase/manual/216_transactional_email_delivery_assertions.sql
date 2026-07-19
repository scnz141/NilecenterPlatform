-- Assertions for the manual transactional email delivery package.
do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public' and relation.relname = 'email_deliveries'
      and relation.relrowsecurity and relation.relforcerowsecurity
  ) then
    raise exception 'email_deliveries must use forced RLS';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public' and relation.relname = 'email_suppressions'
      and relation.relrowsecurity and relation.relforcerowsecurity
  ) then
    raise exception 'email_suppressions must use forced RLS';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public' and relation.relname = 'email_webhook_events'
      and relation.relrowsecurity and relation.relforcerowsecurity
  ) then
    raise exception 'email_webhook_events must use forced RLS';
  end if;

  if exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in ('email_deliveries', 'email_suppressions', 'email_webhook_events')
      and grantee in ('anon', 'authenticated')
  ) then
    raise exception 'Browser roles must not receive transactional email table grants';
  end if;

  if pg_catalog.to_regprocedure('public.nile_claim_email_delivery(text,integer)') is null
    or pg_catalog.to_regprocedure(
      'public.nile_complete_email_delivery(uuid,text,text,text,text,text,integer)'
    ) is null
    or pg_catalog.to_regprocedure(
      'public.nile_record_email_webhook(text,text,text,timestamp with time zone,text)'
    ) is null then
    raise exception 'Transactional email service RPCs are incomplete';
  end if;
end;
$$;
