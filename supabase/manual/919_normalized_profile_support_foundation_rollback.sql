-- Roll back the manual normalized self-profile and support foundation.

begin;

drop function if exists public.nile_create_support_ticket_with_evidence(
  text, text, text, text, text, text, text, text
);
drop function if exists public.nile_update_self_profile_with_evidence(
  text, text, text, text, text, jsonb, text, text, text, text, text,
  integer, text, text
);
drop function if exists public.nile_read_self_workspace(text);

drop table if exists public.support_tickets;
drop table if exists public.user_preferences;

alter table if exists public.student_profiles
  drop column if exists guardian_phone,
  drop column if exists guardian_name,
  drop column if exists age_group,
  drop column if exists country;

alter table if exists public.app_users
  drop column if exists profile_version;

drop function if exists nile_private.notification_preferences_are_safe(jsonb);

commit;
