# Supabase schema reference

Source of truth: `supabase/migrations/*.sql`. This document explains the
tables, relationships, RLS policies, and the dashboard metric definitions in
plain language. Regenerate TypeScript types from the real project once it
exists (see `/docs/DEPLOYMENT.md`); until then, `src/lib/supabase/database.types.ts`
is hand-maintained to match these migrations.

## Migration files

| File | Purpose |
|---|---|
| `0001_init_schema.sql` | All 12 tables, indexes, `updated_at` triggers, and the circular `leads.appointment_id` / `calls.appointment_id` FKs (added after `appointments` exists). |
| `0002_rls_policies.sql` | `current_organization_id()` / `current_user_role()` helper functions + RLS policies for every table. |
| `0003_handle_new_user.sql` | Optional trigger that auto-creates a `profiles` row when a new `auth.users` row carries `organization_id` in its signup metadata. |
| `0004_default_organization_id.sql` | Convenience trigger: defaults `organization_id` from `current_organization_id()` on insert if the client omitted it (used by e.g. the Campaigns UI; n8n always sets it explicitly). |

Run them in order against a fresh Supabase project (SQL editor, or `supabase db push` if you've initialized the Supabase CLI locally). `supabase/seed.sql` is optional, idempotent sample data (one organization + the global `lead_score` prompt template).

## Tables

### organizations
One row per clinic/tenant. `slug` is unique. `demo` flags a non-production/demo org (unused by Live Mode currently, reserved for future multi-org demo scenarios).

### profiles
1:1 with `auth.users` (`profiles.id = auth.users.id`). Carries `organization_id` + `role`. Role set matches the **existing frontend** `UserRole` type (`ADMIN | CLINIC_OWNER | OFFICE_MANAGER | RECEPTIONIST`) rather than the deployment prompt's suggested `owner/admin/staff/receptionist` -- approximate mapping: `owner -> CLINIC_OWNER`, `admin -> ADMIN`, `staff -> OFFICE_MANAGER`, `receptionist -> RECEPTIONIST`.

### patients, campaigns, leads, calls, appointments, conversations, messages
Match `src/types/database.ts` closely (see "Deviations from the prompt" below for exact naming choices). All have `organization_id`, `created_at`, `updated_at` (except `messages`/`automation_events`, which are append-only logs and only have `created_at`/`updated_at` where mutation is expected).

### automation_events
The event backbone. Written by n8n (service role) directly, and by `POST /api/events` (also service role, for the n8n -> app direction). `event_type` values currently in use: `lead.created`, `lead.qualified`. See `/docs/N8N_WORKFLOWS.md` for the full list this phase defines.

### automation_logs
Structured execution/error log. `organization_id` is nullable (a validation failure can occur before an org is even resolved). Regular authenticated users can `SELECT` their own org's logs (plus org-null system logs); only the service role writes to this table.

### prompt_templates
`organization_id` nullable = global template (available to every org). The seeded `lead_score` template is global. Regular users can read their own org's templates plus all global ones, but can only insert/update/delete within their own org -- global templates are intentionally only writable by the service role (e.g. via a future admin tool), to prevent one clinic from editing a prompt shared by every other clinic.

## Row Level Security

Every tenant table has `SELECT`/`INSERT`/`UPDATE`/`DELETE` policies of the shape:

```sql
using (organization_id = public.current_organization_id())
with check (organization_id = public.current_organization_id())
```

`current_organization_id()` is a `SECURITY DEFINER` SQL function that looks up the caller's `organization_id` from their `profiles` row (`where id = auth.uid()`). It's `SECURITY DEFINER` specifically so this lookup query itself isn't blocked by the `profiles` table's own RLS policy (which also calls this function) -- the function executes with the privileges of its owner (the migration-running role), which bypasses RLS and avoids infinite recursion. This is the standard, widely-used Supabase multi-tenancy pattern.

**No policy anywhere uses `USING (true)`** for business data. `organizations` has no `INSERT`/`DELETE` policy for regular users at all (provisioning happens via the service role). `automation_logs` has no `INSERT` policy for regular users (only the service role writes to it).

## Dashboard metric definitions

Implemented once, as pure functions, in `src/lib/services/metrics.ts` (`computeKPIs`, `computeCallActivity`, etc.), and called identically by both Demo Mode (mock dataset) and Live Mode (Supabase query results) -- see `src/lib/services/dashboard.service.ts`.

| Metric | Definition |
|---|---|
| **Total Calls** | `COUNT(calls)` where `started_at` is within the selected date range. |
| **Missed Calls** | `COUNT(calls)` where `status = 'missed'` and within range. |
| **New Leads** | `COUNT(leads)` where `created_at` is within range. |
| **Appointments Booked** | `COUNT(appointments)` where `status IN ('confirmed', 'completed')` and `created_at` is within range. |
| **Conversion Rate** | `appointments... ` -- specifically `COUNT(leads where status IN ('booked','completed')) / COUNT(leads in range) * 100`. Returns `0` (never `NaN`/`Infinity`) when there are no leads in range. |
| **Estimated Revenue Opportunity** | `SUM(estimated_value)` of booked/completed appointments in range, **plus** a flat CA$500 per recovered missed call in range. |
| **Avg. call duration** (bottom KPI strip) | `SUM(duration_seconds) / COUNT(calls where status = 'completed')`. Returns `0` when there are no completed calls. |

All of these additionally compute the same values for the immediately preceding period of equal length (`getPreviousPeriod()` in `src/lib/date-range.ts`) to drive the trend arrows -- in Live Mode this is done by fetching one window covering both periods (`[previousPeriod.from, range.to]`) and slicing client-side, to avoid two round trips per table.

## Deviations from the prompt (and why)

The deployment prompt suggested a schema from scratch. Per its own overriding instruction ("reuse existing architecture wherever possible... do not replace the existing UI unnecessarily"), the following deliberate deviations keep the **existing, working UI** functioning unchanged against Supabase:

- **`appointments.starts_at`/`ends_at`** instead of `start_time`/`end_time` -- matches the existing `Appointment` frontend type exactly.
- **`appointments.dentist_name`** (plain text) kept alongside the prompt's `provider_id` (nullable FK to `profiles`) -- there's no "providers" table yet, and the existing UI displays a dentist name string.
- **`leads.status`** uses the existing Kanban's 7 stages (`new, contacted, qualified, appointment_requested, booked, completed, lost`) instead of the prompt's suggested list (which included `converted`/`unqualified`) -- changing this would have required reworking the existing `/leads` Kanban board and its `LEAD_STAGES` constant.
- **`calls.status`** uses the existing `CallStatus` set (`completed, missed, failed, transferred`) instead of the prompt's `answered/missed/voicemail/failed`.
- **`calls.transcript`** is a single `jsonb` column (matching the existing frontend's `CallTranscript` shape: `{ lines, summary, recommended_follow_up }`) rather than a separate table, since it's always read/written together with the call and the prompt's 12-table minimum didn't call out a transcripts table.
- **AI fields are additive, not replacing existing fields**: `leads.lead_score`/`priority` (existing columns the whole UI already reads) are kept, with new `ai_score`/`ai_priority`/`ai_summary`/`ai_recommended_action` columns holding the raw AI output. The "AI -- Lead Qualification" workflow's business-rule step writes the business-approved value into `lead_score`/`priority` too, so every existing component (Kanban cards, detail sheet, dashboard funnel) picks up AI-qualified leads with zero code changes.
