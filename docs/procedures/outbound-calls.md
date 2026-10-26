# Outbound calls

n8n asks ElevenLabs to dial a patient from the clinic number. The same agent speaks. When the call ends, the inbound post-call path files it, marked outbound.

| Order | Workflow | Webhook |
|---|---|---|
| 1 | ElevenLabs — Outbound Call | `POST /webhook/outbound-call` |
| 2 | The patient answers and the agent speaks. | |
| 3 | ElevenLabs — Call Completed | `POST /webhook/elevenlabs-call` |
| 4 | CORE — Call Intake | `POST /webhook/call-intake` |

Filing is [call intake](call-intake.md). The agent setup is `/n8n/prompts/outbound-receptionist.md`.

## When it runs

**Call back** on a call detail page posts JSON to `https://mannie333.app.n8n.cloud/webhook/outbound-call` when Live Mode is on and `NEXT_PUBLIC_N8N_OUTBOUND_WEBHOOK_URL` is that address. The workflow **ElevenLabs — Outbound Call** must be Active.

```json
{
  "patient_name": "Ada Lovelace",
  "phone": "+14165550199",
  "reason": "a cleaning appointment"
}
```

`organization_id` is optional and defaults to Maple Grove. `phone` is the patient to dial, in E.164. It is not the clinic number.

## How the process works

1. **Prepare Outbound Call** reads `patient_name`, `phone`, and `reason`. It requires the constants pasted in that node:
   - `AGENT_ID` — the Maple Grove Receptionist agent id
   - `AGENT_PHONE_NUMBER_ID` — the ElevenLabs id that starts with `phnum_`, copied from the phone number page. The clinic's `+1` number is rejected.
   - `PROVIDER` — `twilio`, unless the number is a SIP trunk, in which case it is `sip_trunk`
2. **Ready?** stops with HTTP 400 and the validation message when any of those are missing.
3. **Place Outbound Call** posts to ElevenLabs with header `xi-api-key` from the **ElevenLabs API** credential. The body includes `agent_id`, `agent_phone_number_id`, `to_number`, and dynamic variables `direction=outbound`, `patient_name`, `caller_name`, `call_reason`, `organization_id`, and `opening_line`. The opening line names the patient and the reason. The first-message override stays off. The agent speaks `{{opening_line}}`.
4. **Read ElevenLabs Response** treats a 2xx reply with `success` not false as a started call. Any other result is returned as HTTP 200 with `{ "success": false, "error": "<ElevenLabs message>" }` so the real reason is visible.
5. A started call returns `{ "success": true, "conversation_id": "conv_...", "message": "Outbound call started." }`. The phone rings after that. The Calls page is still empty.
6. When the conversation ends, ElevenLabs posts to `/webhook/elevenlabs-call`. **Map ElevenLabs Call** marks the call outbound because `direction` is `outbound` or the phone metadata says outbound. The patient name falls back to `patient_name` when data collection did not capture one. `ai_handled` is true, and the summary and transcript are attached.
7. **Post to Call Intake** files the row through [call intake](call-intake.md).

An outbound call that never connects can arrive as `call_initiation_failure`. That is stored as a missed outbound call.

## Where to look

The webhook response is the first check: `success` true and a `conversation_id`. After the patient hangs up, Calls shows an Outbound, AI-handled row for that phone number, with the summary and transcript on the detail page. Recent Activity shows the outbound call.

## When it fails

- `"AGENT_PHONE_NUMBER_ID must be the ElevenLabs phone number id"` means the `+1` number was pasted. Replace it with `phnum_...` in **Prepare Outbound Call** and save. Do not re-import the workflow unless you paste the agent id and phone number id back in and reattach the **ElevenLabs API** credential.
- `"Document with id +1... not found"` is the same mistake, from a copy of the workflow that has not been updated.
- `success: false` with an ElevenLabs message is the dial itself. A SIP number needs `PROVIDER` set to `sip_trunk` in **Prepare Outbound Call**.
- The call connects and the Calls page stays empty: open **ElevenLabs — Call Completed**, then **CORE — Call Intake**. The post-call webhook on the agent must still be `/webhook/elevenlabs-call`.
