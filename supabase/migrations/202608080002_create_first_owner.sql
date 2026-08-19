-- Run once after creating the first Supabase Authentication user.
do $$
declare
  first_user_id uuid;
  new_organization_id uuid;
begin
  select id into first_user_id
  from auth.users
  order by created_at asc
  limit 1;

  if first_user_id is null then
    raise exception 'Create an Authentication user before running this setup.';
  end if;

  insert into public.profiles (id, full_name)
  values (first_user_id, 'Ronald Walker')
  on conflict (id) do update
    set full_name = excluded.full_name,
        updated_at = now();

  select organization_id into new_organization_id
  from public.organization_members
  where user_id = first_user_id
  order by created_at asc
  limit 1;

  if new_organization_id is null then
    insert into public.organizations (name)
    values ('Check Calling Car Rental')
    returning id into new_organization_id;

    insert into public.organization_members (organization_id, user_id, role)
    values (new_organization_id, first_user_id, 'owner');
  end if;
end $$;

