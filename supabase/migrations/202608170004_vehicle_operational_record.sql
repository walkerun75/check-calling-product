-- Vehicle-specific compliance, service, ownership, document, and rental records.
create table if not exists public.vehicle_operational_profiles (
  vehicle_id uuid primary key references public.vehicles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  registration_state text not null default '', registration_expires_on date,
  insurance_provider text not null default '', insurance_policy text not null default '', insurance_expires_on date,
  inspection_expires_on date, next_service_on date, next_service_odometer integer,
  title_status text not null default '', warranty_expires_on date, roadside_provider text not null default '',
  updated_by uuid not null references auth.users(id), updated_at timestamptz not null default now()
);
create table if not exists public.vehicle_rental_activity (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade, source text not null default 'manual',
  reference_number text not null default '', starts_at timestamptz not null, ends_at timestamptz not null,
  revenue numeric(12,2) not null default 0, platform_fees numeric(12,2) not null default 0,
  start_odometer integer, end_odometer integer, status text not null default 'completed' check(status in('scheduled','active','completed','cancelled')),
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), check(ends_at>starts_at)
);
create table if not exists public.vehicle_documents (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade, document_type text not null,
  storage_path text not null, file_name text not null, expires_on date, created_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
alter table public.vehicle_operational_profiles enable row level security;
alter table public.vehicle_rental_activity enable row level security;
alter table public.vehicle_documents enable row level security;
create policy "members read vehicle operational profiles" on public.vehicle_operational_profiles for select using(public.is_organization_member(organization_id));
create policy "hosts manage vehicle operational profiles" on public.vehicle_operational_profiles for all using(public.is_organization_member(organization_id)) with check(public.is_organization_member(organization_id));
create policy "members read vehicle rental activity" on public.vehicle_rental_activity for select using(public.is_organization_member(organization_id));
create policy "hosts manage vehicle rental activity" on public.vehicle_rental_activity for all using(public.is_organization_member(organization_id)) with check(public.is_organization_member(organization_id));
create policy "members read vehicle documents" on public.vehicle_documents for select using(public.is_organization_member(organization_id));
create policy "hosts manage vehicle documents" on public.vehicle_documents for all using(public.is_organization_member(organization_id)) with check(public.is_organization_member(organization_id));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('vehicle-documents','vehicle-documents',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy "members upload vehicle documents" on storage.objects for insert to authenticated with check(bucket_id='vehicle-documents' and public.is_organization_member(((storage.foldername(name))[1])::uuid));
create policy "members read vehicle documents" on storage.objects for select to authenticated using(bucket_id='vehicle-documents' and public.is_organization_member(((storage.foldername(name))[1])::uuid));
