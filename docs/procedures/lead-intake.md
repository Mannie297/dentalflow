# Lead intake

A new inquiry becomes a lead row in Supabase, then gets scored. The browser never writes the lead itself. It posts to n8n, and n8n writes with the Supabase service role.

## When it runs

Something sends `POST https://mannie333.app.n8n.cloud/webhook/lead-intake`.

That something is the app when `NEXT_PUBLIC_N8N_LEAD_WEBHOOK_URL` is set (`submitLeadIntake()` in `src/lib/services/lead-intake.service.ts`), or any other form that posts the same JSON. The workflow **CORE — Lead Intake** must be Active. It waits until the lead is saved and qualification has finished, then answers.

## What you send

`organization_id`, `first_name`, and `source` are required. `source` is one of `inbound_call`, `outbound_call`, `website`, `chat`, `referral`, `walk_in`, or `campaign`. At least one of `phone` or `email` is required. `last_name`, `service_requested`, `message`, and `source_campaign` are optional.

```json
{
  "organization_id": "11111111-1111-1111-1111-111111111111",
  "source": "website",
  "first_name": "John",
  "last_name": "Smith",
  "phone": "+14165551234",
  "email": "john@example.com",
  "service_requested": "Dental Implant",
  "message": "I would like to know the cost of implants."
}
```

## How the process works

1. **Validate Request** checks the same rules as `validateLeadIntakeInput()`. A bad payload stops here. The caller gets HTTP 400 and `{ "success": false, "error": "..." }`. Nothing is written.
2. **Normalize Lead** trims text, lowercases the email, keeps a leading `+` on the phone, and title-cases the name. The message is only trimmed.
3. **Duplicate Check** looks in `leads` for the same organization and the same phone or email, skipping leads already marked `lost` or `completed`.
4. If that row exists, **Update Existing Lead** refreshes `message`, `service_requested`, and `last_contact_at`. If it does not, **Create Lead** inserts a new row with `status` `new`. AI fields stay empty until qualification.
5. **Log automation_events: lead.created** writes `event_type` `lead.created`, `entity_type` `lead`, and the lead id.
6. **Execute: AI — Lead Qualification** runs the scoring procedure in [lead qualification](lead-qualification.md). A failed score does not delete the lead.
7. **Respond: Success** returns `{ "success": true, "lead_id": "...", "status": "created", "message": "Lead received successfully" }`.

## Where to look

Open the Leads page in Live Mode. A new inquiry is a lead named from `first_name` and `last_name`. After qualification, the score and priority are on that lead. The `lead.created` row is in `automation_events`.

## When it fails

- HTTP 400 means the JSON failed validation. The `error` string says which field.
- The workflow must be Active. A test URL (`/webhook-test/lead-intake`) answers only while the editor is listening.
- Duplicate check, create, and the event log all use the **Supabase account** credential. A credential error shows on those nodes in the n8n execution, and the caller gets a controlled error with no stack trace.
