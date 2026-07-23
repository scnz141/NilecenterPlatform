-- Roll back the manual normalized admissions intake foundation.

begin;

drop function if exists public.nile_create_admission_lead_with_evidence(
  text, text, text, text, text, text, text, text, text, text, text, text
);
drop function if exists public.nile_read_admissions_workspace(text);
drop table if exists public.admission_leads;

commit;
