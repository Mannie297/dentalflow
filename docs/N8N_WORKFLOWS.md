# n8n workflows

Importable JSON: `/n8n/workflows/*.json`. Import and credential setup: `/n8n/README.md`. Operating procedures for each live integration: `/docs/procedures/README.md`. This document is the field-level spec.

## CORE — Lead Intake

**Trigger:** `POST` webhook (`/webhook/lead-intake`), called by `submitLeadIntake()` in the frontend (`src/lib/services/lead-intake.service.ts`) or any other lead source (a public website form, a chat widget, etc.).

```
Webhook
  -> Validate Request
  -> Normalize Lead
  -> Duplicate Check (Supabase)
  -> Create/Update Lead (Supabase)
  -> Log automation_events: lead.created
  -> Execute: AI -- Lead Qualification (sub-workflow, Phase 2)
  -> Respond to Webhook (success/error JSON)
```

### Input

```json
{
  "organization_id": "uuid",
  "source": "website",
  "first_name": "John",
  "last_name": "Smith",
  "phone": "+14165551234",
  "email": "john@example.com",
  "service_requested": "Dental Implant",
  "message": "I would like to know the cost of implants."
}
```

### Validation

- `organization_id` required.
- `first_name` required (non-empty after trim).
- `source` must be one of: `inbound_call, outbound_call, website, chat, referral, walk_in, campaign`.
- At least one of `phone`/`email` required -- **never reject a lead just because one of the two is missing** as long as the other is present.

Exactly mirrors `validateLeadIntakeInput()` in `src/lib/lead-intake/validation.ts` (unit tested) -- keep both in sync if you change either.

### Normalization

- Trim all string fields.
- `email` lowercased.
- `phone` stripped to digits, preserving a leading `+` if present.
- Names title-cased.
- `message` preserved verbatim (only trimmed) -- never rewritten.

### Duplicate check

`GET /rest/v1/leads?organization_id=eq.{id}&or=(phone.eq.{phone},email.eq.{email})&status=not.in.(lost,completed)&order=created_at.desc&limit=1`

If a match is found, the existing lead's `message`/`service_requested`/`last_contact_at` are updated instead of creating a duplicate row. Otherwise a new lead is created with `status = "new"` and no `ai_*` fields set (those are only ever written by AI — Lead Qualification).

### Event logged

`automation_events` row: `event_type = "lead.created"`, `entity_type = "lead"`, `entity_id = <lead id>`, `payload = <the full lead row>`.

### Response contract

Success:
```json
{ "success": true, "lead_id": "uuid", "status": "created", "message": "Lead received successfully" }
```
Failure (validation, duplicate-check error, etc.):
```json
{ "success": false, "error": "descriptive error message" }
```
Never includes a stack trace or any credential/connection string.

## AI — Lead Qualification

A **reusable sub-workflow** (`Execute Workflow Trigger`), called by CORE — Lead Intake (and safe to call again later, e.g. from a "re-qualify this lead" button, without duplicating logic).

**Input:** `{ "lead_id": "uuid", "organization_id": "uuid" }`

```
Get Lead (Supabase)
  -> Get Prompt Template (org-specific, else global "lead_score")
  -> Build Prompt (fill {{placeholders}} with lead fields)
  -> Call AI Model (OpenAI, response_format: json_object)
  -> Validate Structured JSON
       |-- invalid --> Log automation_logs (status=failed) --> Return { success: false, error }
       |-- valid   --> Apply Business Rules (score -> priority)
                         -> Update Lead with AI Results (Supabase)
                         -> Log automation_events: lead.qualified
                         -> Return { success: true, lead_id, ai }
```

### Expected AI output (validated before anything touches Supabase)

```json
{
  "score": 92,
  "priority": "high",
  "service": "Dental Implant",
  "intent": "appointment",
  "urgency": "normal",
  "estimated_value": 6500,
  "recommended_action": "Call within 15 minutes",
  "summary": "Patient is interested in a dental implant and appears ready to discuss booking."
}
```

Validated against the exact same rules in two places (kept intentionally in sync, see `/n8n/prompts/lead_score.md`):
- n8n's "Validate Structured JSON" Code node (plain JS, since n8n Code nodes can't `import` npm packages at runtime).
- `src/lib/ai/lead-qualification-schema.ts` (Zod), used by this project's own tests and available for any future server-side validation.

