# DentalFlow AI — Architecture

This reflects the ACTUAL implementation after the "Supabase + n8n deployment"
phase, not an aspirational design. See `PROGRESS.md` (repo root) for the
overall build timeline and `TASKLIST.md` for the original product spec.

## High-level data flow

```
React (Next.js App Router)
       |
       v
Supabase (Postgres + Auth + RLS)  <---- source of truth
       |
       v
n8n (automation / orchestration)
       |
       +---- OpenAI (AI -- Lead Qualification)
       +---- SMS / Email / Calendar (future phases, not built yet)
```

```
Public lead form (or the in-app "Add lead" dialog)
        |
        v
submitLeadIntake()  [src/lib/services/lead-intake.service.ts]
        |
        v
n8n webhook: CORE -- Lead Intake
        |
        v
Validate -> Normalize -> Duplicate check -> Create/Update lead (Supabase)
        |
        v
automation_events: lead.created
        |
        v
AI -- Lead Qualification (sub-workflow) -> OpenAI -> validate JSON -> business rules
        |
        v
UPDATE leads SET ai_score, ai_priority, ai_summary, ai_recommended_action, ...
        |
        v
automation_events: lead.qualified
        |
        v
React Query refetch (manual "Add lead" invalidation, or the next poll/visit)
        |
        v
/leads Kanban + /dashboard KPIs reflect the new, AI-qualified lead
```

## Frontend architecture

- **Framework:** Next.js 16 (App Router), React 19, TypeScript, Tailwind v4.
- **Data fetching:** TanStack Query (`@tanstack/react-query`) hooks in `src/hooks/*.ts`, calling functions in `src/lib/services/*.service.ts`. Components never call Supabase or fetch() directly -- they go through a hook, which goes through a service function.
- **Service layer / Demo vs Live:** every `*.service.ts` function branches on `getCurrentDataSource()` (`src/lib/runtime-data-source.ts`):
  - `"mock"` -- reads from the in-memory seeded dataset (`src/lib/mock`).
  - `"supabase"` -- reads from Supabase via the browser client (`src/lib/supabase/client.ts`), relying entirely on Postgres Row Level Security to scope results to the signed-in user's organization (no manual `organization_id` filtering needed client-side for `SELECT`).

  This is the **single switch** governing which mode is active (see "Demo Mode vs Live Mode" below) -- no UI component should check `process.env` or a data source directly.
- **State management:** Zustand (`src/store`) for UI/client state (sidebar, selected demo user, Demo/Live toggle, global date range). TanStack Query owns all server-ish state.
- **Types:** `src/types/database.ts` is the single source of truth for every domain entity (`Lead`, `Call`, `Appointment`, `AutomationEvent`, ...). It intentionally matches the Supabase schema's intent rather than the exact column names in every case -- see `/docs/SUPABASE_SCHEMA.md` "Deviations from the prompt" for the handful of deliberate naming differences and why.

## Supabase architecture

- **Client modules** (`src/lib/supabase/`):
  - `client.ts` -- browser singleton (anon key only). Used by every Live-Mode service function.
  - `server.ts` -- server-side client bound to the current request's cookies (`@supabase/ssr`). Not currently used by any route (all live data fetching happens client-side via React Query), but available for future Server Components/Actions.
  - `admin.ts` -- service-role client. **Server-only** (throws if ever imported into a browser bundle context). Used exclusively by `src/app/api/events/route.ts`.
  - `database.types.ts` -- hand-written `Database` type matching the SQL migrations; regenerate with the Supabase CLI once a real project exists (see `/docs/DEPLOYMENT.md`).
  - `mappers.ts` -- converts Supabase row shapes into the existing frontend types, so every existing component keeps working unchanged in Live Mode.
- **Schema & RLS:** `supabase/migrations/*.sql` -- see `/docs/SUPABASE_SCHEMA.md` for the full table-by-table reference.
- **Auth:** Supabase Auth (email/password only, via a minimal `/login` page). A `profiles` table (1:1 with `auth.users`) carries `organization_id` + `role`. There is no sign-up/onboarding UI in this phase -- see `/docs/DEPLOYMENT.md` for how to provision the first user manually.

## n8n architecture

Two workflows (see `/docs/N8N_WORKFLOWS.md` and `/n8n/workflows/*.json`):

1. **CORE -- Lead Intake** -- public-facing webhook. Validates, normalizes, dedupes, writes to Supabase (using n8n's own service-role credential, never the frontend's), logs `lead.created`, and calls...
2. **AI -- Lead Qualification** -- a sub-workflow. Loads the lead + an organization-specific-or-global prompt template, calls OpenAI, validates the JSON response against a strict schema, applies a controlled business rule (`score -> priority`), writes the result back to the lead, and logs `lead.qualified` (or `lead.qualified` as a `failed` row in `automation_logs` if the AI output didn't validate).

n8n talks to Supabase directly via PostgREST (`/rest/v1/...`) using its own service-role credential configured inside n8n -- the Next.js app is never in that request path. The one place the Next.js app participates server-side is `POST /api/events`, an optional inbound callback n8n (or any trusted automation) can use to notify the app of something, authenticated by a shared secret header rather than a database credential.

**Calls.** Staff log an inbound or outbound call from `/calls`. In Live Mode that write goes straight to Supabase (patient match-or-create, `calls` row, `call.completed` or `call.missed` event) unless `NEXT_PUBLIC_N8N_CALL_WEBHOOK_URL` is set, in which case the same payload is posted to **CORE — Call Intake**. Twilio is not connected.

## Multi-tenancy

Every tenant-owned table has `organization_id uuid not null references organizations(id)`. Row Level Security is enabled on all of them, keyed off a `current_organization_id()` SQL function that resolves the signed-in user's org via their `profiles` row. See `/docs/SUPABASE_SCHEMA.md` "Row Level Security" for the full policy list and the recursion-avoidance rationale.

## Demo Mode vs Live Mode

- **Demo Mode** (default): `src/lib/mock/*` provides a deterministic, seeded, realistic dataset. No network calls. This is what ships "out of the box" with no configuration.
- **Live Mode**: reads/writes Supabase. Toggled at runtime via the "Demo Mode" / "Live Mode" badge in the topbar (`src/components/layout/topbar.tsx`), backed by `useUIStore.isDemoMode` (Zustand, persisted to `localStorage`). Switching to Live Mode requires (a) `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` to be configured, and (b) an active Supabase Auth session (the topbar redirects to `/login` if neither is true).
- A deployment can also be pinned permanently to one mode via `NEXT_PUBLIC_DATA_SOURCE=supabase` (disables the toggle/Demo Mode entirely) -- see `getActiveDataSource()` in `src/lib/config.ts` for the exact precedence rules.
- Demo and Live data are never mixed in the same render: `getCurrentDataSource()` is read once per service call and the whole call either goes to the mock dataset or to Supabase.

## What's intentionally NOT live yet

Campaigns, AI Receptionist, Knowledge Base, Analytics, Reports, Patients, and Settings remain Demo-Mode-data-sourced even when Live Mode is on for Calls/Leads/Appointments/Dashboard (the dashboard's Campaign Performance and AI Insights widgets degrade to empty states in Live Mode rather than throwing). This matches the deployment prompt's 5 primary objectives and Phase 17 "do not build yet" list -- see the implementation report in the chat for the full rationale.
