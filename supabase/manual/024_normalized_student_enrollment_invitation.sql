-- Nile Learn normalized student invitation and enrollment lifecycle.
-- Manual-only. Requires Phase 1, Phase 6A, email/account invitations, and the
-- normalized admissions packages through 023. Browser roles receive no direct
-- table or RPC access.

begin;

do $$
declare
  dependency text;
begin
  foreach dependency in array array[
    'app_users', 'branches', 'role_grants', 'role_grant_branch_scopes',
    'auth_sessions', 'command_executions', 'audit_logs', 'outbox_events',
    'user_invitations', 'identity_lifecycle_events', 'user_preferences',
    'student_profiles', 'course_templates', 'course_runs', 'class_groups',
    'teacher_assignments', 'staff_profiles', 'programs', 'enrollments',
    'class_memberships',
    'admission_leads', 'admission_applications',
    'admission_placement_bookings'
  ] loop
    if pg_catalog.to_regclass('public.' || dependency) is null then
      raise exception 'Student enrollment invitation requires public.%', dependency;
    end if;
  end loop;
end;
$$;

alter table public.student_profiles
  add column if not exists source text not null default 'direct'
    check (source in ('direct', 'lead', 'application', 'placement')),
  add column if not exists current_level text,
  add column if not exists course_interest text,
  add column if not exists notes text,
  add column if not exists lead_id uuid
    references public.admission_leads(id) on delete restrict,
  add column if not exists application_id uuid
    references public.admission_applications(id) on delete restrict,
  add column if not exists placement_booking_id uuid
    references public.admission_placement_bookings(id) on delete restrict;

create unique index if not exists student_profiles_lead_uidx
  on public.student_profiles (lead_id) where lead_id is not null;
create unique index if not exists student_profiles_application_uidx
  on public.student_profiles (application_id) where application_id is not null;
create unique index if not exists student_profiles_placement_uidx
  on public.student_profiles (placement_booking_id)
  where placement_booking_id is not null;

