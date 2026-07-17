-- Nile Learn Phase 6I pgcrypto schema compatibility package.
--
-- Supabase installs pgcrypto in the extensions schema while portable PostgreSQL
-- environments may install it in public. The accepted Phase 6 SQL calls the
-- public digest overloads explicitly. Create narrow service-only forwarding
-- wrappers only when those public overloads are absent.

begin;

do $phase6i$
begin
  if pg_catalog.to_regprocedure('public.digest(bytea,text)') is null then
    if pg_catalog.to_regprocedure('extensions.digest(bytea,text)') is null then
      raise exception 'Phase 6I requires pgcrypto digest(bytea,text)';
    end if;

    execute $sql$
      create function public.digest(data bytea, algorithm text)
      returns bytea
      language sql
      immutable
      strict
      parallel safe
      security invoker
      set search_path = ''
      as 'select extensions.digest(data, algorithm)'
    $sql$;
    comment on function public.digest(bytea, text)
      is 'nile-phase6i-pgcrypto-compatibility';
  end if;

  if pg_catalog.to_regprocedure('public.digest(text,text)') is null then
    if pg_catalog.to_regprocedure('extensions.digest(text,text)') is null then
      raise exception 'Phase 6I requires pgcrypto digest(text,text)';
    end if;

    execute $sql$
      create function public.digest(data text, algorithm text)
      returns bytea
      language sql
      immutable
      strict
      parallel safe
      security invoker
      set search_path = ''
      as 'select extensions.digest(data, algorithm)'
    $sql$;
    comment on function public.digest(text, text)
      is 'nile-phase6i-pgcrypto-compatibility';
  end if;
end;
$phase6i$;

revoke all on function public.digest(bytea, text)
from public, anon, authenticated;
revoke all on function public.digest(text, text)
from public, anon, authenticated;

grant execute on function public.digest(bytea, text) to service_role;
grant execute on function public.digest(text, text) to service_role;

commit;
