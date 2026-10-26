# Dashboard

Route: `/dashboard`

The dashboard is the clinic's front page. It summarizes calls, leads, and appointments for the date range chosen in the header, and it compares that range with the period just before it.

## What you can do

- Read the main counts: total calls, missed calls, new leads, appointments booked, conversion rate, and estimated revenue.
- See call activity over time, with inbound, outbound, missed, and answered calls.
- Follow the appointment funnel and the lead funnel.
- Review service performance, missed-call recovery, upcoming appointments, recent activity, and campaign results.
- Open a related tab from a count. Calls, leads, and appointments each have a link.

Live Mode requires a signed-in clinic user. If Live Mode is on and nobody is signed in, the page asks you to sign in.

## How the code works

`src/app/(app)/dashboard/page.tsx` loads one view model through `useDashboardMetrics`. That hook calls `getDashboardMetrics` in `src/lib/services/dashboard.service.ts`.

The service picks the data source at runtime:

- Demo Mode reads the in-memory mock dataset.
- Live Mode reads `calls`, `leads`, and `appointments` from Supabase for the current range and the previous range in one query per table.

The numbers themselves are pure functions in `src/lib/services/metrics.ts`. The same formulas run on mock data and live data.

- Appointments booked are confirmed or completed visits. Requested, cancelled, and no-show visits are not counted as booked.
- Conversion rate is leads that reached booked or completed, divided by leads created in the range.
- Estimated revenue is the value of those booked appointments, plus a flat estimate for each recovered missed call.

Recent activity comes from `automation_events`, excluding scheduled campaign dials so the feed is not flooded by the call queue. Campaign rows come from `getCampaignPerformance`.

Missed-call recovery counts missed calls in the header date range. A missed call is recovered when its callback has been placed. Live Mode queues that callback on the Missed Call Recovery campaign: one AI voice call, five minutes later, for an inbound miss from the last 24 hours. Pausing that campaign stops new callbacks.

AI insights in Live Mode come from `buildClinicInsights`. The panel reads the last 30 days of calls, leads, and appointments and states only what those rows support, such as a Monday missed-call gap or an open implant inquiry. Demo Mode still shows the sample insights.

The header date range lives in the date-range store. Changing it refetches the dashboard.
