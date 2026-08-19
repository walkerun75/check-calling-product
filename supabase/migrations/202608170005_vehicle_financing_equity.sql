create table if not exists public.vehicle_financing_accounts (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 vehicle_id uuid not null references public.vehicles(id) on delete cascade, account_type text not null check(account_type in('loan','lease','lease_to_own')),
 lender text not null default '', acquisition_value numeric(12,2) not null default 0, original_balance numeric(12,2) not null default 0,
 current_balance numeric(12,2) not null default 0, estimated_vehicle_value numeric(12,2) not null default 0,
 purchase_option_amount numeric(12,2), annual_rate numeric(6,3), term_months integer, created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,vehicle_id)
);
create table if not exists public.vehicle_finance_payments (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 vehicle_id uuid not null references public.vehicles(id) on delete cascade, financing_account_id uuid not null references public.vehicle_financing_accounts(id) on delete cascade,
 payment_date date not null, total_amount numeric(12,2) not null check(total_amount>0), principal_amount numeric(12,2) not null default 0,
 interest_amount numeric(12,2) not null default 0, fee_amount numeric(12,2) not null default 0, reference_number text not null default '',
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), check(principal_amount+interest_amount+fee_amount<=total_amount)
);
alter table public.vehicle_financing_accounts enable row level security; alter table public.vehicle_finance_payments enable row level security;
create policy "members read financing accounts" on public.vehicle_financing_accounts for select using(public.is_organization_member(organization_id));
create policy "hosts manage financing accounts" on public.vehicle_financing_accounts for all using(public.is_organization_member(organization_id)) with check(public.is_organization_member(organization_id));
create policy "members read finance payments" on public.vehicle_finance_payments for select using(public.is_organization_member(organization_id));
create policy "hosts manage finance payments" on public.vehicle_finance_payments for all using(public.is_organization_member(organization_id)) with check(public.is_organization_member(organization_id));
