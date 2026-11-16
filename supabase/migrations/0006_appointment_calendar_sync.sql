-- Google Calendar sync for appointments.
-- `calendar_event_id` holds the id of the Google Calendar event created for this
-- appointment (by either the in-app booking dialog or the ElevenLabs voice agent),
-- both of which go through the n8n "ElevenLabs — Book/Cancel Appointment" workflows
-- when NEXT_PUBLIC_N8N_BOOK_APPOINTMENT_WEBHOOK_URL / ..._CANCEL_... are configured.
-- Null means the appointment was created directly (no webhook configured, or Demo
-- Mode) and has no corresponding calendar event. See /docs/N8N_WORKFLOWS.md.

alter table public.appointments
  add column calendar_event_id text;
