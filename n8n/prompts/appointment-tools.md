# Maple Grove appointment booking tools

Adds two **Tools** to the existing **Maple Grove Receptionist** agent so it can book and
cancel appointments during a live call, instead of only telling the caller "the front desk
will confirm a time." Do not create a second agent.

The tools call the n8n workflows `elevenlabs-book-appointment.json` and
`elevenlabs-cancel-appointment.json` directly (not through the DentalFlow frontend). Import
and activate both first — see `/n8n/README.md`. Field-level contracts: `/docs/N8N_WORKFLOWS.md`.

## Add the tools

In the agent, go to **Tools → Add tool → Webhook** and create each of these.

### `book_appointment`

| Field | Value |
|---|---|
| Name | `book_appointment` |
| Description | Books a dental appointment. Call this only after you have confirmed the patient's full name, phone number, the service they want, which dentist (or "any available dentist" is not supported — ask the clinic's roster), and a specific date and time with the caller. |
| Method | `POST` |
| URL | `https://mannie333.app.n8n.cloud/webhook/book-appointment` |
| Body type | JSON |

Body schema (add each as a tool parameter so the model fills it in):

```json
{
  "organization_id": "{{organization_id}}",
  "patient_name": "",
  "phone": "",
  "service": "",
  "dentist_name": "",
  "starts_at": "",
  "duration_minutes": 30,
  "notes": ""
}
```

| Parameter | Type | Required | Notes |
|---|---|---|---|
| `patient_name` | string | yes | Full name as the caller gives it. |
| `phone` | string | yes | The best callback number, with country code. |
| `service` | string | yes | One of: `general_cleaning`, `emergency_dental`, `dental_exam`, `implants`, `invisalign`, `whitening`, `crowns`, `root_canal`, `childrens_dentistry`, `other`. |
| `dentist_name` | string | yes | Must exactly match a name on the clinic's dentist roster (ask the clinic which names to use here). |
| `starts_at` | string | yes | ISO 8601 date-time in the clinic's time zone, e.g. `2026-11-20T14:00:00-05:00`. Never guess a time the caller didn't agree to. |
| `duration_minutes` | number | no | Defaults by service (30–60 minutes) if omitted. |
| `notes` | string | no | Anything the caller mentioned that the front desk should know. |

`organization_id` is a dynamic variable already set by the inbound/outbound initiation workflow — leave it as `{{organization_id}}` and do not ask the caller for it.

### `cancel_appointment`

| Field | Value |
|---|---|
| Name | `cancel_appointment` |
| Description | Cancels the caller's upcoming appointment. Call this after the caller confirms they want to cancel (not reschedule — this tool only cancels). |
| Method | `POST` |
| URL | `https://mannie333.app.n8n.cloud/webhook/cancel-appointment` |
| Body type | JSON |

```json
{
  "organization_id": "{{organization_id}}",
  "phone": "",
  "date": ""
}
```

| Parameter | Type | Required | Notes |
|---|---|---|---|
| `phone` | string | yes | The caller's phone number. Used to find their account and their soonest upcoming appointment. |
| `date` | string | no | `YYYY-MM-DD`. Only needed if the caller has more than one upcoming appointment and says which date to cancel. |

## System prompt addition

Append this to the end of the current system prompt:

```text
You can book and cancel appointments directly using the book_appointment and cancel_appointment tools. Before calling book_appointment, repeat the service, dentist, date, and time back to the caller and get a clear yes. If book_appointment returns success: false (for example the time is already taken), tell the caller and ask for a different time -- do not say the appointment is booked. Before calling cancel_appointment, confirm which appointment the caller means if you are not sure. If it returns success: false, say you could not find a matching appointment and offer to transfer to the front desk. Never tell a caller an appointment is booked or cancelled unless the tool result said success: true.
```

## Known caveat

These tools call n8n directly from ElevenLabs -- they do not go through the DentalFlow frontend, so a booking made this way appears in DentalFlow (and on the clinic's Google Calendar) without anyone touching the app. That is the intended behavior: the voice agent and the Book Appointment dialog in DentalFlow both write through the same two n8n workflows when `NEXT_PUBLIC_N8N_BOOK_APPOINTMENT_WEBHOOK_URL` / `..._CANCEL_...` are set in the frontend's env, so every appointment ends up on one calendar regardless of how it was booked.