create or replace function public.nile_create_student_enrollment_invitation_with_evidence(
  p_session_token_hash text,
  p_invitation_id uuid,
  p_auth_user_id uuid,
  p_full_name text,
  p_email text,
  p_phone text,
  p_branch_ref text,
  p_preferred_language text,
  p_course_interest text,
  p_age_group text,
  p_guardian_name text,
  p_guardian_phone text,
  p_current_level text,
  p_notes text,
  p_course_run_id uuid,
  p_class_group_id uuid,
  p_source text,
  p_lead_id uuid,
  p_application_id uuid,
  p_placement_booking_id uuid,
  p_locale text,
  p_activation_envelope text,
  p_expires_at timestamptz,
  p_idempotency_key text,
  p_request_hash text
)
returns table (
  invitation_id uuid,
  user_id uuid,
  role_grant_id uuid,
  student_profile_id uuid,
  enrollment_id uuid,
  class_group_id uuid,
  outbox_event_id uuid,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_session public.auth_sessions%rowtype;
  actor_user public.app_users%rowtype;
  actor_grant public.role_grants%rowtype;
  command_row public.command_executions%rowtype;
  run_row public.course_runs%rowtype;
  group_row public.class_groups%rowtype;
  created_user_id uuid := gen_random_uuid();
  created_grant_id uuid := gen_random_uuid();
  created_profile_id uuid := gen_random_uuid();
  created_enrollment_id uuid := gen_random_uuid();
  created_membership_id uuid := gen_random_uuid();
  created_command_id uuid := gen_random_uuid();
  created_outbox_id uuid := gen_random_uuid();
  resolved_branch_id uuid;
  normalized_email text := pg_catalog.lower(pg_catalog.btrim(p_email));
  active_roster_count integer;
begin
  if p_session_token_hash !~ '^[a-f0-9]{64}$'
    or p_request_hash !~ '^[a-f0-9]{64}$'
    or length(p_idempotency_key) not between 12 and 256
    or length(pg_catalog.btrim(coalesce(p_full_name, ''))) not between 2 and 160
    or normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    or length(pg_catalog.btrim(coalesce(p_phone, ''))) not between 7 and 40
    or length(pg_catalog.btrim(coalesce(p_course_interest, ''))) not between 2 and 160
    or length(pg_catalog.btrim(coalesce(p_age_group, ''))) not between 2 and 80
    or length(pg_catalog.btrim(coalesce(p_current_level, ''))) not between 1 and 160
    or length(coalesce(p_notes, '')) > 3000
    or p_preferred_language not in (
      'English', 'Arabic', 'Chinese', 'Russian', 'Urdu', 'Turkish'
    )
    or p_locale not in ('en', 'ar', 'zh', 'ru', 'ur', 'tr')
    or p_source not in ('direct', 'lead', 'application', 'placement')
    or p_activation_envelope !~ '^v1\.[A-Za-z0-9_-]+$'
    or length(p_activation_envelope) not between 44 and 16000
    or p_expires_at not between now() + interval '15 minutes'
      and now() + interval '48 hours' then
    raise exception 'Student enrollment invitation request is invalid'
      using errcode = '22023';
  end if;
  if p_age_group ~* '(minor|child|teen)'
    and (
      length(pg_catalog.btrim(coalesce(p_guardian_name, ''))) < 2
      or length(pg_catalog.btrim(coalesce(p_guardian_phone, ''))) < 7
    ) then
    raise exception 'Guardian name and phone are required for a minor student'
      using errcode = '22023';
  end if;

  select session.* into strict actor_session
  from public.auth_sessions as session
  where session.token_hash = pg_catalog.decode(p_session_token_hash, 'hex')
    and session.provider = 'supabase'
    and session.revoked_at is null
    and session.expires_at > now()
  for update;
  select app_user.* into strict actor_user
  from public.app_users as app_user
  where app_user.id = actor_session.user_id and app_user.status = 'active';
  select role_grant.* into strict actor_grant
  from public.role_grants as role_grant
  where role_grant.id = actor_session.active_role_grant_id
    and role_grant.user_id = actor_user.id
    and role_grant.role in ('registrar', 'superadmin')
    and role_grant.status = 'active'
    and role_grant.starts_at <= now()
    and (role_grant.ends_at is null or role_grant.ends_at > now());

  select command.* into command_row
  from public.command_executions as command
  where command.idempotency_key = p_idempotency_key;
  if found then
    if command_row.request_hash is distinct from pg_catalog.decode(p_request_hash, 'hex')
      or command_row.command_type <> 'student.invitation.enrollment.create'
      or command_row.actor_user_id <> actor_user.id
      or command_row.status <> 'succeeded' then
      raise exception 'Student invitation idempotency conflict'
        using errcode = '23505';
    end if;
    return query
      select invitation.id, invitation.user_id, invitation.role_grant_id,
        profile.id, enrollment.id, membership.class_group_id,
        invitation.last_email_outbox_event_id, true
      from public.user_invitations as invitation
      join public.student_profiles as profile on profile.user_id = invitation.user_id
      join public.enrollments as enrollment on enrollment.student_profile_id = profile.id
      join public.class_memberships as membership on membership.enrollment_id = enrollment.id
      where invitation.id = command_row.target_id::uuid;
    return;
  end if;

  select branch.id into resolved_branch_id
  from public.branches as branch
  where (branch.id::text = pg_catalog.btrim(p_branch_ref)
      or branch.legacy_id = pg_catalog.btrim(p_branch_ref)
      or branch.code::text = pg_catalog.btrim(p_branch_ref))
    and branch.status = 'active';
  if resolved_branch_id is null then
    raise exception 'Student branch is unavailable' using errcode = '23503';
  end if;
  if actor_grant.role = 'registrar' and not exists (
    select 1 from public.role_grant_branch_scopes as scope
    where scope.role_grant_id = actor_grant.id
      and scope.branch_id = resolved_branch_id
      and scope.starts_at <= now()
      and (scope.ends_at is null or scope.ends_at > now())
  ) then
    raise exception 'Student branch is outside the current admissions scope'
      using errcode = '42501';
  end if;

  select run.* into strict run_row
  from public.course_runs as run
  join public.course_templates as course on course.id = run.course_template_id
  where run.id = p_course_run_id
    and run.branch_id = resolved_branch_id
    and run.status in ('planned', 'active')
    and course.status = 'active';
  select candidate.* into strict group_row
  from public.class_groups as candidate
  where candidate.id = p_class_group_id
    and candidate.course_run_id = run_row.id
    and candidate.status = 'active'
  for update;

  select count(*) into active_roster_count
  from public.class_memberships as membership
  where membership.class_group_id = group_row.id
    and membership.status in ('active', 'paused');
  if active_roster_count >= group_row.capacity then
    raise exception 'Selected class is at capacity' using errcode = '23514';
  end if;
  if not exists (
    select 1
    from public.teacher_assignments as assignment
    join public.staff_profiles as teacher on teacher.id = assignment.teacher_profile_id
    join public.app_users as teacher_user on teacher_user.id = teacher.user_id
    where assignment.class_group_id = group_row.id
      and assignment.assignment_type = 'primary'
      and assignment.status = 'active'
      and assignment.starts_at <= now()
      and (assignment.ends_at is null or assignment.ends_at > now())
      and teacher.status = 'active'
      and teacher_user.status = 'active'
  ) then
    raise exception 'Selected class requires an active primary teacher'
      using errcode = '23503';
  end if;

  if p_source = 'direct' and (
    p_lead_id is not null or p_application_id is not null
    or p_placement_booking_id is not null
  ) then
    raise exception 'Direct student creation cannot claim intake lineage'
      using errcode = '22023';
  elsif p_source = 'lead' and not exists (
    select 1 from public.admission_leads as lead
    where lead.id = p_lead_id and lead.branch_id = resolved_branch_id
      and lead.email = normalized_email and lead.status <> 'cancelled'
  ) then
    raise exception 'Lead lineage is invalid' using errcode = '23503';
  elsif p_source = 'application' and not exists (
    select 1
    from public.admission_applications as application
    join public.admission_leads as lead on lead.id = application.lead_id
    where application.id = p_application_id
      and application.branch_id = resolved_branch_id
      and lead.email = normalized_email
      and application.status <> 'cancelled'
  ) then
    raise exception 'Application lineage is invalid' using errcode = '23503';
  elsif p_source = 'placement' and not exists (
    select 1
    from public.admission_placement_bookings as booking
    join public.admission_leads as lead on lead.id = booking.lead_id
    where booking.id = p_placement_booking_id
      and booking.branch_id = resolved_branch_id
      and lead.email = normalized_email
      and booking.status = 'completed'
  ) then
    raise exception 'Placement lineage is invalid' using errcode = '23503';
  end if;

  if exists (select 1 from public.app_users where email = normalized_email)
    or exists (select 1 from public.app_users where auth_user_id = p_auth_user_id) then
    raise exception 'This email or Auth identity is already registered'
      using errcode = '23505';
  end if;

  insert into public.command_executions (
    id, idempotency_key, actor_user_id, actor_role_grant_id, session_id,
    command_type, target_type, target_id, request_hash, requires_outbox
  ) values (
    created_command_id, p_idempotency_key, actor_user.id, actor_grant.id,
    actor_session.id, 'student.invitation.enrollment.create',
    'UserInvitation', p_invitation_id::text,
    pg_catalog.decode(p_request_hash, 'hex'), true
  );
  insert into public.app_users (
    id, auth_user_id, full_name, email, phone, status
  ) values (
    created_user_id, p_auth_user_id, pg_catalog.btrim(p_full_name),
    normalized_email, pg_catalog.btrim(p_phone), 'invited'
  );
  insert into public.role_grants (
    id, user_id, role, status, granted_by, granted_reason
  ) values (
    created_grant_id, created_user_id, 'student', 'pending', actor_user.id,
    'Student invitation awaiting verified acceptance'
  );
  insert into public.role_grant_branch_scopes (
    role_grant_id, branch_id, granted_by
  ) values (created_grant_id, resolved_branch_id, actor_user.id);
  insert into public.student_profiles (
    id, user_id, home_branch_id, status, country, age_group,
    guardian_name, guardian_phone, source, current_level, course_interest,
    notes, lead_id, application_id, placement_booking_id
  ) values (
    created_profile_id, created_user_id, resolved_branch_id, 'active', '',
    pg_catalog.btrim(p_age_group), nullif(pg_catalog.btrim(p_guardian_name), ''),
    nullif(pg_catalog.btrim(p_guardian_phone), ''), p_source,
    pg_catalog.btrim(p_current_level), pg_catalog.btrim(p_course_interest),
    nullif(pg_catalog.btrim(p_notes), ''), p_lead_id, p_application_id,
    p_placement_booking_id
  );
  insert into public.user_preferences (user_id, preferred_language)
  values (created_user_id, p_preferred_language);
  insert into public.enrollments (
    id, student_profile_id, course_run_id, starts_at, status, source
  ) values (
    created_enrollment_id, created_profile_id, run_row.id, now(),
    'pending', 'nile_learn'
  );
  insert into public.class_memberships (
    id, enrollment_id, course_run_id, class_group_id, starts_at, status
  ) values (
    created_membership_id, created_enrollment_id, run_row.id, group_row.id,
    now(), 'active'
  );
  insert into public.user_invitations (
    id, user_id, role_grant_id, auth_user_id, expires_at, created_by
  ) values (
    p_invitation_id, created_user_id, created_grant_id, p_auth_user_id,
    p_expires_at, actor_user.id
  );

  if p_lead_id is not null then
    update public.admission_leads
    set status = 'ready_to_enroll', version = version + 1
    where id = p_lead_id and status <> 'cancelled';
  end if;
  if p_application_id is not null then
    update public.admission_applications
    set status = 'approved', version = version + 1
    where id = p_application_id and status <> 'cancelled';
  end if;

  insert into public.audit_logs (
    command_id, actor_user_id, actor_role_grant_id, session_id,
    action, entity_type, entity_id, branch_id, after_state, metadata
  ) values (
    created_command_id, actor_user.id, actor_grant.id, actor_session.id,
    'student.invited_and_enrolled', 'StudentProfile', created_profile_id::text,
    resolved_branch_id,
    pg_catalog.jsonb_build_object(
      'accountStatus', 'invited', 'enrollmentStatus', 'pending',
      'classGroupId', group_row.id
    ),
    pg_catalog.jsonb_build_object(
      'summary', 'Invited and reserved class placement for ' ||
        pg_catalog.btrim(p_full_name) || '.',
      'source', p_source, 'courseRunId', run_row.id
    )
  );
  insert into public.outbox_events (
    id, command_id, event_type, aggregate_type, aggregate_id, payload,
    idempotency_key
  ) values (
    created_outbox_id, created_command_id, 'email.delivery.requested',
    'UserInvitation', p_invitation_id::text,
    pg_catalog.jsonb_build_object(
      'schemaVersion', 1,
      'recipientUserId', created_user_id,
      'templateKey', 'account_invitation',
      'templateVersion', 1,
      'locale', p_locale,
      'variables', pg_catalog.jsonb_build_object(
        'displayName', pg_catalog.btrim(p_full_name),
        'roleLabel', 'student',
        'activationEnvelope', p_activation_envelope,
        'expiresInHours', pg_catalog.ceil(
          extract(epoch from (p_expires_at - now())) / 3600
        )::integer
      )
    ),
    'email.delivery:' || created_outbox_id::text
  );
  update public.user_invitations
  set last_email_outbox_event_id = created_outbox_id
  where id = p_invitation_id;
  update public.command_executions
  set status = 'succeeded', completed_at = now()
  where id = created_command_id;

  return query select p_invitation_id, created_user_id, created_grant_id,
    created_profile_id, created_enrollment_id, group_row.id,
    created_outbox_id, false;
exception
  when no_data_found then
    raise exception 'Student enrollment authority is unavailable'
      using errcode = '42501';
end;
$$;

create or replace function public.nile_accept_user_invitation_with_enrollment(
  p_invitation_id uuid,
  p_auth_user_id uuid
)
returns table (user_id uuid, role text, accepted_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation public.user_invitations%rowtype;
  grant_row public.role_grants%rowtype;
  accepted_time timestamptz := now();
begin
  select item.* into strict invitation
  from public.user_invitations as item
  where item.id = p_invitation_id
  for update;
  if invitation.auth_user_id is distinct from p_auth_user_id
    or invitation.status not in ('queued', 'sent', 'delivered')
    or invitation.expires_at <= accepted_time then
    raise exception 'Invitation is invalid, expired, or already used'
      using errcode = '42501';
  end if;
  select role_grant.* into strict grant_row
  from public.role_grants as role_grant
  where role_grant.id = invitation.role_grant_id
    and role_grant.user_id = invitation.user_id
    and role_grant.status = 'pending'
  for update;
  update public.app_users
  set status = 'active', activated_at = accepted_time
  where id = invitation.user_id
    and auth_user_id = p_auth_user_id
    and status = 'invited';
  if not found then
    raise exception 'Invited identity is not available for activation'
      using errcode = '42501';
  end if;
  update public.role_grants set status = 'active'
  where id = invitation.role_grant_id;
  if grant_row.role = 'student' then
    update public.enrollments as enrollment
    set status = 'active'
    from public.student_profiles as profile
    where profile.user_id = invitation.user_id
      and enrollment.student_profile_id = profile.id
      and enrollment.status = 'pending';
    update public.admission_leads as lead
    set status = 'active', version = version + 1
    from public.student_profiles as profile
    where profile.user_id = invitation.user_id
      and profile.lead_id = lead.id
      and lead.status <> 'cancelled';
  end if;
  update public.user_invitations
  set status = 'accepted', accepted_at = accepted_time
  where id = invitation.id;
  insert into public.identity_lifecycle_events (
    invitation_id, user_id, auth_user_id, event_type, source
  ) values (
    invitation.id, invitation.user_id, p_auth_user_id,
    'invitation.accepted', 'verified_auth_identity'
  );
  return query select invitation.user_id, grant_row.role, accepted_time;
exception
  when no_data_found then
    raise exception 'Invitation is unavailable' using errcode = '42501';
end;
$$;

create or replace function public.nile_read_admissions_student_workspace(
  p_session_token_hash text
)
returns table (workspace jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_session public.auth_sessions%rowtype;
  actor_grant public.role_grants%rowtype;
  base_workspace jsonb;
  users jsonb;
  teacher_users jsonb;
  students jsonb;
  enrollments jsonb;
begin
  select base.workspace into strict base_workspace
  from public.nile_read_admissions_operational_workspace(
    p_session_token_hash
  ) as base;
  select session.* into strict actor_session
  from public.auth_sessions as session
  where session.token_hash = pg_catalog.decode(p_session_token_hash, 'hex')
    and session.provider = 'supabase'
    and session.revoked_at is null
    and session.expires_at > now();
  select grant_row.* into strict actor_grant
  from public.role_grants as grant_row
  where grant_row.id = actor_session.active_role_grant_id
    and grant_row.user_id = actor_session.user_id
    and grant_row.role in ('registrar', 'superadmin')
    and grant_row.status = 'active';

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', app_user.id, 'fullName', app_user.full_name,
    'email', app_user.email::text, 'phone', app_user.phone,
    'branchId', profile.home_branch_id, 'status', app_user.status,
    'version', app_user.profile_version,
    'preferredLanguage', coalesce(preferences.preferred_language, 'English'),
    'timezone', branch.timezone
  ) order by app_user.full_name), '[]'::jsonb)
  into users
  from public.student_profiles as profile
  join public.app_users as app_user on app_user.id = profile.user_id
  join public.branches as branch on branch.id = profile.home_branch_id
  left join public.user_preferences as preferences
    on preferences.user_id = app_user.id
  where actor_grant.role = 'superadmin' or exists (
    select 1 from public.role_grant_branch_scopes as scope
    where scope.role_grant_id = actor_grant.id
      and scope.branch_id = profile.home_branch_id
      and scope.starts_at <= now()
      and (scope.ends_at is null or scope.ends_at > now())
  );

  select coalesce(pg_catalog.jsonb_agg(distinct pg_catalog.jsonb_build_object(
    'id', teacher_user.id, 'fullName', teacher_user.full_name,
    'email', teacher_user.email::text, 'phone', teacher_user.phone,
    'branchId', run.branch_id, 'departmentId', program.department_id,
    'status', teacher_user.status, 'version', teacher_user.profile_version
  )), '[]'::jsonb)
  into teacher_users
  from public.course_runs as run
  join public.course_templates as course on course.id = run.course_template_id
  join public.programs as program on program.id = course.program_id
  join public.class_groups as class_group on class_group.course_run_id = run.id
  join public.teacher_assignments as assignment
    on assignment.class_group_id = class_group.id
    and assignment.status = 'active'
    and assignment.starts_at <= now()
    and (assignment.ends_at is null or assignment.ends_at > now())
  join public.staff_profiles as teacher
    on teacher.id = assignment.teacher_profile_id
  join public.app_users as teacher_user on teacher_user.id = teacher.user_id
  where actor_grant.role = 'superadmin' or exists (
    select 1 from public.role_grant_branch_scopes as scope
    where scope.role_grant_id = actor_grant.id
      and scope.branch_id = run.branch_id
      and scope.starts_at <= now()
      and (scope.ends_at is null or scope.ends_at > now())
  );

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', profile.id, 'userId', profile.user_id,
    'status', case
      when app_user.status = 'invited' then 'ready_to_enroll'
      when exists (
        select 1 from public.enrollments as enrollment
        where enrollment.student_profile_id = profile.id
          and enrollment.status = 'active'
      ) then 'active'
      else profile.status end,
    'source', profile.source, 'guardianName', profile.guardian_name,
    'guardianPhone', profile.guardian_phone,
    'currentLevel', profile.current_level, 'ageGroup', profile.age_group,
    'courseInterest', profile.course_interest, 'notes', profile.notes,
    'country', profile.country, 'branchId', profile.home_branch_id,
    'preferredLanguage', coalesce(preferences.preferred_language, 'English'),
    'timezone', branch.timezone
  ) order by app_user.full_name), '[]'::jsonb)
  into students
  from public.student_profiles as profile
  join public.app_users as app_user on app_user.id = profile.user_id
  join public.branches as branch on branch.id = profile.home_branch_id
  left join public.user_preferences as preferences
    on preferences.user_id = app_user.id
  where actor_grant.role = 'superadmin' or exists (
    select 1 from public.role_grant_branch_scopes as scope
    where scope.role_grant_id = actor_grant.id
      and scope.branch_id = profile.home_branch_id
      and scope.starts_at <= now()
      and (scope.ends_at is null or scope.ends_at > now())
  );
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', enrollment.id, 'studentId', enrollment.student_profile_id,
    'courseRunId', enrollment.course_run_id,
    'levelId', course.level_id, 'classGroupId', membership.class_group_id,
    'teacherId', (
      select teacher.user_id
      from public.teacher_assignments as assignment
      join public.staff_profiles as teacher
        on teacher.id = assignment.teacher_profile_id
      where assignment.class_group_id = membership.class_group_id
        and assignment.status = 'active'
        and assignment.starts_at <= now()
        and (assignment.ends_at is null or assignment.ends_at > now())
      order by case assignment.assignment_type
        when 'primary' then 1 when 'substitute' then 2 else 3 end,
        assignment.starts_at desc
      limit 1
    ),
    'source', profile.source,
    'status', case when enrollment.status = 'pending'
      then 'enrolled' else enrollment.status end,
    'createdAt', enrollment.created_at
  ) order by enrollment.created_at desc), '[]'::jsonb)
  into enrollments
  from public.enrollments as enrollment
  join public.student_profiles as profile
    on profile.id = enrollment.student_profile_id
  join public.course_runs as run on run.id = enrollment.course_run_id
  join public.course_templates as course on course.id = run.course_template_id
  left join public.class_memberships as membership
    on membership.enrollment_id = enrollment.id
    and membership.status in ('active', 'paused')
  where actor_grant.role = 'superadmin' or exists (
    select 1 from public.role_grant_branch_scopes as scope
    where scope.role_grant_id = actor_grant.id
      and scope.branch_id = run.branch_id
      and scope.starts_at <= now()
      and (scope.ends_at is null or scope.ends_at > now())
  );
  return query select base_workspace || pg_catalog.jsonb_build_object(
    'studentUsers', users, 'teacherUsers', teacher_users,
    'students', students, 'enrollments', enrollments
  );
