# Campaigns

Routes: `/campaigns`, `/campaigns/new`, and `/campaigns/[id]`

Campaigns schedules outbound calls for the AI receptionist. The page can place one person's calls on a timetable, or a list of people from an Excel or CSV file. It does not send SMS or email, even if a campaign record stores those channels.

## What you can do

- Create a campaign with the wizard at `/campaigns/new`. The wizard saves the type, audience description, channels, and script. It does not attach phone numbers and it does not dial anyone.
- Schedule real dials from **Schedule calls** on `/campaigns`. Choose one person, or upload a spreadsheet. Set a start time and one or more intervals.
- Filter the campaign list by status: draft, scheduled, active, paused, or completed.
- Open a campaign to see its plan, scheduled dials, linked calls, and linked appointments.
- Pause a scheduled or active campaign.
- Cancel dials that are still pending. A call already in progress can still finish.

Campaign types are recall, missed-call recovery, appointment reminder, treatment follow-up, and review request.

Spreadsheet columns are name (or first and last), phone, and an optional reason. Up to 200 rows and 2 MB. If a row has no reason, the form's reason is used.

## How the code works

The list page is `src/app/(app)/campaigns/page.tsx`. Creating and updating campaigns is `src/lib/services/campaigns.service.ts`.

Scheduled dials are not a separate contacts table. Each dial is an `automation_events` row:

- `event_type` is `campaign.call_scheduled`
- `entity_id` is the campaign id
- `payload` holds the name, phone, reason, and time
- status moves through pending, processing, completed, or failed

Planning the times is `planScheduledDials` in `src/lib/campaigns/schedule-calls.ts`. The last interval may omit a count, which means "everyone left." Times must be in the future and at least 60 seconds apart. Reading the file is `src/lib/campaigns/read-call-sheet.ts` (ExcelJS for `.xlsx`, a small parser for `.csv`).

Two dispatchers can place due calls:

- `CampaignCallDispatcher` in the app shell, about every 30 seconds, while Live Mode is open.
- The n8n campaign-call-dispatcher workflow, about every minute.

Each run takes the earliest due pending dial per campaign, claims it by setting status to `processing`, and posts the outbound webhook. On success it marks the event completed and increments the campaign's call count. If no pending dials remain, the campaign becomes completed. Cancelling deletes only rows that are still pending.

The Calls section on the campaign page lists `calls` rows whose `campaign_id` matches. The post-call intake does not receive the campaign id, so `getCampaign` links a completed dial to the outbound call that started near the same time and phone. That logic is `attachPlacedCampaignCalls` and `src/lib/campaigns/link-campaign-calls.ts`.

There is no `campaign_contacts` table. Audience presets on the wizard, such as inactive patients, are a description and a preview. They do not build the dial list. Phone numbers are added only through Schedule calls.
