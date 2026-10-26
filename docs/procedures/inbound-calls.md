# Inbound calls

A person calls the Maple Grove clinic number. ElevenLabs speaks as the receptionist. After the call, n8n files the patient, the call, the summary, and the transcript in Supabase. The Calls page then shows the row.

Three workflows do this, in order. All three must be Active.

| Order | Workflow | Webhook |
|---|---|---|
| 1 | ElevenLabs — Inbound Initiation | `POST /webhook/elevenlabs-inbound` |
| 2 | The ElevenLabs agent talks. No n8n workflow runs during the conversation. | |
| 3 | ElevenLabs — Call Completed | `POST /webhook/elevenlabs-call` |
| 4 | CORE — Call Intake | `POST /webhook/call-intake` |

Call filing is the shared procedure in [call intake](call-intake.md). Agent fields are in `/n8n/prompts/outbound-receptionist.md`.

## How the process works

1. The caller dials the clinic number assigned to the Maple Grove Receptionist agent.
2. Before anyone speaks, ElevenLabs asks the initiation webhook for conversation data. **Inbound Variables** answers with `type` `conversation_initiation_client_data` and these variables:
   - `organization_id` — Maple Grove, `11111111-1111-1111-1111-111111111111`
   - `direction` — `inbound`
   - `patient_name` and `caller_name` — `there`
   - `call_reason` — `your recent visit`
   - `opening_line` — `Thank you for calling Maple Grove Dental Clinic. This is the virtual receptionist. How can I help you today?`
3. The agent's first message is `{{opening_line}}`, so the caller hears that greeting. The system prompt reads `{{direction}}` and treats the call as an incoming call. Dashboard placeholders are for the agent preview only. A live inbound call uses this webhook.
4. The agent collects the caller's name, intent, and outcome through its data collection fields (`caller_name`, `intent`, `outcome`). Intent and outcome must be one of the values call intake accepts, or they are stored as empty.
5. When the call ends, ElevenLabs posts `post_call_transcription` to `/webhook/elevenlabs-call`. That workflow answers immediately with `{"message":"Workflow was started"}` so ElevenLabs does not disable the webhook. Filing continues after that reply.
6. **Map ElevenLabs Call** reads the caller's number from `metadata.phone_call.external_number`, the direction from the phone metadata or the `direction` variable, and the name from data collection, then `patient_name`, then `caller_name`. It builds transcript lines (`agent` becomes speaker `ai`, anyone else becomes `patient`) and stores the ElevenLabs summary on the call. `ai_handled` is true.
7. **Has Phone?** stops when there is no phone number. A dashboard test chat has no phone, so it never becomes a call row.
8. **Post to Call Intake** sends the mapped call to `/webhook/call-intake`. From there, [call intake](call-intake.md) creates or reuses the patient and inserts the call.
9. A `call_initiation_failure` event is filed as a missed call instead of a completed one. Audio-only events are ignored.

## Where to look

Calls, Live Mode, Last 30 days. The new row is Inbound, handled by AI, at the time ElevenLabs reports. Open the row for **AI Call Summary** and **Call Transcript**. Recent Activity on the dashboard shows the completed or missed call.

The call appears only after the post-call webhook finishes. Answering the phone does not create the row by itself.

## When it fails

- The call drops about a second after connect when initiation did not return `opening_line`. Confirm **Fetch initiation client data from a webhook** on the agent points at `/webhook/elevenlabs-inbound`, and that this workflow is Active. The post-call webhook stays on `/webhook/elevenlabs-call`.
- No row after a real call usually means Call Completed did not run, the execution stopped at **Has Phone?**, or Call Intake rejected the payload. Open the n8n execution for **ElevenLabs — Call Completed** and then **CORE — Call Intake**.
- A row with a summary and no transcript means ElevenLabs sent `transcript_summary` and no turns. The detail page says no transcript until turns are stored.