exception
  when no_data_found then
    raise exception 'Admissions student authority is unavailable'
      using errcode = '42501';
end;
$$;

create or replace function public.nile_read_student_learning_workspace(
  p_session_token_hash text
)
returns table (workspace jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_session public.auth_sessions%rowtype;
  actor_grant public.role_grants%rowtype;
  profile public.student_profiles%rowtype;
  payload jsonb;
begin
  select session.* into strict actor_session
  from public.auth_sessions as session
  where session.token_hash = pg_catalog.decode(p_session_token_hash, 'hex')
    and session.provider = 'supabase'
    and session.revoked_at is null
    and session.expires_at > now();
  select grant_row.* into strict actor_grant
  from public.role_grants as grant_row
  where grant_row.id = actor_session.active_role_grant_id
    and grant_row.user_id = actor_session.user_id
    and grant_row.role = 'student' and grant_row.status = 'active';
  select item.* into strict profile
  from public.student_profiles as item
  where item.user_id = actor_session.user_id and item.status = 'active';

  select pg_catalog.jsonb_build_object(
    'student', pg_catalog.jsonb_build_object(
      'id', profile.id, 'userId', profile.user_id, 'status', profile.status,
      'source', profile.source, 'guardianName', profile.guardian_name,
      'guardianPhone', profile.guardian_phone,
      'currentLevel', profile.current_level, 'ageGroup', profile.age_group,
      'courseInterest', profile.course_interest, 'notes', profile.notes,
      'country', profile.country
    ),
    'teachers', coalesce((select pg_catalog.jsonb_agg(distinct
      pg_catalog.jsonb_build_object(
        'id', teacher_user.id, 'fullName', teacher_user.full_name,
        'email', teacher_user.email::text
      ))
      from public.enrollments as enrollment
      join public.class_memberships as membership
        on membership.enrollment_id = enrollment.id
      join public.teacher_assignments as assignment
        on assignment.class_group_id = membership.class_group_id
      join public.staff_profiles as teacher
        on teacher.id = assignment.teacher_profile_id
      join public.app_users as teacher_user on teacher_user.id = teacher.user_id
      where enrollment.student_profile_id = profile.id
        and enrollment.status in ('active', 'paused', 'completed')
        and membership.status in ('active', 'paused')
        and assignment.status = 'active'
        and assignment.starts_at <= now()
        and (assignment.ends_at is null or assignment.ends_at > now())
    ), '[]'::jsonb),
    'programs', coalesce((select pg_catalog.jsonb_agg(distinct
      pg_catalog.jsonb_build_object(
        'id', program.id, 'title', program.title,
        'category', program.code::text, 'departmentId', program.department_id,
        'language', program.language, 'status', program.status
      ))
      from public.enrollments as enrollment
      join public.course_runs as run on run.id = enrollment.course_run_id
      join public.course_templates as course on course.id = run.course_template_id
      join public.programs as program on program.id = course.program_id
      where enrollment.student_profile_id = profile.id
        and enrollment.status in ('active', 'paused', 'completed')
    ), '[]'::jsonb),
    'levels', coalesce((select pg_catalog.jsonb_agg(distinct
      pg_catalog.jsonb_build_object(
        'id', level.id, 'programId', level.program_id,
        'title', level.title, 'order', level.sort_order
      ))
      from public.enrollments as enrollment
      join public.course_runs as run on run.id = enrollment.course_run_id
      join public.course_templates as course on course.id = run.course_template_id
      join public.course_levels as level on level.id = course.level_id
      where enrollment.student_profile_id = profile.id
        and enrollment.status in ('active', 'paused', 'completed')
    ), '[]'::jsonb),
    'courses', coalesce((select pg_catalog.jsonb_agg(distinct
      pg_catalog.jsonb_build_object(
        'id', course.id, 'programId', course.program_id,
        'levelId', course.level_id, 'slug', course.slug,
        'title', course.title, 'description', course.description,
        'status', course.status
      ))
      from public.enrollments as enrollment
      join public.course_runs as run on run.id = enrollment.course_run_id
      join public.course_templates as course on course.id = run.course_template_id
      where enrollment.student_profile_id = profile.id
        and enrollment.status in ('active', 'paused', 'completed')
    ), '[]'::jsonb),
    'courseRuns', coalesce((select pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', run.id, 'courseId', run.course_template_id,
        'branchId', run.branch_id,
        'teacherId', teacher_user.id, 'term', run.term,
        'startsOn', run.starts_on, 'endsOn', run.ends_on,
        'status', run.status
      ) order by run.starts_on desc)
      from public.enrollments as enrollment
      join public.course_runs as run on run.id = enrollment.course_run_id
      left join public.class_memberships as membership
        on membership.enrollment_id = enrollment.id
        and membership.status in ('active', 'paused')
      left join public.teacher_assignments as assignment
        on assignment.class_group_id = membership.class_group_id
        and assignment.status = 'active'
        and assignment.assignment_type = 'primary'
        and assignment.starts_at <= now()
        and (assignment.ends_at is null or assignment.ends_at > now())
      left join public.staff_profiles as teacher
        on teacher.id = assignment.teacher_profile_id
      left join public.app_users as teacher_user on teacher_user.id = teacher.user_id
      where enrollment.student_profile_id = profile.id
        and enrollment.status in ('active', 'paused', 'completed')
    ), '[]'::jsonb),
    'classGroups', coalesce((select pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', class_group.id, 'courseRunId', class_group.course_run_id,
        'name', class_group.name, 'capacity', class_group.capacity,
        'schedule', 'Schedule not configured',
        'studentIds', pg_catalog.jsonb_build_array(profile.id),
        'status', class_group.status
      ) order by class_group.name)
      from public.enrollments as enrollment
      join public.class_memberships as membership
        on membership.enrollment_id = enrollment.id
        and membership.status in ('active', 'paused')
      join public.class_groups as class_group
        on class_group.id = membership.class_group_id
      where enrollment.student_profile_id = profile.id
        and enrollment.status in ('active', 'paused', 'completed')
    ), '[]'::jsonb),
    'enrollments', coalesce((select pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', enrollment.id, 'studentId', profile.id,
        'courseRunId', enrollment.course_run_id,
        'levelId', course.level_id, 'classGroupId', membership.class_group_id,
        'teacherId', teacher_user.id, 'source', profile.source,
        'status', enrollment.status, 'createdAt', enrollment.created_at
      ) order by enrollment.created_at desc)
      from public.enrollments as enrollment
      join public.course_runs as run on run.id = enrollment.course_run_id
      join public.course_templates as course on course.id = run.course_template_id
      left join public.class_memberships as membership
        on membership.enrollment_id = enrollment.id
        and membership.status in ('active', 'paused')
      left join public.teacher_assignments as assignment
        on assignment.class_group_id = membership.class_group_id
        and assignment.status = 'active'
        and assignment.assignment_type = 'primary'
        and assignment.starts_at <= now()
        and (assignment.ends_at is null or assignment.ends_at > now())
      left join public.staff_profiles as teacher
        on teacher.id = assignment.teacher_profile_id
      left join public.app_users as teacher_user on teacher_user.id = teacher.user_id
      where enrollment.student_profile_id = profile.id
        and enrollment.status in ('active', 'paused', 'completed')
    ), '[]'::jsonb)
  ) into payload;
  return query select payload;
