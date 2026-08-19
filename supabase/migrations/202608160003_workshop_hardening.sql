-- Production safeguards and immutable activity history for Fleet Workshop.
create unique index if not exists fleet_workshop_one_active_job_per_vehicle
on public.fleet_workshop_jobs (vehicle_id)
where status not in ('completed','ready');

create table if not exists public.fleet_workshop_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workshop_job_id uuid not null references public.fleet_workshop_jobs(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (char_length(event_type) between 2 and 80),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists fleet_workshop_events_job_created_idx
on public.fleet_workshop_events (workshop_job_id,created_at desc);

alter table public.fleet_workshop_events enable row level security;
drop policy if exists "members read workshop events" on public.fleet_workshop_events;
create policy "members read workshop events" on public.fleet_workshop_events for select
using (public.is_organization_member(organization_id));
drop policy if exists "operators create workshop events" on public.fleet_workshop_events;
create policy "operators create workshop events" on public.fleet_workshop_events for insert
with check (actor_id=auth.uid() and exists (
  select 1 from public.organization_members m
  where m.organization_id=fleet_workshop_events.organization_id
    and m.user_id=auth.uid()
    and m.role in ('owner','admin','host','porter')
));
