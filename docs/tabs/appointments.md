# Appointments

Route: `/appointments`

Appointments is the clinic schedule inside DentalFlow. By default, nothing on this page writes to an external calendar. When `NEXT_PUBLIC_N8N_BOOK_APPOINTMENT_WEBHOOK_URL` / `..._CANCEL_...` are set, booking and cancelling here also create/delete the matching event on the clinic's Google Calendar — see [docs/procedures/appointment-booking.md](../procedures/appointment-booking.md). Without those set, this page behaves exactly as before: a DentalFlow-only schedule.

## What you can do

- Switch between a list and a month calendar.
- The list starts at the header date range and keeps upcoming visits for the next year. Today, yesterday, and a custom range stay inside the dates you pick. The calendar follows the month you are viewing.
- Filter by dentist, service, status, and new or existing patient.
- Search by patient name.
- See counts for requested, confirmed, completed, cancelled, and no-show.
- Open a visit for its details, including the phone number that called and a link to that call's transcript.
- Book an appointment.

Statuses are requested, confirmed, completed, cancelled, and no-show.

## How the code works

`src/app/(app)/appointments/page.tsx` uses `useAppointments` and `getAppointments` in `src/lib/services/appointments.service.ts`.

The list query uses `appointmentListRange`, so a last-30-days header still includes a visit booked for next week. The calendar query uses the visible month grid from `getCalendarGridRange`, so changing the header range does not move the calendar month.

A second query loads the same period without the status filter. That query feeds the count strip, so the counts stay stable while you filter the table.

Booking is `BookAppointmentDialog`. Creating a visit inserts an `appointments` row. When the booking starts from a call, the insert includes `call_id` and the call row is updated with `appointment_id`.

Dentists shown in the filter come from the clinic list used by the app. Live rows store `dentist_name` on the appointment.

Cancelling (from the appointment detail sheet's status dropdown) and booking both call `src/lib/services/appointments.service.ts`, which routes through n8n "ElevenLabs — Book/Cancel Appointment" when the matching webhook env var is set, instead of writing to Supabase directly — this is the same path the ElevenLabs voice agent's booking tools use, so every appointment ends up on one calendar regardless of whether a patient called in or staff booked it in the app.
