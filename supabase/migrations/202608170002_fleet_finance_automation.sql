alter table public.fleet_financial_entries add column if not exists source text not null default 'manual';
alter table public.fleet_financial_entries add column if not exists source_key text;
create unique index if not exists fleet_financial_entries_source_key_idx on public.fleet_financial_entries(organization_id,source_key) where source_key is not null;

create table if not exists public.fleet_finance_rules(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 vehicle_id uuid not null references public.vehicles(id) on delete cascade, name text not null, category text not null,
 amount numeric(12,2) not null check(amount>0), day_of_month integer not null check(day_of_month between 1 and 28),
 vendor text not null default '', description text not null default '', enabled boolean not null default true,
 last_posted_month date, created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.fleet_finance_inbox(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 vehicle_id uuid references public.vehicles(id) on delete set null, source text not null, source_key text,
 transaction_date date not null, amount numeric(12,2) not null, merchant text not null default '', suggested_category text,
 confidence numeric(5,2) check(confidence between 0 and 100), reason text not null default '', raw_data jsonb not null default '{}'::jsonb,
 status text not null default 'review' check(status in('review','approved','ignored')), resolved_by uuid references auth.users(id), resolved_at timestamptz, created_at timestamptz not null default now()
);
alter table public.fleet_finance_rules enable row level security;alter table public.fleet_finance_inbox enable row level security;
create policy "members read finance rules" on public.fleet_finance_rules for select using(public.is_organization_member(organization_id));
create policy "hosts manage finance rules" on public.fleet_finance_rules for all using(exists(select 1 from public.organization_members m where m.organization_id=fleet_finance_rules.organization_id and m.user_id=auth.uid() and m.role in('owner','admin','host'))) with check(public.is_organization_member(organization_id));
create policy "members read finance inbox" on public.fleet_finance_inbox for select using(public.is_organization_member(organization_id));
create policy "hosts manage finance inbox" on public.fleet_finance_inbox for all using(exists(select 1 from public.organization_members m where m.organization_id=fleet_finance_inbox.organization_id and m.user_id=auth.uid() and m.role in('owner','admin','host'))) with check(public.is_organization_member(organization_id));
