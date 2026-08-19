-- Expand Fleet Finance while keeping the ledger limited to vehicle-related activity.
alter table public.fleet_financial_entries drop constraint if exists fleet_financial_entries_category_check;
alter table public.fleet_financial_entries add constraint fleet_financial_entries_category_check check (category in (
  'rental_income','cleaning','maintenance','repair','insurance','registration_tax',
  'fuel_charging','financing','tolls_parking','vehicle_investment'
));
alter table public.fleet_financial_entries add column if not exists vendor text not null default '' check (char_length(vendor)<=200);
alter table public.fleet_financial_entries add column if not exists reference_number text not null default '' check (char_length(reference_number)<=120);
alter table public.fleet_financial_entries add column if not exists payment_method text not null default 'other' check (payment_method in ('cash','card','bank_transfer','platform','financing','other'));
alter table public.fleet_financial_entries add column if not exists receipt_url text;
