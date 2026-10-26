-- =============================================================================
-- DentalFlow AI -- auto-provision a profile row when a new Supabase Auth user
-- is created, IF the signup included an `organization_id` in the user's
-- metadata (e.g. an invite flow: `supabase.auth.signUp({ options: { data: {
-- organization_id, full_name } } })`). If no organization_id is present, no
-- profile is created here -- an admin (or a future onboarding flow) must link
-- the user to an organization via the `profiles` table using the service role.
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
begin
  org_id := nullif(new.raw_user_meta_data ->> 'organization_id', '')::uuid;

  if org_id is not null then
    insert into public.profiles (id, organization_id, full_name, email, role)
    values (
      new.id,
      org_id,
      coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
      new.email,
      coalesce(new.raw_user_meta_data ->> 'role', 'RECEPTIONIST')
    )
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
