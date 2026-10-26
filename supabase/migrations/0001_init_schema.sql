-- =============================================================================
-- DentalFlow AI -- Initial schema
-- =============================================================================
-- Naming note: column names intentionally mirror the existing frontend types in
-- `src/types/database.ts` (e.g. `starts_at`/`ends_at` instead of `start_time`/
-- `end_time`, `dentist_name` instead of a providers table) so the live Supabase
-- data layer can be mapped onto the existing UI with zero component changes.
-- See /docs/SUPABASE_SCHEMA.md for the full rationale and any deviations from
-- a from-scratch schema design.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Helper: keep `updated_at` current on every UPDATE.
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- organizations
-- -----------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  industry text not null default 'dental',
  timezone text not null default 'America/Toronto',
  phone text,
  email text,
  website text,
  city text,
  province text,
  postal_code text,
  address_line1 text,
  logo_url text,
  plan text not null default 'trial' check (plan in ('trial', 'starter', 'growth', 'enterprise')),
  status text not null default 'active' check (status in ('active', 'suspended', 'cancelled')),
  demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_organizations_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- profiles (1:1 with auth.users; application-level identity + role + org)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  -- Existing app role set (ADMIN / CLINIC_OWNER / OFFICE_MANAGER / RECEPTIONIST). Roughly maps to the
  -- prompt's suggested owner/admin/staff/receptionist -- see /docs/SUPABASE_SCHEMA.md for the mapping.
  role text not null default 'RECEPTIONIST' check (role in ('ADMIN', 'CLINIC_OWNER', 'OFFICE_MANAGER', 'RECEPTIONIST')),
  title text,
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_profiles_organization_id on public.profiles (organization_id);

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- patients
-- -----------------------------------------------------------------------------
create table public.patients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  phone text,
  email text,
  date_of_birth date,
  patient_type text not null default 'new' check (patient_type in ('new', 'existing')),
  status text not null default 'active' check (status in ('active', 'needs_follow_up', 'inactive', 'overdue_recall')),
  lead_source text check (
    lead_source in ('inbound_call', 'outbound_call', 'website', 'chat', 'referral', 'walk_in', 'campaign')
  ),
  last_appointment_at timestamptz,
  next_appointment_at timestamptz,
  estimated_value numeric(12, 2) not null default 0,
  is_high_value boolean not null default false,
  notes text,
  ai_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_patients_organization_id on public.patients (organization_id);
create index idx_patients_phone on public.patients (organization_id, phone);
create index idx_patients_email on public.patients (organization_id, email);

create trigger trg_patients_updated_at
  before update on public.patients
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- campaigns
-- -----------------------------------------------------------------------------
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  type text not null check (
    type in ('recall', 'missed_call_recovery', 'appointment_reminder', 'treatment_follow_up', 'review_request')
  ),
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'active', 'completed', 'paused')),
  channels text[] not null default '{}',
  audience_description text,
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  start_date date,
  end_date date,
  budget numeric(12, 2),
  contacts_count int not null default 0,
  calls_count int not null default 0,
  sms_count int not null default 0,
  responses_count int not null default 0,
  appointments_count int not null default 0,
  estimated_revenue numeric(12, 2) not null default 0,
  ai_script text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_campaigns_organization_id on public.campaigns (organization_id);

create trigger trg_campaigns_updated_at
  before update on public.campaigns
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- leads
-- -----------------------------------------------------------------------------
-- Status set intentionally matches the existing Kanban UI (`src/app/(app)/leads/page.tsx`) rather
-- than the prompt's suggested list (which includes `converted`/`unqualified`) -- see
-- /docs/SUPABASE_SCHEMA.md "Deviations from the prompt" section.
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  patient_id uuid references public.patients (id) on delete set null,
  first_name text not null,
  last_name text,
  phone text,
  email text,
  source text not null default 'website' check (
    source in ('inbound_call', 'outbound_call', 'website', 'chat', 'referral', 'walk_in', 'campaign')
  ),
  source_campaign text,
  service_requested text,
  message text,
  status text not null default 'new' check (
    status in ('new', 'contacted', 'qualified', 'appointment_requested', 'booked', 'completed', 'lost')
  ),
  lead_score int not null default 0 check (lead_score between 0 and 100),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  estimated_value numeric(12, 2) not null default 0,
  -- Raw AI output, kept separate from the business-rule-derived fields above (lead_score/priority are
  -- updated FROM ai_score/ai_priority by a controlled business-rule step -- see Phase 11 / AI -- Lead
  -- Qualification workflow. The AI never writes lead_score/priority directly.)
  ai_score int check (ai_score between 0 and 100),
  ai_priority text check (ai_priority in ('low', 'medium', 'high')),
  ai_summary text,
  ai_recommended_action text,
  next_action text,
  appointment_id uuid,
  assigned_to uuid references public.profiles (id) on delete set null,
  campaign_id uuid references public.campaigns (id) on delete set null,
  first_contact_at timestamptz not null default now(),
  last_contact_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_leads_organization_id on public.leads (organization_id);
create index idx_leads_phone on public.leads (organization_id, phone);
create index idx_leads_email on public.leads (organization_id, email);
create index idx_leads_status on public.leads (organization_id, status);
create index idx_leads_created_at on public.leads (organization_id, created_at);

