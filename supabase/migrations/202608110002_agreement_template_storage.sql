insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('agreement-templates','agreement-templates',false,10485760,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;

create policy "organization members read agreement templates" on storage.objects for select to authenticated
using (bucket_id='agreement-templates' and exists(select 1 from public.organization_members m where m.user_id=auth.uid() and m.organization_id::text=(storage.foldername(name))[1]));

create policy "organization admins upload agreement templates" on storage.objects for insert to authenticated
with check (bucket_id='agreement-templates' and exists(select 1 from public.organization_members m where m.user_id=auth.uid() and m.role in ('owner','admin') and m.organization_id::text=(storage.foldername(name))[1]));

create policy "organization admins update agreement templates" on storage.objects for update to authenticated
using (bucket_id='agreement-templates' and exists(select 1 from public.organization_members m where m.user_id=auth.uid() and m.role in ('owner','admin') and m.organization_id::text=(storage.foldername(name))[1]));

create policy "organization admins delete agreement templates" on storage.objects for delete to authenticated
using (bucket_id='agreement-templates' and exists(select 1 from public.organization_members m where m.user_id=auth.uid() and m.role in ('owner','admin') and m.organization_id::text=(storage.foldername(name))[1]));
