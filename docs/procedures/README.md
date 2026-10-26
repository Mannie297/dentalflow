# Working procedures

These are the operating procedures for the n8n integrations that are live for Maple Grove Dental Clinic. The technical field lists stay in `/docs/N8N_WORKFLOWS.md`. Import and credential setup stays in `/n8n/README.md`.

Production webhooks answer only while the matching workflow is **Active** in n8n. The host is `https://mannie333.app.n8n.cloud`.

| Procedure | What starts it | n8n workflows |
|---|---|---|
| [Lead intake](lead-intake.md) | A form or the app posts a new inquiry | CORE — Lead Intake, then AI — Lead Qualification |
| [Lead qualification](lead-qualification.md) | Lead intake, after the lead row exists | AI — Lead Qualification |
| [Inbound calls](inbound-calls.md) | A person dials the clinic number | ElevenLabs — Inbound Initiation, ElevenLabs — Call Completed, CORE — Call Intake |
| [Outbound calls](outbound-calls.md) | A post to `/webhook/outbound-call` | ElevenLabs — Outbound Call, ElevenLabs — Call Completed, CORE — Call Intake |
| [Call intake](call-intake.md) | The post-call workflow, or a direct post | CORE — Call Intake |
| [Knowledge base](knowledge-base.md) | An upload, re-index, or search on the Knowledge Base page | Knowledge — Index Document, Knowledge — Search |
| [Missed call recovery](missed-call-recovery.md) | An inbound call is saved as missed | Missed Call Recovery, then Campaign Call Dispatcher |

AI insights are calculated in DentalFlow from the last 30 days of calls, leads, and appointments. They do not use an n8n workflow.

The original spec also names appointment reminders, appointment booking, recall campaigns, treatment follow-up, review requests, and daily reports. Those do not have n8n workflows yet, so they have no procedure.

Every workflow that writes to Supabase uses the **Supabase account** credential and sets `organization_id` itself. The Maple Grove id is `11111111-1111-1111-1111-111111111111`.