If parsing/validation fails: the failure is logged to `automation_logs` (`workflow_name, execution_id, event_type, status: "failed", message, payload`), the lead is **not** touched, and the sub-workflow returns a controlled `{ success: false, error }` rather than throwing an unhandled exception up to the webhook caller.

### Business rules (Phase 11 — AI safety)

The model's `score`/`priority` are advisory. The workflow's "Apply Business Rules" step is the only thing that sets the lead's authoritative `priority` column:

```
IF score >= 80  THEN priority = "high"
IF score >= 50  THEN priority = "medium"
ELSE                 priority = "low"
```

The AI is never given write access to Supabase directly, and its output is never passed to a Postgres query without first being validated against the schema above -- this prevents the model from being able to set arbitrary fields or inject SQL/field names it wasn't supposed to touch.

### Fields written to `leads`

`ai_score`, `ai_priority` (raw model output), `ai_summary`, `ai_recommended_action`, plus the business-rule-derived `lead_score` (mirrors `ai_score`) and `priority` (business-rule output) so every existing UI component that already reads `lead.lead_score`/`lead.priority` picks up AI qualification with no code changes.

## Required n8n credentials

| Name | Type | Scope |
|---|---|---|
| `Supabase account` | n8n's built-in **Supabase API** credential (Host + Service Role Secret) | All Supabase REST calls (`/rest/v1/*`) in both workflows |
| `OpenAI` | n8n's built-in OpenAI credential | Used only inside AI — Lead Qualification |

Every Supabase-calling node authenticates via
`"authentication": "predefinedCredentialType"` / `"nodeCredentialType": "supabaseApi"`
with the `Supabase account` credential attached -- n8n's Supabase credential type
automatically injects the `apikey` and `Authorization: Bearer <service_role_key>`
headers into the request. No workflow variable or manual auth header is needed.

Node URLs are hardcoded to the literal project URL (`https://<project-ref>.supabase.co/rest/v1/...`)
rather than read from the credential's Host field -- `{{ $credentials.supabaseApi.host }}`
was tried first but resolved to an empty string in practice. This is safe since the URL
isn't secret (same value as `NEXT_PUBLIC_SUPABASE_URL`).

Nodes that use this credential (9 total): `Duplicate Check (Supabase)`,
`Update Existing Lead`, `Create Lead`, `Log automation_events: lead.created`
(CORE — Lead Intake); `Get Lead`, `Get Prompt Template (org or global)`,
`Update Lead with AI Results`, `Log automation_events: lead.qualified`,
`Log automation_logs: failure` (AI — Lead Qualification).

## Error handling (Phase 13)

Every workflow failure path writes to `automation_logs` with: `workflow_name`, `execution_id` (`$execution.id`), `organization_id` (when known), `event_type`, `status: "failed"`, `message` (human-readable, no stack traces), and `payload` (the relevant input, not full request/response dumps with secrets). The webhook caller only ever sees `{ success: false, error: "<message>" }` -- never a raw Postgres/HTTP error body.

## Event types this phase defines

| `event_type` | Emitted by | Meaning |
|---|---|---|
| `lead.created` | CORE — Lead Intake | A new (or updated-from-duplicate) lead was written to Supabase. |
| `lead.qualified` | AI — Lead Qualification | AI qualification completed successfully and the lead was updated. A failed qualification is logged to `automation_logs`, not `automation_events`, since no entity state actually changed. |

`src/types/events.ts` defines the full long-term event vocabulary (`SUPPORTED_EVENT_NAMES`). The workflows in this repo emit `lead.created`, `lead.qualified`, `call.completed`, and `call.missed`.

## CORE — Call Intake

**Trigger:** `POST` webhook (`/webhook/call-intake`). The Calls page posts here only when `NEXT_PUBLIC_N8N_CALL_WEBHOOK_URL` is set. Until then, Live Mode writes the same record directly from the signed-in session (`logCall()` in `src/lib/services/calls.service.ts`). A phone system can post this webhook either way.

Importable JSON: `/n8n/workflows/core-call-intake.json`.

