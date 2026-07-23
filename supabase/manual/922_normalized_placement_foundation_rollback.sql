begin;

drop function if exists public.nile_record_placement_result_with_evidence(
  text, uuid, text, numeric, text, integer, text, text
);
drop function if exists public.nile_create_placement_booking_with_evidence(
  text, uuid, text, text, text, text, text, text, text, text, text, text
);
drop function if exists public.nile_read_admissions_placement_workspace(text);
drop table if exists public.admission_placement_results;
drop table if exists public.admission_placement_bookings;

commit;
