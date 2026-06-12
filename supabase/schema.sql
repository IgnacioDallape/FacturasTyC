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

-- ---------------------------------------------------------------------------
-- FacturasTyC relational model
-- ---------------------------------------------------------------------------
-- This keeps the old app_state row intact. The inserts below copy today's JSON
-- state into proper tables without deleting or truncating any existing data.

create table if not exists public.facturas_clients (
  id text primary key,
  name text not null,
  is_misc boolean not null default false,
  trip_rates jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.facturas_invoices (
  id text primary key,
  client_id text not null references public.facturas_clients(id) on update cascade on delete restrict,
  invoice_number text not null default '',
  date date not null,
  amount numeric(14, 2) not null default 0,
  paid boolean not null default false,
  partial_paid boolean not null default false,
  partial_paid_amount numeric(14, 2) not null default 0,
  customer_name text not null default '',
  cargo_number text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.facturas_unbilled_trips (
  id text primary key,
  client_id text not null references public.facturas_clients(id) on update cascade on delete restrict,
  customer_name text not null default '',
  date date not null,
  route text not null default '',
  amount numeric(14, 2) not null default 0,
  note text not null default '',
  billed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.facturas_fiscal_credits (
  id text primary key,
  month text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  amount numeric(14, 2) not null default 0,
  percentage integer not null default 100 check (percentage in (40, 100)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists facturas_invoices_client_date_idx
on public.facturas_invoices(client_id, date desc);

create index if not exists facturas_invoices_paid_date_idx
on public.facturas_invoices(paid, date desc);

alter table public.facturas_invoices
add column if not exists partial_paid boolean not null default false;

alter table public.facturas_invoices
add column if not exists partial_paid_amount numeric(14, 2) not null default 0;

create index if not exists facturas_unbilled_trips_client_date_idx
on public.facturas_unbilled_trips(client_id, date desc);

create index if not exists facturas_unbilled_trips_billed_date_idx
on public.facturas_unbilled_trips(billed, date desc);

create index if not exists facturas_fiscal_credits_month_idx
on public.facturas_fiscal_credits(month);

create or replace function public.facturas_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists facturas_clients_updated_at on public.facturas_clients;
create trigger facturas_clients_updated_at
before update on public.facturas_clients
for each row execute function public.facturas_set_updated_at();

drop trigger if exists facturas_invoices_updated_at on public.facturas_invoices;
create trigger facturas_invoices_updated_at
before update on public.facturas_invoices
for each row execute function public.facturas_set_updated_at();

drop trigger if exists facturas_unbilled_trips_updated_at on public.facturas_unbilled_trips;
create trigger facturas_unbilled_trips_updated_at
before update on public.facturas_unbilled_trips
for each row execute function public.facturas_set_updated_at();

drop trigger if exists facturas_fiscal_credits_updated_at on public.facturas_fiscal_credits;
create trigger facturas_fiscal_credits_updated_at
before update on public.facturas_fiscal_credits
for each row execute function public.facturas_set_updated_at();

alter table public.facturas_clients enable row level security;
alter table public.facturas_invoices enable row level security;
alter table public.facturas_unbilled_trips enable row level security;
alter table public.facturas_fiscal_credits enable row level security;

drop policy if exists "Allow facturas clients read" on public.facturas_clients;
drop policy if exists "Allow facturas clients insert" on public.facturas_clients;
drop policy if exists "Allow facturas clients update" on public.facturas_clients;
drop policy if exists "Allow facturas clients delete" on public.facturas_clients;

create policy "Allow facturas clients read" on public.facturas_clients
for select to anon using (true);
create policy "Allow facturas clients insert" on public.facturas_clients
for insert to anon with check (true);
create policy "Allow facturas clients update" on public.facturas_clients
for update to anon using (true) with check (true);
create policy "Allow facturas clients delete" on public.facturas_clients
for delete to anon using (true);

drop policy if exists "Allow facturas invoices read" on public.facturas_invoices;
drop policy if exists "Allow facturas invoices insert" on public.facturas_invoices;
drop policy if exists "Allow facturas invoices update" on public.facturas_invoices;
drop policy if exists "Allow facturas invoices delete" on public.facturas_invoices;

create policy "Allow facturas invoices read" on public.facturas_invoices
for select to anon using (true);
create policy "Allow facturas invoices insert" on public.facturas_invoices
for insert to anon with check (true);
create policy "Allow facturas invoices update" on public.facturas_invoices
for update to anon using (true) with check (true);
create policy "Allow facturas invoices delete" on public.facturas_invoices
for delete to anon using (true);

drop policy if exists "Allow facturas trips read" on public.facturas_unbilled_trips;
drop policy if exists "Allow facturas trips insert" on public.facturas_unbilled_trips;
drop policy if exists "Allow facturas trips update" on public.facturas_unbilled_trips;
drop policy if exists "Allow facturas trips delete" on public.facturas_unbilled_trips;

create policy "Allow facturas trips read" on public.facturas_unbilled_trips
for select to anon using (true);
create policy "Allow facturas trips insert" on public.facturas_unbilled_trips
for insert to anon with check (true);
create policy "Allow facturas trips update" on public.facturas_unbilled_trips
for update to anon using (true) with check (true);
create policy "Allow facturas trips delete" on public.facturas_unbilled_trips
for delete to anon using (true);

drop policy if exists "Allow facturas credits read" on public.facturas_fiscal_credits;
drop policy if exists "Allow facturas credits insert" on public.facturas_fiscal_credits;
drop policy if exists "Allow facturas credits update" on public.facturas_fiscal_credits;
drop policy if exists "Allow facturas credits delete" on public.facturas_fiscal_credits;

create policy "Allow facturas credits read" on public.facturas_fiscal_credits
for select to anon using (true);
create policy "Allow facturas credits insert" on public.facturas_fiscal_credits
for insert to anon with check (true);
create policy "Allow facturas credits update" on public.facturas_fiscal_credits
for update to anon using (true) with check (true);
create policy "Allow facturas credits delete" on public.facturas_fiscal_credits
for delete to anon using (true);

-- Safe one-way copy from the legacy JSON row into relational tables.
-- Run this whole file in Supabase SQL Editor. Re-running it updates matching IDs
-- and inserts only new IDs; it does not delete anything.

with source as (
  select data
  from public.app_state
  where id = 'facturastyc'
),
client_items as (
  select item
  from source, jsonb_array_elements(coalesce(data->'clients', '[]'::jsonb)) as item
)
insert into public.facturas_clients (id, name, is_misc, trip_rates)
select
  item->>'id',
  coalesce(nullif(item->>'name', ''), 'Sin nombre'),
  case
    when item ? 'isMisc' then coalesce((item->>'isMisc')::boolean, false)
    when lower(coalesce(item->>'name', '')) = 'varios' then true
    else false
  end,
  coalesce(item->'tripRates', '{}'::jsonb)
from client_items
where coalesce(item->>'id', '') <> ''
on conflict (id) do update set
  name = excluded.name,
  is_misc = excluded.is_misc,
  trip_rates = excluded.trip_rates;

with source as (
  select data
  from public.app_state
  where id = 'facturastyc'
),
invoice_items as (
  select item
  from source, jsonb_array_elements(coalesce(data->'invoices', '[]'::jsonb)) as item
),
missing_invoice_clients as (
  select distinct item->>'clientId' as id
  from invoice_items
  where coalesce(item->>'clientId', '') <> ''
    and not exists (
      select 1
      from public.facturas_clients client
      where client.id = item->>'clientId'
    )
)
insert into public.facturas_clients (id, name, is_misc, trip_rates)
select id, id, lower(id) = 'varios', '{}'::jsonb
from missing_invoice_clients
on conflict (id) do nothing;

with source as (
  select data
  from public.app_state
  where id = 'facturastyc'
),
trip_items as (
  select item
  from source, jsonb_array_elements(coalesce(data->'unbilledTrips', '[]'::jsonb)) as item
),
missing_trip_clients as (
  select distinct item->>'clientId' as id
  from trip_items
  where coalesce(item->>'clientId', '') <> ''
    and not exists (
      select 1
      from public.facturas_clients client
      where client.id = item->>'clientId'
    )
)
insert into public.facturas_clients (id, name, is_misc, trip_rates)
select id, id, lower(id) = 'varios', '{}'::jsonb
from missing_trip_clients
on conflict (id) do nothing;

with source as (
  select data
  from public.app_state
  where id = 'facturastyc'
),
invoice_items as (
  select item
  from source, jsonb_array_elements(coalesce(data->'invoices', '[]'::jsonb)) as item
)
insert into public.facturas_invoices (
  id,
  client_id,
  invoice_number,
  date,
  amount,
  paid,
  partial_paid,
  partial_paid_amount,
  customer_name,
  cargo_number
)
select
  item->>'id',
  item->>'clientId',
  coalesce(item->>'invoiceNumber', ''),
  case
    when coalesce(item->>'date', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      then (item->>'date')::date
    else current_date
  end,
  case
    when coalesce(item->>'amount', '') ~ '^-?[0-9]+(\.[0-9]+)?$'
      then (item->>'amount')::numeric
    else 0
  end,
  case when item ? 'paid' then coalesce((item->>'paid')::boolean, false) else false end,
  case when item ? 'partialPaid' then coalesce((item->>'partialPaid')::boolean, false) else false end,
  case
    when coalesce(item->>'partialPaidAmount', '') ~ '^-?[0-9]+(\.[0-9]+)?$'
      then (item->>'partialPaidAmount')::numeric
    else 0
  end,
  coalesce(item->>'customerName', ''),
  coalesce(item->>'cargoNumber', '')
from invoice_items
where coalesce(item->>'id', '') <> ''
  and coalesce(item->>'clientId', '') <> ''
on conflict (id) do update set
  client_id = excluded.client_id,
  invoice_number = excluded.invoice_number,
  date = excluded.date,
  amount = excluded.amount,
  paid = excluded.paid,
  partial_paid = excluded.partial_paid,
  partial_paid_amount = excluded.partial_paid_amount,
  customer_name = excluded.customer_name,
  cargo_number = excluded.cargo_number;

with source as (
  select data
  from public.app_state
  where id = 'facturastyc'
),
trip_items as (
  select item
  from source, jsonb_array_elements(coalesce(data->'unbilledTrips', '[]'::jsonb)) as item
)
insert into public.facturas_unbilled_trips (
  id,
  client_id,
  customer_name,
  date,
  route,
  amount,
  note,
  billed
)
select
  item->>'id',
  item->>'clientId',
  coalesce(item->>'customerName', ''),
  case
    when coalesce(item->>'date', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      then (item->>'date')::date
    else current_date
  end,
  coalesce(item->>'route', ''),
  case
    when coalesce(item->>'amount', '') ~ '^-?[0-9]+(\.[0-9]+)?$'
      then (item->>'amount')::numeric
    else 0
  end,
  coalesce(item->>'note', ''),
  case when item ? 'billed' then coalesce((item->>'billed')::boolean, false) else false end
from trip_items
where coalesce(item->>'id', '') <> ''
  and coalesce(item->>'clientId', '') <> ''
on conflict (id) do update set
  client_id = excluded.client_id,
  customer_name = excluded.customer_name,
  date = excluded.date,
  route = excluded.route,
  amount = excluded.amount,
  note = excluded.note,
  billed = excluded.billed;

with source as (
  select data
  from public.app_state
  where id = 'facturastyc'
),
credit_items as (
  select item
  from source, jsonb_array_elements(coalesce(data->'fiscalCredits', '[]'::jsonb)) as item
)
insert into public.facturas_fiscal_credits (id, month, amount, percentage)
select
  item->>'id',
  case
    when coalesce(item->>'month', '') ~ '^[0-9]{4}-[0-9]{2}$'
      then item->>'month'
    when coalesce(item->>'date', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      then left(item->>'date', 7)
    else to_char(current_date, 'YYYY-MM')
  end,
  case
    when coalesce(item->>'amount', '') ~ '^-?[0-9]+(\.[0-9]+)?$'
      then (item->>'amount')::numeric
    else 0
  end,
  case
    when coalesce(item->>'percentage', '') = '40' then 40
    else 100
  end
from credit_items
where coalesce(item->>'id', '') <> ''
on conflict (id) do update set
  month = excluded.month,
  amount = excluded.amount,
  percentage = excluded.percentage;

select 'clients' as table_name, count(*) as rows from public.facturas_clients
union all select 'invoices', count(*) from public.facturas_invoices
union all select 'unbilled_trips', count(*) from public.facturas_unbilled_trips
union all select 'fiscal_credits', count(*) from public.facturas_fiscal_credits;
