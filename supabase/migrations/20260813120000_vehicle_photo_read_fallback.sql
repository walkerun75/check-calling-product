-- Allow authenticated organization members to discover files in their own
-- vehicle folders. Public buckets allow rendering a known URL, but listing a
-- folder still requires an explicit storage.objects SELECT policy.
drop policy if exists "members list vehicle photos" on storage.objects;
create policy "members list vehicle photos"
on storage.objects for select
to authenticated
using (
  bucket_id = 'vehicle-photos'
  and exists (
    select 1
    from public.organization_members member
    where member.user_id = auth.uid()
      and (storage.foldername(name))[1] = member.organization_id::text
  )
);
