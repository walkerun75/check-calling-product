-- Central source of truth for financial activity directly tied to fleet vehicles.
create table public.fleet_financial_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  entry_date date not null,
  category text not null check (category in ('rental_income','maintenance','repair','vehicle_investment')),
  amount numeric(12,2) not null check (amount >= 0),
  description text not null default '' check (char_length(description) <= 500),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index fleet_financial_entries_org_date_idx
  on public.fleet_financial_entries (organization_id, entry_date desc);
create index fleet_financial_entries_vehicle_idx
  on public.fleet_financial_entries (vehicle_id, entry_date desc);

alter table public.fleet_financial_entries enable row level security;

create policy "members read fleet financial entries"
on public.fleet_financial_entries for select
using (public.is_organization_member(organization_id));

create policy "hosts create fleet financial entries"
on public.fleet_financial_entries for insert
with check (
  public.is_organization_member(organization_id)
  and created_by = auth.uid()
  and exists (
    select 1 from public.organization_members m
    where m.organization_id = fleet_financial_entries.organization_id
      and m.user_id = auth.uid()
      and m.role in ('owner','admin','host')
  )
  and (vehicle_id is null or exists (
    select 1 from public.vehicles v
    where v.id = vehicle_id and v.organization_id = fleet_financial_entries.organization_id
  ))
);

create policy "hosts update fleet financial entries"
on public.fleet_financial_entries for update
using (exists (
  select 1 from public.organization_members m
  where m.organization_id = fleet_financial_entries.organization_id
    and m.user_id = auth.uid()
    and m.role in ('owner','admin','host')
))
with check (public.is_organization_member(organization_id));

create policy "hosts delete fleet financial entries"
on public.fleet_financial_entries for delete
using (exists (
  select 1 from public.organization_members m
  where m.organization_id = fleet_financial_entries.organization_id
    and m.user_id = auth.uid()
    and m.role in ('owner','admin','host')
));
