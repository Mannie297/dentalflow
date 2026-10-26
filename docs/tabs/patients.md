# Patients

Routes: `/patients` and `/patients/[id]`

Patients is the clinic's list of people, plus a profile for one person.

## What you can do

On the list:

- Search by name or phone.
- Filter by new or existing.
- Segment by active, needs follow-up, inactive, overdue recall, or high value.
- See totals for those groups.
- Open a profile. Last appointment and next appointment show when the person has a non-cancelled visit.

On a profile:

- Read contact details, notes, and an AI summary when one exists.
- See call history, appointments, leads, and campaign history.
- Call the patient in Live Mode, after a confirmation.
- Book an appointment for them.

Campaign history appears when a call, lead, or appointment is tagged with a campaign. A scheduled dial that has not been linked to a call row does not show here yet.

## How the code works

`src/app/(app)/patients/page.tsx` uses `usePatients` and `getPatients` in `src/lib/services/patients.service.ts`.

Live Mode reads the `patients` table through the signed-in user's Supabase session. The database stores `first_name` and `last_name`. The app type uses `full_name`, and the mapper joins those names.

`last_appointment_at` and `next_appointment_at` are often empty on the patient row. `getPatients` and `getPatient` fill them from non-cancelled appointments: a past visit becomes the last appointment, and a future visit becomes the next one. Booking an appointment does not write those two columns.

The profile page is `src/app/(app)/patients/[id]/page.tsx`. `getPatient` also loads that person's calls, leads, appointments, and any campaigns those rows point at. A campaign is marked booked when a non-cancelled appointment shares its id, and contacted when a call does.

High value means the patient is flagged `is_high_value`, or their estimated value is at least $2,000.
