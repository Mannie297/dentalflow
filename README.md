# DentalFlow AI

DentalFlow AI is the front desk for a dental clinic. Staff see calls, leads, and appointments in one place. Missed inbound callers can be called back by voice. The owner gets a short read of the last 30 days, and a report they can download.

The example clinic in the product is Maple Grove Dental Clinic in Mississauga. Demo Mode uses sample data so a tour never dials a real patient. Live Mode uses the clinic's own Supabase project after a staff member signs in.

## What staff can do

| Area | What it is for |
| --- | --- |
| Dashboard | Counts for the header date range, missed-call recovery, and business insights. **Ask AI** answers from those insights. |
| Calls | A log of inbound and outbound calls. Staff can record a finished call. **Call back** places a live outbound call when Live Mode and the outbound webhook are set. |
| Patients | The people attached to calls, leads, and visits. |
| Appointments | The clinic schedule. A visit can be linked to the call that created it. Google Calendar is not connected. |
| Leads | A board from new inquiry through booked or lost. New inquiries can be sent to n8n for scoring. |
| Campaigns | Voice campaigns. **Schedule calls** places one call or a spreadsheet of calls at chosen times. The create-campaign wizard does not attach a dial list. |
| AI Receptionist | The clinic's rules for the voice agent: hours, services, and what the agent may say. Saving rules here does not change the ElevenLabs agent until that agent is updated separately. |
| Knowledge base | Clinic files live in Supabase. n8n reads each file, stores passages, and returns one answer to a question. |
| Analytics | Call, lead, and appointment results for the header date range. |
| Reports | A daily, weekly, or monthly summary. Download a PDF, or open the summary in the manager's own email program. |
| Settings | Clinic profile, the signed-in user, and which outside services are actually connected. |

Sign out is in the header menu, the sidebar, and Settings. It closes the Supabase session and returns the app to Demo Mode.

## Missed-call recovery

An inbound call saved as missed is queued for one AI voice callback, about five minutes later, on the **Missed Call Recovery** campaign. The campaign dispatcher places that call. When the dial is accepted, the missed call counts as recovered.

Pause that campaign to stop new callbacks. Numbers with fewer than 10 digits are skipped. Each missed call is queued once. Text messages and email are not sent.

While the app is open, DentalFlow queues the callback. After the browser is closed, the n8n workflow **Missed Call Recovery** does the same job, and **Campaign Call Dispatcher** places the call.

## How a clinic runs it

1. Open the app. It starts in Demo Mode when no live session is active.
2. Choose **Sign in** and use the staff email and password stored in Supabase Auth.
3. Live Mode reads and writes that clinic's rows. Row access is limited to the signed-in organization.
4. Choose **Sign out** when the shift is done.

**Continue in Demo Mode** on the sign-in page shows sample data. It does not require a password.

There is no public sign-up form. The first user is created in the Supabase dashboard and linked to the clinic in `profiles`. The steps are in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Project layout

```text
src/app/(app)/          Clinic pages
src/app/login/          Sign in
src/app/logout/         Sign out
src/app/api/            Server routes for n8n callbacks and the knowledge base
src/lib/services/       Demo and Live data access
src/components/         Page UI
n8n/workflows/          Importable n8n workflows
supabase/migrations/    Database schema and row-security policies
docs/                   Setup, schema, workflows, tab notes, and the clinic marketing note
```

Services choose Demo or Live at runtime. They do not follow a build-time flag, so the topbar switch changes data without a rebuild.

## Local setup

Requires Node.js 20 or newer.

```bash
npm install
copy .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

With an empty `.env.local`, the app still runs in Demo Mode. Live Mode needs the Supabase URL and anon key. Outbound calls, lead scoring, and the knowledge base also need the matching n8n webhooks.

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Lint |
| `npm test` | Unit tests |

## Environment variables

Copy names from [.env.example](.env.example). Put real values only in `.env.local` or in the host's environment settings. `.env.local` is git-ignored.

| Variable | Who can see it | Required for |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser | Live Mode |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser | Live Mode |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | n8n callback route and admin writes |
| `NEXT_PUBLIC_N8N_LEAD_WEBHOOK_URL` | Browser | Sending a new lead to n8n |
| `NEXT_PUBLIC_N8N_CALL_WEBHOOK_URL` | Browser | Optional. Logging a call through n8n |
| `NEXT_PUBLIC_N8N_OUTBOUND_WEBHOOK_URL` | Browser | Live callbacks and scheduled calls |
| `N8N_KNOWLEDGE_INDEX_WEBHOOK_URL` | Server only | Indexing an uploaded clinic file |
| `N8N_KNOWLEDGE_SEARCH_WEBHOOK_URL` | Server only | Answering a knowledge-base question |
| `DENTALFLOW_WEBHOOK_SECRET` | Server only | Optional shared secret for `POST /api/events` |

Never prefix the service role key, the webhook secret, or the knowledge webhook URLs with `NEXT_PUBLIC_`.

Apply the SQL files in `supabase/migrations/` in order, then create the first user. Details are in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## n8n

n8n does the heavy work: lead scoring, call intake, outbound dialing, the campaign dispatcher, missed-call recovery, and knowledge-base indexing and search. Import the JSON files in `n8n/workflows/` and attach the existing Supabase and OpenAI credentials. The walkthrough is [n8n/README.md](n8n/README.md). Field-level contracts are in [docs/N8N_WORKFLOWS.md](docs/N8N_WORKFLOWS.md).

Production webhooks answer only while the matching workflow is active.

## More documentation

| Document | What it covers |
| --- | --- |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Supabase, environment variables, and the first user |
| [docs/SUPABASE_SCHEMA.md](docs/SUPABASE_SCHEMA.md) | Tables and access rules |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the app is split |
| [docs/tabs/](docs/tabs/) | What each sidebar page does |
| [docs/procedures/](docs/procedures/) | How each live n8n process runs |
| [docs/MARKETING.md](docs/MARKETING.md) | How to show the product to a clinic |

## What this version does not do

- It does not send SMS or marketing email.
- It does not connect to Google Calendar, take payments, or request reviews.
- It does not diagnose, prescribe, or invent a fee. A price in a knowledge-base answer has to appear in a document the clinic uploaded.
- A scheduled call goes out while DentalFlow is open, or while the n8n dispatcher is active. A paused campaign is not dialed.

## Deploy

The app is a Next.js App Router project and deploys on Vercel as a standard Next.js app. Set the same environment variables as `.env.example` in the Vercel project. Do not commit `.env.local`. After the first deploy, add the production URL to the Supabase Auth settings if the project uses any redirect-based sign-in.
