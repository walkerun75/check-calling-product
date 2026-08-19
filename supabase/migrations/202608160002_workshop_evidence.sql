alter table public.fleet_workshop_jobs
add column if not exists ready_photos jsonb not null default '[]'::jsonb;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('workshop-photos','workshop-photos',true,10485760,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true,file_size_limit=10485760,allowed_mime_types=array['image/jpeg','image/png','image/webp'];

create policy "members read workshop photos" on storage.objects for select
using (bucket_id='workshop-photos' and public.is_organization_member(((storage.foldername(name))[1])::uuid));
create policy "operators upload workshop photos" on storage.objects for insert
with check (bucket_id='workshop-photos' and public.is_organization_member(((storage.foldername(name))[1])::uuid));
