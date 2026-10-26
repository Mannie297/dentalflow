-- =============================================================================
-- DentalFlow AI -- Row Level Security
-- =============================================================================
-- Core rule: a user belonging to Organization A must never be able to read or
-- modify Organization B's data. This is enforced at the database level via RLS
-- on every tenant-owned table, keyed off `public.current_organization_id()`.
--
-- `current_organization_id()` resolves the calling user's organization by
-- looking up their `profiles` row. It is declared SECURITY DEFINER so that the
-- lookup itself is not blocked by the `profiles` RLS policy it is used from
-- (this is the standard Supabase pattern for avoiding infinite policy
-- recursion -- the function runs with the privileges of its owner, the
-- migration-running role, which bypasses RLS). See /docs/SUPABASE_SCHEMA.md.
-- =============================================================================

create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.profiles where id = auth.uid()
$$;

grant execute on function public.current_organization_id() to authenticated;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

grant execute on function public.current_user_role() to authenticated;

-- -----------------------------------------------------------------------------
-- organizations
-- -----------------------------------------------------------------------------
alter table public.organizations enable row level security;

create policy organizations_select_own on public.organizations
  for select
  using (id = public.current_organization_id());

create policy organizations_update_own on public.organizations
  for update
  using (id = public.current_organization_id())
  with check (id = public.current_organization_id());

-- No insert/delete policy: organizations are provisioned via the service role
-- (signup/onboarding flow or manual setup), never directly by end users.

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy profiles_select_own_org on public.profiles
  for select
  using (organization_id = public.current_organization_id());

create policy profiles_insert_self on public.profiles
  for insert
  with check (id = auth.uid());

create policy profiles_update_self on public.profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- -----------------------------------------------------------------------------
-- Generic tenant tables: patients, campaigns, leads, calls, appointments,
-- conversations, messages, automation_events.
-- -----------------------------------------------------------------------------
do $$
declare
  tbl text;
  tenant_tables text[] := array[
    'patients', 'campaigns', 'leads', 'calls', 'appointments',
    'conversations', 'messages', 'automation_events'
  ];
begin
  foreach tbl in array tenant_tables loop
    execute format('alter table public.%I enable row level security;', tbl);

    execute format(
      'create policy %I on public.%I for select using (organization_id = public.current_organization_id());',
      tbl || '_select_own_org', tbl
    );
    execute format(
      'create policy %I on public.%I for insert with check (organization_id = public.current_organization_id());',
      tbl || '_insert_own_org', tbl
    );
    execute format(
      'create policy %I on public.%I for update using (organization_id = public.current_organization_id()) with check (organization_id = public.current_organization_id());',
      tbl || '_update_own_org', tbl
    );
    execute format(
      'create policy %I on public.%I for delete using (organization_id = public.current_organization_id());',
      tbl || '_delete_own_org', tbl
    );
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- automation_logs -- organization_id is nullable (pre-org-resolution failures),
-- so allow organization members to read their own org's logs, and additionally
-- allow rows with a null organization_id to be read by any authenticated staff
-- member (used for system-level error triage). Writes to this table are
-- expected to come from n8n via the service role, which bypasses RLS entirely,
-- so no insert policy is defined for regular authenticated users.
-- -----------------------------------------------------------------------------
alter table public.automation_logs enable row level security;

create policy automation_logs_select on public.automation_logs
  for select
  using (organization_id = public.current_organization_id() or organization_id is null);

-- -----------------------------------------------------------------------------
-- prompt_templates -- organization_id nullable means "global template",
-- readable by every tenant but only editable by the owning organization (or
-- the service role, for global templates).
-- -----------------------------------------------------------------------------
alter table public.prompt_templates enable row level security;

create policy prompt_templates_select on public.prompt_templates
  for select
  using (organization_id = public.current_organization_id() or organization_id is null);

create policy prompt_templates_insert on public.prompt_templates
  for insert
  with check (organization_id = public.current_organization_id());

create policy prompt_templates_update on public.prompt_templates
  for update
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

create policy prompt_templates_delete on public.prompt_templates
  for delete
  using (organization_id = public.current_organization_id());
