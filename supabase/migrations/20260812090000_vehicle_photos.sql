create table if not exists public.vehicle_photos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  storage_path text not null,
  public_url text not null,
  alt_text text,
  is_primary boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists vehicle_photos_vehicle_idx on public.vehicle_photos(vehicle_id,sort_order);
alter table public.vehicle_photos enable row level security;
drop policy if exists "members read vehicle photos" on public.vehicle_photos;
create policy "members read vehicle photos" on public.vehicle_photos for select using (exists(select 1 from public.organization_members m where m.organization_id=vehicle_photos.organization_id and m.user_id=auth.uid()));
drop policy if exists "members manage vehicle photos" on public.vehicle_photos;
create policy "members manage vehicle photos" on public.vehicle_photos for all using (exists(select 1 from public.organization_members m where m.organization_id=vehicle_photos.organization_id and m.user_id=auth.uid() and m.role in ('owner','admin'))) with check (exists(select 1 from public.organization_members m where m.organization_id=vehicle_photos.organization_id and m.user_id=auth.uid() and m.role in ('owner','admin')));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('vehicle-photos','vehicle-photos',true,10485760,array['image/jpeg','image/png','image/webp']) on conflict(id) do update set public=true,file_size_limit=10485760,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
drop policy if exists "authenticated upload vehicle photos" on storage.objects;
create policy "authenticated upload vehicle photos" on storage.objects for insert to authenticated with check(bucket_id='vehicle-photos');
drop policy if exists "authenticated update vehicle photos" on storage.objects;
create policy "authenticated update vehicle photos" on storage.objects for update to authenticated using(bucket_id='vehicle-photos');
drop policy if exists "authenticated delete vehicle photos" on storage.objects;
create policy "authenticated delete vehicle photos" on storage.objects for delete to authenticated using(bucket_id='vehicle-photos');