```
Webhook
  -> Validate Request
  -> Normalize Call
  -> Find Patient (by organization + phone)
       |-- found --> Create Call
       |-- missing --> Create Patient --> Create Call
  -> Log automation_events: call.completed or call.missed
  -> Respond { success, call_id }
```

### Input

```json
{
  "organization_id": "uuid",
  "direction": "inbound",
  "caller_name": "Ada Lovelace",
  "phone": "+14165550199",
  "status": "completed",
  "intent": "appointment_booking",
  "outcome": "booked",
  "duration_seconds": 120,
  "started_at": "2026-10-23T14:00:00.000Z",
  "notes": "Asked to book a cleaning.",
  "ai_handled": true,
  "transcript": {
    "lines": [{ "speaker": "ai", "timestamp_seconds": 0, "text": "Thank you for calling." }],
    "summary": "Asked to book a cleaning.",
    "recommended_follow_up": null
  }
}
```

`direction` is `inbound` or `outbound`. `status` defaults to `completed`. A `missed` or `failed` call is stored with no duration and emits `call.missed`. Every other status emits `call.completed`.

Validation matches `validateCallIntakeInput()` in `src/lib/call-intake/validation.ts`.

The caller name is not a column on `calls`. The workflow stores it on `patients` (`first_name` / `last_name`) and links `calls.patient_id`. The Calls page reads the name back from that patient. The event payload includes `patient_name` and `direction` so Recent Activity can tell an inbound call from an outbound call.

## ElevenLabs — Call Completed

**Trigger:** `POST` webhook (`/webhook/elevenlabs-call`). ElevenLabs sends this after a conversation is analyzed. The workflow answers immediately, then posts a DentalFlow call to **CORE — Call Intake**.

Importable JSON: `/n8n/workflows/elevenlabs-call-completed.json`.

```
Webhook (respond immediately)
  -> Map ElevenLabs Call
  -> Has a phone number?
       |-- yes --> POST /webhook/call-intake
       |-- no  --> stop
```

`post_call_transcription` becomes a completed call. The caller name, intent, and outcome come from ElevenLabs data collection. The phone number comes from `metadata.phone_call.external_number`. The transcript turns and `transcript_summary` are stored on the call, and `ai_handled` is true. A dashboard test chat has no phone number, so it stops before Call Intake.

`call_initiation_failure` becomes a missed outbound or inbound call. Audio events are ignored.

`organization_id` is read from the `organization_id` dynamic variable. When that variable is missing, the workflow uses the Maple Grove id `11111111-1111-1111-1111-111111111111`.

A call is outbound when ElevenLabs sets `metadata.phone_call.direction` to `outbound`, or when the dynamic variable `direction` is `outbound`. The patient name falls back to the `patient_name` dynamic variable when data collection did not capture one.

## ElevenLabs — Outbound Call

**Trigger:** `POST` webhook (`/webhook/outbound-call`). n8n asks ElevenLabs to dial the patient from the clinic number. When the call ends, **ElevenLabs — Call Completed** files it.

Importable JSON: `/n8n/workflows/elevenlabs-outbound-call.json`. Agent settings: `/n8n/prompts/outbound-receptionist.md`.

```
Webhook
  -> Prepare Outbound Call
  -> Ready?
       |-- no  --> 400
       |-- yes --> POST ElevenLabs outbound-call
                 --> Respond { success, conversation_id }
```

### Input

```json
{
  "patient_name": "Ada Lovelace",
  "phone": "+14165550199",
  "reason": "a cleaning appointment",
  "organization_id": "11111111-1111-1111-1111-111111111111"
}
```

`organization_id` defaults to the Maple Grove id. Before the first call, paste the agent id and the clinic phone number id into **Prepare Outbound Call**. The phone number id starts with `phnum_` and is the id on the ElevenLabs phone number page, not the `+1` number patients dial. `provider` defaults to `twilio`. Send `"provider": "sip_trunk"` when the clinic number is a SIP trunk instead of Twilio.

The request sets dynamic variables `direction=outbound`, `patient_name`, `call_reason`, `organization_id`, and `opening_line`. The agent's first message is `{{opening_line}}`. Do not enable a first-message override. ElevenLabs rejects the dial when that override is sent and the security switch is off, and the workflow was answering with HTTP 502, which the n8n gateway replaced with a blank Bad Gateway page.

