# Settings

Route: `/settings`

Settings is the clinic account page: who the clinic is, who can sign in, and which outside services are actually connected.

## What you can do

- Edit and save the clinic name, phone, address, city, province, and postal code. Name and phone are required.
- See the time zone stored on the clinic.
- See the people on the account, with role and whether they are active.
- Read what Clinic Owner, Administrator, Office Manager, and Receptionist can open.
- See the clinic phone line and the after-hours transfer rule.
- Open the AI Receptionist page.
- See the plan name stored on the organization.
- Sign out.

Calendar, SMS, email sending, in-app notifications, and billing payments are described on the page as not connected. The knowledge base card opens the Knowledge Base page. Files are hosted in Supabase, and n8n indexes them.

Email on the Reports tab is separate. That button opens your own mail program. It is not a clinic email service.

## How the code works

`src/app/(app)/settings/page.tsx` loads three queries from `src/hooks/use-settings.ts`:

- `getOrganization` reads `organizations`.
- `getOrganizationUsers` reads `profiles` in Live Mode, or the demo user list in Demo Mode.
- `getAIReceptionistSettings` reads the `ai_receptionist_config` row in `prompt_templates`.

Save calls `saveReceptionistConfiguration` with the current receptionist rules plus the edited clinic fields. The clinic columns update `organizations`. The rules are written back unchanged, so saving Settings does not wipe the AI Receptionist form. The same function is used by the AI Receptionist page when those rules change.

Roles and the plan label are display maps. `ROLE_LABELS` and `ROLE_PERMISSIONS` in `src/types/database.ts` decide which sidebar tabs a role can see. The sidebar filters `NAV_ITEMS` with the signed-in user's permissions. Receptionists see a smaller set, including limited analytics rather than the full analytics permission.

The signed-in name and role in the Security card come from `useSession`.
