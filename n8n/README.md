# n8n workflows

This folder contains **importable reference exports** of the n8n
workflows this deployment uses. They were authored by hand (not
exported from a live n8n instance, since this phase doesn't have one
provisioned) to the standard n8n workflow JSON format, so you can import them
directly, but you should expect to review/adjust node parameters once they're
open in the n8n editor — see "Known caveats" below.

- `workflows/core-lead-intake.json` — **CORE — Lead Intake**
- `workflows/ai-lead-qualification.json` — **AI — Lead Qualification** (sub-workflow)
- `workflows/core-call-intake.json` — **CORE — Call Intake** (inbound and outbound calls)
- `workflows/elevenlabs-call-completed.json` — **ElevenLabs — Call Completed** (maps an ElevenLabs post-call webhook into Call Intake)
- `workflows/elevenlabs-outbound-call.json` — **ElevenLabs — Outbound Call** (dials a patient through the Maple Grove agent)
- `workflows/elevenlabs-inbound-initiation.json` — **ElevenLabs — Inbound Initiation** (supplies dynamic variables when the clinic number is called)
- `workflows/campaign-call-dispatcher.json` — **Campaign Call Dispatcher** (dials the next due scheduled campaign call every minute)
- `workflows/knowledge-index.json` — **Knowledge — Index Document** (reads a file stored in Supabase and writes vector passages)
- `workflows/knowledge-search.json` — **Knowledge — Search** (embeds a question and calls `match_document_chunks`)
- `workflows/missed-call-recovery.json` — **Missed Call Recovery** (queues a voice callback for each inbound missed call)
- `prompts/lead_score.md` — the prompt template used by AI — Lead Qualification
- `prompts/outbound-receptionist.md` — agent settings for outbound calls on the existing receptionist

Full behavioral spec, payload shapes, and event contracts: `/docs/N8N_WORKFLOWS.md`.

How each live process runs: `/docs/procedures/README.md`.

## Import steps

