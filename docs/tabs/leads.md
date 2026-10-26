# Leads

Route: `/leads`

Leads is a pipeline of inquiries, from first contact through a booked visit or a lost lead. The board is a set of columns that scrolls inside the page so the rest of the window stays put.

## What you can do

- See leads for the header date range.
- Search by name or phone.
- Filter by service and source.
- Read the lead count and the value of the active pipeline. Lost and completed leads are left out of that value.
- Drag a card to another stage. The new stage is saved.
- Open a card for its details.
- Add a lead from the page.

Stages, in order:

1. New
2. Contacted
3. Qualified
4. Appointment requested
5. Booked
6. Completed
7. Lost

Each card shows the person's name, phone, service, source, score, estimated value, last contact, and next action.

## How the code works

`src/app/(app)/leads/page.tsx` loads leads with `useLeads` and `getLeads` in `src/lib/services/leads.service.ts`. Columns are built in the page by grouping the result on `status`.

Dragging calls `useUpdateLeadStatus`, which updates that lead's status. The open detail sheet reads the lead from the latest query result, so the sheet shows the new stage after the save.

The board is a horizontal scroller (`overflow-x-auto`) inside a page that cannot widen the window. The shell column in `src/components/layout/app-shell.tsx` uses `min-w-0` so the seven columns scroll here instead of stretching the browser.

New inquiries can also arrive from the n8n lead-intake workflow, which creates the lead and then runs qualification. That path is separate from the Add lead button. See `docs/procedures/lead-intake.md`.
