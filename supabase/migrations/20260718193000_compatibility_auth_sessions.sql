-- Durable cross-instance sessions for the internal-alpha compatibility runtime.
-- This table stores SHA-256 token hashes only. Browser roles receive no access.

create table if not exists public.compatibility_auth_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique
    check (token_hash ~ '^[0-9a-f]{64}$'),
  user_id text not null,
  email text not null,
  full_name text not null,
  roles jsonb not null
    check (jsonb_typeof(roles) = 'array' and jsonb_array_length(roles) > 0),
  active_role text not null
    check (active_role in (
      'student',
      'teacher',
      'registrar',
      'headofdepartment',
      'branchadmin',
      'superadmin'
    )),
  provider text not null
    check (provider in ('demo', 'supabase')),
  created_at timestamptz not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  check (expires_at > created_at),
  check (revoked_at is null or revoked_at >= created_at)
);

create index if not exists compatibility_auth_sessions_expiry_idx
  on public.compatibility_auth_sessions (expires_at)
  where revoked_at is null;

create index if not exists compatibility_auth_sessions_user_idx
  on public.compatibility_auth_sessions (user_id, created_at desc);

alter table public.compatibility_auth_sessions enable row level security;
alter table public.compatibility_auth_sessions force row level security;

revoke all on table public.compatibility_auth_sessions
from public, anon, authenticated;
grant select, insert, update on table public.compatibility_auth_sessions
to service_role;
