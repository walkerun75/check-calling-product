-- Mobile-first fleet turnaround and maintenance escalation records.
alter table public.organization_members drop constraint if exists organization_members_role_check;
alter table public.organization_members add constraint organization_members_role_check check (role in ('owner','admin','host','porter','viewer'));

create table public.fleet_workshop_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  status text not null default 'returned' check (status in ('returned','in_progress','issue_found','maintenance_hold','final_review','ready','completed')),
  due_at timestamptz,
  assigned_to uuid references auth.users(id),
  odometer integer check (odometer is null or odometer >= 0),
  fuel_level integer check (fuel_level is null or fuel_level between 0 and 100),
  notes text not null default '' check (char_length(notes) <= 2000),
  checklist jsonb not null default '[]'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.maintenance_work_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  workshop_job_id uuid references public.fleet_workshop_jobs(id) on delete set null,
  status text not null default 'open' check (status in ('open','scheduled','in_progress','waiting_parts','completed','cancelled')),
  severity text not null default 'inspect' check (severity in ('inspect','service','unsafe')),
  summary text not null check (char_length(summary) between 2 and 500),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index fleet_workshop_jobs_org_status_idx on public.fleet_workshop_jobs (organization_id,status,due_at);
create index maintenance_work_orders_org_status_idx on public.maintenance_work_orders (organization_id,status,created_at desc);
alter table public.fleet_workshop_jobs enable row level security;
alter table public.maintenance_work_orders enable row level security;

create policy "members read workshop jobs" on public.fleet_workshop_jobs for select using (public.is_organization_member(organization_id));
create policy "operators create workshop jobs" on public.fleet_workshop_jobs for insert with check (created_by=auth.uid() and exists (select 1 from public.organization_members m where m.organization_id=fleet_workshop_jobs.organization_id and m.user_id=auth.uid() and m.role in ('owner','admin','host','porter')));
create policy "operators update workshop jobs" on public.fleet_workshop_jobs for update using (exists (select 1 from public.organization_members m where m.organization_id=fleet_workshop_jobs.organization_id and m.user_id=auth.uid() and m.role in ('owner','admin','host','porter'))) with check (public.is_organization_member(organization_id));
create policy "members read maintenance work orders" on public.maintenance_work_orders for select using (public.is_organization_member(organization_id));
create policy "operators create maintenance work orders" on public.maintenance_work_orders for insert with check (created_by=auth.uid() and exists (select 1 from public.organization_members m where m.organization_id=maintenance_work_orders.organization_id and m.user_id=auth.uid() and m.role in ('owner','admin','host','porter')));
create policy "operators update maintenance work orders" on public.maintenance_work_orders for update using (exists (select 1 from public.organization_members m where m.organization_id=maintenance_work_orders.organization_id and m.user_id=auth.uid() and m.role in ('owner','admin','host'))) with check (public.is_organization_member(organization_id));