1. In n8n: **Workflows → Import from File** → select `ai-lead-qualification.json` first (it's called as a sub-workflow by the other one).
2. Import `core-lead-intake.json`.
3. Create the two credentials (see below), then open every HTTP Request / AI node and attach the matching credential if it didn't carry over automatically (credential **values** are never included in these exports — only credential *names/ids* as placeholders).
4. In **CORE — Lead Intake**'s "Execute: AI — Lead Qualification" node, repoint `workflowId` at the actual imported AI — Lead Qualification workflow (n8n assigns a new internal ID on import).
5. Activate both workflows. Copy the **CORE — Lead Intake** webhook's production URL into the frontend's `NEXT_PUBLIC_N8N_LEAD_WEBHOOK_URL` env var.
6. Import `core-call-intake.json`, attach the same Supabase credential, activate it, and copy its production webhook URL into `NEXT_PUBLIC_N8N_CALL_WEBHOOK_URL`. Until that variable is set, the Calls page writes inbound and outbound calls directly to Supabase in Live Mode.
7. Import `elevenlabs-call-completed.json` and activate it. In ElevenLabs, create a workspace webhook pointed at this workflow's production URL (`/webhook/elevenlabs-call`), then select that webhook as the Agents post-call webhook with the Transcript event in JSON format. CORE — Call Intake must already be active, because this workflow posts to it. Re-import this file after pulling the outbound update so a dialed call is stored as outbound.
8. Import `elevenlabs-outbound-call.json`. Create an n8n **Header Auth** credential named `ElevenLabs API` whose header name is `xi-api-key` and whose value is the ElevenLabs API key. Attach it to **Place Outbound Call**. In **Prepare Outbound Call**, paste the agent id and the phone number id (`phnum_...`, not the `+1` number). Apply `prompts/outbound-receptionist.md` on the existing agent, then activate the workflow.
9. Import `elevenlabs-inbound-initiation.json` and activate it. In ElevenLabs, add a workspace webhook for its production URL (`/webhook/elevenlabs-inbound`). On the agent Security tab, enable **Fetch initiation client data from a webhook** and select that webhook. This is separate from the post-call webhook.
10. Import `campaign-call-dispatcher.json`, attach the same Supabase credential to each Supabase node, and activate it. It places one due campaign call per minute through the live `/webhook/outbound-call` workflow. DentalFlow also places due calls while the app is open. Activate this workflow so they still go out after the browser is closed.
11. Run `supabase/migrations/0005_knowledge_base.sql` in the Supabase SQL editor. Then import `knowledge-index.json`, attach **Supabase account** to the Supabase nodes and **OpenAI** to **Embed Passages**, and activate it. Put the production URL (`/webhook/knowledge-index`) in the server-only `N8N_KNOWLEDGE_INDEX_WEBHOOK_URL`.
12. Import `knowledge-search.json`, attach the same two credentials, and activate it. Put `/webhook/knowledge-search` in `N8N_KNOWLEDGE_SEARCH_WEBHOOK_URL`. Do not prefix either variable with `NEXT_PUBLIC_`. Restart the app after setting them.
13. Import `missed-call-recovery.json`, attach **Supabase account** to each Supabase node, and activate it. It queues a voice callback five minutes after an inbound missed call. The Campaign Call Dispatcher places that call. Pause the Missed Call Recovery campaign in DentalFlow to stop new callbacks. No webhook URL is required.

## Required n8n credentials

| Credential name (as referenced in the JSON) | Type | Used for |
|---|---|---|
| `Supabase account` | n8n's built-in **Supabase API** credential (fields: Host, Service Role Secret) | All reads/writes to Supabase via PostgREST (`/rest/v1/...`) |
| `OpenAI` | n8n's built-in OpenAI credential | Calling the AI model in **AI — Lead Qualification**, and `text-embedding-3-small` in the knowledge workflows |
| `ElevenLabs API` | n8n **Header Auth**. Header name `xi-api-key`, value is the ElevenLabs API key | Placing an outbound call |

For the Supabase credential: **Host** = your project's `https://<project-ref>.supabase.co`,
**Service Role Secret** = the same value as `SUPABASE_SERVICE_ROLE_KEY` in the frontend's
`.env.local`. Every Supabase-calling node uses `"authentication": "predefinedCredentialType"`
with `"nodeCredentialType": "supabaseApi"` — n8n's Supabase credential type automatically
injects the `apikey` and `Authorization: Bearer <service_role_key>` headers into every
request made this way, so no manual header setup is needed for auth.

The node **URLs** are hardcoded to the literal project URL (e.g.
`https://<project-ref>.supabase.co/rest/v1/leads`) rather than reading
`{{ $credentials.supabaseApi.host }}` — in testing, that expression resolved to an empty
string (causing an "Invalid URL" error), so the URL and the credential's Host field are
kept independent. This is safe since the project URL isn't secret (it's the same value as
`NEXT_PUBLIC_SUPABASE_URL`). If you change Supabase projects, update the URL in all 9 nodes
listed below (or re-export and re-import after a find/replace).

(An earlier version of these workflows tried to source the key from a credential via
`{{ $credentials.supabaseServiceRole.apiKey }}`, which referenced a credential type/field
that doesn't exist in n8n, so it always resolved to nothing and every Supabase call failed
authentication. Using the real, built-in Supabase credential type above fixes this and is
also the most secure option — the secret lives only in n8n's encrypted credential store,
never in a workflow variable or this repo.)

**Never** put the Supabase service role key or the OpenAI key anywhere in the
Next.js frontend or in this git repository — they belong exclusively in n8n's
credential store.

## Known caveats (review before relying on these in production)

- **Not tested against a live n8n instance.** Node `typeVersion`s match a
  recent n8n release at the time of writing, but n8n's node parameter schemas
  do change between versions — if a node shows a "could not be loaded"
  warning after import, open it and re-select the equivalent option (the
  overall node graph and logic will still be correct).
- The **Merge (Created or Updated)** node in `core-lead-intake.json` uses
  "chooseBranch" mode to pass through whichever of Create/Update ran. Confirm
  this behaves as expected for your n8n version; the `IF`-based duplicate
  branching is the important logic to preserve even if you swap the merge
  strategy.
- PostgREST upsert is also available as a one-step alternative to the
  explicit "Duplicate Check → IF → Update/Create" branch (via
  `Prefer: resolution=merge-duplicates` and a unique constraint), if you'd
  rather simplify the workflow once you've decided on a stable dedupe key.
- `n8n-nodes-base.executeWorkflow` / `executeWorkflowTrigger` input/output
  parameter names should be double-checked against your n8n version's UI.
