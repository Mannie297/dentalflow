# Analytics

Route: `/analytics`

Analytics breaks down call, lead, and appointment performance for the date range in the header. Filters narrow that same range. They do not pick a different set of dates.

## What you can do

- Read call volume, answer rate, missed-call rate, lead conversion, appointment conversion, no-show rate, cancellation rate, recall conversion, and estimated revenue.
- Filter by service, source, campaign, or dentist. The choices are the values that exist in the current range.
- See call activity, a daily conversion trend, lead sources, service performance, and a campaign table.

Campaign ROI is shown as a dash. Campaign cost is not stored, so a return cannot be calculated. Estimated revenue is the value of confirmed and completed appointments.

Answer rate counts calls that were completed or transferred. Missed-call rate counts calls marked missed. A failed call is neither.

Lead conversion is leads that reached booked or completed, divided by leads in the range. Appointment conversion uses qualified leads as the denominator. Qualified means the lead is no longer new and is not lost.

Recall conversion is campaign-sourced leads that booked.

## How the code works

`src/app/(app)/analytics/page.tsx` calls `useAnalyticsOverview` with the header range and the filters.

`getAnalyticsOverview` in `src/lib/services/analytics.service.ts` loads calls, leads, appointments, and campaigns, then `buildAnalyticsOverview` does the math. Demo Mode uses the mock dataset. Live Mode queries Supabase for rows inside the range and loads campaigns through `getCampaigns`.

Filters are applied after the range is loaded:

- Campaign keeps rows with that `campaign_id`.
- Source keeps leads from that source, and calls or appointments tied to those leads.
- Service keeps matching leads and appointments, and calls tied to them.
- Dentist keeps that dentist's appointments, and the calls and leads tied to those appointments.

Call activity and service performance reuse `computeCallActivity` and `computeServicePerformance` from `src/lib/services/metrics.ts`. The charts are the dashboard call chart plus `src/components/analytics/analytics-charts.tsx`.

The campaign table counts calls and appointments in the range that carry the campaign id. It does not use a guessed answer rate.
