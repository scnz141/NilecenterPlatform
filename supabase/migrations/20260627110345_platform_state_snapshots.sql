create table if not exists public.platform_state_snapshots (
  id text primary key,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists platform_state_snapshots_updated_at_idx
  on public.platform_state_snapshots (updated_at desc);

alter table public.platform_state_snapshots enable row level security;

grant select, insert, update, delete on table public.platform_state_snapshots to service_role;
revoke all on table public.platform_state_snapshots from anon, authenticated;

drop policy if exists "server service can manage platform state snapshots" on public.platform_state_snapshots;
create policy "server service can manage platform state snapshots"
  on public.platform_state_snapshots
  for all
  to service_role
  using (true)
  with check (true);

create table if not exists public.platform_events (
  id text primary key,
  actor_id text,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  summary text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists platform_events_action_created_at_idx
  on public.platform_events (action, created_at desc);

create index if not exists platform_events_entity_idx
  on public.platform_events (entity_type, entity_id);

alter table public.platform_events enable row level security;

grant select, insert, update, delete on table public.platform_events to service_role;
revoke all on table public.platform_events from anon, authenticated;

drop policy if exists "server service can manage platform events" on public.platform_events;
create policy "server service can manage platform events"
  on public.platform_events
  for all
  to service_role
  using (true)
  with check (true);
