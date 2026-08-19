-- Persistent owner-led platform launch and role permissions.
alter table public.organizations
  add column if not exists launch_status text not null default 'setup'
    check (launch_status in ('setup', 'active')),
  add column if not exists launched_at timestamptz;

create table if not exists public.organization_launch_steps (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  step_key text not null check (step_key in (
    'business','rules','fleet','approval','payments','agreements','website','launch'
  )),
  position smallint not null check (position between 1 and 8),
  status text not null default 'not_started'
    check (status in ('not_started','in_progress','complete','blocked')),
  configuration jsonb not null default '{}'::jsonb,
  completed_by uuid references auth.users(id),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (organization_id, step_key),
  unique (organization_id, position)
);

create table if not exists public.organization_role_permissions (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role text not null check (role in ('owner','admin','host','viewer')),
  module_key text not null check (module_key in (
    'command_center','fleet','rentals','assessments','finance','agreements','website','settings'
  )),
  can_view boolean not null default false,
  can_manage boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (organization_id, role, module_key),
  check (not can_manage or can_view)
);

create or replace function public.is_organization_admin(target_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = target_org and user_id = auth.uid() and role in ('owner','admin')
  );
$$;

alter table public.organization_launch_steps enable row level security;
alter table public.organization_role_permissions enable row level security;

drop policy if exists "members read launch steps" on public.organization_launch_steps;
drop policy if exists "admins manage launch steps" on public.organization_launch_steps;
drop policy if exists "members read role permissions" on public.organization_role_permissions;
drop policy if exists "admins manage role permissions" on public.organization_role_permissions;
drop policy if exists "admins update organization launch" on public.organizations;

create policy "members read launch steps" on public.organization_launch_steps for select
using (public.is_organization_member(organization_id));
create policy "admins manage launch steps" on public.organization_launch_steps for all
using (public.is_organization_admin(organization_id))
with check (public.is_organization_admin(organization_id));
create policy "members read role permissions" on public.organization_role_permissions for select
using (public.is_organization_member(organization_id));
create policy "admins manage role permissions" on public.organization_role_permissions for all
using (public.is_organization_admin(organization_id))
with check (public.is_organization_admin(organization_id));
create policy "admins update organization launch" on public.organizations for update
using (public.is_organization_admin(id)) with check (public.is_organization_admin(id));

insert into public.organization_launch_steps (organization_id, step_key, position)
select o.id, s.step_key, s.position
from public.organizations o
cross join (values
  ('business',1),('rules',2),('fleet',3),('approval',4),
  ('payments',5),('agreements',6),('website',7),('launch',8)
) as s(step_key, position)
on conflict do nothing;

insert into public.organization_role_permissions
  (organization_id, role, module_key, can_view, can_manage)
select o.id, r.role, m.module_key,
  case when r.role in ('owner','admin') then true
       when r.role = 'host' then m.module_key not in ('settings')
       else m.module_key in ('command_center','fleet','rentals') end,
  case when r.role in ('owner','admin') then true
       when r.role = 'host' then m.module_key in ('fleet','rentals','assessments','agreements')
       else false end
from public.organizations o
cross join (values ('owner'),('admin'),('host'),('viewer')) as r(role)
cross join (values ('command_center'),('fleet'),('rentals'),('assessments'),
  ('finance'),('agreements'),('website'),('settings')) as m(module_key)
on conflict do nothing;
