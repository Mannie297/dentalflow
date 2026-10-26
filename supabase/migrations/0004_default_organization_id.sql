-- =============================================================================
-- DentalFlow AI -- convenience default for `organization_id` on client-initiated
-- inserts. Rows written by n8n (via the service role) always set
-- organization_id explicitly from the webhook payload; this trigger only
-- helps inserts made directly by an authenticated browser session (e.g. the
-- Campaigns UI creating a campaign) that may omit it.
-- =============================================================================

create or replace function public.default_organization_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.organization_id is null then
    new.organization_id := public.current_organization_id();
  end if;
  return new;
end;
$$;

do $$
declare
  tbl text;
  tenant_tables text[] := array[
    'patients', 'campaigns', 'leads', 'calls', 'appointments', 'conversations', 'messages'
  ];
begin
  foreach tbl in array tenant_tables loop
    execute format(
      'create trigger trg_%I_default_org before insert on public.%I for each row execute function public.default_organization_id();',
      tbl, tbl
    );
  end loop;
end $$;
