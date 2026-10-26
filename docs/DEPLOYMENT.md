# Deployment guide

## 1. Environment variables

Create `.env.local` (git-ignored already — see repo `.gitignore`'s `.env*` entry) in the project root:

```bash
# --- Supabase (required for Live Mode) ---------------------------------
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-public-key>

# Server-only -- NEVER prefix with NEXT_PUBLIC_, never commit, never send to the browser.
# Only read by src/lib/supabase/admin.ts (used by the POST /api/events route handler).
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# --- n8n (required to submit real leads from the frontend) -------------
NEXT_PUBLIC_N8N_LEAD_WEBHOOK_URL=https://<your-n8n-host>/webhook/lead-intake

# Optional. When set, the Calls page posts inbound/outbound calls to n8n
# instead of writing them with the signed-in user's Supabase session.
# NEXT_PUBLIC_N8N_CALL_WEBHOOK_URL=https://<your-n8n-host>/webhook/call-intake

# --- Optional ------------------------------------------------------------
# Pins the deployment to Supabase-only (disables Demo Mode/the topbar toggle entirely).
# Leave unset for a normal deployment where staff can flip between Demo and Live Mode.
# NEXT_PUBLIC_DATA_SOURCE=supabase

# Shared secret for the n8n -> app callback route. If unset, POST /api/events refuses all requests.
# DENTALFLOW_WEBHOOK_SECRET=<random-long-string>

# Convenience default org id for local testing/scripts (not required by the app itself).
# NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID=11111111-1111-1111-1111-111111111111
```

## 2. Supabase project setup

1. Create a project at [supabase.com](https://supabase.com) (or use an existing one).
2. Copy the Project URL and `anon` + `service_role` keys from **Project Settings → API** into `.env.local` as above.
3. Run the migrations, in order, against the project (SQL editor, or the Supabase CLI: `supabase db push` after `supabase link`):
   - `supabase/migrations/0001_init_schema.sql`
   - `supabase/migrations/0002_rls_policies.sql`
   - `supabase/migrations/0003_handle_new_user.sql`
   - `supabase/migrations/0004_default_organization_id.sql`
4. (Optional but recommended for a first test) Run `supabase/seed.sql` to create a `Maple Grove Dental Clinic` organization and the global `lead_score` prompt template.
5. Create your first user + link it to an organization (no sign-up UI exists in this phase):
   - **Supabase Dashboard → Authentication → Add user** (set an email + password).
   - Then, in the SQL editor:
     ```sql
     insert into public.profiles (id, organization_id, full_name, email, role)
     values (
       '<the auth user's UUID from the dashboard>',
       '11111111-1111-1111-1111-111111111111', -- or your own organization's id
       'Your Name',
       'you@yourclinic.com',
       'CLINIC_OWNER'
     );
     ```
   - Alternative: pass `organization_id`/`full_name`/`role` in the user's metadata at signup time and the `handle_new_user` trigger (migration `0003`) creates the profile automatically.
6. Regenerate TypeScript types once the project is live (optional — `src/lib/supabase/database.types.ts` is hand-maintained to match the migrations until then):
   ```bash
   npx supabase gen types typescript --project-id <project-ref> > src/lib/supabase/database.types.ts
   ```

## 3. n8n setup

See `/n8n/README.md` for the full import walkthrough. Summary:

1. Import `n8n/workflows/ai-lead-qualification.json`, then `n8n/workflows/core-lead-intake.json`.
2. Create a `Supabase account` credential (n8n's built-in **Supabase API** type: Host + Service Role Secret) and an `OpenAI` credential in n8n, then attach them to the nodes that need them.
3. Re-point CORE — Lead Intake's "Execute: AI — Lead Qualification" node at the imported sub-workflow's new ID.
4. Activate both workflows and copy the production webhook URL into `NEXT_PUBLIC_N8N_LEAD_WEBHOOK_URL`.

## 4. Local development

```bash
npm install
npm run dev
```

- With no `.env.local` at all, the app runs entirely in **Demo Mode** (mock data, no network calls) — this is the default and requires zero configuration.
- Once Supabase env vars are set, the "Demo Mode" badge in the topbar becomes clickable — switching it signs you in (redirects to `/login` if you don't have a session yet) and flips every core page (Dashboard, Calls, Leads, Appointments) to live Supabase queries.

## 5. Production deployment

Standard Next.js deployment (Vercel, or any Node host that supports the App Router). Set the same environment variables from step 1 in your hosting provider's environment variable settings — never commit `.env.local`. `SUPABASE_SERVICE_ROLE_KEY` and `DENTALFLOW_WEBHOOK_SECRET` must only ever be set as server-side environment variables, never exposed to the client bundle (they are not prefixed with `NEXT_PUBLIC_`, so Next.js will not inline them into client code as long as they're only referenced from `src/lib/supabase/admin.ts` / `src/app/api/events/route.ts`).

## 6. End-to-end test: lead → n8n → Supabase → AI → dashboard

1. Open the app, confirm Demo Mode works (default — no setup needed).
2. Complete steps 1–3 above (Supabase schema + n8n workflows configured and activated).
3. Click the **"Demo Mode"** badge in the topbar → sign in with the user you created in step 2.5 → confirm it now reads **"Live Mode"**.
4. Go to **Leads** → **Add lead**. Fill in:
   - First name: `John`
   - Last name: `Smith`
   - Phone: `+14165551234`
   - Email: `john@example.com`
   - Service: `Dental Implants`
   - Message: `I would like to know the cost and availability.`
5. Submit. You should see a "Lead submitted" toast.
6. In Supabase (Table Editor → `leads`), confirm a new row appeared with `status = 'new'`.
7. Within a few seconds (depending on your AI model's latency), confirm the same row now has `ai_score`, `ai_priority`, `ai_summary`, `ai_recommended_action`, and an updated `lead_score`/`priority`/`estimated_value`.
8. Confirm two `automation_events` rows exist for this lead: `lead.created` and `lead.qualified`.
9. Back in the app, refresh (or re-open) the **Leads** board — the new lead should appear in the **New** column with the AI-derived priority badge.
10. Go to **Dashboard** — **New Leads** should have incremented by one for the current date range, and **Estimated Revenue Opportunity** should reflect the change once the lead reaches a booked/completed appointment (estimated value alone doesn't factor into revenue opportunity until an appointment is booked — see `/docs/SUPABASE_SCHEMA.md` "Dashboard metric definitions").

## 7. What you must configure manually (not automatable from this repo)

- Creating the actual Supabase project and copying its URL/keys.
- Creating the actual n8n instance/credentials and activating the workflows.
- Creating the first Supabase Auth user and linking it to an organization (no sign-up UI exists yet).
- An OpenAI API key (or swapping the "Call AI Model" node for a different provider).
- `DENTALFLOW_WEBHOOK_SECRET` if you want to use the optional `/api/events` n8n→app callback.