exception
  when no_data_found then
    raise exception 'Student learning authority is unavailable'
      using errcode = '42501';
end;
$$;

create or replace function public.nile_read_teacher_class_workspace(
  p_session_token_hash text
)
returns table (workspace jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_session public.auth_sessions%rowtype;
  actor_grant public.role_grants%rowtype;
  teacher public.staff_profiles%rowtype;
  payload jsonb;
begin
  select session.* into strict actor_session
  from public.auth_sessions as session
  where session.token_hash = pg_catalog.decode(p_session_token_hash, 'hex')
    and session.provider = 'supabase'
    and session.revoked_at is null
    and session.expires_at > now();
  select grant_row.* into strict actor_grant
  from public.role_grants as grant_row
  where grant_row.id = actor_session.active_role_grant_id
    and grant_row.user_id = actor_session.user_id
    and grant_row.role = 'teacher' and grant_row.status = 'active'
    and grant_row.starts_at <= now()
    and (grant_row.ends_at is null or grant_row.ends_at > now());
  select profile.* into strict teacher
  from public.staff_profiles as profile
  where profile.user_id = actor_session.user_id and profile.status = 'active';

  with assigned_groups as (
    select distinct class_group.id as class_group_id,
      class_group.course_run_id
    from public.teacher_assignments as assignment
    join public.class_groups as class_group
      on class_group.id = assignment.class_group_id
    where assignment.teacher_profile_id = teacher.id
      and assignment.status = 'active'
      and assignment.starts_at <= now()
      and (assignment.ends_at is null or assignment.ends_at > now())
      and class_group.status in ('active', 'paused')
  ), roster as (
    select membership.class_group_id, enrollment.id as enrollment_id,
      enrollment.course_run_id, enrollment.status as enrollment_status,
      enrollment.created_at as enrollment_created_at,
      student.id as student_profile_id, student.user_id,
      student.status as student_status, student.source,
      student.guardian_name, student.guardian_phone,
      student.current_level, student.age_group, student.course_interest,
      student.notes, student.country, student.home_branch_id,
      app_user.full_name, app_user.email, app_user.phone,
      app_user.status as user_status, app_user.profile_version,
      coalesce(preferences.preferred_language, 'English') as preferred_language,
      branch.timezone
    from assigned_groups
    join public.class_memberships as membership
      on membership.class_group_id = assigned_groups.class_group_id
      and membership.status in ('active', 'paused')
    join public.enrollments as enrollment
      on enrollment.id = membership.enrollment_id
      and enrollment.status in ('active', 'paused', 'completed')
    join public.student_profiles as student
      on student.id = enrollment.student_profile_id
      and student.status in ('active', 'paused')
    join public.app_users as app_user
      on app_user.id = student.user_id and app_user.status = 'active'
    join public.branches as branch on branch.id = student.home_branch_id
    left join public.user_preferences as preferences
      on preferences.user_id = app_user.id
  )
  select pg_catalog.jsonb_build_object(
    'studentUsers', coalesce((select pg_catalog.jsonb_agg(distinct
      pg_catalog.jsonb_build_object(
        'id', roster.user_id, 'fullName', roster.full_name,
        'email', roster.email::text, 'phone', roster.phone,
        'branchId', roster.home_branch_id, 'status', roster.user_status,
        'version', roster.profile_version,
        'preferredLanguage', roster.preferred_language,
        'timezone', roster.timezone
      )) from roster), '[]'::jsonb),
    'students', coalesce((select pg_catalog.jsonb_agg(distinct
      pg_catalog.jsonb_build_object(
        'id', roster.student_profile_id, 'userId', roster.user_id,
        'status', roster.student_status, 'source', roster.source,
        'guardianName', roster.guardian_name,
        'guardianPhone', roster.guardian_phone,
        'currentLevel', roster.current_level, 'ageGroup', roster.age_group,
        'courseInterest', roster.course_interest, 'notes', roster.notes,
        'country', roster.country, 'branchId', roster.home_branch_id,
        'preferredLanguage', roster.preferred_language,
        'timezone', roster.timezone
      )) from roster), '[]'::jsonb),
    'programs', coalesce((select pg_catalog.jsonb_agg(distinct
      pg_catalog.jsonb_build_object(
        'id', program.id, 'title', program.title,
        'category', program.code::text, 'departmentId', program.department_id,
        'language', program.language, 'status', program.status
      ))
      from assigned_groups
      join public.course_runs as run on run.id = assigned_groups.course_run_id
      join public.course_templates as course on course.id = run.course_template_id
      join public.programs as program on program.id = course.program_id
    ), '[]'::jsonb),
    'levels', coalesce((select pg_catalog.jsonb_agg(distinct
      pg_catalog.jsonb_build_object(
        'id', level.id, 'programId', level.program_id,
        'title', level.title, 'order', level.sort_order
      ))
      from assigned_groups
      join public.course_runs as run on run.id = assigned_groups.course_run_id
      join public.course_templates as course on course.id = run.course_template_id
      join public.course_levels as level on level.id = course.level_id
    ), '[]'::jsonb),
    'courses', coalesce((select pg_catalog.jsonb_agg(distinct
      pg_catalog.jsonb_build_object(
        'id', course.id, 'programId', course.program_id,
        'levelId', course.level_id, 'slug', course.slug,
        'title', course.title, 'description', course.description,
        'status', course.status
      ))
      from assigned_groups
      join public.course_runs as run on run.id = assigned_groups.course_run_id
      join public.course_templates as course on course.id = run.course_template_id
    ), '[]'::jsonb),
    'courseRuns', coalesce((select pg_catalog.jsonb_agg(distinct
      pg_catalog.jsonb_build_object(
        'id', run.id, 'courseId', run.course_template_id,
        'branchId', run.branch_id, 'teacherId', actor_session.user_id,
        'term', run.term, 'startsOn', run.starts_on, 'endsOn', run.ends_on,
        'status', run.status
      ))
      from assigned_groups
      join public.course_runs as run on run.id = assigned_groups.course_run_id
    ), '[]'::jsonb),
    'classGroups', coalesce((select pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', class_group.id, 'courseRunId', class_group.course_run_id,
        'name', class_group.name, 'capacity', class_group.capacity,
        'schedule', 'Schedule not configured',
        'studentIds', coalesce((select pg_catalog.jsonb_agg(
          scoped_roster.student_profile_id order by scoped_roster.full_name
        ) from roster as scoped_roster
          where scoped_roster.class_group_id = class_group.id), '[]'::jsonb),
        'status', class_group.status
      ) order by class_group.name)
      from assigned_groups
      join public.class_groups as class_group
        on class_group.id = assigned_groups.class_group_id
    ), '[]'::jsonb),
    'enrollments', coalesce((select pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', roster.enrollment_id, 'studentId', roster.student_profile_id,
        'courseRunId', roster.course_run_id,
        'levelId', course.level_id, 'classGroupId', roster.class_group_id,
        'teacherId', actor_session.user_id, 'source', roster.source,
        'status', roster.enrollment_status,
        'createdAt', roster.enrollment_created_at
      ) order by roster.enrollment_created_at desc)
      from roster
      join public.course_runs as run on run.id = roster.course_run_id
      join public.course_templates as course on course.id = run.course_template_id
    ), '[]'::jsonb)
  ) into payload;
  return query select payload;
