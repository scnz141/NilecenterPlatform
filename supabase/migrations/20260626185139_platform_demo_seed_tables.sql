create table if not exists public.platform_records (
  id text primary key,
  type text not null check (type in ('lead', 'placement', 'operational')),
  payload jsonb not null default '{}'::jsonb,
  actor_id text,
  created_at timestamptz not null default now()
);

create index if not exists platform_records_type_created_at_idx
  on public.platform_records (type, created_at desc);

alter table public.platform_records enable row level security;

grant select, insert, update, delete on table public.platform_records to service_role;
revoke all on table public.platform_records from anon, authenticated;

drop policy if exists "server service can manage platform records" on public.platform_records;
create policy "server service can manage platform records"
  on public.platform_records
  for all
  to service_role
  using (true)
  with check (true);

create table if not exists public.platform_demo_entities (
  entity_type text not null,
  entity_id text not null,
  payload jsonb not null default '{}'::jsonb,
  seeded_at timestamptz not null default now(),
  primary key (entity_type, entity_id)
);

create index if not exists platform_demo_entities_type_idx
  on public.platform_demo_entities (entity_type);

alter table public.platform_demo_entities enable row level security;

grant select, insert, update, delete on table public.platform_demo_entities to service_role;
revoke all on table public.platform_demo_entities from anon, authenticated;

drop policy if exists "server service can manage demo entities" on public.platform_demo_entities;
create policy "server service can manage demo entities"
  on public.platform_demo_entities
  for all
  to service_role
  using (true)
  with check (true);
