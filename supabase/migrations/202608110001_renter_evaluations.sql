create table if not exists public.renter_evaluations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  applicant_name text not null,
  renter_application_id uuid,
  rental_id uuid,
  recommendation text not null check (recommendation in ('approve','approve_with_conditions','manual_review','decline')),
  confidence numeric(5,2) not null default 0 check (confidence between 0 and 100),
  passed_rules jsonb not null default '[]'::jsonb,
  failed_rules jsonb not null default '[]'::jsonb,
  missing_information jsonb not null default '[]'::jsonb,
  risk_indicators jsonb not null default '[]'::jsonb,
  suggested_conditions jsonb not null default '[]'::jsonb,
  explanation text,
  status text not null default 'waiting' check (status in ('waiting','approved','conditionally_approved','declined','information_requested','resolved')),
  due_at timestamptz,
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists renter_evaluations_org_status_idx on public.renter_evaluations(organization_id,status,created_at desc);
alter table public.renter_evaluations enable row level security;
create policy "organization members read renter evaluations" on public.renter_evaluations for select to authenticated using (exists (select 1 from public.organization_members m where m.organization_id=renter_evaluations.organization_id and m.user_id=auth.uid()));
create policy "authorized members manage renter evaluations" on public.renter_evaluations for all to authenticated using (exists (select 1 from public.organization_members m where m.organization_id=renter_evaluations.organization_id and m.user_id=auth.uid() and m.role in ('owner','admin','host'))) with check (exists (select 1 from public.organization_members m where m.organization_id=renter_evaluations.organization_id and m.user_id=auth.uid() and m.role in ('owner','admin','host')));
