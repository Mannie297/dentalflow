# Missed call recovery

An inbound call saved with status `missed` gets one AI voice callback. Nothing is sent by SMS or email.

## What has to be running

- **Missed Call Recovery** is active in n8n (`n8n/workflows/missed-call-recovery.json`).
- **Campaign Call Dispatcher** is active, and **ElevenLabs — Outbound Call** is active.
- The Supabase account credential is attached to the Supabase nodes.

DentalFlow also queues the same callback while the app is open in Live Mode. The n8n workflow covers the time the browser is closed.

## What happens

1. A missed inbound call from the last 24 hours is still `recovered_from_missed = false`.
2. The workflow finds or creates the **Missed Call Recovery** campaign and adds one `campaign.call_scheduled` row, due in five minutes. The payload stores `missed_call_id`.
3. The dispatcher places that call through the outbound webhook.
4. When the dial is accepted, the missed call is marked recovered. The dashboard recovery widget counts it.

A number with fewer than 10 digits is skipped. A missed call that already has a recovery row is not queued again.

## How to stop it

Pause the Missed Call Recovery campaign in DentalFlow. A paused campaign does not receive new callbacks, and the dispatcher does not dial a paused campaign.

## What this does not do

It does not text or email the caller. It does not book the visit by itself. Booking still happens from the call or the Appointments page.
