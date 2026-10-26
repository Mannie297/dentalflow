# Appointments

Route: `/appointments`

Appointments is the clinic schedule inside DentalFlow. It is not Google Calendar. Nothing on this page writes to an external calendar.

## What you can do

- Switch between a list and a month calendar.
- The list follows the header date range. The calendar follows the month you are viewing.
- Filter by dentist, service, status, and new or existing patient.
- Search by patient name.
- See counts for requested, confirmed, completed, cancelled, and no-show.
- Open a visit for its details.
- Book an appointment.

Statuses are requested, confirmed, completed, cancelled, and no-show.

## How the code works

`src/app/(app)/appointments/page.tsx` uses `useAppointments` and `getAppointments` in `src/lib/services/appointments.service.ts`.

The list query uses the header range. The calendar query uses the visible month grid from `getCalendarGridRange`, so changing the header range does not move the calendar month.

A second query loads the same period without the status filter. That query feeds the count strip, so the counts stay stable while you filter the table.

Booking is `BookAppointmentDialog`. Creating a visit inserts an `appointments` row. When the booking starts from a call, the insert includes `call_id` and the call row is updated with `appointment_id`.

Dentists shown in the filter come from the clinic list used by the app. Live rows store `dentist_name` on the appointment.
