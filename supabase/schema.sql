create table if not exists public.app_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

drop policy if exists "Allow app state read" on public.app_state;
drop policy if exists "Allow app state insert" on public.app_state;
drop policy if exists "Allow app state update" on public.app_state;
drop policy if exists "Allow app state delete" on public.app_state;

create policy "Allow app state read"
on public.app_state
for select
to anon
using (true);

create policy "Allow app state insert"
on public.app_state
for insert
to anon
with check (true);

create policy "Allow app state update"
on public.app_state
for update
to anon
using (true)
with check (true);

create policy "Allow app state delete"
on public.app_state
for delete
to anon
using (true);
