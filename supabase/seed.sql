-- =============================================================================
-- DentalFlow AI -- optional seed data for a freshly created Supabase project.
--
-- Run manually (`supabase db execute -f supabase/seed.sql` or paste into the
-- SQL editor) AFTER the migrations in supabase/migrations/ have been applied.
-- Safe to re-run: every insert is idempotent (ON CONFLICT DO NOTHING).
-- =============================================================================

-- A real, fixed UUID for local/dev testing so docs and .env.local examples can
-- reference a stable organization_id. Replace with your own organization for
-- production use.
insert into public.organizations (
  id, name, slug, industry, timezone, phone, email, city, province, postal_code,
  address_line1, plan, status, demo
) values (
  '11111111-1111-1111-1111-111111111111',
  'Maple Grove Dental Clinic',
  'maple-grove-dental',
  'dental',
  'America/Toronto',
  '(905) 555-0148',
  'hello@maplegrovedental.ca',
  'Mississauga',
  'Ontario',
  'L5B 3C9',
  '185 Central Parkway West',
  'growth',
  'active',
  false
)
on conflict (id) do nothing;

-- Global "lead_score" prompt template used by the AI -- Lead Qualification
-- n8n workflow (organization_id is NULL => available to every organization).
-- See /docs/N8N_WORKFLOWS.md and n8n/prompts/lead_score.md for the full text.
insert into public.prompt_templates (
  organization_id, name, purpose, system_prompt, user_prompt, model, temperature, version, active
) values (
  null,
  'lead_score',
  'Qualify inbound dental leads: intent, urgency, booking likelihood, estimated opportunity value, and a recommended follow-up action.',
  $SYS$You are an AI assistant that qualifies inbound leads for a dental clinic.

You must evaluate the lead''s message and metadata for:
- intent (why they are reaching out)
- requested service
- urgency
- booking likelihood
- estimated opportunity value in CAD
- a recommended, concrete follow-up action for clinic staff

You MUST NOT diagnose medical or dental conditions, and you MUST NOT make clinical
decisions. If the lead describes symptoms that sound like they need a professional
assessment, your "recommended_action" must direct staff to have a dental
professional contact the patient -- never provide medical advice yourself.

Return ONLY valid JSON matching this exact schema, with no markdown, no code
fences, and no extra commentary:

{
  "score": number (0-100),
  "priority": "low" | "medium" | "high",
  "service": string,
  "intent": "appointment" | "pricing_question" | "general_question" | "emergency" | "other",
  "urgency": "low" | "normal" | "high",
  "estimated_value": number,
  "recommended_action": string,
  "summary": string
}$SYS$,
  $USR$Lead details:
Name: {{first_name}} {{last_name}}
Phone: {{phone}}
Email: {{email}}
Source: {{source}}
Service requested: {{service_requested}}
Message: "{{message}}"

Qualify this lead and return the JSON object described in the system prompt.$USR$,
  'gpt-4o-mini',
  0.20,
  1,
  true
)
on conflict do nothing;
