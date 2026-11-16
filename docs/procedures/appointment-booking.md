# Appointment booking

Books and cancels appointments on the clinic's Google Calendar. The same two n8n workflows are called both by the ElevenLabs voice agent on a live call and by DentalFlow's own Appointments page — one calendar, no matter who booked it.

| Order | Workflow | Webhook |
|---|---|---|
| 1 | ElevenLabs — Book Appointment | `POST /webhook/book-appointment` |
| 2 | ElevenLabs — Cancel Appointment | `POST /webhook/cancel-appointment` |

Field-level spec: [docs/N8N_WORKFLOWS.md](../N8N_WORKFLOWS.md). Agent tool setup: `/n8n/prompts/appointment-tools.md`.

## What has to be running

- **ElevenLabs — Book Appointment** and **ElevenLabs — Cancel Appointment** are both Active in n8n.
- The **Supabase account** and **Google Calendar account** credentials are attached to every node that needs them.
- `CALENDAR_ID` is pasted into the **Validate & Normalize** node of both workflows (the clinic's Google Calendar id).
- The frontend's `.env.local` has `NEXT_PUBLIC_N8N_BOOK_APPOINTMENT_WEBHOOK_URL` and `NEXT_PUBLIC_N8N_CANCEL_APPOINTMENT_WEBHOOK_URL` set to the production webhook URLs, if DentalFlow's own Book Appointment dialog and Appointments page should go through the same calendar sync. Without those set, the app still books/cancels appointments — it just writes straight to Supabase, with no Google Calendar event.
- The ElevenLabs agent has the `book_appointment` and `cancel_appointment` tools added (`/n8n/prompts/appointment-tools.md`), if the voice agent should be able to use them on a call.

## What happens — booking

1. The agent (or the app) posts the patient's name, phone, service, dentist, and start time.
2. The workflow checks that dentist's schedule for an overlapping appointment. A conflict returns a controlled failure — no booking happens, and the agent can offer a different time.
3. The patient is found by phone, or created if this is their first visit.
4. A Google Calendar event is created on the clinic's calendar. If that call fails, nothing is written to DentalFlow — a caller is never told "you're booked" for a time that isn't actually on the calendar.
5. The appointment is written to Supabase with `status = "confirmed"` and the new event's id stored as `calendar_event_id`.
6. `appointment.confirmed` is logged to `automation_events`.

## What happens — cancelling

1. The agent (or the app) posts either the appointment's id, or the caller's phone number (plus an optional date, if they have more than one upcoming visit).
2. The workflow finds the matching appointment. No match returns a controlled failure.
3. If the appointment has a `calendar_event_id`, that Google Calendar event is deleted. A missing or already-deleted event does not block the cancellation — Supabase is still updated.
4. The appointment's status is set to `cancelled`. `appointment.cancelled` is logged to `automation_events`.

## Where to look

The webhook response is the first check: `success: true` with the full `appointment` row, including `calendar_event_id` on a booking. The clinic's Google Calendar should show the new or removed event within a few seconds. In DentalFlow, the Appointments page reflects the change on its next refresh (the Book Appointment dialog and the status dropdown both trigger a refetch already).

## When it fails

- `"Set CALENDAR_ID in Validate & Normalize..."` — the constant was never pasted in after import. Open the node in both workflows and set it.
- `"That time is already booked for <dentist>..."` — a real conflict. Offer a different time; this is not a bug.
- `"Google Calendar did not create the event (HTTP ...)"` — the **Google Calendar account** credential likely needs reconnecting (OAuth tokens expire), or `CALENDAR_ID` doesn't exist or isn't shared with that account with edit access.
- `"No upcoming appointment was found to cancel."` — the phone number didn't match a patient, or they have no `requested`/`confirmed` appointment in the future. Check the number and try again, or use the appointment id instead.

## What this does not do

It does not reschedule an appointment (no "move this to a different time" tool) — cancel and re-book instead. It does not send a calendar invite email to the patient; the event is created on the clinic's calendar only.