create trigger trg_leads_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- calls
-- -----------------------------------------------------------------------------
create table public.calls (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  patient_id uuid references public.patients (id) on delete set null,
  lead_id uuid references public.leads (id) on delete set null,
  direction text not null check (direction in ('inbound', 'outbound')),
  status text not null check (status in ('completed', 'missed', 'failed', 'transferred')),
  phone_number text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds int not null default 0,
  recording_url text,
  -- Structured transcript ({ lines: [...], summary, recommended_follow_up }), matching the existing
  -- frontend `CallTranscript` shape -- see /docs/SUPABASE_SCHEMA.md. Kept inline rather than as a
  -- separate table since it is always fetched/written together with the call.
  transcript jsonb,
  intent text,
  outcome text,
  ai_summary text,
  ai_sentiment text check (ai_sentiment in ('positive', 'neutral', 'negative')),
  ai_handled boolean not null default false,
  ai_confidence numeric(4, 3),
  appointment_id uuid,
  campaign_id uuid references public.campaigns (id) on delete set null,
  recovered_from_missed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_calls_organization_id on public.calls (organization_id);
create index idx_calls_started_at on public.calls (organization_id, started_at);
create index idx_calls_status on public.calls (organization_id, status);

create trigger trg_calls_updated_at
  before update on public.calls
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- appointments
-- -----------------------------------------------------------------------------
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  patient_id uuid references public.patients (id) on delete set null,
  lead_id uuid references public.leads (id) on delete set null,
  call_id uuid references public.calls (id) on delete set null,
  campaign_id uuid references public.campaigns (id) on delete set null,
  -- Nullable FK to profiles for a real provider/dentist user account, plus a plain display name so the
  -- existing UI (which has no "providers" table today) keeps working even before providers sign up.
  provider_id uuid references public.profiles (id) on delete set null,
  dentist_name text not null default '',
  patient_name text not null default '',
  patient_type text not null default 'new' check (patient_type in ('new', 'existing')),
  service text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'requested' check (
    status in ('requested', 'confirmed', 'completed', 'cancelled', 'no_show')
  ),
  source text check (
    source in ('inbound_call', 'outbound_call', 'website', 'chat', 'referral', 'walk_in', 'campaign')
  ),
  estimated_value numeric(12, 2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_appointments_organization_id on public.appointments (organization_id);
create index idx_appointments_starts_at on public.appointments (organization_id, starts_at);
create index idx_appointments_status on public.appointments (organization_id, status);

create trigger trg_appointments_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

-- Circular references (leads <-> appointments, calls <-> appointments) are added after both sides exist.
alter table public.leads
  add constraint fk_leads_appointment foreign key (appointment_id) references public.appointments (id) on delete set null;

alter table public.calls
  add constraint fk_calls_appointment foreign key (appointment_id) references public.appointments (id) on delete set null;

create index idx_leads_appointment_id on public.leads (appointment_id);
create index idx_calls_appointment_id on public.calls (appointment_id);

-- -----------------------------------------------------------------------------
-- conversations
-- -----------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  patient_id uuid references public.patients (id) on delete set null,
  lead_id uuid references public.leads (id) on delete set null,
  patient_name text,
  channel text not null check (channel in ('phone', 'sms', 'email', 'website_chat')),
  status text not null default 'active' check (status in ('active', 'resolved', 'archived')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  last_message_at timestamptz,
  last_message_preview text,
  ai_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_conversations_organization_id on public.conversations (organization_id);

create trigger trg_conversations_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- messages
-- -----------------------------------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  patient_id uuid references public.patients (id) on delete set null,
  channel text check (channel in ('sms', 'email', 'voice')),
  direction text not null check (direction in ('inbound', 'outbound')),
  sender_type text check (sender_type in ('patient', 'ai', 'staff', 'system')),
  body text not null,
  external_message_id text,
  status text check (status in ('sent', 'delivered', 'failed', 'read')),
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_messages_organization_id on public.messages (organization_id);
create index idx_messages_conversation_id on public.messages (conversation_id);

create trigger trg_messages_updated_at
  before update on public.messages
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- automation_events -- event backbone written by both the app and n8n
-- -----------------------------------------------------------------------------
create table public.automation_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_automation_events_organization_id on public.automation_events (organization_id);
create index idx_automation_events_type_status on public.automation_events (event_type, status);
create index idx_automation_events_entity on public.automation_events (entity_type, entity_id);

-- -----------------------------------------------------------------------------
-- automation_logs -- structured execution/error log written by n8n
-- -----------------------------------------------------------------------------
create table public.automation_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  workflow_name text not null,
  execution_id text,
  event_type text,
  status text not null check (status in ('pending', 'processing', 'completed', 'failed')),
  message text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index idx_automation_logs_organization_id on public.automation_logs (organization_id);
create index idx_automation_logs_workflow_name on public.automation_logs (workflow_name);

-- -----------------------------------------------------------------------------
-- prompt_templates -- organization-specific (or global, when organization_id is
-- null) AI prompt definitions used by n8n's "AI -- Lead Qualification" workflow.
-- -----------------------------------------------------------------------------
create table public.prompt_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  name text not null,
  purpose text,
  system_prompt text not null,
  user_prompt text,
  model text not null default 'gpt-4o-mini',
  temperature numeric(3, 2) not null default 0.20,
  version int not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_prompt_templates_organization_id on public.prompt_templates (organization_id);
create unique index uq_prompt_templates_org_name_version on public.prompt_templates (
  coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), name, version
);

create trigger trg_prompt_templates_updated_at
  before update on public.prompt_templates
  for each row execute function public.set_updated_at();
