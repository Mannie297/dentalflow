# Calls

Routes: `/calls` and `/calls/[id]`

Calls is the record of every phone conversation the clinic has saved, whether the AI receptionist handled it or a staff member logged it.

## What you can do

On the list:

- Filter the header date range.
- Switch among All, Inbound, Outbound, Missed, AI Calls, and Human Calls.
- Search by name or phone.
- See total calls, answered, missed, average duration, and the share handled by AI.
- Log a finished call by hand.

On a call:

- Read the AI summary, transcript, and call details.
- Search the transcript.
- Call the person back in Live Mode. The receptionist dials them and says it is a follow-up to the recent call.
- Book an appointment and attach it to this call.

Send SMS and Add note show a confirmation only. No text is sent, and the note is not saved.

A callback does not appear in the list the moment you press Call now. It appears after the conversation ends and the post-call workflow saves the row.

## How the code works

The list page is `src/app/(app)/calls/page.tsx`. It calls `useCalls`, which calls `getCalls` in `src/lib/services/calls.service.ts`. Filters are direction, status, whether AI handled the call, a search string, and the date range.

`logCall` writes a finished call. In Live Mode it inserts into `calls`. The calls table has no caller-name column, so the name shown in the app comes from the linked patient or from the intake payload at display time.

AI calls arrive from outside the page:

1. ElevenLabs finishes a conversation and posts to the n8n call-completed workflow.
2. That workflow posts to call intake.
3. Call intake inserts the `calls` row, including transcript JSON (`lines`, `summary`, `recommended_follow_up`) and `ai_summary`.

Staff-logged calls work in Live Mode even when the n8n call webhook is not involved.

Call back uses `placeOutboundCall` in `src/lib/services/outbound-call.service.ts`. It posts `{ patient_name, phone, reason }` to the outbound webhook. Demo Mode refuses to dial.

The detail page is `src/app/(app)/calls/[id]/page.tsx`. Booking from that page inserts an appointment with `call_id`, then sets `calls.appointment_id`.
