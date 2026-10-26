# Reports

Route: `/reports`

Reports builds a written summary for a period you choose on this page. The header date range does not change the report.

## What you can do

- Choose Daily, Weekly, or Monthly.
- Daily is today. Weekly is the last 7 days. Monthly is the last 30 days.
- Generate the report.
- Download a one-page PDF.
- Email the report. That opens your mail program with the subject and summary filled in. DentalFlow does not send the email.

Switching period clears the report on screen so the summary cannot belong to a different period than the tab you are looking at.

The summary states how many calls the clinic received, how many qualified inquiries it generated, how many appointments it booked, and the estimated revenue of those appointments.

Key opportunities are added only when the data supports them:

- Missed calls that fell on a Monday.
- Implant leads in the period that are not booked, completed, or lost.
- Patients who currently need a follow-up or are overdue for recall. That count is the current list, not only people created inside the period.
- Missed calls already marked recovered.

If none of those are present, the report says no urgent opportunities showed up.

## How the code works

`src/app/(app)/reports/page.tsx` turns the selected period into a date range with `resolveDateRange`, then calls `useGenerateReport`.

`generateReport` in `src/lib/services/reports.service.ts` loads calls, leads, and appointments for that range, plus a count of patients whose status is `needs_follow_up` or `overdue_recall`. Demo Mode filters the mock dataset. Live Mode queries Supabase.

Qualified inquiries are leads that are not still new and not lost. Appointments booked are confirmed or completed. Estimated revenue is the sum of those appointments' estimated values.

The PDF is built in the browser by `buildReportPdf` in `src/lib/reports/report-pdf.ts`. It writes a single Helvetica page and downloads `dentalflow-<period>-report.pdf`. There is no PDF service and no scheduled daily email.
