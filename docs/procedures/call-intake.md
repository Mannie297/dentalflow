# Call intake

This is the shared filing step for every phone call that should appear in DentalFlow. Inbound and outbound ElevenLabs calls both end here. A staff member or a test post can call it directly. The workflow name is **CORE — Call Intake**.

## When it runs

`POST https://mannie333.app.n8n.cloud/webhook/call-intake`.

**ElevenLabs — Call Completed** posts here after a real call. The Calls page also posts here when Live Mode is on and `NEXT_PUBLIC_N8N_CALL_WEBHOOK_URL` is this URL. If that variable is unset, **Log call** writes the patient and the call from the signed-in browser session instead, and this workflow does not run.

The workflow waits for the Supabase writes, then answers.

## What you send

`caller_name` is required. `phone` needs at least 7 digits. `direction` is `inbound` or `outbound`. `organization_id` is required on this webhook because n8n inserts with the service role and must set the clinic itself.

```json
{
  "organization_id": "11111111-1111-1111-1111-111111111111",
  "direction": "inbound",
  "caller_name": "Ada Lovelace",
  "phone": "+14165550199",
  "status": "completed",
  "intent": "appointment_booking",
  "outcome": "booked",
  "duration_seconds": 120,
  "started_at": "2026-10-24T15:00:00.000Z",
  "notes": "Asked to book a cleaning.",
  "ai_handled": true,
  "transcript": {
    "lines": [{ "speaker": "ai", "timestamp_seconds": 0, "text": "Thank you for calling." }],
    "summary": "Asked to book a cleaning.",
    "recommended_follow_up": null
  }
}
```

`status` defaults to `completed`. Allowed intents are `new_patient_inquiry`, `existing_patient`, `appointment_booking`, `appointment_reschedule`, `emergency`, `billing_insurance`, `general_question`, and `other`. Allowed outcomes are `booked`, `callback_requested`, `information_provided`, `transferred_to_staff`, `voicemail`, `no_action`, and `lost`. Validation matches `validateCallIntakeInput()`.

## How the process works

1. **Validate Request** rejects a bad payload with HTTP 400 and `{ "success": false, "error": "..." }`.
2. **Normalize Call** trims fields, forces duration to 0 and outcome to empty when status is `missed` or `failed`, and keeps `transcript` only when it has a `lines` array. `notes` become `ai_summary`. `ai_handled` is stored only when it is true.
3. **Find Patient** looks up `patients` by `organization_id` and phone.
4. If none exists, **Create Patient** inserts `first_name` and `last_name` from `caller_name`, the phone, `patient_type` `new`, and `lead_source` `inbound_call` or `outbound_call`. The `calls` table has no caller-name column. The name on the Calls page comes from this patient.
5. **Create Call** inserts the call linked to that patient: direction, status, phone, start time, duration, intent, outcome, `ai_handled`, `ai_summary`, and `transcript`.
6. **Log call event** writes one event. `missed` or `failed` emits `call.missed`. Every other status emits `call.completed`. It does not also emit `call.started`. The payload includes `patient_name` and `direction` so Recent Activity can name the call.
7. **Respond: Success** returns `{ "success": true, "call_id": "...", "message": "Call received." }`.

## Where to look

The `call_id` in the response is the row on `/calls`. The detail page shows **AI Call Summary** from `ai_summary` or `transcript.summary`, and **Call Transcript** from `transcript.lines`. An empty `lines` array shows "No transcript available for this call."

`started_at` is stored as UTC and shown in Eastern Time. A timestamp built from local time as if it were UTC lands about four hours early and can fall outside Last 30 days.

## When it fails

- HTTP 400 is validation. The call was not written.
- Find Patient, Create Patient, Create Call, and Log call event use the **Supabase account** credential. An execution error on those nodes means the credential or the project URL on the node.
- A successful response with no visible row is usually the date filter. Confirm `started_at` is inside the range selected on the Calls page.
