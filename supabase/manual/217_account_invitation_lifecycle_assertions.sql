-- Assertions for the normalized account invitation lifecycle.
do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public' and relation.relname = 'user_invitations'
      and relation.relrowsecurity and relation.relforcerowsecurity
  ) then
    raise exception 'user_invitations must use forced RLS';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'identity_lifecycle_events'
      and relation.relrowsecurity and relation.relforcerowsecurity
  ) then
    raise exception 'identity_lifecycle_events must use forced RLS';
  end if;

  if exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in ('user_invitations', 'identity_lifecycle_events')
      and grantee in ('anon', 'authenticated')
  ) then
    raise exception 'Browser roles must not receive account invitation table grants';
  end if;

  if pg_catalog.to_regprocedure(
    'public.nile_create_user_invitation_with_evidence(text,uuid,uuid,text,text,text,text,text,text,text,text,text[],text[],text,text,timestamp with time zone,text,text)'
  ) is null
    or pg_catalog.to_regprocedure(
      'public.nile_accept_user_invitation(uuid,uuid)'
    ) is null
    or pg_catalog.to_regprocedure(
      'public.nile_claim_email_delivery_v2(text,integer)'
    ) is null then
    raise exception 'Account invitation service RPCs are incomplete';
  end if;
end;
$$;
