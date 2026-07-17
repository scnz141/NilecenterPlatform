-- Nile Learn Phase 6I pgcrypto compatibility rollback.
--
-- Drop only wrappers created by the Phase 6I package. Never remove functions
-- owned by the pgcrypto extension itself.

begin;

do $phase6i$
begin
  if pg_catalog.obj_description(
    pg_catalog.to_regprocedure('public.digest(bytea,text)'),
    'pg_proc'
  ) = 'nile-phase6i-pgcrypto-compatibility' then
    drop function public.digest(bytea, text);
  end if;

  if pg_catalog.obj_description(
    pg_catalog.to_regprocedure('public.digest(text,text)'),
    'pg_proc'
  ) = 'nile-phase6i-pgcrypto-compatibility' then
    drop function public.digest(text, text);
  end if;
end;
$phase6i$;

commit;