Success:

```json
{ "success": true, "conversation_id": "conv_...", "message": "Outbound call started." }
```

A failed dial still returns HTTP 200, with `{ "success": false, "error": "<the ElevenLabs message>" }`.

The phone rings after that response. The Calls page updates only after ElevenLabs posts the finished conversation.

## ElevenLabs — Inbound Initiation

**Trigger:** ElevenLabs calls `POST /webhook/elevenlabs-inbound` when someone dials the clinic number, before the agent speaks.

Importable JSON: `/n8n/workflows/elevenlabs-inbound-initiation.json`.

The agent's first message is `{{opening_line}}`. Outbound calls send that variable. An inbound phone call does not, and the dashboard placeholder is not used on a live call, so ElevenLabs ends the call in about a second. This workflow answers with the inbound values:

```json
{
  "type": "conversation_initiation_client_data",
  "dynamic_variables": {
    "organization_id": "11111111-1111-1111-1111-111111111111",
    "direction": "inbound",
    "patient_name": "there",
    "caller_name": "there",
    "call_reason": "your recent visit",
    "opening_line": "Thank you for calling Maple Grove Dental Clinic. This is the virtual receptionist. How can I help you today?"
  }
}
```

On the agent Security tab, enable **Fetch initiation client data from a webhook** and select this URL. Leave the post-call webhook on `/webhook/elevenlabs-call`.

## Knowledge — Index Document

**Trigger:** DentalFlow `POST /api/knowledge/index` calls `POST /webhook/knowledge-index` after a file is stored in Supabase.

Importable JSON: `/n8n/workflows/knowledge-index.json`.

The app hosts the file in the `knowledge-documents` bucket and sends only:

```json
{ "document_id": "uuid" }
```

n8n loads that row, downloads `storage_path`, extracts the text, chunks it, and calls OpenAI embeddings with model `text-embedding-3-small`. Each vector has 1536 numbers. Chunks are written to `document_chunks` with `organization_id` set from the document row. The document status becomes `indexed` or `failed`.

Handled failures return HTTP 200:

```json
{ "success": false, "error": "No text could be read from this file." }
```

Success:

```json
{ "success": true, "document_id": "uuid", "chunk_count": 3 }
```

## Knowledge — Search

**Trigger:** DentalFlow `POST /api/knowledge/search` calls `POST /webhook/knowledge-search`.

Importable JSON: `/n8n/workflows/knowledge-search.json`.

```json
{
  "query": "What is the cancellation policy?",
  "organization_id": "11111111-1111-1111-1111-111111111111"
}
```

n8n embeds the question with `text-embedding-3-small` and calls `match_document_chunks` with `filter_organization_id`. **Prepare Answer** keeps up to four passages with similarity of at least 0.3. **Write Answer** asks `gpt-4o-mini` for one answer that uses a single passage and copies fees, times, and names from it. **Read Answer** drops the reply when a phone number or fee in it is not in that passage, and returns the passage text instead. The response has one hit.

```json
{ "success": true, "answer": "Give at least 48 hours' notice.", "hits": [{ "id": "uuid", "document_id": "uuid", "file_name": "maple-grove-patient-faq.pdf", "category": "faqs", "content": "...", "chunk_index": 0, "similarity": 0.82 }] }
```

When no passage is close enough:

```json
{ "success": true, "answer": "The clinic documents do not say.", "hits": [] }
```

## Missed Call Recovery

**Trigger:** schedule, every minute. No webhook.

Importable JSON: `/n8n/workflows/missed-call-recovery.json`.

The workflow reads inbound `calls` with `status = missed` and `recovered_from_missed = false` from the last 24 hours. It keeps one active campaign named Missed Call Recovery and inserts a `campaign.call_scheduled` row for each missed call that does not already have one. `scheduled_at` is five minutes ahead. The payload includes `missed_call_id`.

Campaign Call Dispatcher places the call through `/webhook/outbound-call`. When that dial is accepted, DentalFlow sets `calls.recovered_from_missed` to true. A paused recovery campaign is left alone, so pausing it in the app stops new callbacks.

SMS and email are not sent. The same queue runs while DentalFlow is open, from `enqueueMissedCallRecoveries`.
