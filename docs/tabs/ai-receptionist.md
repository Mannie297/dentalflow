# AI Receptionist

Route: `/ai-receptionist`

This page shows how the receptionist did today and stores the rules the clinic wants it to follow. Saving the page updates DentalFlow. It does not rewrite the ElevenLabs phone agent.

## What you can do

- See today's counts: calls, calls handled, appointments booked, average duration, and booking conversion. "Today" starts at local midnight.
- See today's call list.
- Turn the in-app status on or off. The clinic phone line still follows the ElevenLabs agent.
- Set business hours and what should happen after hours.
- Set the transfer number.
- Edit the clinic name, address, and phone.
- Edit the rules for emergencies, services, insurance, payment, financing, cancellation, booking, transfer, and pricing.

Blank rule fields mean the clinic has not provided that information. The receptionist is not supposed to invent prices, insurance coverage, or a diagnosis.

After-hours choices are: the AI takes a message, ask the caller to phone back during business hours, or follow the emergency policy and offer the transfer number.

## How the code works

The page is `src/app/(app)/ai-receptionist/page.tsx`.

Today's stats come from `src/lib/services/ai-receptionist.service.ts`. It counts today's calls. Handled means AI-handled and not missed or failed. Booked means a booked outcome among the handled calls. The online badge follows the saved `enabled` flag.

Rules and hours are saved as JSON in `prompt_templates`, under the name `ai_receptionist_config`. Clinic name, address, and phone are saved on `organizations`. Both writes go through `saveReceptionistConfiguration` in `src/lib/services/settings.service.ts`.

`prompt_templates` has no default organization trigger, so the insert sets `organization_id` explicitly. The Settings page saves the same clinic record and the same template.

The live phone agent is configured in ElevenLabs and n8n, not by this form. Inbound calls get their opening line from the inbound initiation webhook. Outbound calls send their own dynamic variables. See `docs/procedures/inbound-calls.md` and `docs/procedures/outbound-calls.md`.
