-- Check Calling production foundation: multi-tenant hosts and verified fleet records.
create extension if not exists pgcrypto;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'host' check (role in ('owner','admin','host','viewer')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vin text not null check (vin ~ '^[A-HJ-NPR-Z0-9]{17}$'),
  year integer check (year between 1886 and 2100),
  make text,
  model text,
  trim text,
  license_plate text,
  odometer integer check (odometer is null or odometer >= 0),
  daily_rate numeric(10,2) check (daily_rate is null or daily_rate >= 0),
  status text not null default 'draft' check (status in ('draft','ready','rented','maintenance','inactive')),
  source text not null default 'vin_decode' check (source in ('vin_decode','manual','import')),
  decoded_payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, vin)
);

create index vehicles_organization_status_idx on public.vehicles (organization_id, status);

create or replace function public.is_organization_member(target_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = target_org and user_id = auth.uid()
  );
$$;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.vehicles enable row level security;

create policy "members read organizations" on public.organizations for select
using (public.is_organization_member(id));
create policy "users read own profile" on public.profiles for select using (id = auth.uid());
create policy "users update own profile" on public.profiles for update using (id = auth.uid());
create policy "members read memberships" on public.organization_members for select
using (public.is_organization_member(organization_id));
create policy "members read vehicles" on public.vehicles for select
using (public.is_organization_member(organization_id));
create policy "hosts create vehicles" on public.vehicles for insert
with check (public.is_organization_member(organization_id) and created_by = auth.uid());
create policy "hosts update vehicles" on public.vehicles for update
using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));
create policy "admins delete vehicles" on public.vehicles for delete
using (exists (
  select 1 from public.organization_members m
  where m.organization_id = vehicles.organization_id and m.user_id = auth.uid() and m.role in ('owner','admin')
));

