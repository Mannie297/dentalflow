# Maple Grove appointment booking tools

Adds two **Tools** to the existing **Maple Grove Receptionist** agent so it can book and
cancel appointments during a live call. Do not create a second agent.

The tools call the n8n workflows `elevenlabs-book-appointment.json` and
`elevenlabs-cancel-appointment.json` directly (not through the DentalFlow frontend). Both
workflows are already active. Field-level contracts: `/docs/N8N_WORKFLOWS.md`.

Use the same agent you already use for inbound and outbound calls.

## Add the tools

In the agent, go to **Tools → Add tool → Webhook** and create each of these.
Leave every other agent setting as it is (first message `{{opening_line}}`, initiation
webhook, post-call webhook, overrides off).

### `book_appointment`

| Field | Value |
|---|---|
| Name | `book_appointment` |
| Description | Books a dental appointment on the clinic calendar. Call this only after the caller has agreed to the service, the dentist, the date, and the time, and you have repeated those four back and heard a clear yes. |
| Method | `POST` |
| URL | `https://mannie333.app.n8n.cloud/webhook/book-appointment` |

Body parameters:

| Parameter | Who fills it | Type | Required | Notes |
|---|---|---|---|---|
| `organization_id` | Constant `{{organization_id}}` | string | yes | Already set by the initiation webhook. Do not ask the caller. |
| `patient_name` | LLM | string | yes | Full name, as the caller says it. |
| `phone` | LLM | string | yes | Digits, at least 7. Inbound: `{{system__caller_id}}` unless they give a different callback number. Outbound: `{{system__called_number}}` unless they give a different callback number. |
| `service` | LLM | string | yes | One of the values below. Send the value, not the spoken name. |
| `dentist_name` | LLM | string | yes | One of the three names below, copied exactly. |
| `starts_at` | LLM | string | yes | ISO 8601 in America/Toronto, for example `2026-11-20T14:00:00-05:00`. Never send a time the caller did not agree to. |
| `duration_minutes` | LLM | number | no | Omit unless the caller asked for a specific length. The workflow picks 30–60 minutes from the service. |
| `notes` | LLM | string | no | Anything the front desk should know. Omit when there is nothing. |

`service` values:

| Say this | Send this |
|---|---|
| General Cleaning | `general_cleaning` |
| Emergency Dental | `emergency_dental` |
| Dental Exam | `dental_exam` |
| Dental Implants | `implants` |
| Invisalign | `invisalign` |
| Whitening | `whitening` |
| Crowns | `crowns` |
| Root Canal | `root_canal` |
| Children's Dentistry | `childrens_dentistry` |
| Other | `other` |

`dentist_name` must be exactly one of:

- `Dr. Sarah Chen`
- `Dr. Amrit Bhandal`
- `Dr. Michael Wong`

`Dr. Chen` and "any dentist" both fail the schedule check. If the caller has no preference, ask which of these three, then book that name.

### `cancel_appointment`

| Field | Value |
|---|---|
| Name | `cancel_appointment` |
| Description | Cancels the caller's upcoming appointment. Call this only after they confirm they want that visit cancelled. This does not reschedule. |
| Method | `POST` |
| URL | `https://mannie333.app.n8n.cloud/webhook/cancel-appointment` |

| Parameter | Who fills it | Type | Required | Notes |
|---|---|---|---|---|
| `organization_id` | Constant `{{organization_id}}` | string | yes | Same constant as booking. |
| `phone` | LLM | string | yes | Same number rules as `book_appointment`. Do not send `appointment_id`. |
| `date` | LLM | string | no | `YYYY-MM-DD` in America/Toronto. Send it only when they have more than one upcoming visit and name the day. |

## System prompt

On the same agent, delete any sentence that says the front desk will confirm the appointment time, or that the caller must phone the clinic to cancel. The outbound paragraph in `outbound-receptionist.md` is already updated; if the live prompt still has the old sentence, replace it with the text in that file.

Then append this:

```text
You book and cancel appointments with the book_appointment and cancel_appointment tools. The clinic is in America/Toronto. Hours are Monday to Thursday 8:00 a.m. to 6:00 p.m., Friday 8:00 a.m. to 5:00 p.m., Saturday 9:00 a.m. to 1:00 p.m. Closed Sunday. Do not offer a time outside those hours.

Before book_appointment, collect the caller's full name and confirm the phone number. On an inbound call the number is {{system__caller_id}} unless they give a different one. On an outbound call the number is {{system__called_number}} unless they give a different one. Ask which service they want and which dentist: Dr. Sarah Chen, Dr. Amrit Bhandal, or Dr. Michael Wong. Repeat the service, dentist, date, and time, and wait for a clear yes. Then call the tool. Send service as the tool value (general_cleaning, emergency_dental, dental_exam, implants, invisalign, whitening, crowns, root_canal, childrens_dentistry, other) and dentist_name as one of those three full names. starts_at is ISO 8601 with the Toronto offset.

If book_appointment returns success true, tell them they are booked and repeat the dentist, service, date, and time. If it returns success false, read the error, and if the time is taken ask for a different time. Never say an appointment is booked when success is not true.

Before cancel_appointment, confirm they want the visit cancelled. If they might have more than one upcoming visit, ask which date and pass that date as YYYY-MM-DD. If the tool returns success false, say you could not find a matching upcoming appointment and offer the front desk. Never say a visit is cancelled when success is not true.

To move a visit, cancel it and then book the new time. Do not invent a reschedule tool. Do not diagnose, prescribe, or quote a price.
```
