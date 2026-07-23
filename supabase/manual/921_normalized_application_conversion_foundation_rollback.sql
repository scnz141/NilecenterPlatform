begin;

drop function if exists public.nile_convert_admission_lead_with_evidence(
  text, uuid, text, integer, text, text
);
drop function if exists public.nile_create_admission_application_with_evidence(
  text, text, text, text, text, text, text, text, text, text, text, text, text
);
drop function if exists public.nile_read_admissions_lifecycle_workspace(text);
drop table if exists public.admission_applications;

commit;
