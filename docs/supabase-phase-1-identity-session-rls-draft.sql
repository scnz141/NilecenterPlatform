-- Nile Learn Phase 1 Supabase/Postgres identity, scope, session, and audit draft.
--
-- Status: planning artifact only.
-- Do not apply this file to production or local Supabase as-is.
-- When implementation is approved, create a real migration with:
--   supabase migration new <descriptive_name>
-- then copy/review the relevant SQL into that generated migration.
--
-- Goals:
-- - Establish server-owned identity, role, branch, department, session, and audit tables.
-- - Keep authorization data outside user-editable Supabase metadata.
-- - Enable RLS and explicit grants for tables that may be exposed through Supabase APIs.
-- - Keep service credentials server-side and preserve the current demo/session behavior until adapter rollout.

begin;

create extension if not exists pgcrypto;
create extension if not exists citext;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'nile_role') then
    create type public.nile_role as enum (
      'student',
      'teacher',
      'registrar',
      'headofdepartment',
      'branchadmin',
      'superadmin'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'nile_entity_status') then
    create type public.nile_entity_status as enum (
      'draft',
      'active',
      'paused',
      'completed',
      'cancelled',
      'pending',
      'approved',
      'rejected',
      'issued',
      'overdue'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'nile_staff_permission_scope') then
    create type public.nile_staff_permission_scope as enum (
      'department',
      'branch',
      'admissions',
      'operations',
      'global'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'nile_staff_availability_status') then
    create type public.nile_staff_availability_status as enum (
      'available',
      'limited',
      'unavailable',
      'not_applicable'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'nile_auth_provider') then
    create type public.nile_auth_provider as enum (
      'supabase',
      'demo'
    );
  end if;
end $$;

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  name text not null,
  code text not null unique,
  timezone text not null default 'Africa/Cairo',
  address text not null default '',
  status public.nile_entity_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete set null,
  legacy_id text unique,
  name text not null,
  email citext not null unique,
  phone text,
  notes text,
  active_role public.nile_role not null,
  branch_id uuid references public.branches(id) on delete set null,
  department_id uuid,
  status public.nile_entity_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  name text not null,
  owner_user_id uuid not null references public.app_users(id) on delete restrict,
  status public.nile_entity_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'app_users_department_id_fkey'
      and conrelid = 'public.app_users'::regclass
  ) then
    alter table public.app_users
      add constraint app_users_department_id_fkey
      foreign key (department_id) references public.departments(id) on delete set null
      not valid;
  end if;
end $$;

create table if not exists public.department_branches (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (department_id, branch_id)
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  role public.nile_role not null,
  status public.nile_entity_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, role)
);

create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role public.nile_role not null,
  permission text not null,
  granted boolean not null default true,
  updated_by uuid references public.app_users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (role, permission)
);

create table if not exists public.staff_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  role public.nile_role not null,
  permission_scope public.nile_staff_permission_scope not null,
  title text not null default '',
  availability_status public.nile_staff_availability_status not null default 'not_applicable',
  operational_scope text[] not null default '{}',
  status public.nile_entity_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, role),
  check (role <> 'student')
);

