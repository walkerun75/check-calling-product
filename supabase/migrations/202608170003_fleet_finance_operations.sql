-- Operational support for Fleet Finance automation and receipt evidence.
create table if not exists public.fleet_finance_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running' check (status in ('running','success','partial','failed')),
  rules_checked integer not null default 0,
  entries_posted integer not null default 0,
  entries_failed integer not null default 0,
  error_message text
);

alter table public.fleet_finance_runs enable row level security;
drop policy if exists "authenticated users read finance runs" on public.fleet_finance_runs;
create policy "authenticated users read finance runs"
on public.fleet_finance_runs for select to authenticated using (true);

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('fleet-finance-receipts','fleet-finance-receipts',false,10485760,
 array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set file_size_limit=excluded.file_size_limit,
 allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "fleet members upload receipts" on storage.objects;
create policy "fleet members upload receipts" on storage.objects for insert to authenticated
with check (bucket_id='fleet-finance-receipts' and exists (
 select 1 from public.organization_members m where m.user_id=auth.uid()
 and m.organization_id::text=(storage.foldername(name))[1]
 and m.role in ('owner','admin','host')));

drop policy if exists "fleet members read receipts" on storage.objects;
create policy "fleet members read receipts" on storage.objects for select to authenticated
using (bucket_id='fleet-finance-receipts' and exists (
 select 1 from public.organization_members m where m.user_id=auth.uid()
 and m.organization_id::text=(storage.foldername(name))[1]));