exception
  when no_data_found then
    raise exception 'Teacher class authority is unavailable'
      using errcode = '42501';
end;
$$;

revoke all on function public.nile_create_student_enrollment_invitation_with_evidence(
  text, uuid, uuid, text, text, text, text, text, text, text, text, text,
  text, text, uuid, uuid, text, uuid, uuid, uuid, text, text, timestamptz,
  text, text
) from public, anon, authenticated;
revoke all on function public.nile_accept_user_invitation_with_enrollment(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.nile_read_admissions_student_workspace(text)
  from public, anon, authenticated;
revoke all on function public.nile_read_student_learning_workspace(text)
  from public, anon, authenticated;
revoke all on function public.nile_read_teacher_class_workspace(text)
  from public, anon, authenticated;
grant execute on function public.nile_create_student_enrollment_invitation_with_evidence(
  text, uuid, uuid, text, text, text, text, text, text, text, text, text,
  text, text, uuid, uuid, text, uuid, uuid, uuid, text, text, timestamptz,
  text, text
) to service_role;
grant execute on function public.nile_accept_user_invitation_with_enrollment(uuid, uuid)
  to service_role;
grant execute on function public.nile_read_admissions_student_workspace(text)
  to service_role;
grant execute on function public.nile_read_student_learning_workspace(text)
  to service_role;
grant execute on function public.nile_read_teacher_class_workspace(text)
  to service_role;

commit;