create table if not exists public.staff_branch_scopes (
  id uuid primary key default gen_random_uuid(),
  staff_profile_id uuid not null references public.staff_profiles(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (staff_profile_id, branch_id)
);

create table if not exists public.staff_department_scopes (
  id uuid primary key default gen_random_uuid(),
  staff_profile_id uuid not null references public.staff_profiles(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (staff_profile_id, department_id)
);

create table if not exists public.staff_subjects (
  id uuid primary key default gen_random_uuid(),
  staff_profile_id uuid not null references public.staff_profiles(id) on delete cascade,
  subject text not null,
  teaching_level text,
  created_at timestamptz not null default now(),
  unique (staff_profile_id, subject, teaching_level)
);

create table if not exists public.app_sessions (
  id uuid primary key default gen_random_uuid(),
  session_hash text not null unique,
  user_id uuid not null references public.app_users(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete set null,
  provider public.nile_auth_provider not null,
  active_role public.nile_role not null,
  roles_snapshot public.nile_role[] not null default '{}',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references public.app_users(id) on delete set null,
  ip_hash text,
  user_agent_hash text,
  metadata jsonb not null default '{}'::jsonb,
  check (expires_at > created_at)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.app_users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  summary text not null,
  request_payload jsonb not null default '{}'::jsonb,
  result_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.platform_settings (
  id boolean primary key default true,
  organization text not null,
  default_language text not null,
  academic_term text not null,
  retention_days integer not null default 365 check (retention_days > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.app_users(id) on delete set null,
  check (id)
);

create index if not exists app_users_auth_user_id_idx on public.app_users(auth_user_id);
create index if not exists app_users_branch_id_idx on public.app_users(branch_id);
create index if not exists app_users_department_id_idx on public.app_users(department_id);
create index if not exists app_users_active_role_idx on public.app_users(active_role);
create index if not exists departments_owner_user_id_idx on public.departments(owner_user_id);
create index if not exists department_branches_department_id_idx on public.department_branches(department_id);
create index if not exists department_branches_branch_id_idx on public.department_branches(branch_id);
create index if not exists user_roles_user_id_idx on public.user_roles(user_id);
create index if not exists user_roles_role_idx on public.user_roles(role);
create index if not exists role_permissions_role_idx on public.role_permissions(role);
create index if not exists staff_profiles_user_id_idx on public.staff_profiles(user_id);
create index if not exists staff_profiles_role_idx on public.staff_profiles(role);
create index if not exists staff_branch_scopes_profile_id_idx on public.staff_branch_scopes(staff_profile_id);
create index if not exists staff_branch_scopes_branch_id_idx on public.staff_branch_scopes(branch_id);
create index if not exists staff_department_scopes_profile_id_idx on public.staff_department_scopes(staff_profile_id);
create index if not exists staff_department_scopes_department_id_idx on public.staff_department_scopes(department_id);
create index if not exists staff_subjects_profile_id_idx on public.staff_subjects(staff_profile_id);
create index if not exists app_sessions_user_id_idx on public.app_sessions(user_id);
create index if not exists app_sessions_auth_user_id_idx on public.app_sessions(auth_user_id);
create index if not exists app_sessions_expires_at_idx on public.app_sessions(expires_at);
create index if not exists app_sessions_revoked_at_idx on public.app_sessions(revoked_at);
create index if not exists audit_logs_actor_id_idx on public.audit_logs(actor_id);
create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at desc);
create index if not exists audit_logs_entity_idx on public.audit_logs(entity_type, entity_id);

alter table public.branches enable row level security;
alter table public.app_users enable row level security;
alter table public.departments enable row level security;
alter table public.department_branches enable row level security;
alter table public.user_roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.staff_branch_scopes enable row level security;
alter table public.staff_department_scopes enable row level security;
alter table public.staff_subjects enable row level security;
alter table public.app_sessions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.platform_settings enable row level security;

-- Explicit grants are required for Supabase API access. These grants do not bypass RLS.
grant select on public.branches to authenticated;
grant select on public.departments to authenticated;
grant select on public.department_branches to authenticated;
grant select on public.app_users to authenticated;
grant select on public.user_roles to authenticated;
grant select on public.role_permissions to authenticated;
grant select on public.staff_profiles to authenticated;
grant select on public.staff_branch_scopes to authenticated;
grant select on public.staff_department_scopes to authenticated;
grant select on public.staff_subjects to authenticated;
grant select, update on public.app_sessions to authenticated;
grant select on public.audit_logs to authenticated;
grant select on public.platform_settings to authenticated;

-- Intentionally no anon grants for operational identity/session/audit tables.

create or replace function public.current_app_user_id()
returns uuid
language sql
stable
security invoker
set search_path = public
as $$
  select id
  from public.app_users
  where auth_user_id = (select auth.uid())
    and status = 'active'
  limit 1
$$;

create or replace function public.current_app_user_has_role(required_role public.nile_role)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = public.current_app_user_id()
      and role = required_role
      and status = 'active'
  )
$$;

create or replace function public.current_app_user_is_superadmin()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select public.current_app_user_has_role('superadmin')
$$;

create or replace function public.current_app_user_branch_ids()
returns uuid[]
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(array_agg(distinct branch_id), '{}'::uuid[])
  from (
    select branch_id
    from public.app_users
    where id = public.current_app_user_id()
      and branch_id is not null
    union
    select sbs.branch_id
    from public.staff_branch_scopes sbs
    join public.staff_profiles sp on sp.id = sbs.staff_profile_id
    where sp.user_id = public.current_app_user_id()
      and sp.status = 'active'
  ) scoped_branches
$$;

create or replace function public.current_app_user_department_ids()
returns uuid[]
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(array_agg(distinct department_id), '{}'::uuid[])
  from (
    select department_id
    from public.app_users
    where id = public.current_app_user_id()
      and department_id is not null
    union
    select sds.department_id
    from public.staff_department_scopes sds
    join public.staff_profiles sp on sp.id = sds.staff_profile_id
    where sp.user_id = public.current_app_user_id()
      and sp.status = 'active'
  ) scoped_departments
$$;

create policy "Users can read their own active app user row."
on public.app_users
for select
to authenticated
using (
  id = public.current_app_user_id()
  or public.current_app_user_is_superadmin()
);

create policy "Users can read their own active roles."
on public.user_roles
for select
to authenticated
using (
  user_id = public.current_app_user_id()
  or public.current_app_user_is_superadmin()
);

create policy "Authenticated users can read active branches in scope."
on public.branches
for select
to authenticated
using (
  status = 'active'
  and (
    id = any(public.current_app_user_branch_ids())
    or public.current_app_user_is_superadmin()
  )
);

create policy "Authenticated users can read active departments in scope."
on public.departments
for select
to authenticated
using (
  status = 'active'
  and (
    id = any(public.current_app_user_department_ids())
    or owner_user_id = public.current_app_user_id()
    or public.current_app_user_is_superadmin()
  )
);

create policy "Authenticated users can read department branch joins in scope."
on public.department_branches
for select
to authenticated
using (
  department_id = any(public.current_app_user_department_ids())
  or branch_id = any(public.current_app_user_branch_ids())
  or public.current_app_user_is_superadmin()
);

create policy "Authenticated users can read role permissions for active roles."
on public.role_permissions
for select
to authenticated
using (
  granted = true
  and (
    public.current_app_user_has_role(role)
    or public.current_app_user_is_superadmin()
  )
);

create policy "Staff can read their own staff profiles."
on public.staff_profiles
for select
to authenticated
using (
  user_id = public.current_app_user_id()
  or public.current_app_user_is_superadmin()
);

create policy "Staff can read their own branch scopes."
on public.staff_branch_scopes
for select
to authenticated
using (
  exists (
    select 1
    from public.staff_profiles sp
    where sp.id = staff_branch_scopes.staff_profile_id
      and sp.user_id = public.current_app_user_id()
  )
  or public.current_app_user_is_superadmin()
);

create policy "Staff can read their own department scopes."
on public.staff_department_scopes
for select
to authenticated
using (
  exists (
    select 1
    from public.staff_profiles sp
    where sp.id = staff_department_scopes.staff_profile_id
      and sp.user_id = public.current_app_user_id()
  )
  or public.current_app_user_is_superadmin()
);

create policy "Staff can read their own subjects."
on public.staff_subjects
for select
to authenticated
using (
  exists (
    select 1
    from public.staff_profiles sp
    where sp.id = staff_subjects.staff_profile_id
      and sp.user_id = public.current_app_user_id()
  )
  or public.current_app_user_is_superadmin()
);

create policy "Users can read their own non-revoked sessions."
on public.app_sessions
for select
to authenticated
using (
  user_id = public.current_app_user_id()
  and revoked_at is null
);

create policy "Users can revoke their own active sessions."
on public.app_sessions
for update
to authenticated
using (
  user_id = public.current_app_user_id()
  and revoked_at is null
)
with check (
  user_id = public.current_app_user_id()
);

create policy "Super admins can read all session rows."
on public.app_sessions
for select
to authenticated
using (public.current_app_user_is_superadmin());

create policy "Super admins can read audit logs."
on public.audit_logs
for select
to authenticated
using (public.current_app_user_is_superadmin());

create policy "Users can read own audit rows."
on public.audit_logs
for select
to authenticated
using (actor_id = public.current_app_user_id());

create policy "Authenticated users can read platform settings."
on public.platform_settings
for select
to authenticated
using (true);

-- Server-side repositories should write sensitive rows with service credentials or direct Postgres
-- connections after application-level permission checks. This draft intentionally does not grant
-- browser INSERT/DELETE access to identity, role, session creation, or audit tables.

commit;
